import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import BudgetModal from '../Modals/BudgetModal';
import CategoryTransferModal from '../Modals/CategoryTransferModal';
import CopyTransactionModal from '../Modals/CopyTransactionModal';
import ChangeMonthModal from '../Modals/ChangeMonthModal';
import EditTransactionModal from '../Modals/EditTransactionModal';
import DeleteTransactionModal from '../Modals/DeleteTransactionModal';
import SplitTransactionModal from '../Modals/SplitTransactionModal';
import MonthlyTargetModal from '../Modals/MonthlyTargetModal';
import TransactionActionsModal from '../Modals/TransactionActionsModal';
import WeeklyBreakdown from '../WeeklyBreakdown/WeeklyBreakdown';
import { transactionsAPI, categoriesAPI } from '../../services/api';
import './CategoryCard.css';

const CategoryCard = ({ categoryName, categoryData, formatCurrency, formatDate, onDataChange, year, month }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [expandedSubCategory, setExpandedSubCategory] = useState(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [showBudgetModal, setShowBudgetModal] = useState(false);
  const [showCategoryTransferModal, setShowCategoryTransferModal] = useState(false);
  const [showCopyTransactionModal, setShowCopyTransactionModal] = useState(false);
  const [showChangeMonthModal, setShowChangeMonthModal] = useState(false);
  const [showEditTransactionModal, setShowEditTransactionModal] = useState(false);
  const [showDeleteTransactionModal, setShowDeleteTransactionModal] = useState(false);
  const [showSplitTransactionModal, setShowSplitTransactionModal] = useState(false);
  const [showMonthlyTargetModal, setShowMonthlyTargetModal] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showLinkDepositModal, setShowLinkDepositModal] = useState(false);
  const [showTransactionActionsModal, setShowTransactionActionsModal] = useState(false);
  const [currentSpending, setCurrentSpending] = useState(0);
  const [monthlyTarget, setMonthlyTarget] = useState(categoryData?.monthly_target || null);
  const [sharedTarget, setSharedTarget] = useState(null);
  const [sharedSpending, setSharedSpending] = useState(0);
  const [useSharedTarget, setUseSharedTarget] = useState(categoryData?.use_shared_target !== false);
  const dropdownRef = useRef(null);

  // Helper function to check if transaction is a split transaction
  const isSplitTransaction = (transaction) => {
    return transaction.notes && transaction.notes.includes('[SPLIT]');
  };

  // Helper function to extract split info from transaction notes
  const getSplitInfo = (transaction) => {
    if (!isSplitTransaction(transaction)) return null;
    
    const notes = transaction.notes;
    const originalIdMatch = notes.match(/מזהה מקורי: ([a-f0-9-]+)/);
    
    if (originalIdMatch) {
      const originalId = originalIdMatch[1];
      
      // Find all transactions with the same original ID to count total splits
      const allTransactions = getAllTransactionsFromCategory();
      const splitTransactions = allTransactions.filter(t => 
        t.notes && t.notes.includes(`מזהה מקורי: ${originalId}`)
      );
      
      const currentIndex = splitTransactions.findIndex(t => t.id === transaction.id);
      
      return {
        originalId,
        currentPart: currentIndex + 1,
        totalParts: splitTransactions.length,
        splitTransactions
      };
    }
    
    return null;
  };

  // Helper function to get all transactions from current category
  const getAllTransactionsFromCategory = () => {
    const allTransactions = [];
    
    // Add main category transactions
    if (categoryData.transactions) {
      allTransactions.push(...categoryData.transactions);
    }
    
    // Add subcategory transactions
    if (categoryData.subCategories) {
      Object.values(categoryData.subCategories).forEach(subCat => {
        if (subCat.transactions) {
          allTransactions.push(...subCat.transactions);
        }
      });
    }
    
    return allTransactions;
  };

  // Update monthly target when categoryData changes
  useEffect(() => {
    setMonthlyTarget(categoryData?.monthly_target || null);
    setUseSharedTarget(categoryData?.use_shared_target !== false);
  }, [categoryData?.monthly_target, categoryData?.use_shared_target]);

  // Load shared target data if category has shared_category
  useEffect(() => {
    const loadSharedTargetData = async () => {
      if (categoryData?.shared_category && useSharedTarget) {
        try {
          // Get shared target
          const targetResponse = await categoriesAPI.getSharedTarget(categoryData.shared_category);
          if (targetResponse.target) {
            setSharedTarget(targetResponse.target);
          }

          // Get shared spending
          const spendingResponse = await categoriesAPI.getSharedSpending(categoryData.shared_category);
          if (spendingResponse.success) {
            setSharedSpending(spendingResponse.currentSpending);
          }
        } catch (error) {
          console.error('Error loading shared target data:', error);
        }
      }
    };

    loadSharedTargetData();
  }, [categoryData?.shared_category, useSharedTarget]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Load current spending and update monthly target
  useEffect(() => {
    const loadCurrentSpending = async () => {
      try {
        const response = await categoriesAPI.getMonthlySpending(categoryName);
        setCurrentSpending(response.current_spending);
        console.log(`Current spending for ${categoryName}:`, response.current_spending);
      } catch (error) {
        console.error('Error loading current spending:', error);
      }
    };

    if (categoryName) {
      loadCurrentSpending();
    }
    
    // Update monthly target when categoryData changes
    const target = categoryData?.monthly_target || null;
    setMonthlyTarget(target);
    console.log(`Monthly target for ${categoryName}:`, target);
  }, [categoryName, categoryData]);

  const toggleDropdown = () => {
    setShowDropdown(!showDropdown);
    
    // Position dropdown relative to the button when opening
    if (!showDropdown && dropdownRef.current) {
      setTimeout(() => {
        const dropdown = dropdownRef.current.querySelector('.dropdown-menu');
        const button = dropdownRef.current.querySelector('.menu-dots');
        
        if (dropdown && button) {
          const buttonRect = button.getBoundingClientRect();
          const windowWidth = window.innerWidth;
          const windowHeight = window.innerHeight;
          
          // Reset classes and positioning
          dropdown.classList.remove('align-left', 'align-up');
          dropdown.style.top = '';
          dropdown.style.left = '';
          dropdown.style.right = '';
          
          // Calculate initial position (below button, aligned to right)
          let top = buttonRect.bottom + 5; // 5px gap below button
          let left = buttonRect.right - 200; // Default dropdown width alignment
          
          // Check if dropdown would go off-screen horizontally
          if (left < 20) { // Too far left
            left = buttonRect.left; // Align to left edge of button
            dropdown.classList.add('align-left');
          } else if (left + 200 > windowWidth - 20) { // Too far right
            left = buttonRect.right - 200; // Keep right-aligned
          }
          
          // Check if dropdown would go off-screen vertically
          if (top + 200 > windowHeight - 20) { // Too far down
            top = buttonRect.top - 200 - 5; // Position above button
            dropdown.classList.add('align-up');
          }
          
          // Apply calculated position
          dropdown.style.top = `${top}px`;
          dropdown.style.left = `${left}px`;
        }
      }, 10); // Small delay to ensure dropdown is rendered
    }
  };

  const toggleExpanded = () => {
    setIsExpanded(!isExpanded);
  };

  const toggleSubCategory = (subCategoryName) => {
    setExpandedSubCategory(expandedSubCategory === subCategoryName ? null : subCategoryName);
  };

  // Calculate budget progress
  const budget = categoryData.budget || 0;
  const spent = Math.abs(categoryData.spent || 0);
  const progress = budget > 0 ? Math.min((spent / budget) * 100, 100) : 0;
  const remaining = budget - spent;
  
  // Determine progress state for styling
  const getProgressState = () => {
    if (remaining < 0) return 'over-budget';
    if (progress > 80) return 'warning';
    return 'on-track';
  };
  
  const progressState = getProgressState();

  // Determine category type for styling
  const categoryType = categoryData.category_type || 'variable_expense';
  // Check if category is income by type OR by name (for shared categories)
  const isIncome = categoryType === 'income' || 
                   categoryName === 'הכנסות' || 
                   categoryName.includes('הכנסות') ||
                   categoryData?.shared_category === 'הכנסות';
  
  // DEBUG: Log category info
  console.log(`Category ${categoryName}: type=${categoryType}, isIncome=${isIncome}, shared=${categoryData?.shared_category}`);
  
  // Handler functions
  const showSetBudgetDialog = (categoryName, budget, displayName) => {
    console.log('Setting budget dialog for:', categoryName);
    setShowDropdown(false);
    setShowBudgetModal(true);
    setIsModalOpen(true);
  };

  const handleSaveBudget = async (categoryName, budgetAmount) => {
    console.log('Saving budget:', categoryName, budgetAmount);
    // TODO: Implement API call to save budget
    // For now, just close modal
    return Promise.resolve();
  };

  const handleDeleteBudget = async (categoryName) => {
    console.log('Deleting budget:', categoryName);
    // TODO: Implement API call to delete budget
    // For now, just close modal
    return Promise.resolve();
  };

  const showMassCategorizeDialog = (categoryName) => {
    console.log('Mass categorize dialog for:', categoryName);
    setShowDropdown(false);
    // TODO: Implement mass categorize dialog
  };

  const showMonthlyTargetDialog = () => {
    console.log('Monthly target dialog for:', categoryName);
    setShowDropdown(false);
    setShowMonthlyTargetModal(true);
    setIsModalOpen(true);
  };

  const handleMonthlyTargetUpdated = async (newTarget) => {
    const isSharedCategory = categoryData?.shared_category && useSharedTarget;
    
    if (isSharedCategory) {
      // Update shared target
      setSharedTarget(prev => prev ? { ...prev, monthly_target: newTarget } : { monthly_target: newTarget });
      // Reload shared data
      try {
        const targetResponse = await categoriesAPI.getSharedTarget(categoryData.shared_category);
        if (targetResponse.target) {
          setSharedTarget(targetResponse.target);
        }
      } catch (error) {
        console.error('Error reloading shared target:', error);
      }
    } else {
      // Update individual target
      setMonthlyTarget(newTarget);
    }
    
    if (onDataChange) {
      onDataChange();
    }
  };

  const handleTransactionAction = (actionType, transaction) => {
    switch (actionType) {
      case 'edit':
        showEditTransactionDialog(transaction.id);
        break;
      case 'category':
        showCategoryTransferDialog(transaction.id, transaction.business_name, transaction.amount, categoryName);
        break;
      case 'copy':
        showCopyTransactionDialog(transaction.id, transaction.amount, transaction.business_name);
        break;
      case 'split':
        showSplitTransactionDialog(transaction.id, transaction.business_name, transaction.amount);
        break;
      case 'month':
        showChangeMonthDialog(transaction.id, transaction.business_name, transaction.flow_month);
        break;
      case 'delete':
        confirmDeleteTransaction(transaction.id, transaction.business_name);
        break;
      case 'link':
        setSelectedTransaction(transaction);
        setShowLinkDepositModal(true);
        break;
      default:
        console.log('Unknown action:', actionType);
    }
  };

  const showTransactionActions = (transaction) => {
    setSelectedTransaction(transaction);
    setShowTransactionActionsModal(true);
  };


  const findTransaction = (transactionId) => {
    // Look in regular transactions first
    let transaction = transactions.find(t => t.id === transactionId);
    
    // If not found and this is a shared category, look in sub-categories
    if (!transaction && categoryData.is_shared_category) {
      for (const subCategoryData of Object.values(categoryData.sub_categories || {})) {
        transaction = (subCategoryData.transactions || []).find(t => t.id === transactionId);
        if (transaction) break;
      }
    }
    
    return transaction;
  };

  const showCategoryTransferDialog = (transactionId, businessName, amount, currentCategory) => {
    const transaction = findTransaction(transactionId);
    setSelectedTransaction(transaction);
    setShowCategoryTransferModal(true);
    setIsModalOpen(true);
  };

  const showCopyTransactionDialog = (transactionId, amount, businessName) => {
    const transaction = findTransaction(transactionId);
    setSelectedTransaction(transaction);
    setShowCopyTransactionModal(true);
    setIsModalOpen(true);
  };

  const showChangeMonthDialog = (transactionId, businessName, flowMonth) => {
    const transaction = findTransaction(transactionId);
    setSelectedTransaction(transaction);
    setShowChangeMonthModal(true);
    setIsModalOpen(true);
  };

  const showSplitTransactionDialog = (transactionId, businessName, amount) => {
    const transaction = findTransaction(transactionId);
    setSelectedTransaction(transaction);
    setShowSplitTransactionModal(true);
    setIsModalOpen(true);
  };

  const showEditTransactionDialog = (transactionId) => {
    const transaction = findTransaction(transactionId);
    setSelectedTransaction(transaction);
    setShowEditTransactionModal(true);
    setIsModalOpen(true);
  };

  const confirmDeleteTransaction = (transactionId, businessName) => {
    const transaction = findTransaction(transactionId);
    setSelectedTransaction(transaction);
    setShowDeleteTransactionModal(true);
    setIsModalOpen(true);
  };

  const showLinkDepositDialog = (transactionId, businessName) => {
    const transaction = findTransaction(transactionId);
    if (transaction) {
      setSelectedTransaction(transaction);
      setShowLinkDepositModal(true);
      setIsModalOpen(true);
    }
  };

  // Modal handlers
  const handleCategoryTransfer = async (transactionId, newCategory) => {
    try {
      await transactionsAPI.update(transactionId, { category_name: newCategory });
      if (onDataChange) {
        onDataChange();
      }
    } catch (error) {
      console.error('Error transferring transaction:', error);
      throw error;
    }
  };

  const handleCopyTransaction = async (newTransaction) => {
    try {
      await transactionsAPI.create(newTransaction);
      if (onDataChange) {
        onDataChange();
      }
    } catch (error) {
      console.error('Error copying transaction:', error);
      throw error;
    }
  };

  const handleChangeMonth = async (transactionId, newFlowMonth) => {
    try {
      await transactionsAPI.update(transactionId, { flow_month: newFlowMonth });
      if (onDataChange) {
        onDataChange();
      }
    } catch (error) {
      console.error('Error changing transaction month:', error);
      throw error;
    }
  };

  const handleEditTransaction = async (transactionId, updatedTransaction) => {
    try {
      await transactionsAPI.update(transactionId, updatedTransaction);
      if (onDataChange) {
        onDataChange();
      }
    } catch (error) {
      console.error('Error editing transaction:', error);
      throw error;
    }
  };

  const handleDeleteTransaction = async (transactionId) => {
    try {
      await transactionsAPI.delete(transactionId);
      // Refresh the dashboard data while preserving the current month
      if (onDataChange) {
        onDataChange();
      }
    } catch (error) {
      console.error('Error deleting transaction:', error);
      throw error;
    }
  };

  const handleSplitTransaction = async (splitData) => {
    try {
      await transactionsAPI.split(splitData);
      if (onDataChange) {
        onDataChange();
      }
    } catch (error) {
      console.error('Error splitting transaction:', error);
      throw error;
    }
  };

  const transactions = categoryData.transactions || [];

  return (
    <div 
      className={`category-card category-${isIncome ? 'income' : 'expense'} ${isModalOpen ? 'modal-open' : ''}`}
      data-category-name={categoryName}
      data-category-spent={categoryData.spent}
      onClick={(e) => {
        // Only expand if clicking on safe areas - not on interactive elements
        const target = e.target;
        const isClickOnButton = target.closest('button');
        const isClickOnLink = target.closest('a');
        const isClickOnInput = target.closest('input');
        const isClickOnDropdown = target.closest('.dropdown-menu');
        const isClickOnMenuDots = target.closest('.menu-dots');
        
        if (!isClickOnButton && !isClickOnLink && !isClickOnInput && !isClickOnDropdown && !isClickOnMenuDots) {
          toggleExpanded();
        }
      }}
      style={{ cursor: 'pointer' }}
    >
      {/* Category Header */}
      <div className="category-header">
        <div className="ri-bold-title">{categoryName}</div>
        <div className="category-header-actions">
          <div className={`ri-bold-body ${isIncome ? 'text-green' : 'text-red'}`}>
            {formatCurrency(spent)}
          </div>
          <div className="menu-dots" onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            toggleDropdown();
          }} ref={dropdownRef}>
            <div className="dot"></div>
            <div className="dot"></div>
            <div className="dot"></div>
            
            {/* Dropdown Menu */}
            <div className={`dropdown-menu ${showDropdown ? 'show' : ''}`}>
              <button 
                className="dropdown-item" 
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  showMonthlyTargetDialog();
                }}
              >
                <i className="fas fa-target"></i> {isIncome ? '🎯 צפי חודשי 🎯' : 'יעד חודשי'}
              </button>
              <button 
                className="dropdown-item" 
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  showSetBudgetDialog(categoryName, budget, categoryName);
                }}
              >
                <i className="fas fa-bullseye"></i> {isIncome ? 'הגדר צפי' : 'הגדר יעד'}
              </button>
              <button 
                className="dropdown-item" 
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  showMassCategorizeDialog(categoryName);
                }}
                title="סיווג כל העסקאות בקטגוריה זו"
              >
                <i className="fas fa-tags"></i> סיווג כל העסקאות
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="card-body">
        {/* Monthly Target Info Section - only show for current and future months */}
        {(() => {
          const currentDate = new Date();
          const currentYear = currentDate.getFullYear();
          const currentMonth = currentDate.getMonth() + 1;
          const isCurrentOrFutureMonth = year > currentYear || (year === currentYear && month >= currentMonth);
          
          return isCurrentOrFutureMonth;
        })() && (
          <>
            <div className="monthly-target-section">
              <div className="target-header">
                <div className="target-title">
                  {(() => {
                    const effectiveTarget = (categoryData?.shared_category && useSharedTarget && sharedTarget) 
                      ? sharedTarget.monthly_target 
                      : monthlyTarget;
                    const isSharedCategory = categoryData?.shared_category && useSharedTarget && sharedTarget;
                    const weeklyDisplay = isSharedCategory ? sharedTarget.weekly_display : categoryData.weekly_display;
                    
                    let title = isIncome 
                      ? (weeklyDisplay ? 'צפי שבועי' : 'צפי חודשי')
                      : (weeklyDisplay ? 'יעד שבועי' : 'יעד חודשי');
                    
                    if (isSharedCategory) {
                      title += ` (${categoryData.shared_category})`;
                    }
                    
                    return (
                      <>
                        {title}
                        {(!effectiveTarget || effectiveTarget === 0) && (
                          <span className="no-target-indicator"> (לא מוגדר)</span>
                        )}
                      </>
                    );
                  })()}
                </div>
                <button 
                  className="edit-target-btn"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    showMonthlyTargetDialog();
                  }}
                  title={(() => {
                    const effectiveTarget = (categoryData?.shared_category && useSharedTarget && sharedTarget) 
                      ? sharedTarget.monthly_target 
                      : monthlyTarget;
                    const isSharedCategory = categoryData?.shared_category && useSharedTarget && sharedTarget;
                    
                    if (effectiveTarget > 0) {
                      return isIncome 
                        ? `ערוך צפי חודשי${isSharedCategory ? ' משותף' : ''}`
                        : `ערוך יעד חודשי${isSharedCategory ? ' משותף' : ''}`;
                    } else {
                      return isIncome
                        ? `הגדר צפי חודשי${isSharedCategory ? ' משותף' : ''}`
                        : `הגדר יעד חודשי${isSharedCategory ? ' משותף' : ''}`;
                    }
                  })()}
                >
                  <i className={(() => {
                    const effectiveTarget = (categoryData?.shared_category && useSharedTarget && sharedTarget) 
                      ? sharedTarget.monthly_target 
                      : monthlyTarget;
                    return effectiveTarget > 0 ? "fas fa-edit" : "fas fa-plus";
                  })()}></i>
                </button>
              </div>
              
              <div className="target-info-section">
                  {(() => {
                    const effectiveTarget = (categoryData?.shared_category && useSharedTarget && sharedTarget) 
                      ? sharedTarget.monthly_target 
                      : monthlyTarget;
                    const isOutOfCashFlow = categoryData?.shared_category === 'לא בתזרים';
                    return effectiveTarget > 0 && !isOutOfCashFlow;
                  })() && (
                    <div className="target-item">
                      <div className="target-label">
                        {(() => {
                          const isSharedCategory = categoryData?.shared_category && useSharedTarget && sharedTarget;
                          const weeklyDisplay = isSharedCategory ? sharedTarget.weekly_display : categoryData.weekly_display;
                          return isIncome 
                            ? (weeklyDisplay ? 'צפי השבוע' : 'צפי החודש')
                            : (weeklyDisplay ? 'יעד השבוע' : 'יעד החודש');
                        })()}
                      </div>
                      <div className="target-value target">
                        {(() => {
                          const effectiveTarget = (categoryData?.shared_category && useSharedTarget && sharedTarget) 
                            ? sharedTarget.monthly_target 
                            : monthlyTarget;
                          const weeklyDisplay = (categoryData?.shared_category && useSharedTarget && sharedTarget) 
                            ? sharedTarget.weekly_display 
                            : categoryData.weekly_display;
                          return formatCurrency(weeklyDisplay ? (effectiveTarget * 7 / 30) : effectiveTarget);
                        })()}
                      </div>
                    </div>
                  )}
                </div>

              {/* Target/Forecast Progress Bar - only show if target/forecast exists and not "לא בתזרים" */}
              {(() => {
                const effectiveTarget = (categoryData?.shared_category && useSharedTarget && sharedTarget) 
                  ? sharedTarget.monthly_target 
                  : monthlyTarget;
                const isOutOfCashFlow = categoryData?.shared_category === 'לא בתזרים';
                return effectiveTarget > 0 && !isOutOfCashFlow;
              })() && (
                <>
                  <div className="monthly-progress-container">
                    <div 
                      className={`monthly-progress-fill ${
                        (() => {
                          const effectiveTarget = (categoryData?.shared_category && useSharedTarget && sharedTarget) 
                            ? sharedTarget.monthly_target 
                            : monthlyTarget;
                          const effectiveSpending = (categoryData?.shared_category && useSharedTarget && sharedTarget) 
                            ? sharedSpending 
                            : currentSpending;
                          const weeklyDisplay = (categoryData?.shared_category && useSharedTarget && sharedTarget) 
                            ? sharedTarget.weekly_display 
                            : categoryData.weekly_display;
                          
                          if (isIncome) {
                            return weeklyDisplay 
                              ? (effectiveSpending > (effectiveTarget * 7 / 30) ? 'over-target-good' : effectiveSpending > (effectiveTarget * 7 / 30) * 0.8 ? 'warning' : 'on-track')
                              : (effectiveSpending > effectiveTarget ? 'over-target-good' : effectiveSpending > effectiveTarget * 0.8 ? 'warning' : 'on-track');
                          } else {
                            return weeklyDisplay 
                              ? (effectiveSpending > (effectiveTarget * 7 / 30) ? 'over-target' : effectiveSpending > (effectiveTarget * 7 / 30) * 0.8 ? 'warning' : 'on-track')
                              : (effectiveSpending > effectiveTarget ? 'over-target' : effectiveSpending > effectiveTarget * 0.8 ? 'warning' : 'on-track');
                          }
                        })()
                      }`} 
                      style={{ 
                        width: `${Math.min(
                          (() => {
                            const effectiveTarget = (categoryData?.shared_category && useSharedTarget && sharedTarget) 
                              ? sharedTarget.monthly_target 
                              : monthlyTarget;
                            const effectiveSpending = (categoryData?.shared_category && useSharedTarget && sharedTarget) 
                              ? sharedSpending 
                              : currentSpending;
                            const weeklyDisplay = (categoryData?.shared_category && useSharedTarget && sharedTarget) 
                              ? sharedTarget.weekly_display 
                              : categoryData.weekly_display;
                            
                            return weeklyDisplay 
                              ? (effectiveSpending / (effectiveTarget * 7 / 30)) * 100
                              : (effectiveSpending / effectiveTarget) * 100;
                          })(), 
                          100
                        )}%` 
                      }}
                    ></div>
                  </div>

                  {/* Target/Forecast Remaining Text */}
                  <div className={`monthly-remaining-text ${
                    (() => {
                      const effectiveTarget = (categoryData?.shared_category && useSharedTarget && sharedTarget) 
                        ? sharedTarget.monthly_target 
                        : monthlyTarget;
                      const effectiveSpending = (categoryData?.shared_category && useSharedTarget && sharedTarget) 
                        ? sharedSpending 
                        : currentSpending;
                      const weeklyDisplay = (categoryData?.shared_category && useSharedTarget && sharedTarget) 
                        ? sharedTarget.weekly_display 
                        : categoryData.weekly_display;
                      
                      if (isIncome) {
                        return weeklyDisplay 
                          ? (effectiveSpending > (effectiveTarget * 7 / 30) ? 'over-target-good' : effectiveSpending > (effectiveTarget * 7 / 30) * 0.8 ? 'warning' : 'on-track')
                          : (effectiveSpending > effectiveTarget ? 'over-target-good' : effectiveSpending > effectiveTarget * 0.8 ? 'warning' : 'on-track');
                      } else {
                        return weeklyDisplay 
                          ? (effectiveSpending > (effectiveTarget * 7 / 30) ? 'over-target' : effectiveSpending > (effectiveTarget * 7 / 30) * 0.8 ? 'warning' : 'on-track')
                          : (effectiveSpending > effectiveTarget ? 'over-target' : effectiveSpending > effectiveTarget * 0.8 ? 'warning' : 'on-track');
                      }
                    })()
                  }`}>
                    {(() => {
                      const effectiveTarget = (categoryData?.shared_category && useSharedTarget && sharedTarget) 
                        ? sharedTarget.monthly_target 
                        : monthlyTarget;
                      const effectiveSpending = (categoryData?.shared_category && useSharedTarget && sharedTarget) 
                        ? sharedSpending 
                        : currentSpending;
                      const weeklyDisplay = (categoryData?.shared_category && useSharedTarget && sharedTarget) 
                        ? sharedTarget.weekly_display 
                        : categoryData.weekly_display;
                      
                      return isIncome ? (
                        weeklyDisplay ? (
                          effectiveSpending >= (effectiveTarget * 7 / 30)
                            ? `השגת את צפי השבוע! הכנסת ${formatCurrency(effectiveSpending - (effectiveTarget * 7 / 30))} מעל הצפוי`
                            : `נשאר להכניס השבוע ${formatCurrency((effectiveTarget * 7 / 30) - effectiveSpending)} להשגת הצפי`
                        ) : (
                          effectiveSpending >= effectiveTarget
                            ? `השגת את הצפי! הכנסת ${formatCurrency(effectiveSpending - effectiveTarget)} מעל הצפוי`
                            : `נשאר להכניס ${formatCurrency(effectiveTarget - effectiveSpending)} להשגת הצפי`
                        )
                      ) : (
                        weeklyDisplay ? (
                          (effectiveTarget * 7 / 30) - effectiveSpending >= 0 
                            ? `נשאר להוציא השבוע ${formatCurrency((effectiveTarget * 7 / 30) - effectiveSpending)}`
                            : `חרגת מהיעד השבועי ב${formatCurrency(effectiveSpending - (effectiveTarget * 7 / 30))}`
                        ) : (
                          effectiveTarget - effectiveSpending >= 0 
                            ? `נשאר להוציא ${formatCurrency(effectiveTarget - effectiveSpending)}`
                            : `חרגת מהיעד ב${formatCurrency(effectiveSpending - effectiveTarget)}`
                        )
                      );
                    })()}
                  </div>

                  {(() => {
                    const weeklyDisplay = (categoryData?.shared_category && useSharedTarget && sharedTarget) 
                      ? sharedTarget.weekly_display 
                      : categoryData.weekly_display;
                    return weeklyDisplay;
                  })() && (
                    <div className="weekly-target-note">
                      {(() => {
                        const effectiveTarget = (categoryData?.shared_category && useSharedTarget && sharedTarget) 
                          ? sharedTarget.monthly_target 
                          : monthlyTarget;
                        return isIncome 
                          ? `צפי שבועי מחושב על בסיס צפי חודשי של ${formatCurrency(effectiveTarget)}`
                          : `יעד שבועי מחושב על בסיס יעד חודשי של ${formatCurrency(effectiveTarget)}`;
                      })()}
                    </div>
                  )}
                </>
              )}

              <div className="target-divider"></div>
            </div>
          </>
        )}

        {/* Budget Info Section (only if budget exists) */}
        {budget > 0 && (
          <>
            <div className="budget-info-section">
              <div className="budget-item">
                <div className="budget-label">יצא</div>
                <div className="budget-value spent">{formatCurrency(spent)}</div>
              </div>
              <div className="budget-item">
                <div className="budget-label">צפוי לצאת</div>
                <div className="budget-value target">{formatCurrency(budget)}</div>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="progress-container">
              <div 
                className={`progress-fill ${progressState}`} 
                style={{ width: `${progress}%` }}
              ></div>
            </div>

            {/* Remaining Text */}
            <div className={`remaining-text ${progressState}`}>
              {remaining >= 0 
                ? `נשאר להוציא ${formatCurrency(remaining)}`
                : `חרגת מהיעד ב${formatCurrency(Math.abs(remaining))}`
              }
            </div>

            <div className="budget-divider"></div>
          </>
        )}

        {/* Expandable Section */}
        <div 
          className={`expandable-section margin-top-m ${isExpanded ? 'expanded' : ''}`}
          data-category={categoryName}
        >
          <div className="expandable-header" onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            toggleExpanded();
          }}>
            <div className="header-content">
              <span className="ri-bold-body">
                {categoryData.weekly_display ? 'פירוט שבועי' : 'פירוט חודשי'}&nbsp;&nbsp;<span className="transaction-count-badge">
                {categoryData.is_shared_category 
                  ? Object.values(categoryData.sub_categories || {}).reduce((total, subCat) => total + (subCat.transactions || []).length, 0)
                  : transactions.length
                }
              </span>
              </span>
            </div>
            <div className="expand-arrow">
              <i className={`fas fa-chevron-${isExpanded ? 'up' : 'down'}`}></i>
            </div>
          </div>

          <div className="expandable-content">
            {categoryData.weekly_display && !categoryData.is_shared_category ? (
              // Weekly breakdown view for regular categories
              <WeeklyBreakdown
                categoryName={categoryName}
                year={year || new Date().getFullYear()}
                month={month || new Date().getMonth() + 1}
                transactions={transactions}
                isExpanded={true}
                onToggleExpanded={() => {}}
                formatDate={formatDate}
                onCategoryTransfer={showCategoryTransferDialog}
                onCopyTransaction={showCopyTransactionDialog}
                onChangeMonth={showChangeMonthDialog}
                onEditTransaction={showEditTransactionDialog}
                onDeleteTransaction={confirmDeleteTransaction}
                onShowTransactionActions={showTransactionActions}
              />
            ) : categoryData.is_shared_category ? (
              // Shared category view - show sub-categories
              <div className="sub-categories-list margin-top-s">
                {Object.entries(categoryData.sub_categories || {}).map(([subCategoryName, subCategoryData]) => (
                  <div key={subCategoryName} className="sub-category-item">
                    <div 
                      className="sub-category-header"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        toggleSubCategory(subCategoryName);
                      }}
                    >
                      <div className="sub-category-info">
                        <div className="sub-category-name">{subCategoryName}</div>
                        <div className="sub-category-amount">
                          {formatCurrency(Math.abs(subCategoryData.spent || 0))}
                        </div>
                        <div className="sub-category-count">
                          {(subCategoryData.transactions || []).length} עסקאות
                        </div>
                      </div>
                      <div className="expand-arrow">
                        <i className={`fas fa-chevron-${expandedSubCategory === subCategoryName ? 'up' : 'down'}`}></i>
                      </div>
                    </div>
                    
                    {expandedSubCategory === subCategoryName && (
                      <div className="sub-category-transactions">
                        <div 
                          className="transactions-container transactions-scrollable-container"
                          data-category={subCategoryName}
                          data-page="1"
                          data-per-page={(subCategoryData.transactions || []).length}
                          data-total={(subCategoryData.transactions || []).length}
                        >
                          {(subCategoryData.transactions || []).map((transaction) => (
                            <div 
                              key={transaction.id}
                              className="transaction-item"
                              data-transaction-id={transaction.id}
                              data-currency={transaction.currency || 'ILS'}
                            >
                              <div className="transaction-actions">
                                <button 
                                  className="transaction-menu-btn" 
                                  title="פעולות"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    showTransactionActions(transaction);
                                  }}
                                >
                                  <i className="fas fa-ellipsis-v"></i>
                                </button>
                              </div>
                              <div className="transaction-info-section">
                                <div className="ri-body">
                                  <a 
                                    href={`/transaction/${transaction.id}`}
                                    style={{ color: 'inherit', textDecoration: 'none' }}
                                  >
                                    {(transaction.business_name || transaction.description || 'תנועה ללא שם')
                                      .replace(/[\u200E\u200F\u202A\u202B\u202C\u202D\u202E\u061C]/g, '')
                                      .replace(/[()[\]{}]/g, '')
                                      .trim()}
                                    {isSplitTransaction(transaction) && (
                                      <span className="split-indicator">
                                        ✂️ {getSplitInfo(transaction)?.currentPart}/{getSplitInfo(transaction)?.totalParts}
                                      </span>
                                    )}
                                  </a>
                                </div>
                                <div className="transaction-date">
                                  {formatDate(transaction.payment_date)}
                                  {transaction.payment_number && transaction.total_payments && (
                                    <span className="transaction-payment-info">
                                      תשלום {transaction.payment_number}/{transaction.total_payments}
                                    </span>
                                  )}
                                  {transaction.currency && transaction.currency !== 'ILS' && (
                                    <span className="transaction-currency-info">
                                      {transaction.currency}
                                    </span>
                                  )}
                                  {/* Display exchange rate info if transaction is linked */}
                                  {transaction.exchange_rate && transaction.original_currency && (
                                    <span className="transaction-currency-info" style={{
                                      backgroundColor: '#e8f5e8',
                                      color: '#2e7d32',
                                      border: '1px solid #c8e6c9'
                                    }}>
                                      🔗 {transaction.exchange_rate.toFixed(4)} {transaction.original_currency}/USD
                                    </span>
                                  )}
                                </div>
                              </div>
                              <div className="transaction-right-side">
                                <div className={`transaction-amount ${isIncome ? 'income' : 'expense'}`}>
                                  {formatCurrency(Math.abs(parseFloat(transaction.amount || 0)), transaction.currency)}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                        
                        {(subCategoryData.transactions || []).length > 0 && (
                          <div className="transaction-pagination-info">
                            מציג 1-{(subCategoryData.transactions || []).length} מתוך {(subCategoryData.transactions || []).length} עסקאות
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              // Regular category view - show transactions directly or weekly breakdown
              <div className="transaction-list margin-top-s">
                <div 
                  className="transactions-container transactions-scrollable-container"
                  data-category={categoryName}
                  data-page="1"
                  data-per-page={transactions.length}
                  data-total={transactions.length}
                >
                  {transactions.map((transaction) => (
                  <div 
                    key={transaction.id}
                    className="transaction-item"
                    data-transaction-id={transaction.id}
                    data-currency={transaction.currency || 'ILS'}
                  >
                    <div className="transaction-actions">
                      <button 
                        className="transaction-menu-btn" 
                        title="פעולות"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          showTransactionActions(transaction);
                        }}
                      >
                        <i className="fas fa-ellipsis-v"></i>
                      </button>
                    </div>
                    <div className="transaction-info-section">
                      <div className="ri-body">
                        <a 
                          href={`/transaction/${transaction.id}`}
                          style={{ color: 'inherit', textDecoration: 'none' }}
                        >
                          {(transaction.business_name || transaction.description || 'תנועה ללא שם')
                            .replace(/[\u200E\u200F\u202A\u202B\u202C\u202D\u202E\u061C]/g, '')
                            .replace(/[()[\]{}]/g, '')
                            .trim()}
                          {isSplitTransaction(transaction) && (
                            <span className="split-indicator">
                              ✂️ {getSplitInfo(transaction)?.currentPart}/{getSplitInfo(transaction)?.totalParts}
                            </span>
                          )}
                        </a>
                      </div>
                      <div className="transaction-date">
                        {formatDate(transaction.payment_date)}
                        {transaction.payment_number && transaction.total_payments && (
                          <span className="transaction-payment-info">
                            תשלום {transaction.payment_number}/{transaction.total_payments}
                          </span>
                        )}
                        {transaction.currency && transaction.currency !== 'ILS' && (
                          <span className="transaction-currency-info">
                            {transaction.currency}
                          </span>
                        )}
                        {/* Display exchange rate info if transaction is linked */}
                        {transaction.exchange_rate && transaction.original_currency && (
                          <span className="transaction-currency-info" style={{
                            backgroundColor: '#e8f5e8',
                            color: '#2e7d32',
                            border: '1px solid #c8e6c9'
                          }}>
                            🔗 {transaction.exchange_rate.toFixed(4)} {transaction.original_currency}/USD
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="transaction-right-side">
                      <div className={`transaction-amount ${isIncome ? 'income' : 'expense'}`}>
                        {formatCurrency(Math.abs(parseFloat(transaction.amount || 0)), transaction.currency)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              
                {transactions.length > 0 && (
                  <div className="transaction-pagination-info">
                    מציג 1-{transactions.length} מתוך {transactions.length} עסקאות
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* All Modals rendered using Portal */}
      {showBudgetModal && createPortal(
        <BudgetModal
          isOpen={showBudgetModal}
          onClose={() => { setShowBudgetModal(false); setIsModalOpen(false); }}
          categoryName={categoryName}
          currentBudget={budget}
          onSave={handleSaveBudget}
          onDelete={handleDeleteBudget}
        />,
        document.body
      )}

      {showCategoryTransferModal && createPortal(
        <CategoryTransferModal
          isOpen={showCategoryTransferModal}
          onClose={() => { setShowCategoryTransferModal(false); setIsModalOpen(false); }}
          transaction={selectedTransaction}
          onTransfer={handleCategoryTransfer}
        />,
        document.body
      )}

      {showCopyTransactionModal && createPortal(
        <CopyTransactionModal
          isOpen={showCopyTransactionModal}
          onClose={() => { setShowCopyTransactionModal(false); setIsModalOpen(false); }}
          transaction={selectedTransaction}
          onCopy={handleCopyTransaction}
        />,
        document.body
      )}

      {showChangeMonthModal && createPortal(
        <ChangeMonthModal
          isOpen={showChangeMonthModal}
          onClose={() => { setShowChangeMonthModal(false); setIsModalOpen(false); }}
          transaction={selectedTransaction}
          onChangeMonth={handleChangeMonth}
        />,
        document.body
      )}

      {showEditTransactionModal && createPortal(
        <EditTransactionModal
          isOpen={showEditTransactionModal}
          onClose={() => { setShowEditTransactionModal(false); setIsModalOpen(false); }}
          transaction={selectedTransaction}
          onSave={handleEditTransaction}
        />,
        document.body
      )}

      {showDeleteTransactionModal && createPortal(
        <DeleteTransactionModal
          isOpen={showDeleteTransactionModal}
          onClose={() => { setShowDeleteTransactionModal(false); setIsModalOpen(false); }}
          transaction={selectedTransaction}
          onDelete={handleDeleteTransaction}
        />,
        document.body
      )}

      {showLinkDepositModal && createPortal(
        <LinkDepositModal
          isOpen={showLinkDepositModal}
          onClose={() => { setShowLinkDepositModal(false); setIsModalOpen(false); }}
          transaction={selectedTransaction}
          onDataChange={onDataChange}
        />,
        document.body
      )}

      {showMonthlyTargetModal && createPortal(
        <MonthlyTargetModal
          isOpen={showMonthlyTargetModal}
          onClose={() => { setShowMonthlyTargetModal(false); setIsModalOpen(false); }}
          categoryName={categoryData?.shared_category && useSharedTarget ? categoryData.shared_category : categoryName}
          currentTarget={(categoryData?.shared_category && useSharedTarget && sharedTarget) ? sharedTarget.monthly_target : monthlyTarget}
          formatCurrency={formatCurrency}
          onTargetUpdated={handleMonthlyTargetUpdated}
          isIncome={isIncome}
          isSharedTarget={categoryData?.shared_category && useSharedTarget}
          sharedCategoryName={categoryData?.shared_category}
        />,
        document.body
      )}

      {showTransactionActionsModal && createPortal(
        <TransactionActionsModal
          isOpen={showTransactionActionsModal}
          onClose={() => { setShowTransactionActionsModal(false); setIsModalOpen(false); }}
          transaction={selectedTransaction}
          categoryName={categoryName}
          onAction={handleTransactionAction}
        />,
        document.body
      )}

      {showSplitTransactionModal && createPortal(
        <SplitTransactionModal
          isOpen={showSplitTransactionModal}
          onClose={() => { setShowSplitTransactionModal(false); setIsModalOpen(false); }}
          transaction={selectedTransaction}
          onSplit={handleSplitTransaction}
        />,
        document.body
      )}
    </div>
  );
};

// Enhanced LinkDepositModal Component
const LinkDepositModal = ({ isOpen, onClose, transaction, onDataChange }) => {
  const [mainCashFlow, setMainCashFlow] = React.useState(null);
  const [allCashFlows, setAllCashFlows] = React.useState([]);
  const [selectedCashFlow, setSelectedCashFlow] = React.useState(null);
  const [potentialExpenses, setPotentialExpenses] = React.useState([]);
  const [selectedExpense, setSelectedExpense] = React.useState(null);
  const [loading, setLoading] = React.useState(false);
  const [linking, setLinking] = React.useState(false);
  const [selectedMonth, setSelectedMonth] = React.useState('');
  const [selectedYear, setSelectedYear] = React.useState('');
  const [showAllMonths, setShowAllMonths] = React.useState(false);
  const [showAllExpenses, setShowAllExpenses] = React.useState(false);

  // Load main cash flow and all cash flows on modal open
  React.useEffect(() => {
    const loadCashFlows = async () => {
      if (!isOpen) return;
      
      try {
        setLoading(true);
        // Import API here to avoid circular dependency issues
        const { cashFlowsAPI } = await import('../../services/api');
        
        // Get all cash flows
        const allCashFlowsResponse = await cashFlowsAPI.getAll();
        const cashFlows = allCashFlowsResponse.data || allCashFlowsResponse;
        setAllCashFlows(cashFlows);
        
        // Try to get default cash flow
        try {
          const defaultResponse = await cashFlowsAPI.getDefault();
          const defaultCashFlow = defaultResponse.data || defaultResponse;
          setMainCashFlow(defaultCashFlow);
          setSelectedCashFlow(defaultCashFlow);
        } catch {
          // If no default, use first non-investment cash flow
          const nonInvestmentCashFlow = cashFlows.find(cf => cf.id !== 'bbdb9129-5d88-4d36-b2d8-4345aa3fcd54');
          if (nonInvestmentCashFlow) {
            setMainCashFlow(nonInvestmentCashFlow);
            setSelectedCashFlow(nonInvestmentCashFlow);
          }
        }
      } catch (error) {
        console.error('Error loading cash flows:', error);
      } finally {
        setLoading(false);
      }
    };

    loadCashFlows();
  }, [isOpen]);

  // Set initial month and year based on transaction date
  React.useEffect(() => {
    if (transaction && isOpen) {
      const depositDate = new Date(transaction.payment_date);
      const year = depositDate.getFullYear();
      const month = depositDate.getMonth() + 1;
      setSelectedYear(year.toString());
      setSelectedMonth(month.toString());
    }
  }, [transaction, isOpen]);

  // Load potential expenses when cash flow, month, or year is selected
  React.useEffect(() => {
    const loadPotentialExpenses = async () => {
      if (!selectedCashFlow || !transaction || !isOpen) return;
      
      console.log('[LinkDeposit] Loading expenses for cash flow:', selectedCashFlow.id, selectedCashFlow.name);
      console.log('[LinkDeposit] Search params:', { showAllMonths, showAllExpenses, selectedYear, selectedMonth });
      
      try {
        setLoading(true);
        const { transactionsAPI } = await import('../../services/api');
        
        let queryParams = {
          cashFlowId: selectedCashFlow.id,
          page: 1,
          limit: 200
        };

        // Add month/year filters only if specific month is selected (not "show all")
        if (!showAllMonths && selectedYear && selectedMonth) {
          queryParams.year = parseInt(selectedYear);
          queryParams.month = parseInt(selectedMonth);
        }
        
        // Try the correct API method - check what method exists
        console.log('[LinkDeposit] Available API methods:', Object.keys(transactionsAPI));
        const response = await transactionsAPI.getAll(queryParams);
        console.log('[LinkDeposit] API Response:', response);
        console.log('[LinkDeposit] Transactions count:', (response.transactions || response).length);
        
        // Filter for potential linking candidates
        const depositAmountUSD = Math.abs(parseFloat(transaction.amount));
        const expenses = (response.transactions || response).filter(t => {
          // Skip already linked transactions and the same transaction
          if (t.original_currency || t.id === transaction.id) return false;
          
          const amount = parseFloat(t.amount);
          if (amount >= 0) return false; // Only negative amounts (outgoing)
          
          const expenseAmountILS = Math.abs(amount);
          const exchangeRate = expenseAmountILS / depositAmountUSD;
          
          // Smart exchange rate filtering (3-5 ILS per USD is reasonable)
          const isReasonableRate = exchangeRate >= 3 && exchangeRate <= 5;
          
          if (showAllExpenses) {
            // Show all negative amounts with reasonable exchange rates
            return isReasonableRate;
          } else {
            // Smart filtering: prioritize Blink transactions with reasonable rates
            const hasBlink = t.business_name && t.business_name.includes('בלינק');
            return hasBlink && isReasonableRate;
          }
        });
        
        console.log('[LinkDeposit] Deposit amount USD:', depositAmountUSD);
        console.log('[LinkDeposit] Filter results - showAllExpenses:', showAllExpenses);
        console.log('[LinkDeposit] All transactions before filtering:', (response.transactions || response).map(t => ({
          id: t.id,
          business_name: t.business_name,
          amount: t.amount,
          original_currency: t.original_currency,
          hasBlink: t.business_name && t.business_name.includes('בלינק'),
          exchangeRate: Math.abs(parseFloat(t.amount)) / depositAmountUSD
        })));
        console.log('[LinkDeposit] Filtered expenses:', expenses.map(t => ({
          id: t.id,
          business_name: t.business_name,
          amount: t.amount
        })));
        console.log('[LinkDeposit] All Blink transactions with rates:', 
          (response.transactions || response)
            .filter(t => t.business_name && t.business_name.includes('בלינק') && parseFloat(t.amount) < 0)
            .map(t => ({ 
              id: t.id, 
              business_name: t.business_name, 
              amount: t.amount,
              rate: (Math.abs(parseFloat(t.amount)) / depositAmountUSD).toFixed(2),
              inRange: Math.abs(parseFloat(t.amount)) / depositAmountUSD >= 3 && Math.abs(parseFloat(t.amount)) / depositAmountUSD <= 5
            }))
        );
        console.log('[LinkDeposit] Filtered expenses:', expenses.length, 'out of', (response.transactions || response).length);
        
        setPotentialExpenses(expenses);
        setSelectedExpense(null);
      } catch (error) {
        console.error('Error loading potential expenses:', error);
        setPotentialExpenses([]);
      } finally {
        setLoading(false);
      }
    };

    loadPotentialExpenses();
  }, [selectedCashFlow, transaction, selectedYear, selectedMonth, showAllMonths, showAllExpenses, isOpen]);

  const handleLinkConfirm = async () => {
    if (!selectedExpense || !transaction) return;
    
    try {
      setLinking(true);
      const { transactionsAPI } = await import('../../services/api');
      
      const depositAmountUSD = Math.abs(parseFloat(transaction.amount));
      const expenseAmount = Math.abs(parseFloat(selectedExpense.amount));
      const exchangeRate = expenseAmount / depositAmountUSD;
      
      // Update the deposit with linking information
      await transactionsAPI.update(transaction.id, {
        original_currency: selectedExpense.currency || 'ILS',
        exchange_rate: exchangeRate,
        exchange_date: transaction.payment_date,
        linked_transaction_id: selectedExpense.id
      });
      
      // Show success message with exchange details
      const exchangeRateDisplay = exchangeRate.toFixed(4);
      const expenseCurrency = selectedExpense.currency || 'ILS';
      
      alert(`הקישור נוצר בהצלחה!
      
סכום הפקדה: $${depositAmountUSD.toLocaleString()}
סכום בשקל: ${expenseAmount.toLocaleString()} ${expenseCurrency}
יחס המרה: 1 USD = ${exchangeRateDisplay} ${expenseCurrency}`);
      
      onClose();
      
      // Refresh data to show the updated transaction
      if (onDataChange) {
        onDataChange();
      }
    } catch (error) {
      console.error('Error creating link:', error);
      alert('שגיאה ביצירת הקישור: ' + error.message);
    } finally {
      setLinking(false);
    }
  };

  if (!isOpen || !transaction) return null;

  return (
    <div className="modal-overlay" style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 1000
    }}>
      <div className="modal-content" style={{
        backgroundColor: 'white',
        padding: '2rem',
        borderRadius: '8px',
        maxWidth: '700px',
        width: '90%',
        maxHeight: '80vh',
        overflowY: 'auto',
        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
      }}>
        <h3 style={{ marginBottom: '1.5rem', textAlign: 'center' }}>קישור הפקדה להוצאה</h3>
        
        {/* Deposit Info */}
        <div style={{ marginBottom: '1.5rem', padding: '12px', backgroundColor: '#e3f2fd', border: '1px solid #bbdefb', borderRadius: '4px' }}>
          <h5 style={{ margin: '0 0 10px 0' }}>הפקדה לקישור:</h5>
          <div><strong>תאריך:</strong> {new Date(transaction.payment_date).toLocaleDateString('he-IL')}</div>
          <div><strong>סכום:</strong> ${Math.abs(parseFloat(transaction.amount)).toLocaleString()}</div>
          <div><strong>עסק:</strong> {transaction.business_name}</div>
        </div>

        {loading && (
          <div style={{ textAlign: 'center', padding: '20px' }}>
            טוען...
          </div>
        )}

        {!loading && (
          <>
            {/* Cash Flow Selection */}
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
                בחר תזרים למציאת הוצאות:
              </label>
              <select
                value={selectedCashFlow?.id || ''}
                onChange={(e) => {
                  const cashFlow = allCashFlows.find(cf => cf.id === e.target.value);
                  setSelectedCashFlow(cashFlow);
                }}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  fontSize: '14px'
                }}
              >
                <option value="">-- בחר תזרים --</option>
                {allCashFlows
                  .filter(cf => cf.id !== 'bbdb9129-5d88-4d36-b2d8-4345aa3fcd54')
                  .map(cashFlow => (
                    <option key={cashFlow.id} value={cashFlow.id}>
                      {cashFlow.name} ({cashFlow.currency || 'ILS'})
                      {mainCashFlow?.id === cashFlow.id ? ' (ראשי)' : ''}
                    </option>
                  ))}
              </select>
            </div>

            {/* Month and Year Selection */}
            {selectedCashFlow && (
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
                  בחר תקופה:
                </label>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '10px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <input
                      type="checkbox"
                      checked={showAllMonths}
                      onChange={(e) => setShowAllMonths(e.target.checked)}
                    />
                    הצג את כל החודשים
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <input
                      type="checkbox"
                      checked={showAllExpenses}
                      onChange={(e) => setShowAllExpenses(e.target.checked)}
                    />
                    הצג את כל ההוצאות בחודש (כולל לא-בלינק)
                  </label>
                </div>

                {!showAllMonths && (
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px' }}>שנה:</label>
                      <select
                        value={selectedYear}
                        onChange={(e) => setSelectedYear(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '6px 8px',
                          border: '1px solid #ddd',
                          borderRadius: '4px',
                          fontSize: '14px'
                        }}
                      >
                        <option value="2023">2023</option>
                        <option value="2024">2024</option>
                        <option value="2025">2025</option>
                      </select>
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px' }}>חודש:</label>
                      <select
                        value={selectedMonth}
                        onChange={(e) => setSelectedMonth(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '6px 8px',
                          border: '1px solid #ddd',
                          borderRadius: '4px',
                          fontSize: '14px'
                        }}
                      >
                        <option value="1">ינואר</option>
                        <option value="2">פברואר</option>
                        <option value="3">מרץ</option>
                        <option value="4">אפריל</option>
                        <option value="5">מאי</option>
                        <option value="6">יוני</option>
                        <option value="7">יולי</option>
                        <option value="8">אוגוסט</option>
                        <option value="9">ספטמבר</option>
                        <option value="10">אוקטובר</option>
                        <option value="11">נובמבר</option>
                        <option value="12">דצמבר</option>
                      </select>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Potential Expenses */}
            {selectedCashFlow && (
              <div style={{ marginBottom: '1.5rem' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold' }}>
                    {showAllMonths 
                      ? (showAllExpenses ? `כל ההוצאות בתזרים ${selectedCashFlow.name}:` : `העברות בלינק בתזרים ${selectedCashFlow.name}:`)
                      : (showAllExpenses ? `כל ההוצאות ב${['', 'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'][parseInt(selectedMonth) || 0]} ${selectedYear}:` : `העברות בלינק ב${['', 'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'][parseInt(selectedMonth) || 0]} ${selectedYear}:`)}
                  </label>
                  <div style={{ fontSize: '12px', color: '#666', marginBottom: '8px' }}>
                    מוצגות רק עסקאות בטווח שער חליפין סביר (3-5 ₪ לדולר)
                  </div>
                </div>
                
                {loading ? (
                  <div style={{ 
                    padding: '15px', 
                    backgroundColor: '#f8f9fa', 
                    border: '1px solid #e9ecef', 
                    borderRadius: '4px',
                    textAlign: 'center',
                    color: '#666'
                  }}>
                    טוען הוצאות...
                  </div>
                ) : potentialExpenses.length === 0 ? (
                  <div style={{ 
                    padding: '15px', 
                    backgroundColor: '#f8f9fa', 
                    border: '1px solid #e9ecef', 
                    borderRadius: '4px',
                    textAlign: 'center',
                    color: '#666'
                  }}>
                    {!showAllExpenses && !showAllMonths 
                      ? 'לא נמצאו העברות בלינק בטווח שער חליפין סביר (3-5 ₪ לדולר) בתקופה זו - נסה לבחור תקופה אחרת או סמן "הצג את כל ההוצאות בחודש"'
                      : showAllMonths && !showAllExpenses
                      ? 'לא נמצאו העברות בלינק בטווח שער חליפין סביר בתזרים זה - סמן "הצג את כל ההוצאות" לראות אפשרויות נוספות'
                      : 'לא נמצאו הוצאות בטווח שער חליפין סביר (3-5 ₪ לדולר) בתקופה/תזרים זה'}
                  </div>
                ) : (
                  <div style={{
                    maxHeight: '300px',
                    overflowY: 'auto',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    backgroundColor: '#fafafa'
                  }}>
                    {potentialExpenses.map(expense => (
                      <div
                        key={expense.id}
                        className={`expense-item ${selectedExpense?.id === expense.id ? 'selected' : ''}`}
                        style={{
                          padding: '12px',
                          borderBottom: '1px solid #eee',
                          cursor: 'pointer',
                          backgroundColor: selectedExpense?.id === expense.id ? '#e3f2fd' : 'white',
                          transition: 'background-color 0.2s ease'
                        }}
                        onClick={() => setSelectedExpense(expense)}
                      >
                        <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>
                          {expense.business_name}
                        </div>
                        <div style={{ fontSize: '14px', color: '#666' }}>
                          {new Date(expense.payment_date).toLocaleDateString('he-IL')} - 
                          <strong style={{ color: '#007bff', marginLeft: '8px' }}>
                            {Math.abs(parseFloat(expense.amount)).toLocaleString()} {expense.currency || 'ILS'}
                          </strong>
                          <span style={{ color: '#28a745', marginLeft: '8px', fontSize: '12px' }}>
                            (שער: {(Math.abs(parseFloat(expense.amount)) / Math.abs(parseFloat(transaction.amount))).toFixed(2)})
                          </span>
                        </div>
                        {expense.notes && (
                          <div style={{ fontSize: '12px', color: '#888', marginTop: '4px' }}>
                            {expense.notes}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Exchange Rate Calculation */}
            {selectedExpense && (
              <div style={{ 
                marginBottom: '1.5rem', 
                padding: '12px', 
                backgroundColor: '#f8f9fa', 
                border: '1px solid #e9ecef', 
                borderRadius: '4px' 
              }}>
                <h6 style={{ margin: '0 0 8px 0' }}>חישוב שער חליפין:</h6>
                <div>
                  {Math.abs(parseFloat(selectedExpense.amount)).toLocaleString()} {selectedExpense.currency || 'ILS'} = 
                  {Math.abs(parseFloat(transaction.amount)).toLocaleString()} USD
                </div>
                <div style={{ fontWeight: 'bold', marginTop: '8px' }}>
                  שער חליפין: {(Math.abs(parseFloat(selectedExpense.amount)) / Math.abs(parseFloat(transaction.amount))).toFixed(4)} {selectedExpense.currency || 'ILS'}/USD
                </div>
              </div>
            )}
          </>
        )}

        {/* Action Buttons */}
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', marginTop: '2rem' }}>
          <button
            onClick={onClose}
            disabled={linking}
            style={{
              flex: 1,
              padding: '12px 20px',
              backgroundColor: '#6c757d',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: linking ? 'not-allowed' : 'pointer',
              opacity: linking ? 0.6 : 1
            }}
          >
            ביטול
          </button>
          <button
            onClick={handleLinkConfirm}
            disabled={!selectedExpense || linking || loading}
            style={{
              flex: 1,
              padding: '12px 20px',
              backgroundColor: selectedExpense && !linking && !loading ? '#28a745' : '#ccc',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: selectedExpense && !linking && !loading ? 'pointer' : 'not-allowed'
            }}
          >
            {linking ? 'יוצר קישור...' : 'צור קישור'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CategoryCard;