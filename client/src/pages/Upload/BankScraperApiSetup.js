import React, { useState } from 'react';
import './BankScraperApiSetup.css';

const exampleScript = `const API_BASE_URL = 'http://localhost:5001/api';
const token = localStorage.getItem('token');

async function runFullBankScraperPipeline() {
  if (!token) {
    throw new Error('חסר טוקן. התחבר ל- http://localhost:4000 לפני ההרצה.');
  }

  const headers = {
    'Content-Type': 'application/json',
    Authorization: \`Bearer \${token}\`,
  };

  const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split('T')[0];

  await fetch(\`\${API_BASE_URL}/bank-scraper/configs/bulk/scrape\`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ includeInactive: false, startDate }),
  });

  await fetch(\`\${API_BASE_URL}/bank-scraper/configs/bulk/queue-for-approval\`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ includeInactive: false }),
  });

  const pendingRes = await fetch(\`\${API_BASE_URL}/bank-scraper/pending?limit=500\`, {
    headers,
  });
  const pendingPayload = await pendingRes.json();

  const mainCashFlowId = '<<הכנס כאן את מזהה התזרים הראשי שלך>>';

  await fetch(\`\${API_BASE_URL}/upload/finalize\`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      uploadId: \`bank-scraper-\${Date.now()}\`,
      cashFlowId: mainCashFlowId,
      fileSource: 'bank_scraper',
      transactions: pendingPayload.transactions,
      duplicateActions: {},
      deletedIndices: [],
    }),
  });
}

runFullBankScraperPipeline().catch(console.error);`;

