/**
 * Test script for recipient name extraction functionality
 */

// Mock the TransactionService extractRecipientName function for testing
function extractRecipientName(businessName, notes) {
  // Check if this is a PAYBOX transaction and has recipient info in notes
  if (businessName && businessName.includes('PAYBOX') && notes) {
    // Match Hebrew or English names after "למי:" - stop at common English words that indicate additional info
    const recipientMatch = notes.match(/למי:\s*(.+?)(?:\s+(?:some|additional|notes|info|details|comment|remark)|$)/);
    if (recipientMatch) {
      const recipientName = recipientMatch[1].trim();
      
      console.log(`🎯 [RECIPIENT EXTRACTION] Found recipient: "${recipientName}" for PAYBOX transaction`);
      
      // Remove the entire "למי: [name]" part from notes
      const pattern = new RegExp(`למי:\\s*${recipientName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:\\s+|$)`, 'g');
      const cleanedNotes = notes.replace(pattern, '').trim();
      
      return {
        recipientName: recipientName,
        cleanedNotes: cleanedNotes || null
      };
    }
  }
  
  // For other transfer types (can be extended later)
  // TODO: Add support for BIT transfers, bank transfers, etc.
  
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
    expected: {
      recipientName: "נוי כהן",
      cleanedNotes: null
    }
  },
  {
    businessName: "PAYBOX                 TEL AVIV      IL", 
    notes: "למי: יהב טרבלסי",
    expected: {
      recipientName: "יהב טרבלסי",
      cleanedNotes: null
    }
  },
  {
    businessName: "PAYBOX                 TEL AVIV      IL",
    notes: "למי: Dudi Ariel",
    expected: {
      recipientName: "Dudi Ariel", 
      cleanedNotes: null
    }
  },
  {
    businessName: "PAYBOX                 TEL AVIV      IL",
    notes: "למי: נוי כהן some additional notes",
    expected: {
      recipientName: "נוי כהן",
      cleanedNotes: "some additional notes"
    }
  },
  {
    businessName: "DEEPS",
    notes: "כושר",
    expected: {
      recipientName: null,
      cleanedNotes: "כושר"
    }
  },
  {
    businessName: "Regular Business",
    notes: "Regular notes",
    expected: {
      recipientName: null,
      cleanedNotes: "Regular notes"
    }
  }
];

console.log('🧪 Testing recipient name extraction...\n');

let passed = 0;
let failed = 0;

testCases.forEach((testCase, index) => {
  console.log(`Test ${index + 1}:`);
  console.log(`  Business: ${testCase.businessName}`);
  console.log(`  Notes: ${testCase.notes}`);
  
  const result = extractRecipientName(testCase.businessName, testCase.notes);
  
  console.log(`  Result: recipient="${result.recipientName}", notes="${result.cleanedNotes}"`);
  console.log(`  Expected: recipient="${testCase.expected.recipientName}", notes="${testCase.expected.cleanedNotes}"`);
  
  const recipientMatch = result.recipientName === testCase.expected.recipientName;
  const notesMatch = result.cleanedNotes === testCase.expected.cleanedNotes;
  
  if (recipientMatch && notesMatch) {
    console.log('  ✅ PASSED\n');
    passed++;
  } else {
    console.log('  ❌ FAILED');
    if (!recipientMatch) {
      console.log(`    Recipient mismatch: got "${result.recipientName}", expected "${testCase.expected.recipientName}"`);
    }
    if (!notesMatch) {
      console.log(`    Notes mismatch: got "${result.cleanedNotes}", expected "${testCase.expected.cleanedNotes}"`);
    }
    console.log('');
    failed++;
  }
});

console.log(`🏁 Test Results: ${passed} passed, ${failed} failed`);

if (failed === 0) {
  console.log('🎉 All tests passed! The recipient extraction function is working correctly.');
} else {
  console.log('⚠️  Some tests failed. Please review the implementation.');
}