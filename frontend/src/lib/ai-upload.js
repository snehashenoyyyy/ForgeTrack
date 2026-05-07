import { GoogleGenerativeAI } from "@google/generative-ai";
import { getGeminiModel } from './gemini';

/**
 * Uses AI to analyze spreadsheet headers and sample data to map them to database fields.
 * @param {Array<string>} headers - The top row of the spreadsheet
 * @param {Array<Array<any>>} sampleRows - A few rows of sample data
 * @returns {Promise<Object>} The mapping result
 */
export async function analyzeSpreadsheetHeader(headers, sampleRows) {
  const models = ["gemini-3-flash-preview", "gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash"];
  let lastError = null;

  for (const modelId of models) {
    try {
      const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY || 'placeholder');
      const model = genAI.getGenerativeModel({ model: modelId });
      
      const prompt = `
        Analyze this spreadsheet snippet for an attendance sheet.
        The header row might not be the first row. Identify which row is the header.
        
        Target database fields for students: usn, name, email, admission_number, branch_code.
        Target database fields for attendance: Each column represents a session on a specific date.
        
        Data Snippet (First 10 rows): ${JSON.stringify(sampleRows)}
        
        Return a JSON object with:
        1. "headerRowIndex": The index (0-based) of the row in this snippet that contains headers.
        2. "studentMapping": { "usn": col_index, "name": col_index, "email": col_index, "admission_number": col_index, "branch_code": col_index }
        3. "attendanceColumns": An array of objects: { "index": col_index, "header": "original_text", "date": "YYYY-MM-DD" or null if not a date, "isAttendance": boolean }
        
        Important:
        - **Date Pattern**: Dates follow the Indian system (DD/MM/YY or DD-MM-YY). Look for headers like "30/04/26", "13-11-25", or even numbers.
        - **Year Handling**: Treat 2-digit years '25' and '26' as 2025 and 2026.
        - **Attendance Detection**: Be aggressive. If a column contains mostly boolean values (TRUE/FALSE, 1/0), "P/A", or "Present/Absent", it IS an attendance column.
        - For the "date" field, use ISO YYYY-MM-DD.
        - Respond ONLY with valid JSON.
      `;

      const result = await model.generateContent(prompt);
      const text = result.response.text();
      console.log(`AI Raw Response (${modelId}):`, text);
      
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        // Validate that we actually found some columns
        if (parsed.attendanceColumns && parsed.attendanceColumns.length > 0) {
          return parsed;
        }
        console.warn(`Model ${modelId} returned 0 attendance columns, trying next model...`);
      }
    } catch (error) {
      console.error(`Model ${modelId} failed:`, error);
      lastError = error;
    }
  }
  
  throw lastError || new Error("All AI models failed to analyze the spreadsheet correctly.");
}

/**
 * Uses AI to suggest a date for a column with missing header data.
 * @param {Object} columnInfo - Info about the column
 * @param {Array<string>} usualDays - e.g., ["Monday", "Thursday"]
 * @param {Array<string>} existingDates - Dates already identified in this sheet
 * @returns {Promise<string>} The suggested date YYYY-MM-DD
 */
export async function suggestDateForColumn(columnInfo, usualDays, existingDates) {
  const model = getGeminiModel();
  
  const prompt = `
    A spreadsheet column contains attendance data but has an unclear header: "${columnInfo.header}".
    Other sessions in this sheet were on: ${existingDates.join(', ')} (ISO format).
    This class usually takes place on: ${usualDays.join(', ')}.
    
    Suggest the most likely date for this session in YYYY-MM-DD format.
    Important: The spreadsheet uses the Indian date system (DD/MM/YYYY).
    Reason based on the existing dates and the usual class days.
    Return only the date.
  `;

  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();
    const dateMatch = text.match(/\d{4}-\d{2}-\d{2}/);
    return dateMatch ? dateMatch[0] : null;
  } catch (error) {
    console.error("AI Suggestion Error:", error);
    return null;
  }
}
