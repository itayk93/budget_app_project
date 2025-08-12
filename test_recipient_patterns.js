// Test recipient name extraction with different patterns

function extractRecipientName(businessName, notes) {
  // Check if this is a PAYBOX transaction and has recipient info in notes
  if (businessName && businessName.includes('PAYBOX') && notes) {
    // Try multiple patterns for recipient extraction
    let recipientMatch = null;
    let pattern = null;
    let recipientName = null;
    
    // Pattern 1: "למי: [name]"
    recipientMatch = notes.match(/למי:\s*(.+?)(?:\s+(?:some|additional|notes|info|details|comment|remark)|$)/);
    if (recipientMatch) {
      recipientName = recipientMatch[1].trim();
      pattern = new RegExp(`למי:\\s*${recipientName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:\\s+|$)`, 'g');
      console.log(`🎯 Found recipient with "למי:" pattern: "${recipientName}"`);
    } else {
      // Pattern 2: "שובר ל-[name]" or "שוברים ל-[name]" or "שוברים לקניה ב-[name]"
      recipientMatch = notes.match(/שוברי?ם?\s+ל(?:קניה\s+ב)?-(.+?)(?:\s+|$)/);
      if (recipientMatch) {
        recipientName = recipientMatch[1].trim();
        pattern = new RegExp(`שוברי?ם?\\s+ל(?:קניה\\s+ב)?-${recipientName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:\\s+|$)`, 'g');
        console.log(`🎯 Found recipient with "שובר/שוברים" pattern: "${recipientName}"`);
      }
    }
    
    if (recipientName) {
      // Clean the notes by removing the recipient pattern
      const cleanedNotes = notes.replace(pattern, '').trim();
      
      return {
        recipientName: recipientName,
        cleanedNotes: cleanedNotes || null
      };
    }
  }
  
  return {
    recipientName: null,
    cleanedNotes: notes
  };
}

// Test cases
const testCases = [
  {
    businessName: "PAYBOX                 TEL AVIV      IL",
    notes: "למי: נוי כהן",
    description: "Classic למי pattern"
  },
  {
    businessName: "PAYBOX                 TEL AVIV      IL",
    notes: "שובר ל-GoodPharm",
    description: "New שובר ל- pattern"
  },
  {
    businessName: "PAYBOX                 TEL AVIV      IL", 
    notes: "שוברים לקניה ב-ace",
    description: "Buying vouchers pattern"
  },
  {
    businessName: "PAYBOX                 TEL AVIV      IL",
    notes: "תשלום רגיל",
    description: "No recipient pattern"
  }
];

console.log('🧪 Testing recipient name extraction patterns:\n');

testCases.forEach((test, index) => {
  console.log(`Test ${index + 1}: ${test.description}`);
  console.log(`Input: business="${test.businessName}", notes="${test.notes}"`);
  
  const result = extractRecipientName(test.businessName, test.notes);
  
  console.log(`Output: recipient="${result.recipientName}", cleaned_notes="${result.cleanedNotes}"`);
  console.log('---');
});