
import React from 'react';
import { Link } from 'react-router-dom';

const Holdings = ({ holdings }) => {
    if (!holdings || holdings.length === 0) {
        return (
            <div className="holdings-card">
                <div className="card-header">
                    <h5>החזקות נוכחיות</h5>
                </div>
                <div className="no-holdings">
                    <i className="fas fa-chart-line"></i>
                    <h6>אין החזקות נוכחיות</h6>
                    <p>לא נמצאו עסקאות מניות בחשבון השקעות זה.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="holdings-card">
            <div className="card-header d-flex justify-content-between align-items-center">
                <h5>החזקות נוכחיות</h5>
            </div>
            <div className="holdings-list">
                {holdings.map(holding => (
                    <div className="holding-item-detailed" key={holding.stock_symbol}>
                        <div className="holding-header">
                            <div className="holding-icon">
                                {holding.stock_symbol.substring(0, 4)}
                            </div>
                            <div className="holding-symbol-main">
                                <h3>{holding.stock_symbol}</h3>
                                <Link to={`/stocks/chart/${holding.stock_symbol}`} className="btn btn-sm btn-outline-primary chart-btn" title="הצג גרף מחירים">
                                    <i className="fas fa-chart-line"></i> גרף
                                </Link>
                            </div>
                        </div>
                        <div className="holding-stats-grid">
                            <div className="stat-item stat-item-price">
                                <div className="stat-label">מחיר נוכחי למניה</div>
                                <div className="stat-value price-cell">
                                    ${(holding.current_price || 0).toFixed(2)}
                                </div>
                            </div>
                            <div className="stat-item stat-item-current">
                                <div className="stat-label">סה"כ שווי נוכחי</div>
                                <div className="stat-value current-value">
                                    ${(holding.current_value || 0).toFixed(2)}
                                </div>
                            </div>
                            <div className="stat-item">
                                <div className="stat-label">כמות מניות</div>
                                <div className="stat-value quantity">
                                    {(holding.quantity || 0).toFixed(4)}
                                </div>
                            </div>
                            <div className="stat-item stat-item-invested">
                                <div className="stat-label">סך השקעה</div>
                                <div className="stat-value invested">
                                    ${(holding.total_invested || 0).toFixed(2)}
                                </div>
                            </div>
                            <div className="stat-item">
                                <div className="stat-label">מחיר ממוצע</div>
                                <div className="stat-value">
                                    ${(holding.average_cost || 0).toFixed(2)}
                                </div>
                            </div>
                            <div className="stat-item span-2">
                                <div className="stat-label">רווח/הפסד לא מומש</div>
                                <div className={`stat-value-profit ${(holding.unrealized_pl || 0) >= 0 ? 'positive' : 'negative'}`}>
                                    <div className="profit-amount">
                                        {(holding.unrealized_pl || 0) >= 0 ? '+' : ''}${(holding.unrealized_pl || 0).toFixed(2)}
                                    </div>
                                    <div className="profit-percent">
                                        ({(holding.unrealized_pl_percent || 0).toFixed(1)}%)
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default Holdings;
