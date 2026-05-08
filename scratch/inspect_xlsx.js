import XLSX from 'xlsx';
import path from 'path';

const filePath = 'c:\\Users\\B SNEHA SHENOY\\Downloads\\Data Engineering and AI - Actual Program.xlsx';

try {
    const workbook = XLSX.readFile(filePath);
    console.log('Sheets:', workbook.SheetNames);
    
    workbook.SheetNames.forEach(sheetName => {
        const worksheet = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        console.log(`\n--- Sheet: ${sheetName} ---`);
        console.log('First 5 rows:');
        console.log(JSON.stringify(rows.slice(0, 5), null, 2));
    });
} catch (err) {
    console.error('Error reading file:', err);
}
