import React, { useState, useEffect } from 'react';
import { Search, Filter, ArrowUpRight, User, Calendar, CheckCircle2, XCircle, ChevronDown, Download, AlertCircle, ArrowUpDown, TrendingDown, Users, Percent } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { cn } from '../../lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

import { useLocation } from 'react-router-dom';

export default function History() {
  const [students, setStudents] = useState([]);
  const [sessionsCount, setSessionsCount] = useState(0);
  const [search, setSearch] = useState('');
  const [branchFilter, setBranchFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [studentHistory, setStudentHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [error, setError] = useState(null);
  const [sortConfig, setSortConfig] = useState({ key: 'percentage', direction: 'desc' });
  
  const location = useLocation();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const q = params.get('q');
    if (q) setSearch(q);
    
    fetchHistoryData();
  }, [location.search]);

  const fetchHistoryData = async () => {
    if (!supabase) return;
    setLoading(true);
    try {
      // 1. Get total session count
      const { count: sCount } = await supabase
        .from('sessions')
        .select('*', { count: 'exact', head: true });
      setSessionsCount(sCount || 0);

      // 2. Get students and their attendance count
      const { data: studentData, error: sError } = await supabase
        .from('students')
        .select(`
          *,
          attendance(present)
        `);

      if (sError) throw sError;

      const processed = (studentData || []).map(s => {
        const attendanceList = s.attendance || [];
        const attended = attendanceList.filter(a => a.present).length;
        return {
          ...s,
          attended,
          total_possible: sCount,
          percentage: sCount > 0 ? Math.round((attended / sCount) * 100) : 0
        };
      });

      setStudents(processed);
      setError(null);
    } catch (err) {
      console.error(err);
      setError(err.message || 'Failed to fetch history data');
    } finally {
      setLoading(false);
    }
  };

  const fetchStudentDetail = async (student) => {
    if (!supabase) return;
    setSelectedStudent(student);
    setHistoryLoading(true);
    try {
      const { data, error } = await supabase
        .from('attendance')
        .select(`
          present,
          marked_at,
          sessions(date, topic)
        `)
        .eq('student_id', student.id)
        .order('marked_at', { ascending: false });

      if (error) throw error;
      setStudentHistory(data);
    } catch (err) {
      console.error(err);
    } finally {
      setHistoryLoading(false);
    }
  };

  const filteredStudents = students
    .filter(s => {
      const matchesSearch = s.name.toLowerCase().includes(search.toLowerCase()) || 
                            s.usn.toLowerCase().includes(search.toLowerCase());
      const matchesBranch = branchFilter === 'all' || s.branch_code === branchFilter;
      return matchesSearch && matchesBranch;
    })
    .sort((a, b) => {
      if (a[sortConfig.key] < b[sortConfig.key]) return sortConfig.direction === 'asc' ? -1 : 1;
      if (a[sortConfig.key] > b[sortConfig.key]) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });

  const uniqueBranches = Array.from(new Set(students.map(s => s.branch_code))).sort();

  const handleSort = (key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'desc' ? 'asc' : 'desc'
    }));
  };

  const downloadCSV = () => {
    const headers = ['Name,USN,Branch,Attended,Total Sessions,Percentage'];
    const rows = filteredStudents.map(s => 
      `"${s.name}","${s.usn}","${s.branch_code}",${s.attended},${sessionsCount},${s.percentage}%`
    );
    const csvContent = "data:text/csv;charset=utf-8," + headers.concat(rows).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `attendance_report_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Analytics Calculations
  const avgAttendance = students.length > 0 
    ? Math.round(students.reduce((acc, s) => acc + s.percentage, 0) / students.length) 
    : 0;
  const atRiskCount = students.filter(s => s.percentage < 75).length;

  const getStatusColor = (pct) => {
    if (pct >= 85) return 'text-success-fg bg-success-bg/10 border-success-border/30';
    if (pct >= 75) return 'text-warning-fg bg-warning-bg/10 border-warning-border/30';
    return 'text-danger-fg bg-danger-bg/10 border-danger-border/30';
  };

  return (
    <div className="space-y-8">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-display-sm mb-1">Student History</h1>
          <p className="text-body-sm text-secondary">Track long-term performance and attendance metrics</p>
        </div>

        {error && (
          <div className="bg-danger-bg border border-danger-border px-4 py-2 rounded-lg flex items-center gap-2 text-danger-fg text-body-sm animate-pulse">
            <AlertCircle size={16} />
            {error}
          </div>
        )}

        <div className="flex items-center gap-3">
          <div className="relative">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-tertiary" />
            <input 
              type="text" 
              placeholder="Search USN or Name..." 
              className="input w-[260px] input-with-icon"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="relative">
            <select 
              className="input pr-10 appearance-none bg-surface"
              value={branchFilter}
              onChange={(e) => setBranchFilter(e.target.value)}
            >
              <option value="all">All Branches</option>
              {uniqueBranches.map(b => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
            <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-tertiary pointer-events-none" />
          </div>
          <button onClick={downloadCSV} className="btn-secondary h-11 px-4" title="Export CSV">
            <Download size={18} />
          </button>
        </div>
      </header>

      {/* Analytics Stats */}
      {!loading && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="card p-6 flex items-center gap-4 border-accent-glow/20 bg-accent-glow/[0.02]"
          >
            <div className="p-3 rounded-xl bg-accent-glow/10 text-accent-glow">
              <Percent size={24} />
            </div>
            <div>
              <p className="text-label text-tertiary uppercase mb-1">Avg. Attendance</p>
              <h3 className="text-h3">{avgAttendance}%</h3>
            </div>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="card p-6 flex items-center gap-4 border-danger-border/20 bg-danger-bg/[0.02]"
          >
            <div className="p-3 rounded-xl bg-danger-bg/10 text-danger-fg">
              <TrendingDown size={24} />
            </div>
            <div>
              <p className="text-label text-tertiary uppercase mb-1">Students At Risk</p>
              <h3 className="text-h3 text-danger-fg">{atRiskCount} <span className="text-body-sm font-normal text-secondary ml-1">below 75%</span></h3>
            </div>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="card p-6 flex items-center gap-4 border-subtle"
          >
            <div className="p-3 rounded-xl bg-surface-inset text-tertiary">
              <Users size={24} />
            </div>
            <div>
              <p className="text-label text-tertiary uppercase mb-1">Cohort Strength</p>
              <h3 className="text-h3">{students.length} <span className="text-body-sm font-normal text-secondary ml-1">Active Students</span></h3>
            </div>
          </motion.div>
        </div>
      )}

      <div className="card p-0 overflow-hidden border border-subtle">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-surface-raised/50 border-b border-subtle">
              <th 
                className="px-6 py-4 text-label text-tertiary font-medium uppercase tracking-wider cursor-pointer hover:text-primary transition-colors"
                onClick={() => handleSort('name')}
              >
                <div className="flex items-center gap-2">
                  Student
                  <ArrowUpDown size={14} className={cn("transition-opacity", sortConfig.key === 'name' ? 'opacity-100' : 'opacity-30')} />
                </div>
              </th>
              <th className="px-6 py-4 text-label text-tertiary font-medium uppercase tracking-wider">Branch</th>
              <th className="px-6 py-4 text-label text-tertiary font-medium uppercase tracking-wider text-center">Sessions</th>
              <th 
                className="px-6 py-4 text-label text-tertiary font-medium uppercase tracking-wider text-right cursor-pointer hover:text-primary transition-colors"
                onClick={() => handleSort('percentage')}
              >
                <div className="flex items-center justify-end gap-2">
                  Attendance
                  <ArrowUpDown size={14} className={cn("transition-opacity", sortConfig.key === 'percentage' ? 'opacity-100' : 'opacity-30')} />
                </div>
              </th>
              <th className="px-6 py-4"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-subtle">
            {loading ? (
              [...Array(5)].map((_, i) => (
                <tr key={i} className="animate-pulse">
                  <td colSpan="5" className="px-6 py-8 bg-surface-inset/20"></td>
                </tr>
              ))
            ) : filteredStudents.map((student, idx) => (
              <motion.tr 
                key={student.id}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.03 }}
                onClick={() => fetchStudentDetail(student)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    fetchStudentDetail(student);
                  }
                }}
                tabIndex={0}
                role="button"
                aria-label={`View details for ${student.name}`}
                className="group hover:bg-surface-raised transition-colors cursor-pointer outline-none focus:bg-surface-raised"
              >
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-surface-inset border border-default flex items-center justify-center text-primary group-hover:border-accent-glow/50 transition-colors">
                      <User size={18} />
                    </div>
                    <div>
                      <p className="text-body font-medium">{student.name}</p>
                      <p className="text-caption text-tertiary font-mono uppercase">{student.usn}</p>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4">
                   <span className="pill pill-secondary text-micro">{student.branch_code}</span>
                </td>
                <td className="px-6 py-4 text-center text-body font-mono">
                  {student.attended} <span className="text-tertiary mx-1">/</span> {sessionsCount}
                </td>
                <td className="px-6 py-4 text-right">
                  <div className={cn(
                    "inline-flex items-center px-3 py-1 rounded-full border text-body-sm font-bold tabular-nums",
                    getStatusColor(student.percentage)
                  )}>
                    {student.percentage}%
                  </div>
                </td>
                <td className="px-6 py-4 text-right">
                  <ArrowUpRight size={18} className="text-tertiary opacity-0 group-hover:opacity-100 transition-opacity ml-auto" />
                </td>
              </motion.tr>
            ))}
          </tbody>
        </table>
        
        {!loading && filteredStudents.length === 0 && (
          <div className="p-20 text-center text-secondary">
             <Search size={40} className="mx-auto mb-4 opacity-20" />
             <p className="text-h3">No students found</p>
             <p className="text-body-sm text-secondary">Try adjusting your search or filters</p>
             <p className="text-caption text-tertiary mt-4 italic">Tip: Ensure you have run the seed.sql migration in your Supabase SQL Editor.</p>
          </div>
        )}
      </div>

      {students.length > 0 && (
        <div className="mt-8 p-4 bg-surface-inset border border-dashed border-subtle rounded-xl">
           <p className="text-micro text-tertiary mb-2 uppercase">DEBUG: Raw Data Summary</p>
           <div className="flex gap-4 text-caption font-mono">
              <span className="text-success-fg">Students: {students.length}</span>
              <span className="text-secondary">Sessions: {sessionsCount}</span>
           </div>
        </div>
      )}

      {/* Student Detail Modal */}
      <AnimatePresence>
        {selectedStudent && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedStudent(null)}
              className="modal-overlay z-40"
            />
            <motion.div 
              initial={{ opacity: 0, x: '100%' }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: '100%', opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed top-0 right-0 bottom-0 w-full max-w-lg bg-canvas border-l border-border-strong shadow-2xl z-50 overflow-y-auto"
            >
              <div className="p-8 border-b border-subtle flex items-center justify-between sticky top-0 bg-canvas/80 backdrop-blur-xl z-10">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-accent-glow/10 text-accent-glow flex items-center justify-center">
                    <User size={24} />
                  </div>
                  <div>
                    <h2 className="text-h2">{selectedStudent.name}</h2>
                    <p className="text-caption text-secondary font-mono uppercase">{selectedStudent.usn} • {selectedStudent.branch_code}</p>
                  </div>
                </div>
                <button onClick={() => setSelectedStudent(null)} className="btn-secondary p-2 rounded-full">
                  <ArrowUpRight size={20} className="rotate-45" />
                </button>
              </div>

              <div className="p-8 space-y-8">
                <div className="grid grid-cols-2 gap-4">
                  <div className="card bg-surface-inset/30 p-6">
                    <p className="text-caption text-tertiary uppercase mb-1">Attended</p>
                    <p className="text-display-sm tabular-nums">{selectedStudent.attended}</p>
                  </div>
                  <div className="card bg-surface-inset/30 p-6">
                    <p className="text-caption text-tertiary uppercase mb-1">Percentage</p>
                    <p className={cn("text-display-sm tabular-nums", getStatusColor(selectedStudent.percentage).split(' ')[0])}>
                      {selectedStudent.percentage}%
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  <p className="text-label text-tertiary font-medium uppercase tracking-widest">Attendance Log</p>
                  {historyLoading ? (
                    <div className="py-20 text-center text-tertiary animate-pulse">Loading history...</div>
                  ) : studentHistory.length === 0 ? (
                    <div className="py-20 text-center card bg-surface-inset/20">
                      <AlertCircle size={24} className="mx-auto mb-2 opacity-30" />
                      <p className="text-body-sm text-secondary">No records found</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {studentHistory.map((item, i) => (
                        <div key={i} className="flex items-center justify-between p-4 rounded-xl border border-subtle bg-surface/50">
                          <div className="flex items-center gap-4">
                            <div className={cn(
                              "w-8 h-8 rounded-lg flex items-center justify-center",
                              item.present ? "bg-success-bg text-success-fg" : "bg-danger-bg text-danger-fg"
                            )}>
                              {item.present ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
                            </div>
                            <div>
                              <p className="text-body font-medium">{item.sessions.topic}</p>
                              <p className="text-caption text-tertiary font-mono">{item.sessions.date}</p>
                            </div>
                          </div>
                          <span className={cn(
                            "text-micro font-bold px-2 py-1 rounded uppercase",
                            item.present ? "text-success-fg bg-success-bg/20" : "text-danger-fg bg-danger-bg/20"
                          )}>
                            {item.present ? 'Present' : 'Absent'}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
