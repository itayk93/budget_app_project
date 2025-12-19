
function cleanBusinessName(description) {
    if (!description) return 'עסקה ללא תיאור';

    // Copy of the logic from israeliBankScraperService.js
    return description
        .replace(/[\u200E\u200F\u202A\u202B\u202C\u202D\u202E\u061C]/g, '') // RTL marks
        .replace(/[()[\]{}]/g, '') // Brackets
        .replace(/^[‫]+|[‫]+$/g, '') // Leading/trailing Hebrew punctuation
        .replace(/\//g, ' ') // Replace slashes with spaces
        .replace(/\s+/g, ' ') // Replace multiple spaces with single space
        .trim();
}

const testCases = [
    "ג'ורדי איכילוב",
    "ג׳ורדי איכילוב", // with Hebrew Geresh
    "מקדונלד'ס",
    "קפה ג'ו",
    'חומוס אליהו"',
    "עסקה; עם נקודה פסיק"
];

console.log("STRING ANALYZER");
console.log("--------------------------------------------------");
testCases.forEach(test => {
    const cleaned = cleanBusinessName(test);
    console.log(`Original: "${test}"`);
    console.log(`Cleaned:  "${cleaned}"`);
    console.log("--------------------------------------------------");
});
