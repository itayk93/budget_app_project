// בדיקה לניקוי שמות עסקים
console.log('🧪 בדיקת ניקוי שמות עסקים');

// פונקציה לניקוי שמות עסקים - העתק מהשרת
function cleanBusinessName(description) {
    if (!description) return 'עסקה ללא תיאור';
    
    // Remove RTL marks and other formatting characters, replace slashes with spaces
    return description
        .replace(/[\u200E\u200F\u202A\u202B\u202C\u202D\u202E\u061C]/g, '')
        .replace(/[()[\]{}]/g, '')
        .replace(/^[‫]+|[‫]+$/g, '') // Remove leading/trailing Hebrew punctuation
        .replace(/\//g, ' ') // Replace slashes with spaces
        .replace(/\s+/g, ' ') // Replace multiple spaces with single space
        .trim();
}

// פונקציה לניקוי שמות עסקים - העתק מהקליינט
function cleanBusinessNames(transactions) {
    return transactions.map(txn => ({
        ...txn,
        business_name: txn.business_name ? 
            txn.business_name
                .replace(/\//g, ' ') // Replace slashes with spaces
                .replace(/\s+/g, ' ') // Replace multiple spaces with single space
                .trim() 
            : txn.business_name
    }));
}

// דוגמאות לבדיקה
const testBusinessNames = [
    'רמי לוי/סניף ירושלים',
    'תן ביס/פיצה נחלת בנימין',
    'מקדונלדס/רמת גן',
    'סופר פארם/סניף תל אביב',
    'פיצה דומינוס/קניון עופר',
    'בנק הפועלים/סניף מרכז',
    'מק/דונלדס//כפל//סלאש',
    '   עם רווחים   /  מיותרים  ',
    null,
    undefined,
    ''
];

console.log('\n📋 תוצאות בדיקת שרת:');
testBusinessNames.forEach((name, index) => {
    const cleaned = cleanBusinessName(name);
    console.log(`${index + 1}. "${name}" → "${cleaned}"`);
});

console.log('\n📋 תוצאות בדיקת קליינט:');
const testTransactions = testBusinessNames.map((name, index) => ({
    id: index + 1,
    business_name: name,
    amount: 100
}));

const cleanedTransactions = cleanBusinessNames(testTransactions);
cleanedTransactions.forEach((txn, index) => {
    console.log(`${index + 1}. "${testBusinessNames[index]}" → "${txn.business_name}"`);
});

console.log('\n✅ בדיקה הושלמה בהצלחה!');