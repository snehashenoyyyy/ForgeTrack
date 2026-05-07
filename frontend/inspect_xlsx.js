import * as XLSX from 'xlsx';
import fs from 'fs';

const filePath = 'c:\\Users\\B SNEHA SHENOY\\Downloads\\Data Engineering and AI - Actual Program.xlsx';

try {
  const fileBuffer = fs.readFileSync(filePath);
  const workbook = XLSX.read(fileBuffer, { type: 'buffer' });

  console.log('Sheet Names:', workbook.SheetNames);

  workbook.SheetNames.forEach(sheetName => {
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
    console.log(`\n--- Sheet: ${sheetName} ---`);
    if (data.length > 0) {
      console.log('Header Row (Row 0):', JSON.stringify(data[0]));
      console.log('Row 1:', JSON.stringify(data[1]));
      console.log('Row 2:', JSON.stringify(data[2]));
    }
  });
} catch (error) {
  console.error('Error reading file:', error);
}
