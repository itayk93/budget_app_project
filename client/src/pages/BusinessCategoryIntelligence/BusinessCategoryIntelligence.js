import React, { useState, useEffect } from 'react';
import './BusinessCategoryIntelligence.css';
import Modal from '../../components/Common/Modal';

const BusinessCategoryIntelligence = () => {
  const [businesses, setBusinesses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [suggestions, setSuggestions] = useState([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedBusinesses, setSelectedBusinesses] = useState(new Set());
  const [selectedForGPT, setSelectedForGPT] = useState(new Set());
  const [transactionModal, setTransactionModal] = useState(null);
  const [businessTransactions, setBusinessTransactions] = useState([]);
  const [loadingTransactions, setLoadingTransactions] = useState(false);
  const [debugMode, setDebugMode] = useState(false);
  const [editableSuggestions, setEditableSuggestions] = useState([]);
  const [availableCategories, setAvailableCategories] = useState([]);
  const [loadingCategories, setLoadingCategories] = useState(false);
  const [specificTransactionsModal, setSpecificTransactionsModal] = useState(null);
  const [specificTransactions, setSpecificTransactions] = useState([]);
  const [selectedTransactionIds, setSelectedTransactionIds] = useState(new Set());
  const [loadingSpecificTransactions, setLoadingSpecificTransactions] = useState(false);

  useEffect(() => {
    fetchVariableExpenseBusinesses();
    fetchAvailableCategories();
  }, []);

  const fetchAvailableCategories = async () => {
    setLoadingCategories(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/transactions/categories/available', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setAvailableCategories(data.categories || []);
      } else {
        console.error('Error fetching categories:', response.statusText);
      }
    } catch (error) {
      console.error('Error fetching categories:', error);
    } finally {
      setLoadingCategories(false);
    }
  };

  const fetchVariableExpenseBusinesses = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/transactions/businesses/variable-expenses', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setBusinesses(data.businesses || []);
      } else {
        console.error('Error fetching businesses:', response.statusText);
      }
    } catch (error) {
      console.error('Error fetching businesses:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleGPTSelect = (businessName, selected) => {
    const newSelected = new Set(selectedForGPT);
    if (selected) {
      newSelected.add(businessName);
    } else {
      newSelected.delete(businessName);
    }
    setSelectedForGPT(newSelected);
  };

  const handleSelectAllForGPT = () => {
    if (selectedForGPT.size === businesses.length) {
      setSelectedForGPT(new Set());
    } else {
      setSelectedForGPT(new Set(businesses.map(b => b.business_name)));
    }
  };

  const handleAnalyzeWithGPT = async () => {
    if (selectedForGPT.size === 0) {
      alert('אנא בחר לפחות בית עסק אחד לניתוח');
      return;
    }

    setLoadingSuggestions(true);
    try {
      const token = localStorage.getItem('token');
      const businessNames = Array.from(selectedForGPT);
      
      const response = await fetch('/api/transactions/businesses/suggest-categories', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          businesses: businessNames,
          debug: true // תמיד נבקש מידע מפורט
        })
      });

      if (response.ok) {
        const data = await response.json();
        const suggestions = data.suggestions || [];
        setSuggestions(suggestions);
        // יצירת העתקים ניתנים לעריכה
        setEditableSuggestions(suggestions.map(s => ({
          ...s,
          editable_category: s.suggested_category || ''
        })));
        setShowSuggestions(true);
      } else {
        console.error('Error getting suggestions:', response.statusText);
        alert('השתמשנו בסיווג אוטומטי - אמת את התוצאות');
      }
    } catch (error) {
      console.error('Error getting suggestions:', error);
      alert('השתמשנו בסיווג אוטומטי - אמת את התוצאות');
    } finally {
      setLoadingSuggestions(false);
    }
  };

  const handleBusinessSelect = (businessName, selected) => {
    const newSelected = new Set(selectedBusinesses);
    if (selected) {
      newSelected.add(businessName);
    } else {
      newSelected.delete(businessName);
    }
    setSelectedBusinesses(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedBusinesses.size === suggestions.length) {
      setSelectedBusinesses(new Set());
    } else {
      setSelectedBusinesses(new Set(suggestions.map(s => s.business_name)));
    }
  };

  const handleCategoryChange = (businessName, newCategory) => {
    setEditableSuggestions(prev => 
      prev.map(s => 
        s.business_name === businessName 
          ? { ...s, editable_category: newCategory || null }
          : s
      )
    );
  };

  // עדכון כל העסק (כל הרשומות עם אותו business_name)
  const handleUpdateAllBusiness = async (businessName, newCategory) => {
    const confirmed = window.confirm(
      `האם אתה בטוח שברצונך לעדכן את כל הרשומות של "${businessName}" לקטגוריה "${newCategory}"?`
    );

    if (!confirmed) return;

    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/transactions/businesses/update-categories', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          category_updates: [{
            business_name: businessName,
            new_category: newCategory
          }]
        })
      });

      if (response.ok) {
        const data = await response.json();
        alert(`עודכנו בהצלחה ${data.results.success} רשומות עבור "${businessName}"`);
        
        // רענון הנתונים
        fetchVariableExpenseBusinesses();
      } else {
        console.error('Error updating all business:', response.statusText);
        alert('שגיאה בעדכון הקטגוריות');
      }
    } catch (error) {
      console.error('Error updating all business:', error);
      alert('שגיאה בעדכון הקטגוריות');
    }
  };

  // פתיחת modal לבחירת רשומות ספציפיות
  const handleUpdateSpecificTransactions = async (businessName, newCategory) => {
    setLoadingSpecificTransactions(true);
    setSpecificTransactionsModal({ businessName, newCategory, transactions: [] });

    try {
      const token = localStorage.getItem('token');
      const encodedBusinessName = encodeURIComponent(businessName);
      
      const response = await fetch(
        `/api/transactions/businesses/${encodedBusinessName}/transactions?category_name=הוצאות משתנות`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );

      if (response.ok) {
        const data = await response.json();
        setSpecificTransactions(data.transactions || []);
        setSpecificTransactionsModal({ 
          businessName, 
          newCategory, 
          transactions: data.transactions || [] 
        });
      } else {
        console.error('Error fetching transactions:', response.statusText);
        alert('שגיאה בטעינת הרשומות');
      }
    } catch (error) {
      console.error('Error fetching transactions:', error);
      alert('שגיאה בטעינת הרשומות');
    } finally {
      setLoadingSpecificTransactions(false);
    }
  };

  // עדכון רשומות ספציפיות שנבחרו
  const handleUpdateSelectedTransactions = async () => {
    if (selectedTransactionIds.size === 0) {
      alert('אנא בחר לפחות רשומה אחת לעדכון');
      return;
    }

    const confirmed = window.confirm(
      `האם אתה בטוח שברצונך לעדכן ${selectedTransactionIds.size} רשומות לקטגוריה "${specificTransactionsModal.newCategory}"?`
    );

    if (!confirmed) return;

    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/transactions/businesses/update-categories', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          category_updates: [{
            business_name: specificTransactionsModal.businessName,
            new_category: specificTransactionsModal.newCategory,
            exclude_transaction_ids: specificTransactions
              .filter(t => !selectedTransactionIds.has(t.id))
              .map(t => t.id)
          }]
        })
      });

      if (response.ok) {
        await response.json();
        alert(`עודכנו בהצלחה ${selectedTransactionIds.size} רשומות`);
        
        // סגירת הmodal ורענון נתונים
        setSpecificTransactionsModal(null);
        setSelectedTransactionIds(new Set());
        fetchVariableExpenseBusinesses();
      } else {
        console.error('Error updating specific transactions:', response.statusText);
        alert('שגיאה בעדכון הרשומות');
      }
    } catch (error) {
      console.error('Error updating specific transactions:', error);
      alert('שגיאה בעדכון הרשומות');
    }
  };

  const handleTransactionSelect = (transactionId, selected) => {
    const newSelected = new Set(selectedTransactionIds);
    if (selected) {
      newSelected.add(transactionId);
    } else {
      newSelected.delete(transactionId);
    }
    setSelectedTransactionIds(newSelected);
  };

  const handleSelectAllTransactions = () => {
    if (selectedTransactionIds.size === specificTransactions.length) {
      setSelectedTransactionIds(new Set());
    } else {
      setSelectedTransactionIds(new Set(specificTransactions.map(t => t.id)));
    }
  };

  const closeSpecificTransactionsModal = () => {
    setSpecificTransactionsModal(null);
    setSelectedTransactionIds(new Set());
    setSpecificTransactions([]);
  };

  // שמירת מידע העסק ב-MongoDB
  const handleSaveBusinessIntelligence = async (suggestion) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/transactions/businesses/update-intelligence', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          business_name: suggestion.business_name,
          update_data: {
            perplexity_analysis: {
              category: suggestion.suggested_category,
              confidence: suggestion.confidence,
              reasoning: suggestion.reasoning,
              business_info: suggestion.business_info || {},
              debug_info: suggestion.debug_info || null,
              editable_category: suggestion.editable_category
            },
            last_updated: new Date().toISOString()
          }
        })
      });

      if (response.ok) {        await response.json();        alert(`מידע העסק "${suggestion.business_name}" נשמר בהצלחה ב-MongoDB`);
      } else {
        console.error('Error saving business intelligence:', response.statusText);
        alert('שגיאה בשמירת המידע');
      }
    } catch (error) {
      console.error('Error saving business intelligence:', error);
      alert('שגיאה בשמירת המידע');
    }
  };

  const showTransactions = async (businessName) => {
    setLoadingTransactions(true);
    setTransactionModal({ businessName, transactions: [] });

    try {
      const token = localStorage.getItem('token');
      const encodedBusinessName = encodeURIComponent(businessName);
      
      const response = await fetch(
        `/api/transactions/businesses/${encodedBusinessName}/transactions?category_name=הוצאות משתנות`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );

      if (response.ok) {
        const data = await response.json();
        setBusinessTransactions(data.transactions || []);
        setTransactionModal({ businessName, transactions: data.transactions || [] });
      } else {
        console.error('Error fetching transactions:', response.statusText);
      }
    } catch (error) {
      console.error('Error fetching transactions:', error);
    } finally {
      setLoadingTransactions(false);
    }
  };

  const closeModal = () => {
    setTransactionModal(null);
    setBusinessTransactions([]);
  };

  if (loading) {
    return (
      <div className="business-category-intelligence">
        <div className="loading">טוען נתונים...</div>
      </div>
    );
  }

  return (
    <div className="business-category-intelligence">
      <div className="page-header">
        <h1>אינטליגנציה לקטגוריות בתי עסק</h1>
        <p>ניהול חכם של קטגוריות בתי עסק עם Perplexity AI</p>
      </div>

      {!showSuggestions ? (
        <div className="businesses-section">
          <div className="section-header">
            <h2>בתי עסק עם קטגוריית "הוצאות משתנות"</h2>
            <div className="header-actions">
              <div className="debug-options">
                <label className="debug-checkbox">
                  <input
                    type="checkbox"
                    checked={debugMode}
                    onChange={(e) => setDebugMode(e.target.checked)}
                  />
                  <span>מצב Debug (מידע מפורט)</span>
                </label>
              </div>
              <button 
                className="select-all-gpt-btn"
                onClick={handleSelectAllForGPT}
                disabled={businesses.length === 0}
              >
                {selectedForGPT.size === businesses.length ? 'בטל בחירת הכל' : 'בחר הכל'}
              </button>
              <button 
                className="analyze-btn"
                onClick={handleAnalyzeWithGPT}
                disabled={loadingSuggestions || selectedForGPT.size === 0}
              >
                {loadingSuggestions ? 'מנתח...' : `ניתוח עם Perplexity (${selectedForGPT.size})`}
              </button>
            </div>
          </div>

          {businesses.length === 0 ? (
            <div className="no-data">
              <p>לא נמצאו בתי עסק עם קטגוריית "הוצאות משתנות"</p>
            </div>
          ) : (
            <div className="businesses-table-container">
              <table className="businesses-table">
                <thead>
                  <tr>
                    <th>בחר</th>
                    <th>שם בית העסק</th>
                    <th>קטגוריה נוכחית</th>
                    <th>מספר עסקאות</th>
                    <th>סכום כולל</th>
                    <th>עסקה אחרונה</th>
                    <th>פעולות</th>
                  </tr>
                </thead>
                <tbody>
                  {businesses.map((business, index) => (
                    <tr key={index}>
                      <td className="checkbox-cell">
                        <input 
                          type="checkbox"
                          checked={selectedForGPT.has(business.business_name)}
                          onChange={(e) => handleGPTSelect(business.business_name, e.target.checked)}
                        />
                      </td>
                      <td className="business-name">{business.business_name}</td>
                      <td className="current-category">{business.current_category}</td>
                      <td className="transaction-count">{business.transaction_count}</td>
                      <td className="total-amount">
                        {Math.round(business.total_amount).toLocaleString()} {business.currency}
                      </td>
                      <td className="latest-date">
                        {new Date(business.latest_transaction_date).toLocaleDateString('he-IL')}
                      </td>
                      <td className="actions">
                        <button 
                          className="view-transactions-btn"
                          onClick={() => showTransactions(business.business_name)}
                        >
                          צפה בעסקאות ({business.transaction_count})
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        <div className="suggestions-section">
          <div className="section-header">
            <h2>הצעות קטגוריות מ-Perplexity</h2>
            <div className="suggestions-actions">
              <button 
                className="select-all-btn"
                onClick={handleSelectAll}
              >
                {selectedBusinesses.size === suggestions.length ? 'בטל בחירת הכל' : 'בחר הכל'}
              </button>
              <button 
                className="back-btn"
                onClick={() => setShowSuggestions(false)}
              >
                חזור לטבלה
              </button>
            </div>
          </div>

          <div className="suggestions-cards-container">
            {editableSuggestions.map((suggestion, index) => {
              const business = businesses.find(b => b.business_name === suggestion.business_name);
              return (
                <div key={index} className="suggestion-card">
                  <div className="card-header">
                    <div className="card-checkbox">
                      <input 
                        type="checkbox"
                        checked={selectedBusinesses.has(suggestion.business_name)}
                        onChange={(e) => handleBusinessSelect(suggestion.business_name, e.target.checked)}
                      />
                    </div>
                    <div className="card-title">
                      <h3>{suggestion.business_name}</h3>
                      <div className="card-badges">
                        <span className="suggested-category-badge">{suggestion.suggested_category}</span>
                        <span className={`confidence-badge confidence-${Math.floor(suggestion.confidence * 10)}`}>
                          {Math.round(suggestion.confidence * 100)}%
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="card-content">
                    <div className="card-section">
                      <strong>קטגוריה מוצעת:</strong>
                      <div className="category-selection">
                        <select 
                          className="category-select"
                          value={suggestion.editable_category || ''}
                          onChange={(e) => handleCategoryChange(suggestion.business_name, e.target.value)}
                          disabled={loadingCategories}
                        >
                          <option value="">בחר קטגוריה...</option>
                          {availableCategories.map((category, index) => (
                            <option key={index} value={category}>
                              {category}
                            </option>
                          ))}
                          <option value="__OTHER__">אחר (קטגוריה חדשה)...</option>
                        </select>
                        
                        {suggestion.editable_category === '__OTHER__' && (
                          <input 
                            type="text"
                            className="category-input-other"
                            placeholder="הכנס שם קטגוריה חדשה"
                            onChange={(e) => handleCategoryChange(suggestion.business_name, e.target.value)}
                          />
                        )}
                      </div>
                    </div>
                    
                    <div className="card-section">
                      <strong>הסבר הקטגוריה:</strong>
                      <p>{suggestion.reasoning}</p>
                    </div>
                    
                    {suggestion.business_info && (
                      <div className="card-section business-info-section">
                        <strong>מידע על העסק:</strong>
                        <div className="business-info-grid">
                          {suggestion.business_info.name && (
                            <div className="info-item">
                              <span className="info-label">שם מלא:</span>
                              <span className="info-value">{suggestion.business_info.name}</span>
                            </div>
                          )}
                          {suggestion.business_info.type && (
                            <div className="info-item">
                              <span className="info-label">סוג העסק:</span>
                              <span className="info-value">{suggestion.business_info.type}</span>
                            </div>
                          )}
                          {suggestion.business_info.location && (
                            <div className="info-item">
                              <span className="info-label">מיקום:</span>
                              <span className="info-value">{suggestion.business_info.location}</span>
                            </div>
                          )}
                          {suggestion.business_info.country && (
                            <div className="info-item">
                              <span className="info-label">מדינה:</span>
                              <span className="info-value">{suggestion.business_info.country}</span>
                            </div>
                          )}
                          {suggestion.business_info.address && (
                            <div className="info-item">
                              <span className="info-label">כתובת:</span>
                              <span className="info-value">{suggestion.business_info.address}</span>
                            </div>
                          )}
                          {suggestion.business_info.phone && (
                            <div className="info-item">
                              <span className="info-label">טלפון:</span>
                              <span className="info-value">{suggestion.business_info.phone}</span>
                            </div>
                          )}
                          {suggestion.business_info.email && (
                            <div className="info-item">
                              <span className="info-label">אימייל:</span>
                              <span className="info-value">
                                <a href={`mailto:${suggestion.business_info.email}`}>
                                  {suggestion.business_info.email}
                                </a>
                              </span>
                            </div>
                          )}
                          {suggestion.business_info.website && (
                            <div className="info-item">
                              <span className="info-label">אתר:</span>
                              <span className="info-value">
                                <a href={suggestion.business_info.website} target="_blank" rel="noopener noreferrer">
                                  {suggestion.business_info.website}
                                </a>
                              </span>
                            </div>
                          )}
                          {suggestion.business_info.opening_hours && (
                            <div className="info-item">
                              <span className="info-label">שעות פעילות:</span>
                              <span className="info-value">{suggestion.business_info.opening_hours}</span>
                            </div>
                          )}
                          {suggestion.business_info.branch_info && (
                            <div className="info-item">
                              <span className="info-label">מידע רשת:</span>
                              <span className="info-value">{suggestion.business_info.branch_info}</span>
                            </div>
                          )}
                          {suggestion.business_info.social_links && suggestion.business_info.social_links.length > 0 && (
                            <div className="info-item">
                              <span className="info-label">רשתות חברתיות:</span>
                              <div className="social-links">
                                {suggestion.business_info.social_links.map((link, linkIndex) => (
                                  <a key={linkIndex} href={link} target="_blank" rel="noopener noreferrer" className="social-link">
                                    {link}
                                  </a>
                                ))}
                              </div>
                            </div>
                          )}
                          {suggestion.business_info.services && (
                            <div className="info-item">
                              <span className="info-label">שירותים:</span>
                              <span className="info-value">{suggestion.business_info.services}</span>
                            </div>
                          )}
                          {suggestion.business_info.payment_methods && (
                            <div className="info-item">
                              <span className="info-label">אמצעי תשלום:</span>
                              <span className="info-value">{suggestion.business_info.payment_methods}</span>
                            </div>
                          )}
                          {suggestion.business_info.parking && (
                            <div className="info-item">
                              <span className="info-label">חניה:</span>
                              <span className="info-value">{suggestion.business_info.parking}</span>
                            </div>
                          )}
                          {suggestion.business_info.accessibility && (
                            <div className="info-item">
                              <span className="info-label">נגישות:</span>
                              <span className="info-value">{suggestion.business_info.accessibility}</span>
                            </div>
                          )}
                          {suggestion.business_info.rating && (
                            <div className="info-item">
                              <span className="info-label">דירוג:</span>
                              <span className="info-value">{suggestion.business_info.rating}</span>
                            </div>
                          )}
                          {suggestion.business_info.year_established && (
                            <div className="info-item">
                              <span className="info-label">שנת הקמה:</span>
                              <span className="info-value">{suggestion.business_info.year_established}</span>
                            </div>
                          )}
                          {suggestion.business_info.employee_count && (
                            <div className="info-item">
                              <span className="info-label">מספר עובדים:</span>
                              <span className="info-value">{suggestion.business_info.employee_count}</span>
                            </div>
                          )}
                          {suggestion.business_info.business_id && (
                            <div className="info-item">
                              <span className="info-label">ח.פ.:</span>
                              <span className="info-value">{suggestion.business_info.business_id}</span>
                            </div>
                          )}
                          {suggestion.business_info.description && (
                            <div className="info-item full-width">
                              <span className="info-label">תיאור:</span>
                              <span className="info-value">{suggestion.business_info.description}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                    
                    {debugMode && suggestion.debug_info && (
                      <div className="card-section debug-section">
                        <details className="debug-details">
                          <summary>מידע Debug - JSON Response מלא</summary>
                          <pre>{JSON.stringify(suggestion.debug_info, null, 2)}</pre>
                        </details>
                      </div>
                    )}
                  </div>
                  
                  <div className="card-footer">
                    <div className="transaction-info">
                      <span>עסקאות: {business ? business.transaction_count : 0}</span>
                    </div>
                    <div className="card-actions">
                      <button 
                        className="view-transactions-btn"
                        onClick={() => showTransactions(suggestion.business_name)}
                      >
                        צפה בעסקאות ({business ? business.transaction_count : 0})
                      </button>
                      <button 
                        className="update-all-btn"
                        onClick={() => handleUpdateAllBusiness(suggestion.business_name, suggestion.editable_category)}
                        disabled={!suggestion.editable_category || suggestion.editable_category === '__OTHER__'}
                        title="עדכן את כל הרשומות של העסק הזה"
                      >
                        עדכן כל העסק
                      </button>
                      <button 
                        className="update-specific-btn"
                        onClick={() => handleUpdateSpecificTransactions(suggestion.business_name, suggestion.editable_category)}
                        disabled={!suggestion.editable_category || suggestion.editable_category === '__OTHER__'}
                        title="בחר רשומות ספציפיות לעדכון"
                      >
                        עדכן ספציפי
                      </button>
                      <button 
                        className="save-business-btn"
                        onClick={() => handleSaveBusinessIntelligence(suggestion)}
                        title="שמור את כל המידע על העסק ב-MongoDB Atlas"
                      >
                        💾 MongoDB
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Transaction Modal */}
      {transactionModal && (
        <div className="bci-modal-overlay modal-overlay" onClick={closeModal}>
          <div className="bci-transaction-modal modal" dir="rtl" onClick={(e) => e.stopPropagation()}>
            <div className="bci-modal-header">
              <h3>עסקאות של {transactionModal.businessName}</h3>
              <button className="bci-close-btn" onClick={closeModal}>×</button>
            </div>
            
            <div className="bci-modal-content">
              {loadingTransactions ? (
                <div className="bci-loading">טוען עסקאות...</div>
              ) : businessTransactions.length === 0 ? (
                <div className="bci-no-transactions">לא נמצאו עסקאות</div>
              ) : (
                <div className="bci-transactions-list">
                  <table className="bci-transactions-table">
                    <thead>
                      <tr>
                        <th>תאריך</th>
                        <th>סכום</th>
                        <th>אמצעי תשלום</th>
                        <th>הערות</th>
                      </tr>
                    </thead>
                    <tbody>
                      {businessTransactions.map((transaction, index) => (
                        <tr key={transaction.id || index}>
                          <td>{new Date(transaction.payment_date).toLocaleDateString('he-IL')}</td>
                          <td className={`bci-amount ${parseFloat(transaction.amount) < 0 ? 'negative' : 'positive'}`}>
                            {Math.abs(parseFloat(transaction.amount)).toLocaleString()} {transaction.currency}
                          </td>
                          <td>{transaction.payment_method}</td>
                          <td>{transaction.notes || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Specific Transactions Selection Modal (using Common/Modal wrapper) */}
      {specificTransactionsModal && (
        <Modal
          isOpen={true}
          onClose={closeSpecificTransactionsModal}
          className="specific-transactions-modal"
          size="large"
        >
          <div className="modal-header">
            <h3>בחר רשומות לעדכון - {specificTransactionsModal.businessName}</h3>
            <div className="modal-header-info">
              <span>קטגוריה חדשה: <strong>{specificTransactionsModal.newCategory}</strong></span>
            </div>
            <button className="close-btn" onClick={closeSpecificTransactionsModal}>×</button>
          </div>
          <div className="modal-content">
            {loadingSpecificTransactions ? (
              <div className="loading">טוען רשומות...</div>
            ) : specificTransactions.length === 0 ? (
              <div className="no-transactions">לא נמצאו רשומות</div>
            ) : (
              <>
                <div className="modal-actions">
                  <button 
                    className="select-all-transactions-btn"
                    onClick={handleSelectAllTransactions}
                  >
                    {selectedTransactionIds.size === specificTransactions.length ? 'בטל בחירת הכל' : 'בחר הכל'}
                  </button>
                  <div className="selected-count">
                    נבחרו: {selectedTransactionIds.size} מתוך {specificTransactions.length}
                  </div>
                </div>
                <div className="transactions-list">
                  <table className="transactions-table">
                    <thead>
                      <tr>
                        <th>בחר</th>
                        <th>תאריך</th>
                        <th>סכום</th>
                        <th>אמצעי תשלום</th>
                        <th>הערות</th>
                      </tr>
                    </thead>
                    <tbody>
                      {specificTransactions.map((transaction, index) => (
                        <tr key={transaction.id || index}>
                          <td className="checkbox-cell">
                            <input 
                              type="checkbox"
                              checked={selectedTransactionIds.has(transaction.id)}
                              onChange={(e) => handleTransactionSelect(transaction.id, e.target.checked)}
                            />
                          </td>
                          <td>{new Date(transaction.payment_date).toLocaleDateString('he-IL')}</td>
                          <td className={`amount ${parseFloat(transaction.amount) < 0 ? 'negative' : 'positive'}`}>
                            {Math.abs(parseFloat(transaction.amount)).toLocaleString()} {transaction.currency}
                          </td>
                          <td>{transaction.payment_method}</td>
                          <td>{transaction.notes || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="modal-footer">
                  <button 
                    className="cancel-btn"
                    onClick={closeSpecificTransactionsModal}
                  >
                    ביטול
                  </button>
                  <button 
                    className="update-selected-btn"
                    onClick={handleUpdateSelectedTransactions}
                    disabled={selectedTransactionIds.size === 0}
                  >
                    עדכן {selectedTransactionIds.size} רשומות נבחרות
                  </button>
                </div>
              </>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
};

export default BusinessCategoryIntelligence;
