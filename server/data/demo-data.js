/**
 * Demo Data for BudgetLens Dashboard
 * Based on real categories from category_order_backup.json
 * Contains 6 months of realistic transaction data
 */

const moment = require('moment');

// Demo user data
const demoUser = {
  id: "demo-user-id",
  firstName: "דנה",
  lastName: "דוגמה", 
  email: "demo@budgetlens.com",
  currency: "ILS"
};

// Demo cash flow
const demoCashFlow = {
  id: "demo-cash-flow-id",
  name: "תזרים אישי - דוגמה",
  currency: "ILS",
  is_default: true,
  is_monthly: true,
  user_id: "demo-user-id"
};

// Categories based on real data from category_order_backup.json
const demoCategories = [
  // 🍽️ מזון ושתייה
  {
    id: "demo-cat-1",
    category_name: "סופר",
    shared_category: null,
    weekly_display: true,
    monthly_target: 1500,
    display_order: 0,
    use_shared_target: false,
    icon: "🛒"
  },
  {
    id: "demo-cat-2",
    category_name: "אוכל בחוץ",
    shared_category: null,
    weekly_display: false,
    monthly_target: 1000,
    display_order: 10,
    use_shared_target: false,
    icon: "🍽️"
  },
  {
    id: "demo-cat-3",
    category_name: "בתי קפה",
    shared_category: null,
    weekly_display: false,
    monthly_target: 400,
    display_order: 5,
    use_shared_target: false,
    icon: "☕"
  },
  {
    id: "demo-cat-4",
    category_name: "קפסולות נספרסו",
    shared_category: null,
    weekly_display: false,
    monthly_target: 100,
    display_order: 6,
    use_shared_target: false,
    icon: "☕"
  },
  {
    id: "demo-cat-5",
    category_name: "יין",
    shared_category: null,
    weekly_display: false,
    monthly_target: 300,
    display_order: 7,
    use_shared_target: false,
    icon: "🍷"
  },

  // 🚗 תחבורה ותנועה
  {
    id: "demo-cat-6",
    category_name: "רכב ותחבורה ציבורית",
    shared_category: null,
    weekly_display: false,
    monthly_target: 1000,
    display_order: 1,
    use_shared_target: false,
    icon: "🚗"
  },
  {
    id: "demo-cat-7",
    category_name: "טיסות לחו״ל",
    shared_category: null,
    weekly_display: false,
    monthly_target: null,
    display_order: 3,
    use_shared_target: false,
    icon: "✈️"
  },

  // 🎯 פנאי והשקעה אישית
  {
    id: "demo-cat-8",
    category_name: "פנאי ובילויים",
    shared_category: null,
    weekly_display: false,
    monthly_target: 800,
    display_order: 4,
    use_shared_target: false,
    icon: "🎬"
  },
  {
    id: "demo-cat-9",
    category_name: "חדר כושר",
    shared_category: "הוצאות קבועות",
    weekly_display: false,
    monthly_target: 250,
    display_order: 33,
    use_shared_target: true,
    icon: "💪"
  },
  {
    id: "demo-cat-10",
    category_name: "שיעורי איטלקית",
    shared_category: null,
    weekly_display: false,
    monthly_target: 400,
    display_order: 12,
    use_shared_target: false,
    icon: "📚"
  },

  // 🏠 הוצאות קבועות (קבוצה משותפת)
  {
    id: "demo-cat-11",
    category_name: "דיור",
    shared_category: "הוצאות קבועות",
    weekly_display: false,
    monthly_target: 4500,
    display_order: 31,
    use_shared_target: true,
    icon: "🏠"
  },
  {
    id: "demo-cat-12",
    category_name: "חשמל",
    shared_category: "הוצאות קבועות",
    weekly_display: false,
    monthly_target: 200,
    display_order: 20,
    use_shared_target: true,
    icon: "⚡"
  },
  {
    id: "demo-cat-13",
    category_name: "גז",
    shared_category: "הוצאות קבועות",
    weekly_display: false,
    monthly_target: 80,
    display_order: 29,
    use_shared_target: true,
    icon: "🔥"
  },
  {
    id: "demo-cat-14",
    category_name: "דיגיטל",
    shared_category: "הוצאות קבועות",
    weekly_display: false,
    monthly_target: 100,
    display_order: 30,
    use_shared_target: true,
    icon: "📱"
  },
  {
    id: "demo-cat-15",
    category_name: "תקשורת",
    shared_category: "הוצאות קבועות",
    weekly_display: false,
    monthly_target: 130,
    display_order: 36,
    use_shared_target: true,
    icon: "📞"
  },

  // 📈 הכנסות (קבוצה משותפת)
  {
    id: "demo-cat-16",
    category_name: "הכנסות קבועות",
    shared_category: "הכנסות",
    weekly_display: false,
    monthly_target: null,
    display_order: 39,
    use_shared_target: true,
    icon: "💰"
  },
  {
    id: "demo-cat-17",
    category_name: "הכנסות משתנות",
    shared_category: "הכנסות",
    weekly_display: false,
    monthly_target: null,
    display_order: 41,
    use_shared_target: true,
    icon: "💼"
  },

  // 💰 חיסכון (קבוצה משותפת)
  {
    id: "demo-cat-18",
    category_name: "חסכון קבוע",
    shared_category: "הפקדות לחיסכון",
    weekly_display: false,
    monthly_target: 2500,
    display_order: 27,
    use_shared_target: true,
    icon: "🏦"
  },

  // 💎 קטגוריות מיוחדות
  {
    id: "demo-cat-19",
    category_name: "ביגוד והנעלה",
    shared_category: null,
    weekly_display: false,
    monthly_target: 500,
    display_order: 15,
    use_shared_target: false,
    icon: "👕"
  },
  {
    id: "demo-cat-20",
    category_name: "ביטוח",
    shared_category: null,
    weekly_display: false,
    monthly_target: 500,
    display_order: 16,
    use_shared_target: false,
    icon: "🛡️"
  }
];

