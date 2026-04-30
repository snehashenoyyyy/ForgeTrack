import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  CheckCircle2, 
  XCircle, 
  User, 
  Calendar, 
  MessageSquare,
  AlertCircle,
  ArrowRight
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { cn } from '../../lib/utils';

export default function ReviewAppeals() {
  const [appeals, setAppeals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(null); // id being processed

  useEffect(() => {
    fetchAppeals();
  }, []);

  const fetchAppeals = async () => {
    if (!supabase) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('attendance_appeals')
        .select(`
          *,
          students(name, usn, branch_code),
          sessions(topic, date)
        `)
        .eq('status', 'pending')
        .order('submitted_at', { ascending: true });
      
      if (error) throw error;
      setAppeals(data || []);
    } catch (err) {
      console.error('Error fetching appeals:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (appeal, newStatus) => {
    setProcessing(appeal.id);
    try {
      // 1. Update appeal status
      const { error: appealError } = await supabase
        .from('attendance_appeals')
        .update({ status: newStatus, processed_at: new Date().toISOString() })
        .eq('id', appeal.id);

      if (appealError) throw appealError;

      // 2. If approved, update attendance record to present
      if (newStatus === 'approved') {
        const { error: attError } = await supabase
          .from('attendance')
          .update({ present: true })
          .match({ student_id: appeal.student_id, session_id: appeal.session_id });
        
        if (attError) throw attError;
      }

      // 3. Refresh list
      await fetchAppeals();
    } catch (err) {
      alert('Action failed: ' + err.message);
    } finally {
      setProcessing(null);
    }
  };

  if (loading) return <div className="p-20 text-center animate-pulse text-secondary">Loading pending justifications...</div>;

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      <header>
        <h1 className="text-display-sm mb-2">Review Appeals</h1>
        <p className="text-body-lg text-secondary">Evaluate student reasons for being absent and update their attendance.</p>
      </header>

      {appeals.length === 0 ? (
        <div className="h-[50vh] flex flex-col items-center justify-center text-center p-8 card border-dashed border-2">
          <div className="w-16 h-16 bg-surface-inset rounded-full flex items-center justify-center mb-4 opacity-50">
             <CheckCircle2 size={32} className="text-success-fg" />
          </div>
          <h2 className="text-h2 mb-1">Queue Empty</h2>
          <p className="text-body-sm text-secondary">All attendance justifications have been processed.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          <AnimatePresence>
            {appeals.map((appeal, i) => (
              <motion.div 
                key={appeal.id}
                layout
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="card p-8 flex flex-col lg:flex-row gap-8 items-start lg:items-center justify-between group"
              >
                <div className="flex-1 space-y-6 w-full">
                  <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-accent-glow/10 flex items-center justify-center text-accent-glow">
                        <User size={20} />
                      </div>
                      <div>
                        <p className="text-body font-bold">{appeal.students.name}</p>
                        <p className="text-micro text-tertiary uppercase font-mono">{appeal.students.usn}</p>
                      </div>
                    </div>
                    <ArrowRight size={16} className="text-tertiary hidden sm:block" />
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 rounded-xl bg-surface-inset text-secondary">
                        <Calendar size={20} />
                      </div>
                      <div>
                        <p className="text-body font-medium">{appeal.sessions.topic}</p>
                        <p className="text-caption text-tertiary font-mono">{appeal.sessions.date}</p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-surface-inset/50 p-4 rounded-xl border border-subtle relative">
                    <MessageSquare size={14} className="absolute -top-2 -left-2 text-accent-glow bg-canvas rounded-full" />
                    <p className="text-body-sm italic text-primary leading-relaxed">
                      "{appeal.reason}"
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 w-full lg:w-auto shrink-0 border-t lg:border-none pt-6 lg:pt-0">
                  <button 
                    onClick={() => handleAction(appeal, 'rejected')}
                    disabled={processing === appeal.id}
                    className="flex-1 lg:flex-none h-[48px] px-6 rounded-xl bg-danger-bg text-danger-fg border border-danger-border hover:bg-danger-bg/20 transition-colors flex items-center justify-center gap-2 font-bold"
                  >
                    <XCircle size={18} />
                    Reject
                  </button>
                  <button 
                    onClick={() => handleAction(appeal, 'approved')}
                    disabled={processing === appeal.id}
                    className="flex-1 lg:flex-none h-[48px] px-6 rounded-xl bg-[#00E676] text-[#07070B] font-black hover:bg-[#00FF88] shadow-[0_0_20px_rgba(0,230,118,0.4)] hover:shadow-[0_0_30px_rgba(0,230,118,0.6)] transition-all flex items-center justify-center gap-2 uppercase tracking-tight"
                  >
                    {processing === appeal.id ? 'Updating...' : <><CheckCircle2 size={18} strokeWidth={3} /> Approve</>}
                  </button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
