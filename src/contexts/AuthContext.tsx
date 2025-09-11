import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useLocation, useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';

type UserRole = 'admin' | 'standard_office_user' | 'partner_user' | 'engineer' | 'client';

interface AuthState {
  user: User | null;
  session: Session | null;
  finalRole: UserRole | null;
  hasPartner: boolean;
  loading: boolean;
  routed: boolean;
}

interface AuthContextType extends AuthState {
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    session: null,
    finalRole: null,
    hasPartner: false,
    loading: true,
    routed: false,
  });
  
  const location = useLocation();
  const navigate = useNavigate();
  const { toast } = useToast();

  // Single role resolution effect - runs once per session
  useEffect(() => {
    let mounted = true;

    const resolveRole = async (user: User) => {
      if (!mounted) return;

      try {
        console.log('🔄 Resolving role for user:', user.email);
        
        // Fetch both profile and partner data in parallel
        const [profileResult, partnerResult] = await Promise.all([
          supabase
            .from('profiles')
            .select('role, status')
            .eq('user_id', user.id)
            .maybeSingle(),
          supabase
            .from('partner_users')
            .select('partner_id, role')
            .eq('user_id', user.id)
            .eq('is_active', true)
            .maybeSingle()
        ]);

        if (!mounted) return;

        const { data: profileData, error: profileError } = profileResult;
        const { data: partnerData, error: partnerError } = partnerResult;

        if (profileError) {
          console.error('Profile fetch error:', profileError);
          throw profileError;
        }

        if (!profileData || profileData.status !== 'active') {
          console.warn('No active profile found for user:', user.email);
          setState(prev => ({ ...prev, finalRole: null, hasPartner: false, loading: false }));
          return;
        }

        const profileRole = profileData.role as UserRole;
        const hasPartnerRecord = Boolean(partnerData && !partnerError);
        let finalRole: UserRole;

        // Role resolution logic
        if (profileRole === 'partner_user' && hasPartnerRecord) {
          finalRole = 'partner_user';
        } else if (profileRole === 'partner_user' && !hasPartnerRecord) {
          // Partner user without partner record - fallback to standard_office_user
          finalRole = 'standard_office_user';
          console.warn('Partner user without partner record, falling back to standard_office_user');
          toast({
            title: "Account Notice",
            description: "Your account isn't linked to a partner yet.",
            variant: "default",
          });
        } else {
          finalRole = profileRole;
        }

        console.log('✅ Role resolved:', {
          email: user.email,
          profileRole,
          hasPartnerRecord,
          finalRole
        });

        setState(prev => ({
          ...prev,
          finalRole,
          hasPartner: hasPartnerRecord,
          loading: false
        }));

        // Update last login
        supabase
          .from('profiles')
          .update({ last_login: new Date().toISOString() })
          .eq('user_id', user.id)
          .then(({ error }) => {
            if (error) console.error('Error updating last login:', error);
          });

      } catch (error) {
        console.error('Role resolution error:', error);
        if (mounted) {
          setState(prev => ({ ...prev, finalRole: null, hasPartner: false, loading: false }));
        }
      }
    };

    const handleAuthStateChange = (event: string, session: Session | null) => {
      console.log('🔄 Auth state change:', event, session?.user?.email);
      
      if (!mounted) return;

      setState(prev => ({
        ...prev,
        session,
        user: session?.user ?? null,
        loading: !session ? false : prev.loading, // Only stop loading if no session
        routed: false // Reset routed state on auth change
      }));

      if (session?.user) {
        resolveRole(session.user);
      } else {
        setState(prev => ({
          ...prev,
          finalRole: null,
          hasPartner: false,
          loading: false
        }));
      }
    };

    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(handleAuthStateChange);

    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (mounted) {
        handleAuthStateChange('INITIAL_SESSION', session);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [toast]);

  // Single routing effect - runs once after role is resolved
  useEffect(() => {
    const { session, finalRole, loading, routed } = state;
    
    if (!session || !finalRole || loading || routed) return;

    const currentPath = location.pathname;
    console.log('🚦 Routing check:', { currentPath, finalRole, email: state.user?.email });

    let target: string | null = null;

    // Handle root path redirect
    if (currentPath === '/') {
      if (finalRole === 'partner_user') target = '/partner';
      else if (finalRole === 'engineer') target = '/engineer/dashboard';
      else if (finalRole === 'client') target = '/auth'; // Clients should stay on auth page or be redirected appropriately
      else target = '/admin';
    }
    
    // Block invalid pages
    const onPartnerButNotPartner = currentPath.startsWith('/partner') && finalRole !== 'partner_user';
    const onAdminButPartner = currentPath.startsWith('/admin') && finalRole === 'partner_user';
    const onEngineerButNotEngineer = currentPath.startsWith('/engineer') && finalRole !== 'engineer';
    const onAdminButEngineer = currentPath.startsWith('/admin') && finalRole === 'engineer';
    
    if (!target) {
      if (onPartnerButNotPartner) target = '/admin';
      else if (onAdminButPartner) target = '/partner';
      else if (onEngineerButNotEngineer) target = finalRole === 'partner_user' ? '/partner' : '/admin';
      else if (onAdminButEngineer) target = '/engineer/dashboard';
    }

    if (target && target !== currentPath) {
      console.log('🔄 Redirecting to:', target);
      navigate(target, { replace: true });
    }

    // Mark as routed to prevent future redirects
    setState(prev => ({ ...prev, routed: true }));
  }, [state.session, state.finalRole, state.loading, state.routed, location.pathname, navigate]);

  const signOut = async () => {
    console.log('🔄 Signing out user:', state.user?.email);
    
    try {
      // Clear local state first
      setState(prev => ({
        ...prev,
        session: null,
        user: null,
        finalRole: null,
        hasPartner: false,
        loading: false,
        routed: false
      }));
      
      // Clear session storage
      sessionStorage.removeItem('authRedirectPath');
      sessionStorage.removeItem('lastAuthenticatedPath');
      
      // Sign out from Supabase
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.log('Supabase sign out error (ignoring):', error);
      }
      
      // Force redirect to auth page
      window.location.replace('/auth');
    } catch (error) {
      console.error('Sign out error:', error);
      // Still redirect even if error
      window.location.replace('/auth');
    }
  };

  return (
    <AuthContext.Provider value={{ ...state, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}