import React, { useState, useEffect } from 'react';
import api from '../../services/api';

const StockAlerts = () => {
    const [alerts, setAlerts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [showAddForm, setShowAddForm] = useState(false);
    const [newAlert, setNewAlert] = useState({
        stock_symbol: '',
        alert_type: 'price_above',
        target_value: '',
        notification_method: 'browser'
    });
    const [addingAlert, setAddingAlert] = useState(false);

    const alertTypes = [
        { value: 'price_above', label: 'מחיר מעל' },
        { value: 'price_below', label: 'מחיר מתחת' },
        { value: 'change_percent', label: 'שינוי אחוזי' }
    ];

    const notificationMethods = [
        { value: 'browser', label: 'דפדפן' },
        { value: 'email', label: 'אימייל' },
        { value: 'all', label: 'כל הדרכים' }
    ];

    const fetchAlerts = async () => {
        try {
            setLoading(true);
            const { data } = await api.get('/stocks/alerts');
            setAlerts(data.alerts || []);
            setError(null);
        } catch (err) {
            setError('שגיאה בטעינת ההתראות');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAlerts();
    }, []);

    const handleAddAlert = async (e) => {
        e.preventDefault();
        
        if (!newAlert.stock_symbol.trim() || !newAlert.target_value) {
            setError('נא למלא את כל השדות הנדרשים');
            return;
        }

        setAddingAlert(true);
        setError(null);

        try {
            const payload = {
                stock_symbol: newAlert.stock_symbol.toUpperCase().trim(),
                alert_type: newAlert.alert_type,
                target_value: parseFloat(newAlert.target_value),
                notification_method: newAlert.notification_method
            };

            await api.post('/stocks/alerts', payload);
            
            // Reset form
            setNewAlert({
                stock_symbol: '',
                alert_type: 'price_above',
                target_value: '',
                notification_method: 'browser'
            });
            setShowAddForm(false);
            
            // Refresh alerts
            fetchAlerts();
        } catch (err) {
            console.error('Error adding alert:', err);
            setError(err.response?.data?.error || 'שגיאה בהוספת ההתראה');
        } finally {
            setAddingAlert(false);
        }
    };

    const handleDeleteAlert = async (alertId) => {
        if (!window.confirm('האם אתה בטוח שברצונך למחוק התראה זו?')) {
            return;
        }

        try {
            await api.delete(`/stocks/alerts/${alertId}`);
            fetchAlerts(); // Refresh alerts
        } catch (err) {
            console.error('Error deleting alert:', err);
            setError('שגיאה במחיקת ההתראה');
        }
    };

    const handleToggleAlert = async (alertId, isActive) => {
        try {
            await api.put(`/stocks/alerts/${alertId}/toggle`, { is_active: !isActive });
            fetchAlerts(); // Refresh alerts
        } catch (err) {
            console.error('Error toggling alert:', err);
            setError('שגיאה בשינוי סטטוס ההתראה');
        }
    };

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 2
        }).format(amount || 0);
    };

    const getAlertTypeLabel = (alertType) => {
        const type = alertTypes.find(t => t.value === alertType);
        return type ? type.label : alertType;
    };

    const getNotificationMethodLabel = (method) => {
        const methodObj = notificationMethods.find(m => m.value === method);
        return methodObj ? methodObj.label : method;
    };

    if (loading) {
        return (
            <div className="alerts-loading">
                <div className="spinner-border text-primary" role="status">
                    <span className="visually-hidden">טוען...</span>
                </div>
            </div>
        );
    }

    return (
        <div className="stock-alerts-component">
            <div className="card">
                <div className="card-header d-flex justify-content-between align-items-center">
                    <h5 className="mb-0">
                        <i className="fas fa-bell me-2"></i>
                        התראות מניות
                    </h5>
                    <button 
                        className="btn btn-sm btn-outline-primary"
                        onClick={() => setShowAddForm(!showAddForm)}
                    >
                        <i className="fas fa-plus me-1"></i>
                        הוסף התראה
                    </button>
                </div>

                <div className="card-body">
                    {error && (
                        <div className="alert alert-danger alert-dismissible">
                            <i className="fas fa-exclamation-circle me-2"></i>
                            {error}
                            <button 
                                type="button" 
                                className="btn-close" 
                                onClick={() => setError(null)}
                            ></button>
                        </div>
                    )}

                    {/* Add Alert Form */}
                    {showAddForm && (
                        <div className="add-alert-form mb-4">
                            <div className="card bg-light">
                                <div className="card-body">
                                    <h6 className="card-title">הוספת התראה חדשה</h6>
                                    <form onSubmit={handleAddAlert}>
                                        <div className="row g-3">
                                            <div className="col-md-3">
                                                <label className="form-label">סמל מניה *</label>
                                                <input
                                                    type="text"
                                                    className="form-control"
                                                    value={newAlert.stock_symbol}
                                                    onChange={(e) => setNewAlert({
                                                        ...newAlert,
                                                        stock_symbol: e.target.value
                                                    })}
                                                    placeholder="AAPL"
                                                    style={{ textTransform: 'uppercase' }}
                                                    required
                                                />
                                            </div>
                                            <div className="col-md-3">
                                                <label className="form-label">סוג התראה *</label>
                                                <select
                                                    className="form-select"
                                                    value={newAlert.alert_type}
                                                    onChange={(e) => setNewAlert({
                                                        ...newAlert,
                                                        alert_type: e.target.value
                                                    })}
                                                    required
                                                >
                                                    {alertTypes.map(type => (
                                                        <option key={type.value} value={type.value}>
                                                            {type.label}
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div className="col-md-3">
                                                <label className="form-label">ערך יעד *</label>
                                                <input
                                                    type="number"
                                                    step="0.01"
                                                    className="form-control"
                                                    value={newAlert.target_value}
                                                    onChange={(e) => setNewAlert({
                                                        ...newAlert,
                                                        target_value: e.target.value
                                                    })}
                                                    placeholder="150.00"
                                                    required
                                                />
                                            </div>
                                            <div className="col-md-3">
                                                <label className="form-label">שיטת התראה</label>
                                                <select
                                                    className="form-select"
                                                    value={newAlert.notification_method}
                                                    onChange={(e) => setNewAlert({
                                                        ...newAlert,
                                                        notification_method: e.target.value
                                                    })}
                                                >
                                                    {notificationMethods.map(method => (
                                                        <option key={method.value} value={method.value}>
                                                            {method.label}
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>
                                        </div>
                                        <div className="mt-3">
                                            <button 
                                                type="submit" 
                                                className="btn btn-primary me-2"
                                                disabled={addingAlert}
                                            >
                                                {addingAlert ? (
                                                    <>
                                                        <span className="spinner-border spinner-border-sm me-2"></span>
                                                        מוסיף...
                                                    </>
                                                ) : (
                                                    <>
                                                        <i className="fas fa-plus me-2"></i>
                                                        הוסף התראה
                                                    </>
                                                )}
                                            </button>
                                            <button 
                                                type="button" 
                                                className="btn btn-secondary"
                                                onClick={() => setShowAddForm(false)}
                                            >
                                                ביטול
                                            </button>
                                        </div>
                                    </form>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Alerts List */}
                    {alerts.length === 0 ? (
                        <div className="empty-alerts text-center py-4">
                            <i className="fas fa-bell-slash empty-icon mb-3"></i>
                            <h6>אין התראות פעילות</h6>
                            <p className="text-muted">
                                הוסף התראות כדי לקבל עדכונים על שינויי מחירים במניות
                            </p>
                            <button 
                                className="btn btn-primary"
                                onClick={() => setShowAddForm(true)}
                            >
                                <i className="fas fa-plus me-2"></i>
                                הוסף התראה ראשונה
                            </button>
                        </div>
                    ) : (
                        <div className="alerts-list">
                            {alerts.map((alert) => (
                                <div key={alert.id} className={`alert-item ${!alert.is_active ? 'inactive' : ''}`}>
                                    <div className="alert-header">
                                        <div className="alert-info">
                                            <h6 className="stock-symbol">{alert.stock_symbol}</h6>
                                            <div className="alert-details">
                                                <span className="alert-type">
                                                    {getAlertTypeLabel(alert.alert_type)}
                                                </span>
                                                <span className="target-value">
                                                    {alert.alert_type.includes('percent') 
                                                        ? `${alert.target_value}%` 
                                                        : formatCurrency(alert.target_value)
                                                    }
                                                </span>
                                            </div>
                                        </div>
                                        <div className="alert-status">
                                            <span className={`status-badge ${alert.is_active ? 'active' : 'inactive'}`}>
                                                {alert.is_active ? 'פעיל' : 'לא פעיל'}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="alert-meta">
                                        <div className="notification-method">
                                            <i className="fas fa-bell me-1"></i>
                                            {getNotificationMethodLabel(alert.notification_method)}
                                        </div>
                                        <div className="created-date">
                                            <i className="fas fa-calendar me-1"></i>
                                            {new Date(alert.created_at).toLocaleDateString('he-IL')}
                                        </div>
                                        {alert.last_triggered_at && (
                                            <div className="last-triggered">
                                                <i className="fas fa-clock me-1"></i>
                                                התראה אחרונה: {new Date(alert.last_triggered_at).toLocaleDateString('he-IL')}
                                            </div>
                                        )}
                                    </div>

                                    <div className="alert-actions">
                                        <button
                                            className={`btn btn-sm ${alert.is_active ? 'btn-outline-warning' : 'btn-outline-success'}`}
                                            onClick={() => handleToggleAlert(alert.id, alert.is_active)}
                                            title={alert.is_active ? 'השבת התראה' : 'הפעל התראה'}
                                        >
                                            <i className={`fas ${alert.is_active ? 'fa-pause' : 'fa-play'}`}></i>
                                        </button>
                                        <button
                                            className="btn btn-sm btn-outline-danger"
                                            onClick={() => handleDeleteAlert(alert.id)}
                                            title="מחק התראה"
                                        >
                                            <i className="fas fa-trash"></i>
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default StockAlerts;