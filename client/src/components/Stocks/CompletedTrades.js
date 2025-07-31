import React, { useState } from 'react';

const CompletedTrades = ({ completedTrades }) => {
    const [showAll, setShowAll] = useState(false);
    
    if (!completedTrades || completedTrades.length === 0) {
        return (
            <div className="completed-trades-card">
                <div className="card-header">
                    <h5>עסקאות שהושלמו</h5>
                </div>
                <div className="no-data">
                    <i className="fas fa-handshake"></i>
                    <h6>אין עסקאות שהושלמו</h6>
                    <p>עסקאות שהושלמו יוצגו כאן לאחר מכירת מניות</p>
                </div>
            </div>
        );
    }

    const displayTrades = showAll ? completedTrades : completedTrades.slice(0, 5);
    const totalRealizedPL = completedTrades.reduce((sum, trade) => sum + trade.profitLoss, 0);

    return (
        <div className="completed-trades-card">
            <div className="card-header d-flex justify-content-between align-items-center">
                <h5>עסקאות שהושלמו</h5>
                <div className="summary-stats">
                    <span className={`total-realized ${totalRealizedPL >= 0 ? 'positive' : 'negative'}`}>
                        סה"כ רווח מומש: {totalRealizedPL >= 0 ? '+' : ''}${totalRealizedPL.toFixed(2)}
                    </span>
                </div>
            </div>
            
            <div className="completed-trades-list">
                {displayTrades.map((trade, index) => {
                    const returnPercentage = ((trade.totalReturns - trade.totalInvested) / trade.totalInvested) * 100;
                    const holdingPeriod = calculateHoldingPeriod(trade.firstBuyDate, trade.lastSellDate);
                    
                    return (
                        <div key={index} className="completed-trade-item">
                            <div className="trade-header">
                                <div className="trade-symbol">
                                    <div className="symbol-icon">
                                        {trade.symbol.substring(0, 4)}
                                    </div>
                                    <div className="symbol-info">
                                        <h6>{trade.symbol}</h6>
                                        <small className="holding-period">{holdingPeriod}</small>
                                    </div>
                                </div>
                                <div className={`trade-result ${trade.profitLoss >= 0 ? 'profit' : 'loss'}`}>
                                    <div className="profit-amount">
                                        {trade.profitLoss >= 0 ? '+' : ''}${trade.profitLoss.toFixed(2)}
                                    </div>
                                    <div className="profit-percent">
                                        ({returnPercentage.toFixed(1)}%)
                                    </div>
                                </div>
                            </div>
                            
                            <div className="trade-details">
                                <div className="detail-item">
                                    <span className="label">הושקע:</span>
                                    <span className="value">${trade.totalInvested.toFixed(2)}</span>
                                </div>
                                <div className="detail-item">
                                    <span className="label">הוחזר:</span>
                                    <span className="value">${trade.totalReturns.toFixed(2)}</span>
                                </div>
                                <div className="detail-item">
                                    <span className="label">תאריכים:</span>
                                    <span className="value">
                                        {formatDate(trade.firstBuyDate)} - {formatDate(trade.lastSellDate)}
                                    </span>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
            
            {completedTrades.length > 5 && (
                <div className="card-footer text-center">
                    <button 
                        className="btn btn-outline-primary btn-sm"
                        onClick={() => setShowAll(!showAll)}
                    >
                        {showAll ? 'הצג פחות' : `הצג כל ${completedTrades.length} העסקאות`}
                    </button>
                </div>
            )}
        </div>
    );
};

function calculateHoldingPeriod(startDate, endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = Math.abs(end - start);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 30) return `${diffDays} ימים`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} חודשים`;
    return `${Math.floor(diffDays / 365)} שנים`;
}

function formatDate(dateString) {
    return new Date(dateString).toLocaleDateString('he-IL', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    });
}

export default CompletedTrades;