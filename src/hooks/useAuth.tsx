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
    console.log('signOut function called');
    try {
      setLoading(true);
      
      // Sign out from Supabase - ignore errors for expired sessions
      console.log('Calling supabase.auth.signOut()');
      await supabase.auth.signOut();
      
      console.log('Supabase sign out completed');
    } catch (error) {
      console.error('Error during sign out (ignoring):', error);
      // Ignore errors - the session might already be expired
    } finally {
      // Always clear local state and redirect regardless of Supabase response
      console.log('Clearing local state and redirecting');
      setSession(null);
      setUser(null);
      setLoading(false);
      
      // Clear session storage
      sessionStorage.removeItem('authRedirectPath');
      sessionStorage.removeItem('lastAuthenticatedPath');
      
      // Redirect to auth page
      window.location.href = '/auth';
    }
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