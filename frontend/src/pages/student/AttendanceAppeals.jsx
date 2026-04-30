import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  MessageSquare, 
  Send, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  AlertCircle,
  Trophy,
  Calendar
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { cn } from '../../lib/utils';

export default function AttendanceAppeals() {
  const { user } = useAuth();
  const [absentSessions, setAbsentSessions] = useState([]);
  const [appeals, setAppeals] = useState({}); // session_id -> appeal object
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(null); // session_id being submitted
  const [reason, setReason] = useState('');
  const [selectedSession, setSelectedSession] = useState(null);

  useEffect(() => {
    if (user) {
      fetchAppealsData();
    }
  }, [user]);

  const fetchAppealsData = async () => {
    if (!supabase || !user) return;
    setLoading(true);
    try {
      // 1. Fetch sessions where student was marked absent
      const { data: attendanceData } = await supabase
        .from('attendance')
        .select('session_id, sessions(topic, date)')
        .eq('student_id', user.id)
        .eq('present', false)
        .order('marked_at', { ascending: false });

      setAbsentSessions(attendanceData || []);

      // 2. Fetch existing appeals
      const { data: appealsData } = await supabase
        .from('attendance_appeals')
        .select('*')
        .eq('student_id', user.id);
      
      const appealsMap = {};
      appealsData?.forEach(a => {
        appealsMap[a.session_id] = a;
      });
      setAppeals(appealsMap);

    } catch (err) {
      console.error('Error fetching appeals:', err);
    } finally {
      setLoading(false);
    }
  };

  const submitAppeal = async () => {
    if (!selectedSession || !reason.trim()) return;
    setSubmitting(selectedSession.session_id);
    try {
      const { error } = await supabase
        .from('attendance_appeals')
        .upsert({
          student_id: user.id,
          session_id: selectedSession.session_id,
          reason: reason.trim(),
          status: 'pending'
        });

      if (error) throw error;
      
      await fetchAppealsData();
      setSelectedSession(null);
      setReason('');
    } catch (err) {
      alert('Failed to submit appeal: ' + err.message);
    } finally {
      setSubmitting(null);
    }
  };

  if (loading) return <div className="p-20 text-center animate-pulse text-secondary">Loading your attendance records...</div>;

  if (absentSessions.length === 0) {
    return (
      <div className="h-[60vh] flex flex-col items-center justify-center text-center p-8">
        <motion.div 
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="w-24 h-24 bg-success-bg/20 text-success-fg rounded-full flex items-center justify-center mb-6"
        >
          <Trophy size={48} />
        </motion.div>
        <h2 className="text-display-sm mb-2">You're All Caught Up! 🌟</h2>
        <p className="text-body-lg text-secondary max-w-md">
          You haven't missed a single session so far. Your dedication is inspiring—keep up the great work!
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <header>
        <h1 className="text-display-sm mb-2">Attendance Appeals</h1>
        <p className="text-body-lg text-secondary">Missing a session? Provide a valid reason for your mentor to review.</p>
      </header>

      <div className="grid grid-cols-1 gap-4">
        {absentSessions.map((item, i) => {
          const appeal = appeals[item.session_id];
          return (
            <motion.div 
              key={item.session_id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="card p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-6"
            >
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-surface-inset text-secondary">
                  <Calendar size={24} />
                </div>
                <div>
                  <p className="text-body font-bold">{item.sessions.topic}</p>
                  <p className="text-caption text-tertiary font-mono">{item.sessions.date}</p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-4 w-full md:w-auto">
                {appeal ? (
                  <div className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-lg border text-body-sm font-medium",
                    appeal.status === 'pending' ? "bg-warning-bg/10 border-warning-border/30 text-warning-fg" :
                    appeal.status === 'approved' ? "bg-success-bg/10 border-success-border/30 text-success-fg" :
                    "bg-danger-bg/10 border-danger-border/30 text-danger-fg"
                  )}>
                    {appeal.status === 'pending' ? <Clock size={16} /> :
                     appeal.status === 'approved' ? <CheckCircle2 size={16} /> :
                     <XCircle size={16} />}
                    <span className="capitalize">{appeal.status}</span>
                  </div>
                ) : (
                  <button 
                    onClick={() => setSelectedSession(item)}
                    className="btn-primary flex items-center gap-2 w-full md:w-auto"
                  >
                    <MessageSquare size={16} />
                    Provide Reason
                  </button>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Appeal Form Modal */}
      <AnimatePresence>
        {selectedSession && (
          <div className="modal-container z-50">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="modal-overlay"
              onClick={() => setSelectedSession(null)}
            />
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="modal relative overflow-hidden"
            >
              <h2 className="text-h2 mb-2">Justification</h2>
              <p className="text-body-sm text-secondary mb-6">
                Reason for missing <span className="text-primary font-bold">{selectedSession.sessions.topic}</span>
              </p>

              <textarea 
                className="input w-full min-h-[120px] mb-6 resize-none"
                placeholder="Explain why you were absent (e.g., Medical emergency, Technical issues...)"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />

              <div className="flex gap-3">
                <button 
                  onClick={() => setSelectedSession(null)}
                  className="btn-secondary flex-1"
                >
                  Cancel
                </button>
                <button 
                  onClick={submitAppeal}
                  disabled={!reason.trim() || submitting}
                  className="btn-primary flex-1 flex items-center justify-center gap-2"
                >
                  {submitting ? 'Submitting...' : <><Send size={18} /> Submit</>}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
