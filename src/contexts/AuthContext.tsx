import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: true,
  signOut: async () => {},
});

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Set up auth state listener FIRST (Safari compatibility)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, currentSession) => {
        // Use synchronous state updates only - Safari ITP compatible
        setSession(currentSession);
        setUser(currentSession?.user ?? null);
        setLoading(false);
      }
    );

    // THEN check for existing session (iOS Safari-safe order)
    const initializeAuth = async () => {
      try {
        // First try getSession (fast, from localStorage)
        const { data: { session: existingSession }, error } = await supabase.auth.getSession();
        
        if (existingSession?.user) {
          setSession(existingSession);
          setUser(existingSession.user);
          setLoading(false);
          return;
        }
        
        // iOS Safari fallback: localStorage may be unreliable due to ITP
        // Use getUser() which makes a server call to verify authentication
        console.log('[iOS Auth Init] No local session, trying server verification...');
        
        const { data: { user: serverUser }, error: userError } = await supabase.auth.getUser();
        
        if (serverUser) {
          console.log('[iOS Auth Init] User verified via server, refreshing session...');
          // Try to refresh session to sync localStorage
          const { data: { session: refreshedSession } } = await supabase.auth.refreshSession();
          
          if (refreshedSession) {
            setSession(refreshedSession);
            setUser(refreshedSession.user);
          } else {
            // Even without full session, we have a verified user
            setUser(serverUser);
            setSession(null);
          }
        }
        
        setLoading(false);
      } catch (err) {
        console.error('Auth initialization error:', err);
        setLoading(false);
      }
    };

    initializeAuth();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
      setSession(null);
      setUser(null);
    } catch (err) {
      console.error('Sign out error:', err);
      // Force clear state even on error
      setSession(null);
      setUser(null);
    }
  };

  const value = {
    user,
    session,
    loading,
    signOut,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
