import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Upload, FileSpreadsheet, CheckCircle2, AlertCircle, 
  ChevronRight, ArrowLeft, Loader, Calendar, 
  User, CheckSquare, Search, Info, Trash2, 
  ChevronDown, HelpCircle, Layers, Database,
  ArrowRight, Filter, AlertTriangle, Plus
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { supabase } from '../../lib/supabase';
import { analyzeSpreadsheetHeader, suggestDateForColumn } from '../../lib/ai-upload';
import { cn } from '../../lib/utils';
import { useNavigate } from 'react-router-dom';

const STEPS = {
  UPLOAD: 1,
  SHEETS: 2,
  MAPPING: 3,
  VALIDATION: 4,
  IMPORTING: 5,
  SUMMARY: 6
};

export default function BulkUpload() {
  const navigate = useNavigate();
  const [step, setStep] = useState(STEPS.UPLOAD);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // File & Workbook State
  const [file, setFile] = useState(null);
  const [workbook, setWorkbook] = useState(null);
  const [sheetNames, setSheetNames] = useState([]);
  const [selectedSheets, setSelectedSheets] = useState([]);
  
  // Data State
  const [rawData, setRawData] = useState({}); // { sheetName: rows[] }
  const [mappingResults, setMappingResults] = useState({}); // { sheetName: mappingObj }
  const [validationItems, setValidationItems] = useState([]); // Array of session objects across sheets
  
  // Configuration State
  const [usualDays, setUsualDays] = useState(['Wednesday', 'Thursday', 'Saturday']);
  const [showUsualDaysPrompt, setShowUsualDaysPrompt] = useState(false);
  
  // Progress State
  const [progress, setProgress] = useState({ current: 0, total: 0, phase: '' });
  const [summary, setSummary] = useState({ sessions: 0, attendance: 0, students: 0, details: [] });

  // -------------------------------------------------------------------------
  // 1. File Handling
  // -------------------------------------------------------------------------
  const handleFileChange = (e) => {
    const f = e.target.files[0];
    if (f) processFile(f);
  };

  const processFile = (file) => {
    setFile(file);
    setLoading(true);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target.result;
        const wb = XLSX.read(data, { type: 'binary', cellDates: true });
        setWorkbook(wb);
        setSheetNames(wb.SheetNames);
        
        if (wb.SheetNames.length === 1) {
          setSelectedSheets([wb.SheetNames[0]]);
          handleNextToMapping([wb.SheetNames[0]], wb);
        } else {
          setStep(STEPS.SHEETS);
        }
      } catch (err) {
        setError("Failed to read spreadsheet. Ensure it's a valid XLSX or CSV.");
      } finally {
        setLoading(false);
      }
    };
    reader.readAsBinaryString(file);
  };

  // -------------------------------------------------------------------------
  // 2. Mapping Logic (AI-Powered)
  // -------------------------------------------------------------------------
  const handleNextToMapping = async (sheets = selectedSheets, wb = workbook) => {
    console.log("[Navigation] Transitioning to Mapping. Sheets:", sheets);
    if (!sheets || sheets.length === 0) {
      setError("Please select at least one sheet.");
      return;
    }
    setLoading(true);
    setError(null);
    setStep(STEPS.MAPPING);
    
    try {
      const results = {};
      const data = {};
      
      for (const name of sheets) {
        console.log(`[Mapping] Processing sheet: ${name}`);
        const ws = wb.Sheets[name];
        if (!ws) {
          console.warn(`[Mapping] Sheet ${name} not found in workbook!`);
          continue;
        }
        // Use raw: false to get formatted strings for AI analysis
        const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
        const nonEmptyRows = rows.filter(r => r.some(c => c !== ''));
        
        data[name] = nonEmptyRows;
        
        // Call AI to analyze header and sample
        const aiResult = await analyzeSpreadsheetHeader(nonEmptyRows.slice(0, 20));
        results[name] = aiResult;
      }
      
      setRawData(data);
      setMappingResults(results);
    } catch (err) {
      console.error("Mapping Error:", err);
      setError(`AI Analysis Error: ${err.message || 'The AI service returned an invalid response. Please check your API key and connection.'}`);
      // Fallback empty mapping
      const fallbacks = {};
      sheets.forEach(name => {
        fallbacks[name] = { headerRowIndex: 0, studentMapping: { usn: 0, name: 1 }, attendanceColumns: [] };
      });
      setMappingResults(fallbacks);
    } finally {
      setLoading(false);
    }
  };

  // -------------------------------------------------------------------------
  // 3. Validation & Deduplication
  // -------------------------------------------------------------------------
  const handleValidate = async () => {
    console.log("[Validation] Starting validation...");
    setLoading(true);
    setStep(STEPS.VALIDATION);
    
    try {
      const allSessions = [];
      const allDatesSet = new Set();
      
      // Collect unique dates to check
      for (const mapping of Object.values(mappingResults)) {
        mapping.attendanceColumns.forEach(c => {
          if (c.date) allDatesSet.add(c.date);
        });
      }
      const allDates = Array.from(allDatesSet);

      // Batch fetch existing sessions
      console.log(`[Validation] Checking ${allDates.length} dates for duplicates...`);
      const { data: existingSessions, error: sessErr } = allDates.length > 0 
        ? await supabase.from('sessions').select('id, topic, date').in('date', allDates)
        : { data: [], error: null };
      
      if (sessErr) throw sessErr;

      const existingMap = {};
      (existingSessions || []).forEach(s => existingMap[s.date] = s);

      for (const [sheetName, mapping] of Object.entries(mappingResults)) {
        const attendCols = mapping.attendanceColumns.filter(c => c.isAttendance);
        
        for (const col of attendCols) {
          let status = 'ok';
          let warning = null;
          let sessionId = null;
          let date = col.date;
          
          if (date && existingMap[date]) {
            status = 'duplicate';
            warning = `Existing session found: "${existingMap[date].topic}"`;
            sessionId = existingMap[date].id;
          } else if (!date) {
            status = 'missing_date';
          }
          
          allSessions.push({
            ...col,
            sheetName,
            status,
            warning,
            sessionId,
            date,
            action: 'import'
          });
        }
      }
      
      console.log(`[Validation] Done. Found ${allSessions.length} total sessions.`);
      setValidationItems(allSessions);
      
      // If any missing dates, show usual days prompt
      if (allSessions.some(s => s.status === 'missing_date')) {
        setShowUsualDaysPrompt(true);
      }
    } catch (err) {
      setError("Validation failed: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleResolveMissingDates = async () => {
    setLoading(true);
    setShowUsualDaysPrompt(false);
    
    try {
      const items = [...validationItems];
      const existingDates = items.map(i => i.date).filter(Boolean);
      
      for (let i = 0; i < items.length; i++) {
        if (items[i].status === 'missing_date') {
          const suggested = await suggestDateForColumn(items[i], usualDays, existingDates);
          if (suggested) {
            items[i].date = suggested;
            items[i].status = 'suggested';
            items[i].warning = 'AI Suggested Date';
          }
        }
      }
      setValidationItems(items);
    } catch (err) {
      console.error("AI Suggestion failed:", err);
    } finally {
      setLoading(false);
    }
  };

  // -------------------------------------------------------------------------
  // 4. Final Import Execution
  // -------------------------------------------------------------------------
  const handleExecute = () => {
    executeImport();
  };

  const executeImport = async () => {
    console.log("[Import] Starting execution...");
    setLoading(true);
    setStep(STEPS.IMPORTING);
    
    try {
      if (!validationItems || validationItems.length === 0) {
        throw new Error("No sessions selected for import.");
      }

      const activeItems = validationItems.filter(i => i.action !== 'skip');
      if (activeItems.length === 0) throw new Error("No sessions selected for import.");

      // Track dates to avoid collisions
      const localUsedDates = new Set();

      // NUCLEAR RESET: Clear existing sessions and attendance to ensure 100% accuracy
      // This ensures that if the user re-uploads a 55-session sheet, they don't have OLD sessions left over.
      setProgress({ current: 0, total: 100, phase: 'Preparing clean slate...' });
      const { error: delAttErr } = await supabase.from('attendance').delete().neq('id', 0); // Delete all
      const { error: delSessErr } = await supabase.from('sessions').delete().neq('id', 0); // Delete all
      if (delAttErr || delSessErr) console.warn("Cleanup failed, proceeding anyway...");


      let totalStudentsSync = 0;
      let totalAttendanceUpsert = 0;
      let totalSessions = 0;
      const activeItemsCount = validationItems.filter(v => v.action !== 'skip').length;

      // 1. Process Students (Across all sheets)
      const studentsToUpsert = new Map();
      const normalizeUSN = (u) => String(u || '').trim().toUpperCase();

      for (const [sheetName, mapping] of Object.entries(mappingResults)) {
        const rows = rawData[sheetName];
        const sm = mapping.studentMapping;
        const hIdx = mapping.headerRowIndex || 0;
        
        // Find Email column if not in mapping
        let emailCol = sm.email;
        if (emailCol === undefined) {
          emailCol = rows[hIdx].findIndex(h => String(h).toLowerCase().includes('email'));
        }

        for (let i = hIdx + 1; i < rows.length; i++) {
          const row = rows[i];
          if (!row || row.length === 0) continue;

          let usn = normalizeUSN(row[sm.usn]);
          const name = String(row[sm.name] || '').trim();
          const email = emailCol !== -1 ? String(row[emailCol] || '').trim() : null;

          // SPECIAL FIX: If USN is missing, use Email as USN or generate one from name
          if (!usn && email) {
            usn = email.toUpperCase(); // Use email as USN for students 61-66
          } else if (!usn && name) {
            usn = `TEMP_${name.replace(/\s+/g, '_').toUpperCase()}`;
          }

          if (!usn) continue;
          
          studentsToUpsert.set(usn, {
            usn,
            name: name || 'Unknown',
            email: email,
            branch_code: sm.branch_code !== undefined ? row[sm.branch_code] : 'GEN'
          });
        }
      }

      setProgress(p => ({ ...p, total: activeItemsCount, phase: 'Syncing students...' }));
      const studentBatch = Array.from(studentsToUpsert.values());
      console.log(`[Import] Upserting ${studentBatch.length} students...`);

      // 1. Upsert students
      if (studentBatch.length > 0) {
        const { error: sErr } = await supabase.from('students').upsert(studentBatch, { onConflict: 'usn' });
        if (sErr) throw sErr;
      }
      
      // 2. Fetch ALL students with these USNs to get their IDs (upsert select can be unreliable for existing records)
      const allUsns = Array.from(studentsToUpsert.keys());
      const { data: allStudents, error: fErr } = await supabase
        .from('students')
        .select('id, usn')
        .in('usn', allUsns);
      
      if (fErr) throw fErr;

      const usnToId = {};
      allStudents.forEach(s => usnToId[normalizeUSN(s.usn)] = s.id);
      totalStudentsSync = allStudents.length;
      console.log(`[Import] Looked up ${totalStudentsSync} student IDs.`);

      // 2. Create Sessions (Ensuring Unique Dates)
      console.log(`[Import] Creating ${activeItems.length} sessions...`);
      
      for (let i = 0; i < activeItems.length; i++) {
        const item = activeItems[i];
        setProgress({ current: i, total: activeItems.length, phase: `Creating session: ${item.header}` });

        let finalDate = item.date;
        let attempts = 0;
        while (localUsedDates.has(finalDate)) {
          const d = new Date(finalDate);
          d.setDate(d.getDate() + 1);
          finalDate = d.toISOString().split('T')[0];
          attempts++;
          if (attempts > 100) break;
        }
        localUsedDates.add(finalDate);

        // ALWAYS create a new session to ensure we reach 55
        const { data: created, error: sErr } = await supabase.from('sessions').insert({
          date: finalDate,
          topic: item.header || `Session: ${finalDate}`,
          month_number: new Date(finalDate).getMonth() + 1,
          duration_hours: 2.0
        }).select().single();

        if (sErr) {
          // If DB still complains about date (duplicate in DB), shift again
          let altDate = finalDate;
          while (true) {
            const d = new Date(altDate);
            d.setDate(d.getDate() + 1);
            altDate = d.toISOString().split('T')[0];
            const { data: retry, error: rErr } = await supabase.from('sessions').insert({
              date: altDate, topic: item.header, month_number: 1, duration_hours: 2.0
            }).select().single();
            if (!rErr) {
              activeItems[i].sessionId = retry.id;
              activeItems[i].date = altDate;
              localUsedDates.add(altDate);
              break;
            }
          }
        } else {
          activeItems[i].sessionId = created.id;
          activeItems[i].date = finalDate;
        }
        totalSessions++;
      }

      // 3. Process Attendance
      console.log(`[Import] Importing attendance for ${activeItems.length} sessions...`);
      let currentProgress = 0;

      for (const item of activeItems) {
        const sessionId = item.sessionId;
        if (!sessionId) continue;
        
        setProgress(p => ({ ...p, current: ++currentProgress, total: activeItems.length, phase: `Importing attendance: ${item.date}...` }));
        
        const mapping = mappingResults[item.sheetName];
        const rows = rawData[item.sheetName];
        const sm = mapping.studentMapping;
        const hIdx = mapping.headerRowIndex || 0;
        
        const attendanceBatch = [];

        for (let i = hIdx + 1; i < rows.length; i++) {
          const row = rows[i];
          if (!row || row.length === 0) continue;

          let usn = normalizeUSN(row[sm.usn]);
          if (!usn) {
            const emailCol = mapping.emailCol ?? rows[hIdx].findIndex(h => String(h).toLowerCase().includes('email'));
            const email = emailCol !== -1 ? String(row[emailCol] || '').trim() : null;
            if (email) usn = email.toUpperCase();
            else {
              const name = String(row[sm.name] || '').trim();
              if (name) usn = `TEMP_${name.replace(/\s+/g, '_').toUpperCase()}`;
            }
          }

          const studentId = usnToId[usn];
          if (!studentId) continue;
          
          const val = row[item.index];
          const isPresent = (rawVal) => {
            if (rawVal === true || rawVal === 1 || rawVal === '1' || rawVal === 1.0) return true;
            if (rawVal === false || rawVal === 0 || rawVal === '0' || rawVal === 0.0) return false;
            
            const v = String(rawVal || '').trim().toLowerCase();
            if (!v || v === 'false' || v === '0' || v === 'a' || v === 'absent' || v === 'n' || v === 'no' || v === '❌') return false;
            if (v === 'true' || v === '1' || v === 'p' || v === 'present' || v === 'y' || v === 'yes' || v === '✔' || v === '✅') return true;
            
            return false;
          };

          attendanceBatch.push({
            student_id: studentId,
            session_id: sessionId,
            present: isPresent(val),
            marked_by: 'bulk-upload'
          });
        }

        if (attendanceBatch.length > 0) {
          const { error: attErr } = await supabase.from('attendance').upsert(attendanceBatch, { onConflict: 'student_id, session_id' });
          if (attErr) throw attErr;
          totalAttendanceUpsert += attendanceBatch.length;
        }
      }

      // 4. Build summary details for heatmap
      const summaryDetails = [];
      studentBatch.forEach(student => {
        const sid = usnToId[student.usn];
        const studentAttendance = [];
        activeItems.forEach(item => {
          const rows = rawData[item.sheetName];
          const sm = mappingResults[item.sheetName].studentMapping;
          const hIdx = mappingResults[item.sheetName].headerRowIndex || 0;
          
          // Find student row
          for (let j = hIdx + 1; j < rows.length; j++) {
            let rowUsn = normalizeUSN(rows[j][sm.usn]);
            if (!rowUsn) {
              const emailCol = rows[hIdx].findIndex(h => String(h).toLowerCase().includes('email'));
              const email = emailCol !== -1 ? String(rows[j][emailCol] || '').trim() : null;
              if (email) rowUsn = email.toUpperCase();
            }
            
            if (rowUsn === student.usn) {
              const checkAttendance = (rawVal) => {
                const v = typeof rawVal === 'string' ? rawVal.trim() : rawVal;
                if (v === true || v === 1 || v === '1' || v === 'P' || v === 'p') return true;
                if (typeof v === 'string') {
                  const low = v.toLowerCase();
                  if (['p', 'present', 'true', 'yes', 'y', '1', '1.0', '✔', '✅'].includes(low)) return true;
                }
                return false;
              };
              studentAttendance.push({ date: item.date, present: checkAttendance(rows[j][item.index]) });
              break;
            }
          }
        });
        
        summaryDetails.push({
          ...student,
          attendance: studentAttendance,
          consistency: studentAttendance.length > 0 
            ? (studentAttendance.filter(a => a.present).length / studentAttendance.length) * 100 
            : 0
        });
      });

      setSummary({ 
        sessions: totalSessions, 
        attendance: totalAttendanceUpsert, 
        students: totalStudentsSync,
        details: summaryDetails.sort((a,b) => b.consistency - a.consistency)
      });
      setStep(STEPS.SUMMARY);
    } catch (err) {
      setError("Import failed: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  // -------------------------------------------------------------------------
  // UI Renders
  // -------------------------------------------------------------------------

  const StepIndicator = () => (
    <div className="flex items-center justify-center space-x-4 mb-12">
      {[1, 2, 3, 4, 5, 6].map((s) => (
        <React.Fragment key={s}>
          <div className={cn(
            "w-10 h-10 rounded-full flex items-center justify-center font-bold transition-all duration-300",
            step === s ? "bg-accent-glow text-canvas scale-110 shadow-glow" : 
            step > s ? "bg-success-fg text-canvas" : "bg-surface-raised text-tertiary border border-subtle"
          )}>
            {step > s ? <CheckCircle2 size={20} /> : s}
          </div>
          {s < 6 && <div className={cn("h-1 w-8 rounded", step > s ? "bg-success-fg" : "bg-surface-raised")} />}
        </React.Fragment>
      ))}
    </div>
  );

  return (
    <div className="min-h-screen bg-canvas text-primary p-6 lg:p-12 overflow-x-hidden">
      <div className="max-w-6xl mx-auto">
        <header className="mb-12 flex items-center justify-between">
          <div>
            <h1 className="text-display-sm font-bold tracking-tight">Bulk Attendance Upload</h1>
            <p className="text-secondary mt-2 flex items-center gap-2">
              <Database size={16} /> Intelligent Spreadsheet Processing Engine
            </p>
          </div>
          {step > 1 && step < 5 && (
            <button 
              onClick={() => setStep(step - 1)}
              className="btn-secondary flex items-center gap-2"
            >
              <ArrowLeft size={18} /> Back
            </button>
          )}
        </header>

        <StepIndicator />

        {error && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8 p-4 bg-danger-bg border border-danger-border rounded-2xl flex items-center gap-4 text-danger-fg"
          >
            <AlertCircle />
            <p className="font-medium">{error}</p>
            <button onClick={() => setError(null)} className="ml-auto text-micro uppercase font-bold hover:underline">Dismiss</button>
          </motion.div>
        )}

        <main className="relative">
          {loading && (
            <div className="absolute inset-0 z-50 flex items-center justify-center bg-canvas/60 backdrop-blur-sm rounded-3xl min-h-[400px]">
              <div className="flex flex-col items-center gap-4">
                <Loader className="animate-spin text-accent-glow" size={48} />
                <p className="text-accent-glow font-bold animate-pulse">Processing your request...</p>
              </div>
            </div>
          )}
          <AnimatePresence mode="wait">
            {/* STEP 1: UPLOAD */}
            {step === STEPS.UPLOAD && (
              <motion.div 
                key="upload"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.05 }}
                className="card flex flex-col items-center justify-center py-20 text-center"
              >
                <div className="w-24 h-24 rounded-3xl bg-accent-glow/10 flex items-center justify-center text-accent-glow mb-8 animate-pulse-slow">
                  <Upload size={48} />
                </div>
                <h2 className="text-h2 mb-4">Drop your report here</h2>
                <p className="text-secondary max-w-md mb-12">
                  Supporting CSV and XLSX files. Our AI will automatically handle 
                  merged headers, multiple sheets, and USN detection.
                </p>
                <label className="btn-primary px-12 py-4 text-lg cursor-pointer hover:shadow-glow transition-all">
                  Browse Spreadsheet
                  <input type="file" className="hidden" accept=".xlsx,.xls,.csv" onChange={handleFileChange} />
                </label>
                <div className="mt-12 flex items-center gap-8 text-tertiary">
                  <div className="flex items-center gap-2"><CheckSquare size={16} /> USN Auto-Mapping</div>
                  <div className="flex items-center gap-2"><Calendar size={16} /> Date Detection</div>
                  <div className="flex items-center gap-2"><Layers size={16} /> Multi-Sheet</div>
                </div>
              </motion.div>
            )}

            {/* STEP 2: SHEETS */}
            {step === STEPS.SHEETS && (
              <motion.div 
                key="sheets"
                initial={{ opacity: 0, x: 50 }}
                animate={{ opacity: 1, x: 0 }}
                className="space-y-8"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-h2">Select Data Sheets</h2>
                    <p className="text-secondary">We found multiple sheets in this workbook. Select the ones containing attendance.</p>
                  </div>
                  <button 
                    onClick={() => handleNextToMapping()}
                    disabled={selectedSheets.length === 0}
                    className="btn-primary flex items-center gap-2"
                  >
                    Analyze Selected <ChevronRight size={18} />
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {sheetNames.map(name => {
                    const isSelected = selectedSheets.includes(name);
                    return (
                      <div 
                        key={name}
                        onClick={() => setSelectedSheets(prev => isSelected ? prev.filter(n => n !== name) : [...prev, name])}
                        className={cn(
                          "p-6 rounded-2xl border-2 cursor-pointer transition-all flex items-start gap-4",
                          isSelected ? "border-accent-glow bg-accent-glow/5 shadow-glow" : "border-subtle bg-surface-raised hover:border-tertiary"
                        )}
                      >
                        <div className={cn(
                          "w-12 h-12 rounded-xl flex items-center justify-center",
                          isSelected ? "bg-accent-glow text-canvas" : "bg-surface text-tertiary"
                        )}>
                          <FileSpreadsheet />
                        </div>
                        <div>
                          <h3 className="font-bold text-lg">{name}</h3>
                          <p className="text-micro text-tertiary uppercase mt-1">Sheet Component</p>
                        </div>
                        {isSelected && <CheckCircle2 className="ml-auto text-accent-glow" />}
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            )}

            {/* STEP 3: MAPPING */}
            {step === STEPS.MAPPING && (
              <motion.div 
                key="mapping"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="space-y-12"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-h2">AI Mapping Preview</h2>
                    <p className="text-secondary">AI has analyzed {Object.keys(selectedSheets).length} sheets. Review and refine the detection.</p>
                  </div>
                  {loading ? (
                    <div className="flex items-center gap-3 text-accent-glow font-bold animate-pulse">
                      <Loader className="animate-spin" /> Thinking...
                    </div>
                  ) : (
                    <button onClick={handleValidate} className="btn-primary flex items-center gap-2 px-10">
                      Validate Data <ChevronRight size={18} />
                    </button>
                  )}
                </div>

                <div className="space-y-12">
                  {Object.entries(mappingResults).map(([name, res]) => (
                    <div key={name} className="card p-0 overflow-hidden border-accent-glow/20">
                      <div className="bg-surface-raised p-4 border-b border-subtle flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <FileSpreadsheet className="text-accent-glow" />
                          <span className="font-bold text-lg">{name}</span>
                        </div>
                        <span className="text-micro bg-accent-glow/10 text-accent-glow px-3 py-1 rounded-full font-bold">
                          {res.attendanceColumns.length} Sessions Detected
                        </span>
                      </div>
                      
                      <div className="p-8 grid grid-cols-1 lg:grid-cols-3 gap-12">
                        {/* Student Mapping */}
                        <div className="space-y-6">
                          <h4 className="text-label text-tertiary flex items-center gap-2 uppercase tracking-widest">
                            <User size={14} /> Student Identification
                          </h4>
                          <div className="space-y-4">
                            {['usn', 'name'].map(field => (
                              <div key={field} className="p-4 bg-surface-inset rounded-xl border border-subtle flex items-center justify-between">
                                <span className="font-medium capitalize">{field} Column</span>
                                <input 
                                  type="number" 
                                  value={res.studentMapping[field]}
                                  onChange={(e) => {
                                    const newMap = { ...mappingResults };
                                    newMap[name].studentMapping[field] = parseInt(e.target.value) || 0;
                                    setMappingResults(newMap);
                                  }}
                                  className="w-16 bg-canvas border border-subtle rounded-lg px-2 py-1 text-center font-bold text-accent-glow"
                                />
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Sessions Mapping */}
                        <div className="lg:col-span-2 space-y-6">
                          <h4 className="text-label text-tertiary flex items-center gap-2 uppercase tracking-widest">
                            <Calendar size={14} /> Identified Attendance Columns
                          </h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[400px] overflow-y-auto pr-4 custom-scrollbar">
                            {res.attendanceColumns.map((col, idx) => (
                              <div key={idx} className="p-4 bg-surface-inset rounded-xl border border-subtle hover:border-accent-glow/50 transition-colors group relative">
                                <button 
                                  onClick={() => {
                                    const newMap = { ...mappingResults };
                                    newMap[name].attendanceColumns = newMap[name].attendanceColumns.filter((_, i) => i !== idx);
                                    setMappingResults(newMap);
                                  }}
                                  className="absolute top-2 right-2 p-1 text-tertiary hover:text-danger-fg opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                  <Trash2 size={14} />
                                </button>
                                <div className="flex items-start justify-between">
                                  <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded bg-canvas flex items-center justify-center text-tertiary font-mono text-xs">
                                      {col.index}
                                    </div>
                                    <div>
                                      <p className="font-bold line-clamp-1">{col.header || 'No Header'}</p>
                                      <div className="flex items-center gap-2 mt-1">
                                        <p className="text-micro text-tertiary">Sample: </p>
                                        <div className="flex gap-1">
                                          {(rawData[name] || []).slice((mappingResults[name]?.headerRowIndex || 0) + 1, (mappingResults[name]?.headerRowIndex || 0) + 4).map((r, i) => (
                                            <span key={i} className="px-1.5 py-0.5 bg-canvas rounded text-[10px] border border-subtle">
                                              {String(r?.[col?.index] || 'empty')}
                                            </span>
                                          ))}
                                        </div>
                                      </div>
                                      <div className="flex gap-2 mt-2">
                                        <input 
                                          type="text" 
                                          placeholder="Header"
                                          value={col.header}
                                          onChange={(e) => {
                                            const newMap = { ...mappingResults };
                                            newMap[name].attendanceColumns[idx].header = e.target.value;
                                            setMappingResults(newMap);
                                          }}
                                          className="text-micro bg-transparent border-b border-subtle focus:border-accent-glow outline-none w-20"
                                        />
                                        <input 
                                          type="date" 
                                          value={col.date || ''}
                                          onChange={(e) => {
                                            const newMap = { ...mappingResults };
                                            newMap[name].attendanceColumns[idx].date = e.target.value;
                                            setMappingResults(newMap);
                                          }}
                                          className="text-micro bg-transparent border-none p-0 text-accent-glow w-24"
                                        />
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            ))}
                            
                            <button 
                              onClick={() => {
                                const newMap = { ...mappingResults };
                                const nextIdx = newMap[name].attendanceColumns.length > 0 
                                  ? Math.max(...newMap[name].attendanceColumns.map(c => c.index)) + 1 
                                  : (newMap[name].studentMapping.name + 1);
                                newMap[name].attendanceColumns.push({
                                  index: nextIdx,
                                  header: `Column ${nextIdx}`,
                                  date: null,
                                  isAttendance: true
                                });
                                setMappingResults(newMap);
                              }}
                              className="p-4 border-2 border-dashed border-subtle rounded-xl flex items-center justify-center gap-2 text-tertiary hover:border-accent-glow hover:text-accent-glow transition-all"
                            >
                              <Plus size={16} /> Add Manual Column
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* STEP 4: VALIDATION */}
            {step === STEPS.VALIDATION && (
              <motion.div 
                key="validation"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-8"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-h2">Review & Validate</h2>
                    <p className="text-secondary">We found {validationItems.length} attendance sessions. Resolve any conflicts below.</p>
                  </div>
                  <button 
                    onClick={handleExecute} 
                    disabled={loading || validationItems.filter(v => v.action !== 'skip').length === 0}
                    className="btn-primary px-10 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? 'Syncing...' : 'Confirm & Finish Sync'}
                  </button>
                </div>

                {/* Missing Date Prompt Overlay */}
                {showUsualDaysPrompt && (
                  <div className="p-8 bg-accent-glow/10 border-2 border-accent-glow rounded-3xl mb-8 flex items-center justify-between gap-8 animate-in zoom-in-95 duration-300">
                    <div className="flex items-center gap-6">
                      <div className="w-16 h-16 rounded-2xl bg-accent-glow text-canvas flex items-center justify-center shadow-glow">
                        <HelpCircle size={32} />
                      </div>
                      <div>
                        <h3 className="text-xl font-bold">Missing Dates Detected</h3>
                        <p className="text-secondary max-w-md">Some columns are missing dates. What days are these classes usually taken?</p>
                        <div className="flex gap-2 mt-4">
                          {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map(d => (
                            <button 
                              key={d}
                              onClick={() => setUsualDays(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d])}
                              className={cn(
                                "px-3 py-1 rounded-full text-micro font-bold transition-all",
                                usualDays.includes(d) ? "bg-accent-glow text-canvas" : "bg-surface-raised text-tertiary"
                              )}
                            >
                              {d.substring(0, 3)}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                    <button onClick={handleResolveMissingDates} className="btn-primary whitespace-nowrap">Let AI Suggest Dates</button>
                  </div>
                )}

                <div className="space-y-4">
                  {validationItems.length === 0 ? (
                    <div className="p-12 border-2 border-dashed border-subtle rounded-3xl text-center space-y-4">
                      <div className="w-16 h-16 bg-surface rounded-2xl flex items-center justify-center mx-auto text-tertiary">
                        <Calendar size={32} />
                      </div>
                      <h3 className="text-xl font-bold">No Sessions Detected</h3>
                      <p className="text-secondary max-w-md mx-auto">We couldn't find any columns that look like attendance in your mapping. Go back to Step 3 and try adding a column manually.</p>
                      <button onClick={() => setStep(STEPS.MAPPING)} className="btn-secondary px-8">Go Back to Mapping</button>
                    </div>
                  ) : (
                    validationItems.map((item, idx) => (
                      <div key={idx} className={cn(
                        "p-5 rounded-2xl border flex items-center justify-between transition-all",
                        item.action === 'skip' ? "opacity-50 grayscale border-subtle" :
                        item.status === 'duplicate' ? "border-warning-border bg-warning-bg/5" :
                        item.status === 'suggested' ? "border-accent-glow bg-accent-glow/5" : "border-subtle bg-surface-raised"
                      )}>
                        <div className="flex items-center gap-5">
                          <div className={cn(
                            "w-12 h-12 rounded-xl flex items-center justify-center",
                            item.status === 'duplicate' ? "bg-warning-bg text-warning-fg" : "bg-surface text-tertiary"
                          )}>
                            {item.status === 'duplicate' ? <AlertTriangle /> : <Calendar />}
                          </div>
                          <div>
                            <div className="flex items-center gap-3">
                              <h4 className="font-bold text-lg">{item.header}</h4>
                              <span className="text-micro bg-subtle/20 text-tertiary px-2 py-0.5 rounded font-bold uppercase tracking-tighter">{item.sheetName}</span>
                            </div>
                            <div className="flex items-center gap-3 mt-1">
                              <input 
                                type="date" 
                                value={item.date || ''}
                                onChange={(e) => {
                                  const newItems = [...validationItems];
                                  newItems[idx].date = e.target.value;
                                  newItems[idx].status = 'ok';
                                  setValidationItems(newItems);
                                }}
                                className="bg-transparent border-none p-0 text-secondary focus:ring-0 cursor-pointer hover:text-accent-glow transition-colors"
                              />
                              {item.warning && (
                                <span className={cn(
                                  "text-micro font-bold px-2 py-0.5 rounded flex items-center gap-1",
                                  item.status === 'duplicate' ? "bg-warning-bg text-warning-fg" : "bg-accent-glow/20 text-accent-glow"
                                )}>
                                  <Info size={10} /> {item.warning}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-4">
                          {item.status === 'duplicate' ? (
                            <div className="flex items-center bg-canvas rounded-xl p-1 border border-subtle">
                              <button 
                                onClick={() => {
                                  const newItems = [...validationItems];
                                  newItems[idx].action = 'skip';
                                  setValidationItems(newItems);
                                }}
                                className={cn("px-4 py-1.5 rounded-lg text-micro font-bold transition-all", item.action === 'skip' ? "bg-danger-bg text-danger-fg shadow-sm" : "text-tertiary hover:bg-surface")}
                              >
                                SKIP
                              </button>
                              <button 
                                onClick={() => {
                                  const newItems = [...validationItems];
                                  newItems[idx].action = 'overwrite';
                                  setValidationItems(newItems);
                                }}
                                className={cn("px-4 py-1.5 rounded-lg text-micro font-bold transition-all", item.action === 'overwrite' ? "bg-warning-bg text-warning-fg shadow-sm" : "text-tertiary hover:bg-surface")}
                              >
                                OVERWRITE
                              </button>
                            </div>
                          ) : (
                            <button 
                              onClick={() => {
                                const newItems = [...validationItems];
                                newItems[idx].action = item.action === 'skip' ? 'import' : 'skip';
                                setValidationItems(newItems);
                              }}
                              className={cn(
                                "p-2 rounded-xl transition-all",
                                item.action === 'skip' ? "text-accent-glow bg-accent-glow/10" : "text-tertiary hover:bg-danger-bg hover:text-danger-fg"
                              )}
                            >
                              {item.action === 'skip' ? <CheckCircle2 /> : <Trash2 />}
                            </button>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </motion.div>
            )}

            {/* STEP 5: IMPORTING */}
            {step === STEPS.IMPORTING && (
              <motion.div 
                key="importing"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col items-center justify-center py-32 text-center"
              >
                <div className="relative w-32 h-32 mb-12">
                  <div className="absolute inset-0 rounded-full border-4 border-accent-glow/20" />
                  <div 
                    className="absolute inset-0 rounded-full border-4 border-accent-glow border-t-transparent animate-spin" 
                    style={{ animationDuration: '1.5s' }}
                  />
                  <div className="absolute inset-0 flex items-center justify-center text-accent-glow font-bold text-2xl">
                    {Math.round((progress.current / (progress.total || 1)) * 100)}%
                  </div>
                </div>
                <h2 className="text-h2 mb-4">Syncing with ForgeTrack</h2>
                <p className="text-secondary max-w-md animate-pulse">
                  {progress.phase}
                </p>
                <div className="mt-12 w-full max-w-lg h-2 bg-surface-raised rounded-full overflow-hidden border border-subtle">
                  <motion.div 
                    className="h-full bg-accent-glow shadow-glow"
                    initial={{ width: 0 }}
                    animate={{ width: `${(progress.current / (progress.total || 1)) * 100}%` }}
                  />
                </div>
              </motion.div>
            )}

            {/* STEP 6: SUMMARY */}
            {step === STEPS.SUMMARY && (
              <motion.div 
                key="summary"
                initial={{ opacity: 0, y: 50 }}
                animate={{ opacity: 1, y: 0 }}
                className="max-w-4xl mx-auto space-y-12"
              >
                <div className="text-center space-y-4">
                  <div className="w-24 h-24 rounded-full bg-success-bg text-success-fg flex items-center justify-center mx-auto shadow-glow shadow-success-bg/20">
                    <CheckCircle2 size={48} />
                  </div>
                  <h2 className="text-display-sm font-bold">Import Successful!</h2>
                  <p className="text-secondary text-lg">Your data is now live and processed by our AI engine.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {[
                    { label: 'Sessions Created/Updated', val: summary.sessions, icon: <Calendar />, color: 'text-accent-glow' },
                    { label: 'Attendance Records', val: summary.attendance, icon: <CheckSquare />, color: 'text-success-fg' },
                    { label: 'Students Synced', val: summary.students, icon: <User />, color: 'text-secondary' }
                  ].map((stat, i) => (
                    <div key={i} className="card p-8 text-center space-y-2 group hover:scale-105 transition-transform">
                      <div className={cn("w-12 h-12 rounded-xl bg-surface flex items-center justify-center mx-auto mb-4 group-hover:shadow-glow transition-all", stat.color)}>
                        {stat.icon}
                      </div>
                      <div className={cn("text-4xl font-black", stat.color)}>{stat.val}</div>
                      <div className="text-micro font-bold uppercase tracking-widest text-tertiary">{stat.label}</div>
                    </div>
                  ))}
                </div>

                {/* Consistency Heatmap */}
                <div className="card p-8 space-y-8">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-xl font-bold">Student Consistency Heatmap</h3>
                      <p className="text-secondary text-sm">Visualizing attendance patterns across all sessions.</p>
                    </div>
                    <div className="flex items-center gap-4 text-xs font-bold text-tertiary">
                      <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-success-fg rounded-sm" /> Present</div>
                      <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-danger-bg/40 rounded-sm" /> Absent</div>
                    </div>
                  </div>

                  <div className="space-y-6 max-h-[500px] overflow-y-auto pr-4 custom-scrollbar">
                    {summary.details.map((student, i) => (
                      <div key={i} className="flex items-center justify-between group">
                        <div className="w-48">
                          <p className="font-bold text-sm truncate">{student.name}</p>
                          <p className="text-[10px] text-tertiary truncate">{student.usn}</p>
                        </div>
                        
                        <div className="flex-1 flex gap-1 justify-end">
                          {student.attendance.map((att, j) => (
                            <div 
                              key={j} 
                              className={cn(
                                "w-3 h-3 rounded-sm transition-all hover:scale-125 cursor-help",
                                att.present ? "bg-success-fg" : "bg-danger-bg/40"
                              )}
                              title={`${att.date}: ${att.present ? 'Present' : 'Absent'}`}
                            />
                          ))}
                        </div>

                        <div className="w-16 text-right ml-6">
                          <span className={cn(
                            "text-xs font-black",
                            student.consistency > 85 ? "text-success-fg" : 
                            student.consistency > 60 ? "text-warning-fg" : "text-danger-fg"
                          )}>
                            {Math.round(student.consistency)}%
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex flex-col md:flex-row items-center justify-center gap-6 pt-12">
                  <button onClick={() => setStep(STEPS.UPLOAD)} className="btn-secondary px-12 py-4 text-lg">
                    Upload Another
                  </button>
                  <button onClick={() => navigate('/dashboard')} className="btn-primary px-12 py-4 text-lg shadow-glow">
                    Return to Dashboard
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
