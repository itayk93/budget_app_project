import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import api, { stocksAPI } from '../../services/api';
import LoadingSpinner from '../../components/Common/LoadingSpinner';
import BlinkUpload from '../../components/Stocks/BlinkUpload';

const StockTransactions = () => {
    const [transactions, setTransactions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [cashFlows, setCashFlows] = useState([]);
    const [selectedCashFlowId, setSelectedCashFlowId] = useState('');
    const [filters, setFilters] = useState({
        stock_symbol: '',
        limit: 50
    });
    const [showUpload, setShowUpload] = useState(false);

    const fetchCashFlows = useCallback(async () => {
        try {
            const { data } = await api.get('/stocks/investment-cash-flows');
            console.log('Investment cash flows received:', data);
            setCashFlows(data.cash_flows || []);
            if (data.cash_flows && data.cash_flows.length > 0) {
                setSelectedCashFlowId(data.cash_flows[0].id);
            }
        } catch (err) {
            console.error('Error fetching cash flows:', err);
            setError('שגיאה בטעינת חשבונות השקעה');
        }
    }, []);

    const fetchTransactions = useCallback(async () => {
        try {
            setLoading(true);
            const params = new URLSearchParams();
            if (selectedCashFlowId) params.append('cash_flow_id', selectedCashFlowId);
            if (filters.stock_symbol) params.append('stock_symbol', filters.stock_symbol);
            if (filters.limit) params.append('limit', filters.limit);

            const { data } = await api.get(`/stocks/transactions?${params.toString()}`);
            setTransactions(data.transactions || []);
            setError(null);
        } catch (err) {
            setError('שגיאה בטעינת עסקאות המניות');
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, [selectedCashFlowId, filters]);

    useEffect(() => {
        fetchCashFlows();
    }, [fetchCashFlows]);

    useEffect(() => {
        if (selectedCashFlowId) {
            fetchTransactions();
        }
    }, [selectedCashFlowId, filters, fetchTransactions]);

    const handleCashFlowChange = (e) => {
        setSelectedCashFlowId(e.target.value);
    };

    const handleFilterChange = (e) => {
        setFilters({
            ...filters,
            [e.target.name]: e.target.value
        });
    };

    const handleUploadComplete = () => {
        setShowUpload(false);
        fetchTransactions(); // Refresh transactions after upload
    };

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 2
        }).format(amount || 0);
    };

    const formatDate = (dateString) => {
        return new Date(dateString).toLocaleDateString('he-IL');
    };

    const handleDelete = async (id) => {
        if (!id) return;
        const ok = window.confirm('למחוק את העסקה הזו? הפעולה בלתי הפיכה.');
        if (!ok) return;
        try {
            await stocksAPI.deleteTransaction(id);
            setTransactions(prev => prev.filter(t => t.id !== id));
        } catch (err) {
            console.error('Delete failed', err);
            alert(err.response?.data?.error || 'מחיקה נכשלה');
        }
    };

    if (loading && !transactions.length) {
        return <LoadingSpinner />;
    }

    return (
        <div className="stock-transactions-page">
            <div className="container-fluid">
                <div className="page-header">
                    <div className="header-content">
                        <h1>
                            <i className="fas fa-exchange-alt me-2"></i>
                            עסקאות מניות
                        </h1>
                        <div className="header-actions">
                            <button 
                                className="btn btn-success"
                                onClick={() => setShowUpload(!showUpload)}
                            >
                                <i className="fas fa-upload me-2"></i>
                                העלאת קובץ Blink
                            </button>
                            <Link to="/stocks" className="btn btn-outline-primary">
                                <i className="fas fa-arrow-right me-2"></i>
                                חזרה לדשבורד
                            </Link>
                        </div>
                    </div>
                </div>

                <div className="container">
                    {/* Upload Section */}
                    {showUpload && (
                        <div className="upload-section mb-4">
                            <BlinkUpload 
                                onUploadComplete={handleUploadComplete}
                                cashFlowId={selectedCashFlowId}
                            />
                        </div>
                    )}

                    {/* Filters */}
                    <div className="filters-card mb-4">
                        <div className="card">
                            <div className="card-body">
                                <div className="row g-3">
                                    <div className="col-md-4">
                                        <label className="form-label">חשבון השקעות</label>
                                        <select 
                                            className="form-select"
                                            value={selectedCashFlowId}
                                            onChange={handleCashFlowChange}
                                        >
                                            {cashFlows.map(cf => (
                                                <option key={cf.id} value={cf.id}>
                                                    {cf.name} ({cf.currency})
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="col-md-4">
                                        <label className="form-label">סמל מניה</label>
                                        <input
                                            type="text"
                                            className="form-control"
                                            name="stock_symbol"
                                            value={filters.stock_symbol}
                                            onChange={handleFilterChange}
                                            placeholder="הזן סמל מניה (AAPL, TSLA...)"
                                        />
                                    </div>
                                    <div className="col-md-4">
                                        <label className="form-label">מספר עסקאות</label>
                                        <select
                                            className="form-select"
                                            name="limit"
                                            value={filters.limit}
                                            onChange={handleFilterChange}
                                        >
                                            <option value={25}>25 אחרונות</option>
                                            <option value={50}>50 אחרונות</option>
                                            <option value={100}>100 אחרונות</option>
                                            <option value={250}>250 אחרונות</option>
                                        </select>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Error State */}
                    {error && (
                        <div className="alert alert-danger">
                            <i className="fas fa-exclamation-circle me-2"></i>
                            {error}
                        </div>
                    )}

                    {/* Transactions Table */}
                    <div className="transactions-card">
                        <div className="card">
                            <div className="card-header">
                                <h5 className="mb-0">
                                    <i className="fas fa-list me-2"></i>
                                    רשימת עסקאות ({transactions.length})
                                </h5>
                            </div>
                            
                            {loading ? (
                                <div className="card-body text-center">
                                    <LoadingSpinner />
                                </div>
                            ) : transactions.length === 0 ? (
                                <div className="card-body text-center">
                                    <div className="empty-state">
                                        <i className="fas fa-chart-line empty-icon"></i>
                                        <h6>לא נמצאו עסקאות מניות</h6>
                                        <p className="text-muted">
                                            נסה לשנות את הפילטרים או להעלות קובץ Blink עם עסקאות מניות
                                        </p>
                                        <button 
                                            className="btn btn-primary"
                                            onClick={() => setShowUpload(true)}
                                        >
                                            <i className="fas fa-upload me-2"></i>
                                            העלה קובץ Blink
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="table-responsive">
                                    <table className="table table-hover">
                                        <thead>
                                            <tr>
                                                <th>תאריך</th>
                                                <th>סמל מניה</th>
                                                <th>סוג עסקה</th>
                                                <th>סכום</th>
                                                <th>הערות</th>
                                                <th>פעולות</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {transactions.map((transaction) => (
                                                <tr key={transaction.id}>
                                                    <td>{formatDate(transaction.transaction_date)}</td>
                                                    <td>
                                                        <span className="stock-symbol">
                                                            {transaction.stock_symbol}
                                                        </span>
                                                    </td>
                                                    <td>
                                                        <span className={`transaction-type-badge ${transaction.transaction_type}`}>
                                                            {transaction.transaction_type === 'buy' ? 'קניה' : 'מכירה'}
                                                        </span>
                                                    </td>
                                                    <td className="amount-cell">
                                                        {formatCurrency(transaction.total_amount)}
                                                    </td>
                                                    <td>
                                                        <span className="notes" title={transaction.notes}>
                                                            {transaction.notes ? (
                                                                transaction.notes.length > 30 
                                                                    ? transaction.notes.substring(0, 30) + '...'
                                                                    : transaction.notes
                                                            ) : '-'}
                                                        </span>
                                                    </td>
                                                    <td>
                                                        <div className="d-flex gap-2">
                                                            <Link 
                                                                to={`/stocks/chart/${transaction.stock_symbol}`}
                                                                className="btn btn-sm btn-outline-primary"
                                                                title="הצג גרף מחירים"
                                                            >
                                                                <i className="fas fa-chart-line"></i>
                                                            </Link>
                                                            <button
                                                                className="btn btn-sm btn-outline-danger"
                                                                title="מחק עסקה"
                                                                onClick={() => handleDelete(transaction.id)}
                                                            >
                                                                <i className="fas fa-trash"></i>
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default StockTransactions;
