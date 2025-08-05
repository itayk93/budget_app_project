import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from 'react-query';
import { transactionsAPI } from '../../services/api';
import LoadingSpinner from '../../components/Common/LoadingSpinner';
import TransactionActionsModal from '../../components/Modals/TransactionActionsModal';
import EditTransactionModal from '../../components/Modals/EditTransactionModal';
import DeleteTransactionModal from '../../components/Modals/DeleteTransactionModal';
import ChangeMonthModal from '../../components/Modals/ChangeMonthModal';
import CopyTransactionModal from '../../components/Modals/CopyTransactionModal';
import SplitTransactionModal from '../../components/Modals/SplitTransactionModal';
import './TransactionDetails.css';

const TransactionDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  
  console.log('TransactionDetails component loaded with ID:', id);
  
  // Add debugging for page refresh or redirect
  React.useEffect(() => {
    console.log('TransactionDetails component mounted with ID:', id);
    if (!id) {
      console.warn('No transaction ID provided');
    }
  }, [id]);
  const [isActionsModalOpen, setIsActionsModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isCopyModalOpen, setIsCopyModalOpen] = useState(false);
  const [isMoveModalOpen, setIsMoveModalOpen] = useState(false);
  const [isSplitModalOpen, setIsSplitModalOpen] = useState(false);

  // Fetch transaction details
  const { data: transaction, isLoading, error } = useQuery(
    ['transaction', id],
    () => {
      console.log('Fetching transaction with ID:', id);
      return transactionsAPI.getById(id);
    },
    {
      retry: 1,
      refetchOnWindowFocus: false,
      onError: (error) => {
        console.error('Error fetching transaction:', error);
      },
      onSuccess: (data) => {
        console.log('Transaction data loaded:', data);
      }
    }
  );

  // Fetch business details for the transaction
  const { data: businessDetails, isLoading: isBusinessLoading } = useQuery(
    ['transaction-business', id],
    () => {
      console.log('Fetching business details for transaction ID:', id);
      return transactionsAPI.getBusinessDetails(id);
    },
    {
      retry: 1,
      refetchOnWindowFocus: false,
      enabled: !!id,
      onError: (error) => {
        console.error('Error fetching business details:', error);
      },
      onSuccess: (data) => {
        console.log('Business details loaded:', data);
      }
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

  // Helper function to check if transaction is a split transaction
  const isSplitTransaction = (transaction) => {
    return transaction?.notes && transaction.notes.includes('[SPLIT]');
  };

  // Helper function to extract split info from transaction notes
  const getSplitInfo = (transaction) => {
    if (!isSplitTransaction(transaction)) return null;
    
    const notes = transaction.notes;
    const originalIdMatch = notes.match(/מזהה מקורי: ([a-f0-9-]+)/);
    
    if (originalIdMatch) {
      return {
        originalId: originalIdMatch[1],
        // For now, we'll show a basic indication - could be enhanced later
        currentPart: 1,
        totalParts: '?'
      };
    }
    
    return null;
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

  const handleActionSelect = (actionType) => {
    setIsActionsModalOpen(false);
    
    switch (actionType) {
      case 'edit':
        setIsEditModalOpen(true);
        break;
      case 'category':
        // For now, we'll use the edit modal for category changes
        setIsEditModalOpen(true);
        break;
      case 'copy':
        setIsCopyModalOpen(true);
        break;
      case 'split':
        setIsSplitModalOpen(true);
        break;
      case 'month':
        setIsMoveModalOpen(true);
        break;
      case 'delete':
        setIsDeleteModalOpen(true);
        break;
      default:
        break;
    }
  };

  const handleModalSuccess = () => {
    // Refetch transaction data after any update
    window.location.reload();
  };

  const handleSplitTransaction = async (splitData) => {
    try {
      await transactionsAPI.split(splitData);
      // Navigate back to dashboard after successful split
      navigate('/dashboard');
    } catch (error) {
      console.error('Error splitting transaction:', error);
      throw error;
    }
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
          <button className="btn txn-primary-btn" onClick={handleGoBack}>
            חזור
          </button>
        </div>
      </div>
    );
  }

  // Check if this is a non-cash-flow transaction
  const isNonCashflow = transaction.category_name && transaction.category_name.includes('לא תזרימיות');
  const isIncome = parseFloat(transaction.amount) >= 0;
  const amount = Math.abs(parseFloat(transaction.amount));

  return (
    <div className="transaction-details">
      <div className="txn-details-page-header">
        <button className="txn-back-btn" onClick={handleGoBack}>
          <i className="fas fa-arrow-right"></i>
          חזור
        </button>
        <h1>פרטי עסקה</h1>
        <button 
          className="txn-actions-btn"
          onClick={() => setIsActionsModalOpen(true)}
        >
          <i className="fas fa-ellipsis-v"></i>
          פעולות
        </button>
      </div>

      <div className="transaction-details-content">
        {/* Main Transaction Card */}
        <div className="main-transaction-card">
          {isNonCashflow && (
            <div className="non-cashflow-banner">
              <i className="fas fa-info-circle"></i>
              <span>עסקה לא תזרימית - לא משפיעה על יתרת התקציב החודשי</span>
            </div>
          )}
          <div className="transaction-header">
            <div className="transaction-icon">
              <i className={`fas ${isIncome ? 'fa-arrow-down text-success' : 'fa-arrow-up text-danger'}`}></i>
              {isNonCashflow && <div className="non-cashflow-indicator">לא תזרימי</div>}
            </div>
            <div className="transaction-main-info">
              <h2 className="business-name">
                {transaction.business_name || transaction.description || 'עסקה ללא שם'}
                {isSplitTransaction(transaction) && (
                  <span className="split-indicator-page">
                    ✂️ חלק מעסקה מפוצלת
                  </span>
                )}
              </h2>
              <div className={`amount ${isIncome ? 'income' : 'expense'} ${isNonCashflow ? 'non-cashflow' : ''}`}>
                {formatCurrency(amount, transaction.currency)}
                {isNonCashflow && <span className="non-cashflow-label">לא תזרימי</span>}
              </div>
              <div className="transaction-date">
                {formatDate(transaction.payment_date)}
              </div>
              {transaction.payment_number && transaction.total_payments && (
                <div className="payment-info">
                  תשלום {transaction.payment_number}/{transaction.total_payments}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Quick Actions Grid */}
        <div className="quick-actions-grid">
          <button 
            className="quick-action-card"
            onClick={() => setIsEditModalOpen(true)}
          >
            <div className="action-icon edit">
              <i className="fas fa-edit"></i>
            </div>
            <span>עריכת עסקה</span>
          </button>
          
          <button 
            className="quick-action-card"
            onClick={() => setIsEditModalOpen(true)}
          >
            <div className="action-icon category">
              <i className="fas fa-tag"></i>
            </div>
            <span>שינוי קטגוריה</span>
          </button>
          
          <button 
            className="quick-action-card"
            onClick={() => setIsCopyModalOpen(true)}
          >
            <div className="action-icon copy">
              <i className="fas fa-copy"></i>
            </div>
            <span>העתקה</span>
          </button>
          
          <button 
            className="quick-action-card danger"
            onClick={() => setIsDeleteModalOpen(true)}
          >
            <div className="action-icon delete">
              <i className="fas fa-trash"></i>
            </div>
            <span>מחיקה</span>
          </button>
        </div>

        {/* Details Cards */}
        <div className="details-grid">
          {/* General Information */}
          <div className="detail-card">
            <div className="card-header">
              <i className="fas fa-info-circle"></i>
              <h3>פרטים כלליים</h3>
            </div>
            <div className="card-content">
              <div className="detail-row">
                <span className="label">קטגוריה</span>
                <span className="value category-badge">
                  {transaction.category_name || 'לא מסווג'}
                </span>
              </div>
              <div className="detail-row">
                <span className="label">אמצעי תשלום</span>
                <span className="value">{getPaymentMethodLabel(transaction.payment_method)}</span>
              </div>
              <div className="detail-row">
                <span className="label">מטבע</span>
                <span className="value">{transaction.currency || 'ILS'}</span>
              </div>
              <div className="detail-row">
                <span className="label">תזרים מזומנים</span>
                <span className="value">{transaction.cash_flow_name || 'לא ידוע'}</span>
              </div>
            </div>
          </div>

          {/* Split Transaction Details */}
          {isSplitTransaction(transaction) && (
            <div className="detail-card split-info-card">
              <div className="card-header">
                <i className="fas fa-cut"></i>
                <h3>פרטי פיצול</h3>
              </div>
              <div className="card-content">
                <div className="detail-row">
                  <span className="label">סטטוס</span>
                  <span className="value split-status">
                    ✂️ חלק מעסקה מפוצלת
                  </span>
                </div>
                <div className="detail-row">
                  <span className="label">מזהה עסקה מקורית</span>
                  <span className="value original-id">
                    {getSplitInfo(transaction)?.originalId.substring(0, 8)}...
                  </span>
                </div>
                <div className="detail-row">
                  <span className="label">הערות פיצול</span>
                  <span className="value split-notes">
                    {transaction.notes.replace('[SPLIT] ', '')}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Business Details */}
          {businessDetails && businessDetails.found && businessDetails.business_details && (
            <div className="detail-card">
              <div className="card-header">
                <i className="fas fa-store"></i>
                <h3>פרטי בית העסק</h3>
              </div>
              <div className="card-content">
                {businessDetails.business_details.business_info?.name && (
                  <div className="detail-row">
                    <span className="label">שם רשמי</span>
                    <span className="value">{businessDetails.business_details.business_info.name}</span>
                  </div>
                )}
                {businessDetails.business_details.business_info?.type && (
                  <div className="detail-row">
                    <span className="label">סוג עסק</span>
                    <span className="value">{businessDetails.business_details.business_info.type}</span>
                  </div>
                )}
                {businessDetails.business_details.business_info?.location && (
                  <div className="detail-row">
                    <span className="label">מיקום</span>
                    <span className="value">{businessDetails.business_details.business_info.location}</span>
                  </div>
                )}
                {businessDetails.business_details.business_info?.address && (
                  <div className="detail-row">
                    <span className="label">כתובת</span>
                    <span className="value">{businessDetails.business_details.business_info.address}</span>
                  </div>
                )}
                {businessDetails.business_details.business_info?.phone && (
                  <div className="detail-row">
                    <span className="label">טלפון</span>
                    <span className="value">
                      <a href={`tel:${businessDetails.business_details.business_info.phone}`}>
                        {businessDetails.business_details.business_info.phone}
                      </a>
                    </span>
                  </div>
                )}
                {businessDetails.business_details.business_info?.website && (
                  <div className="detail-row">
                    <span className="label">אתר אינטרנט</span>
                    <span className="value">
                      <a href={businessDetails.business_details.business_info.website} target="_blank" rel="noopener noreferrer">
                        {businessDetails.business_details.business_info.website}
                      </a>
                    </span>
                  </div>
                )}
                {businessDetails.business_details.business_info?.opening_hours && (
                  <div className="detail-row">
                    <span className="label">שעות פעילות</span>
                    <span className="value">{businessDetails.business_details.business_info.opening_hours}</span>
                  </div>
                )}
                {businessDetails.business_details.business_info?.services && (
                  <div className="detail-row">
                    <span className="label">שירותים</span>
                    <span className="value">{businessDetails.business_details.business_info.services}</span>
                  </div>
                )}
                {businessDetails.business_details.business_info?.description && (
                  <div className="detail-row">
                    <span className="label">תיאור</span>
                    <span className="value description-text">{businessDetails.business_details.business_info.description}</span>
                  </div>
                )}
                {businessDetails.business_details.analysis_date && (
                  <div className="detail-row">
                    <span className="label">תאריך ניתוח</span>
                    <span className="value">
                      {new Date(businessDetails.business_details.analysis_date).toLocaleDateString('he-IL')}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Description */}
          {transaction.description && (
            <div className="detail-card">
              <div className="card-header">
                <i className="fas fa-comment"></i>
                <h3>הערות</h3>
              </div>
              <div className="card-content">
                <div className="description-text">
                  {transaction.description}
                </div>
              </div>
            </div>
          )}

          {/* Currency Exchange */}
          {transaction.original_currency && (
            <div className="detail-card">
              <div className="card-header">
                <i className="fas fa-exchange-alt"></i>
                <h3>המרת מטבע</h3>
              </div>
              <div className="card-content">
                <div className="detail-row">
                  <span className="label">מטבע מקורי</span>
                  <span className="value">{transaction.original_currency}</span>
                </div>
                <div className="detail-row">
                  <span className="label">שער חליפין</span>
                  <span className="value">{transaction.exchange_rate}</span>
                </div>
                <div className="detail-row">
                  <span className="label">תאריך חליפין</span>
                  <span className="value">{formatDate(transaction.exchange_date)}</span>
                </div>
              </div>
            </div>
          )}

          {/* Technical Information */}
          <div className="detail-card">
            <div className="card-header">
              <i className="fas fa-cog"></i>
              <h3>מידע טכני</h3>
            </div>
            <div className="card-content">
              <div className="detail-row">
                <span className="label">מזהה עסקה</span>
                <span className="value transaction-id">{transaction.id}</span>
              </div>
              <div className="detail-row">
                <span className="label">תאריך יצירה</span>
                <span className="value">
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
                <div className="detail-row">
                  <span className="label">עדכון אחרון</span>
                  <span className="value">
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

      {/* Transaction Actions Modal */}
      <TransactionActionsModal
        isOpen={isActionsModalOpen}
        onClose={() => setIsActionsModalOpen(false)}
        transaction={transaction}
        onAction={handleActionSelect}
      />

      {/* Edit Modal */}
      <EditTransactionModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        transaction={transaction}
        onSuccess={handleModalSuccess}
      />

      {/* Delete Modal */}
      <DeleteTransactionModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        transaction={transaction}
        onSuccess={handleDeleteSuccess}
      />

      {/* Copy Transaction Modal */}
      <CopyTransactionModal
        isOpen={isCopyModalOpen}
        onClose={() => setIsCopyModalOpen(false)}
        transaction={transaction}
        onSuccess={handleModalSuccess}
      />

      {/* Move Transaction Modal */}
      <ChangeMonthModal
        isOpen={isMoveModalOpen}
        onClose={() => setIsMoveModalOpen(false)}
        transaction={transaction}
        onSuccess={handleModalSuccess}
      />

      {/* Split Transaction Modal */}
      <SplitTransactionModal
        isOpen={isSplitModalOpen}
        onClose={() => setIsSplitModalOpen(false)}
        transaction={transaction}
        onSplit={handleSplitTransaction}
      />
    </div>
  );
};

export default TransactionDetails;