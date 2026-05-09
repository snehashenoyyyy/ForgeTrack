import XLSX from 'xlsx';
import fs from 'fs';

const filePath = 'c:\\Users\\B SNEHA SHENOY\\Downloads\\Data Engineering and AI - Actual Program.xlsx';

try {
    const workbook = XLSX.readFile(filePath);
    console.log('Sheets:', workbook.SheetNames);
    
    workbook.SheetNames.slice(0, 3).forEach(sheetName => {
        const worksheet = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        console.log(`\n--- Sheet: ${sheetName} ---`);
        console.log('Row 0:', JSON.stringify(rows[0]));
        console.log('Row 1:', JSON.stringify(rows[1]));
        console.log('Row 2:', JSON.stringify(rows[2]));
        console.log('Row 3:', JSON.stringify(rows[3]));
        console.log('Row 10 (sample data):', JSON.stringify(rows[10]));
    });
} catch (err) {
    console.error('Error reading file:', err.message);
}
