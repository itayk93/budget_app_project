import React, { useState, useRef, useEffect } from 'react';
import LoadingSpinner from '../../components/Common/LoadingSpinner';
import './Upload.css';

const FileMerger = () => {
  const [files, setFiles] = useState([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState(null);
  
  // הגדרות משותפות לכל הקבצים
  const [sharedSettings, setSharedSettings] = useState({
    source: 'other',
    paymentMethod: '',
    paymentIdentifier: ''
  });

  // Dropdown data
  const [sourceTypes, setSourceTypes] = useState([]);
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [loadingDropdowns, setLoadingDropdowns] = useState(false);

  const fileInputRef = useRef(null);

  const handleFileSelect = (newFiles) => {
    const validFiles = Array.from(newFiles).filter(file => 
      file.type.includes('excel') || file.type.includes('sheet') || file.name.endsWith('.csv')
    );
    
    if (validFiles.length !== newFiles.length) {
      alert('חלק מהקבצים אינם חוקיים. רק קבצי Excel ו-CSV מותרים.');
    }
    
    const filesWithSettings = validFiles.map((file, index) => ({
      id: Date.now() + index,
      file,
      name: file.name,
      size: file.size
    }));
    
    setFiles(prev => [...prev, ...filesWithSettings]);
  };

  const handleFileChange = (e) => {
    if (e.target.files.length > 0) {
      handleFileSelect(e.target.files);
      e.target.value = ''; // Reset input
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    
    if (e.dataTransfer.files.length > 0) {
      handleFileSelect(e.dataTransfer.files);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const updateSharedSettings = (field, value) => {
    setSharedSettings(prev => ({ ...prev, [field]: value }));
  };

  const removeFile = (fileId) => {
    setFiles(prev => prev.filter(file => file.id !== fileId));
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const processFiles = async () => {
    if (files.length === 0) {
      alert('אנא העלה לפחות קובץ אחד');
      return;
    }

    setProcessing(true);
    setResult(null);

    try {
      // Process each file according to shared settings
      const processedFiles = [];
      
      for (let i = 0; i < files.length; i++) {
        const fileData = files[i];
        console.log(`Processing file ${i + 1}/${files.length}: ${fileData.name}`);
        const formData = new FormData();
        formData.append('file', fileData.file);
        formData.append('file_source', sharedSettings.source);
        formData.append('payment_method', sharedSettings.paymentMethod);
        formData.append('payment_identifier', sharedSettings.paymentIdentifier);

        // Call our processing endpoint
        const response = await fetch('/api/upload/process-for-export', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          },
          body: formData
        });

        if (!response.ok) {
          throw new Error(`שגיאה בעיבוד הקובץ ${fileData.name}`);
        }

        const result = await response.json();
        processedFiles.push({
          filename: fileData.name,
          transactions: result.transactions,
          stats: result.stats
        });
      }

      // Create merged Excel file via API
      const mergedResponse = await fetch('/api/upload/create-merged-excel', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          processedFiles: processedFiles,
          filename: `ישראכרט-${new Date().toISOString().split('T')[0]}`
        })
      });

      if (!mergedResponse.ok) {
        throw new Error('שגיאה ביצירת הקובץ המאוחד');
      }

      // Download the file
      const blob = await mergedResponse.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ישראכרט-${new Date().toISOString().split('T')[0]}.zip`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      setResult({
        success: true,
        totalFiles: files.length,
        totalTransactions: processedFiles.reduce((sum, file) => sum + file.transactions.length, 0),
        processedFiles
      });

    } catch (error) {
      console.error('Error processing files:', error);
      setResult({
        success: false,
        error: error.message
      });
    } finally {
      setProcessing(false);
    }
  };

  // Fetch dropdown data
  const fetchDropdownData = async () => {
    setLoadingDropdowns(true);
    try {
      const [sourceTypesRes, paymentMethodsRes] = await Promise.all([
        fetch('/api/upload/distinct-source-types', {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        }),
        fetch('/api/upload/distinct-payment-methods', {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        })
      ]);

      if (sourceTypesRes.ok) {
        const sourceTypesData = await sourceTypesRes.json();
        setSourceTypes(sourceTypesData.sourceTypes || []);
      }

      if (paymentMethodsRes.ok) {
        const paymentMethodsData = await paymentMethodsRes.json();
        setPaymentMethods(paymentMethodsData.paymentMethods || []);
      }
    } catch (error) {
      console.error('Error fetching dropdown data:', error);
    } finally {
      setLoadingDropdowns(false);
    }
  };

  // Load dropdown data on component mount
  useEffect(() => {
    fetchDropdownData();
  }, []);

  return (
    <div className="upload-page">
      <div className="page-header">
        <div className="page-title">
          <h1>מיזוג קבצים</h1>
          <p className="text-muted">העלה מספר קבצים עם הגדרות משותפות וייצא לפורמט BudgetLens</p>
        </div>
      </div>

      <div className="upload-content">
        <div className="upload-section">
          <div className="card">
            <div className="card-header">
              <h3>העלאת קבצים</h3>
            </div>
            <div className="card-body">
              {/* File Drop Zone */}
              <div
                className={`file-drop-zone ${isDragOver ? 'drag-over' : ''}`}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
              >
                <div className="drop-zone-content">
                  <div className="drop-zone-icon">📁</div>
                  <div className="drop-zone-text">
                    <p>גרור קבצים לכאן או <button 
                      className="link-button" 
                      onClick={() => fileInputRef.current?.click()}
                    >בחר קבצים</button></p>
                    <p className="text-muted">ניתן להעלות מספר קבצי Excel (.xlsx, .xls) או CSV</p>
                  </div>
                </div>
                
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleFileChange}
                  style={{ display: 'none' }}
                  multiple
                />
              </div>

              {/* Shared Settings */}
              {files.length > 0 && (
                <div className="shared-settings">
                  <h4>הגדרות משותפות לכל הקבצים</h4>
                  <div className="settings-grid">
                    {/* File Source */}
                    <div className="form-group">
                      <label className="form-label">מקור הקבצים</label>
                      <select
                        className="form-select"
                        value={sharedSettings.source}
                        onChange={(e) => updateSharedSettings('source', e.target.value)}
                      >
                        <option value="other">כללי</option>
                        <option value="isracard">ישראכרט</option>
                        <option value="leumi">בנק לאומי</option>
                        <option value="hapoalim">בנק הפועלים</option>
                        <option value="budgetlens">BudgetLens</option>
                        <option value="cal">כאל</option>
                        <option value="blink">blink</option>
                      </select>
                    </div>

                    {/* Payment Method */}
                    <div className="form-group">
                      <label className="form-label">אמצעי תשלום (אופציונלי)</label>
                      {loadingDropdowns ? (
                        <div className="form-select" style={{display: 'flex', alignItems: 'center', justifyContent: 'center', height: '38px'}}>
                          <LoadingSpinner size="small" />
                        </div>
                      ) : (
                        <select
                          className="form-select"
                          value={sharedSettings.paymentMethod}
                          onChange={(e) => updateSharedSettings('paymentMethod', e.target.value)}
                        >
                          <option value="">בחר אמצעי תשלום...</option>
                          {sourceTypes.map(sourceType => (
                            <option key={sourceType} value={sourceType}>{sourceType}</option>
                          ))}
                          <option value="other">אחר</option>
                        </select>
                      )}
                      {sharedSettings.paymentMethod === 'other' && (
                        <input
                          type="text"
                          className="form-input"
                          style={{marginTop: '8px'}}
                          placeholder="הכנס אמצעי תשלום אחר..."
                          onChange={(e) => updateSharedSettings('paymentMethod', e.target.value)}
                        />
                      )}
                    </div>

                    {/* Payment Identifier */}
                    <div className="form-group">
                      <label className="form-label">זיהוי תשלום (אופציונלי)</label>
                      {loadingDropdowns ? (
                        <div className="form-select" style={{display: 'flex', alignItems: 'center', justifyContent: 'center', height: '38px'}}>
                          <LoadingSpinner size="small" />
                        </div>
                      ) : (
                        <select
                          className="form-select"
                          value={sharedSettings.paymentIdentifier}
                          onChange={(e) => updateSharedSettings('paymentIdentifier', e.target.value)}
                        >
                          <option value="">בחר זיהוי תשלום...</option>
                          {paymentMethods.map(paymentMethod => (
                            <option key={paymentMethod} value={paymentMethod}>{paymentMethod}</option>
                          ))}
                          <option value="other">אחר</option>
                        </select>
                      )}
                      {sharedSettings.paymentIdentifier === 'other' && (
                        <input
                          type="text"
                          className="form-input"
                          style={{marginTop: '8px'}}
                          placeholder="הכנס זיהוי תשלום אחר..."
                          onChange={(e) => updateSharedSettings('paymentIdentifier', e.target.value)}
                        />
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Files List */}
              {files.length > 0 && (
                <div className="files-list">
                  <h4>קבצים שנבחרו ({files.length})</h4>
                  {files.map(fileData => (
                    <div key={fileData.id} className="file-item">
                      <div className="file-info">
                        <div className="file-name">{fileData.name}</div>
                        <div className="file-size">{formatFileSize(fileData.size)}</div>
                      </div>

                      <button
                        className="btn btn-sm btn-secondary"
                        onClick={() => removeFile(fileData.id)}
                      >
                        הסר
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Process Button */}
              {files.length > 0 && (
                <div className="upload-actions">
                  <button
                    className="btn btn-primary btn-lg"
                    onClick={processFiles}
                    disabled={processing}
                  >
                    {processing ? (
                      <>
                        <LoadingSpinner size="small" />
                        מעבד קבצים...
                      </>
                    ) : (
                      'עבד ויצא קובץ BudgetLens'
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Results */}
        {result && (
          <div className="upload-section">
            <div className={`card ${result.success ? 'success' : 'error'}`}>
              <div className="card-header">
                <h3>
                  {result.success ? '✅ עיבוד הושלם בהצלחה' : '❌ שגיאה בעיבוד'}
                </h3>
              </div>
              <div className="card-body">
                {result.success ? (
                  <div className="success-message">
                    <p>🎉 כל הקבצים עובדו בהצלחה ויוצא קובץ BudgetLens מאוחד!</p>
                    
                    <div className="stats">
                      <div className="stat-item">
                        <span className="stat-label">סך הכל קבצים:</span>
                        <span className="stat-value">{result.totalFiles}</span>
                      </div>
                      <div className="stat-item">
                        <span className="stat-label">סך הכל תנועות:</span>
                        <span className="stat-value">{result.totalTransactions}</span>
                      </div>
                    </div>

                    <div className="processed-files">
                      <h4>קבצים שעובדו:</h4>
                      {result.processedFiles.map((file, index) => (
                        <div key={index} className="processed-file">
                          <span className="file-name">{file.filename}</span>
                          <span className="transaction-count">{file.transactions.length} תנועות</span>
                        </div>
                      ))}
                    </div>
                    
                    <div className="upload-actions" style={{marginTop: '20px'}}>
                      <button
                        className="btn btn-primary"
                        onClick={() => {
                          setFiles([]);
                          setResult(null);
                        }}
                      >
                        עבד קבצים נוספים
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="error-message">
                    <p><strong>שגיאה:</strong> {result.error}</p>
                    
                    <div className="upload-actions" style={{marginTop: '20px'}}>
                      <button
                        className="btn btn-secondary"
                        onClick={() => setResult(null)}
                      >
                        נסה שוב
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Info Section */}
        <div className="upload-section">
          <div className="card">
            <div className="card-header">
              <h3>איך זה עובד?</h3>
            </div>
            <div className="card-body">
              <div className="info-steps">
                <div className="info-step">
                  <div className="step-number">1</div>
                  <div className="step-content">
                    <h4>העלה קבצים</h4>
                    <p>העלה מספר קבצי Excel או CSV מבנקים שונים</p>
                  </div>
                </div>
                
                <div className="info-step">
                  <div className="step-number">2</div>
                  <div className="step-content">
                    <h4>הגדר הגדרות משותפות</h4>
                    <p>בחר מקור ואמצעי תשלום המשותפים לכל הקבצים</p>
                  </div>
                </div>
                
                <div className="info-step">
                  <div className="step-number">3</div>
                  <div className="step-content">
                    <h4>עיבוד ויצוא</h4>
                    <p>הקבצים יעובדו ויוצא קובץ BudgetLens מאוחד להורדה</p>
                  </div>
                </div>
                
                <div className="info-step">
                  <div className="step-number">4</div>
                  <div className="step-content">
                    <h4>ייבוא למערכת</h4>
                    <p>השתמש בקובץ המיוצא בממשק ההעלאה הרגיל</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FileMerger;