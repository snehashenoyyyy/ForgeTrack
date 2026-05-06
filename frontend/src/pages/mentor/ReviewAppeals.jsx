import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  CheckCircle2, 
  XCircle, 
  User, 
  Calendar, 
  MessageSquare,
  AlertCircle,
  ArrowRight,
  Search,
  Filter,
  Check,
  X,
  Clock,
  Activity,
  History
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { cn } from '../../lib/utils';

export default function ReviewAppeals() {
  const [appeals, setAppeals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sessionFilter, setSessionFilter] = useState('all');
  const [toast, setToast] = useState(null);
  const [stats, setStats] = useState({ pending: 0, actionsToday: 0, avgTime: '...' });

  useEffect(() => {
    fetchAppeals();
  }, []);

  const fetchAppeals = async () => {
    if (!supabase) return;
    setLoading(true);
    try {
      // 1. Fetch pending appeals
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

      // 2. Fetch stats
      const today = new Date().toISOString().split('T')[0];
      const { count: actionsToday } = await supabase
        .from('attendance_appeals')
        .select('*', { count: 'exact', head: true })
        .neq('status', 'pending')
        .gte('processed_at', today);

      setStats({
        pending: data?.length || 0,
        actionsToday: actionsToday || 0,
        avgTime: '2.4h'
      });
    } catch (err) {
      console.error('Error fetching appeals:', err);
    } finally {
      setLoading(false);
    }
  };

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleAction = async (appeal, newStatus) => {
    if (processing) return;
    setProcessing(appeal.id);
    try {
      const { error: appealError } = await supabase
        .from('attendance_appeals')
        .update({ 
          status: newStatus, 
          processed_at: new Date().toISOString() 
        })
        .eq('id', appeal.id);

      if (appealError) throw appealError;

      if (newStatus === 'approved') {
        const { error: attError } = await supabase
          .from('attendance')
          .update({ present: true })
          .match({ student_id: appeal.student_id, session_id: appeal.session_id });
        
        if (attError) throw attError;
      }

      showToast(`Appeal ${newStatus === 'approved' ? 'Approved' : 'Rejected'} successfully`);
      await fetchAppeals();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setProcessing(null);
    }
  };

  const filteredAppeals = appeals.filter(a => {
    const name = a.students?.name || "";
    const usn = a.students?.usn || "";
    
    const matchesSearch = 
      name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      usn.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesSession = sessionFilter === 'all' || a.sessions?.topic === sessionFilter;
    
    return matchesSearch && matchesSession;
  });

  const getReasonTag = (reason) => {
    const r = (reason || "").toLowerCase();
    if (r.includes('medical') || r.includes('health') || r.includes('sick') || r.includes('fever')) 
      return { label: 'Medical', color: 'pill-danger' };
    if (r.includes('family') || r.includes('marriage') || r.includes('home') || r.includes('personal')) 
      return { label: 'Personal', color: 'pill-warning' };
    if (r.includes('tech') || r.includes('internet') || r.includes('power') || r.includes('laptop')) 
      return { label: 'Technical', color: 'pill-secondary' };
    return { label: 'General', color: 'pill-secondary' };
  };

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (filteredAppeals.length === 0 || processing) return;
      
      const topAppeal = filteredAppeals[0];
      if (e.key.toLowerCase() === 'a') handleAction(topAppeal, 'approved');
      if (e.key.toLowerCase() === 'r') handleAction(topAppeal, 'rejected');
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [filteredAppeals, processing]);

  if (loading) return <div className="p-20 text-center animate-pulse text-secondary">Loading pending justifications...</div>;

  return (
    <div className="space-y-10 max-w-6xl mx-auto pb-20">
      {/* Toast Notification */}
      <AnimatePresence>
        {toast && (
          <motion.div 
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            className={cn(
              "fixed bottom-8 left-1/2 -translate-x-1/2 z-50 px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 border backdrop-blur-md",
              toast.type === 'error' ? "bg-danger-bg border-danger-border text-danger-fg" : "bg-success-bg border-success-border text-success-fg"
            )}
          >
            {toast.type === 'error' ? <AlertCircle size={20} /> : <Check size={20} />}
            <span className="font-medium">{toast.message}</span>
          </motion.div>
        )}
      </AnimatePresence>

      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <span className="pill pill-warning px-3 py-1">Action Required</span>
          </div>
          <h1 className="text-display-md tracking-tight">Review Appeals</h1>
          <p className="text-body-sm text-secondary">Evaluate justifications and update cohort attendance records.</p>
        </div>
        
        <div className="flex items-center gap-3 text-caption text-tertiary bg-surface-inset px-4 py-2 rounded-lg border border-subtle">
          <Clock size={14} />
          <span>Hotkeys: <kbd className="bg-surface-raised px-1.5 py-0.5 rounded border border-default text-primary">A</kbd> Approve • <kbd className="bg-surface-raised px-1.5 py-0.5 rounded border border-default text-primary">R</kbd> Reject</span>
        </div>
      </header>

      {/* Analytics Summary */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card p-6 flex items-center gap-5">
          <div className="w-12 h-12 rounded-2xl bg-warning-bg flex items-center justify-center text-warning-fg border border-warning-border">
            <Clock size={24} />
          </div>
          <div>
            <p className="text-label text-tertiary">PENDING QUEUE</p>
            <p className="text-h1 tabular-nums">{stats.pending}</p>
          </div>
        </div>
        <div className="card p-6 flex items-center gap-5">
          <div className="w-12 h-12 rounded-2xl bg-success-bg flex items-center justify-center text-success-fg border border-success-border">
            <Activity size={24} />
          </div>
          <div>
            <p className="text-label text-tertiary">PROCESSED TODAY</p>
            <p className="text-h1 tabular-nums">{stats.actionsToday}</p>
          </div>
        </div>
        <div className="card p-6 flex items-center gap-5">
          <div className="w-12 h-12 rounded-2xl bg-info-bg flex items-center justify-center text-info-fg border border-info-border">
            <History size={24} />
          </div>
          <div>
            <p className="text-label text-tertiary">AVG. RESPONSE</p>
            <p className="text-h1 tabular-nums">{stats.avgTime}</p>
          </div>
        </div>
      </section>

      {/* Filters */}
      <section className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-tertiary" size={18} />
          <input 
            type="text"
            placeholder="Search by student name or USN..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input w-full pl-12"
          />
        </div>
        <div className="relative">
          <Filter className="absolute left-4 top-1/2 -translate-y-1/2 text-tertiary" size={18} />
          <select 
            value={sessionFilter}
            onChange={(e) => setSessionFilter(e.target.value)}
            className="input pl-12 pr-10 appearance-none bg-surface-inset"
          >
            <option value="all">All Sessions</option>
            {[...new Set(appeals.map(a => a.sessions?.topic))].filter(Boolean).map(topic => (
              <option key={topic} value={topic}>{topic}</option>
            ))}
          </select>
        </div>
      </section>

      {filteredAppeals.length === 0 ? (
        <div className="h-[50vh] flex flex-col items-center justify-center text-center p-8 card border-dashed border-2">
          <div className="w-16 h-16 bg-surface-inset rounded-full flex items-center justify-center mb-4 opacity-50">
             <CheckCircle2 size={32} className="text-success-fg" />
          </div>
          <h2 className="text-h2 mb-1">Queue Empty</h2>
          <p className="text-body-sm text-secondary">All attendance justifications have been processed.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          <AnimatePresence mode="popLayout">
            {filteredAppeals.map((appeal, i) => {
              const tag = getReasonTag(appeal.reason);
              return (
                <motion.div 
                  key={appeal.id}
                  layout
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, x: 20 }}
                  transition={{ delay: i * 0.05 }}
                  className="card p-0 overflow-hidden group hover:border-strong transition-colors"
                >
                  <div className="flex flex-col lg:flex-row">
                    {/* Student Info Sidebar */}
                    <div className="lg:w-72 p-8 bg-surface-inset/30 border-r border-subtle shrink-0">
                      <div className="flex items-center gap-4 mb-6">
                        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-accent-glow/20 to-accent-glow/5 flex items-center justify-center text-accent-glow border border-accent-glow/10">
                          <User size={24} />
                        </div>
                        <div>
                          <h3 className="text-body font-bold text-primary leading-tight">{appeal.students.name}</h3>
                          <p className="text-micro text-tertiary font-mono">{appeal.students.usn}</p>
                        </div>
                      </div>
                      <div className="space-y-3">
                        <div className="flex items-center gap-2 text-caption text-secondary">
                          <Calendar size={14} className="text-tertiary" />
                          <span>Session: {appeal.sessions.topic}</span>
                        </div>
                        <div className="flex items-center gap-2 text-caption text-secondary">
                          <AlertCircle size={14} className="text-tertiary" />
                          <span>Branch: {appeal.students.branch_code}</span>
                        </div>
                      </div>
                    </div>

                    {/* Content & Actions */}
                    <div className="flex-1 p-8 flex flex-col justify-between">
                      <div className="space-y-4 mb-8">
                        <div className="flex items-center justify-between">
                          <span className={cn("pill", tag.color)}>{tag.label}</span>
                          <span className="text-micro text-tertiary">Submitted {new Date(appeal.submitted_at).toLocaleDateString()}</span>
                        </div>
                        <div className="relative">
                          <MessageSquare size={16} className="absolute -left-1 -top-1 opacity-20" />
                          <p className="text-body text-primary italic pl-6 leading-relaxed">
                            "{appeal.reason}"
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <button 
                          onClick={() => handleAction(appeal, 'rejected')}
                          disabled={processing === appeal.id}
                          className="flex-1 h-12 rounded-xl bg-surface-raised text-danger-fg border border-danger-border hover:bg-danger-bg/10 transition-all flex items-center justify-center gap-2 font-bold"
                        >
                          <X size={18} />
                          Reject
                        </button>
                        <button 
                          onClick={() => handleAction(appeal, 'approved')}
                          disabled={processing === appeal.id}
                          className="flex-[2] h-12 rounded-xl bg-success-fg text-void font-bold hover:bg-[#00D97E] shadow-lg shadow-success-fg/20 transition-all flex items-center justify-center gap-2"
                        >
                          {processing === appeal.id ? (
                            <span className="flex items-center gap-2">
                              <div className="w-4 h-4 border-2 border-void/30 border-t-void rounded-full animate-spin" />
                              Updating...
                            </span>
                          ) : (
                            <><Check size={20} strokeWidth={3} /> Approve Appeal</>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
