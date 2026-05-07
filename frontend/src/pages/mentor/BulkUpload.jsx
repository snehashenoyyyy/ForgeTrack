import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Upload, FileSpreadsheet, CheckCircle2, AlertCircle, 
  ChevronRight, ArrowLeft, Loader, Calendar, 
  User, CheckSquare, Search, Info, Trash2
} from 'lucide-react';
import * as XLSX from 'xlsx/xlsx.mjs';
import { supabase } from '../../lib/supabase';
import { analyzeSpreadsheetHeader, suggestDateForColumn } from '../../lib/ai-upload';
import { cn } from '../../lib/utils';
import { useNavigate } from 'react-router-dom';

const STEPS = {
  UPLOAD: 1,
  SHEET_SELECT: 2,
  MAPPING: 3,
  VERIFY: 4,
  IMPORTING: 5,
  COMPLETE: 6
};

export default function BulkUpload() {
  const navigate = useNavigate();
  const [step, setStep] = useState(STEPS.UPLOAD);
  const [file, setFile] = useState(null);
  const [workbook, setWorkbook] = useState(null);
  const [sheetNames, setSheetNames] = useState([]);
  const [selectedSheets, setSelectedSheets] = useState([]);
  const [rawData, setRawData] = useState({}); // sheetName -> rows
  const [mapping, setMapping] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  const [validationResults, setValidationResults] = useState([]);
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0 });
  const [usualDays, setUsualDays] = useState(['Monday', 'Thursday']);

  // Handle file drop/upload
  const onFileChange = (e) => {
    const f = e.target.files[0];
    if (f) processFile(f);
  };

  const processFile = (file) => {
    setFile(file);
    const reader = new FileReader();
    reader.onload = (e) => {
      const data = new Uint8Array(e.target.result);
      const wb = XLSX.read(data, { type: 'array', cellDates: true });
      setWorkbook(wb);
      setSheetNames(wb.SheetNames);
      if (wb.SheetNames.length === 1) {
        setSelectedSheets([wb.SheetNames[0]]);
        goToSheetSelect([wb.SheetNames[0]], wb);
      } else {
        setStep(STEPS.SHEET_SELECT);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const goToSheetSelect = (sheets, wb) => {
    const data = {};
    sheets.forEach(name => {
      const ws = wb.Sheets[name];
      data[name] = XLSX.utils.sheet_to_json(ws, { header: 1 });
    });
    setRawData(data);
    startAiAnalysis(data, sheets[0]);
  };

  const basicDateScanner = (rows) => {
    if (!rows || rows.length === 0) return null;
    const dateRegex = /(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})/;
    
    // Excel serial to ISO (45658 is ~Aug 2025)
    const excelToISO = (serial) => {
      const date = new Date((serial - 25569) * 86400 * 1000);
      return date.toISOString().split('T')[0];
    };

    for (let i = 0; i < Math.min(rows.length, 10); i++) {
      const row = rows[i];
      const dates = row.map((cell, idx) => {
        const val = cell;
        // Case 1: Excel Serial Number (e.g. 45728)
        if (typeof val === 'number' && val > 44000 && val < 50000) {
          return { index: idx, header: `Excel Date (${val})`, date: excelToISO(val), isAttendance: true };
        }
        // Case 2: String Date (e.g. 30/04/26)
        const str = String(val).trim();
        const match = str.match(dateRegex);
        if (match) {
          let [_, d, m, y] = match;
          if (y.length === 2) y = "20" + y;
          const iso = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
          return { index: idx, header: str, date: iso, isAttendance: true };
        }
        return null;
      }).filter(Boolean);
      
      if (dates.length >= 1) return { headerRowIndex: i, attendanceColumns: dates };
    }
    return null;
  };

  const startAiAnalysis = async (data, firstSheet) => {
    setLoading(true);
    setError(null);
    setStep(STEPS.MAPPING);
    try {
      const allRows = data[firstSheet] || [];
      const nonEmptyRows = allRows.filter(row => row && row.some(cell => cell !== null && cell !== ''));
      const samples = nonEmptyRows.slice(0, 20);
      
      // Try Hardcoded Scanner First
      const basicResult = basicDateScanner(nonEmptyRows);
      
      // Basic USN/Name Detection
      const headerRow = nonEmptyRows[basicResult?.headerRowIndex || 0];
      const studentMap = { usn: 0, name: 1 };
      if (headerRow) {
        headerRow.forEach((h, idx) => {
          const s = String(h).toLowerCase();
          if (s.includes('usn') || s.includes('identifier')) studentMap.usn = idx;
          if (s.includes('name')) studentMap.name = idx;
        });
      }

      let result;
      try {
        result = await analyzeSpreadsheetHeader(null, samples);
      } catch (aiErr) {
        if (basicResult) {
          result = { ...basicResult, studentMapping: studentMap };
          console.warn("AI failed, but hardcoded scanner found sessions.");
        } else {
          throw aiErr;
        }
      }

      setMapping(result);
      const hIdx = result.headerRowIndex || 0;
      setRawData({ [firstSheet]: nonEmptyRows.slice(hIdx) });
    } catch (err) {
      setError("AI Analysis failed: " + err.message);
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const runValidation = async () => {
    setLoading(true);
    setStep(STEPS.VERIFY);
    try {
      const sessions = mapping.attendanceColumns.filter(c => c.isAttendance);
      const results = [];

      for (const sess of sessions) {
        const res = { ...sess, status: 'ok', warning: null };
        
        // Check for existing session in DB
        if (sess.date) {
          const { data: existing } = await supabase
            .from('sessions')
            .select('id, topic')
            .eq('date', sess.date)
            .maybeSingle();
          
          if (existing) {
            res.status = 'duplicate';
            res.warning = `Found existing session. We will update the attendance records for this date.`;
            res.sessionId = existing.id;
          }
        } else {
          res.status = 'missing_date';
          // Try to auto-suggest
          const suggested = await suggestDateForColumn(sess, usualDays, sessions.map(s => s.date).filter(Boolean));
          res.suggestedDate = suggested;
          res.date = suggested; // Default to suggested
        }
        results.push(res);
      }
      setValidationResults(results);
    } catch (err) {
      setError("Validation failed: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const executeImport = async () => {
    setLoading(true);
    setStep(STEPS.IMPORTING);
    try {
      const allRows = rawData[selectedSheets[0]];
      const studentMap = mapping.studentMapping;
      const sessionCols = validationResults.filter(r => r.date && r.status !== 'error');
      
      setImportProgress({ current: 0, total: sessionCols.length });

      const checkAttendance = (val) => {
        if (val === true || val === 1 || val === '1') return true;
        if (typeof val === 'string') {
          const v = val.toLowerCase().trim();
          return ['p', 'present', 'true', 'yes', 'y'].includes(v);
        }
        return false;
      };

      const normalizeUSN = (usn) => String(usn).toLowerCase().replace(/[^a-z0-9]/g, '').trim();

      // 1. Pre-fetch all students and create a USN -> ID map
      const { data: students, error: studentError } = await supabase
        .from('students')
        .select('id, usn');
      
      if (studentError) throw studentError;
      const usnToId = {};
      students.forEach(s => {
        if (s.usn) usnToId[normalizeUSN(s.usn)] = s.id;
      });

      console.log("Database USN Map size:", Object.keys(usnToId).length);

      // 2. Process each session column
      for (let i = 0; i < sessionCols.length; i++) {
        const sess = sessionCols[i];
        let sessionId = sess.sessionId;
        let skippedCount = 0;

        if (!sessionId) {
          const { data: newSess, error: sessErr } = await supabase
            .from('sessions')
            .insert([{
              date: sess.date,
              topic: sess.header || `Bulk Import ${new Date().toLocaleDateString()}`,
              month_number: new Date(sess.date).getMonth() + 1,
              duration_hours: 2.0
            }])
            .select()
            .single();
          
          if (sessErr) throw sessErr;
          sessionId = newSess.id;
        }

        // 3. Prepare Attendance Records
        const records = [];
        for (let j = 1; j < allRows.length; j++) {
          const row = allRows[j];
          const usnRaw = row[studentMap.usn];
          if (!usnRaw) continue;
          
          const usnValue = normalizeUSN(usnRaw);
          const isPresent = checkAttendance(row[sess.index]);
          const studentId = usnToId[usnValue];

          if (studentId) {
            records.push({
              student_id: studentId,
              session_id: sessionId,
              present: isPresent,
              marked_by: 'AI Bulk Upload'
            });
          } else {
            skippedCount++;
            if (i === 0 && j < 5) console.warn(`Student USN '${usnRaw}' not found in DB.`);
          }
        }

        console.log(`Session ${sess.date}: Prepared ${records.length} records. Skipped ${skippedCount} students.`);

        // 4. Upsert Attendance
        if (records.length > 0) {
          const { error: attErr } = await supabase
            .from('attendance')
            .upsert(records, { onConflict: 'student_id,session_id' });
          
          if (attErr) throw attErr;
        }

        setImportProgress(prev => ({ ...prev, current: i + 1 }));
      }

      setStep(STEPS.COMPLETE);
    } catch (err) {
      setError("Import failed: " + err.message);
      setStep(STEPS.VERIFY);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-20">
      <header>
        <h1 className="text-display-sm">Bulk Attendance Upload</h1>
        <p className="text-secondary">AI-powered spreadsheet processing</p>
      </header>

      {error && (
        <div className="bg-danger-bg border border-danger-border p-4 rounded-xl flex items-center gap-3 text-danger-fg animate-shake">
          <AlertCircle size={20} />
          <p>{error}</p>
        </div>
      )}

      <div className="card min-h-[400px] flex flex-col">
        {/* Progress Bar */}
        <div className="flex border-b border-subtle">
          {[1, 2, 3, 4].map(s => (
            <div 
              key={s}
              className={cn(
                "flex-1 py-3 text-center text-micro font-bold uppercase tracking-widest transition-colors",
                step >= s ? "text-accent-glow border-b-2 border-accent-glow" : "text-tertiary"
              )}
            >
              Step {s}
            </div>
          ))}
        </div>

        <div className="p-8 flex-1">
          <AnimatePresence mode="wait">
            {step === STEPS.UPLOAD && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="flex flex-col items-center justify-center h-full py-12"
              >
                <div className="w-20 h-20 rounded-full bg-accent-glow/10 flex items-center justify-center text-accent-glow mb-6">
                  <Upload size={40} />
                </div>
                <h2 className="text-h2 mb-2">Upload Spreadsheet</h2>
                <p className="text-secondary mb-8 text-center max-w-md">
                  Drag and drop your attendance sheet (XLSX or CSV). 
                  Our AI will automatically detect dates and student identifiers.
                </p>
                <label className="btn-primary cursor-pointer px-12 py-4">
                  Browse Files
                  <input type="file" className="hidden" accept=".xlsx,.xls,.csv" onChange={onFileChange} />
                </label>
              </motion.div>
            )}

            {step === STEPS.SHEET_SELECT && (
              <motion.div 
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="space-y-6"
              >
                <h2 className="text-h2">Select Sheets</h2>
                <p className="text-secondary">Choose the sheets containing attendance data.</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {sheetNames.map(name => (
                    <div 
                      key={name}
                      onClick={() => setSelectedSheets(prev => 
                        prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name]
                      )}
                      className={cn(
                        "p-4 rounded-xl border-2 cursor-pointer transition-all flex items-center gap-4",
                        selectedSheets.includes(name) 
                          ? "border-accent-glow bg-accent-glow/5" 
                          : "border-subtle bg-surface hover:border-tertiary"
                      )}
                    >
                      <FileSpreadsheet className={selectedSheets.includes(name) ? "text-accent-glow" : "text-tertiary"} />
                      <span className="font-medium">{name}</span>
                    </div>
                  ))}
                </div>
                <div className="flex justify-end pt-8">
                  <button 
                    onClick={() => goToSheetSelect(selectedSheets, workbook)}
                    disabled={selectedSheets.length === 0}
                    className="btn-primary flex items-center gap-2 px-8"
                  >
                    Continue <ChevronRight size={18} />
                  </button>
                </div>
              </motion.div>
            )}

            {step === STEPS.MAPPING && (
              <motion.div 
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="space-y-8"
              >
                <div className="flex items-center justify-between">
                  <h2 className="text-h2">Mapping Preview</h2>
                  {loading && <div className="flex items-center gap-2 text-accent-glow font-medium"><Loader className="animate-spin" /> Analyzing...</div>}
                </div>

                {!loading && !mapping && error && (
                  <div className="p-8 border-2 border-dashed border-subtle rounded-xl text-center">
                    <AlertCircle className="mx-auto mb-4 text-warning-fg" size={32} />
                    <h3 className="text-h3 mb-2">AI Analysis Limited</h3>
                    <p className="text-secondary mb-6">We hit a rate limit or the sheet is too complex. You can map columns manually to continue.</p>
                    <button 
                      onClick={() => setMapping({
                        headerRowIndex: 0,
                        studentMapping: { usn: 0, name: 1 },
                        attendanceColumns: []
                      })}
                      className="btn-primary"
                    >
                      Enter Manual Mapping Mode
                    </button>
                  </div>
                )}

                {!loading && mapping && (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-4">
                          <h3 className="text-label text-tertiary uppercase flex items-center gap-2">
                            <User size={14} /> Student Identification
                          </h3>
                          <div className="space-y-3">
                            <div className="p-4 bg-surface-raised rounded-xl border border-subtle space-y-3">
                              <div className="flex justify-between items-center">
                                <span className="text-body-sm text-secondary">USN Column Index</span>
                                <input 
                                  type="number" 
                                  value={mapping.studentMapping.usn}
                                  onChange={(e) => setMapping({ ...mapping, studentMapping: { ...mapping.studentMapping, usn: parseInt(e.target.value) }})}
                                  className="w-16 bg-surface border border-subtle rounded px-2 py-1 text-right font-mono"
                                />
                              </div>
                              <div className="flex justify-between items-center pt-2 border-t border-subtle/50">
                                <span className="text-micro text-tertiary">Preview (First Student):</span>
                                <span className="text-micro font-bold text-accent-glow">
                                  {rawData[selectedSheets[0]]?.[1]?.[mapping.studentMapping.usn] || 'Empty'}
                                </span>
                              </div>
                            </div>

                            <div className="p-4 bg-surface-raised rounded-xl border border-subtle space-y-3">
                              <div className="flex justify-between items-center">
                                <span className="text-body-sm text-secondary">Name Column Index</span>
                                <input 
                                  type="number" 
                                  value={mapping.studentMapping.name}
                                  onChange={(e) => setMapping({ ...mapping, studentMapping: { ...mapping.studentMapping, name: parseInt(e.target.value) }})}
                                  className="w-16 bg-surface border border-subtle rounded px-2 py-1 text-right font-mono"
                                />
                              </div>
                              <div className="flex justify-between items-center pt-2 border-t border-subtle/50">
                                <span className="text-micro text-tertiary">Preview:</span>
                                <span className="text-micro font-bold text-accent-glow">
                                  {rawData[selectedSheets[0]]?.[1]?.[mapping.studentMapping.name] || 'Empty'}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>

                      <div className="space-y-4">
                        <h3 className="text-label text-tertiary uppercase flex items-center gap-2">
                          <Calendar size={14} /> Identified Sessions
                        </h3>
                        <div className="max-h-48 overflow-y-auto space-y-2 pr-2">
                          {mapping.attendanceColumns.filter(c => c.isAttendance).map((col, idx) => (
                            <div key={idx} className="flex justify-between items-center p-2 bg-surface rounded border border-subtle">
                              <span className="text-caption font-mono">{col.header || 'No Header'}</span>
                              <span className={cn(
                                "text-caption px-2 py-0.5 rounded",
                                col.date ? "bg-success-bg text-success-fg" : "bg-warning-bg text-warning-fg"
                              )}>
                                {col.date || 'Needs Date'}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-between pt-8 border-t border-subtle">
                      <button onClick={() => setStep(STEPS.UPLOAD)} className="btn-secondary flex items-center gap-2">
                        <ArrowLeft size={18} /> Back
                      </button>
                      <button onClick={runValidation} className="btn-primary px-12">
                        Validate Data
                      </button>
                    </div>
                  </>
                )}
              </motion.div>
            )}

            {step === STEPS.VERIFY && (
              <motion.div 
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="space-y-6"
              >
                <div className="flex items-center justify-between">
                  <h2 className="text-h2">Verification & Duplicates</h2>
                  {validationResults.some(r => !r.date) && (
                    <button 
                      onClick={() => setValidationResults(prev => prev.filter(r => r.date))}
                      className="text-caption text-danger-fg bg-danger-bg/10 hover:bg-danger-bg/20 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-2"
                    >
                      <Trash2 size={14} /> Clear All Unset Sessions
                    </button>
                  )}
                </div>
                <p className="text-secondary">We found {validationResults.length} sessions. Review any warnings below.</p>

                <div className="space-y-4">
                  {validationResults.map((res, idx) => (
                    <div key={idx} className={cn(
                      "p-4 rounded-xl border flex items-center justify-between gap-4",
                      res.status === 'duplicate' ? "border-warning-border bg-warning-bg/5" : 
                      res.status === 'missing_date' ? "border-accent-glow bg-accent-glow/5" : "border-subtle"
                    )}>
                      <div className="flex items-center gap-4">
                        <div className={cn(
                          "w-10 h-10 rounded-lg flex items-center justify-center",
                          res.status === 'ok' ? "bg-success-bg text-success-fg" : "bg-warning-bg text-warning-fg"
                        )}>
                          {res.status === 'ok' ? <CheckCircle2 /> : <Info />}
                        </div>
                        <div>
                          <p className="font-medium">{res.header}</p>
                          <div className="flex items-center gap-2 mt-1">
                            {res.status === 'missing_date' ? (
                              <div className="flex items-center gap-2">
                                <span className="text-caption text-secondary">Set Date:</span>
                                <input 
                                  type="date" 
                                  value={res.date || ''} 
                                  onChange={(e) => {
                                    const newRes = [...validationResults];
                                    newRes[idx].date = e.target.value;
                                    setValidationResults(newRes);
                                  }}
                                  className="bg-surface border border-subtle rounded px-2 py-0.5 text-caption"
                                />
                                {res.suggestedDate && (
                                  <span className="text-micro bg-accent-glow/10 text-accent-glow px-2 py-0.5 rounded italic">AI Suggestion</span>
                                )}
                              </div>
                            ) : (
                              <span className="text-caption text-secondary">{res.date}</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        {res.warning && (
                          <div className={cn(
                            "flex items-center gap-2 text-micro font-bold px-3 py-1.5 rounded-lg border",
                            res.status === 'error' ? "bg-danger-bg text-danger-fg border-danger-border" : "bg-warning-bg text-warning-fg border-warning-border"
                          )}>
                            <AlertCircle size={14} />
                            {res.warning}
                          </div>
                        )}
                        
                        <button 
                          onClick={() => removeSession(idx)}
                          className="p-2 hover:bg-danger-bg hover:text-danger-fg rounded-lg transition-colors text-tertiary"
                          title="Remove from import"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex justify-between pt-8">
                  <button onClick={() => setStep(STEPS.MAPPING)} className="btn-secondary">Back to Mapping</button>
                  <button 
                    onClick={executeImport} 
                    disabled={validationResults.some(r => !r.date)}
                    className="btn-primary px-12"
                  >
                    Start Import
                  </button>
                </div>
              </motion.div>
            )}

            {step === STEPS.IMPORTING && (
              <div className="flex flex-col items-center justify-center h-full py-20 space-y-8">
                <div className="relative w-32 h-32">
                  <svg className="w-full h-full" viewBox="0 0 100 100">
                    <circle 
                      cx="50" cy="50" r="45" 
                      fill="none" stroke="currentColor" 
                      strokeWidth="8" className="text-surface-raised"
                    />
                    <motion.circle 
                      cx="50" cy="50" r="45" 
                      fill="none" stroke="currentColor" 
                      strokeWidth="8" className="text-accent-glow"
                      strokeDasharray="283"
                      animate={{ strokeDashoffset: 283 - (283 * (importProgress.current / importProgress.total)) }}
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center font-bold text-h2">
                    {Math.round((importProgress.current / importProgress.total) * 100)}%
                  </div>
                </div>
                <div className="text-center">
                  <h3 className="text-h3 mb-2">Importing Attendance</h3>
                  <p className="text-secondary">Processing session {importProgress.current} of {importProgress.total}...</p>
                </div>
              </div>
            )}

            {step === STEPS.COMPLETE && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col items-center justify-center h-full py-12 text-center"
              >
                <div className="w-20 h-20 rounded-full bg-success-bg text-success-fg flex items-center justify-center mb-6">
                  <CheckCircle2 size={40} />
                </div>
                <h2 className="text-display-sm mb-2">Import Successful!</h2>
                <p className="text-body-lg text-secondary mb-12 max-w-md">
                  All attendance records have been successfully mapped and uploaded to the database.
                </p>
                <div className="flex gap-4">
                  <button onClick={() => navigate('/attendance')} className="btn-secondary">View Attendance</button>
                  <button onClick={() => { setStep(STEPS.UPLOAD); setFile(null); }} className="btn-primary">Upload Another</button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {step === STEPS.UPLOAD && (
        <div className="card p-6 bg-surface-raised border-dashed border-2 border-subtle">
          <div className="flex items-start gap-4">
            <div className="p-2 bg-accent-glow/10 text-accent-glow rounded-lg">
              <Info size={20} />
            </div>
            <div>
              <h4 className="font-bold mb-1">Supported Format</h4>
              <p className="text-caption text-secondary">
                Our AI supports standard matrix formats (Students as rows, dates as columns) and 
                can even handle sheets where some date headers are missing if you provide the regular schedule.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
