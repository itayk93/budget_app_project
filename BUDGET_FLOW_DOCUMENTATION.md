# תיעוד תזרים האפליקציה - Budget App Flow Documentation

## סקירה כללית

אפליקציה לניהול תקציב אישי ומעקב אחר הוצאות והכנסות. האפליקציה מנהלת קטגוריות, עסקאות, יעדים חודשיים, ותצוגות שבועיות/חודשיות.

---

## 1. תזרים הנתונים - Data Flow

### 1.1 זרימת הנתונים מהדאטהבייס למסך

```
┌─────────────────┐
│   Database      │
│  (Supabase)     │
└────────┬────────┘
         │
         ├─── categories (from category_order table)
         ├─── transactions (from transactions table)
         ├─── monthly_goals (from monthly_goals table)
         └─── cash_flows (from cash_flows table)
         │
         ▼
┌─────────────────┐
│  API Endpoint   │
│  /api/dashboard │
│  (dashboard.js) │
└────────┬────────┘
         │
         ├─── Fetches categories ordered by display_order
         ├─── Filters transactions by flow_month, cash_flow_id, user_id
         ├─── Groups transactions by category
         ├─── Calculates totals (spent, amount, count)
         └─── Returns processed data
         │
         ▼
┌─────────────────┐
│  Frontend       │
│  Dashboard.js   │
└────────┬────────┘
         │
         ├─── Receives category_breakdown array
         ├─── Maps categories to CategoryCard components
         ├─── Sorts by display_order
         └─── Displays in UI
```

### 1.2 טבלאות הדאטהבייס המרכזיות

#### `category_order` (טבלת סדר קטגוריות)
**מיקום:** `sql/create_category_order_table.sql`

**עמודות:**
- `id` (UUID) - מזהה ייחודי
- `user_id` (UUID) - מזהה המשתמש (הפנייה ל-`auth.users`)
- `category_name` (VARCHAR) - שם הקטגוריה
- `display_order` (INTEGER) - סדר תצוגה (0-based index)
- `shared_category` (VARCHAR) - קטגוריה משותפת (אופציונלי)
- `weekly_display` (BOOLEAN) - האם להציג תצוגה שבועית (ברירת מחדל: FALSE)
- `monthly_target` (DECIMAL) - יעד הוצאה חודשי (אופציונלי)
- `use_shared_target` (BOOLEAN) - האם להשתמש ביעד משותף
- `created_at` (TIMESTAMPTZ)
- `updated_at` (TIMESTAMPTZ)

**אינדקסים:**
- `idx_category_order_user_id` - על `user_id`
- `idx_category_order_user_display` - על `user_id, display_order`
- `idx_category_order_user_category` - UNIQUE על `user_id, category_name`
- `idx_category_order_weekly_display` - על `weekly_display` (WHERE weekly_display = true)
- `idx_category_order_monthly_target` - על `monthly_target` (WHERE monthly_target IS NOT NULL)

**שימוש:**
- מגדיר את סדר התצוגה של הקטגוריות במסך הדשבורד
- מכיל את היעדים החודשיים (`monthly_target`)
- מגדיר אילו קטגוריות מציגות תצוגה שבועית (`weekly_display`)

#### `transactions` (טבלת עסקאות)
**מיקום:** לא מוגדר במפורש ב-SQL, אבל נעשה שימוש ב-API

**עמודות רלוונטיות:**
- `id` (UUID) - מזהה ייחודי
- `user_id` (UUID) - מזהה המשתמש
- `cash_flow_id` (UUID) - מזהה תזרים המזומנים
- `category_name` (VARCHAR) - שם הקטגוריה (מתאים ל-`category_order.category_name`)
- `amount` (DECIMAL) - סכום העסקה (שלילי להוצאות, חיובי להכנסות)
- `flow_month` (VARCHAR) - חודש העסקה בפורמט "YYYY-MM" (למשל "2025-01")
- `transaction_date` (DATE) - תאריך העסקה
- `excluded_from_flow` (BOOLEAN) - האם העסקה מחוץ לתזרים

