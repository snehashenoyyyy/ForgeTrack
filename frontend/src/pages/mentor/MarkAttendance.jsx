import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Calendar, CheckCircle2, XCircle, AlertCircle, Save, CheckSquare, Square, ChevronRight, PlusCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { cn } from '../../lib/utils';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Search } from 'lucide-react';

export default function MarkAttendance() {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [students, setStudents] = useState([]);
  const [session, setSession] = useState(null);
  const [searchResults, setSearchResults] = useState([]);
  const [attendance, setAttendance] = useState({}); // student_id -> boolean
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isExisting, setIsExisting] = useState(false);
  const [error, setError] = useState(null);
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });

  const [newTopic, setNewTopic] = useState('');
  const [newDuration, setNewDuration] = useState('2.0');
  const [creationError, setCreationError] = useState(null);
  
  const [studentSearch, setStudentSearch] = useState('');

  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const q = params.get('q');
    const d = params.get('date');
    
    if (d) {
      setSelectedDate(d);
      setSearchResults([]); // Clear search list if a specific date is chosen
    } else if (q) {
      searchSessions(q);
    } else {
      fetchInitialData();
    }
  }, [selectedDate, location.search]);

  const searchSessions = async (query) => {
    if (!supabase) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('sessions')
        .select('*')
        .ilike('topic', `%${query}%`)
        .order('date', { ascending: false });
      
      if (error) throw error;
      setSearchResults(data);
      setSession(null); // Clear active session to show search list
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchInitialData = async () => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { data: studentData, error: studentError } = await supabase
        .from('students')
        .select('*')
        .order('name');
      
      if (studentError) throw studentError;
      setStudents(studentData);

      const { data: sessionData, error: sessionError } = await supabase
        .from('sessions')
        .select('*')
        .eq('date', selectedDate)
        .maybeSingle();

      if (sessionData) {
        setSession(sessionData);
        const { data: attData, error: attError } = await supabase
          .from('attendance')
          .select('student_id, present')
          .eq('session_id', sessionData.id);

        if (attError) throw attError;

        if (attData && attData.length > 0) {
          setIsExisting(true);
          const attMap = {};
          attData.forEach(row => attMap[row.student_id] = row.present);
          setAttendance(attMap);
        } else {
          setIsExisting(false);
          setAttendance({});
        }
      } else {
        setSession(null);
        setIsExisting(false);
        setAttendance({});
      }
      setError(null);
    } catch (error) {
      console.error('Error fetching data:', error);
      setError(error.message || 'Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };
  const handleCreateSession = async () => {
    if (!supabase || !newTopic) return;
    setSaving(true);
    setCreationError(null);
    try {
      const { data, error } = await supabase
        .from('sessions')
        .insert([{
          date: selectedDate,
          topic: newTopic,
          duration_hours: parseFloat(newDuration),
          month_number: new Date(selectedDate).getMonth() + 1
        }])
        .select()
        .single();
      
      if (error) throw error;
      setSession(data);
      setShowConfirm(false); // Close modal only on success
    } catch (error) {
      console.error('Error creating session:', error);
      setCreationError(error.message || 'Database error: Could not create session');
    } finally {
      setSaving(false);
    }
  };

  const showToast = (message, type = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 3000);
  };

  const toggleAttendance = (studentId) => {
    setAttendance(prev => ({
      ...prev,
      [studentId]: !prev[studentId]
    }));
  };

  const selectAll = (present) => {
    const newAtt = {};
    students.forEach(s => newAtt[s.id] = present);
    setAttendance(newAtt);
  };

  const onSaveClick = () => {
    if (isExisting) {
      setShowConfirm(true);
    } else {
      saveAttendance();
    }
  };

  const saveAttendance = async () => {
    if (!supabase) return;
    setShowConfirm(false);
    setSaving(true);
    try {
      const records = students.map(s => ({
        student_id: s.id,
        session_id: session.id,
        present: !!attendance[s.id],
        marked_by: user?.profile?.display_name || user?.email || 'Unknown Mentor'
      }));

      const { error } = await supabase
        .from('attendance')
        .upsert(records, { onConflict: 'student_id,session_id' });

      if (error) throw error;
      showToast('Attendance saved successfully!');
      setIsExisting(true);
    } catch (error) {
      console.error('Error saving attendance:', error);
      showToast('Failed to save attendance.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const presentCount = Object.values(attendance).filter(v => v).length;
  const absentCount = students.length - presentCount;

  return (
    <div className="space-y-8 pb-24">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-display-sm mb-1">Mark Attendance</h1>
          <p className="text-body-sm text-secondary">Record attendance for your cohort</p>
        </div>

        {error && (
          <div className="bg-danger-bg border border-danger-border px-4 py-2 rounded-lg flex items-center gap-2 text-danger-fg text-body-sm animate-pulse">
            <AlertCircle size={16} />
            {error}
          </div>
        )}

        <div className="flex items-center gap-4 bg-surface rounded-xl p-2 border border-subtle shadow-card">
          <Calendar size={18} className="text-tertiary ml-2" />
          <input 
            type="date" 
            value={selectedDate}
            max={new Date().toISOString().split('T')[0]}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="bg-transparent border-none outline-none text-body font-mono text-primary px-2"
          />
        </div>
      </header>

      <AnimatePresence mode="wait">
        {loading ? (
          <motion.div 
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="h-64 flex items-center justify-center text-secondary"
          >
            Loading data...
          </motion.div>
        ) : (
          <motion.div 
            key="list"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-6"
          >
            {searchResults.length > 0 ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-h2">Search Results</h2>
                  <button onClick={() => navigate('/attendance')} className="text-accent-glow text-body-sm hover:underline">Clear Search</button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {searchResults.map((s) => (
                    <div 
                      key={s.id} 
                      onClick={() => {
                        setSession(s);
                        setSearchResults([]);
                        setSelectedDate(s.date);
                      }}
                      className="card p-6 cursor-pointer hover:bg-surface-raised transition-all border border-subtle hover:border-accent-glow/50 group"
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="text-label text-tertiary mb-1 uppercase tracking-widest">{s.date}</p>
                          <h3 className="text-h3 group-hover:text-accent-glow transition-colors">{s.topic}</h3>
                        </div>
                        <ChevronRight className="text-tertiary" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : !session ? (
              <div className="p-20 text-center card border-dashed border-2 flex flex-col items-center">
                 <AlertCircle size={48} className="text-tertiary mb-4 opacity-20" />
                 <h2 className="text-h2 mb-2">No Session Selected</h2>
                 <p className="text-body text-secondary mb-6 max-w-md mx-auto">
                    {new URLSearchParams(location.search).get('q') 
                      ? `We couldn't find any sessions matching "${new URLSearchParams(location.search).get('q')}"`
                      : `We couldn't find a session for ${new Date(selectedDate).toLocaleDateString()}. Please create one to start marking attendance.`}
                 </p>
                 {!new URLSearchParams(location.search).get('q') && (
                   <button 
                    onClick={() => setShowConfirm(true)}
                    className="btn-primary flex items-center gap-2"
                   >
                     <PlusCircle size={20} />
                     Create New Session
                   </button>
                 )}
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between p-6 card bg-surface-raised border-accent-glow/20">
                  <div className="flex items-center gap-4">
                    <div className="p-3 rounded-xl bg-accent-glow/10 text-accent-glow">
                      <CheckSquare size={24} />
                    </div>
                    <div>
                      <h3 className="text-h3">{session.topic}</h3>
                      <p className="text-caption text-secondary font-mono">{session.date} • {session.duration_hours}h</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => selectAll(true)} className="btn-secondary py-2 px-3 text-micro h-auto">Select All Present</button>
                    <button onClick={() => selectAll(false)} className="btn-secondary py-2 px-3 text-micro h-auto">Select All Absent</button>
                  </div>
                </div>

                <div className="relative group">
                  <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-tertiary group-focus-within:text-accent-glow transition-colors">
                    <Search size={18} />
                  </div>
                  <input 
                    type="text"
                    placeholder="Filter students by name or USN..."
                    value={studentSearch}
                    onChange={(e) => setStudentSearch(e.target.value)}
                    className="w-full bg-surface border border-subtle rounded-xl py-4 pl-12 pr-4 text-body focus:border-accent-glow outline-none transition-all shadow-sm"
                  />
                </div>

                <div className="card p-0 overflow-hidden border border-subtle">
                  <div className="max-h-[60vh] overflow-y-auto">
                    {students.length === 0 ? (
                      <div className="p-20 text-center">
                        <AlertCircle size={32} className="mx-auto mb-4 opacity-20" />
                        <p className="text-body text-secondary">No students found in database.</p>
                      </div>
                    ) : (
                      students
                        .filter(s => 
                          s.name.toLowerCase().includes(studentSearch.toLowerCase()) || 
                          s.usn.toLowerCase().includes(studentSearch.toLowerCase())
                        )
                        .map((student, idx) => (
                        <motion.div 
                          key={student.id}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: idx * 0.01 }}
                          onClick={() => toggleAttendance(student.id)}
                          onKeyDown={(e) => {
                            if (e.key === ' ' || e.key === 'Enter') {
                              e.preventDefault();
                              toggleAttendance(student.id);
                            }
                          }}
                          tabIndex={0}
                          role="checkbox"
                          aria-checked={attendance[student.id]}
                          className={cn(
                            "flex items-center justify-between p-4 cursor-pointer hover:bg-surface-raised transition-colors border-b border-subtle last:border-b-0",
                            attendance[student.id] ? "bg-success-bg/5" : "bg-transparent"
                          )}
                        >
                          <div className="flex items-center gap-4">
                            <div className={cn(
                              "w-6 h-6 rounded flex items-center justify-center transition-colors border",
                              attendance[student.id] 
                                ? "bg-success-fg border-success-fg text-white" 
                                : "border-default bg-surface-inset text-transparent"
                            )}>
                              <CheckSquare size={16} />
                            </div>
                            <div>
                              <p className="text-body font-medium">{student.name}</p>
                              <p className="text-caption text-tertiary font-mono">{student.usn}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-4">
                            <span className="text-label text-tertiary uppercase">{student.branch_code}</span>
                            <ChevronRight size={16} className="text-tertiary" />
                          </div>
                        </motion.div>
                      ))
                    )}
                  </div>
                </div>

                <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-full max-w-2xl px-6 z-30">
                  <motion.div 
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    className="bg-surface-raised border border-border-strong rounded-2xl p-4 shadow-2xl flex items-center justify-between backdrop-blur-xl"
                  >
                    <div className="flex items-center gap-6 ml-4">
                        <div className="flex flex-col">
                          <span className="text-micro text-tertiary uppercase tracking-widest">Present</span>
                          <span className="text-body font-bold text-success-fg tabular-nums">{presentCount}</span>
                        </div>
                        <div className="w-[1px] h-6 bg-border-subtle" />
                        <div className="flex flex-col">
                          <span className="text-micro text-tertiary uppercase tracking-widest">Absent</span>
                          <span className="text-body font-bold text-danger-fg tabular-nums">{absentCount}</span>
                        </div>
                    </div>

                    <button 
                      onClick={onSaveClick}
                      disabled={saving || students.length === 0}
                      className="btn-primary py-3 px-8 rounded-xl flex items-center gap-2"
                    >
                      <Save size={18} />
                      {isExisting ? 'Update Attendance' : 'Save Attendance'}
                    </button>
                  </motion.div>
                </div>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* MODALS */}
      <AnimatePresence>
        {showConfirm && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowConfirm(false)}
              className="modal-overlay z-40"
            />
            <div className="modal-container">
              {!session ? (
                // Create Session Modal
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="modal max-w-lg w-full"
                >
                  <div className="flex items-center gap-4 mb-8">
                    <div className="p-3 rounded-xl bg-accent-glow/10 text-accent-glow">
                      <PlusCircle size={24} />
                    </div>
                    <div>
                      <h2 className="text-h2">Create New Session</h2>
                      <p className="text-body-sm text-secondary">Start a session for {new Date(selectedDate).toLocaleDateString()}</p>
                    </div>
                  </div>

                  {creationError && (
                    <div className="bg-danger-bg border border-danger-border px-4 py-3 rounded-xl flex items-start gap-3 text-danger-fg text-body-sm mb-6 animate-shake">
                      <AlertCircle size={18} className="shrink-0 mt-0.5" />
                      <div>
                        <p className="font-bold">Database Error</p>
                        <p className="opacity-90">{creationError}</p>
                        <p className="text-micro mt-2 font-mono uppercase opacity-50 italic">Tip: Ensure you run the "Unlock Everything" SQL in Supabase</p>
                      </div>
                    </div>
                  )}

                  <div className="space-y-6">
                    <div>
                      <label className="text-label text-tertiary block mb-2 uppercase">SESSION TOPIC</label>
                      <input 
                        type="text" 
                        placeholder="e.g. 8-Layer AI Stack" 
                        className="input w-full"
                        value={newTopic}
                        onChange={(e) => setNewTopic(e.target.value)}
                      />
                    </div>
                    <div className="flex gap-4">
                      <div className="flex-1">
                        <label className="text-label text-tertiary block mb-2 uppercase">DURATION (HOURS)</label>
                        <select 
                          className="input w-full"
                          value={newDuration}
                          onChange={(e) => setNewDuration(e.target.value)}
                        >
                          <option value="1.0">1.0</option>
                          <option value="1.5">1.5</option>
                          <option value="2.0">2.0</option>
                          <option value="3.0">3.0</option>
                        </select>
                      </div>
                    </div>
                    <div className="flex justify-end gap-3 pt-4">
                      <button onClick={() => setShowConfirm(false)} className="btn-secondary">Cancel</button>
                      <button 
                        onClick={handleCreateSession}
                        disabled={saving || !newTopic}
                        className="btn-primary px-8"
                      >
                        {saving ? 'Creating...' : 'Create Session'}
                      </button>
                    </div>
                  </div>
                </motion.div>
              ) : (
                // Overwrite Confirmation Modal
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="modal"
                >
                  <div className="flex items-center gap-4 mb-4 text-warning-fg">
                    <AlertCircle size={32} />
                    <h2 className="text-h2">Confirm Update</h2>
                  </div>
                  <p className="text-body-lg text-secondary mb-8">
                    Attendance for this session has already been recorded. Are you sure you want to overwrite it with current selections?
                  </p>
                  <div className="flex justify-end gap-3">
                    <button onClick={() => setShowConfirm(false)} className="btn-secondary">Cancel</button>
                    <button onClick={saveAttendance} className="btn-primary">Yes, Overwrite</button>
                  </div>
                </motion.div>
              )}
            </div>
          </>
        )}
      </AnimatePresence>

      {/* Toast Notification */}
      <AnimatePresence>
        {toast.show && (
          <motion.div
            initial={{ y: 50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 20, opacity: 0 }}
            className={cn(
              "fixed bottom-24 left-1/2 -translate-x-1/2 z-50 px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 backdrop-blur-xl border",
              toast.type === 'success' 
                ? "bg-success-bg/90 border-success-border text-success-fg" 
                : "bg-danger-bg/90 border-danger-border text-danger-fg"
            )}
          >
            {toast.type === 'success' ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
            <span className="font-medium">{toast.message}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
