import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  User, 
  Calendar, 
  CheckCircle2, 
  XCircle, 
  FileText, 
  TrendingUp, 
  BookOpen, 
  Clock,
  ExternalLink
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { cn } from '../../lib/utils';

export default function StudentDashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState({ total: 0, attended: 0, percentage: 0 });
  const [history, setHistory] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchStudentData();
    }
  }, [user]);

  const fetchStudentData = async () => {
    if (!supabase || !user) return;
    setLoading(true);
    try {
      // 1. Fetch total sessions count
      const { count: totalSessions } = await supabase
        .from('sessions')
        .select('*', { count: 'exact', head: true });

      // 2. Fetch student's attendance
      const { data: attendanceData } = await supabase
        .from('attendance')
        .select('present, sessions(topic, date)')
        .eq('student_id', user.id)
        .order('marked_at', { ascending: false });

      const attendedCount = attendanceData?.filter(a => a.present).length || 0;
      const pct = totalSessions > 0 ? Math.round((attendedCount / totalSessions) * 100) : 0;

      setStats({
        total: totalSessions,
        attended: attendedCount,
        percentage: pct
      });

      setHistory(attendanceData || []);

      // 3. Fetch materials for student's branch
      const { data: materialData } = await supabase
        .from('materials')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5);
      
      setMaterials(materialData || []);

    } catch (err) {
      console.error('Error fetching student dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-secondary animate-pulse">Loading your dashboard...</div>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-12">
      {/* Welcome Header */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-display-md mb-2">Hello, {user.name} 👋</h1>
          <p className="text-body-lg text-secondary">Track your attendance and access course materials.</p>
        </div>
        <div className="flex items-center gap-4 bg-surface-raised/50 p-4 rounded-2xl border border-subtle">
           <div className="w-12 h-12 rounded-full bg-accent-glow/10 flex items-center justify-center text-accent-glow">
              <User size={24} />
           </div>
           <div>
              <p className="text-body font-bold">{user.usn}</p>
              <p className="text-caption text-tertiary uppercase">{user.branch_code} • Student</p>
           </div>
        </div>
      </header>

      {/* Top Stats */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <motion.div whileHover={{ y: -4 }} className="card p-8 flex flex-col items-center justify-center text-center">
          <p className="text-label text-tertiary mb-4 uppercase tracking-widest">Attendance</p>
          <div className="relative w-32 h-32 mb-4">
             <svg className="w-full h-full transform -rotate-90">
                <circle cx="64" cy="64" r="58" stroke="currentColor" strokeWidth="8" fill="transparent" className="text-surface-inset" />
                <circle cx="64" cy="64" r="58" stroke="currentColor" strokeWidth="8" fill="transparent" 
                        strokeDasharray={364} strokeDashoffset={364 - (364 * stats.percentage / 100)}
                        className={cn("transition-all duration-1000", stats.percentage >= 75 ? "text-success-fg" : "text-danger-fg")} />
             </svg>
             <div className="absolute inset-0 flex items-center justify-center flex-col">
                <span className="text-h1 tabular-nums">{stats.percentage}%</span>
             </div>
          </div>
          <p className="text-body-sm text-secondary">Minimum requirement: 75%</p>
        </motion.div>

        <motion.div whileHover={{ y: -4 }} className="card p-8 flex flex-col justify-center">
           <div className="flex items-center gap-4 mb-6 text-secondary">
              <div className="p-3 rounded-xl bg-surface-inset"><Calendar size={24} /></div>
              <p className="text-label uppercase tracking-widest">Sessions</p>
           </div>
           <div className="space-y-1">
              <p className="text-display-sm tabular-nums">{stats.attended} / {stats.total}</p>
              <p className="text-body-sm text-secondary">Total classes attended so far</p>
           </div>
        </motion.div>

        <motion.div whileHover={{ y: -4 }} className="card p-8 flex flex-col justify-center">
           <div className="flex items-center gap-4 mb-6 text-secondary">
              <div className="p-3 rounded-xl bg-surface-inset"><TrendingUp size={24} /></div>
              <p className="text-label uppercase tracking-widest">Rank</p>
           </div>
           <div className="space-y-1">
              <p className="text-display-sm">Top 10%</p>
              <p className="text-body-sm text-secondary">Based on current attendance</p>
           </div>
        </motion.div>
      </section>

      {/* History & Materials */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Attendance Log */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-h3">Attendance Log</h3>
            <Clock size={18} className="text-tertiary" />
          </div>
          <div className="space-y-3">
            {history.length > 0 ? history.map((item, i) => (
              <motion.div 
                key={i}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className="flex items-center justify-between p-4 rounded-xl border border-subtle bg-surface/40"
              >
                <div className="flex items-center gap-4">
                  <div className={cn(
                    "w-10 h-10 rounded-lg flex items-center justify-center",
                    item.present ? "bg-success-bg/10 text-success-fg" : "bg-danger-bg/10 text-danger-fg"
                  )}>
                    {item.present ? <CheckCircle2 size={20} /> : <XCircle size={20} />}
                  </div>
                  <div>
                    <p className="text-body font-medium">{item.sessions.topic}</p>
                    <p className="text-caption text-tertiary font-mono">{item.sessions.date}</p>
                  </div>
                </div>
                <span className={cn(
                  "text-micro font-bold px-2 py-1 rounded",
                  item.present ? "bg-success-bg/20 text-success-fg" : "bg-danger-bg/20 text-danger-fg"
                )}>
                  {item.present ? 'PRESENT' : 'ABSENT'}
                </span>
              </motion.div>
            )) : (
              <div className="p-12 text-center card bg-surface-inset/10 border-dashed border-2">
                <p className="text-secondary italic">No attendance records found yet.</p>
              </div>
            )}
          </div>
        </div>

        {/* Resources */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-h3">Learning Materials</h3>
            <BookOpen size={18} className="text-tertiary" />
          </div>
          <div className="space-y-4">
            {materials.length > 0 ? materials.map((item, i) => (
              <motion.div 
                key={i}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="card p-5 hover:bg-surface-raised transition-colors group cursor-pointer"
              >
                <div className="flex items-start justify-between">
                  <div className="flex gap-4">
                    <div className="p-3 rounded-xl bg-surface-inset text-secondary group-hover:text-accent-glow transition-colors">
                      <FileText size={24} />
                    </div>
                    <div>
                      <p className="text-body font-medium group-hover:text-accent-glow transition-colors">{item.title}</p>
                      <p className="text-caption text-secondary line-clamp-1">{item.description}</p>
                      <p className="text-micro text-tertiary mt-2 uppercase font-mono">{new Date(item.created_at).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <ExternalLink size={16} className="text-tertiary opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </motion.div>
            )) : (
              <div className="p-12 text-center card bg-surface-inset/10 border-dashed border-2">
                <p className="text-secondary italic">No materials uploaded for your branch yet.</p>
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