**שימוש:**
- כל העסקאות מסווגות לקטגוריות לפי `category_name`
- העסקאות מסוננות לפי `flow_month` ו-`cash_flow_id`
- הסכומים מסוכמים לכל קטגוריה

#### `monthly_goals` (טבלת יעדים חודשיים)
**מיקום:** מוזכר ב-`db_schema.md`

**עמודות:**
- `user_id` (UUID) - מזהה המשתמש
- `cash_flow_id` (UUID) - מזהה תזרים המזומנים
- `year` (INTEGER) - שנה
- `month` (INTEGER) - חודש (1-12)
- `amount` (DECIMAL) - סכום היעד החודשי

**שימוש:**
- מגדיר יעד חיסכון חודשי כללי (לא לקטגוריה ספציפית)

#### `cash_flows` (טבלת תזרים מזומנים)
**עמודות:**
- `id` (UUID) - מזהה ייחודי
- `user_id` (UUID) - מזהה המשתמש
- `name` (VARCHAR) - שם התזרים
- `is_default` (BOOLEAN) - האם זה התזרים ברירת המחדל

**שימוש:**
- מאפשר למשתמש לנהל מספר תזרים מזומנים (למשל: אישי, עסקי)
- כל עסקה משויכת ל-`cash_flow_id` ספציפי

#### `shared_category_targets` (טבלת יעדים משותפים)
**עמודות רלוונטיות:**
- `shared_category` (VARCHAR) - שם הקטגוריה המשותפת
- `monthly_target` (DECIMAL) - יעד חודשי משותף
- `weekly_display` (BOOLEAN) - האם להציג תצוגה שבועית

**שימוש:**
- קטגוריות יכולות להיות מקובצות תחת `shared_category`
- קטגוריות עם אותו `shared_category` יכולות להשתמש ביעד משותף

---

## 2. מבנה הקטגוריות - Categories Structure

### 2.1 איך הקטגוריות נטענות ומסודרות

**API Endpoint:** `/api/dashboard` (קובץ: `api/dashboard.js`)

**תהליך טעינת הקטגוריות:**

1. **שלב 1: שליפת קטגוריות מהדאטהבייס**
   ```javascript
   // מקוד: api/dashboard.js, שורות 121-125
   const { data: categories } = await supabase
     .from('categories')  // או category_order (תלוי ביישום)
     .select('*')
     .eq('user_id', userId)
     .order('display_order', { ascending: true });
   ```

2. **שלב 2: שליפת עסקאות**
   ```javascript
   // מקוד: api/dashboard.js, שורות 130-143
   let transactionsQuery = supabase
     .from('transactions')
     .select('*')
     .eq('user_id', userId)
     .eq('cash_flow_id', cash_flow)
     .eq('flow_month', flow_month);  // למשל "2025-01"
   ```

3. **שלב 3: קיבוץ עסקאות לפי קטגוריה**
   ```javascript
   // מקוד: api/dashboard.js, שורות 154-173
   categories.forEach(category => {
     const categoryTransactions = transactions?.filter(
       t => t.category === category.name
     ) || [];
     
     const amount = categoryTransactions.reduce(
       (sum, t) => sum + (t.amount || 0), 
       0
     );
     
     const categoryData = {
       name: category.name,
       spent: category.type === 'income' ? amount : -amount,
       amount: Math.abs(amount),
       count: categoryTransactions.length,
       type: category.type,
       transactions: categoryTransactions,
       display_order: category.display_order,
       weekly_display: category.weekly_display || false,
       monthly_target: category.monthly_target || null,
       // ... שדות נוספים
     };
   });
   ```