const BankScraperApiSetup = () => {
  const [tokenValue, setTokenValue] = useState(null);
  const [tokenError, setTokenError] = useState(null);
  const [copyMessage, setCopyMessage] = useState('');

  const handleShowToken = () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setTokenValue(null);
        setTokenError('לא נמצא טוקן ב-localStorage. התחבר מחדש ל- http://localhost:4000 וניס את הכפתור שוב.');
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
          <h1>מסך הגדרת API לכפתור הכרייה והטעינה</h1>
          <p className="text-muted">
            כאן תמצא את כל מה שצריך כדי להריץ את אותו ה-ETL החדש דרך API מקומי באמצעות המשתמש המחובר שלך.
          </p>
        </div>
        <div className="page-actions">
          <button className="btn btn-secondary" onClick={() => window.history.back()}>
            ← חזרה לטעינת קבצים
          </button>
        </div>
      </div>

      <div className="warning-card">
        <h2>⚠️ חשוב לדעת</h2>
        <p>
          הממשק האוטומטי הזה מיועד להרצה מ-<strong>localhost</strong> בלבד בזמן פיתוח.
          אסור לחשוף את הקריאות האלו החוצה לאחר deploy כיוון שהן נשענות על טוקן המשתמש המחובר
          ועל הרשאות admin של השרת המקומי.
        </p>
        <ul>
          <li>URL הלקוח: <code>http://localhost:4000</code></li>
          <li>API מקומי: <code>http://localhost:5001/api</code></li>
          <li>נדרש להיות מחובר למערכת כך שה-JWT יופיע ב-localStorage תחת <code>token</code>.</li>
        </ul>
      </div>

      <div className="token-card">
        <div>
          <h2>🎫 הפקת טוקן מקומי</h2>
          <p>
            לחץ על הכפתור כדי לשלוף את ה-JWT שמאוחסן אצלך ב-localStorage. הטוקן משמש אותך בסקריפטים ובקריאות API
            ולכן שמור עליו היטב. אם קיבלת שגיאה התחבר מחדש ואז נסה שוב.
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
          <h2>1. מה הכפתור עושה?</h2>
          <p>לחיצה על "🤖 הרץ כרייה + טעינה אוטומטית" מפעילה שלושה שלבים רצופים:</p>
          <ol>
            <li>POST <code>/bank-scraper/configs/bulk/scrape</code> – מריץ כריית נתונים לכל הקונפיגורציות הפעילות שלך.</li>
            <li>POST <code>/bank-scraper/configs/bulk/queue-for-approval</code> – ממיר את העסקאות שנכרו לפורמט הטעינה ומעביר אותן לתור האישור.</li>
            <li>טעינת העסקאות מהתור לתזרים הראשי באמצעות <code>/bank-scraper/pending</code> ולאחר מכן <code>/upload/finalize</code>.</li>
          </ol>
        </section>

        <section className="api-setup-card">
          <h2>2. הגדרת סביבת פיתוח</h2>
          <ul>
            <li>הרץ <code>npm run dev</code> בספריית הפרויקט הראשית כדי לפתוח גם את השרת (5001) וגם את הלקוח (4000).</li>
            <li>ודא שקובץ <code>.env</code> של השרת מכיל את מפתחות Supabase ואת ההגדרות של הסקרייפר.</li>
            <li>אם אתה רוצה לגשת ל-API מהקוד בצד הלקוח, הגדר בקובץ <code>client/.env</code> את <code>REACT_APP_API_URL=http://localhost:5001/api</code> והפעל מחדש את הלקוח.</li>
            <li>התחבר ליישום ב-<code>http://localhost:4000</code>. לאחר ההתחברות ה-JWT שלך יישמר ב-<code>localStorage.token</code>.</li>
          </ul>
        </section>

        <section className="api-setup-card">
          <h2>3. קריאות API לדוגמה (cURL)</h2>
          <p>החלף את <code>&lt;TOKEN&gt;</code> בטוקן שקיבלת מהדפדפן.</p>
          <div className="code-block">
            <pre>{`# שלב 1 - כרייה
curl -X POST http://localhost:5001/api/bank-scraper/configs/bulk/scrape \\
  -H "Authorization: Bearer <TOKEN>" \\
  -H "Content-Type: application/json" \\
  -d '{"includeInactive": false, "startDate": "2025-10-15"}'

# שלב 2 - תור אישור
curl -X POST http://localhost:5001/api/bank-scraper/configs/bulk/queue-for-approval \\
  -H "Authorization: Bearer <TOKEN>" \\
  -H "Content-Type: application/json" \\
  -d '{"includeInactive": false}'

# שלב 3 - טעינה לתזרים
curl -X POST http://localhost:5001/api/upload/finalize \\
  -H "Authorization: Bearer <TOKEN>" \\
  -H "Content-Type: application/json" \\
  -d '{ "uploadId": "bank-scraper-cli", "cashFlowId": "YOUR_MAIN_CASH_FLOW_ID", "fileSource": "bank_scraper", "transactions": [...], "duplicateActions": {}, "deletedIndices": [] }'`}</pre>
          </div>
          <p className="note">
            כדי לבנות את מערך <code>transactions</code> תוכל למשוך את כל העסקאות הממתינות באמצעות
            <code> GET /bank-scraper/pending?limit=500</code> – התגובה מחזירה <code>transactions</code> בפורמט שהשרת מצפה לו.
          </p>
        </section>

        <section className="api-setup-card">
          <h2>4. סקריפט JavaScript לדוגמה</h2>
          <p>
            ניתן להריץ את הסקריפט הבא ישירות מקונסולת הדפדפן ב-<code>http://localhost:4000/upload</code> או מקובץ Node.js
            (רק אל תשכח לטעון את הטוקן לפני הרצה).
          </p>
          <div className="code-block">
            <pre>
              <code>{exampleScript}</code>
            </pre>
          </div>
        </section>

        <section className="api-setup-card">
          <h2>5. טיפים למשתמש המחובר</h2>
          <ul>
            <li>הטוקן שומר את זהות המשתמש שלך, לכן כל קריאה תבוצע על אותם משתמשים בדיוק כפי שקורה בכפתור.</li>
            <li>אם קיבלת שגיאת הרשאות, התחבר מחדש ותרענן את הטוקן ב-localStorage.</li>
            <li>הסקריפט מניח שיש תזרים ראשי (cash flow) מסומן כברירת מחדל. אפשר לראות את המזהים בעמוד "תזרימי מזומנים".</li>
            <li>בכל קריאה ניתן לשנות את טווח התאריכים של הכרייה באמצעות הפרמטר <code>startDate</code>.</li>
          </ul>
        </section>
      </div>
    </div>
  );
};

export default BankScraperApiSetup;
