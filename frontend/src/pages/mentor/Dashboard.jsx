import React, { useState, useEffect } from 'react';
import { Users, Calendar, Activity, TrendingUp, TrendingDown, ArrowRight, CheckSquare, Upload, BookOpen } from 'lucide-react';
import { Area, AreaChart, ResponsiveContainer, Tooltip } from 'recharts';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { cn } from '../../lib/utils';

const MOCK_SPARKLINE = [
  { value: 65 }, { value: 70 }, { value: 68 }, { value: 75 }, 
  { value: 82 }, { value: 85 }, { value: 88 }, { value: 92 },
];

export default function Dashboard() {
  const [stats, setStats] = useState({ students: 0, sessions: 0, attendance: 0 });
  const [latestSession, setLatestSession] = useState(null);
  const [sessionMetrics, setSessionMetrics] = useState({ present: 0, total: 0, percentage: 0 });
  const [recentActivity, setRecentActivity] = useState([]);
  const [absentStudents, setAbsentStudents] = useState([]);
  const [trendData, setTrendData] = useState([]);
  const [performers, setPerformers] = useState({ highest: null, lowest: null });
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    fetchStats();
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    if (!supabase) return;
    try {
      // 1. Get latest session
      const { data: sData } = await supabase
        .from('sessions')
        .select('*')
        .order('date', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      setLatestSession(sData);

      if (sData) {
        // 2. Get metrics for this session
        const { data: attData } = await supabase
          .from('attendance')
          .select('student_id, present, students(name)')
          .eq('session_id', sData.id);
        
        const present = attData?.filter(a => a.present).length || 0;
        const total = attData?.length || 0;
        setSessionMetrics({
          present,
          total,
          percentage: total > 0 ? Math.round((present / total) * 100) : 0
        });

        const absent = attData?.filter(a => !a.present).map(a => a.students?.name).filter(Boolean) || [];
        setAbsentStudents(absent);
      }

      // 3. Get trend data (last 7 sessions)
      const { data: trendSessions } = await supabase
        .from('sessions')
        .select('id, date, attendance(present)')
        .order('date', { ascending: false })
        .limit(7);

      if (trendSessions) {
        const processedTrend = [...trendSessions].reverse().map(s => {
          const total = s.attendance?.length || 0;
          const present = s.attendance?.filter(a => a.present).length || 0;
          return {
            date: s.date,
            value: total > 0 ? Math.round((present / total) * 100) : 0
          };
        });
        setTrendData(processedTrend);
      }

      // 4. Get recent activity (Attendance + Materials + Appeals)
      const [
        { data: recentAtt },
        { data: recentMat },
        { data: recentApp }
      ] = await Promise.all([
        supabase.from('attendance').select('marked_at, students(name), sessions(topic)').order('marked_at', { ascending: false }).limit(3),
        supabase.from('materials').select('created_at, title').order('created_at', { ascending: false }).limit(2),
        supabase.from('attendance_appeals').select('submitted_at, students(name)').order('submitted_at', { ascending: false }).limit(2)
      ]);

      const activities = [
        ...(recentAtt || []).map(a => ({
          action: `Attendance marked for ${a.students?.name}`,
          detail: a.sessions?.topic,
          time: new Date(a.marked_at),
          icon: CheckSquare
        })),
        ...(recentMat || []).map(m => ({
          action: `New material: ${m.title}`,
          detail: 'Study material uploaded',
          time: new Date(m.created_at),
          icon: BookOpen
        })),
        ...(recentApp || []).map(ap => ({
          action: `Appeal from ${ap.students?.name}`,
          detail: 'Attendance appeal submitted',
          time: new Date(ap.submitted_at),
          icon: Upload
        }))
      ].sort((a, b) => b.time - a.time).slice(0, 5).map(act => ({
        ...act,
        timeStr: act.time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }));

      setRecentActivity(activities.length > 0 ? activities : [
        { action: 'No recent activity found', timeStr: 'Start by marking attendance', icon: Activity }
      ]);

      // 5. Calculate performers
      const { data: studentStats } = await supabase
        .from('students')
        .select('name, attendance(present)');

      if (studentStats && studentStats.length > 0) {
        const studentPercentages = studentStats.map(s => {
          const total = s.attendance?.length || 0;
          const present = s.attendance?.filter(a => a.present).length || 0;
          return {
            name: s.name,
            pct: total > 0 ? Math.round((present / total) * 100) : 0
          };
        });

        const sorted = [...studentPercentages].sort((a, b) => b.pct - a.pct);
        setPerformers({
          highest: sorted[0],
          lowest: sorted[sorted.length - 1]
        });
      }

    } catch (err) {
      console.error(err);
    }
  };

  const fetchStats = async () => {
    if (!supabase) return;
    try {
      const { count: studentCount } = await supabase.from('students').select('*', { count: 'exact', head: true });
      const { count: sessionCount } = await supabase.from('sessions').select('*', { count: 'exact', head: true });
      
      // Get all attendance to calc percentage
      const { data: attData } = await supabase.from('attendance').select('present');
      const presentCount = attData?.filter(a => a.present).length || 0;
      const totalPossible = (studentCount || 0) * (sessionCount || 0);
      const percentage = totalPossible > 0 ? Math.round((presentCount / totalPossible) * 100) : 0;

      setStats({
        students: studentCount || 0,
        sessions: sessionCount || 0,
        attendance: percentage
      });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-12">
      {/* Hero */}
      <section>
        <motion.h1 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-display-hero mb-2 tracking-tight"
        >
          Welcome Back, {user?.profile?.display_name?.split(' ')[0] || 'Mentor'}
        </motion.h1>
        <motion.p 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="text-body-sm text-secondary"
        >
          Manage your students and broadcast important updates.
        </motion.p>
        
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="flex items-center gap-4 mt-6"
        >
          <button className="btn-primary px-6 flex items-center gap-2 shadow-glow shadow-accent-glow/20">
            <Activity size={18} /> Send Announcement
          </button>
          <Link to="/attendance" className="btn-secondary px-6 flex items-center gap-2">
            <CheckSquare size={18} /> Mark Attendance
          </Link>
        </motion.div>
      </section>

      {/* Ticker Strip */}
      <motion.section 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="flex items-center gap-6 overflow-x-auto pb-4 hide-scrollbar"
      >
        <div className="flex items-center gap-3 shrink-0">
          <Calendar size={16} className="text-secondary" />
          <span className="text-caption text-tertiary uppercase tracking-wider">Total Sessions</span>
          <span className="text-body-lg font-semibold tabular-nums ml-1">{loading ? '...' : stats.sessions}</span>
        </div>
        <div className="w-[1px] h-4 bg-border-subtle shrink-0"></div>
        <div className="flex items-center gap-3 shrink-0">
          <Activity size={16} className="text-secondary" />
          <span className="text-caption text-tertiary uppercase tracking-wider">Overall Attendance %</span>
          <span className="text-body-lg font-semibold tabular-nums ml-1 text-success-fg">{loading ? '...' : stats.attendance + '%'}</span>
        </div>
        <div className="w-[1px] h-4 bg-border-subtle shrink-0"></div>
        <div className="flex items-center gap-3 shrink-0">
          <Users size={16} className="text-secondary" />
          <span className="text-caption text-tertiary uppercase tracking-wider">Active Students</span>
          <span className="text-body-lg font-semibold tabular-nums ml-1">{loading ? '...' : stats.students}</span>
        </div>
        <div className="w-[1px] h-4 bg-border-subtle shrink-0"></div>
        <div className="flex items-center gap-3 shrink-0">
          <Calendar size={16} className="text-secondary" />
          <span className="text-caption text-tertiary uppercase tracking-wider">Last Session Date</span>
          <span className="text-body-lg font-semibold tabular-nums ml-1">
            {latestSession ? new Date(latestSession.date).toLocaleDateString() : 'N/A'}
          </span>
        </div>
      </motion.section>

      {/* Primary Cards (2-up) */}
      <section className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <motion.div 
          whileHover={{ y: -2 }}
          className="card relative overflow-hidden flex flex-col"
          style={{ padding: '40px' }}
        >
          <div className="flex items-start justify-between mb-8 z-10">
            <div>
              <p className="text-label text-tertiary mb-2">LATEST SESSION</p>
              <h2 className="text-display-sm">{latestSession?.topic || 'No sessions yet'}</h2>
            </div>
            <span className="pill pill-success">Live</span>
          </div>
          
          <div className="mt-auto z-10">
            <p className="text-body-sm text-secondary mb-4">
              Date: <span className="text-primary font-mono">{latestSession?.date || '...'}</span> • 
              Duration: {latestSession?.duration_hours || '0'}h
            </p>
            <Link to="/attendance" className="btn-primary w-full sm:w-auto flex items-center justify-center gap-2 group">
              Mark Attendance
              <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>

          <div className="absolute right-0 bottom-0 opacity-[0.03] pointer-events-none">
            <Calendar size={240} className="translate-x-1/4 translate-y-1/4" />
          </div>
        </motion.div>

        <motion.div 
          whileHover={{ y: -2 }}
          className="card"
          style={{ padding: '40px' }}
        >
          <div className="flex items-start justify-between mb-8">
            <div>
              <p className="text-label text-tertiary mb-2">LATEST SESSION ATTENDANCE</p>
              <h2 className="text-display-md tabular-nums">{sessionMetrics.present} <span className="text-h3 text-tertiary">/ {sessionMetrics.total}</span></h2>
            </div>
            <span className={cn(
              "pill",
              sessionMetrics.percentage >= 85 ? "pill-success" : 
              sessionMetrics.percentage >= 75 ? "pill-warning" : "pill-danger"
            )}>
              {sessionMetrics.percentage}%
            </span>
          </div>

          <div className="mb-6">
            <div className="h-2 w-full bg-surface-inset rounded-full overflow-hidden">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${sessionMetrics.percentage}%` }}
                transition={{ duration: 1, ease: "easeOut", delay: 0.3 }}
                className={cn(
                  "h-full rounded-full",
                  sessionMetrics.percentage >= 85 ? "bg-success" : 
                  sessionMetrics.percentage >= 75 ? "bg-warning" : "bg-danger"
                )}
              />
            </div>
          </div>

          <div>
            <p className="text-caption text-secondary mb-4 uppercase tracking-widest font-bold flex items-center gap-2">
              <TrendingDown size={14} className="text-danger-fg" /> Recent Absent Students
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {absentStudents.length > 0 ? absentStudents.slice(0, 9).map((student, i) => (
                <motion.div 
                  key={i} 
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.4 + (i * 0.05) }}
                  className="px-3 py-2 rounded-xl bg-danger-bg/20 border border-danger-border/40 text-danger-fg text-[11px] font-bold truncate flex items-center gap-2"
                >
                  <div className="w-1.5 h-1.5 rounded-full bg-danger-fg" />
                  {student}
                </motion.div>
              )) : (
                <div className="col-span-full p-4 border border-dashed border-subtle rounded-xl text-center">
                   <p className="text-caption text-tertiary italic">Everyone was present! Amazing consistency.</p>
                </div>
              )}
              {absentStudents.length > 9 && (
                <div className="px-3 py-2 rounded-xl bg-surface-inset border border-subtle text-tertiary text-[11px] font-bold">
                  + {absentStudents.length - 9} more
                </div>
              )}
            </div>
          </div>
        </motion.div>
      </section>

      {/* Secondary Cards (2-up) */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <motion.div whileHover={{ y: -2 }} className="card">
          <div className="flex items-start justify-between mb-6">
            <div>
              <p className="text-label text-tertiary mb-2">PROGRAM OVERVIEW</p>
              <h2 className="text-h2">Attendance Trend</h2>
            </div>
            <TrendingUp size={20} className="text-success-fg" />
          </div>

          <div className="h-[120px] w-full -ml-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData.length > 0 ? trendData : MOCK_SPARKLINE}>
                <defs>
                  <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--accent-glow)" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="var(--accent-glow)" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <Area 
                  type="monotone" 
                  dataKey="value" 
                  stroke="var(--accent-glow)" 
                  fillOpacity={1} 
                  fill="url(#colorValue)" 
                  strokeWidth={2}
                />
                <Tooltip 
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="bg-surface-raised border border-subtle p-2 rounded-lg shadow-xl text-caption">
                          <p className="text-tertiary mb-1">{payload[0].payload.date}</p>
                          <p className="font-bold text-primary">{payload[0].value}% Attendance</p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          
          <div className="grid grid-cols-2 gap-4 mt-6">
            <div>
              <p className="text-caption text-tertiary">HIGHEST</p>
              <p className="text-body font-medium">
                {performers.highest ? `${performers.highest.name} (${performers.highest.pct}%)` : 'Calculating...'}
              </p>
            </div>
            <div>
              <p className="text-caption text-tertiary">LOWEST</p>
              <p className="text-body font-medium">
                {performers.lowest ? `${performers.lowest.name} (${performers.lowest.pct}%)` : 'Calculating...'}
              </p>
            </div>
          </div>
        </motion.div>

        <motion.div whileHover={{ y: -2 }} className="card">
          <p className="text-label text-tertiary mb-6 uppercase tracking-widest">RECENT ACTIVITY</p>
          <div className="space-y-4">
            {recentActivity.map((item, idx) => (
              <motion.div 
                key={idx} 
                initial={{ x: -10, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: 0.6 + (idx * 0.1) }}
                className="flex items-start gap-4 p-3 rounded-lg hover:bg-surface-raised transition-colors"
              >
                <div className="p-2 rounded-full bg-surface-inset border border-default">
                  <item.icon size={14} className="text-secondary" />
                </div>
                <div className="flex-1">
                  <p className="text-body text-primary">{item.action}</p>
                  <p className="text-caption text-secondary">{item.detail}</p>
                  <p className="text-micro text-tertiary mt-1">{item.timeStr}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </section>

    </div>
  );
}
