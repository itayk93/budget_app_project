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
                .replace(/[״""''`]/g, '') // Remove quotes and apostrophes
                .replace(/[';]/g, '') // Remove semicolons and single quotes (SQL injection prevention)
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
    'הוק פקדון EUR',
    'קניית דולר USD',
    'פקדון יורו EURO',
    'עמלת פרנק CHF',
    'בנק הפועלים/GBP תשלום',
    'מק/דונלדס//כפל//סלאש',
    '   עם רווחים   /  מיותרים  ',
    'עסק עם ״גרשיים״ ותווים מיוחדים',
    'עסק; עם נקודה פסיק',
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

// בדיקת זיהוי מטבע זר
function detectForeignCurrency(businessName) {
    if (!businessName) return null;
    
    const currencies = {
        'USD': ['USD', 'DOLLAR', 'דולר'],
        'EUR': ['EUR', 'EURO', 'יורו', 'אירו'],
        'GBP': ['GBP', 'POUND', 'פאונד'],
        'CHF': ['CHF', 'FRANC', 'פרנק'],
        'JPY': ['JPY', 'YEN', 'ין'],
        'CAD': ['CAD', 'קנדי'],
        'AUD': ['AUD', 'אוסטרלי'],
        'SEK': ['SEK', 'קרונה'],
        'NOK': ['NOK', 'נורבגי'],
        'DKK': ['DKK', 'דני']
    };
    
    const upperName = businessName.toUpperCase();
    
    for (const [currency, keywords] of Object.entries(currencies)) {
        for (const keyword of keywords) {
            if (upperName.includes(keyword.toUpperCase())) {
                return currency;
            }
        }
    }
    
    return null;
}

console.log('\n🌍 בדיקת זיהוי מטבעות זרים:');
testBusinessNames.forEach((name, index) => {
    const currency = detectForeignCurrency(name);
    if (currency) {
        console.log(`${index + 1}. "${name}" → מטבע זוהה: ${currency} 🔄`);
    } else if (name && name !== 'null' && name !== 'undefined' && name !== '') {
        console.log(`${index + 1}. "${name}" → אין מטבע זר`);
    }
});

console.log('\n✅ בדיקה הושלמה בהצלחה!');