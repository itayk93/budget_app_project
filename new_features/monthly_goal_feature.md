# פיצ'רים מתקדמים לניהול יעדים ותקציבים

## תיאור כללי

מערכת מקיפה לניהול יעדים, תקציבים וחיסכון חודשי/שבועי במערכת ניהול התקציב. המערכת כוללת כמה פיצ'רים משלימים:

1. **פיצ'ר יעד חודשי כללי** - יעד חיסכון כולל לחודש
2. **פיצ'ר יעדים חודשיים לקטגוריות** - יעדי הוצאה ספציפיים לכל קטגוריה
3. **פיצ'ר יעדים שבועיים** - יעדי הוצאה שבועיים לקטגוריות נבחרות
4. **מערכת רענון אוטומטי** - עדכון יעדים אוטומטי בתחילת חודש חדש
5. **ניתוח והיסטוריה** - כלים לניתוח דפוסי הוצאה והיסטוריה

## 1. פיצ'ר יעד חודשי כללי

### ממשק המשתמש (UI Components)

#### כפתור יעד חודשי בדשבורד
- החליף את הכרטיס הגדול והמורכב של היעד החודשי
- כפתור קומפקטי ואלגנטי שמציג את סכום היעד הנוכחי
- עיצוב responsive עם אפקטי hover אטרקטיביים
- הכפתור מציג את הסכום הנוכחי ואיקון עריכה

#### מודל הגדרת יעד חודשי (MonthlyGoalModal)
- מודל מקיף לניהול יעדי החיסכון החודשיים
- שדה הזנת סכום היעד עם בדיקות תקינות
- אפשרויות גמישות לניהול הכסף שנחסך:
  - אפשרות שלא להכניס את הכסף לתזרים עתידי (שמירה פשוטה)
  - אפשרות להוסיף את הכסף לחודש הבא כהכנסה
  - אפשרות להוסיף את הכסף לחודש ספציפי בעתיד כהכנסה

## 2. פיצ'ר יעדים חודשיים לקטגוריות

### עמודת monthly_target בטבלת category_order
- הוספת עמודת `monthly_target` לאחסון יעד ההוצאה החודשי לכל קטגוריה
- תמיכה בערכי NULL (לא מוגדר) ו-DECIMAL(10,2) לדיוק כספי
- אינדקס מותאם לביצועים עבור קטגוריות עם יעדים מוגדרים

### ממשק בכרטיס קטגוריה (CategoryCard)
- הצגת יעד חודשי וחישוב התקדמות בזמן אמת
- חלוקה בין יעדים חודשיים ושבועיים
- התראות ויזואליות על חריגה מהיעד (צבעי אזהרה)
- מחצבות להסתרת יעדים בחודשים שעברו (חודש שנגמר)

### מודל עריכת יעד חודשי (MonthlyTargetModal)
- מודל ייעודי לעריכת יעדי קטגוריות
- הצגת הוצאה נוכחית מול היעד
- אפשרויות לחישוב אוטומטי של יעד:
  - ממוצע 3 חודשים אחרונים
  - ממוצע 12 חודשים אחרונים
- אפשרות לקביעה ידנית של יעד מותאם אישית

### היסטוגרמה של הוצאות קטגוריה
- גרף מקיף המציג התפלגות הוצאות בחודשים אחרונים
- עזרה בקביעת יעד ריאלי על בסיס נתונים היסטוריים
- הדגשת חודשים חריגים ומגמות

## 3. פיצ'ר יעדים שבועיים

### תמיכה בתצוגה שבועית (weekly_display)
- תמיכה בעמודת `weekly_display` הקיימת בטבלת category_order
- חישוב יעד שבועי אוטומטי: יעד חודשי × 7 ÷ 30
- הצגת "הוצאת השבוע" במקום "הוצאת החודש"
- התאמת חישובי התקדמות לבסיס שבועי

### חישובי זמן דינמיים
- חישוב התאריכים של השבוע הנוכחי
- עדכון אוטומטי של נתוני השבוע בכל כניסה למערכת
- התאמה לקטגוריות עם דפוס הוצאה שבועי קבוע

## 4. מערכת רענון אוטומטי של יעדים

