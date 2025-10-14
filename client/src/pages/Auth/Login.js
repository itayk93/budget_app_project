import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

const Login = () => {
  const [formData, setFormData] = useState({
    username: '',
    password: ''
  });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [showPassword, setShowPassword] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();

  // Handle input focus states for floating labels
  const [focusedInput, setFocusedInput] = useState(null);

  const handleInputFocus = (inputName) => {
    setFocusedInput(inputName);
  };

  const handleInputBlur = (inputName) => {
    if (!formData[inputName]) {
      setFocusedInput(null);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.username.trim()) {
      newErrors.username = 'שם משתמש או אימייל נדרשים';
    }

    if (!formData.password) {
      newErrors.password = 'סיסמה נדרשת';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleDemoLogin = async () => {
    setErrors({});
    setLoading(true);
    
    try {
      console.log('🎭 Attempting demo login...');
      
      const response = await fetch('/api/demo/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      const data = await response.json();
      
      if (data.success) {
        // Store token and user info
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        
        console.log('✅ Demo login successful, redirecting to dashboard...');
        
        // Redirect to dashboard
        navigate('/dashboard');
      } else {
        setErrors({ general: data.error || 'שגיאה בכניסה לדמו' });
      }
    } catch (error) {
      console.error('❌ Demo login error:', error);
      setErrors({ general: 'שגיאה בהתחברות לדמו. נסו שוב מאוחר יותר.' });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    setLoading(true);
    try {
      await login(formData);
      // Redirect to dashboard after successful login
      navigate('/dashboard');
    } catch (error) {
      console.error('Login failed:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-5 px-5 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute -top-1/2 -right-1/2 w-full h-full opacity-5">
        <div className="w-full h-full bg-gradient-to-br from-primary via-accent to-primary animate-rotate-bg"></div>
      </div>

      <div className="bg-white rounded-lg shadow-material-2 w-full max-w-md relative z-10 overflow-hidden transition-shadow duration-300 hover:shadow-material-3 animate-fade-in-up">
        <div className="px-8 pt-10 pb-6 text-center bg-white relative">
          <div className="flex items-center justify-center mb-6 gap-3">
            <img 
              src="/logo.svg" 
              alt="BudgetLens" 
              className="h-12 w-auto drop-shadow-sm"
              onError={(e) => {
                e.target.style.display = 'none';
                e.target.nextSibling.style.display = 'block';
              }}
            />
            <span className="text-2xl font-medium text-primary hidden">
              BudgetLens
            </span>
          </div>
          <h1 className="text-3xl font-normal text-gray-900 mb-2 tracking-tight">התחברות</h1>
          <p className="text-sm text-gray-600 leading-relaxed m-0 mb-4">
            ברוכים הבאים חזרה למערכת ניהול התקציב שלכם
          </p>
          
          {/* Notice about closed registration */}
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
            <div className="flex items-center mb-2">
              <svg className="w-5 h-5 text-amber-600 ml-2" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <h3 className="text-sm font-medium text-amber-800">האתר סגור להרשמה חדשה</h3>
            </div>
            <p className="text-sm text-amber-700 mb-3">
              כרגע איננו מקבלים משתמשים חדשים. אם תרצו לראות איך המערכת עובדת, תוכלו לעבור לגרסת הדמו עם נתונים לדוגמה.
            </p>
            <button
              type="button"
              onClick={handleDemoLogin}
              className="w-full bg-amber-100 hover:bg-amber-200 text-amber-800 border border-amber-300 rounded py-2 px-4 text-sm font-medium transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2"
            >
              🎯 כניסה לדמו האתר
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="px-8 pb-8">
          <div className={`input-group relative mb-8 ${focusedInput === 'username' || formData.username ? 'focused has-value' : ''}`}>
            <input
              type="text"
              id="username"
              name="username"
              value={formData.username}
              onChange={handleChange}
              onFocus={() => handleInputFocus('username')}
              onBlur={() => handleInputBlur('username')}
              className={`w-full h-14 pt-4 pb-2 px-4 font-roboto text-base font-normal text-gray-900 bg-transparent border-0 border-b outline-none transition-colors duration-300 text-right relative z-10 ${
                errors.username ? 'border-error animate-shake' : 'border-gray-300 focus:border-primary'
              }`}
              required
              disabled={loading}
              placeholder=" "
            />
            <label htmlFor="username" className={`absolute right-4 top-5 text-base text-gray-400 transition-all duration-300 pointer-events-none transform-origin-right ${
              (focusedInput === 'username' || formData.username) && !errors.username ? 'text-primary -translate-y-3 scale-75' : 
              errors.username ? 'text-error -translate-y-3 scale-75' : ''
            }`}>
              שם משתמש או אימייל
            </label>
            <div className={`absolute bottom-0 right-0 h-0.5 transition-all duration-300 ${
              errors.username ? 'w-full bg-error' : 
              focusedInput === 'username' ? 'w-full bg-primary' : 'w-0 bg-primary'
            }`}></div>
            {errors.username && (
              <div className="absolute -bottom-5 right-4 text-xs text-error opacity-100 translate-y-0 transition-all duration-300">
                {errors.username}
              </div>
            )}
          </div>

          <div className={`input-group relative mb-8 ${focusedInput === 'password' || formData.password ? 'focused has-value' : ''}`}>
            <input
              type={showPassword ? "text" : "password"}
              id="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              onFocus={() => handleInputFocus('password')}
              onBlur={() => handleInputBlur('password')}
              className={`w-full h-14 pt-4 pb-2 px-4 pr-12 font-roboto text-base font-normal text-gray-900 bg-transparent border-0 border-b outline-none transition-colors duration-300 text-right relative z-10 ${
                errors.password ? 'border-error animate-shake' : 'border-gray-300 focus:border-primary'
              }`}
              required
              disabled={loading}
              placeholder=" "
            />
            <label htmlFor="password" className={`absolute right-4 top-5 text-base text-gray-400 transition-all duration-300 pointer-events-none transform-origin-right ${
              (focusedInput === 'password' || formData.password) && !errors.password ? 'text-primary -translate-y-3 scale-75' : 
              errors.password ? 'text-error -translate-y-3 scale-75' : ''
            }`}>
              סיסמה
            </label>
            <button
              type="button"
              className="absolute left-3 top-1/2 transform -translate-y-1/2 bg-transparent border-none cursor-pointer p-2 rounded-full transition-colors duration-200 hover:bg-gray-100 z-20 focus:outline-2 focus:outline-primary focus:outline-offset-2"
              onClick={() => setShowPassword(!showPassword)}
              disabled={loading}
            >
              <svg viewBox="0 0 24 24" className="w-6 h-6 text-gray-400 hover:text-gray-600 transition-colors duration-200" fill="currentColor">
                {showPassword ? (
                  <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/>
                ) : (
                  <path d="M12 7c2.76 0 5 2.24 5 5 0 .65-.13 1.26-.36 1.83l2.92 2.92c1.51-1.26 2.7-2.89 3.43-4.75-1.73-4.39-6-7.5-11-7.5-1.4 0-2.74.25-3.98.7l2.16 2.16C10.74 7.13 11.35 7 12 7zM2 4.27l2.28 2.28.46.46C3.08 8.3 1.78 10.02 1 12c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.84l.42.42L19.73 22 21 20.73 3.27 3 2 4.27zM7.53 9.8l1.55 1.55c-.05.21-.08.43-.08.65 0 1.66 1.34 3 3 3 .22 0 .44-.03.65-.08l1.55 1.55c-.67.33-1.41.53-2.2.53-2.76 0-5-2.24-5-5 0-.79.2-1.53.53-2.2zm4.31-.78l3.15 3.15.02-.16c0-1.66-1.34-3-3-3l-.17.01z"/>
                )}
              </svg>
            </button>
            <div className={`absolute bottom-0 right-0 h-0.5 transition-all duration-300 ${
              errors.password ? 'w-full bg-error' : 
              focusedInput === 'password' ? 'w-full bg-primary' : 'w-0 bg-primary'
            }`}></div>
            {errors.password && (
              <div className="absolute -bottom-5 right-4 text-xs text-error opacity-100 translate-y-0 transition-all duration-300">
                {errors.password}
              </div>
            )}
          </div>

          <div className="flex justify-start mb-8">
            <Link 
              to="/forgot-password" 
              className="text-sm text-primary font-medium transition-colors duration-200 hover:text-primary-dark hover:underline py-2"
            >
              שכחת את הסיסמה?
            </Link>
          </div>

          {errors.general && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm text-red-600">{errors.general}</p>
            </div>
          )}

          <button
            type="submit"
            className="w-full h-12 bg-primary text-white border-none rounded font-roboto text-base font-medium cursor-pointer relative overflow-hidden transition-all duration-300 shadow-material-1 flex items-center justify-center gap-2 hover:bg-primary-dark hover:shadow-material-2 hover:-translate-y-px active:translate-y-0 active:shadow-material-1 disabled:bg-gray-400 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none"
            disabled={loading}
          >
            <span className="relative z-10">
              {loading ? 'מתחבר...' : 'התחבר'}
            </span>
            {loading && (
              <div className="w-5 h-5 border-2 border-white border-opacity-30 border-t-white rounded-full animate-spin"></div>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;