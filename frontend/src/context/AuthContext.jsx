import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';

const AuthContext = createContext({});

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);
  const loadingResolved = useRef(false);

  // Ensures setLoading(false) only fires once, preventing flicker
  const resolveLoading = () => {
    if (!loadingResolved.current) {
      loadingResolved.current = true;
      setLoading(false);
    }
  };

  useEffect(() => {
    // Guard: if supabase isn't configured, stop immediately
    if (!supabase) {
      resolveLoading();
      return;
    }

    // Failsafe: Ensure loading resolves within 5 seconds regardless of network
    const failsafe = setTimeout(() => {
      console.warn('Auth loading failsafe triggered');
      resolveLoading();
    }, 5000);

    console.time('AuthInitialization');
    // 1. Check existing session on mount
    checkUser().then(() => console.timeEnd('AuthInitialization'));

    // 2. Subscribe to future auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth event:', event);
        try {
          if (session) {
            // Set user immediately, then fetch profile
            setUser(prev => ({ ...(prev || {}), ...session.user }));
            setRole('mentor');
            resolveLoading(); // Resolve loading as soon as we have a session

            // Background profile fetch
            supabase
              .from('users')
              .select('*')
              .eq('id', session.user.id)
              .single()
              .then(({ data }) => {
                if (data) {
                  setUser(curr => ({ ...curr, profile: data }));
                  console.log('Profile loaded successfully');
                }
              });
          } else {
            const studentStr = localStorage.getItem('forge_student');
            if (studentStr) {
              try {
                setUser(JSON.parse(studentStr));
                setRole('student');
              } catch (_) {
                localStorage.removeItem('forge_student');
                setUser(null);
                setRole(null);
              }
            } else {
              setUser(null);
              setRole(null);
            }
            resolveLoading();
          }
        } catch (err) {
          console.error('onAuthStateChange error:', err);
          resolveLoading();
        }
      }
    );

    return () => {
      clearTimeout(failsafe);
      subscription.unsubscribe();
    };
  }, []);

  const checkUser = async () => {
    try {
      const { data } = await supabase.auth.getSession();
      const session = data?.session ?? null;

      if (session) {
        let profile = null;
        try {
          const { data: profileData } = await supabase
            .from('users')
            .select('*')
            .eq('id', session.user.id)
            .single();
          profile = profileData;
        } catch (_) { /* profile fetch failed, continue without it */ }

        setUser({ ...session.user, profile });
        setRole('mentor');
      } else {
        const studentStr = localStorage.getItem('forge_student');
        if (studentStr) {
          try {
            setUser(JSON.parse(studentStr));
            setRole('student');
          } catch (_) {
            localStorage.removeItem('forge_student');
          }
        }
      }
    } catch (err) {
      console.error('checkUser error:', err);
    } finally {
      resolveLoading();
    }
  };

  const loginMentor = async (email, password) => {
    console.time('LoginRequest');
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      return data;
    } finally {
      console.timeEnd('LoginRequest');
    }
  };

  const loginStudent = async (email) => {
    const { data, error } = await supabase
      .from('students')
      .select('*')
      .eq('email', email)
      .single();

    if (error || !data) throw new Error('Student not found with this email');

    localStorage.setItem('forge_student', JSON.stringify(data));
    setUser(data);
    setRole('student');
    return data;
  };

  const logout = async () => {
    if (supabase) await supabase.auth.signOut();
    localStorage.removeItem('forge_student');
    setUser(null);
    setRole(null);
  };

  return (
    <AuthContext.Provider value={{ user, role, loading, loginMentor, loginStudent, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
