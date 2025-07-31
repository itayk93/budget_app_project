import React, { useState, useEffect } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../services/api';
import './Auth.css';

const VerifyEmail = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { updateUser } = useAuth();
  const token = searchParams.get('token');

  const [loading, setLoading] = useState(true);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) {
      setError('Invalid or missing verification token');
      setLoading(false);
      return;
    }

    verifyEmail();
  }, [token]);

  const verifyEmail = async () => {
    try {
      const response = await api.post('/auth/verify-email', { token });
      setSuccess(true);
      
      // Update user context to reflect email verification
      updateUser(prevUser => ({
        ...prevUser,
        emailVerified: true
      }));

      // Redirect to dashboard after 3 seconds
      setTimeout(() => {
        navigate('/dashboard', { 
          state: { message: 'Email verified successfully!' }
        });
      }, 3000);
    } catch (err) {
      if (err.response?.status === 400) {
        setError('Verification link has expired or is invalid. Please request a new one.');
      } else {
        setError(err.response?.data?.error || 'Failed to verify email');
      }
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="auth-container">
        <div className="auth-card">
          <div className="auth-header">
            <div className="loading-icon">
              <div className="spinner large"></div>
            </div>
            <h1>מאמת את המייל שלך...</h1>
            <p>אנא המתן בזמן שאנחנו מאמתים את כתובת המייל שלך</p>
          </div>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="auth-container">
        <div className="auth-card success-card">
          <div className="auth-header">
            <div className="success-icon">✅</div>
            <h1>המייל אומת בהצלחה!</h1>
            <p>כתובת המייל שלך אומתה והחשבון שלך פעיל</p>
          </div>

          <div className="success-content">
            <div className="message-box">
              <p>מעולה! כתובת המייל שלך אומתה בהצלחה. עכשיו תוכל להשתמש בכל הפיצ'רים של BudgetLens.</p>
            </div>

            <div className="benefits">
              <h3>מה זה נותן לך?</h3>
              <ul>
                <li>✅ גישה מלאה לכל הפיצ'רים</li>
                <li>📧 קבלת התראות חשובות</li>
                <li>🔐 אבטחה משופרת לחשבון</li>
                <li>📊 שמירת נתונים בענן</li>
              </ul>
            </div>

            <div className="countdown">
              <div className="spinner"></div>
              <p>מעביר אותך לדשבורד...</p>
            </div>

            <div className="auth-footer">
              <Link to="/dashboard" className="btn-primary">
                🚀 התחל להשתמש במערכת
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-container">
      <div className="auth-card error-card">
        <div className="auth-header">
          <div className="error-icon">⚠️</div>
          <h1>בעיה באימות המייל</h1>
          <p>לא הצלחנו לאמת את כתובת המייל שלך</p>
        </div>

        <div className="error-content">
          <div className="alert alert-error">
            <span className="alert-icon">❌</span>
            {error}
          </div>

          <div className="troubleshooting">
            <h3>מה אפשר לעשות?</h3>
            <ul>
              <li>🔗 ודא שהקישור לא פג תוקף (24 שעות)</li>
              <li>📧 בדק שהקישור הועתק במלואו</li>
              <li>🔄 נסה לבקש קישור אימות חדש</li>
              <li>📞 צור קשר עם התמיכה אם הבעיה נמשכת</li>
            </ul>
          </div>

          <div className="auth-footer">
            <Link to="/profile" className="btn-primary">
              📨 שלח קישור אימות חדש
            </Link>
            <p>
              <Link to="/dashboard" className="auth-link">חזור לדשבורד</Link>
            </p>
            <p>
              <Link to="/login" className="auth-link">התחבר שוב</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VerifyEmail;