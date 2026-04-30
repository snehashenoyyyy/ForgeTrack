import React, { useState, useEffect } from 'react';
import { Users, Calendar, Activity, TrendingUp, TrendingDown, ArrowRight, CheckSquare, Upload, BookOpen } from 'lucide-react';
import { Area, AreaChart, ResponsiveContainer, Tooltip } from 'recharts';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';

const MOCK_SPARKLINE = [
  { value: 65 }, { value: 70 }, { value: 68 }, { value: 75 }, 
  { value: 82 }, { value: 85 }, { value: 88 }, { value: 92 },
];

import { supabase } from '../../lib/supabase';

export default function Dashboard() {
  const [stats, setStats] = useState({ students: 0, sessions: 0, attendance: 0 });
  const [latestSession, setLatestSession] = useState(null);
  const [recentActivity, setRecentActivity] = useState([]);
  const [absentStudents, setAbsentStudents] = useState([]);
  const [loading, setLoading] = useState(true);

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
        // 2. Get absent students for this session
        const { data: attData } = await supabase
          .from('attendance')
          .select('student_id, present, students(name)')
          .eq('session_id', sData.id);
        
        const absent = attData?.filter(a => !a.present).map(a => a.students.name) || [];
        setAbsentStudents(absent);
      }

      // 3. Get recent activity (Attendance + Materials)
      const { data: recentAtt } = await supabase
        .from('attendance')
        .select('created_at, students(name), sessions(topic)')
        .order('created_at', { ascending: false })
        .limit(3);

      const activities = (recentAtt || []).map(a => ({
        action: `Attendance marked for ${a.students?.name} in ${a.sessions?.topic}`,
        time: new Date(a.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        icon: CheckSquare
      }));

      setRecentActivity(activities.length > 0 ? activities : [
        { action: 'No recent activity found', time: 'Start by marking attendance', icon: Activity }
      ]);

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
          Welcome Back, Nischay
        </motion.h1>
        <motion.p 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="text-body-sm text-secondary"
        >
          Last login: Today at 09:41 AM
        </motion.p>
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
              <p className="text-label text-tertiary mb-2">TODAY'S ATTENDANCE</p>
              <h2 className="text-display-md tabular-nums">22 <span className="text-h3 text-tertiary">/ 25</span></h2>
            </div>
            <span className="pill pill-success">+ 88%</span>
          </div>

          <div className="mb-6">
            <div className="h-2 w-full bg-surface-inset rounded-full overflow-hidden">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: '88%' }}
                transition={{ duration: 1, ease: "easeOut", delay: 0.3 }}
                className="h-full bg-success-fg rounded-full"
              />
            </div>
          </div>

          <div>
            <p className="text-caption text-secondary mb-3 uppercase tracking-widest">ABSENT STUDENTS</p>
            <div className="flex flex-wrap gap-2">
              {absentStudents.length > 0 ? absentStudents.map((student, i) => (
                <motion.span 
                  key={i} 
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.5 + (i * 0.1) }}
                  className="px-3 py-1.5 rounded-full bg-danger-bg border border-danger-border text-danger-fg text-body-sm"
                >
                  {student}
                </motion.span>
              )) : (
                <p className="text-caption text-tertiary italic">No absentees found for this session.</p>
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
              <AreaChart data={MOCK_SPARKLINE}>
                <defs>
                  <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--success-fg)" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="var(--success-fg)" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <Area 
                  type="monotone" 
                  dataKey="value" 
                  stroke="var(--success-fg)" 
                  fillOpacity={1} 
                  fill="url(#colorValue)" 
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          
          <div className="grid grid-cols-2 gap-4 mt-6">
            <div>
              <p className="text-caption text-tertiary">HIGHEST</p>
              <p className="text-body font-medium">Abhishek Sharma (100%)</p>
            </div>
            <div>
              <p className="text-caption text-tertiary">LOWEST</p>
              <p className="text-body font-medium">Vikram Joshi (60%)</p>
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
                <div>
                  <p className="text-body text-primary">{item.action}</p>
                  <p className="text-caption text-tertiary">{item.time}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </section>

    </div>
  );
}