4. **שלב 4: החזרת הנתונים**
   ```javascript
   // מקוד: api/dashboard.js, שורות 205-222
   const responseData = {
     categories: processedCategories,  // אובייקט עם שם קטגוריה כמפתח
     category_breakdown: categoryBreakdown,  // מערך של קטגוריות
     orderedCategories: categoryBreakdown,  // מערך ממוין לפי display_order
     // ... נתונים נוספים
   };
   ```

### 2.2 סדר התצוגה - Display Order

**איך הקטגוריות מסודרות:**

1. **בדאטהבייס:** הקטגוריות נשלפות עם `ORDER BY display_order ASC`
2. **בפרונטאנד:** הקטגוריות מוצגות לפי הסדר שהגיע מה-API (כבר ממוין)
3. **עדכון סדר:** המשתמש יכול לשנות את `display_order` דרך מסך ניהול קטגוריות

**טבלה:** `category_order`
- `display_order` הוא מספר שלם (0, 1, 2, ...)
- מספר נמוך יותר = מוצג גבוה יותר במסך
- כל קטגוריה חייבת להיות עם `display_order` ייחודי למשתמש

---

## 3. תצוגה חודשית vs תצוגה שבועית - Monthly vs Weekly Display

### 3.1 תצוגה חודשית (Monthly Display)

**הגדרה:**
- `weekly_display = FALSE` (או NULL) בטבלה `category_order`
- ברירת המחדל לכל הקטגוריות

**איך זה עובד:**
1. כל העסקאות של הקטגוריה לחודש נתון מוצגות יחד
2. היעד (`monthly_target`) הוא סכום חודשי כולל
3. החישוב: `נשאר = monthly_target - spent`

**דוגמה:**
- `monthly_target = 1000` ₪
- `spent = 600` ₪
- `נשאר = 400` ₪

**קוד רלוונטי:**
```javascript
// מקוד: client/src/components/CategoryCard/CategoryCard.js, שורות 920-922
effectiveTarget - effectiveSpending >= 0 
  ? `נשאר להוציא ${formatCurrency(effectiveTarget - effectiveSpending)}`
  : `חרגת מהיעד ב${formatCurrency(effectiveSpending - effectiveTarget)}`
```

### 3.2 תצוגה שבועית (Weekly Display)

**הגדרה:**
- `weekly_display = TRUE` בטבלה `category_order`
- משמש לקטגוריות שבהן רוצים מעקב שבועי (למשל: מזון, תחבורה)

**איך זה עובד:**
1. החודש מחולק לשבועות לפי לוח השנה העברי (ראשון-שבת)
2. כל שבוע מוצג בנפרד עם העסקאות שלו
3. היעד השבועי מחושב: `יעד שבועי = monthly_target * 7 / 30`
4. החישוב: `נשאר השבוע = (monthly_target * 7 / 30) - spent_this_week`

**חישוב שבועות:**
- השבוע הראשון מתחיל ביום הראשון של החודש
- כל שבוע הוא 7 ימים (ראשון-שבת)
- השבוע האחרון יכול להיות קצר יותר

**קוד רלוונטי:**
```javascript
// מקוד: client/src/utils/hebrewCalendar.js
// פונקציה: groupTransactionsByWeeks
// מחלקת עסקאות לשבועות לפי תאריכים

// מקוד: client/src/components/CategoryCard/CategoryCard.js, שורות 859-861
weeklyDisplay 
  ? (effectiveSpending / (effectiveTarget * 7 / 30)) * 100
  : (effectiveSpending / effectiveTarget) * 100
```

**דוגמה:**
- `monthly_target = 1000` ₪
- `יעד שבועי = 1000 * 7 / 30 = 233.33` ₪
- `spent_this_week = 150` ₪
- `נשאר השבוע = 83.33` ₪

**תצוגה במסך:**
- קטגוריה עם `weekly_display = TRUE` מציגה קומפוננטה `WeeklyBreakdown`
- כל שבוע מוצג עם:
  - טווח תאריכים (למשל: "1-7 ינואר 2025")
  - סכום הוצאות לשבוע
  - רשימת עסקאות לשבוע