### מנגנון בדיקה ועדכון אוטומטי
- עמודת `monthly_targets_last_update` בטבלת users למעקב אחר עדכון אחרון
- בדיקה אוטומטית בכל כניסה לדשבורד אם נדרש רענון (חודש חדש)
- רענון אוטומטי של יעדים על בסיס ממוצע 3 חודשים אחרונים

### API עבור רענון יעדים
- `GET /categories/should-refresh-targets` - בדיקה אם נדרש רענון
- `POST /categories/refresh-monthly-targets` - רענון אוטומטי של יעדים
- תמיכה בכפיית רענון (force refresh) לכל הקטגוריות

### כפתור רענון ידני
- כפתור "🎯 חשב יעדים לכל הקטגוריות" בדשבורד
- אפשרות לעדכון ידני של כל היעדים בלחיצה אחת
- הודעות משוב למשתמש על תוצאות העדכון

## 5. ניתוח והיסטוריה

### API לנתוני היסטוריה
- `GET /categories/spending-history/:categoryName` - היסטוריית הוצאות של קטגוריה
- `GET /categories/monthly-spending/:categoryName` - הוצאות חודש נוכחי
- תמיכה בפרמטר months להגדרת טווח זמן

### כלי ניתוח ברמת הקטגוריה
- חישוב ממוצעים על פי טווחי זמן שונים
- זיהוי מגמות וחודשים חריגים
- השוואה בין חודש נוכחי להיסטוריה

## מאפיינים טכניים מתקדמים

### אופטימיזציות מסד נתונים
- אינדקסים מותאמים לשאילתות מהירות
- COMMENT על עמודות לתיעוד מובנה
- טריגרים לעדכון אוטומטי של updated_at

### ביצועים ו-UX
- שמירת מצב יעדים ב-state מקומי לתגובה מהירה
- עדכון אסינכרוני ברקע עם React Query
- טעינה lazy של נתונים היסטוריים

### אבטחה ותקינות נתונים
- אימות שדות בצד לקוח ושרת
- הגנה מפני הזנות נתונים לא תקינות
- ניהול שגיאות מקיף עם הודעות ברורות למשתמש

## הסתרת יעדים בחודשים שעברו

### לוגיקה זמנית חכמה
- בדיקה אוטומטית אם החודש הנצפה הוא חודש עבר
- הסתרה מלאה של קטע היעדים החודשיים בחודשים שהסתיימו
- שמירה על הצגת נתוני ההוצאות בפועל לצורך ניתוח

