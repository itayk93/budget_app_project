// Demo data generator for BudgetLens
export const generateDemoData = () => {
  return new Promise((resolve) => {
    // Simulate async data loading
    setTimeout(() => {
      const demoData = {
        totalBalance: 35420,
        monthlyExpenses: 8950,
        monthlyIncome: 12500,
        
        categories: [
          {
            id: 'demo-cat-001',
            name: 'מזון וקניות',
            color: '#FF6B6B',
            budget: 3000,
            spent: 2750,
            transactions_count: 28,
            percentage: 91.7,
            icon: '🛒'
          },
          {
            id: 'demo-cat-002',
            name: 'תחבורה',
            color: '#4ECDC4',
            budget: 1200,
            spent: 980,
            transactions_count: 15,
            percentage: 81.7,
            icon: '🚗'
          },
          {
            id: 'demo-cat-003',
            name: 'בילויים',
            color: '#45B7D1',
            budget: 1500,
            spent: 1820,
            transactions_count: 12,
            percentage: 121.3,
            icon: '🎉'
          },
          {
            id: 'demo-cat-004',
            name: 'חשבונות',
            color: '#F7DC6F',
            budget: 2500,
            spent: 2100,
            transactions_count: 8,
            percentage: 84.0,
            icon: '🏠'
          },
          {
            id: 'demo-cat-005',
            name: 'בריאות',
            color: '#BB8FCE',
            budget: 800,
            spent: 450,
            transactions_count: 5,
            percentage: 56.3,
            icon: '🏥'
          },
          {
            id: 'demo-cat-006',
            name: 'שונות',
            color: '#85C1E9',
            budget: 1000,
            spent: 850,
            transactions_count: 11,
            percentage: 85.0,
            icon: '📦'
          }
        ],

        transactions: [
          {
            id: 'demo-tx-001',
            description: 'שופרסל - קניות שבועיות',
            business_name: 'שופרסל - קניות שבועיות',
            amount: -487.50,
            date: '2025-09-06',
            payment_date: '2025-09-06',
            category_id: 'demo-cat-001',
            category_name: 'מזון וקניות',
            account: 'אשראי הפועלים',
            is_expense: true,
            flow_month: '2025-09'
          },
          {
            id: 'demo-tx-002',
            description: 'משכורת',
            business_name: 'משכורת',
            amount: 12500,
            date: '2025-09-01',
            payment_date: '2025-09-01',
            category_id: null,
            category_name: 'הכנסות',
            account: 'עו"ש בנק לאומי',
            is_expense: false,
            flow_month: '2025-09'
          },
          {
            id: 'demo-tx-003',
            description: 'דלק דור אלון - תדלוק',
            business_name: 'דלק דור אלון - תדלוק',
            amount: -280,
            date: '2025-09-05',
            payment_date: '2025-09-05',
            category_id: 'demo-cat-002',
            category_name: 'תחבורה',
            account: 'אשראי הפועלים',
            is_expense: true,
            flow_month: '2025-09'
          },
          {
            id: 'demo-tx-004',
            description: 'נטפליקס - מנוי חודשי',
            business_name: 'נטפליקס - מנוי חודשי',
            amount: -49.90,
            date: '2025-09-04',
            payment_date: '2025-09-04',
            category_id: 'demo-cat-003',
            category_name: 'בילויים',
            account: 'אשראי הפועלים',
            is_expense: true,
            flow_month: '2025-09'
          },
          {
            id: 'demo-tx-005',
            description: 'חברת החשמל',
            business_name: 'חברת החשמל',
            amount: -520,
            date: '2025-09-03',
            payment_date: '2025-09-03',
            category_id: 'demo-cat-004',
            category_name: 'חשבונות',
            account: 'עו"ש בנק לאומי',
            is_expense: true,
            flow_month: '2025-09'
          },
          {
            id: 'demo-tx-006',
            description: 'ביט - הוראת קבע ביטוח',
            business_name: 'ביט - הוראת קבע ביטוח',
            amount: -450,
            date: '2025-09-02',
            payment_date: '2025-09-02',
            category_id: 'demo-cat-005',
            category_name: 'בריאות',
            account: 'עו"ש בנק לאומי',
            is_expense: true,
            flow_month: '2025-09'
          },
          {
            id: 'demo-tx-007',
            description: 'קפה נוח - ארוחת בוקר',
            business_name: 'קפה נוח - ארוחת בוקר',
            amount: -32,
            date: '2025-09-06',
            payment_date: '2025-09-06',
            category_id: 'demo-cat-001',
            category_name: 'מזון וקניות',
            account: 'אשראי הפועלים',
            is_expense: true,
            flow_month: '2025-09'
          },
          {
            id: 'demo-tx-008',
            description: 'וולט - משלוח אוכל',
            business_name: 'וולט - משלוח אוכל',
            amount: -89,
            date: '2025-09-05',
            payment_date: '2025-09-05',
            category_id: 'demo-cat-001',
            category_name: 'מזון וקניות',
            account: 'אשראי הפועלים',
            is_expense: true,
            flow_month: '2025-09'
          },
          {
            id: 'demo-tx-009',
            description: 'רכבת ישראל',
            business_name: 'רכבת ישראל',
            amount: -28.50,
            date: '2025-09-04',
            payment_date: '2025-09-04',
            category_id: 'demo-cat-002',
            category_name: 'תחבורה',
            account: 'כרטיס רב קו',
            is_expense: true,
            flow_month: '2025-09'
          },
          {
            id: 'demo-tx-010',
            description: 'מכבי פארם - תרופות',
            business_name: 'מכבי פארם - תרופות',
            amount: -125,
            date: '2025-09-03',
            payment_date: '2025-09-03',
            category_id: 'demo-cat-005',
            category_name: 'בריאות',
            account: 'אשראי הפועלים',
            is_expense: true,
            flow_month: '2025-09'
          },
          {
            id: 'demo-tx-011',
            description: 'מקס סטוק - קניות',
            business_name: 'מקס סטוק - קניות',
            amount: -350,
            date: '2025-09-02',
            payment_date: '2025-09-02',
            category_id: 'demo-cat-001',
            category_name: 'מזון וקניות',
            account: 'אשראי הפועלים',
            is_expense: true,
            flow_month: '2025-09'
          },
          {
            id: 'demo-tx-012',
            description: 'סלקום - חשבון טלפון',
            business_name: 'סלקום - חשבון טלפון',
            amount: -89,
            date: '2025-09-01',
            payment_date: '2025-09-01',
            category_id: 'demo-cat-004',
            category_name: 'חשבונות',
            account: 'עו"ש בנק לאומי',
            is_expense: true,
            flow_month: '2025-09'
          },
          {
            id: 'demo-tx-013',
            description: 'טרמינל X - ערב עם חברים',
            business_name: 'טרמינל X - ערב עם חברים',
            amount: -180,
            date: '2025-08-31',
            payment_date: '2025-08-31',
            category_id: 'demo-cat-003',
            category_name: 'בילויים',
            account: 'אשראי הפועלים',
            is_expense: true,
            flow_month: '2025-08'
          },
          {
            id: 'demo-tx-014',
            description: 'ויקטורי - קניות ביגוד',
            business_name: 'ויקטורי - קניות ביגוד',
            amount: -420,
            date: '2025-08-30',
            payment_date: '2025-08-30',
            category_id: 'demo-cat-006',
            category_name: 'שונות',
            account: 'אשראי הפועלים',
            is_expense: true,
            flow_month: '2025-08'
          },
          {
            id: 'demo-tx-015',
            description: 'פיצה האט - משלוח',
            business_name: 'פיצה האט - משלוח',
            amount: -95,
            date: '2025-08-29',
            payment_date: '2025-08-29',
            category_id: 'demo-cat-001',
            category_name: 'מזון וקניות',
            account: 'אשראי הפועלים',
            is_expense: true,
            flow_month: '2025-08'
          }
        ],

        chartData: [
          {
            month: '2025-05',
            income: 12000,
            expenses: 8500,
            balance: 3500
          },
          {
            month: '2025-06',
            income: 12300,
            expenses: 9200,
            balance: 3100
          },
          {
            month: '2025-07',
            income: 12500,
            expenses: 8900,
            balance: 3600
          },
          {
            month: '2025-08',
            income: 12500,
            expenses: 9800,
            balance: 2700
          },
          {
            month: '2025-09',
            income: 12500,
            expenses: 8950,
            balance: 3550
          }
        ],

        accounts: [
          {
            id: 'demo-acc-001',
            name: 'עו"ש בנק לאומי',
            balance: 15420,
            type: 'checking',
            is_active: true
          },
          {
            id: 'demo-acc-002',
            name: 'אשראי הפועלים',
            balance: -5200,
            type: 'credit',
            is_active: true
          },
          {
            id: 'demo-acc-003',
            name: 'חסכון מקדש',
            balance: 25200,
            type: 'savings',
            is_active: true
          }
        ],

        notifications: [
          {
            id: 'demo-notif-001',
            message: 'חרגת מתקציב הבילויים החודשי ב-21%',
            type: 'warning',
            date: '2025-09-06'
          },
          {
            id: 'demo-notif-002',
            message: 'זוהתה עסקה חדשה: שופרסל ₪487.50',
            type: 'info',
            date: '2025-09-06'
          },
          {
            id: 'demo-notif-003',
            message: 'יתרת החשבון שלך ירדה מתחת ל-₪1000',
            type: 'alert',
            date: '2025-09-05'
          }
        ],

        monthlyStats: {
          currentMonth: {
            income: 12500,
            expenses: 8950,
            balance: 3550,
            transactionCount: 42
          },
          lastMonth: {
            income: 12500,
            expenses: 9800,
            balance: 2700,
            transactionCount: 48
          },
          percentageChange: {
            expenses: -8.7,
            balance: 31.5,
            transactions: -12.5
          }
        }
      };

      resolve(demoData);
    }, 1000); // Simulate loading time
  });
};