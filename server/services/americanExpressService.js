const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');

class AmericanExpressService {
  static async parseAmericanExpressExcel(filePath, outputPath = null) {
    try {
      console.log('📄 Starting American Express Excel parsing...');
      
      // Step 1: Read the entire file without a header to find the header row
      const workbook = XLSX.readFile(filePath);
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      
      // Convert to JSON to find header row
      const tempData = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false });
      
      // Find the row index that contains the expected header 'תאריך רכישה'
      let headerRowIndex = -1;
      for (let i = 0; i < tempData.length; i++) {
        if (tempData[i] && tempData[i].some(cell => cell && cell.includes('תאריך רכישה'))) {
          headerRowIndex = i;
          break;
        }
      }
      
      if (headerRowIndex === -1) {
        throw new Error('Header row not found. Please check if the file format is correct.');
      }
      
      console.log(`📍 Found header row at index: ${headerRowIndex}`);
      
      // Step 2: Read the file again with the correct header row
      const range = XLSX.utils.decode_range(sheet['!ref']);
      range.s.r = headerRowIndex; // Start from header row
      const newRef = XLSX.utils.encode_range(range);
      
      // Create a new sheet with the adjusted range
      const adjustedSheet = {};
      for (let R = range.s.r; R <= range.e.r; ++R) {
        for (let C = range.s.c; C <= range.e.c; ++C) {
          const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });
          const adjustedAddress = XLSX.utils.encode_cell({ r: R - headerRowIndex, c: C });
          if (sheet[cellAddress]) {
            adjustedSheet[adjustedAddress] = sheet[cellAddress];
          }
        }
      }
      adjustedSheet['!ref'] = XLSX.utils.encode_range({
        s: { r: 0, c: range.s.c },
        e: { r: range.e.r - headerRowIndex, c: range.e.c }
      });
      
      // Convert to JSON with proper headers
      let data = XLSX.utils.sheet_to_json(adjustedSheet, { raw: false });
      
      // Drop summary rows, header rows, and empty rows
      const originalCount = data.length;
      data = data.filter((row, index) => {
        const businessName = row['שם בית עסק'];
        const amount = row['סכום עסקה'] || row['סכום חיוב'];
        const currency = row['מטבע עסקה'] || row['מטבע חיוב'];
        
        // Skip if business name is empty or contains summary text
        if (!businessName || businessName.trim() === '' || businessName.includes('סה"כ')) {
          return false;
        }
        
        // Skip header rows (where business name is actually a column header)
        if (businessName === 'שם בית עסק' || businessName.includes('שם בית') || businessName.includes('עסק')) {
          return false;
        }
        
        // Skip rows where amount is not a valid number or is zero
        const cleanAmount = String(amount || '').replace(/[₪,\s]/g, '').trim();
        const numericAmount = parseFloat(cleanAmount);
        if (isNaN(numericAmount) || numericAmount === 0) {
          return false;
        }
        
        // Skip rows where currency is actually a header
        if (currency === 'מטבע עסקה' || currency === 'מטבע חיוב' || currency === 'מטבע') {
          return false;
        }
        
        return true;
      });
      
      console.log(`📊 Filtered from ${originalCount} to ${data.length} valid transactions`);
      
      console.log(`📊 Processing ${data.length} transactions`);
      
      // Transform the data
      const transformedData = data.map(row => {
        // Parse date
        let paymentDate;
        try {
          const dateStr = row['תאריך רכישה'];
          if (dateStr) {
            // Handle DD.MM.YY format
            const dateParts = dateStr.toString().split('.');
            if (dateParts.length >= 3) {
              const [day, month, year] = dateParts;
              const fullYear = year.length === 2 ? `20${year}` : year;
              paymentDate = new Date(fullYear, month - 1, day);
            } else {
              paymentDate = new Date();
            }
          } else {
            paymentDate = new Date();
          }
        } catch (error) {
          console.warn('Date parsing error:', error);
          paymentDate = new Date();
        }
        
        // Clean and convert amount - use the correct column name
        let amount = row['סכום עסקה'] || row['סכום חיוב'];
        if (typeof amount === 'string') {
          amount = amount.replace('₪', '').trim();
        }
        amount = parseFloat(amount) || 0;
        
        // Make negative for expenses (only if positive)
        if (amount > 0) {
          amount = -amount;
        }
        
        // Handle currency - use the correct column name
        let currency = row['מטבע עסקה'] || row['מטבע חיוב'];
        if (currency === '₪') {
          currency = 'ILS';
        }
        
        // Extract payment identifier from file name
        let paymentIdentifier = null;
        const fileName = path.basename(filePath);
        const match = fileName.match(/(\d{4})/);
        if (match) {
          paymentIdentifier = match[1];
        }
        
        const now = new Date().toISOString();
        
        return {
          id: null,
          user_id: null,
          business_name: row['שם בית עסק'] || '',
          payment_date: paymentDate.toISOString().split('T')[0],
          amount: amount.toString(),
          currency: currency || 'ILS',
          payment_method: 'americanexpress',
          payment_identifier: paymentIdentifier,
          category_id: null,
          payment_month: paymentDate.getMonth() + 1,
          payment_year: paymentDate.getFullYear(),
          flow_month: `${paymentDate.getFullYear()}-${String(paymentDate.getMonth() + 1).padStart(2, '0')}`,
          charge_date: null,
          notes: row['פירוט נוסף'] || null,
          excluded_from_flow: false,
          source_type: 'creditCard',
          original_amount: null,
          transaction_hash: null,
          created_at: now,
          updated_at: now,
          cash_flow_id: null,
          is_transfer: false,
          linked_transaction_id: null,
          category_name: null,
          payment_number: 1,
          total_payments: 1,
          original_currency: row['מטבע עסקה'] || null,
          exchange_rate: null,
          exchange_date: null,
          business_country: null,
          quantity: null,
          source_category: null,
          transaction_type: null,
          execution_method: null
        };
      });
      
      console.log(`✅ Successfully transformed ${transformedData.length} transactions`);
      
      // If output path is specified, save to Excel
      if (outputPath) {
        const newWorkbook = XLSX.utils.book_new();
        const newSheet = XLSX.utils.json_to_sheet(transformedData);
        XLSX.utils.book_append_sheet(newWorkbook, newSheet, 'Transactions');
        XLSX.writeFile(newWorkbook, outputPath);
        console.log(`📄 Saved transformed data to: ${outputPath}`);
      }
      
      return {
        success: true,
        data: transformedData,
        message: `Successfully parsed ${transformedData.length} American Express transactions`,
        fileFormat: 'American Express Excel'
      };
      
    } catch (error) {
      console.error('❌ Error parsing American Express Excel:', error);
      return {
        success: false,
        error: error.message,
        data: []
      };
    }
  }
  
  // Validate if file looks like American Express format
  static async validateAmericanExpressFormat(filePath) {
    try {
      const workbook = XLSX.readFile(filePath);
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false });
      
      // Look for American Express specific headers (flexible)
      const amexHeaders = ['תאריך רכישה', 'שם בית עסק', 'סכום עסקה', 'מטבע עסקה', 'סכום חיוב', 'מטבע חיוב'];
      let headerFound = false;
      
      for (let i = 0; i < Math.min(20, data.length); i++) {
        if (data[i] && data[i].some(cell => 
          cell && amexHeaders.some(header => String(cell).includes(header))
        )) {
          headerFound = true;
          break;
        }
      }
      
      return headerFound;
    } catch (error) {
      console.error('Error validating American Express format:', error);
      return false;
    }
  }
}

module.exports = AmericanExpressService;