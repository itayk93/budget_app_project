
import React from 'react';

const PortfolioSummary = ({ summary }) => {
    if (!summary) return null;

    // שער הדולר - יש לעדכן זאת לשיטה דינמית בעתיד
    const USD_TO_ILS = 3.7;

    const formatCurrency = (amount, showILS = true) => {
        const value = amount || 0;
        const absValue = Math.abs(value);
        
        // פורמט עם פסיקים
        const formattedUSD = absValue.toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
        
        const formattedILS = (absValue * USD_TO_ILS).toLocaleString('he-IL', {
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        });
        
        // הוספת מינוס בצד שמאל
        const usd = value < 0 ? `-$${formattedUSD}` : `$${formattedUSD}`;
        const ils = value < 0 ? `-₪${formattedILS}` : `₪${formattedILS}`;
        
        if (!showILS) return usd;
        
        return (
            <div>
                <div className="primary-currency" style={{ direction: 'ltr', textAlign: 'center' }}>{usd}</div>
                <div className="secondary-currency" style={{ direction: 'ltr', textAlign: 'center' }}>{ils}</div>
            </div>
        );
    };

    // מיפוי לפורמט הנתונים מ-StocksDashboard
    const { 
        portfolioValue: total_market_value,
        totalPL: total_combined_pl,
        totalRealizedPL: total_realized_pl,
        cash: cash_balance,
        deposits: total_deposits,
        dividends: total_dividends,
        fees: total_fees,
        taxes: total_taxes
    } = summary;
    
    // חישוב אחוז תשואה
    const return_percentage = total_deposits > 0 ? (total_combined_pl / total_deposits) * 100 : 0;

    return (
        <>
            <div className="stats-grid main-stats">
                <div className="stat-card portfolio-value">
                    <div className="stat-header">
                        <span className="emoji">💼</span>
                        <h5>שווי תיק נוכחי</h5>
                    </div>
                    <div className="value">{formatCurrency(total_market_value)}</div>
                </div>
                
                <div className={`stat-card total-pl ${(total_combined_pl || 0) >= 0 ? 'profit' : 'loss'}`}>
                    <div className="stat-header">
                        <span className="emoji">📈</span>
                        <h5>רווח/הפסד כולל</h5>
                    </div>
                    <div className="value">
                        {formatCurrency(total_combined_pl)}
                        <div className="percentage">
                            {(total_combined_pl || 0) >= 0 ? '▲' : '▼'} {Math.abs(return_percentage || 0).toFixed(2)}%
                        </div>
                    </div>
                </div>
                
                <div className={`stat-card realized-pl ${(total_realized_pl || 0) >= 0 ? 'profit' : 'loss'}`}>
                    <div className="stat-header">  
                        <span className="emoji">💸</span>
                        <h5>רווח ממומש</h5>
                    </div>
                    <div className="value">{formatCurrency(total_realized_pl)}</div>
                </div>
                
                <div className="stat-card cash-balance">
                    <div className="stat-header">
                        <span className="emoji">🏦</span>  
                        <h5>מזומן</h5>
                    </div>
                    <div className="value">{formatCurrency(cash_balance)}</div>
                </div>
            </div>
            
            {/* מידע נוסף על החשבון */}
            <div className="stats-grid secondary-stats">
                <div className="stat-card secondary">
                    <h5>יתרת מזומן</h5>
                    <div className="value">${(cash_balance || 0).toFixed(2)}</div>
                    <div className="subtitle">זמין להשקעה</div>
                </div>
                <div className="stat-card secondary">
                    <h5>סך הפקדות</h5>
                    <div className="value">${(total_deposits || 0).toFixed(2)}</div>
                    <div className="subtitle">הפקדות לחשבון</div>
                </div>
                <div className="stat-card secondary">
                    <h5>דיבידנדים</h5>
                    <div className="value">${(total_dividends || 0).toFixed(2)}</div>
                    <div className="subtitle">תשואות שהתקבלו</div>
                </div>
                <div className="stat-card secondary">
                    <h5>עמלות ומיסים</h5>
                    <div className="value">${((total_fees || 0) + (total_taxes || 0)).toFixed(2)}</div>
                    <div className="subtitle">עלויות עסקאות</div>
                </div>
            </div>
        </>
    );
};

export default PortfolioSummary;

// עכשיו נוסיף CSS עבור העיצוב החדש
const styles = `
.main-stats {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    gap: 1.5rem;
    margin-bottom: 2rem;
}

.stat-card {
    background: white;
    padding: 1.5rem;
    border-radius: 1rem;
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
    transition: transform 0.2s, box-shadow 0.2s;
}

.stat-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 25px -5px rgba(0, 0, 0, 0.1);
}

.stat-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 1rem;
}

.stat-header .emoji {
    font-size: 1.5rem;
}

.stat-header h5 {
    margin: 0;
    font-size: 1rem;
    font-weight: 600;
    color: #6b7280;
}

.stat-card .value {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
}

.primary-currency {
    font-size: 1.75rem;
    font-weight: 800;
    color: #111827;
    line-height: 1.1;
    direction: ltr !important;
    text-align: center;
}

.secondary-currency {
    font-size: 0.875rem;
    color: #6b7280;
    font-weight: 500;
    direction: ltr !important;
    text-align: center;
}

.profit .primary-currency {
    color: #059669;
}

.loss .primary-currency {
    color: #dc2626;
}

.percentage {
    font-size: 0.875rem;
    font-weight: 600;
    margin-top: 0.25rem;
}

.profit .percentage {
    color: #059669;
}

.loss .percentage {
    color: #dc2626;
}

@media (max-width: 768px) {
    .main-stats {
        grid-template-columns: 1fr;
    }
    
    .stat-header {
        flex-direction: row;
        align-items: center;
    }
    
    .primary-currency {
        font-size: 1.5rem;
    }
}
`;

// הוספת הCSS לראש הדף
if (typeof document !== 'undefined') {
    const styleSheet = document.createElement("style");
    styleSheet.innerText = styles;
    document.head.appendChild(styleSheet);
}
