import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const AuthContext = createContext({});

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check active session
    checkUser();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        setUser(session.user);
        // Default role for Supabase Auth users is mentor for this app
        setRole('mentor');
      } else {
        // Check if there's a student session in localStorage
        const student = localStorage.getItem('forge_student');
        if (student) {
          setUser(JSON.parse(student));
          setRole('student');
        } else {
          setUser(null);
          setRole(null);
        }
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const checkUser = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      setUser(session.user);
      setRole('mentor');
    } else {
      const student = localStorage.getItem('forge_student');
      if (student) {
        setUser(JSON.parse(student));
        setRole('student');
      }
    }
    setLoading(false);
  };

  const loginMentor = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  };

  const loginStudent = async (email) => {
    // For students, we verify if they exist in the database
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
    await supabase.auth.signOut();
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