---

## 4. חישוב נשאר להוציא - Remaining Amount Calculation

### 4.1 חישוב בסיסי

**נוסחה:**
```
נשאר = יעד חודשי - סכום שהוצא
```

**קוד:**
```javascript
// מקוד: client/src/components/CategoryCard/CategoryCard.js
const monthlyTarget = categoryData.monthly_target || null;
const spent = Math.abs(categoryData.spent || 0);
const remaining = monthlyTarget - spent;
```

### 4.2 תצוגה חודשית

**חישוב:**
```javascript
// מקוד: client/src/components/CategoryCard/CategoryCard.js, שורות 920-922
if (effectiveTarget - effectiveSpending >= 0) {
  // נשאר להוציא
  remaining = effectiveTarget - effectiveSpending;
} else {
  // חרגת מהיעד
  overBudget = effectiveSpending - effectiveTarget;
}
```

**דוגמה:**
- יעד: 1000 ₪
- הוצא: 600 ₪
- נשאר: 400 ₪

### 4.3 תצוגה שבועית

**חישוב יעד שבועי:**
```javascript
// מקוד: client/src/components/CategoryCard/CategoryCard.js, שורות 916-918
const weeklyTarget = effectiveTarget * 7 / 30;
const weeklyRemaining = weeklyTarget - effectiveSpending;
```

**דוגמה:**
- יעד חודשי: 1000 ₪
- יעד שבועי: 1000 * 7 / 30 = 233.33 ₪
- הוצא השבוע: 150 ₪
- נשאר השבוע: 83.33 ₪

**הערה:** החישוב השבועי הוא משוער (7/30 של החודש). בחודשים שונים יש מספר ימים שונה, אבל זה קירוב מספיק למטרות תקציב.

### 4.4 קטגוריות משותפות (Shared Categories)

**איך זה עובד:**
1. קטגוריה יכולה להיות חלק מ-`shared_category`
2. אם `use_shared_target = TRUE`, היעד נלקח מטבלה `shared_category_targets`
3. ההוצאות מחושבות על כל הקטגוריות עם אותו `shared_category`

**קוד:**
```javascript
// מקוד: client/src/components/CategoryCard/CategoryCard.js, שורות 722-724
const effectiveTarget = (categoryData?.shared_category && useSharedTarget && sharedTarget) 
  ? sharedTarget.monthly_target 
  : monthlyTarget;
```

**דוגמה:**
- קטגוריה "מזון - סופר" עם `shared_category = "מזון"`
- קטגוריה "מזון - מסעדות" עם `shared_category = "מזון"`
- `shared_category_targets.monthly_target = 2000` ₪
- ההוצאות של שתי הקטגוריות מסוכמות יחד
- החישוב: `נשאר = 2000 - (הוצאות "מזון - סופר" + הוצאות "מזון - מסעדות")`

---

## 5. מה מוצג במסך הדשבורד - Dashboard Display

### 5.1 מבנה המסך

**קומפוננטה:** `client/src/pages/Dashboard/Dashboard.js`

**אלמנטים במסך:**
1. **כותרת עם בחירת חודש/שנה**
2. **בחירת תזרים מזומנים (cash flow)**
3. **סיכום כללי:**
   - סך הכנסות
   - סך הוצאות
   - יתרה נטו
4. **רשימת קטגוריות:** כל קטגוריה מוצגת כ-`CategoryCard`

### 5.2 כרטיס קטגוריה (CategoryCard)

**קומפוננטה:** `client/src/components/CategoryCard/CategoryCard.js`

**מה מוצג בכרטיס:**

1. **כותרת:**
   - שם הקטגוריה
   - סכום כולל (`amount`)
   - מספר עסקאות (`count`)
   - סוג (הכנסה/הוצאה)

