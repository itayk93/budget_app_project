import React, { useState, useEffect } from 'react';
import './BankScraperPage.css';

const BankScraperPage = () => {
    const [activeTab, setActiveTab] = useState('configs');
    const [configs, setConfigs] = useState([]);
    const [bankTypes, setBankTypes] = useState({});
    const [showAddForm, setShowAddForm] = useState(false);
    const [loading, setLoading] = useState(false);
    const [selectedConfig, setSelectedConfig] = useState(null);
    const [transactions, setTransactions] = useState([]);
    const [logs, setLogs] = useState([]);
    const [setupRequired, setSetupRequired] = useState(false);
    const [editingConfig, setEditingConfig] = useState(null);
    const [editForm, setEditForm] = useState({
        configName: '',
        credentials: {}
    });

    // New configuration form state
    const [newConfig, setNewConfig] = useState({
        configName: '',
        bankType: '',
        credentials: {}
    });

    const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001/api';

    // Fetch data on component mount
    useEffect(() => {
        fetchBankTypes();
        fetchConfigs();
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const fetchBankTypes = async () => {
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${API_BASE_URL}/bank-scraper/bank-types`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            const data = await response.json();
            if (data.success) {
                setBankTypes(data.bankTypes);
            }
        } catch (error) {
            console.error('Error fetching bank types:', error);
        }
    };

    const fetchConfigs = async () => {
        try {
            setLoading(true);
            const token = localStorage.getItem('token');
            const response = await fetch(`${API_BASE_URL}/bank-scraper/configs`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            const data = await response.json();
            if (data.success) {
                setConfigs(data.configs);
                setSetupRequired(false);
            } else if (data.needsSetup) {
                setSetupRequired(true);
            }
        } catch (error) {
            console.error('Error fetching configs:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleAddConfig = async (e) => {
        e.preventDefault();
        try {
            setLoading(true);
            const token = localStorage.getItem('token');
            const response = await fetch(`${API_BASE_URL}/bank-scraper/configs`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(newConfig)
            });

            const data = await response.json();
            if (data.success) {
                await fetchConfigs();
                setShowAddForm(false);
                setNewConfig({ configName: '', bankType: '', credentials: {} });
                alert('קונפיגורציה נוספה בהצלחה!');
            } else {
                alert(`שגיאה: ${data.error}`);
            }
        } catch (error) {
            console.error('Error adding config:', error);
            alert('שגיאה בהוספת הקונפיגורציה');
        } finally {
            setLoading(false);
        }
    };

    const handleRunScraper = async (configId) => {
        try {
            setLoading(true);
            const token = localStorage.getItem('token');
            const response = await fetch(`${API_BASE_URL}/bank-scraper/configs/${configId}/scrape`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
                })
            });

            const data = await response.json();
            if (data.success) {
                alert(data.message);
                await fetchConfigs();
            } else {
                let errorMessage = `שגיאה: ${data.error || data.errorMessage}`;
                if (data.suggestion) {
                    errorMessage += `\n\nהמלצה: ${data.suggestion}`;
                }
                if (data.errorType === 'TIMEOUT') {
                    errorMessage += '\n\nהסקריפה רצה עם דפדפן פתוח כדי שתוכל לראות מה קורה.';
                }
                alert(errorMessage);
            }
        } catch (error) {
            console.error('Error running scraper:', error);
            alert('שגיאה בהרצת הסקרייפר');
        } finally {
            setLoading(false);
        }
    };

    const fetchTransactions = async (configId) => {
        try {
            setLoading(true);
            const token = localStorage.getItem('token');
            const response = await fetch(`${API_BASE_URL}/bank-scraper/configs/${configId}/transactions`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            const data = await response.json();
            if (data.success) {
                setTransactions(data.transactions);
            }
        } catch (error) {
            console.error('Error fetching transactions:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchLogs = async (configId) => {
        try {
            setLoading(true);
            const token = localStorage.getItem('token');
            const response = await fetch(`${API_BASE_URL}/bank-scraper/configs/${configId}/logs`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            const data = await response.json();
            if (data.success) {
                setLogs(data.logs);
            }
        } catch (error) {
            console.error('Error fetching logs:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteConfig = async (configId) => {
        if (window.confirm('האם אתה בטוח שברצונך למחוק את הקונפיגורציה?')) {
            try {
                const token = localStorage.getItem('token');
                const response = await fetch(`${API_BASE_URL}/bank-scraper/configs/${configId}`, {
                    method: 'DELETE',
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });
                const data = await response.json();
                if (data.success) {
                    await fetchConfigs();
                    alert('קונפיגורציה נמחקה בהצלחה');
                }
            } catch (error) {
                console.error('Error deleting config:', error);
                alert('שגיאה במחיקת הקונפיגורציה');
            }
        }
    };

    const handleEditConfig = (config) => {
        setEditingConfig(config);
        setEditForm({
            configName: config.config_name,
            credentials: {}
        });
    };

    const handleUpdateConfig = async (e) => {
        e.preventDefault();
        try {
            setLoading(true);
            const token = localStorage.getItem('token');
            const response = await fetch(`${API_BASE_URL}/bank-scraper/configs/${editingConfig.id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(editForm)
            });

            const data = await response.json();
            if (data.success) {
                await fetchConfigs();
                setEditingConfig(null);
                setEditForm({ configName: '', credentials: {} });
                alert('קונפיגורציה עודכנה בהצלחה!');
            } else {
                alert(`שגיאה: ${data.error}`);
            }
        } catch (error) {
            console.error('Error updating config:', error);
            alert('שגיאה בעדכון הקונפיגורציה');
        } finally {
            setLoading(false);
        }
    };

    const toggleConfig = async (configId) => {
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${API_BASE_URL}/bank-scraper/configs/${configId}/toggle`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            const data = await response.json();
            if (data.success) {
                await fetchConfigs();
                alert(data.message);
            }
        } catch (error) {
            console.error('Error toggling config:', error);
            alert('שגיאה בשינוי סטטוס הקונפיגורציה');
        }
    };

    const renderCredentialsForm = (isEdit = false) => {
        const config = isEdit ? editForm : newConfig;
        const setConfig = isEdit ? setEditForm : setNewConfig;
        const selectedBankType = bankTypes[isEdit ? editingConfig.bank_type : newConfig.bankType];
        
        if (!selectedBankType) return null;

        return selectedBankType.credentials.map(field => (
            <div key={field} className="form-group">
                <label>{getFieldLabel(field)}:</label>
                <input
                    type={field.includes('password') || field.includes('Password') ? 'password' : 'text'}
                    value={config.credentials[field] || ''}
                    onChange={(e) => setConfig({
                        ...config,
                        credentials: {
                            ...config.credentials,
                            [field]: e.target.value
                        }
                    })}
                    required={!isEdit} // Only required for new configs
                    placeholder={isEdit ? 'השאר ריק אם לא רוצה לשנות' : ''}
                />
            </div>
        ));
    };

    const getFieldLabel = (field) => {
        const labels = {
            username: 'שם משתמש',
            password: 'סיסמה',
            userCode: 'קוד משתמש',
            id: 'תעודת זהות',
            num: 'קוד זיהוי',
            card6Digits: '6 ספרות אחרונות של הכרטיס',
            nationalID: 'תעודת זהות',
            email: 'דוא"ל'
        };
        return labels[field] || field;
    };

    return (
        <div className="bank-scraper-page">
            <div className="page-header">
                <h1>כורה נתוני הבנקים הישראליים</h1>
                <p>כלי לכריית נתונים ויבוא אוטומטי של נתוני חשבון מכל הבנקים הישראליים</p>
            </div>

            <div className="tabs">
                <button 
                    className={activeTab === 'configs' ? 'active' : ''}
                    onClick={() => setActiveTab('configs')}
                >
                    קונפיגורציות
                </button>
                <button 
                    className={activeTab === 'transactions' ? 'active' : ''}
                    onClick={() => setActiveTab('transactions')}
                >
                    עסקאות
                </button>
                <button 
                    className={activeTab === 'logs' ? 'active' : ''}
                    onClick={() => setActiveTab('logs')}
                >
                    יומני כריה
                </button>
                <button 
                    className={activeTab === 'guide' ? 'active' : ''}
                    onClick={() => setActiveTab('guide')}
                >
                    מדריך שימוש
                </button>
            </div>

            <div className="tab-content">
                {setupRequired && (
                    <div className="setup-required-banner">
                        <h3>🔧 נדרשת הגדרה חד פעמית</h3>
                        <p>
                            הטבלאות של Israeli Bank Scraper לא נוצרו עדיין במסד הנתונים. 
                            יש ליצור אותן פעם אחת ב-Supabase Dashboard.
                        </p>
                        <div className="setup-steps">
                            <strong>שלבי ההגדרה:</strong>
                            <ol>
                                <li>גש ל-<a href="https://app.supabase.com" target="_blank" rel="noopener noreferrer">Supabase Dashboard</a></li>
                                <li>בחר את הפרויקט שלך</li>
                                <li>עבור ל-<strong>"SQL Editor"</strong></li>
                                <li>לחץ על <strong>"New Query"</strong></li>
                                <li>העתק את הקוד מהקובץ <code>sql/israeli_bank_scraper_tables.sql</code></li>
                                <li>לחץ על <strong>"Run"</strong></li>
                                <li>רענן את הדף הזה</li>
                            </ol>
                        </div>
                        <button 
                            className="btn-primary"
                            onClick={() => window.location.reload()}
                        >
                            רענן דף לאחר יצירת הטבלאות
                        </button>
                    </div>
                )}

                {activeTab === 'configs' && (
                    <div className="configs-tab">
                        <div className="section-header">
                            <h2>קונפיגורציות בנק</h2>
                            <button 
                                className="btn-primary"
                                onClick={() => setShowAddForm(!showAddForm)}
                                disabled={setupRequired}
                            >
                                הוסף קונפיגורציה חדשה
                            </button>
                        </div>

                        {showAddForm && !editingConfig && (
                            <div className="add-config-form">
                                <h3>הוספת קונפיגורציה חדשה</h3>
                                <form onSubmit={handleAddConfig}>
                                    <div className="form-group">
                                        <label>שם הקונפיגורציה:</label>
                                        <input
                                            type="text"
                                            value={newConfig.configName}
                                            onChange={(e) => setNewConfig({...newConfig, configName: e.target.value})}
                                            placeholder="לדוגמה: חשבון הפועלים ראשי"
                                            required
                                        />
                                    </div>
                                    
                                    <div className="form-group">
                                        <label>בנק:</label>
                                        <select
                                            value={newConfig.bankType}
                                            onChange={(e) => setNewConfig({
                                                ...newConfig, 
                                                bankType: e.target.value,
                                                credentials: {}
                                            })}
                                            required
                                        >
                                            <option value="">בחר בנק</option>
                                            {Object.entries(bankTypes).map(([key, bank]) => (
                                                <option key={key} value={key}>{bank.name}</option>
                                            ))}
                                        </select>
                                    </div>

                                    {renderCredentialsForm()}

                                    <div className="form-actions">
                                        <button type="submit" className="btn-primary" disabled={loading}>
                                            {loading ? 'מוסיף...' : 'הוסף קונפיגורציה'}
                                        </button>
                                        <button 
                                            type="button" 
                                            className="btn-secondary"
                                            onClick={() => setShowAddForm(false)}
                                        >
                                            ביטול
                                        </button>
                                    </div>
                                </form>
                            </div>
                        )}

                        {editingConfig && (
                            <div className="edit-config-form">
                                <h3>עריכת קונפיגורציה: {editingConfig.config_name}</h3>
                                <form onSubmit={handleUpdateConfig}>
                                    <div className="form-group">
                                        <label>שם הקונפיגורציה:</label>
                                        <input
                                            type="text"
                                            value={editForm.configName}
                                            onChange={(e) => setEditForm({...editForm, configName: e.target.value})}
                                            placeholder="שם חדש לקונפיגורציה"
                                            required
                                        />
                                    </div>
                                    
                                    <div className="bank-info">
                                        <p><strong>בנק:</strong> {bankTypes[editingConfig.bank_type]?.name}</p>
                                        <p className="note">פרטי הכניסה - השאר ריק אם לא רוצה לשנות</p>
                                    </div>

                                    {renderCredentialsForm(true)}

                                    <div className="form-actions">
                                        <button type="submit" className="btn-primary" disabled={loading}>
                                            {loading ? 'מעדכן...' : 'עדכן קונפיגורציה'}
                                        </button>
                                        <button 
                                            type="button" 
                                            className="btn-secondary"
                                            onClick={() => setEditingConfig(null)}
                                        >
                                            ביטול
                                        </button>
                                    </div>
                                </form>
                            </div>
                        )}

                        <div className="configs-list">
                            {loading ? (
                                <div className="loading">טוען...</div>
                            ) : configs.length === 0 ? (
                                <div className="no-data">אין קונפיגורציות. הוסף קונפיגורציה חדשה כדי להתחיל.</div>
                            ) : (
                                configs.map(config => (
                                    <div key={config.id} className="config-card">
                                        <div className="config-header">
                                            <h3>{config.config_name}</h3>
                                            <div className="config-status">
                                                <span className={`status ${config.is_active ? 'active' : 'inactive'}`}>
                                                    {config.is_active ? 'פעיל' : 'לא פעיל'}
                                                </span>
                                            </div>
                                        </div>
                                        
                                        <div className="config-details">
                                            <p><strong>בנק:</strong> {bankTypes[config.bank_type]?.name}</p>
                                            <p><strong>כריה אחרונה:</strong> {config.last_scrape_date ? new Date(config.last_scrape_date).toLocaleString('he-IL') : 'מעולם לא רץ'}</p>
                                            <p><strong>נוצר:</strong> {new Date(config.created_at).toLocaleString('he-IL')}</p>
                                        </div>

                                        <div className="config-actions">
                                            <button 
                                                className="btn-primary"
                                                onClick={() => handleRunScraper(config.id)}
                                                disabled={loading || !config.is_active}
                                            >
                                                הרץ כריית נתונים
                                            </button>
                                            <button 
                                                className="btn-secondary"
                                                onClick={() => handleEditConfig(config)}
                                                disabled={editingConfig || showAddForm}
                                            >
                                                ערוך
                                            </button>
                                            <button 
                                                className="btn-secondary"
                                                onClick={() => {
                                                    setSelectedConfig(config.id);
                                                    setActiveTab('transactions');
                                                    fetchTransactions(config.id);
                                                }}
                                            >
                                                צפה בעסקאות
                                            </button>
                                            <button 
                                                className="btn-secondary"
                                                onClick={() => toggleConfig(config.id)}
                                            >
                                                {config.is_active ? 'השבת' : 'הפעל'}
                                            </button>
                                            <button 
                                                className="btn-danger"
                                                onClick={() => handleDeleteConfig(config.id)}
                                            >
                                                מחק
                                            </button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                )}

                {activeTab === 'transactions' && (
                    <div className="transactions-tab">
                        <div className="section-header">
                            <h2>עסקאות מסוקרפות</h2>
                            {selectedConfig && (
                                <select 
                                    value={selectedConfig}
                                    onChange={(e) => {
                                        setSelectedConfig(e.target.value);
                                        fetchTransactions(e.target.value);
                                    }}
                                >
                                    <option value="">בחר קונפיגורציה</option>
                                    {configs.map(config => (
                                        <option key={config.id} value={config.id}>
                                            {config.config_name}
                                        </option>
                                    ))}
                                </select>
                            )}
                        </div>

                        <div className="transactions-list">
                            {loading ? (
                                <div className="loading">טוען...</div>
                            ) : transactions.length === 0 ? (
                                <div className="no-data">
                                    {selectedConfig ? 'אין עסקאות עבור הקונפיגורציה הנבחרת' : 'בחר קונפיגורציה לצפייה בעסקאות'}
                                </div>
                            ) : (
                                <div className="transactions-table">
                                    <table>
                                        <thead>
                                            <tr>
                                                <th>תאריך</th>
                                                <th>תיאור</th>
                                                <th>סכום</th>
                                                <th>מטבע</th>
                                                <th>חשבון</th>
                                                <th>סטטוס</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {transactions.map(txn => (
                                                <tr key={txn.id}>
                                                    <td>{new Date(txn.transaction_date).toLocaleDateString('he-IL')}</td>
                                                    <td>{txn.description}</td>
                                                    <td className={txn.charged_amount < 0 ? 'negative' : 'positive'}>
                                                        {txn.charged_amount.toLocaleString('he-IL', { 
                                                            minimumFractionDigits: 2, 
                                                            maximumFractionDigits: 2 
                                                        })}
                                                    </td>
                                                    <td>{txn.original_currency}</td>
                                                    <td>{txn.account_number}</td>
                                                    <td>
                                                        <span className={`status ${txn.status}`}>
                                                            {txn.status === 'completed' ? 'הושלם' : 'ממתין'}
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {activeTab === 'logs' && (
                    <div className="logs-tab">
                        <div className="section-header">
                            <h2>יומני ריצה</h2>
                            <select 
                                value={selectedConfig || ''}
                                onChange={(e) => {
                                    setSelectedConfig(e.target.value);
                                    if (e.target.value) fetchLogs(e.target.value);
                                }}
                            >
                                <option value="">בחר קונפיגורציה</option>
                                {configs.map(config => (
                                    <option key={config.id} value={config.id}>
                                        {config.config_name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="logs-list">
                            {loading ? (
                                <div className="loading">טוען...</div>
                            ) : logs.length === 0 ? (
                                <div className="no-data">
                                    {selectedConfig ? 'אין יומני ריצה עבור הקונפיגורציה הנבחרת' : 'בחר קונפיגורציה לצפייה ביומני הריצה'}
                                </div>
                            ) : (
                                logs.map(log => (
                                    <div key={log.id} className={`log-entry ${log.success ? 'success' : 'error'}`}>
                                        <div className="log-header">
                                            <span className="log-date">
                                                {new Date(log.scrape_date).toLocaleString('he-IL')}
                                            </span>
                                            <span className={`log-status ${log.success ? 'success' : 'error'}`}>
                                                {log.success ? '✓ הצלחה' : '✗ שגיאה'}
                                            </span>
                                        </div>
                                        
                                        <div className="log-details">
                                            {log.success ? (
                                                <p>נמצאו {log.transactions_count} עסקאות. זמן ריצה: {log.execution_time_seconds} שניות</p>
                                            ) : (
                                                <div>
                                                    <p><strong>סוג שגיאה:</strong> {log.error_type}</p>
                                                    {log.error_message && <p><strong>פרטי שגיאה:</strong> {log.error_message}</p>}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                )}

                {activeTab === 'guide' && (
                    <div className="guide-tab">
                        <h2>מדריך שימוש - Israeli Bank Scraper</h2>
                        
                        <div className="guide-section">
                            <h3>מה זה Israeli Bank Scraper?</h3>
                            <p>
                                זהו כלי לייבוא אוטומטי של נתוני חשבון מכל הבנקים וחברות האשראי הישראליים הגדולים.
                                הכלי מבוסס על הספריה הפופולרית israeli-bank-scrapers ומאפשר לך לקבל גישה לנתוני החשבון שלך באופן אוטומטי.
                            </p>
                        </div>

                        <div className="guide-section">
                            <h3>בנקים נתמכים:</h3>
                            <ul>
                                <li>בנק הפועלים</li>
                                <li>בנק לאומי</li>
                                <li>בנק דיסקונט</li>
                                <li>בנק מרקנטיל</li>
                                <li>בנק מזרחי</li>
                                <li>בנק אוצר החייל</li>
                                <li>ויזה כאל</li>
                                <li>מקס (לשעבר לאומי קארד)</li>
                                <li>ישראכרט</li>
                                <li>אמריקן אקספרס</li>
                                <li>בנק יוניון</li>
                                <li>בינלאומי</li>
                                <li>מסד</li>
                                <li>בנק יהב</li>
                                <li>ביחד בשבילך</li>
                                <li>וואן זירו</li>
                                <li>בהצדעה</li>
                            </ul>
                        </div>

                        <div className="guide-section">
                            <h3>איך להשתמש:</h3>
                            <ol>
                                <li><strong>צור קונפיגורציה:</strong> לחץ על "הוסף קונפיגורציה חדשה" ובחר את הבנק שלך</li>
                                <li><strong>הזן נתונים:</strong> הזן את פרטי הכניסה לחשבון הבנק (נתונים מוצפנים באופן מאובטח)</li>
                                <li><strong>הרץ סקריפה:</strong> לחץ על "הרץ סקריפה" כדי לייבא עסקאות מהבנק</li>
                                <li><strong>צפה בתוצאות:</strong> עבור לטאב "עסקאות" לראות את הנתונים שיובאו</li>
                            </ol>
                        </div>

                        <div className="guide-section">
                            <h3>אבטחה:</h3>
                            <ul>
                                <li>כל פרטי הכניסה מוצפנים לפני השמירה במסד הנתונים</li>
                                <li>הנתונים נשמרים באופן מקומי ולא נשלחים לשרתים חיצוניים</li>
                                <li>ניתן למחוק קונפיגורציות בכל עת</li>
                                <li>ניתן להשבית קונפיגורציות באופן זמני</li>
                            </ul>
                        </div>

                        <div className="guide-section">
                            <h3>טיפים:</h3>
                            <ul>
                                <li>הרץ סקריפה באופן קבוע כדי לעדכן את הנתונים</li>
                                <li>בדוק את יומני הריצה במקרה של שגיאות</li>
                                <li>שמור על פרטי הכניסה מעודכנים</li>
                                <li>אם אתה משנה סיסמה בבנק, עדכן גם בקונפיגורציה</li>
                            </ul>
                        </div>

                        <div className="guide-section warning">
                            <h3>⚠️ הערות חשובות:</h3>
                            <ul>
                                <li>השימוש בכלי זה הוא באחריותך האישית</li>
                                <li>וודא שאתה עומד בתנאי השימוש של הבנק שלך</li>
                                <li>במקרה של שגיאות רציפות, השבת את הקונפיגורציה זמנית</li>
                                <li>כלי זה אינו קשור לבנקים ואינו מאושר על ידם</li>
                            </ul>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default BankScraperPage;