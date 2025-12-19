require('dotenv').config();
const PerplexityService = require('../server/services/perplexityService');

async function testPerplexity() {
    const categories = [
        "אוכל בחוץ", "סופר", "דלק", "חשמל", "תקשורת",
        "פארמה", "ביגוד והנעלה", "כללי", "הוצאות משתנות"
    ];

    const testCases = [
        "דומינוס פיצה",
        "תחנת דלק פז",
        "סופר פארם",
        "חשמל זורם",
        "עסק לא מוכר בבלת"
    ];

    console.log("🧪 Testing Perplexity Categorization...");
    console.log("Categories:", categories.join(", "));
    console.log("----------------------------------------");

    for (const business of testCases) {
        console.log(`\n🔍 Checking: "${business}"`);
        const result = await PerplexityService.categorizeTransaction(business, categories);
        console.log(`👉 Result: ${result || 'NULL (Fallback will happen)'}`);
    }
}

testPerplexity();