### מימוש טכני
```javascript
const isCurrentOrFutureMonth = year > currentYear || (year === currentYear && month >= currentMonth);
```
- השוואה דינמית בין התאריך הנצפה לתאריך הנוכחי
- הסתרה של כל האלמנטים הקשורים ליעד (פס התקדמות, כפתורי עריכה, וכו')

## ממשק API מקיף

### API עבור יעד חודשי כללי
- `GET /api/monthly-goals/:year/:month` - קבלת יעד חודשי ספציפי
- `POST /api/monthly-goals` - יצירה או עדכון של יעד חודשי
- `DELETE /api/monthly-goals/:year/:month` - מחיקת יעד חודשי

### API עבור יעדים חודשיים לקטגוריות
- `POST /categories/calculate-monthly-target` - חישוב יעד אוטומטי לקטגוריה
- `POST /categories/update-monthly-target` - עדכון יעד ידני לקטגוריה
- `GET /categories/monthly-spending/:categoryName` - הוצאות קטגוריה החודש
- `GET /categories/spending-history/:categoryName` - היסטוריית הוצאות קטגוריה

### API עבור רענון אוטומטי
- `GET /categories/should-refresh-targets` - בדיקה אם נדרש רענון יעדים
- `POST /categories/refresh-monthly-targets` - רענון אוטומטי של יעדים לחודש חדש

### שירותי SupabaseService מתקדמים
- `calculateMonthlyAverage()` - חישוב ממוצע הוצאות לפי תקופה מוגדרת
- `updateCategoryMonthlyTarget()` - עדכון יעד קטגוריה במסד הנתונים
- `getCategoryMonthlySpending()` - קבלת הוצאות קטגוריה בחודש נוכחי
- `getCategorySpendingHistory()` - קבלת היסטוריה מפורטת של הוצאות קטגוריה
- `shouldRefreshMonthlyTargets()` - בדיקה אם נדרש רענון יעדים (חודש חדש)
- `refreshMonthlyTargetsForNewMonth()` - רענון כלל היעדים לחודש חדש

## מסד הנתונים מורחב

### טבלת monthly_goals (יעדים כלליים)
- `id` - מזהה ייחודי
- `user_id` - מזהה המשתמש
- `cash_flow_id` - מזהה תזרים המזומנים
- `year`, `month` - שנה וחודש של היעד
- `amount` - סכום היעד
- `include_in_next_month` - האם להוסיף לחודש הבא
- `include_in_specific_month` - האם להוסיף לחודש ספציפי
- `specific_year`, `specific_month` - חודש ושנה ספציפיים
- `created_at`, `updated_at` - זמני יצירה ועדכון

### טבלת category_order מורחבת (יעדים לקטגוריות)
- `monthly_target` (חדש) - יעד הוצאה חודשי לקטגוריה
- `weekly_display` (קיים) - האם להציג בתצוגה שבועית
- אינדקס על `monthly_target` WHERE monthly_target IS NOT NULL
- טריגר לעדכון `updated_at` אוטומטי

### טבלת users מורחבת (מעקב רענון)
- `monthly_targets_last_update` (חדש) - תאריך עדכון אחרון של יעדים
- אינדקס על `monthly_targets_last_update` לביצועי בדיקה

## לוגיקה עסקית מתקדמת

### 1. יצירת יעד חודשי כללי
כאשר משתמש יוצר יעד חודשי חדש:
1. המערכת יוצרת רשומה בטבלת `monthly_goals`
2. המערכת מוסיפה עסקה אוטומטית בקטגוריית "חיסכון - יעד חודשי" כהוצאה
3. אם המשתמש בחר להוסיף את הכסף לחודש הבא או לחודש ספציפי, המערכת יוצרת עסקת הכנסה עתידית

### 2. יצירת יעדים חודשיים לקטגוריות
כאשר משתמש מגדיר יעד חודשי לקטגוריה:
1. המערכת מעדכנת את שדה `monthly_target` בטבלת `category_order`
2. חישוב אוטומטי של התקדמות מול היעד בזמן אמת
3. התראות ויזואליות כאשר ההוצאה חורגת מהיעד

### 3. חישוב יעדים אוטומטיים
המערכת מחשבת יעדים אוטומטיים על בסיס:
- **ממוצע 3 חודשים** - לקטגוריות עם הוצאות יציבות
- **ממוצע 12 חודשים** - לקטגוריות עם הוצאות עונתיות
- **מסנן חודשים חריגים** - התעלמות מחודשים עם הוצאות חריגות

### 4. רענון אוטומטי בחודש חדש
בתחילת כל חודש:
1. בדיקה אוטומטית אם עבר חודש מהעדכון האחרון
2. חישוב יעדים חדשים לכל הקטגוריות על בסיס הנתונים העדכניים
3. עדכון שדה `monthly_targets_last_update` במשתמש
4. הודעה למשתמש על עדכון היעדים (אופציונלי)

### 5. יעדים שבועיים דינמיים
עבור קטגוריות עם `weekly_display = true`:
1. חישוב יעד שבועי: monthly_target × 7 ÷ 30
2. חישוב הוצאות השבוע הנוכחי (ראשון-ראשון)
3. התאמת מסרי ההתקדמות לבסיס שבועי

### 6. הסתרת יעדים בחודשים שעברו
עבור חודשים שהסתיימו:
1. הסתרה מלאה של קטע היעדים החודשיים
2. שמירה על הצגת נתוני ההוצאות בפועל
3. מניעת עריכה של יעדים בחודשים שעברו

## אינטגרציה עם המערכת הקיימת

### 1. דשבורד משופר
- כפתור יעד חודשי כללי בשורת הכרטיסים העליונה
- כפתור רענון ידני לכל היעדים החודשיים
- בדיקה אוטומטית ורענון יעדים בכל כניסה למערכת
- הצגת סטטוס עדכון יעדים למשתמש

### 2. כרטיסי קטגוריות משופרים
- הצגת יעד חודשי/שבועי וסטטוס התקדמות לכל קטגוריה
- התראות ויזואליות על חריגה מיעד
- כפתורי עריכה ידנית של יעדים
- היסטוגרמות להצגת דפוסי הוצאה

### 3. מערכת העסקאות מורחבת
- עסקאות יעד חודשי כללי עם `source_type` מיוחד
- השפעה על חישובי תזרים ומאזן חודשי
- אינטגרציה מלאה עם מערכת הקטגוריות

### 4. מערכת הקטגוריות מורחבת
- עמודת `monthly_target` חדשה לכל קטגוריה
- תמיכה בחישובי יעד שבועי דינמיים
- מעקב מתמשך אחר הוצאות מול יעד

## יתרונות המערכת המשופרת

### 1. גמישות מקסימלית
- יעדים כלליים ולקטגוריות ספציפיות
- תמיכה בחישובי יעד חודשי ושבועי
- אפשרויות חישוב אוטומטי ועריכה ידנית

### 2. אוטומציה מתקדמת
- רענון אוטומטי של יעדים בתחילת חודש חדש
- חישוב יעדים על בסיס נתונים היסטוריים
- עדכון אוטומטי של התקדמות בזמן אמת

### 3. אינטגרציה מלאה
- שילוב חלק עם מערכת העסקאות הקיימת
- תמיכה בכל סוגי התזרימים והקטגוריות
- שמירה על שלמות נתונים במסד הנתונים

### 4. תחווית משתמש מעולה
- ממשק אינטואיטיבי עם התראות ויזואליות
- הסתרה חכמה של יעדים בחודשים שעברו
- כלי ניתוח מתקדמים (היסטוגרמות, מגמות)

### 5. מעקב מדויק ובקרה
- מעקב מתמשך אחר התקדמות מול יעדים
- ניתוח דפוסי הוצאה להעלאת מודעות פיננסית
- בקרה מלאה על כל סוגי היעדים והתקציבים

## דרישות טכניות מתקדמות

### Frontend
- React components עם hooks חדישים ו-custom hooks
- React Query לניהול state, caching ועדכונים אסינכרוניים
- CSS מותאם אישית עם animations ו-transitions
- Responsive design לכל גדלי מסך
- מודלים דינמיים עם Portal rendering

### Backend  
- Node.js עם Express ו-middleware מתקדמים
- Supabase למסד הנתונים עם PostgreSQL
- RESTful API עם validation מקיף (Joi/Yup)
- Transaction management לעקיבות נתונים
- Error handling מקיף ומובנה

### Database
- PostgreSQL (דרך Supabase) עם אופטימיזציות מתקדמות
- Indexes מותאמים (B-tree, Partial indexes)
- Constraints מקיפים לאכיפת שלמות נתונים
- Triggers ו-Functions לחישובים אוטומטיים
- Views למציאה מהירה של נתונים מצטברים

### אבטחה וביצועים
- Rate limiting על API endpoints
- Input sanitization והגנה מפני SQL injection
- Caching בצד שרת ולקוח
- Lazy loading של נתונים כבדים
- Monitoring ו-logging מקיפים

## השפעה כוללת על המערכת

### שיפורים במערכת
1. **יכולות תכנון פיננסי מתקדמות** - מעבר ממערכת פשוטה למערכת מקצועית מלאה
2. **אוטומציה חכמה** - הפחתה דרמטית בעבודה ידנית של המשתמש
3. **תובנות עמוקות** - מתן כלים לניתוח דפוסי הוצאה ושיפור הרגלים פיננסיים
4. **גמישות מקסימלית** - התאמה לכל סוג של משתמש ודפוס הוצאה

### שמירה על ביצועים
- **אופטימיזציות מסד נתונים** - שאילתות מהירות גם עם נתונים רבים
- **Caching חכם** - הפחתת עומס על השרת ושיפור זמני תגובה
- **עדכונים חלקיים** - רק הנתונים שהשתנו מתעדכנים בממשק
- **טעינה אסינכרונית** - הממשק נשאר רספונסיבי תמיד

### עמידות ואמינות
- **גיבוי נתונים** - שמירה על כל הנתונים ההיסטוריים
- **Transaction safety** - אי אפשרות לאבדן נתונים בעת עדכונים
- **Error recovery** - התאוששות אוטומטית משגיאות זמניות
- **Rollback capabilities** - אפשרות לביטול פעולות במקרה צורך

המערכת החדשה הופכת את האפליקציה לכלי מקצועי מלא לניהול תקציב אישי, תוך שמירה על הפשטות והאינטואיטיביות המקוריות.