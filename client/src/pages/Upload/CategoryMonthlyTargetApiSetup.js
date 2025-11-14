import React, { useState } from 'react';
import './BankScraperApiSetup.css';

const sqlQuery = `SELECT
    t.flow_month,
    t.user_id,
    t.category_name,
    co.monthly_target
FROM
    transactions AS t
JOIN
    category_order AS co
        ON  co.user_id       = t.user_id
        AND co.category_name = t.category_name
WHERE
    t.user_id       = 'e3f6919b-d83b-4456-8325-676550a4382d'  -- המשתמש
    AND t.flow_month = '2025-10'                               -- החודש בתזרים (YYYY-MM)
    AND t.category_name = 'חטיפים ואבקות חלבון'                -- הקטגוריה הרלוונטית
GROUP BY
    t.flow_month,
    t.user_id,
    t.category_name,
    co.monthly_target;`;

const curlExample = `# Local development
curl -G "http://localhost:5001/api/category-monthly-target" \\
  -H "Authorization: Bearer <TOKEN>" \\
  --data-urlencode "flow_month=2025-10" \\
  --data-urlencode "category_name=חטיפים ואבקות חלבון" \\
  --data-urlencode "user_id=e3f6919b-d83b-4456-8325-676550a4382d"

# Production (Render deployment)
curl -G "https://budget-app-project-benj.onrender.com/api/category-monthly-target" \\
  -H "Authorization: Bearer <TOKEN>" \\
  --data-urlencode "flow_month=2025-10" \\
  --data-urlencode "category_name=חטיפים ואבקות חלבון" \\
  --data-urlencode "user_id=e3f6919b-d83b-4456-8325-676550a4382d"`;

const javascriptExample = `const token = localStorage.getItem('token');
const API_URL = window.location.origin.includes('localhost')
  ? 'http://localhost:5001/api/category-monthly-target'
  : 'https://budget-app-project-benj.onrender.com/api/category-monthly-target';

if (!token) {
  throw new Error('אין טוקן ב-localStorage. התחבר למערכת ונסה שוב.');
}

const params = {
  flow_month: '2025-10',
  category_name: 'חטיפים ואבקות חלבון',
  user_id: 'e3f6919b-d83b-4456-8325-676550a4382d',
};

const url = new URL(API_URL);
Object.entries(params).forEach(([key, value]) => {
  if (value) {
    url.searchParams.append(key, value);
  }
});

const response = await fetch(url.toString(), {
  headers: {
    Authorization: \`Bearer \${token}\`,
  },
});

if (!response.ok) {
  throw new Error('הקריאה נכשלה, בדוק את הפרמטרים או את ההרשאות');
}

const payload = await response.json();
console.log(payload);`;

const responseExample = `[
  {
    "flow_month": "2025-10",
    "user_id": "e3f6919b-d83b-4456-8325-676550a4382d",
    "category_name": "חטיפים ואבקות חלבון",
    "monthly_target": 1450
  }
]`;