2. **סעיף יעד חודשי** (אם קיים `monthly_target`):
   - יעד חודשי/שבועי (תלוי ב-`weekly_display`)
   - סכום שהוצא (`spent`)
   - אחוז התקדמות (פס התקדמות)
   - **נשאר להוציא** או **חרגת מהיעד**

3. **סעיף תצוגה שבועית** (אם `weekly_display = TRUE`):
   - רשימת שבועות עם עסקאות לכל שבוע
   - כל שבוע מציג:
     - טווח תאריכים
     - סכום הוצאות לשבוע
     - רשימת עסקאות

4. **סעיף תצוגה חודשית** (אם `weekly_display = FALSE`):
   - רשימת כל העסקאות של החודש
   - ממוין לפי תאריך

### 5.3 סדר התצוגה

**איך הקטגוריות מוצגות:**
1. הקטגוריות ממוינות לפי `display_order` (עולה)
2. הקטגוריות מוצגות ברשימה אנכית
3. כל קטגוריה היא כרטיס נפרד (`CategoryCard`)

**קוד:**
```javascript
// מקוד: client/src/pages/Dashboard/Dashboard.js
// הקטגוריות כבר מגיעות ממוינות מה-API
const orderedCategories = dashboardData.orderedCategories || [];
orderedCategories.map(category => (
  <CategoryCard 
    key={category.name}
    categoryName={category.name}
    categoryData={category}
    // ... props נוספים
  />
))
```

---

## 6. קטגוריות עם תצוגה חודשית - Monthly Display Categories

### 6.1 הגדרה

**בדאטהבייס:**
```sql
-- קטגוריה עם תצוגה חודשית
UPDATE category_order 
SET weekly_display = FALSE 
WHERE category_name = 'קטגוריה מסוימת';
```

**או ברירת מחדל:**
- אם `weekly_display` הוא NULL או FALSE, התצוגה היא חודשית

### 6.2 התנהגות

1. **טעינת עסקאות:**
   - כל העסקאות של החודש נטענות יחד
   - לא מחולקות לשבועות

2. **חישוב נשאר:**
   ```
   נשאר = monthly_target - spent
   ```

3. **תצוגה:**
   - רשימת עסקאות אחת לכל החודש
   - פס התקדמות אחד לחודש
   - הודעה אחת: "נשאר להוציא X ₪" או "חרגת מהיעד ב-X ₪"

### 6.3 דוגמאות לקטגוריות חודשיות

- קטגוריות עם הוצאות גדולות ולא תכופות (למשל: ביטוח, משכנתא)
- קטגוריות עם תשלום חודשי קבוע (למשל: מנויים)

---

## 7. קטגוריות עם תצוגה שבועית - Weekly Display Categories

### 7.1 הגדרה

**בדאטהבייס:**
```sql
-- קטגוריה עם תצוגה שבועית
UPDATE category_order 
SET weekly_display = TRUE 
WHERE category_name = 'מזון';
```

### 7.2 התנהגות

1. **חלוקה לשבועות:**
   - החודש מחולק לשבועות לפי לוח השנה העברי
   - כל שבוע מתחיל ביום ראשון ומסתיים בשבת
   - השבוע הראשון מתחיל ביום הראשון של החודש

2. **חישוב יעד שבועי:**
   ```
   יעד שבועי = monthly_target * 7 / 30
   ```

3. **חישוב נשאר שבועי:**
   ```
   נשאר השבוע = יעד שבועי - הוצאות השבוע
   ```

4. **תצוגה:**
   - כל שבוע מוצג בנפרד
   - לכל שבוע יש:
     - כותרת עם טווח תאריכים (למשל: "שבוע 1: 1-7 ינואר 2025")
     - סכום הוצאות לשבוע
     - רשימת עסקאות לשבוע
     - הודעה: "נשאר להוציא השבוע X ₪" או "חרגת מהיעד השבועי ב-X ₪"

### 7.3 קוד רלוונטי