// Generate realistic transactions for a given month
const generateTransactionsForMonth = (monthYear, categories) => {
  const transactions = [];
  const [year, month] = monthYear.split('-').map(Number);
  const daysInMonth = moment(`${year}-${month}`, 'YYYY-MM').daysInMonth();
  
  categories.forEach(category => {
    const categoryTransactions = generateCategoryTransactions(
      category, 
      year, 
      month, 
      daysInMonth
    );
    transactions.push(...categoryTransactions);
  });

  // Sort by date
  return transactions.sort((a, b) => new Date(a.date) - new Date(b.date));
};

// Generate transactions for a specific category
const generateCategoryTransactions = (category, year, month, daysInMonth) => {
  const transactions = [];
  const target = category.monthly_target;
  
  // Income categories
  if (category.shared_category === "הכנסות") {
    if (category.category_name === "הכנסות קבועות") {
      // Salary on 1st of month
      transactions.push({
        id: `demo-trans-${category.id}-${month}-salary`,
        date: `${year}-${month.toString().padStart(2, '0')}-01`,
        amount: 16500 + (Math.random() * 2000 - 1000), // 15,500-17,500
        description: "משכורת חודשית",
        category_name: category.category_name,
        cash_flow_id: "demo-cash-flow-id"
      });
    } else if (category.category_name === "הכנסות משתנות") {
      // 1-2 freelance payments per month
      const numPayments = Math.floor(Math.random() * 2) + 1;
      for (let i = 0; i < numPayments; i++) {
        const day = Math.floor(Math.random() * daysInMonth) + 1;
        transactions.push({
          id: `demo-trans-${category.id}-${month}-${i}`,
          date: `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`,
          amount: 1500 + (Math.random() * 2000), // 1,500-3,500
          description: i === 0 ? "פרילנס - עיצוב אתר" : "ייעוץ טכנולוגי",
          category_name: category.category_name,
          cash_flow_id: "demo-cash-flow-id"
        });
      }
    }
    return transactions;
  }

  // Expense categories
  if (!target) return transactions; // Skip categories without targets

  let remainingAmount = target;
  const baseAmount = target * 0.8; // 80% of target as base
  const variance = target * 0.4; // 40% variance
  
  // Different transaction patterns based on category
  let transactionPattern;
  if (category.weekly_display || category.category_name === "סופר") {
    transactionPattern = { frequency: 'weekly', count: 4 };
  } else if (category.shared_category === "הוצאות קבועות") {
    transactionPattern = { frequency: 'monthly', count: 1 };
  } else if (category.category_name.includes("קפה") || category.category_name.includes("פנאי")) {
    transactionPattern = { frequency: 'frequent', count: 8 + Math.floor(Math.random() * 10) };
  } else {
    transactionPattern = { frequency: 'regular', count: 3 + Math.floor(Math.random() * 5) };
  }

  const { count } = transactionPattern;
  
  for (let i = 0; i < count && remainingAmount > 0; i++) {
    let day;
    if (transactionPattern.frequency === 'monthly') {
      day = 1 + Math.floor(Math.random() * 5); // First few days
    } else if (transactionPattern.frequency === 'weekly') {
      day = (i * 7) + Math.floor(Math.random() * 3) + 1;
    } else {
      day = Math.floor(Math.random() * daysInMonth) + 1;
    }
    
    const isLastTransaction = i === count - 1;
    let amount = isLastTransaction ? 
      remainingAmount : 
      (baseAmount / count) + (Math.random() * variance - variance/2);
    
    amount = Math.max(amount, 10); // Minimum 10 ILS
    amount = Math.min(amount, remainingAmount); // Don't exceed remaining
    
    remainingAmount -= amount;
    
    transactions.push({
      id: `demo-trans-${category.id}-${month}-${i}`,
      date: `${year}-${month.toString().padStart(2, '0')}-${Math.min(day, daysInMonth).toString().padStart(2, '0')}`,
      amount: -Math.round(amount), // Negative for expenses
      description: generateTransactionDescription(category.category_name, i),
      category_name: category.category_name,
      cash_flow_id: "demo-cash-flow-id"
    });
  }

  return transactions;
};

