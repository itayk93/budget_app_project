import React, { useState, useEffect } from 'react';
import api from '../../services/api';

const Watchlist = () => {
    const [watchlist, setWatchlist] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [newSymbol, setNewSymbol] = useState('');
    const [targetPrice, setTargetPrice] = useState('');
    const [notes, setNotes] = useState('');
    const [addingStock, setAddingStock] = useState(false);
    const [showAddForm, setShowAddForm] = useState(false);

    const fetchWatchlist = async () => {
        try {
            setLoading(true);
            const { data } = await api.get('/stocks/watchlist');
            setWatchlist(data.watchlist || []);
            setError(null);
        } catch (err) {
            setError('שגיאה בטעינת רשימת המעקב');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchWatchlist();
    }, []);

    const handleAddStock = async (e) => {
        e.preventDefault();
        
        if (!newSymbol.trim()) {
            setError('נא להזין סמל מניה');
            return;
        }

        setAddingStock(true);
        setError(null);

        try {
            const payload = {
                stock_symbol: newSymbol.toUpperCase().trim(),
                target_price: targetPrice ? parseFloat(targetPrice) : null,
                notes: notes.trim()
            };

            await api.post('/stocks/watchlist', payload);
            
            // Reset form
            setNewSymbol('');
            setTargetPrice('');
            setNotes('');
            setShowAddForm(false);
            
            // Refresh watchlist
            fetchWatchlist();
        } catch (err) {
            console.error('Error adding to watchlist:', err);
            setError(err.response?.data?.error || 'שגיאה בהוספת המניה לרשימת המעקב');
        } finally {
            setAddingStock(false);
        }
    };

    const handleRemoveStock = async (symbol) => {
        if (!window.confirm(`האם אתה בטוח שברצונך להסיר את ${symbol} מרשימת המעקב?`)) {
            return;
        }

        try {
            await api.delete(`/stocks/watchlist/${symbol}`);
            fetchWatchlist(); // Refresh watchlist
        } catch (err) {
            console.error('Error removing from watchlist:', err);
            setError('שגיאה בהסרת המניה מרשימת המעקב');
        }
    };

    const formatCurrency = (amount) => {
        if (!amount) return '-';
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 2
        }).format(amount);
    };

    const formatPercentage = (percentage) => {
        if (!percentage) return '-';
        const sign = percentage >= 0 ? '+' : '';
        return `${sign}${percentage.toFixed(1)}%`;
    };

    if (loading) {
        return (
            <div className="watchlist-loading">
                <div className="spinner-border text-primary" role="status">
                    <span className="visually-hidden">טוען...</span>
                </div>
            </div>
        );
    }

    return (
        <div className="watchlist-component">
            <div className="card">
                <div className="card-header d-flex justify-content-between align-items-center">
                    <h5 className="mb-0">
                        <i className="fas fa-eye me-2"></i>
                        רשימת מעקב
                    </h5>
                    <button 
                        className="btn btn-sm btn-outline-primary"
                        onClick={() => setShowAddForm(!showAddForm)}
                    >
                        <i className="fas fa-plus me-1"></i>
                        הוסף מניה
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

                    {/* Add Stock Form */}
                    {showAddForm && (
                        <div className="add-stock-form mb-4">
                            <div className="card bg-light">
                                <div className="card-body">
                                    <h6 className="card-title">הוספת מניה לרשימת מעקב</h6>
                                    <form onSubmit={handleAddStock}>
                                        <div className="row g-3">
                                            <div className="col-md-4">
                                                <label className="form-label">סמל מניה *</label>
                                                <input
                                                    type="text"
                                                    className="form-control"
                                                    value={newSymbol}
                                                    onChange={(e) => setNewSymbol(e.target.value)}
                                                    placeholder="AAPL, TSLA, MSFT..."
                                                    style={{ textTransform: 'uppercase' }}
                                                    required
                                                />
                                            </div>
                                            <div className="col-md-4">
                                                <label className="form-label">מחיר יעד (אופציונלי)</label>
                                                <input
                                                    type="number"
                                                    step="0.01"
                                                    className="form-control"
                                                    value={targetPrice}
                                                    onChange={(e) => setTargetPrice(e.target.value)}
                                                    placeholder="150.00"
                                                />
                                            </div>
                                            <div className="col-md-4">
                                                <label className="form-label">הערות (אופציונלי)</label>
                                                <input
                                                    type="text"
                                                    className="form-control"
                                                    value={notes}
                                                    onChange={(e) => setNotes(e.target.value)}
                                                    placeholder="הערות אישיות..."
                                                />
                                            </div>
                                        </div>
                                        <div className="mt-3">
                                            <button 
                                                type="submit" 
                                                className="btn btn-primary me-2"
                                                disabled={addingStock}
                                            >
                                                {addingStock ? (
                                                    <>
                                                        <span className="spinner-border spinner-border-sm me-2"></span>
                                                        מוסיף...
                                                    </>
                                                ) : (
                                                    <>
                                                        <i className="fas fa-plus me-2"></i>
                                                        הוסף לרשימה
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

                    {/* Watchlist */}
                    {watchlist.length === 0 ? (
                        <div className="empty-watchlist text-center py-4">
                            <i className="fas fa-eye-slash empty-icon mb-3"></i>
                            <h6>רשימת המעקב ריקה</h6>
                            <p className="text-muted">
                                הוסף מניות לרשימת המעקב כדי לעקוב אחר המחירים שלהן
                            </p>
                            <button 
                                className="btn btn-primary"
                                onClick={() => setShowAddForm(true)}
                            >
                                <i className="fas fa-plus me-2"></i>
                                הוסף מניה ראשונה
                            </button>
                        </div>
                    ) : (
                        <div className="watchlist-items">
                            {watchlist.map((item) => (
                                <div key={item.id} className="watchlist-item">
                                    <div className="item-header">
                                        <div className="symbol-info">
                                            <h6 className="stock-symbol">{item.stock_symbol}</h6>
                                            <small className="text-muted">
                                                נוסף ב-{new Date(item.added_at).toLocaleDateString('he-IL')}
                                            </small>
                                        </div>
                                        <button
                                            className="btn btn-sm btn-outline-danger"
                                            onClick={() => handleRemoveStock(item.stock_symbol)}
                                            title="הסר מרשימת המעקב"
                                        >
                                            <i className="fas fa-trash"></i>
                                        </button>
                                    </div>

                                    <div className="item-details">
                                        <div className="price-info">
                                            <div className="current-price">
                                                <span className="label">מחיר נוכחי:</span>
                                                <span className="value">
                                                    {formatCurrency(item.current_price)}
                                                </span>
                                            </div>
                                            
                                            {item.target_price && (
                                                <div className="target-price">
                                                    <span className="label">מחיר יעד:</span>
                                                    <span className="value">
                                                        {formatCurrency(item.target_price)}
                                                    </span>
                                                    {item.price_to_target_percent && (
                                                        <span className={`percentage ${item.price_to_target_percent >= 0 ? 'positive' : 'negative'}`}>
                                                            ({formatPercentage(item.price_to_target_percent)})
                                                        </span>
                                                    )}
                                                </div>
                                            )}
                                        </div>

                                        {item.notes && (
                                            <div className="notes">
                                                <i className="fas fa-sticky-note me-2"></i>
                                                {item.notes}
                                            </div>
                                        )}

                                        {item.last_update && (
                                            <div className="last-update">
                                                <small className="text-muted">
                                                    עדכון אחרון: {new Date(item.last_update).toLocaleDateString('he-IL')}
                                                </small>
                                            </div>
                                        )}
                                    </div>

                                    <div className="item-actions">
                                        <a 
                                            href={`/stocks/chart/${item.stock_symbol}`}
                                            className="btn btn-sm btn-outline-primary"
                                            title="הצג גרף מחירים"
                                        >
                                            <i className="fas fa-chart-line me-1"></i>
                                            גרף
                                        </a>
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

export default Watchlist;