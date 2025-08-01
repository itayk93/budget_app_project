# תכונות האפליקציה

מסמך זה מפרט את התכונות של אפליקציית התקציב.

## ניהול משתמשים

*   **רישום משתמש:** משתמשים חדשים יכולים ליצור חשבון על ידי מתן שם משתמש, דוא"ל וסיסמה.
*   **כניסת משתמש:** משתמשים רשומים יכולים להתחבר כדי לגשת למידע התקציב האישי שלהם.
*   **יציאת משתמש:** משתמשים יכולים להתנתק מחשבונותיהם.
*   **איפוס סיסמה:** משתמשים יכולים לאפס את הסיסמאות שלהם באמצעות תהליך מודרך.

## ניהול תקציב

*   **יצירת תקציב:** משתמשים יכולים ליצור תקציבים חדשים לתקופות ספציפיות (למשל, חודשי, שנתי).
*   **הצגת תקציבים:** משתמשים יכולים להציג רשימה של כל התקציבים שיצרו.
*   **עריכת תקציב:** משתמשים יכולים לשנות את פרטי התקציבים הקיימים שלהם.
*   **מחיקת תקציב:** משתמשים יכולים למחוק תקציבים שאינם זקוקים להם עוד.

## מעקב אחר הכנסות והוצאות

*   **הוספת הכנסה/הוצאה:** משתמשים יכולים להוסיף רשומות של הכנסות והוצאות לתקציבים שלהם.
*   **קטגוריזציה:** ניתן לשייך כל הכנסה/הוצאה לקטגוריה ספציפית (למשל, משכורת, מצרכים, שכר דירה).
*   **הצגת עסקאות:** משתמשים יכולים להציג רשימה מפורטת של כל עסקאות ההכנסה וההוצאה שלהם.
*   **עריכה/מחיקה של עסקאות:** משתמשים יכולים לערוך או למחוק עסקאות בודדות.

## ניתוח פיננסי ודיווח

*   **סיכום תקציב:** משתמשים יכולים להציג סיכום של התקציב שלהם, כולל סך ההכנסות, סך ההוצאות והיתרה הנותרת.
*   **ניתוח הוצאות:** האפליקציה מספקת פירוט של ההוצאות לפי קטגוריות, מה שעוזר למשתמשים להבין את הרגלי ההוצאה שלהם.
*   **דוחות חזותיים:** האפליקציה מייצרת תרשימים וגרפים כדי להמחיש נתונים פיננסיים, כגון תרשים עוגה של התפלגות ההוצאות.

## פרופיל משתמש

*   **הצגת פרופיל:** משתמשים יכולים להציג את פרטי הפרופיל שלהם.
*   **עריכת פרופיל:** משתמשים יכולים לעדכן את פרטיהם האישיים.

## תכונות כלליות

*   **עיצוב רספונסיבי:** האפליקציה מתוכננת להיות נגישה וידידותית למשתמש במגוון מכשירים, כולל מחשבים שולחניים, טאבלטים וסמארטפונים.
*   **התראות:** המערכת יכולה לשלוח התראות למשתמשים על מצב התקציב שלהם (תכונה זו מתוכננת).
*   **אבטחת נתונים:** נתוני המשתמשים נשמרים מאובטחים ופרטיים.

## מבנה העמודים

### עמודי אימות
*   **עמוד כניסה (`/login`):**
    *   טופס כניסה עם שם משתמש/אימייל וסיסמה.
    *   קישור להרשמה.
    *   קישור לאיפוס סיסמה.
*   **עמוד הרשמה (`/register`):**
    *   טופס הרשמה עם שם משתמש, אימייל, סיסמה, אימות סיסמה, שם פרטי ושם משפחה.
    *   קישור לכניסה.
*   **עמוד שכחתי סיסמה (`/forgot-password`):**
    *   טופס להזנת כתובת אימייל לשליחת קישור לאיפוס סיסמה.
*   **עמוד איפוס סיסמה (`/reset-password`):**
    *   טופס להזנת סיסמה חדשה ואימותה.
*   **עמוד אימות אימייל (`/verify-email`):**
    *   עמוד המודיע למשתמש על הצורך לאמת את כתובת האימייל שלו.

### עמודים ראשיים
*   **לוח בקרה (`/dashboard`):**
    *   תצוגה כללית של המצב הפיננסי.
    *   סיכום הכנסות, הוצאות ומאזן.
    *   כרטיסיות לקטגוריות השונות עם פירוט ההוצאות וההכנסות.
    *   רשימת תנועות אחרונות.
    *   ניווט בין חודשים.
    *   אפשרות להצגת נתונים חודשיים או מצטברים.
    *   כפתור לקביעת יעד חודשי.
    *   קישור לתיק המניות.
*   **עסקאות (`/transactions`):**
    *   טבלה מפורטת של כל התנועות.
    *   סינון לפי חודש, תזרים מזומנים, קטגוריה וחיפוש חופשי.
    *   אפשרות להוספה, עריכה, מחיקה והעתקה של תנועות.
    *   אפשרות לבחירה מרובה של תנועות וביצוע פעולות אצווה (כמו שינוי קטגוריה).
    *   אפשרות למחיקת כל התנועות בתזרים.
    *   אפשרות להעתקת כל התנועות לתזרים אחר.