// Generate realistic transaction descriptions
const generateTransactionDescription = (categoryName, index) => {
  const descriptions = {
    "סופר": ["רמי לוי השכל", "שופרסל", "מגה בעיר", "חצי חינם", "יוחננוף", "ויקטורי"],
    "אוכל בחוץ": ["מקדונלדס", "בורגר בר", "פיצה האט", "ברביס", "מסעדת הדג", "טאבון"],
    "בתי קפה": ["קפה גרג", "ארקפה", "קפה ג'ו", "נירו קפה", "לנדוור", "אלנבי 40"],
    "רכב ותחבורה ציבורית": ["תדלוק דלק", "חניה בעיר", "רב קו", "מוניות", "גט טקסי", "תחזוקת רכב"],
    "דיור": ["שכר דירה", "ועד בית", "ארנונה"],
    "חשמל": ["חברת חשמל"],
    "גז": ["אמגז", "סופרגז"],
    "דיגיטל": ["נטפליקס", "ספוטיפיי", "יוטיוב פרימיום", "אייקלאוד"],
    "תקשורת": ["סלקום", "פרטנר", "בזק בינלאומי"],
    "חדר כושר": ["הולמס פלייס", "פיטנס טיים"],
    "שיעורי איטלקית": ["שיעור פרטי איטלקית"],
    "פנאי ובילויים": ["סינמה סיטי", "הופעה", "תיאטרון", "בר", "מוזיאון"],
    "ביגוד והנעלה": ["זארה", "H&M", "קסטרו", "גולף", "נייקי"],
    "ביטוח": ["הפניקס", "מגדל", "כלל ביטוח"],
    "חסכון קבוע": ["העברה לחיסכון"]
  };

  const categoryDescriptions = descriptions[categoryName] || [categoryName];
  const randomDescription = categoryDescriptions[index % categoryDescriptions.length];
  
  return randomDescription;
};

// Generate 6 months of data (January 2025 to June 2025)
const generateDemoData = () => {
  const months = ['2025-01', '2025-02', '2025-03', '2025-04', '2025-05', '2025-06'];
  const transactionsByMonth = {};
  const monthlyStats = [];

  months.forEach(monthYear => {
    const transactions = generateTransactionsForMonth(monthYear, demoCategories);
    transactionsByMonth[monthYear] = transactions;

    // Calculate monthly statistics
    const income = transactions
      .filter(t => t.amount > 0)
      .reduce((sum, t) => sum + t.amount, 0);
    
    const expenses = Math.abs(transactions
      .filter(t => t.amount < 0)
      .reduce((sum, t) => sum + t.amount, 0));

    monthlyStats.push({
      month: monthYear,
      total_income: Math.round(income),
      total_expenses: Math.round(expenses),
      net_balance: Math.round(income - expenses),
      transaction_count: transactions.length
    });
  });

  return {
    user: demoUser,
    cashFlows: [demoCashFlow],
    categories: demoCategories,
    transactions: transactionsByMonth,
    monthlyStats
  };
};

// Export the demo data
module.exports = {
  demoData: generateDemoData(),
  generateTransactionsForMonth,
  generateCategoryTransactions,
  demoUser,
  demoCashFlow,
  demoCategories
};