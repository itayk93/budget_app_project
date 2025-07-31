// Hebrew calendar utilities for weekly breakdown
// Israeli calendar starts weeks on Sunday and ends on Saturday

/**
 * Gets the week number for a given date in a specific month (Hebrew calendar)
 * @param {Date} date - The date to get week number for
 * @param {number} year - The year
 * @param {number} month - The month (1-12)
 * @returns {number} Week number within the month (1-6)
 */
const getHebrewWeekNumber = (date, year, month) => {
  // Create date object for the first day of the month
  const firstOfMonth = new Date(year, month - 1, 1);
  
  // Get the day of week for the first day (0 = Sunday, 6 = Saturday)
  const firstDayOfWeek = firstOfMonth.getDay();
  
  // Get the day of the month for the given date
  const dayOfMonth = date.getDate();
  
  // Calculate which week this day falls into
  // Week 1 starts from the first day of the month, regardless of which day of week it is
  const weekNumber = Math.ceil((dayOfMonth + firstDayOfWeek) / 7);
  
  return weekNumber;
};

/**
 * Gets all weeks in a given month with their date ranges
 * @param {number} year - The year
 * @param {number} month - The month (1-12)
 * @returns {Array} Array of week objects with start and end dates
 */
const getMonthWeeks = (year, month) => {
  const weeks = [];
  const firstOfMonth = new Date(year, month - 1, 1);
  const lastOfMonth = new Date(year, month, 0); // Last day of the month
  
  const firstDayOfWeek = firstOfMonth.getDay();
  const daysInMonth = lastOfMonth.getDate();
  
  let currentWeek = 1;
  let weekStartDay = 1;
  
  while (weekStartDay <= daysInMonth) {
    // Calculate the end of the current week
    let weekEndDay;
    
    if (currentWeek === 1) {
      // First week: ends on the first Saturday of the month
      const daysUntilSaturday = (6 - firstDayOfWeek + 7) % 7;
      weekEndDay = Math.min(weekStartDay + daysUntilSaturday, daysInMonth);
    } else {
      // Other weeks: 7 days from start, or end of month
      weekEndDay = Math.min(weekStartDay + 6, daysInMonth);
    }
    
    const weekStart = new Date(year, month - 1, weekStartDay);
    const weekEnd = new Date(year, month - 1, weekEndDay);
    
    weeks.push({
      weekNumber: currentWeek,
      startDate: weekStart,
      endDate: weekEnd,
      startDay: weekStartDay,
      endDay: weekEndDay,
      label: `שבוע ${currentWeek}`,
      dateRange: `${weekStartDay}-${weekEndDay} ${getHebrewMonthName(month)} ${year}`
    });
    
    // Move to next week
    weekStartDay = weekEndDay + 1;
    currentWeek++;
  }
  
  return weeks;
};

/**
 * Groups transactions by Hebrew calendar weeks
 * @param {Array} transactions - Array of transaction objects
 * @param {number} year - The year
 * @param {number} month - The month (1-12)
 * @returns {Object} Object with week numbers as keys and arrays of transactions as values
 */
const groupTransactionsByWeeks = (transactions, year, month) => {
  const weeks = getMonthWeeks(year, month);
  const groupedTransactions = {};
  
  // Initialize empty arrays for each week
  weeks.forEach(week => {
    groupedTransactions[week.weekNumber] = {
      ...week,
      transactions: [],
      totalAmount: 0
    };
  });
  
  // Group transactions by week
  transactions.forEach(transaction => {
    const transactionDate = new Date(transaction.transaction_date || transaction.payment_date);
    
    // Only process transactions from the specified month and year
    if (transactionDate.getFullYear() === year && transactionDate.getMonth() === month - 1) {
      const weekNumber = getHebrewWeekNumber(transactionDate, year, month);
      
      if (groupedTransactions[weekNumber]) {
        groupedTransactions[weekNumber].transactions.push(transaction);
        
        // Calculate total amount (convert to number if it's a string)
        const amount = parseFloat(transaction.amount) || 0;
        groupedTransactions[weekNumber].totalAmount += Math.abs(amount);
      }
    }
  });
  
  return groupedTransactions;
};

/**
 * Gets Hebrew month name
 * @param {number} month - Month number (1-12)
 * @returns {string} Hebrew month name
 */
const getHebrewMonthName = (month) => {
  const hebrewMonths = {
    1: 'ינואר',
    2: 'פברואר', 
    3: 'מרץ',
    4: 'אפריל',
    5: 'מאי',
    6: 'יוני',
    7: 'יולי',
    8: 'אוגוסט',
    9: 'ספטמבר',
    10: 'אוקטובר',
    11: 'נובמבר',
    12: 'דצמבר'
  };
  
  return hebrewMonths[month] || '';
};

/**
 * Formats amount for display in Hebrew locale
 * @param {number} amount - The amount to format
 * @returns {string} Formatted amount string
 */
const formatHebrewAmount = (amount) => {
  const absAmount = Math.abs(amount);
  return new Intl.NumberFormat('he-IL', {
    style: 'currency',
    currency: 'ILS',
    minimumFractionDigits: 1,
    maximumFractionDigits: 1
  }).format(absAmount).replace('₪', '').trim() + ' ₪';
};

/**
 * Example usage for July 2025 (as mentioned in the requirements)
 * July 2025 starts on Tuesday (1st) and has 31 days
 * Week 1: 1-5 July (Tuesday-Saturday) - 5 days
 * Week 2: 6-12 July (Sunday-Saturday) - 7 days  
 * Week 3: 13-19 July (Sunday-Saturday) - 7 days
 * Week 4: 20-26 July (Sunday-Saturday) - 7 days
 * Week 5: 27-31 July (Sunday-Thursday) - 5 days
 */
const getJuly2025Example = () => {
  return getMonthWeeks(2025, 7);
};

// Export all functions
export {
  getHebrewWeekNumber,
  getMonthWeeks,
  groupTransactionsByWeeks,
  getHebrewMonthName,
  formatHebrewAmount,
  getJuly2025Example
};