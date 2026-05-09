import { GoogleGenerativeAI } from "@google/generative-ai";

/**
 * Uses AI to analyze spreadsheet headers and sample data to map them to database fields.
 * Falls back to a local greedy scanner if AI fails.
 */
export async function analyzeSpreadsheetHeader(sampleRows) {
  const models = ["gemini-1.5-flash", "gemini-pro", "gemini-1.0-pro"];
  const apiKey = (import.meta.env.VITE_GEMINI_API_KEY || "").trim();
  
  if (!apiKey || apiKey.includes('placeholder')) {
    console.warn("[AI] No valid API key, skipping to local scanner.");
    return localGreedyScanner(sampleRows);
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  let lastError = null;

  for (const modelId of models) {
    try {
      console.log(`[AI] Attempting ${modelId}...`);
      const model = genAI.getGenerativeModel({ model: modelId });
      
      const sampleText = sampleRows.map(row => 
        row.map(cell => String(cell || '').substring(0, 50)).join(' | ')
      ).join('\n');

      const prompt = `
        You are a spreadsheet parser. Return ONLY JSON.
        Data:
        ${sampleText}

        Identify:
        1. headerRowIndex: Row index with labels like 'USN', 'Name'.
        2. studentMapping: { usn: col_idx, name: col_idx }
        3. attendanceColumns: List of { index, header, date: "YYYY-MM-DD" } where attendance is marked.

        Rules:
        - Dates are in DD/MM/YYYY format in the data.
        - If no date, set to null.
        - Response must be pure JSON.
      `;

      const result = await model.generateContent(prompt);
      const text = result.response.text();
      console.log(`[AI] Raw Response:`, text);
      
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          headerRowIndex: parsed.headerRowIndex ?? 0,
          studentMapping: parsed.studentMapping || { usn: 0, name: 1 },
          attendanceColumns: (parsed.attendanceColumns || []).map(c => ({
            ...c,
            isAttendance: true,
            header: c.header || `Col ${c.index}`
          }))
        };
      }
    } catch (error) {
      console.error(`[AI] ${modelId} failed:`, error.message);
      lastError = error;
    }
  }
  
  console.warn("[AI] All models failed, using local greedy scanner fallback.");
  return localGreedyScanner(sampleRows);
}

/**
 * Converts Excel serial dates to ISO strings.
 */
function excelDateToJSDate(serial) {
  if (typeof serial !== 'number') return null;
  const date = new Date(Math.round((serial - 25569) * 86400 * 1000));
  return date.toISOString().split('T')[0];
}

/**
 * A local, non-AI fallback that uses regex to guess column mapping.
 */
function localGreedyScanner(sampleRows) {
  const mapping = {
    headerRowIndex: 0,
    studentMapping: { usn: 0, name: 1 },
    attendanceColumns: []
  };

  if (!sampleRows || sampleRows.length === 0) return mapping;

  // 1. Find Header Row (Look for USN or Name)
  let foundHeader = false;
  for (let i = 0; i < Math.min(sampleRows.length, 10); i++) {
    const row = sampleRows[i].map(c => String(c || '').toLowerCase());
    if (row.some(c => c.includes('usn') || c.includes('roll') || c.includes('name') || c.includes('student'))) {
      mapping.headerRowIndex = i;
      // Map USN and Name
      const usnIdx = row.findIndex(c => c.includes('usn') || c.includes('roll'));
      const nameIdx = row.findIndex(c => c.includes('name') || c.includes('student'));
      if (usnIdx !== -1) mapping.studentMapping.usn = usnIdx;
      if (nameIdx !== -1) mapping.studentMapping.name = nameIdx;
      foundHeader = true;
      break;
    }
  }

  // 2. Find Attendance Columns
  const headerRow = sampleRows[mapping.headerRowIndex] || [];
  const contextRow = mapping.headerRowIndex > 0 ? sampleRows[mapping.headerRowIndex - 1] : [];

  headerRow.forEach((cell, idx) => {
    const val = String(cell || '').trim();
    const context = String(contextRow[idx] || '').trim();
    
    // Check if it's an attendance column (Header says "Attendance" or date-like)
    const isAttendanceHeader = val.toLowerCase().includes('attendance') || val.toLowerCase().includes('present');
    const looksLikeDate = /\d{1,2}[\/-]\d{1,2}/.test(val) || /\d{4,5}/.test(val); 
    
    let looksLikeAttendance = false;
    for (let i = mapping.headerRowIndex + 1; i < Math.min(sampleRows.length, 30); i++) {
      const sampleCell = sampleRows[i][idx];
      if (sampleCell !== '' && sampleCell !== null) {
        looksLikeAttendance = true;
        break;
      }
    }

    const isStudentCol = idx === mapping.studentMapping.usn || idx === mapping.studentMapping.name;
    
    if (!isStudentCol && (isAttendanceHeader || looksLikeDate || looksLikeAttendance)) {
      // Try to parse date from header or context
      let parsedDate = null;
      
      // Try header first
      const headerDateMatch = val.match(/(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})/);
      if (headerDateMatch) {
        let [_, d, m, y] = headerDateMatch;
        if (y.length === 2) y = "20" + y;
        parsedDate = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
      } else if (/^\d{5}$/.test(val)) {
        parsedDate = excelDateToJSDate(parseInt(val));
      }

      // If no date in header, try context (the row above)
      if (!parsedDate && context) {
        const contextDateMatch = context.match(/(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})/);
        if (contextDateMatch) {
          let [_, d, m, y] = contextDateMatch;
          if (y.length === 2) y = "20" + y;
          parsedDate = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
        }
      }

      const finalHeader = (context && val && val.toLowerCase().includes('attend')) 
        ? `${context} - ${val}` 
        : (val || context || `Column ${idx}`);

      mapping.attendanceColumns.push({
        index: idx,
        header: finalHeader,
        context: context || null,
        date: parsedDate,
        isAttendance: true
      });
    }
  });

  return mapping;
}

/**
 * Uses AI to suggest a date for a column with missing header data.
 */
export async function suggestDateForColumn(columnInfo, usualDays, existingDates) {
  const apiKey = (import.meta.env.VITE_GEMINI_API_KEY || "").trim();
  if (!apiKey || apiKey.includes('placeholder')) return null;
  
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
  
  const prompt = `
    Suggest a date (YYYY-MM-DD) for a column:
    Header: "${columnInfo.header}"
    Context: "${columnInfo.context || 'None'}"
    Other dates in sheet: ${existingDates.join(', ')}
    
    CRITICAL RULE: Classes ONLY happen on Wednesdays, Thursdays, and Saturdays.
    
    Suggest the most likely date for this session:
    - Pick a date near the existing dates.
    - The date MUST be a Wednesday, Thursday, or Saturday.
    - Return ONLY the date string (YYYY-MM-DD).
  `;

  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();
    const dateMatch = text.match(/\d{4}-\d{2}-\d{2}/);
    return dateMatch ? dateMatch[0] : null;
  } catch (error) {
    console.error("[AI] Date suggestion failed:", error.message);
    return null;
  }
}
