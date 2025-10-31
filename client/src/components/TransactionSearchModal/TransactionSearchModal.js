import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import Modal from '../Common/Modal';
import { useQuery, useQueryClient } from 'react-query';
import { transactionsAPI, cashFlowsAPI } from '../../services/api';
import LoadingSpinner from '../Common/LoadingSpinner';
import TransactionActionsModal from '../Modals/TransactionActionsModal';
import CategoryTransferModal from '../Modals/CategoryTransferModal';
import CopyTransactionModal from '../Modals/CopyTransactionModal';
import ChangeMonthModal from '../Modals/ChangeMonthModal';
import EditTransactionModal from '../Modals/EditTransactionModal';
import DeleteTransactionModal from '../Modals/DeleteTransactionModal';
import SplitTransactionModal from '../Modals/SplitTransactionModal';
import './TransactionSearchModal.css';

const TransactionSearchModal = ({ isOpen, onClose }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCashFlow, setSelectedCashFlow] = useState(null);
  const [filteredTransactions, setFilteredTransactions] = useState([]);
  const [selectedTransaction, setSelectedTransaction] = useState(null);
  const [showTransactionActionsModal, setShowTransactionActionsModal] = useState(false);
  const [showCategoryTransferModal, setShowCategoryTransferModal] = useState(false);
  const [showCopyTransactionModal, setShowCopyTransactionModal] = useState(false);
  const [showChangeMonthModal, setShowChangeMonthModal] = useState(false);
  const [showEditTransactionModal, setShowEditTransactionModal] = useState(false);
  const [showDeleteTransactionModal, setShowDeleteTransactionModal] = useState(false);
  const [showSplitTransactionModal, setShowSplitTransactionModal] = useState(false);
  const queryClient = useQueryClient();

  // Fetch cash flows
  const { data: cashFlows } = useQuery(
    'cashFlows',
    cashFlowsAPI.getAll
  );

  // Fetch all transactions for current cash flow (all time periods)
  const { data: allTransactions, isLoading: transactionsLoading } = useQuery(
    ['allTransactions', selectedCashFlow?.id],
    () => {
      if (selectedCashFlow?.id === 'all') {
        // Fetch transactions from all cash flows
        return transactionsAPI.getAll({
          show_all: true,
          per_page: 100000 // Get all transactions
        });
      } else {
        return transactionsAPI.getAll({
          cash_flow_id: selectedCashFlow?.id,
          show_all: true,
          per_page: 100000 // Get all transactions
        });
      }
    },
    {
      enabled: !!selectedCashFlow,
      staleTime: 0, // Always fresh data
      cacheTime: 0  // Don't cache
    }
  );

  // Set default cash flow when modal opens
  useEffect(() => {
    if (isOpen && cashFlows && !selectedCashFlow) {
      // Set "all cash flows" as default
      setSelectedCashFlow({ id: 'all', name: 'כל התזרימים' });
    }
  }, [isOpen, cashFlows, selectedCashFlow]);

  // Filter transactions based on search query
  useEffect(() => {
    if (!allTransactions?.transactions || !searchQuery.trim()) {
      setFilteredTransactions([]);
      return;
    }

    const query = searchQuery.toLowerCase();
    const filtered = allTransactions.transactions.filter(transaction => {
      const businessName = (transaction.business_name || '').toLowerCase();
      const description = (transaction.description || '').toLowerCase();
      const categoryName = (transaction.category_name || '').toLowerCase();
      const amount = Math.abs(parseFloat(transaction.amount)).toString();
      
      return businessName.includes(query) ||
             description.includes(query) ||
             categoryName.includes(query) ||
             amount.includes(query);
    });

    // Sort by date (newest first)
    filtered.sort((a, b) => new Date(b.payment_date) - new Date(a.payment_date));
    
    // Limit to 1000 results for performance
    setFilteredTransactions(filtered.slice(0, 1000));
  }, [allTransactions, searchQuery]);

  const formatCurrency = (amount, currency = 'ILS') => {
    if (amount === null || amount === undefined || isNaN(amount)) {
      amount = 0;
    }
    
    const numericAmount = Number(amount);
    
    if (currency === 'ILS') {
      return `${Math.round(numericAmount)} ₪`;
    }
    return `${numericAmount.toFixed(2)} ${currency}`;
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('he-IL');
  };

  // Transaction action functions
  const handleTransactionAction = (actionType, transaction) => {
    switch (actionType) {
      case 'edit':
        showEditTransactionDialog(transaction.id);
        break;
      case 'category':
        showCategoryTransferDialog(transaction.id);
        break;
      case 'copy':
        showCopyTransactionDialog(transaction.id);
        break;
      case 'split':
        showSplitTransactionDialog(transaction.id);
        break;
      case 'month':
        showChangeMonthDialog(transaction.id);
        break;
      case 'delete':
        confirmDeleteTransaction(transaction.id);
        break;
      default:
        console.log('Unknown action:', actionType);
    }
  };

  const showTransactionActions = (transaction) => {
    console.log('🔍 [TransactionSearchModal] showTransactionActions called for:', transaction?.id);
    console.log('🔍 [TransactionSearchModal] Current modal states:', {
      actions: showTransactionActionsModal,
      category: showCategoryTransferModal,
      split: showSplitTransactionModal,
      copy: showCopyTransactionModal,
      edit: showEditTransactionModal,
      delete: showDeleteTransactionModal,
      changeMonth: showChangeMonthModal
    });

    // Don't open actions modal if any other modal is already open
    if (showCategoryTransferModal || showSplitTransactionModal || showCopyTransactionModal || 
        showEditTransactionModal || showDeleteTransactionModal || showChangeMonthModal) {
      console.log('🔍 [TransactionSearchModal] Another modal is open, not opening actions modal');
      return;
    }

    setSelectedTransaction(transaction);
    
    // Use setTimeout to prevent the click event from immediately closing the modal
    setTimeout(() => {
      console.log('🔍 [TransactionSearchModal] Setting actions modal to true...');
      setShowTransactionActionsModal(true);
    }, 10);
  };

  const showCategoryTransferDialog = (transactionId) => {
    console.log('🔍 [TransactionSearchModal] showCategoryTransferDialog called for:', transactionId);
    const transaction = filteredTransactions.find(t => t.id === transactionId);
    console.log('🔍 [TransactionSearchModal] Found transaction:', transaction?.id, transaction?.business_name);
    setSelectedTransaction(transaction);
    console.log('🔍 [TransactionSearchModal] Closing actions modal...');
    // Close transaction actions modal first
    setShowTransactionActionsModal(false);
    console.log('🔍 [TransactionSearchModal] Opening category transfer modal...');
    // Then open category transfer modal
    setShowCategoryTransferModal(true);
    console.log('🔍 [TransactionSearchModal] Category modal state set to true, selectedTransaction:', transaction?.id);
  };

  const showCopyTransactionDialog = (transactionId) => {
    const transaction = filteredTransactions.find(t => t.id === transactionId);
    setSelectedTransaction(transaction);
    // Close transaction actions modal first
    setShowTransactionActionsModal(false);
    // Then open copy modal
    setShowCopyTransactionModal(true);
  };

  const showChangeMonthDialog = (transactionId) => {
    const transaction = filteredTransactions.find(t => t.id === transactionId);
    setSelectedTransaction(transaction);
    // Close transaction actions modal first
    setShowTransactionActionsModal(false);
    // Then open change month modal
    setShowChangeMonthModal(true);
  };

  const showEditTransactionDialog = (transactionId) => {
    const transaction = filteredTransactions.find(t => t.id === transactionId);
    setSelectedTransaction(transaction);
    // Close transaction actions modal first
    setShowTransactionActionsModal(false);
    // Then open edit modal
    setShowEditTransactionModal(true);
  };

  const showSplitTransactionDialog = (transactionId) => {
    const transaction = filteredTransactions.find(t => t.id === transactionId);
    setSelectedTransaction(transaction);
    // Close transaction actions modal first
    setShowTransactionActionsModal(false);
    // Then open split modal
    setShowSplitTransactionModal(true);
  };

  const confirmDeleteTransaction = (transactionId) => {
    const transaction = filteredTransactions.find(t => t.id === transactionId);
    setSelectedTransaction(transaction);
    // Close transaction actions modal first
    setShowTransactionActionsModal(false);
    // Then open delete modal
    setShowDeleteTransactionModal(true);
  };

  const refreshData = () => {
    // Refresh transactions after any action
    queryClient.invalidateQueries(['allTransactions', selectedCashFlow?.id]);
  };

  const handleSplitTransaction = async (splitData) => {
    try {
      await transactionsAPI.split(splitData);
      refreshData();
      return { success: true };
    } catch (error) {
      console.error('❌ Split transaction error in TransactionSearchModal:', error);
      throw error;
    }
  };

  const handleCategoryTransfer = async (transactionId, newCategory) => {
    try {
      console.log('🔍 [TransactionSearchModal] handleCategoryTransfer called:', { transactionId, newCategory });
      await transactionsAPI.update(transactionId, { category_name: newCategory });
      refreshData();
      console.log('✅ [TransactionSearchModal] Category transfer successful');
    } catch (error) {
      console.error('❌ Category transfer error in TransactionSearchModal:', error);
      throw error;
    }
  };

  const handleCloseActionsModal = () => {
    setShowTransactionActionsModal(false);
    // DON'T clear selectedTransaction here - other modals might need it
    // setSelectedTransaction(null);
    refreshData();
  };

  const handleClose = () => {
    setSearchQuery('');
    setFilteredTransactions([]);
    onClose();
  };

  if (!isOpen) return null;

  const anotherModalOpen = (
    showTransactionActionsModal ||
    showSplitTransactionModal ||
    showCategoryTransferModal ||
    showCopyTransactionModal ||
    showChangeMonthModal ||
    showEditTransactionModal ||
    showDeleteTransactionModal
  );

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={handleClose}
        className="transaction-search-modal"
        size="large"
        closeOnBackdrop={!anotherModalOpen}
      >
        <div className="modal-header">
          <div className="header-content-centered">
            <h2>חיפוש עסקאות</h2>
            <button className="close-btn" onClick={handleClose}>
              <i className="fas fa-times"></i>
            </button>
          </div>
        </div>
        
        <div className="modal-body">
          <div className="search-controls">
            <div className="cash-flow-selector">
              <label>תזרים נוכחי:</label>
              <select
                value={selectedCashFlow?.id || 'all'}
                onChange={(e) => {
                  if (e.target.value === 'all') {
                    setSelectedCashFlow({ id: 'all', name: 'כל התזרימים' });
                  } else {
                    const cashFlow = cashFlows?.find(cf => cf.id === e.target.value);
                    setSelectedCashFlow(cashFlow);
                  }
                  setSearchQuery(''); // Reset search when changing cash flow
                  setFilteredTransactions([]);
                }}
              >
                <option value="all">כל התזרימים</option>
                {cashFlows?.map(cashFlow => (
                  <option key={cashFlow.id} value={cashFlow.id}>
                    {cashFlow.name}
                  </option>
                ))}
              </select>
            </div>
            
            <div className="search-input-container">
              <input
                type="text"
                className="search-input"
                placeholder="הקלד לחיפוש עסקאות (שם עסק, תיאור, קטגוריה, סכום)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                autoFocus
              />
              {searchQuery && (
                <button 
                  className="clear-search-btn"
                  onClick={() => {
                    setSearchQuery('');
                    setFilteredTransactions([]);
                  }}
                >
                  <i className="fas fa-times"></i>
                </button>
              )}
            </div>
          </div>

          <div className="search-results">
            {transactionsLoading ? (
              <div className="loading-container">
                <LoadingSpinner size="medium" text="טוען עסקאות..." />
              </div>
            ) : !searchQuery.trim() ? (
              <div className="empty-state">
                <div className="empty-icon">
                  <i className="fas fa-search"></i>
                </div>
                <p>התחל להקליד כדי לחפש עסקאות</p>
                <small>חיפוש יתבצע בכל העסקאות מכל התקופות</small>
              </div>
            ) : filteredTransactions.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">
                  <i className="fas fa-search"></i>
                </div>
                <p>לא נמצאו עסקאות התואמות לחיפוש</p>
                <small>נסה מילות חיפוש אחרות</small>
              </div>
            ) : (
              <div className="transactions-list">
                <div className="results-header">
                  <span>נמצאו {filteredTransactions.length} עסקאות</span>
                  {filteredTransactions.length === 1000 && (
                    <small>(מוצגות 1000 התוצאות הראשונות)</small>
                  )}
                </div>
                
                {filteredTransactions.map(transaction => {
                  const cashFlowName = cashFlows?.find(cf => cf.id === transaction.cash_flow_id)?.name || 'לא ידוע';
                  const isPositive = parseFloat(transaction.amount) >= 0;
                  const amountText = isPositive ? 'התקבל' : 'שולם';
                  
                  return (
                    <div key={transaction.id} className="flex items-center gap-2 sm:gap-3 p-3 bg-gradient-to-r from-white to-gray-50/50 rounded-lg hover:from-gray-50 hover:to-gray-100/50 transition-all duration-200 group border border-gray-100 hover:border-gray-200 hover:shadow-sm mb-2">
                      <button 
                        className="flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-gray-200 hover:bg-gray-300 transition-all duration-200 opacity-0 group-hover:opacity-100 sm:opacity-100 flex-shrink-0" 
                        title="פעולות"
                        onClick={() => showTransactionActions(transaction)}
                      >
                        <i className="fas fa-ellipsis-v text-gray-600 text-xs"></i>
                      </button>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2 sm:gap-4">
                          <div className="min-w-0 flex-1">
                            <div className="font-medium text-gray-900 truncate text-sm sm:text-base">
                              {transaction.business_name}
                            </div>
                            <div className="flex items-center gap-1 sm:gap-2 mt-1 text-xs text-gray-500 flex-wrap">
                              <span className="bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full whitespace-nowrap">
                                {cashFlowName}
                              </span>
                              <span className="bg-green-100 text-green-600 px-2 py-0.5 rounded-full whitespace-nowrap">
                                {transaction.category_name || 'לא מסווג'}
                              </span>
                              {transaction.description && (
                                <span className="text-gray-500 truncate">
                                  {transaction.description}
                                </span>
                              )}
                            </div>
                          </div>
                          
                          <div className="text-left flex-shrink-0">
                            <div className="text-xs text-gray-500 whitespace-nowrap">
                              {formatDate(transaction.payment_date)}
                            </div>
                            <div className="flex flex-col items-end mt-1">
                              <span className="text-xs text-gray-600">{amountText}</span>
                              <span className={`font-bold text-sm px-2 py-0.5 rounded-full whitespace-nowrap ${
                                isPositive 
                                  ? 'text-emerald-600 bg-emerald-50 border border-emerald-100' 
                                  : 'text-red-600 bg-red-50 border border-red-100'
                              }`}>
                                {formatCurrency(Math.abs(parseFloat(transaction.amount)), transaction.currency)}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </Modal>

      {/* All Transaction Modals */}
      {showTransactionActionsModal && createPortal(
        <TransactionActionsModal
          isOpen={showTransactionActionsModal}
          onClose={handleCloseActionsModal}
          transaction={selectedTransaction}
          categoryName={selectedTransaction?.category_name}
          onAction={handleTransactionAction}
        />,
        document.body
      )}

      {showCategoryTransferModal && createPortal(
        <CategoryTransferModal
          isOpen={showCategoryTransferModal}
          onClose={() => { 
            console.log('🔍 [TransactionSearchModal] CategoryTransferModal closing...');
            setShowCategoryTransferModal(false); 
            setSelectedTransaction(null); // Clear selection when modal closes
            refreshData(); 
          }}
          transaction={selectedTransaction}
          onTransfer={handleCategoryTransfer}
        />,
        document.body
      )}

      {showCopyTransactionModal && createPortal(
        <CopyTransactionModal
          isOpen={showCopyTransactionModal}
          onClose={() => { 
            setShowCopyTransactionModal(false); 
            setSelectedTransaction(null);
            refreshData(); 
          }}
          transaction={selectedTransaction}
        />,
        document.body
      )}

      {showChangeMonthModal && createPortal(
        <ChangeMonthModal
          isOpen={showChangeMonthModal}
          onClose={() => { 
            setShowChangeMonthModal(false); 
            setSelectedTransaction(null);
            refreshData(); 
          }}
          transaction={selectedTransaction}
        />,
        document.body
      )}

      {showEditTransactionModal && createPortal(
        <EditTransactionModal
          isOpen={showEditTransactionModal}
          onClose={() => { 
            setShowEditTransactionModal(false); 
            setSelectedTransaction(null);
            refreshData(); 
          }}
          transaction={selectedTransaction}
        />,
        document.body
      )}

      {showDeleteTransactionModal && createPortal(
        <DeleteTransactionModal
          isOpen={showDeleteTransactionModal}
          onClose={() => { 
            setShowDeleteTransactionModal(false); 
            setSelectedTransaction(null);
            refreshData(); 
          }}
          transaction={selectedTransaction}
        />,
        document.body
      )}

      {showSplitTransactionModal && createPortal(
        <SplitTransactionModal
          isOpen={showSplitTransactionModal}
          onClose={() => { 
            setShowSplitTransactionModal(false); 
            setSelectedTransaction(null); // Clear selection when modal closes
            refreshData(); 
          }}
          transaction={selectedTransaction}
          onSplit={handleSplitTransaction}
        />,
        document.body
      )}
    </>
  );
};

export default TransactionSearchModal;
