
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
                    <div className="flex items-center gap-2 sm:gap-3 p-3 bg-gradient-to-r from-white to-gray-50/50 rounded-lg hover:from-gray-50 hover:to-gray-100/50 transition-all duration-200 group border border-gray-100 hover:border-gray-200 hover:shadow-sm mb-2" key={trans.id}>
                        <div className="flex-1 min-w-0">
                            <div className="font-medium text-gray-900 truncate text-sm sm:text-base">
                                {trans.stock_symbol}
                            </div>
                            <div className="text-xs text-gray-500 mt-1">
                                {new Date(trans.transaction_date).toLocaleDateString('he-IL')}
                            </div>
                        </div>
                        <div className="text-left flex-shrink-0">
                            <div className={`text-xs px-2 py-1 rounded-full mb-1 ${
                                trans.transaction_type === 'buy' 
                                    ? 'bg-green-100 text-green-600' 
                                    : 'bg-red-100 text-red-600'
                            }`}>
                                {trans.transaction_type === 'buy' ? 'קניה' : 'מכירה'}
                            </div>
                            <div className="font-bold text-sm px-2 py-1 rounded-full whitespace-nowrap text-blue-600 bg-blue-50 border border-blue-100">
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