**פונקציית חלוקה לשבועות:**
```javascript
// מקוד: client/src/utils/hebrewCalendar.js
// פונקציה: groupTransactionsByWeeks(transactions, year, month)
// מחזירה אובייקט: { 1: { transactions: [...], totalAmount: ... }, 2: {...} }
```

**קומפוננטת תצוגה שבועית:**
```javascript
// מקוד: client/src/components/WeeklyBreakdown/WeeklyBreakdown.js
// מציגה את השבועות עם העסקאות שלהם
```

### 7.4 דוגמאות לקטגוריות שבועיות

- מזון (סופר, מסעדות)
- תחבורה (דלק, תחבורה ציבורית)
- קטגוריות עם הוצאות תכופות שרצוי לעקוב אחריהן שבועית

---

## 8. סיכום - Summary

### 8.1 תזרים מלא

1. **טעינת נתונים:**
   - קטגוריות מ-`category_order` (ממוינות לפי `display_order`)
   - עסקאות מ-`transactions` (מסוננות לפי `flow_month`, `cash_flow_id`)
   - יעדים מ-`monthly_target` (ב-`category_order` או `shared_category_targets`)

2. **עיבוד נתונים:**
   - קיבוץ עסקאות לפי קטגוריה
   - חישוב סכומים (`spent`, `amount`, `count`)
   - חישוב נשאר (`monthly_target - spent`)

3. **תצוגה:**
   - כל קטגוריה מוצגת כ-`CategoryCard`
   - אם `weekly_display = TRUE`, מוצג `WeeklyBreakdown`
   - אם `weekly_display = FALSE`, מוצגת רשימת עסקאות חודשית

### 8.2 טבלאות דאטהבייס מרכזיות

| טבלה | שימוש | עמודות רלוונטיות |
|------|------|------------------|
| `category_order` | סדר תצוגה, יעדים, תצוגה שבועית | `display_order`, `monthly_target`, `weekly_display` |
| `transactions` | עסקאות | `category_name`, `amount`, `flow_month`, `cash_flow_id` |
| `monthly_goals` | יעד חיסכון חודשי כללי | `year`, `month`, `amount` |
| `cash_flows` | תזרים מזומנים | `id`, `name`, `is_default` |
| `shared_category_targets` | יעדים משותפים | `shared_category`, `monthly_target`, `weekly_display` |

### 8.3 חישובים מרכזיים

1. **נשאר חודשי:**
   ```
   נשאר = monthly_target - spent
   ```

2. **יעד שבועי:**
   ```
   יעד שבועי = monthly_target * 7 / 30
   ```

3. **נשאר שבועי:**
   ```
   נשאר השבוע = יעד שבועי - הוצאות השבוע
   ```

4. **אחוז התקדמות:**
   ```
   אחוז = (spent / monthly_target) * 100
   ```

---

## 9. הפניות לקוד - Code References

### 9.1 קבצים מרכזיים

1. **API Dashboard:**
   - `api/dashboard.js` - endpoint לטעינת נתוני דשבורד
   - `server/routes/dashboard.js` - route נוסף (אם קיים)

2. **Frontend Dashboard:**
   - `client/src/pages/Dashboard/Dashboard.js` - מסך הדשבורד הראשי
   - `client/src/components/CategoryCard/CategoryCard.js` - כרטיס קטגוריה

3. **תצוגה שבועית:**
   - `client/src/components/WeeklyBreakdown/WeeklyBreakdown.js` - קומפוננטת תצוגה שבועית
   - `client/src/utils/hebrewCalendar.js` - פונקציות לחלוקה לשבועות

4. **דאטהבייס:**
   - `sql/create_category_order_table.sql` - יצירת טבלת קטגוריות
   - `sql/add_weekly_display_column.sql` - הוספת עמודת תצוגה שבועית
   - `sql/add_monthly_target_column.sql` - הוספת עמודת יעד חודשי

### 9.2 פונקציות מרכזיות