*   **העלאת קבצים (`/upload`):**
    *   ממשק להעלאת קבצי אקסל או CSV של נתוני בנק או כרטיסי אשראי.
    *   תהליך מודרך הכולל מיפוי עמודות, סקירת כפילויות ובחירת מטבע.
*   **דוחות (`/reports`):**
    *   (בפיתוח) עמוד המיועד להצגת דוחות וניתוחים פיננסיים מתקדמים.
*   **פרופיל (`/profile`):**
    *   טופס לעדכון פרטים אישיים (שם, אימייל).
    *   טופס לשינוי סיסמה.
    *   מידע על אבטחת החשבון (אימות אימייל, כניסה אחרונה).
    *   אפשרות לייצוא כל הנתונים, עסקאות או נתוני מניות.

### עמודי מניות
*   **לוח בקרה מניות (`/stocks`):**
    *   סיכום של תיק המניות.
    *   רשימת אחזקות.
    *   ביצועים חודשיים.
    *   תנועות אחרונות.
    *   רשימת צפייה.
    *   התראות מחיר.
*   **גרף מניה (`/stocks/chart/:symbol`):**
    *   גרף מפורט של מניה ספציפית.
*   **עסקאות מניות (`/stocks/transactions`):**
    *   רשימה של כל עסקאות המניות.
*   **התראות (`/stocks/alerts`):**
    *   ניהול התראות מחיר למניות.

### עמודים נוספים
*   **סדר קטגוריות (`/category-order`):**
    *   ממשק לקביעת סדר התצוגה של הקטגוריות בלוח הבקרה.
*   **מיפוי קטגוריות (`/category-mappings`):**
    *   ממשק למיפוי אוטומטי של תיאורי עסקאות לקטגוריות.

## מבנה מסד הנתונים (Supabase)

### טבלת `shared_category_targets`
- `id`: מזהה ייחודי (מספר שלם)
- `category_name`: שם הקטגוריה (טקסט)
- `target_amount`: סכום היעד (מספר)
- `user_id`: מזהה המשתמש (UUID)

### טבלת `category_order`
- `user_id`: מזהה המשתמש (UUID)
- `category_order`: סדר הקטגוריות (מערך טקסט)

### טבלת `stock_alerts`
- `id`: מזהה ייחודי (מספר שלם)
- `symbol`: סמל המניה (טקסט)
- `target_price`: מחיר היעד (מספר)
- `alert_type`: סוג ההתראה (טקסט)
- `user_id`: מזהה המשתמש (UUID)
- `created_at`: תאריך יצירה (חותמת זמן)

### טבלת `stocks`
- `id`: מזהה ייחודי (מספר שלם)
- `symbol`: סמל המניה (טקסט)
- `name`: שם המניה (טקסט)
- `exchange`: בורסה (טקסט)

### טבלת `stock_holdings`
- `id`: מזהה ייחודי (מספר שלם)
- `user_id`: מזהה המשתמש (UUID)
- `stock_id`: מזהה המניה (מספר שלם)
- `quantity`: כמות (מספר)
- `average_price`: מחיר ממוצע (מספר)

### טבלת `stock_prices`
- `id`: מזהה ייחודי (מספר שלם)
- `stock_id`: מזהה המניה (מספר שלם)
- `price`: מחיר (מספר)
- `timestamp`: חותמת זמן (חותמת זמן)

### טבלת `stock_transactions_summary`
- `id`: מזהה ייחודי (מספר שלם)
- `user_id`: מזהה המשתמש (UUID)
- `stock_id`: מזהה המניה (מספר שלם)
- `transaction_type`: סוג העסקה (טקסט)
- `quantity`: כמות (מספר)
- `price`: מחיר (מספר)
- `transaction_date`: תאריך העסקה (תאריך)

### טבלת `stock_alert_history`
- `id`: מזהה ייחודי (מספר שלם)
- `alert_id`: מזהה ההתראה (מספר שלם)
- `triggered_at`: תאריך הפעלה (חותמת זמן)
- `price_at_trigger`: מחיר בהפעלה (מספר)

### טבלת `daily_portfolio_performance`
- `id`: מזהה ייחודי (מספר שלם)
- `user_id`: מזהה המשתמש (UUID)
- `date`: תאריך (תאריך)
- `total_value`: שווי כולל (מספר)
- `daily_change`: שינוי יומי (מספר)

### טבלת `watchlist`
- `id`: מזהה ייחודי (מספר שלם)
- `user_id`: מזהה המשתמש (UUID)
- `stock_id`: מזהה המניה (מספר שלם)

### טבלת `monthly_goals`
- `id`: מזהה ייחודי (מספר שלם)
- `user_id`: מזהה המשתמש (UUID)
- `month`: חודש (תאריך)
- `goal_amount`: סכום היעד (מספר)
- `current_amount`: סכום נוכחי (מספר)
