// Test script for Hebrew calendar utilities - July 2025 example

const { getMonthWeeks, getHebrewWeekNumber, groupTransactionsByWeeks, formatHebrewAmount, getJuly2025Example } = require('./client/src/utils/hebrewCalendar');

// Test July 2025 example as mentioned in requirements
console.log('=== Testing Hebrew Calendar for July 2025 ===\n');

// July 2025 example
const july2025Weeks = getJuly2025Example();
console.log('July 2025 weeks breakdown:');
july2025Weeks.forEach(week => {
  const startDay = new Date(week.startDate).toLocaleDateString('he-IL', { weekday: 'long' });
  const endDay = new Date(week.endDate).toLocaleDateString('he-IL', { weekday: 'long' });
  
  console.log(`${week.label}: ${week.startDay}-${week.endDay} יולי (${startDay} עד ${endDay})`);
});

console.log('\n=== Testing Sample Transactions ===\n');

// Sample transactions for July 2025 (like the example in the requirements)
const sampleTransactions = [
  {
    id: 1,
    transaction_date: '2025-07-01',
    amount: -255.0,
    business_name: 'מועדון ביטוח ישיר',
    customer_comment: 'שובר לקרפור'
  },
  {
    id: 2,
    transaction_date: '2025-07-02',
    amount: -28.3,
    business_name: 'ויקטורי ויצמן ת"א',
    customer_comment: null
  },
  {
    id: 3,
    transaction_date: '2025-07-06',
    amount: -472.0,
    business_name: 'אושר עד תל אביב',
    customer_comment: null
  },
  {
    id: 4,
    transaction_date: '2025-07-07',
    amount: -120.0,
    business_name: 'PAYBOX',
    customer_comment: 'שובר ל-Good Pharm'
  },
  {
    id: 5,
    transaction_date: '2025-07-10',
    amount: -86.5,
    business_name: 'גלידת פלדמן',
    customer_comment: null
  },
  {
    id: 6,
    transaction_date: '2025-07-16',
    amount: -52.8,
    business_name: 'האחים',
    customer_comment: 'שמן זית מהאחים'
  },
  {
    id: 7,
    transaction_date: '2025-07-19',
    amount: -15.0,
    business_name: 'ירק השדה מהחקלאי לצרכן בע',
    customer_comment: null
  },
  {
    id: 8,
    transaction_date: '2025-07-20',
    amount: -136.0,
    business_name: 'PAYBOX',
    customer_comment: 'שובר של GoodPharm'
  }
];

// Group transactions by weeks
const groupedTransactions = groupTransactionsByWeeks(sampleTransactions, 2025, 7);

console.log('Transactions grouped by weeks:');
Object.keys(groupedTransactions).sort((a, b) => parseInt(a) - parseInt(b)).forEach(weekNumber => {
  const week = groupedTransactions[weekNumber];
  console.log(`\n${week.label} (${week.dateRange}):`);
  console.log(`  סה"כ: ${formatHebrewAmount(week.totalAmount)}`);
  console.log(`  עסקאות (${week.transactions.length}):`);
  
  week.transactions.forEach(transaction => {
    const date = new Date(transaction.transaction_date).toLocaleDateString('he-IL');
    console.log(`    ${date}: ${formatHebrewAmount(Math.abs(transaction.amount))} - ${transaction.business_name}`);
    if (transaction.customer_comment) {
      console.log(`      הערה: ${transaction.customer_comment}`);
    }
  });
});

console.log('\n=== Summary ===');
const totalAmount = Object.values(groupedTransactions).reduce((sum, week) => sum + week.totalAmount, 0);
const totalTransactions = Object.values(groupedTransactions).reduce((sum, week) => sum + week.transactions.length, 0);
console.log(`סה"כ הוצאות ביולי 2025: ${formatHebrewAmount(totalAmount)}`);
console.log(`סה"כ עסקאות: ${totalTransactions}`);
console.log(`ממוצע עסקה: ${formatHebrewAmount(totalAmount / totalTransactions)}`);

console.log('\n=== Week Number Tests ===');
// Test specific dates
const testDates = [
  new Date(2025, 6, 1),  // July 1st - Tuesday
  new Date(2025, 6, 6),  // July 6th - Sunday  
  new Date(2025, 6, 15), // July 15th - Tuesday
  new Date(2025, 6, 31)  // July 31st - Thursday
];

testDates.forEach(date => {
  const weekNumber = getHebrewWeekNumber(date, 2025, 7);
  const dayName = date.toLocaleDateString('he-IL', { weekday: 'long' });
  console.log(`${date.getDate()} יולי (${dayName}): שבוע ${weekNumber}`);
});

module.exports = { july2025Weeks, groupedTransactions, sampleTransactions };