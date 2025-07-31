import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const MonthlyPerformance = ({ monthlyPerformance }) => {
    if (!monthlyPerformance || monthlyPerformance.length === 0) {
        return (
            <div className="monthly-performance-card">
                <div className="card-header">
                    <h5>ביצועים חודשיים</h5>
                </div>
                <div className="no-data">
                    <i className="fas fa-chart-bar"></i>
                    <h6>אין נתוני ביצועים</h6>
                    <p>נתוני ביצועים חודשיים יוצגו כאן לאחר ביצוע עסקאות</p>
                </div>
            </div>
        );
    }

    // הכנת הנתונים לגרף
    const chartData = monthlyPerformance.map(month => ({
        month: formatMonth(month.month),
        'הפקדות': month.deposits,
        'השקעות': month.invested,
        'תשואות': month.returns,
        'דיבידנדים': month.dividends,
        'עמלות': month.fees,
        'נטו': month.deposits + month.returns + month.dividends - month.invested - month.fees
    }));

    // חישוב סטטיסטיקות כלליות
    const totalStats = monthlyPerformance.reduce((acc, month) => ({
        totalDeposits: acc.totalDeposits + month.deposits,
        totalInvested: acc.totalInvested + month.invested,
        totalReturns: acc.totalReturns + month.returns,
        totalDividends: acc.totalDividends + month.dividends,
        totalFees: acc.totalFees + month.fees
    }), { totalDeposits: 0, totalInvested: 0, totalReturns: 0, totalDividends: 0, totalFees: 0 });

    const CustomTooltip = ({ active, payload, label }) => {
        if (active && payload && payload.length) {
            return (
                <div className="custom-tooltip">
                    <p className="tooltip-label">{`${label}`}</p>
                    {payload.map((entry, index) => (
                        <p key={index} style={{ color: entry.color }}>
                            {`${entry.dataKey}: $${entry.value.toFixed(2)}`}
                        </p>
                    ))}
                </div>
            );
        }
        return null;
    };

    return (
        <div className="monthly-performance-card">
            <div className="card-header">
                <h5>ביצועים חודשיים</h5>
            </div>
            
            {/* סטטיסטיקות מסכמות */}
            <div className="performance-summary">
                <div className="summary-stats-grid">
                    <div className="summary-stat">
                        <div className="stat-label">סך הפקדות</div>
                        <div className="stat-value primary">${totalStats.totalDeposits.toFixed(2)}</div>
                    </div>
                    <div className="summary-stat">
                        <div className="stat-label">סך השקעות</div>
                        <div className="stat-value secondary">${totalStats.totalInvested.toFixed(2)}</div>
                    </div>
                    <div className="summary-stat">
                        <div className="stat-label">תשואות ממכירות</div>
                        <div className="stat-value success">${totalStats.totalReturns.toFixed(2)}</div>
                    </div>
                    <div className="summary-stat">
                        <div className="stat-label">דיבידנדים</div>
                        <div className="stat-value info">${totalStats.totalDividends.toFixed(2)}</div>
                    </div>
                </div>
            </div>

            {/* גרף */}
            <div className="chart-container">
                <ResponsiveContainer width="100%" height={400}>
                    <BarChart
                        data={chartData}
                        margin={{
                            top: 20,
                            right: 30,
                            left: 20,
                            bottom: 5,
                        }}
                    >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis 
                            dataKey="month" 
                            angle={-45}
                            textAnchor="end"
                            height={100}
                        />
                        <YAxis />
                        <Tooltip content={<CustomTooltip />} />
                        <Legend />
                        <Bar dataKey="הפקדות" fill="#3b82f6" />
                        <Bar dataKey="השקעות" fill="#ef4444" />
                        <Bar dataKey="תשואות" fill="#10b981" />
                        <Bar dataKey="דיבידנדים" fill="#f59e0b" />
                        <Bar dataKey="נטו" fill="#8b5cf6" />
                    </BarChart>
                </ResponsiveContainer>
            </div>

            {/* טבלת נתונים מפורטת */}
            <div className="monthly-table">
                <table className="table table-sm">
                    <thead>
                        <tr>
                            <th>חודש</th>
                            <th>הפקדות</th>
                            <th>השקעות</th>
                            <th>תשואות</th>
                            <th>דיבידנדים</th>
                            <th>עמלות</th>
                            <th>נטו</th>
                        </tr>
                    </thead>
                    <tbody>
                        {monthlyPerformance.slice().reverse().map((month) => {
                            const netAmount = month.deposits + month.returns + month.dividends - month.invested - month.fees;
                            return (
                                <tr key={month.month}>
                                    <td>{formatMonth(month.month)}</td>
                                    <td className="amount positive">${month.deposits.toFixed(2)}</td>
                                    <td className="amount negative">${month.invested.toFixed(2)}</td>
                                    <td className="amount positive">${month.returns.toFixed(2)}</td>
                                    <td className="amount positive">${month.dividends.toFixed(2)}</td>
                                    <td className="amount negative">${month.fees.toFixed(2)}</td>
                                    <td className={`amount ${netAmount >= 0 ? 'positive' : 'negative'}`}>
                                        ${netAmount.toFixed(2)}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

function formatMonth(monthString) {
    const [year, month] = monthString.split('-');
    const monthNames = [
        'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
        'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'
    ];
    return `${monthNames[parseInt(month) - 1]} ${year}`;
}

export default MonthlyPerformance;