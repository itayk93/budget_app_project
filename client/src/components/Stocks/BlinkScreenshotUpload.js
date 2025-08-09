import React, { useState } from 'react';
import Modal from '../Common/Modal';
import './BlinkScreenshotUpload.css';

const BlinkScreenshotUpload = ({ cashFlowId, onTransactionsImported }) => {
    const [isUploading, setIsUploading] = useState(false);
    const [dragActive, setDragActive] = useState(false);
    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const [extractedTransactions, setExtractedTransactions] = useState([]);
    const [duplicateTransactions, setDuplicateTransactions] = useState([]);
    const [error, setError] = useState(null);

    const handleImageUpload = async (file) => {
        if (!file) return;

        // Validate file type
        const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg'];
        if (!allowedTypes.includes(file.type)) {
            setError('רק קבצי תמונה מותרים (PNG, JPG)');
            return;
        }

        if (!cashFlowId) {
            setError('נא לבחור חשבון השקעות');
            return;
        }

        setIsUploading(true);
        setError(null);

        try {
            const formData = new FormData();
            formData.append('image', file);
            formData.append('cash_flow_id', cashFlowId);

            const response = await fetch('/api/stocks/process-blink-screenshot', {
                method: 'POST',
                body: formData,
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'שגיאה בעיבוד התמונה');
            }

            if (data.success && data.transactions) {
                setExtractedTransactions(data.transactions);
                setDuplicateTransactions(data.duplicates || []);
                setShowConfirmModal(true);
            } else {
                setError('לא נמצאו עסקאות בתמונה');
            }

        } catch (error) {
            console.error('Screenshot upload error:', error);
            setError(error.message || 'שגיאה בהעלאת התמונה');
        } finally {
            setIsUploading(false);
        }
    };

    const handleConfirmTransactions = async () => {
        try {
            const response = await fetch('/api/stocks/import-blink-transactions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({
                    transactions: extractedTransactions,
                    cash_flow_id: cashFlowId
                })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'שגיאה בשמירת העסקאות');
            }

            setShowConfirmModal(false);
            setExtractedTransactions([]);
            setDuplicateTransactions([]);
            
            if (onTransactionsImported) {
                onTransactionsImported(data);
            }

            alert(`בוצע בהצלחה! נשמרו ${data.imported} עסקאות`);

        } catch (error) {
            console.error('Import error:', error);
            setError(error.message || 'שגיאה בשמירת העסקאות');
        }
    };

    const handleEditTransaction = (index, field, value) => {
        const updated = [...extractedTransactions];
        updated[index] = { ...updated[index], [field]: value };
        setExtractedTransactions(updated);
    };

    const handleAddTransaction = () => {
        const newTransaction = {
            symbol: '',
            date: new Date().toISOString().split('T')[0],
            type: 'Buy',
            quantity: null,
            price: null,
            amount: 0
        };
        setExtractedTransactions([...extractedTransactions, newTransaction]);
    };

    const handleRemoveTransaction = (index) => {
        const updated = extractedTransactions.filter((_, i) => i !== index);
        setExtractedTransactions(updated);
    };

    const handleDrop = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);

        const files = e.dataTransfer.files;
        if (files && files.length > 0) {
            handleImageUpload(files[0]);
        }
    };

    const handleDragOver = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(true);
    };

    const handleDragLeave = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);
    };

    const handleFileInputChange = (e) => {
        const files = e.target.files;
        if (files && files.length > 0) {
            handleImageUpload(files[0]);
        }
    };

    const formatCurrency = (amount) => {
        // Handle null, undefined, or invalid amounts
        if (amount === null || amount === undefined || isNaN(amount)) {
            amount = 0;
        }
        
        // Ensure amount is a number
        const numericAmount = Number(amount);
        
        // Force LTR direction for currency to ensure minus sign appears on the left
        const formatted = Math.abs(numericAmount).toLocaleString('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        });
        
        // Manually add minus sign on the left for negative values
        return numericAmount < 0 ? `-${formatted}` : formatted;
    };

    const formatDate = (dateStr) => {
        return new Date(dateStr).toLocaleDateString('he-IL');
    };

    return (
        <>
            <div className="blink-upload-container">
                <div className="blink-upload-header">
                    <h5 className="blink-upload-title">
                        העלאת צילום מסך Blink
                    </h5>
                    <p className="blink-upload-subtitle">
                        העלה צילום מסך של עסקאות מאפליקציית Blink
                    </p>
                </div>

                {error && (
                    <div className="blink-error-alert">
                        ⚠️ {error}
                    </div>
                )}

                {!cashFlowId && (
                    <div className="blink-warning-alert">
                        ⚠️ נא לבחור חשבון השקעות לפני העלאת התמונה
                    </div>
                )}

                <div
                    className={`blink-drop-zone ${dragActive ? 'active' : ''} ${!cashFlowId || isUploading ? 'disabled' : ''}`}
                    onDrop={handleDrop}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onClick={() => !cashFlowId || isUploading ? null : document.getElementById('imageInput').click()}
                >
                    {isUploading ? (
                        <div className="blink-upload-loading">
                            <div className="blink-spinner"></div>
                            <p className="blink-upload-text">מעבד תמונה...</p>
                        </div>
                    ) : (
                        <div className="blink-upload-idle">
                            <div className="blink-upload-icon">📱</div>
                            <h6 className="blink-upload-main-text">
                                גרור צילום מסך לכאן או לחץ לבחירה
                            </h6>
                            <p className="blink-upload-sub-text">
                                קבצי PNG או JPG בלבד
                            </p>
                        </div>
                    )}

                    <input
                        type="file"
                        id="imageInput"
                        className="blink-file-input"
                        accept="image/png,image/jpeg,image/jpg"
                        onChange={handleFileInputChange}
                        disabled={!cashFlowId || isUploading}
                    />
                </div>

                <div className="blink-instructions">
                    <h6 className="blink-instructions-title">
                        הוראות שימוש:
                    </h6>
                    <ul className="blink-instructions-list">
                        <li>צלם מסך של רשימת העסקאות באפליקציית Blink</li>
                        <li>וודא שהתמונה ברורה וכוללת את כל הפרטים הרלוונטיים</li>
                        <li>המערכת תזהה את העסקאות ותציג לך לאישור</li>
                        <li>תוכל לערוך ולתקן את הנתונים לפני השמירה</li>
                    </ul>
                </div>
            </div>

            {/* Confirmation Modal */}
            <Modal
                isOpen={showConfirmModal}
                onClose={() => {
                    setShowConfirmModal(false);
                    setExtractedTransactions([]);
                    setDuplicateTransactions([]);
                }}
                title="אישור עסקאות שזוהו"
                className="blink-modal"
                size="large"
            >
                <div className="blink-modal-content">
                    {extractedTransactions.length > 0 ? (
                        <>
                            <p className="blink-transactions-info">
                                זוהו {extractedTransactions.length} עסקאות. אנא בדוק ואשר את הנתונים:
                            </p>
                            
                            {/* Duplicate warnings */}
                            {duplicateTransactions.length > 0 && (
                                <div className="blink-duplicate-warning">
                                    <h4 className="blink-duplicate-title">
                                        ⚠️ זוהו {duplicateTransactions.length} עסקאות חשודות כבר קיימות במערכת
                                    </h4>
                                    <p className="blink-duplicate-text">
                                        בדוק את העסקאות המסומנות באדום - הן דומות לעסקאות שכבר קיימות במערכת
                                    </p>
                                </div>
                            )}
                            
                            {/* Mobile-responsive transaction cards */}
                            <div className="blink-transactions-container">
                                {extractedTransactions.map((transaction, index) => {
                                    // Check if this transaction is a duplicate
                                    const isDuplicate = duplicateTransactions.some(dup => 
                                        dup.newTransaction.symbol === transaction.symbol &&
                                        dup.newTransaction.date === transaction.date &&
                                        dup.newTransaction.amount === transaction.amount
                                    );
                                    
                                    return (
                                        <div
                                            key={index}
                                            className={`blink-transaction-card ${isDuplicate ? 'duplicate' : ''}`}
                                        >
                                            {isDuplicate && (
                                                <div className="blink-duplicate-badge">
                                                    כפילות
                                                </div>
                                            )}
                                            {/* First Row - Symbol and Date */}
                                            <div className="blink-form-row">
                                                <div className="blink-form-group">
                                                    <label className="blink-form-label">
                                                        {transaction.type === 'Deposit' ? 'תיאור הפקדה:' : 
                                                         transaction.type === 'Dividend' ? 'סמל מניה (דיבידנד):' : 
                                                         'סמל מניה:'}
                                                    </label>
                                                    <input
                                                        type="text"
                                                        value={transaction.symbol || ''}
                                                        onChange={(e) => handleEditTransaction(index, 'symbol', e.target.value)}
                                                        placeholder={transaction.type === 'Deposit' ? 'הפקדה' : transaction.type === 'Dividend' ? 'AAPL' : 'TSLA'}
                                                        className="blink-form-input"
                                                    />
                                                </div>
                                                
                                                <div className="blink-form-group">
                                                    <label className="blink-form-label">
                                                        תאריך:
                                                    </label>
                                                    <input
                                                        type="date"
                                                        value={transaction.date || ''}
                                                        onChange={(e) => handleEditTransaction(index, 'date', e.target.value)}
                                                        className="blink-form-input"
                                                    />
                                                </div>
                                            </div>

                                            {/* Second Row - Type and Amount */}
                                            <div className="blink-form-row">
                                                <div className="blink-form-group">
                                                    <label className="blink-form-label">
                                                        סוג פעילות:
                                                    </label>
                                                    <select
                                                        value={transaction.type || 'Buy'}
                                                        onChange={(e) => handleEditTransaction(index, 'type', e.target.value)}
                                                        className="blink-form-select"
                                                    >
                                                        <option value="Buy">קנייה</option>
                                                        <option value="Sell">מכירה</option>
                                                        <option value="Deposit">הפקדה</option>
                                                        <option value="Dividend">דיבידנד</option>
                                                    </select>
                                                </div>
                                                
                                                <div className="blink-form-group">
                                                    <label className="blink-form-label">
                                                        סכום כולל ($):
                                                    </label>
                                                    <input
                                                        type="number"
                                                        step="0.01"
                                                        value={transaction.amount || ''}
                                                        onChange={(e) => handleEditTransaction(index, 'amount', parseFloat(e.target.value) || 0)}
                                                        className="blink-form-input"
                                                    />
                                                </div>
                                            </div>

                                            {/* Third Row - Quantity and Price (only for stock transactions) */}
                                            {(transaction.type === 'Buy' || transaction.type === 'Sell') && (
                                                <div className="blink-stock-details">
                                                    <div className="blink-form-row">
                                                        <div className="blink-form-group">
                                                            <label className="blink-form-label">
                                                                כמות מניות:
                                                            </label>
                                                            <input
                                                                type="number"
                                                                step="0.0001"
                                                                value={transaction.quantity || ''}
                                                                onChange={(e) => handleEditTransaction(index, 'quantity', parseFloat(e.target.value) || 0)}
                                                                placeholder="0.5000"
                                                                className="blink-form-input"
                                                            />
                                                        </div>
                                                        
                                                        <div className="blink-form-group">
                                                            <label className="blink-form-label">
                                                                מחיר למניה ($):
                                                            </label>
                                                            <input
                                                                type="number"
                                                                step="0.01"
                                                                value={transaction.price || ''}
                                                                onChange={(e) => handleEditTransaction(index, 'price', parseFloat(e.target.value) || 0)}
                                                                placeholder="150.00"
                                                                className="blink-form-input"
                                                            />
                                                        </div>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Remove transaction button and duplicate info */}
                                            <div className="blink-transaction-actions">
                                                <button
                                                    type="button"
                                                    onClick={() => handleRemoveTransaction(index)}
                                                    className={`blink-remove-btn ${isDuplicate ? 'duplicate' : 'normal'}`}
                                                >
                                                    🗑️ {isDuplicate ? 'הסר כפילות' : 'הסר עסקה'}
                                                </button>
                                                
                                                {isDuplicate && (
                                                    <div className="blink-duplicate-info">
                                                        ⚠️ עסקה זהה כבר קיימת במערכת
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                )})}
                            </div>

                            {/* Add new transaction button */}
                            <div className="blink-add-section">
                                <button
                                    type="button"
                                    onClick={handleAddTransaction}
                                    className="blink-add-btn"
                                >
                                    ➕ הוסף עסקה חדשה
                                </button>
                            </div>
                        </>
                    ) : (
                        <div className="blink-empty-state">
                            <p className="blink-empty-text">
                                לא נמצאו עסקאות בתמונה
                            </p>
                            <button
                                type="button"
                                onClick={handleAddTransaction}
                                className="blink-add-btn primary"
                            >
                                ➕ הוסף עסקה ידנית
                            </button>
                        </div>
                    )}
                </div>
                
                <div className="blink-modal-footer">
                    <button
                        onClick={() => {
                            setShowConfirmModal(false);
                            setExtractedTransactions([]);
                            setDuplicateTransactions([]);
                        }}
                        className="blink-footer-btn secondary"
                    >
                        ביטול
                    </button>
                    <button
                        onClick={handleConfirmTransactions}
                        disabled={extractedTransactions.length === 0}
                        className="blink-footer-btn primary"
                    >
                        אשר ושמור ({extractedTransactions.length})
                    </button>
                </div>
            </Modal>
        </>
    );
};

export default BlinkScreenshotUpload;