1. **טעינת קטגוריות:**
   - `api/dashboard.js:121-125` - שליפת קטגוריות
   - `api/dashboard.js:154-173` - עיבוד קטגוריות ועסקאות

2. **חישוב נשאר:**
   - `client/src/components/CategoryCard/CategoryCard.js:920-922` - חישוב נשאר חודשי
   - `client/src/components/CategoryCard/CategoryCard.js:916-918` - חישוב נשאר שבועי

3. **חלוקה לשבועות:**
   - `client/src/utils/hebrewCalendar.js:groupTransactionsByWeeks` - פונקציית חלוקה לשבועות

---

## 10. Prompt ל-Cursor - Cursor Prompt

להלן prompt שניתן להעתיק ל-Cursor כדי ליצור אפליקציה דומה:

```
צור אפליקציה לניהול תקציב אישי עם המבנה הבא:

## תזרים הנתונים:
1. טען קטגוריות מטבלה category_order ממוינות לפי display_order
2. טען עסקאות מטבלה transactions מסוננות לפי flow_month, cash_flow_id, user_id
3. קיבץ עסקאות לפי category_name
4. חשב סכומים: spent = סכום שלילי להוצאות, חיובי להכנסות
5. הצג קטגוריות במסך דשבורד לפי display_order

## טבלאות דאטהבייס:
- category_order: id, user_id, category_name, display_order, weekly_display (BOOLEAN), monthly_target (DECIMAL), shared_category (VARCHAR)
- transactions: id, user_id, cash_flow_id, category_name, amount (DECIMAL), flow_month (VARCHAR "YYYY-MM"), transaction_date (DATE)
- monthly_goals: user_id, cash_flow_id, year, month, amount
- cash_flows: id, user_id, name, is_default

## תצוגה חודשית (weekly_display = FALSE):
- הצג כל העסקאות של החודש יחד
- חשב: נשאר = monthly_target - spent
- הצג פס התקדמות: (spent / monthly_target) * 100
- הצג הודעה: "נשאר להוציא X ₪" או "חרגת מהיעד ב-X ₪"

## תצוגה שבועית (weekly_display = TRUE):
- חלק את החודש לשבועות (ראשון-שבת, שבוע ראשון מתחיל ביום הראשון של החודש)
- חשב יעד שבועי: יעד שבועי = monthly_target * 7 / 30
- חשב נשאר שבועי: נשאר השבוע = יעד שבועי - הוצאות השבוע
- הצג כל שבוע בנפרד עם רשימת עסקאות שלו
- הצג הודעה לכל שבוע: "נשאר להוציא השבוע X ₪" או "חרגת מהיעד השבועי ב-X ₪"

## מה להציג במסך:
1. כותרת עם בחירת חודש/שנה
2. בחירת תזרים מזומנים
3. סיכום: סך הכנסות, סך הוצאות, יתרה נטו
4. רשימת קטגוריות ממוינת לפי display_order
5. כל קטגוריה מציגה:
   - שם, סכום, מספר עסקאות
   - יעד חודשי/שבועי (אם קיים)
   - סכום שהוצא
   - נשאר להוציא
   - רשימת עסקאות (חודשית או שבועית לפי weekly_display)

## קבצים ליצירה:
- API: api/dashboard.js - endpoint GET /api/dashboard
- Frontend: client/src/pages/Dashboard/Dashboard.js
- Component: client/src/components/CategoryCard/CategoryCard.js
- Component: client/src/components/WeeklyBreakdown/WeeklyBreakdown.js
- Utils: client/src/utils/hebrewCalendar.js - פונקציות לחלוקה לשבועות
```

---

## סיום

מסמך זה מסביר את תזרים האפליקציה, מבנה הקטגוריות, תצוגות חודשיות/שבועיות, וחישובי נשאר. השתמש במסמך זה כבסיס לפיתוח או שיפור האפליקציה.

**עדכון אחרון:** ינואר 2025

