import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, Lock, LogIn, CodeSquare, AlertCircle, User, GraduationCap } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { cn } from '../../lib/utils';

export default function Login() {
  const [activeTab, setActiveTab] = useState('mentor'); // 'mentor' or 'student'
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const navigate = useNavigate();
  const { loginMentor, loginStudent } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (activeTab === 'mentor') {
        await loginMentor(username, password);
        navigate('/dashboard');
      } else {
        await loginStudent(username, password);
        navigate('/dashboard'); 
      }
    } catch (err) {
      setError(err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-void flex items-center justify-center p-6 relative overflow-hidden">
      {/* Background Decorations */}
      <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] bg-accent-glow/5 rounded-full blur-[120px]" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] bg-accent-glow/5 rounded-full blur-[120px]" />
      
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md z-10"
      >
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-3 mb-6">
            <div className="bg-accent-glow p-2.5 rounded-xl text-primary shadow-lg shadow-accent-glow/20">
              <CodeSquare size={28} strokeWidth={2.5} />
            </div>
            <span className="text-display-md font-display tracking-tight">ForgeTrack</span>
          </div>
          <h1 className="text-h1 mb-2">Build the Future.</h1>
          <p className="text-body-sm text-secondary">Sign in to your learning dashboard</p>
        </div>

        <div className="card p-2 bg-surface-inset border-subtle mb-6">
          <div className="flex gap-1">
            <button 
              onClick={() => setActiveTab('mentor')}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 py-3 rounded-lg text-label transition-all duration-300",
                activeTab === 'mentor' ? "bg-surface-raised text-primary shadow-sm" : "text-tertiary hover:text-secondary"
              )}
            >
              <User size={16} />
              MENTOR
            </button>
            <button 
              onClick={() => setActiveTab('student')}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 py-3 rounded-lg text-label transition-all duration-300",
                activeTab === 'student' ? "bg-surface-raised text-primary shadow-sm" : "text-tertiary hover:text-secondary"
              )}
            >
              <GraduationCap size={16} />
              STUDENT
            </button>
          </div>
        </div>

        <div className="card p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            <AnimatePresence mode="wait">
              {error && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="bg-danger-bg border border-danger-border p-4 rounded-xl flex items-center gap-3 text-danger-fg text-body-sm"
                >
                  <AlertCircle size={18} className="shrink-0" />
                  {error}
                </motion.div>
              )}
            </AnimatePresence>

            <div className="space-y-4">
              <div>
                <label className="text-label text-tertiary block mb-2 uppercase tracking-widest">
                  {activeTab === 'mentor' ? 'EMAIL ADDRESS' : 'USERNAME (USN OR EMAIL)'}
                </label>
                <div className="relative">
                  {activeTab === 'mentor' ? (
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-tertiary" size={18} />
                  ) : (
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 text-tertiary" size={18} />
                  )}
                  <input 
                    type={activeTab === 'mentor' ? 'email' : 'text'} 
                    placeholder={activeTab === 'mentor' ? 'name@organization.com' : 'Enter USN or Email'}
                    className="input w-full pl-12 h-[52px] input-with-icon"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                  />
                </div>
              </div>

              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
              >
                <label className="text-label text-tertiary block mb-2 uppercase tracking-widest">PASSWORD</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-tertiary" size={18} />
                  <input 
                    type="password" 
                    placeholder="••••••••"
                    className="input w-full pl-12 h-[52px] input-with-icon"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
              </motion.div>
            </div>

            <button 
              type="submit"
              disabled={loading}
              className="btn-primary w-full h-[56px] rounded-xl text-body font-bold flex items-center justify-center gap-2 group mt-4 shadow-xl shadow-accent-glow/10"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  Sign In
                  <LogIn size={18} className="group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>
          </form>
        </div>

        <p className="text-center mt-8 text-caption text-tertiary">
          {activeTab === 'mentor' 
            ? "Forgot your password? Contact the administrator."
            : "Trouble logging in? Ensure you've provided the email registered by your mentor."}
        </p>
      </motion.div>
    </div>
  );
}
