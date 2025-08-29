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
      // Clear any local state first
      console.log('Setting loading to true');
      setLoading(true);
      
      // Sign out from Supabase
      console.log('Calling supabase.auth.signOut()');
      const { error } = await supabase.auth.signOut();
      
      if (error) {
        console.error('Error signing out:', error);
        // Even if there's an error, clear local state
        setSession(null);
        setUser(null);
      } else {
        console.log('Supabase sign out successful');
      }
      
      // Clear session storage
      console.log('Clearing session storage');
      sessionStorage.removeItem('authRedirectPath');
      sessionStorage.removeItem('lastAuthenticatedPath');
      
      // Force reload to clear any cached state
      console.log('Redirecting to /auth');
      window.location.href = '/auth';
    } catch (err) {
      console.error('Sign out error:', err);
      // Fallback: clear everything and redirect
      setSession(null);
      setUser(null);
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