import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from 'react-query';
import { transactionsAPI } from '../../services/api';
import LoadingSpinner from '../../components/Common/LoadingSpinner';
import EditTransactionModal from '../../components/Modals/EditTransactionModal';
import DeleteTransactionModal from '../../components/Modals/DeleteTransactionModal';
import './TransactionDetails.css';

const TransactionDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  // Fetch transaction details
  const { data: transaction, isLoading, error } = useQuery(
    ['transaction', id],
    () => transactionsAPI.getById(id),
    {
      retry: 1,
      refetchOnWindowFocus: false
    }
  );

  const formatCurrency = (amount, currency = 'ILS') => {
    const symbols = {
      'ILS': '₪',
      'USD': '$',
      'EUR': '€'
    };
    
    const symbol = symbols[currency] || currency;
    const precision = currency === 'ILS' ? 1 : 2;
    
    if (currency === 'ILS') {
      return `${amount.toFixed(precision)} ${symbol}`;
    } else {
      return `${symbol}${amount.toFixed(precision)}`;
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('he-IL', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'long'
    });
  };

  const getPaymentMethodLabel = (method) => {
    const methods = {
      'credit_card': 'כרטיס אשראי',
      'debit_card': 'כרטיס חיוב',
      'cash': 'מזומן',
      'bank_transfer': 'העברה בנקאית',
      'check': 'צ\'ק'
    };
    return methods[method] || method;
  };

  const handleGoBack = () => {
    navigate(-1);
  };

  const handleEditSuccess = () => {
    setIsEditModalOpen(false);
    // The query will automatically refetch due to cache invalidation
  };

  const handleDeleteSuccess = () => {
    navigate('/transactions');
  };

  if (isLoading) {
    return (
      <div className="transaction-details-loading">
        <LoadingSpinner size="large" text="טוען פרטי תנועה..." />
      </div>
    );
  }

  if (error || !transaction) {
    return (
      <div className="transaction-details-error">
        <div className="error-content">
          <div className="error-icon">
            <i className="fas fa-exclamation-triangle"></i>
          </div>
          <h2>שגיאה בטעינת התנועה</h2>
          <p>לא ניתן למצוא את התנועה המבוקשת</p>
          <button className="btn btn-primary" onClick={handleGoBack}>
            חזור
          </button>
        </div>
      </div>
    );
  }

  const isIncome = parseFloat(transaction.amount) >= 0;
  const amount = Math.abs(parseFloat(transaction.amount));

  return (
    <div className="transaction-details">
      <div className="transaction-details-header">
        <button className="back-button" onClick={handleGoBack}>
          <i className="fas fa-arrow-right"></i>
          חזור
        </button>
        <h1>פרטי תנועה</h1>
        <div className="header-actions">
          <button 
            className="btn btn-secondary"
            onClick={() => setIsEditModalOpen(true)}
          >
            <i className="fas fa-edit"></i>
            עריכה
          </button>
          <button 
            className="btn btn-danger"
            onClick={() => setIsDeleteModalOpen(true)}
          >
            <i className="fas fa-trash"></i>
            מחיקה
          </button>
        </div>
      </div>

      <div className="transaction-details-content">
        <div className="transaction-card">
          <div className={`transaction-amount ${isIncome ? 'income' : 'expense'}`}>
            <div className="amount-label">
              {isIncome ? 'הכנסה' : 'הוצאה'}
            </div>
            <div className="amount-value">
              {formatCurrency(amount, transaction.currency)}
            </div>
          </div>

          <div className="transaction-info">
            <div className="info-section">
              <h3>פרטים כלליים</h3>
              <div className="info-grid">
                <div className="info-item">
                  <label>שם העסק</label>
                  <span>{transaction.business_name || 'לא צוין'}</span>
                </div>
                <div className="info-item">
                  <label>תאריך התשלום</label>
                  <span>{formatDate(transaction.payment_date)}</span>
                </div>
                <div className="info-item">
                  <label>קטגוריה</label>
                  <span className="category-badge">
                    {transaction.category_name || 'לא מסווג'}
                  </span>
                </div>
                <div className="info-item">
                  <label>אמצעי תשלום</label>
                  <span>{getPaymentMethodLabel(transaction.payment_method)}</span>
                </div>
                <div className="info-item">
                  <label>מטבע</label>
                  <span>{transaction.currency || 'ILS'}</span>
                </div>
                <div className="info-item">
                  <label>תזרים מזומנים</label>
                  <span>{transaction.cash_flow_name || 'לא ידוע'}</span>
                </div>
              </div>
            </div>

            {transaction.description && (
              <div className="info-section">
                <h3>הערות</h3>
                <div className="description-content">
                  {transaction.description}
                </div>
              </div>
            )}

            {transaction.original_currency && (
              <div className="info-section">
                <h3>פרטי המרת מטבע</h3>
                <div className="info-grid">
                  <div className="info-item">
                    <label>מטבע מקורי</label>
                    <span>{transaction.original_currency}</span>
                  </div>
                  <div className="info-item">
                    <label>שער חליפין</label>
                    <span>{transaction.exchange_rate}</span>
                  </div>
                  <div className="info-item">
                    <label>תאריך חליפין</label>
                    <span>{formatDate(transaction.exchange_date)}</span>
                  </div>
                </div>
              </div>
            )}

            <div className="info-section">
              <h3>מידע טכני</h3>
              <div className="info-grid">
                <div className="info-item">
                  <label>מזהה תנועה</label>
                  <span className="transaction-id">{transaction.id}</span>
                </div>
                <div className="info-item">
                  <label>תאריך יצירה</label>
                  <span>
                    {transaction.created_at ? 
                      new Date(transaction.created_at).toLocaleDateString('he-IL', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      }) 
                      : 'לא ידוע'
                    }
                  </span>
                </div>
                {transaction.updated_at && transaction.updated_at !== transaction.created_at && (
                  <div className="info-item">
                    <label>תאריך עדכון אחרון</label>
                    <span>
                      {new Date(transaction.updated_at).toLocaleDateString('he-IL', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Edit Modal */}
      <EditTransactionModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        transaction={transaction}
        onSuccess={handleEditSuccess}
      />

      {/* Delete Modal */}
      <DeleteTransactionModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        transaction={transaction}
        onSuccess={handleDeleteSuccess}
      />
    </div>
  );
};

export default TransactionDetails;