const CategoryMonthlyTargetApiSetup = () => {
  const [tokenValue, setTokenValue] = useState(null);
  const [tokenError, setTokenError] = useState(null);
  const [copyMessage, setCopyMessage] = useState('');

  const handleShowToken = () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setTokenValue(null);
        setTokenError('לא נמצא טוקן ב-localStorage. התחבר מחדש למערכת (localhost:4000 או Render) ואז נסה שוב.');
        return;
      }
      setTokenValue(token);
      setTokenError(null);
      setCopyMessage('');
    } catch (error) {
      setTokenValue(null);
      setTokenError('שגיאה בקריאת הטוקן מהדפדפן');
    }
  };

  const handleCopyToken = async () => {
    if (!tokenValue || !navigator?.clipboard) return;
    try {
      await navigator.clipboard.writeText(tokenValue);
      setCopyMessage('הטוקן הועתק ללוח!');
      setTimeout(() => setCopyMessage(''), 3000);
    } catch (error) {
      setCopyMessage('לא הצלחתי להעתיק ללוח, העתיק ידנית.');
    }
  };

  return (
    <div className="api-setup-page">
      <div className="page-header">
        <div className="page-title">
          <h1>API לשליפת יעד חודשי לקטגוריה</h1>
          <p className="text-muted">
            מדריך מלא להרצת <code>/api/category-monthly-target</code> גם בסביבת פיתוח מקומית וגם בפרודקשן ב-Render.
          </p>
        </div>
        <div className="page-actions">
          <button className="btn btn-secondary" onClick={() => window.history.back()}>
            ← חזרה לטעינת קבצים
          </button>
        </div>
      </div>

      <div className="warning-card">
        <h2>⚠️ דרישות אבטחה והרשאות</h2>
        <p>
          הממשק הזה זמין לך גם מקומית וגם לאחר deploy ל-Render, אבל תמיד מגודר לפי המשתמש שמחובר.
          הקריאות נשענות על הטוקן האישי שלך ולכן אין לשתף URLים עם אנשים אחרים או להריץ מהדפדפן של מישהו אחר.
        </p>
        <ul>
          <li>
            <strong>לקוח</strong>: <code>http://localhost:4000</code> (פיתוח) או <code>https://budget-app-project-benj.onrender.com/dashboard</code> (פרודקשן)
          </li>
          <li>
            <strong>API</strong>: <code>http://localhost:5001/api/category-monthly-target</code> (פיתוח) או <code>https://budget-app-project-benj.onrender.com/api/category-monthly-target</code> (פרודקשן)
          </li>
          <li>חובה להיות מחובר כדי להחזיק JWT ב-<code>localStorage.token</code>.</li>
        </ul>
      </div>

      <div className="token-card">
        <div>
          <h2>🎫 הפקת טוקן</h2>
          <p>
            לחץ על הכפתור כדי לשלוף את הטוקן הפעיל. זה אותו טוקן שתכניס לקריאות ה-GET.
          </p>
          <button className="btn btn-primary" onClick={handleShowToken}>
            📥 הצג את הטוקן שלי
          </button>
        </div>
        {(tokenValue || tokenError) && (
          <div className="token-box">
            {tokenError ? (
              <p className="token-error">{tokenError}</p>
            ) : (
              <>
                <code>{tokenValue}</code>
                <div className="token-actions">
                  <button className="btn btn-light" onClick={handleCopyToken}>
                    📋 העתק טוקן
                  </button>
                  {copyMessage && <small>{copyMessage}</small>}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      <div className="api-setup-grid">
        <section className="api-setup-card">
          <h2>1. השאילתה המקורית</h2>
          <p>
            עבור בדיקות SQL יש לך את השאילתה הזו. היא בדיוק מה שה-API מריץ עבורך מאחורי הקלעים,
            רק עם שלושה פרמטרים שניתן לשנות בזמן אמת.
          </p>
          <div className="code-block">
            <pre>{sqlQuery}</pre>
          </div>
          <p className="note">
            השורות המודגשות בהערות הן אלו שמוחלפות בפרמטרים שחולפים ב-URL של ה-API.
          </p>
        </section>

        <section className="api-setup-card">
          <h2>2. שלושת ההגדרות המשתנות</h2>
          <ul>
            <li>
              <code>user_id</code> – משתמש היעד. ברירת המחדל היא המשתמש שמחובר כרגע,
              אבל אפשר להעביר מזהה אחר אם אתה אדמין.
            </li>
            <li>
              <code>flow_month</code> – תזרים החודש בתצורת <code>YYYY-MM</code>. זה קובע על איזה חודש נבצע הצלבה עם היעד.
            </li>
            <li>
              <code>category_name</code> – שם הקטגוריה בדיוק כפי שהוא קיים ב-<code>category_order</code>.
            </li>
          </ul>
          <p className="note">
            כולם נשלחים כפרמטרים ב-query string, כך שתוכל להעתיק את אותו URL ולהחליף ערכים בקלות.
          </p>
        </section>

        <section className="api-setup-card">
          <h2>3. קריאת cURL לדוגמה</h2>
          <p>מומלץ להשתמש ב-<code>--data-urlencode</code> כדי לטפל בשמות קטגוריה בעברית.</p>
          <div className="code-block">
            <pre>{curlExample}</pre>
          </div>
          <p className="note">
            החלף את <code>&lt;TOKEN&gt;</code> בטוקן ששלפת מלמעלה. בקשות GET יחזירו מערך של רשומה אחת (או ריק אם אין יעד).
          </p>
        </section>

        <section className="api-setup-card">
          <h2>4. שימוש ב-JavaScript</h2>
          <p>תוכל להריץ את הדוגמה הזו בקונסולת הדפדפן או בכל סקריפט Node.js מקומי.</p>
          <div className="code-block">
            <pre>
              <code>{javascriptExample}</code>
            </pre>
          </div>
        </section>

        <section className="api-setup-card">
          <h2>5. איך נראית התשובה?</h2>
          <p>התגובה היא מערך JSON. כל אובייקט מכיל את ארבעת השדות מהשאילתה המקורית.</p>
          <div className="code-block">
            <pre>{responseExample}</pre>
          </div>
          <p className="note">
            אם אין עסקאות לחודש או קטגוריה שביקשת, תחזור רשימה ריקה <code>[]</code>. אם יש שגיאת הרשאות תראה 403.
          </p>
        </section>
      </div>
    </div>
  );
};

export default CategoryMonthlyTargetApiSetup;
