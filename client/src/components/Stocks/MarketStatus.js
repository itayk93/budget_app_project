
import React from 'react';

const MarketStatus = ({ summary }) => {
    if (!summary) return null;

    const { market_open, last_update, indices } = summary;

    return (
        <div className="sidebar-card">
            <div className="card-header">
                <h6><i className="fas fa-globe"></i> מצב השוק</h6>
            </div>
            <div className="card-body">
                <div className="market-status">
                    <span>סטטוס:</span>
                    <span className={`status-badge ${market_open ? 'open' : 'closed'}`}>
                        {market_open ? 'פתוח' : 'סגור'}
                    </span>
                </div>

                {indices && indices.length > 0 && (
                    <div className="indices-list">
                        {indices.map(index => (
                            <div className="index-item" key={index.symbol}>
                                <div className="name">{index.name}</div>
                                <div className="value">
                                    <div className="price">{index.price.toFixed(2)}</div>
                                    <div className={`change ${index.change_percent >= 0 ? 'positive' : 'negative'}`}>
                                        {index.change_percent >= 0 ? '+' : ''}{index.change_percent.toFixed(1)}%
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
                
                <hr />
                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                    עדכון אחרון: {last_update ? new Date(last_update).toLocaleString('he-IL') : 'לא זמין'}
                </div>
            </div>
        </div>
    );
};

export default MarketStatus;
