# BudgetLens - Personal Finance Management

## תיאור המערכת

BudgetLens היא מערכת מתקדמת לניהול תקציב אישי שפותחה עם Node.js ו-React. המערכת מאפשרת מעקב מדויק אחר הכנסות והוצאות, ניהול תקציבים, וניתוח פיננסי מעמיק.

## טכנולוגיות

### Backend
- **Node.js** + **Express.js**
- **Sequelize ORM** עם **PostgreSQL**
- **JWT** לאימות משתמשים
- **Multer** להעלאת קבצים
- **XLSX** לעיבוד קבצי Excel

### Frontend
- **React 18**
- **React Query** לניהול state וcaching
- **React Router** לניווט
- **Axios** לקריאות API
- **React Hook Form** לטפסים
- **Chart.js** לגרפים

### מסד נתונים
- **PostgreSQL** (Supabase)
- **Sequelize** ORM
- Tables: Users, Categories, Transactions, Budgets, MonthlyBudgets, CashFlows

## התקנה והרצה

### דרישות מקדימות
- Node.js 16 או גרסה מתקדמת יותר
- PostgreSQL או חשבון Supabase
- npm או yarn

### התקנה מהירה
```bash
# Clone the repository
cd budget_app_project_new

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your database credentials

# Start development server (both frontend and backend)
npm run dev
```

### הרצה בפרטיום
```bash
# Install all dependencies
npm install

# Build the client
npm run build

# Start production server
npm start
```

## סקריפטים זמינים

- `npm start` - הרצה בייצור (production)
- `npm run dev` - הרצה בפיתוח עם hot reload
- `npm run server` - הרצת השרת בלבד
- `npm run server:dev` - הרצת השרת בפיתוח עם nodemon
- `npm run client:dev` - הרצת הלקוח בפיתוח
- `npm run build` - בניית הלקוח לייצור

## משתני סביבה

יש ליצור קובץ `.env` בתיקיית השורש עם המשתנים הבאים:

```env
# Environment
NODE_ENV=development
PORT=5000

# Database Configuration
SUPABASE_URL=your_supabase_url
SUPABASE_KEY=your_supabase_anon_key
SUPABASE_SECRET=your_supabase_service_role_key
SUPABASE_DB_USER=postgres

# Authentication
JWT_SECRET=your_jwt_secret
SESSION_SECRET=your_session_secret

# API Keys (optional)
ALPHA_VANTAGE_API_KEY=your_alpha_vantage_key

# Frontend URL (for CORS in production)
FRONTEND_URL=http://localhost:3000
```

## ארכיטקטורה

### Backend Structure
```
server/
├── config/          # הגדרות מסד נתונים
├── models/          # מודלים של Sequelize
├── routes/          # נתיבי API
├── middleware/      # Middleware functions
├── services/        # לוגיקה עסקית
└── index.js         # נקודת כניסה לשרת
```

### Frontend Structure
```
client/src/
├── components/      # רכיבי React
├── pages/          # עמודים ראשיים
├── contexts/       # React Contexts
├── services/       # API calls
├── hooks/          # Custom hooks
└── utils/          # פונקציות עזר
```

## תכונות עיקריות

### ניהול תנועות
- הוספה, עריכה ומחיקה של תנועות
- קטגוריזציה אוטומטית
- העלאת קבצי Excel/CSV
- סינון וחיפוש מתקדם

### ניהול תקציב
- הגדרת תקציבים חודשיים וקבועים
- מעקב בזמן אמת אחר צריכת התקציב
- התראות על חריגה מתקציב
- פירוק תקציב שבועי

### דוחות וניתוח
- דוחות חודשיים ושנתיים
- ניתוח מגמות קטגוריות
- השוואה בין cash flows
- גרפים אינטראקטיביים

### ניהול Cash Flows
- מעקב אחר מספר זרמי כסף
- העברות בין cash flows
- הגדרת cash flow ברירת מחדל

## API Endpoints

### Authentication
- `POST /api/auth/login` - התחברות
- `POST /api/auth/register` - הרשמה
- `POST /api/auth/logout` - התנתקות
- `GET /api/auth/me` - פרטי משתמש נוכחי

### Transactions
- `GET /api/transactions` - קבלת תנועות
- `POST /api/transactions` - הוספת תנועה
- `PUT /api/transactions/:id` - עדכון תנועה
- `DELETE /api/transactions/:id` - מחיקת תנועה

### Categories
- `GET /api/categories` - קבלת קטגוריות
- `POST /api/categories` - הוספת קטגוריה
- `PUT /api/categories/:id` - עדכון קטגוריה

### Budgets
- `GET /api/budgets` - קבלת תקציבים
- `POST /api/budgets` - הוספת תקציב
- `GET /api/budgets/monthly/:year/:month` - תקציבים חודשיים

## אבטחה

- אימות JWT לכל הקריאות המוגנות
- הצפנת סיסמאות עם bcrypt
- הגנה מפני CSRF
- Rate limiting
- Validation של נתונים נכנסים

## תמיכה

לתמיכה או שאלות, אנא פנו ל:
- Email: support@budgetlens.com
- Issues: [GitHub Issues](https://github.com/budgetlens/issues)

## רישיון

MIT License - ראו קובץ LICENSE לפרטים מלאים.