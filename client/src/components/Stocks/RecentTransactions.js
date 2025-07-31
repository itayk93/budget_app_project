
import React from 'react';

const RecentTransactions = ({ transactions }) => {
    if (!transactions || transactions.length === 0) {
        return (
            <div className="sidebar-card">
                <div className="card-header">
                    <h6><i className="fas fa-history"></i> עסקאות אחרונות</h6>
                </div>
                <div className="card-body">
                    <p style={{ textAlign: 'center', color: '#64748b', margin: 0 }}>אין עסקאות אחרונות</p>
                </div>
            </div>
        );
    }

    return (
        <div className="sidebar-card">
            <div className="card-header d-flex justify-content-between align-items-center">
                <h6><i className="fas fa-history"></i> עסקאות אחרונות</h6>
                {/* Link to all transactions page will be added later */}
            </div>
            <div className="card-body">
                {transactions.map(trans => (
                    <div className="transaction-item" key={trans.id}>
                        <div className="left">
                            <div className="symbol">{trans.stock_symbol}</div>
                            <div className="date">{new Date(trans.transaction_date).toLocaleDateString('he-IL')}</div>
                        </div>
                        <div className="right">
                            <div className={`transaction-type ${trans.transaction_type}`}>
                                {trans.transaction_type === 'buy' ? 'קניה' : 'מכירה'}
                            </div>
                            <div className="transaction-amount">
                                ${(trans.total_amount || 0).toFixed(2)}
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default RecentTransactions;
