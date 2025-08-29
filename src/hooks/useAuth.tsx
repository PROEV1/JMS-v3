import { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Register auth state listener FIRST to prevent race conditions
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        console.log('Auth state change:', event, session?.user?.email);
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    // THEN get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      console.log('Initial session:', session);
      setSession(session);
      setUser(session?.user ?? null);
      console.log('Initial user:', session?.user);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    console.log('🔴 signOut function called');
    console.log('Current user before signout:', user);
    console.log('Current session before signout:', session);
    
    try {
      setLoading(true);
      
      // Sign out from Supabase - ignore errors for expired sessions
      console.log('Calling supabase.auth.signOut()');
      const { error } = await supabase.auth.signOut();
      
      if (error) {
        console.log('Supabase sign out error (expected for expired sessions):', error);
      } else {
        console.log('Supabase sign out completed successfully');
      }
    } catch (error) {
      console.error('Error during sign out (ignoring):', error);
      // Ignore errors - the session might already be expired
    }
    
    // Always clear local state and redirect regardless of Supabase response
    console.log('Clearing local state and redirecting');
    setSession(null);
    setUser(null);
    setLoading(false);
    
    // Clear session storage
    sessionStorage.removeItem('authRedirectPath');
    sessionStorage.removeItem('lastAuthenticatedPath');
    
    // Force redirect to auth page
    console.log('🔴 Forcing redirect to /auth');
    window.location.replace('/auth');
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signOut }}>
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