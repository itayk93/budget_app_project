import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../services/api';
import './Auth.css';

const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [emailSent, setEmailSent] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    setError('');

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError('Please enter a valid email address');
      setLoading(false);
      return;
    }

    try {
      const response = await api.post('/auth/forgot-password', { email });
      setMessage(response.data.message);
      setEmailSent(true);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to send reset email');
    } finally {
      setLoading(false);
    }
  };

  if (emailSent) {
    return (
      <div className="auth-container">
        <div className="auth-card success-card">
          <div className="auth-header">
            <div className="success-icon">📧</div>
            <h1>מייל נשלח בהצלחה!</h1>
            <p>בדק את תיבת המייל שלך</p>
          </div>

          <div className="success-content">
            <div className="message-box">
              <p>שלחנו לך מייל עם קישור לאיפוס הסיסמה לכתובת:</p>
              <div className="email-display">{email}</div>
            </div>

            <div className="instructions">
              <h3>מה עכשיו?</h3>
              <ol>
                <li>בדק את תיבת המייל שלך (כולל תיקיית הספאם)</li>
                <li>לחץ על הקישור במייל</li>
                <li>הגדר סיסמה חדשה</li>
                <li>התחבר עם הסיסמה החדשה</li>
              </ol>
            </div>

            <div className="auth-footer">
              <p>
                זכרת את הסיסמה? <Link to="/login" className="auth-link">חזור לכניסה</Link>
              </p>
              <p>
                לא קיבלת מייל? 
                <button 
                  className="link-button" 
                  onClick={() => {
                    setEmailSent(false);
                    setMessage('');
                    setError('');
                  }}
                >
                  נסה שוב
                </button>
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header">
          <div className="auth-icon">🔐</div>
          <h1>שכחת סיסמה?</h1>
          <p>הכנס את כתובת המייל שלך ונשלח לך קישור לאיפוס</p>
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

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label htmlFor="email">כתובת מייל</label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="הכנס את כתובת המייל שלך"
              required
              autoFocus
            />
          </div>

          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? (
              <>
                <span className="spinner"></span>
                שולח מייל...
              </>
            ) : (
              '📨 שלח קישור איפוס'
            )}
          </button>
        </form>

        <div className="auth-footer">
          <p>
            זכרת את הסיסמה? <Link to="/login" className="auth-link">חזור לכניסה</Link>
          </p>
          <p>
            אין לך חשבון? <Link to="/register" className="auth-link">הירשם כאן</Link>
          </p>
        </div>

        <div className="security-notice">
          <div className="notice-icon">🛡️</div>
          <div className="notice-content">
            <h4>הערת אבטחה</h4>
            <p>הקישור לאיפוס סיסמה יהיה בתוקף ל-60 דקות בלבד מרגע השליחה.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;