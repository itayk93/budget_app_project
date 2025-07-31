import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../services/api';
import './Profile.css';

const Profile = () => {
  const { user, updateUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('profile');

  // Profile form state
  const [profileData, setProfileData] = useState({
    firstName: '',
    lastName: '',
    email: ''
  });

  // Password form state
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  useEffect(() => {
    if (user) {
      setProfileData({
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        email: user.email || ''
      });
    }
  }, [user]);

  const handleProfileChange = (e) => {
    const { name, value } = e.target;
    setProfileData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handlePasswordChange = (e) => {
    const { name, value } = e.target;
    setPasswordData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleProfileSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    setError('');

    try {
      const response = await api.put('/auth/profile', profileData);
      setMessage(response.data.message);
      
      // Update user context if user data changed
      if (response.data.user) {
        updateUser(response.data.user);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    setError('');

    // Validate passwords match
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setError('New passwords do not match');
      setLoading(false);
      return;
    }

    // Validate password strength
    if (passwordData.newPassword.length < 6) {
      setError('New password must be at least 6 characters long');
      setLoading(false);
      return;
    }

    try {
      const response = await api.post('/auth/change-password', {
        currentPassword: passwordData.currentPassword,
        newPassword: passwordData.newPassword
      });
      
      setMessage(response.data.message);
      setPasswordData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      });
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to change password');
    } finally {
      setLoading(false);
    }
  };

  const handleSendVerification = async () => {
    setLoading(true);
    setMessage('');
    setError('');

    try {
      const response = await api.post('/auth/send-verification');
      setMessage(response.data.message);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to send verification email');
    } finally {
      setLoading(false);
    }
  };

  const handleExportAllData = async () => {
    setLoading(true);
    setMessage('');
    setError('');

    try {
      const response = await api.get('/users/export-data', {
        responseType: 'blob'
      });
      
      // Create a download link
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `budget_data_${new Date().toISOString().split('T')[0]}.zip`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      
      setMessage('הנתונים יוצאו בהצלחה ורדו אוטומטית');
    } catch (err) {
      setError(err.response?.data?.error || 'שגיאה בייצוא הנתונים');
    } finally {
      setLoading(false);
    }
  };

  const handleExportTransactions = async () => {
    setLoading(true);
    setMessage('');
    setError('');

    try {
      const response = await api.get('/users/export-transactions', {
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `transactions_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      
      setMessage('העסקאות יוצאו בהצלחה');
    } catch (err) {
      setError(err.response?.data?.error || 'שגיאה בייצוא העסקאות');
    } finally {
      setLoading(false);
    }
  };

  const handleExportStocks = async () => {
    setLoading(true);
    setMessage('');
    setError('');

    try {
      const response = await api.get('/users/export-stocks', {
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `stocks_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      
      setMessage('נתוני המניות יוצאו בהצלחה');
    } catch (err) {
      setError(err.response?.data?.error || 'שגיאה בייצוא נתוني המניות');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="profile-container">
      <div className="profile-header">
        <h1>הגדרות פרופיל</h1>
        <p>נהל את המידע האישי והאבטחה של החשבון שלך</p>
      </div>

      <div className="profile-tabs">
        <button 
          className={`tab-button ${activeTab === 'profile' ? 'active' : ''}`}
          onClick={() => setActiveTab('profile')}
        >
          👤 פרטים אישיים
        </button>
        <button 
          className={`tab-button ${activeTab === 'password' ? 'active' : ''}`}
          onClick={() => setActiveTab('password')}
        >
          🔐 שינוי סיסמה
        </button>
        <button 
          className={`tab-button ${activeTab === 'security' ? 'active' : ''}`}
          onClick={() => setActiveTab('security')}
        >
          🛡️ אבטחה
        </button>
        <button 
          className={`tab-button ${activeTab === 'export' ? 'active' : ''}`}
          onClick={() => setActiveTab('export')}
        >
          📤 ייצוא נתונים
        </button>
      </div>

      {message && (
        <div className="alert alert-success">
          <span className="alert-icon">✅</span>
          {message}
        </div>
      )}

      {error && (
        <div className="alert alert-error">
          <span className="alert-icon">❌</span>
          {error}
        </div>
      )}

      <div className="profile-content">
        {activeTab === 'profile' && (
          <div className="tab-content">
            <div className="section-header">
              <h2>פרטים אישיים</h2>
              <p>עדכן את הפרטים האישיים שלך</p>
            </div>

            <form onSubmit={handleProfileSubmit} className="profile-form">
              <div className="form-group">
                <label htmlFor="firstName">שם פרטי</label>
                <input
                  type="text"
                  id="firstName"
                  name="firstName"
                  value={profileData.firstName}
                  onChange={handleProfileChange}
                  placeholder="הכנס את השם הפרטי שלך"
                />
              </div>

              <div className="form-group">
                <label htmlFor="lastName">שם משפחה</label>
                <input
                  type="text"
                  id="lastName"
                  name="lastName"
                  value={profileData.lastName}
                  onChange={handleProfileChange}
                  placeholder="הכנס את שם המשפחה שלך"
                />
              </div>

              <div className="form-group">
                <label htmlFor="email">כתובת מייל</label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={profileData.email}
                  onChange={handleProfileChange}
                  placeholder="הכנס את כתובת המייל שלך"
                />
                <small className="form-help">
                  שינוי כתובת המייל ידרוש אימות בכתובת החדשה
                </small>
              </div>

              <button type="submit" className="btn-primary" disabled={loading}>
                {loading ? '🔄 שומר...' : '💾 שמור שינויים'}
              </button>
            </form>
          </div>
        )}

        {activeTab === 'password' && (
          <div className="tab-content">
            <div className="section-header">
              <h2>שינוי סיסמה</h2>
              <p>הגדר סיסמה חדשה לחשבון שלך</p>
            </div>

            <form onSubmit={handlePasswordSubmit} className="password-form">
              <div className="form-group">
                <label htmlFor="currentPassword">סיסמה נוכחית</label>
                <input
                  type="password"
                  id="currentPassword"
                  name="currentPassword"
                  value={passwordData.currentPassword}
                  onChange={handlePasswordChange}
                  placeholder="הכנס את הסיסמה הנוכחית שלך"
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="newPassword">סיסמה חדשה</label>
                <input
                  type="password"
                  id="newPassword"
                  name="newPassword"
                  value={passwordData.newPassword}
                  onChange={handlePasswordChange}
                  placeholder="הכנס סיסמה חדשה"
                  required
                  minLength="6"
                />
                <small className="form-help">
                  הסיסמה חייבת להכיל לפחות 6 תווים
                </small>
              </div>

              <div className="form-group">
                <label htmlFor="confirmPassword">אימות סיסמה חדשה</label>
                <input
                  type="password"
                  id="confirmPassword"
                  name="confirmPassword"
                  value={passwordData.confirmPassword}
                  onChange={handlePasswordChange}
                  placeholder="הכנס את הסיסמה החדשה שוב"
                  required
                  minLength="6"
                />
              </div>

              <button type="submit" className="btn-primary" disabled={loading}>
                {loading ? '🔄 משנה...' : '🔐 שנה סיסמה'}
              </button>
            </form>

            <div className="password-tips">
              <h3>💡 טיפים לסיסמה חזקה:</h3>
              <ul>
                <li>השתמש בלפחות 8-12 תווים</li>
                <li>שלב אותיות גדולות וקטנות</li>
                <li>הוסף מספרים וסימנים מיוחדים</li>
                <li>אל תשתמש במידע אישי</li>
                <li>השתמש בסיסמה יחודית לכל שירות</li>
              </ul>
            </div>
          </div>
        )}

        {activeTab === 'security' && (
          <div className="tab-content">
            <div className="section-header">
              <h2>הגדרות אבטחה</h2>
              <p>נהל את הגדרות האבטחה של החשבון שלך</p>
            </div>

            <div className="security-section">
              <div className="security-item">
                <div className="security-info">
                  <h3>📧 אימות כתובת מייל</h3>
                  <p>
                    {user?.emailVerified 
                      ? 'כתובת המייל שלך מאומתת ✅' 
                      : 'כתובת המייל שלך עדיין לא אומתה ⚠️'
                    }
                  </p>
                </div>
                <div className="security-action">
                  {!user?.emailVerified && (
                    <button 
                      className="btn-secondary"
                      onClick={handleSendVerification}
                      disabled={loading}
                    >
                      {loading ? '🔄 שולח...' : '📨 שלח מייל אימות'}
                    </button>
                  )}
                </div>
              </div>

              <div className="security-item">
                <div className="security-info">
                  <h3>🕐 כניסה אחרונה</h3>
                  <p>
                    {user?.lastLogin 
                      ? new Date(user.lastLogin).toLocaleString('he-IL')
                      : 'לא זמין'
                    }
                  </p>
                </div>
              </div>

              <div className="security-item">
                <div className="security-info">
                  <h3>👤 פרטי החשבון</h3>
                  <p><strong>שם משתמש:</strong> {user?.username}</p>
                  <p><strong>מייל:</strong> {user?.email}</p>
                  <p><strong>תאריך הצטרפות:</strong> {user?.createdAt ? new Date(user.createdAt).toLocaleDateString('he-IL') : 'לא זמין'}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'export' && (
          <div className="tab-content">
            <div className="section-header">
              <h2>ייצוא נתונים</h2>
              <p>יצא את הנתונים שלך לגיבוי או שימוש חיצוני</p>
            </div>

            <div className="export-section">
              <div className="export-item">
                <div className="export-info">
                  <h3>📦 ייצוא כל הנתונים</h3>
                  <p>יצא את כל הנתונים שלך כולל עסקאות, מניות, קטגוריות והגדרות</p>
                  <small className="export-format">פורמט: קובץ ZIP עם קבצי CSV</small>
                </div>
                <div className="export-action">
                  <button 
                    className="btn-primary"
                    onClick={handleExportAllData}
                    disabled={loading}
                  >
                    {loading ? '🔄 מייצא...' : '📦 יצא הכל'}
                  </button>
                </div>
              </div>

              <div className="export-item">
                <div className="export-info">
                  <h3>💳 ייצוא עסקאות</h3>
                  <p>יצא את כל העסקאות הכספיות שלך</p>
                  <small className="export-format">פורמט: קובץ CSV</small>
                </div>
                <div className="export-action">
                  <button 
                    className="btn-secondary"
                    onClick={handleExportTransactions}
                    disabled={loading}
                  >
                    {loading ? '🔄 מייצא...' : '💳 יצא עסקאות'}
                  </button>
                </div>
              </div>

              <div className="export-item">
                <div className="export-info">
                  <h3>📈 ייצוא נתוני מניות</h3>
                  <p>יצא את נתוני תיק המניות והעסקאות שלך</p>
                  <small className="export-format">פורמט: קובץ CSV</small>
                </div>
                <div className="export-action">
                  <button 
                    className="btn-secondary"
                    onClick={handleExportStocks}
                    disabled={loading}
                  >
                    {loading ? '🔄 מייצא...' : '📈 יצא מניות'}
                  </button>
                </div>
              </div>

              <div className="export-info-box">
                <h3>💡 מידע על ייצוא הנתונים:</h3>
                <ul>
                  <li>כל הנתונים מיוצאים בפורמט CSV הפתוח</li>
                  <li>הקבצים מכילים כותרות בעברית לקריאות טובה יותר</li>
                  <li>הייצוא כולל רק נתונים ששייכים לחשבון שלך</li>
                  <li>קבצי הייצוא מתאימים לפתיחה ב-Excel או Google Sheets</li>
                  <li>הנתונים מיוצאים במצב הנוכחי ללא גרסאות היסטוריות</li>
                </ul>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Profile;