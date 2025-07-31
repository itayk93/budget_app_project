import React, { useState, useEffect } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import api from '../../services/api';
import './Auth.css';

const ResetPassword = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');

  const [formData, setFormData] = useState({
    newPassword: '',
    confirmPassword: ''
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [tokenValid, setTokenValid] = useState(true);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  useEffect(() => {
    if (!token) {
      setError('Invalid or missing reset token');
      setTokenValid(false);
    }
  }, [token]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const validatePassword = (password) => {
    if (password.length < 6) {
      return 'Password must be at least 6 characters long';
    }
    return null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    setError('');

    // Validate passwords
    const passwordError = validatePassword(formData.newPassword);
    if (passwordError) {
      setError(passwordError);
      setLoading(false);
      return;
    }

    if (formData.newPassword !== formData.confirmPassword) {
      setError('Passwords do not match');
      setLoading(false);
      return;
    }

    try {
      const response = await api.post('/auth/reset-password', {
        token,
        newPassword: formData.newPassword
      });
      
      setMessage(response.data.message);
      setSuccess(true);
      
      // Redirect to login after 3 seconds
      setTimeout(() => {
        navigate('/login', { 
          state: { message: 'Password reset successfully. Please log in with your new password.' }
        });
      }, 3000);
    } catch (err) {
      if (err.response?.status === 400) {
        setError('Reset link has expired or is invalid. Please request a new one.');
        setTokenValid(false);
      } else {
        setError(err.response?.data?.error || 'Failed to reset password');
      }
    } finally {
      setLoading(false);
    }
  };

  if (!tokenValid) {
    return (
      <div className="auth-container">
        <div className="auth-card error-card">
          <div className="auth-header">
            <div className="error-icon">⚠️</div>
            <h1>קישור לא תקין</h1>
            <p>הקישור לאיפוס סיסמה פג תוקף או לא תקין</p>
          </div>

          <div className="error-content">
            <div className="message-box">
              <p>ייתכן שהקישור פג תוקף (60 דקות) או שכבר נעשה בו שימוש.</p>
            </div>

            <div className="auth-footer">
              <Link to="/forgot-password" className="btn-primary">
                🔄 בקש קישור חדש
              </Link>
              <p>
                <Link to="/login" className="auth-link">חזור לעמוד הכניסה</Link>
              </p>
            </div>
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
            <h1>הסיסמה שונתה בהצלחה!</h1>
            <p>עכשיו תוכל להתחבר עם הסיסמה החדשה</p>
          </div>

          <div className="success-content">
            <div className="message-box">
              <p>הסיסמה שלך עודכנה בהצלחה. אתה מועבר אוטומטית לעמוד הכניסה...</p>
            </div>

            <div className="countdown">
              <div className="spinner"></div>
              <p>מעביר אותך לעמוד הכניסה...</p>
            </div>

            <div className="auth-footer">
              <Link to="/login" className="btn-primary">
                🚀 התחבר עכשיו
              </Link>
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
          <h1>איפוס סיסמה</h1>
          <p>הגדר סיסמה חדשה לחשבון שלך</p>
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
            <label htmlFor="newPassword">סיסמה חדשה</label>
            <div className="password-input-container">
              <input
                type={showNewPassword ? "text" : "password"}
                id="newPassword"
                name="newPassword"
                value={formData.newPassword}
                onChange={handleChange}
                placeholder="הכנס סיסמה חדשה"
                required
                minLength="6"
                autoFocus
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowNewPassword(!showNewPassword)}
                aria-label={showNewPassword ? "הסתר סיסמה" : "הצג סיסמה"}
              >
                {showNewPassword ? "🙈" : "👁️"}
              </button>
            </div>
            <small className="form-help">
              הסיסמה חייבת להכיל לפחות 6 תווים
            </small>
          </div>

          <div className="form-group">
            <label htmlFor="confirmPassword">אימות סיסמה</label>
            <div className="password-input-container">
              <input
                type={showConfirmPassword ? "text" : "password"}
                id="confirmPassword"
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleChange}
                placeholder="הכנס את הסיסמה שוב"
                required
                minLength="6"
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                aria-label={showConfirmPassword ? "הסתר סיסמה" : "הצג סיסמה"}
              >
                {showConfirmPassword ? "🙈" : "👁️"}
              </button>
            </div>
          </div>

          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? (
              <>
                <span className="spinner"></span>
                מעדכן סיסמה...
              </>
            ) : (
              '🔄 עדכן סיסמה'
            )}
          </button>
        </form>

        <div className="password-requirements">
          <h4>דרישות לסיסמה:</h4>
          <ul>
            <li className={formData.newPassword.length >= 6 ? 'valid' : ''}>
              לפחות 6 תווים
            </li>
            <li className={formData.newPassword === formData.confirmPassword && formData.confirmPassword ? 'valid' : ''}>
              הסיסמאות תואמות
            </li>
          </ul>
        </div>

        <div className="auth-footer">
          <p>
            זכרת את הסיסמה? <Link to="/login" className="auth-link">חזור לכניסה</Link>
          </p>
        </div>

        <div className="security-notice">
          <div className="notice-icon">🛡️</div>
          <div className="notice-content">
            <h4>הערת אבטחה</h4>
            <p>לאחר שינוי הסיסמה, תתנתק אוטומטית מכל המכשירים האחרים.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ResetPassword;