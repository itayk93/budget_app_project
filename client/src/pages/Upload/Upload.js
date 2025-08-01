import React, { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation } from 'react-query';
import { cashFlowsAPI, uploadAPI } from '../../services/api';
import LoadingSpinner from '../../components/Common/LoadingSpinner';
import UploadStepper from '../../components/Upload/UploadStepper';
import CurrencySelection from '../../components/Upload/CurrencySelection';
import CurrencyGroupsReview from '../../components/Upload/CurrencyGroupsReview';
import DuplicateReview from '../../components/Upload/DuplicateReview';
import ProgressTracking from '../../components/Upload/ProgressTracking';
import './Upload.css';

const Upload = () => {
  const [selectedFile, setSelectedFile] = useState(null);
  const [selectedCashFlow, setSelectedCashFlow] = useState('');
  const [forceImport, setForceImport] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);
  const [isDragOver, setIsDragOver] = useState(false);
  
  // Additional upload settings
  const [fileSource, setFileSource] = useState('other');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [paymentIdentifier, setPaymentIdentifier] = useState('');
  
  // Date filter settings
  const [dateFilterEnabled, setDateFilterEnabled] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  
  // Latest transaction date info
  const [latestTransactionInfo, setLatestTransactionInfo] = useState(null);
  const [loadingLatestDate, setLoadingLatestDate] = useState(false);
  
  // Dropdown data
  const [sourceTypes, setSourceTypes] = useState([]);
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [loadingDropdowns, setLoadingDropdowns] = useState(false);
  
  // Multi-step upload state
  const [currentStep, setCurrentStep] = useState(0);
  const [uploadId, setUploadId] = useState(null);
  const [currencyGroups, setCurrencyGroups] = useState(null);
  const [duplicates, setDuplicates] = useState(null);
  const [selectedCurrency, setSelectedCurrency] = useState(null);
  const [duplicateResolutions, setDuplicateResolutions] = useState(null);
  const [currencyGroupsTempId, setCurrencyGroupsTempId] = useState(null);
  const [duplicatesTempId, setDuplicatesTempId] = useState(null);
  const [isFinalizingImport, setIsFinalizingImport] = useState(false);
  const isFinalizingImportRef = useRef(false);
  
  const steps = [
    { title: 'העלאת קובץ', description: 'בחר את הקובץ לייבוא' },
    { title: 'עיבוד נתונים', description: 'מעבד את הקובץ' },
    { title: 'התאמת מטבעות', description: 'בחר תזרים לכל מטבע' },
    { title: 'טיפול בכפילויות', description: 'בדוק כפילויות' },
    { title: 'השלמה', description: 'סיום הייבוא' }
  ];

  // Fetch cash flows
  const { data: cashFlows, isLoading: cashFlowsLoading } = useQuery(
    'cashFlows',
    cashFlowsAPI.getAll
  );
  
  // Fetch dropdown data
  const fetchDropdownData = async () => {
    console.log('🔍 Fetching dropdown data...');
    setLoadingDropdowns(true);
    try {
      const token = localStorage.getItem('token');
      console.log('🔍 Token available:', !!token);
      
      const [sourceTypesRes, paymentMethodsRes] = await Promise.all([
        fetch('/api/upload/distinct-source-types', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }),
        fetch('/api/upload/distinct-payment-methods', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        })
      ]);

      console.log('🔍 Source types response status:', sourceTypesRes.status);
      console.log('🔍 Payment methods response status:', paymentMethodsRes.status);

      if (sourceTypesRes.ok) {
        const sourceTypesData = await sourceTypesRes.json();
        console.log('🔍 Source types data:', sourceTypesData);
        setSourceTypes(sourceTypesData.sourceTypes || []);
      } else {
        const errorData = await sourceTypesRes.text();
        console.error('😱 Source types request failed:', sourceTypesRes.status, errorData);
        setSourceTypes(['אשראי', 'מזומן', 'העברה בנקאית', 'צ\'ק']);
      }

      if (paymentMethodsRes.ok) {
        const paymentMethodsData = await paymentMethodsRes.json();
        console.log('🔍 Payment methods data:', paymentMethodsData);
        setPaymentMethods(paymentMethodsData.paymentMethods || []);
      } else {
        const errorData = await paymentMethodsRes.text();
        console.error('😱 Payment methods request failed:', paymentMethodsRes.status, errorData);
        setPaymentMethods(['1234', '5678', '9012', '3456']);
      }
    } catch (error) {
      console.error('Error fetching dropdown data:', error);
      // Always set fallback data if anything fails
      console.log('🔍 Setting fallback data due to error');
      setSourceTypes(['אשראי', 'מזומן', 'העברה בנקאית', 'צ\'ק']);
      setPaymentMethods(['1234', '5678', '9012', '3456']);
    } finally {
      setLoadingDropdowns(false);
    }
  };

  // Load dropdown data on component mount
  useEffect(() => {
    const token = localStorage.getItem('token');
    console.log('🔍 Token exists:', !!token);
    if (token) {
      fetchDropdownData();
    } else {
      console.log('😱 No token found, skipping dropdown data fetch');
    }
  }, []);

  // Fetch latest transaction date when cash flow is selected
  const fetchLatestTransactionDate = async (cashFlowId) => {
    if (!cashFlowId) {
      setLatestTransactionInfo(null);
      return;
    }
    
    setLoadingLatestDate(true);
    try {
      const result = await cashFlowsAPI.getLatestTransactionDate(cashFlowId);
      setLatestTransactionInfo(result);
    } catch (error) {
      console.error('Error fetching latest transaction date:', error);
      setLatestTransactionInfo(null);
    } finally {
      setLoadingLatestDate(false);
    }
  };

  // Watch for cash flow selection changes
  useEffect(() => {
    if (selectedCashFlow) {
      fetchLatestTransactionDate(selectedCashFlow);
    } else {
      setLatestTransactionInfo(null);
    }
  }, [selectedCashFlow]);

  // Helper functions for date manipulation
  const formatDateForInput = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toISOString().split('T')[0];
  };

  const formatDateForDisplay = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const day = date.getDate();
    const month = date.getMonth() + 1;
    const year = date.getFullYear();
    return `${day}.${month}.${year}`;
  };

  const addOneDay = (dateString) => {
    const date = new Date(dateString);
    date.setDate(date.getDate() + 1);
    return date.toISOString().split('T')[0];
  };

  const handleUseSameDate = () => {
    if (latestTransactionInfo?.latestTransactionDate) {
      setStartDate(formatDateForInput(latestTransactionInfo.latestTransactionDate));
    }
  };

  const handleUseNextDay = () => {
    if (latestTransactionInfo?.latestTransactionDate) {
      setStartDate(addOneDay(latestTransactionInfo.latestTransactionDate));
    }
  };

  const handleUploadAll = () => {
    setDateFilterEnabled(false);
    setStartDate('');
    setEndDate('');
  };

  // Initial upload mutation (step 1)
  const initialUploadMutation = useMutation(
    (formData) => uploadAPI.initiateUpload(formData),
    {
      onSuccess: (data) => {
        setUploadId(data.uploadId);
        setIsFinalizingImport(false); // Reset finalization state for new upload
        isFinalizingImportRef.current = false; // Reset ref as well
        setCurrentStep(1); // Move to processing step
      },
      onError: (error) => {
        setUploadResult({
          success: false,
          error: error.response?.data?.error || error.message || 'שגיאה בהעלאת הקובץ'
        });
      }
    }
  );
  
  // Final import mutation
  const finalImportMutation = useMutation(
    (data) => uploadAPI.finalizeImport(data),
    {
      onSuccess: (data) => {
        setUploadResult(data);
        setIsFinalizingImport(false); // Reset finalization state
        isFinalizingImportRef.current = false; // Reset ref as well
        setCurrentStep(4); // Move to completion step
      },
      onError: (error) => {
        setUploadResult({
          success: false,
          error: error.response?.data?.error || error.message || 'שגיאה בייבוא הקובץ'
        });
        setIsFinalizingImport(false); // Reset finalization state even on error
        isFinalizingImportRef.current = false; // Reset ref as well
      }
    }
  );

  const handleFileSelect = (file) => {
    if (file && (file.type.includes('excel') || file.type.includes('sheet') || file.name.endsWith('.csv'))) {
      setSelectedFile(file);
      setUploadResult(null);
    } else {
      alert('אנא בחר קובץ Excel או CSV');
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const file = e.dataTransfer.files[0];
    if (file) {
      handleFileSelect(file);
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

  const handleUpload = () => {
    if (!selectedFile || !selectedCashFlow) {
      alert('אנא בחר קובץ ותזרים מזומנים');
      return;
    }

    const formData = new FormData();
    formData.append('file', selectedFile);
    formData.append('cash_flow_id', selectedCashFlow);
    formData.append('force_import', forceImport);
    formData.append('file_source', fileSource);
    formData.append('payment_method', paymentMethod);
    formData.append('payment_identifier', paymentIdentifier);
    formData.append('date_filter_enabled', dateFilterEnabled);
    formData.append('start_date', startDate);
    formData.append('end_date', endDate);

    initialUploadMutation.mutate(formData);
  };
  
  const handleProgressComplete = (result) => {
    console.log('🔍 handleProgressComplete called with result:', result);
    
    // Prevent duplicate calls using both state and ref
    if (isFinalizingImport || isFinalizingImportRef.current) {
      console.log('⏭️ Already finalizing import, skipping duplicate call');
      return;
    }
    
    console.log('🔍 Result analysis:', {
      has_duplicates: result.has_duplicates,
      duplicates_temp_id: result.duplicates_temp_id,
      temp_duplicates_id: result.temp_duplicates_id,
      duplicates_count: result.duplicates?.length || 0,
      multiple_currencies: result.multiple_currencies,
      currency_groups_temp_id: result.currency_groups_temp_id,
      forceImport: forceImport
    });
    
    if (result.multiple_currencies && result.currency_groups_temp_id) {
      // Multi-currency file detected, go to currency groups review
      console.log('🔄 Multi-currency detected, moving to currency groups review');
      setCurrencyGroupsTempId(result.currency_groups_temp_id);
      setCurrentStep(2); // Move to currency groups review
    } else if (result.has_duplicates && (result.duplicates_temp_id || result.temp_duplicates_id)) {
      // Duplicates detected, go to duplicates review
      const tempId = result.duplicates_temp_id || result.temp_duplicates_id;
      console.log('🔄 Duplicates detected, moving to review step with tempId:', tempId);
      setDuplicatesTempId(tempId);
      setCurrentStep(3); // Move to duplicates review
    } else if (result.currencyGroups && Object.keys(result.currencyGroups).length > 1) {
      console.log('🔄 Legacy currency groups detected');
      setCurrencyGroups(result.currencyGroups);
      setCurrentStep(2); // Move to currency selection (legacy)
    } else if (result.duplicates && Object.keys(result.duplicates).length > 0 && !forceImport) {
      console.log('🔄 Legacy duplicates detected');
      setDuplicates(result.duplicates);
      setCurrentStep(3); // Move to duplicate review
    } else {
      // No currency selection or duplicates needed, proceed to final import
      console.log('🔄 No special handling needed, proceeding to final import');
      finalizeImport(result);
    }
  };
  
  const handleProgressError = (error) => {
    setUploadResult({
      success: false,
      error: error
    });
    setCurrentStep(0); // Reset to initial step
  };
  
  const handleCurrencySelect = (currency) => {
    setSelectedCurrency(currency);
    // Continue processing with selected currency
    const data = {
      uploadId,
      selectedCurrency: currency,
      cashFlowId: selectedCashFlow
    };
    
    // Check for duplicates with selected currency
    uploadAPI.checkDuplicates(data).then(result => {
      if (result.duplicates && Object.keys(result.duplicates).length > 0) {
        setDuplicates(result.duplicates);
        setCurrentStep(3);
      } else {
        finalizeImport(result);
      }
    }).catch(error => {
      handleProgressError(error.message);
    });
  };
  
  const handleDuplicateResolve = (resolutions) => {
    setDuplicateResolutions(resolutions);
    
    const data = {
      uploadId,
      selectedCurrency,
      duplicateResolutions: resolutions,
      cashFlowId: selectedCashFlow
    };
    
    finalizeImport(data);
  };
  
  const finalizeImport = (data) => {
    // Prevent duplicate finalization calls using ref for immediate check
    if (isFinalizingImport || isFinalizingImportRef.current) {
      console.log('⏭️ Already finalizing import, skipping duplicate call');
      return;
    }
    
    setIsFinalizingImport(true);
    isFinalizingImportRef.current = true;
    
    const finalData = {
      uploadId,
      selectedCurrency,
      duplicateResolutions,
      cashFlowId: selectedCashFlow,
      ...data
    };
    
    finalImportMutation.mutate(finalData);
  };
  
  const handleBackToUpload = () => {
    setCurrentStep(0);
    setUploadId(null);
    setCurrencyGroups(null);
    setDuplicates(null);
    setSelectedCurrency(null);
    setDuplicateResolutions(null);
    setCurrencyGroupsTempId(null);
    setDuplicatesTempId(null);
    setUploadResult(null);
    setSelectedFile(null);
    setFileSource('other');
    setIsFinalizingImport(false);
    isFinalizingImportRef.current = false;
    setPaymentMethod('');
    setPaymentIdentifier('');
    setForceImport(false);
    setDateFilterEnabled(false);
    setStartDate('');
    setEndDate('');
    setLatestTransactionInfo(null);
  };
  
  const handleBackFromDuplicates = () => {
    if (currencyGroupsTempId || (currencyGroups && Object.keys(currencyGroups).length > 1)) {
      setCurrentStep(2);
    } else {
      setCurrentStep(1);
    }
  };
  
  // Handle currency groups completion
  const handleCurrencyGroupsComplete = (result) => {
    if (result.redirect_to === 'duplicates' && result.temp_duplicates_id) {
      // Has duplicates, move to duplicates review
      setDuplicatesTempId(result.temp_duplicates_id);
      setCurrentStep(3);
    } else {
      // No duplicates, complete the upload
      setUploadResult({
        success: true,
        message: result.message,
        stats: {
          imported: result.imported || 0,
          skipped: result.skipped || 0,
          duplicates: result.duplicates || 0
        }
      });
      setCurrentStep(4);
    }
  };
  
  // Handle duplicates completion
  const handleDuplicatesComplete = (result) => {
    setUploadResult({
      success: true,
      message: result.message,
      stats: {
        imported: result.imported || 0,
        skipped: result.skipped || 0
      }
    });
    setCurrentStep(4);
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  if (cashFlowsLoading) {
    return (
      <div className="loading">
        <LoadingSpinner size="large" text="טוען נתונים..." />
      </div>
    );
  }

  return (
    <div className="upload-page">
      <div className="page-header">
        <div className="page-title">
          <h1>העלאת קבצי בנק</h1>
          <p className="text-muted">העלה קבצי Excel או CSV מהבנק לייבוא אוטומטי של תנועות</p>
        </div>
        <div className="page-actions">
          <button
            className="btn btn-secondary"
            onClick={() => window.location.href = '/upload/file-merger'}
          >
            🔗 מיזוג קבצים
          </button>
        </div>
      </div>

      {/* Upload Stepper */}
      {currentStep > 0 && (
        <UploadStepper currentStep={currentStep} steps={steps} />
      )}

      <div className="upload-content">
        {/* Step 0: Initial Upload */}
        {currentStep === 0 && (
          <div className="upload-section">
            <div className="card">
              <div className="card-header">
                <h3>העלאת קובץ</h3>
              </div>
              <div className="card-body">
                {/* File Drop Zone */}
                <div
                  className={`file-drop-zone ${isDragOver ? 'drag-over' : ''} ${selectedFile ? 'has-file' : ''}`}
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                >
                  {selectedFile ? (
                    <div className="selected-file">
                      <div className="file-icon">📄</div>
                      <div className="file-info">
                        <div className="file-name">{selectedFile.name}</div>
                        <div className="file-size">{formatFileSize(selectedFile.size)}</div>
                      </div>
                      <button
                        className="btn btn-sm btn-secondary"
                        onClick={() => setSelectedFile(null)}
                      >
                        הסר
                      </button>
                    </div>
                  ) : (
                    <div className="drop-zone-content">
                      <div className="drop-zone-icon">📁</div>
                      <div className="drop-zone-text">
                        <p>גרור קובץ לכאן או <button className="link-button" onClick={() => document.getElementById('file-input').click()}>בחר קובץ</button></p>
                        <p className="text-muted">קבצי Excel (.xlsx, .xls) או CSV</p>
                      </div>
                    </div>
                  )}
                  
                  <input
                    id="file-input"
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    onChange={handleFileChange}
                    style={{ display: 'none' }}
                  />
                </div>

                {/* Cash Flow Selection */}
                <div className="form-group">
                  <label className="form-label">תזרים מזומנים</label>
                  <select
                    className="form-select"
                    value={selectedCashFlow}
                    onChange={(e) => setSelectedCashFlow(e.target.value)}
                  >
                    <option value="">בחר תזרים מזומנים</option>
                    {cashFlows?.map(cashFlow => (
                      <option key={cashFlow.id} value={cashFlow.id}>
                        {cashFlow.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Date suggestion message - shows immediately after selecting cash flow */}
                {selectedCashFlow && latestTransactionInfo?.latestTransactionDate && (
                  <div style={{
                    background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
                    borderRadius: '16px',
                    padding: '24px',
                    marginBottom: '24px',
                    color: 'white',
                    textAlign: 'center',
                    boxShadow: '0 8px 32px rgba(240, 147, 251, 0.3)',
                    border: '1px solid rgba(255, 255, 255, 0.2)'
                  }}>
                    <div style={{fontSize: '18px', marginBottom: '8px'}}>
                      📅 ✨
                    </div>
                    <div style={{fontSize: '16px', fontWeight: '500', marginBottom: '12px'}}>
                      התאריך האחרון של התזרים "{latestTransactionInfo.cashFlowName}" הוא{' '}
                      <strong>{formatDateForDisplay(latestTransactionInfo.latestTransactionDate)}</strong>
                    </div>
                    <div style={{fontSize: '14px', marginBottom: '16px', opacity: '0.9'}}>
                      אז מאיזה תאריך אתה רוצה להעלות את הנתונים? 🤔
                    </div>
                    <div style={{display: 'flex', gap: '8px', justifyContent: 'center', flexWrap: 'wrap'}}>
                      <button
                        type="button"
                        onClick={() => {
                          setDateFilterEnabled(true);
                          handleUseSameDate();
                        }}
                        style={{
                          background: 'rgba(255, 255, 255, 0.25)',
                          border: '2px solid rgba(255, 255, 255, 0.4)',
                          borderRadius: '12px',
                          padding: '12px 20px',
                          color: 'white',
                          fontSize: '14px',
                          fontWeight: '600',
                          cursor: 'pointer',
                          transition: 'all 0.3s ease',
                          backdropFilter: 'blur(20px)',
                          boxShadow: '0 4px 16px rgba(0, 0, 0, 0.1)'
                        }}
                        onMouseOver={(e) => {
                          e.target.style.background = 'rgba(255, 255, 255, 0.35)';
                          e.target.style.transform = 'translateY(-2px)';
                          e.target.style.boxShadow = '0 6px 24px rgba(0, 0, 0, 0.15)';
                        }}
                        onMouseOut={(e) => {
                          e.target.style.background = 'rgba(255, 255, 255, 0.25)';
                          e.target.style.transform = 'translateY(0)';
                          e.target.style.boxShadow = '0 4px 16px rgba(0, 0, 0, 0.1)';
                        }}
                      >
                        📅 מאותו יום ({formatDateForDisplay(latestTransactionInfo.latestTransactionDate)})
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setDateFilterEnabled(true);
                          handleUseNextDay();
                        }}
                        style={{
                          background: 'rgba(255, 255, 255, 0.25)',
                          border: '2px solid rgba(255, 255, 255, 0.4)',
                          borderRadius: '12px',
                          padding: '12px 20px',
                          color: 'white',
                          fontSize: '14px',
                          fontWeight: '600',
                          cursor: 'pointer',
                          transition: 'all 0.3s ease',
                          backdropFilter: 'blur(20px)',
                          boxShadow: '0 4px 16px rgba(0, 0, 0, 0.1)'
                        }}
                        onMouseOver={(e) => {
                          e.target.style.background = 'rgba(255, 255, 255, 0.35)';
                          e.target.style.transform = 'translateY(-2px)';
                          e.target.style.boxShadow = '0 6px 24px rgba(0, 0, 0, 0.15)';
                        }}
                        onMouseOut={(e) => {
                          e.target.style.background = 'rgba(255, 255, 255, 0.25)';
                          e.target.style.transform = 'translateY(0)';
                          e.target.style.boxShadow = '0 4px 16px rgba(0, 0, 0, 0.1)';
                        }}
                      >
                        🗓️ מהיום שאחרי ({formatDateForDisplay(addOneDay(latestTransactionInfo.latestTransactionDate))})
                      </button>
                      <button
                        type="button"
                        onClick={handleUploadAll}
                        style={{
                          background: 'rgba(255, 255, 255, 0.25)',
                          border: '2px solid rgba(255, 255, 255, 0.4)',
                          borderRadius: '12px',
                          padding: '12px 20px',
                          color: 'white',
                          fontSize: '14px',
                          fontWeight: '600',
                          cursor: 'pointer',
                          transition: 'all 0.3s ease',
                          backdropFilter: 'blur(20px)',
                          boxShadow: '0 4px 16px rgba(0, 0, 0, 0.1)'
                        }}
                        onMouseOver={(e) => {
                          e.target.style.background = 'rgba(255, 255, 255, 0.35)';
                          e.target.style.transform = 'translateY(-2px)';
                          e.target.style.boxShadow = '0 6px 24px rgba(0, 0, 0, 0.15)';
                        }}
                        onMouseOut={(e) => {
                          e.target.style.background = 'rgba(255, 255, 255, 0.25)';
                          e.target.style.transform = 'translateY(0)';
                          e.target.style.boxShadow = '0 4px 16px rgba(0, 0, 0, 0.1)';
                        }}
                      >
                        📤 העלה הכל
                      </button>
                    </div>
                  </div>
                )}

                {/* Loading message for cash flow selection */}
                {selectedCashFlow && loadingLatestDate && (
                  <div style={{
                    background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
                    borderRadius: '16px',
                    padding: '20px',
                    marginBottom: '24px',
                    color: 'white',
                    textAlign: 'center',
                    fontSize: '16px',
                    boxShadow: '0 8px 32px rgba(79, 172, 254, 0.3)',
                    border: '1px solid rgba(255, 255, 255, 0.2)'
                  }}>
                    <LoadingSpinner size="small" /> בודק את התאריך האחרון...
                  </div>
                )}

                {/* No transactions message for cash flow selection */}
                {selectedCashFlow && latestTransactionInfo && !latestTransactionInfo.latestTransactionDate && (
                  <div style={{
                    background: 'linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)',
                    borderRadius: '16px',
                    padding: '24px',
                    marginBottom: '24px',
                    color: '#8b4513',
                    textAlign: 'center',
                    boxShadow: '0 8px 32px rgba(252, 182, 159, 0.3)',
                    border: '1px solid rgba(139, 69, 19, 0.2)'
                  }}>
                    <div style={{fontSize: '24px', marginBottom: '12px'}}>
                      🎉 ✨
                    </div>
                    <div style={{fontSize: '18px', fontWeight: '600'}}>
                      זה התזרים הראשון שלך! בחר תאריך התחלה לייבוא 📅
                    </div>
                  </div>
                )}

                {/* Upload Settings Grid */}
                <div className="settings-grid">
                  <div className="form-group">
                    <label className="form-label">מקור הקבצים</label>
                    <select
                      className="form-select"
                      value={fileSource}
                      onChange={(e) => setFileSource(e.target.value)}
                    >
                      <option value="other">כללי</option>
                      <option value="isracard">ישראכרט</option>
                      <option value="leumi">בנק לאומי</option>
                      <option value="hapoalim">בנק הפועלים</option>
                      <option value="budgetlens">BudgetLens</option>
                      <option value="cal">כאל</option>
                      <option value="max">מקס</option>
                      <option value="blink">blink</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">אמצעי תשלום (אופציונלי)</label>
                    {loadingDropdowns ? (
                      <div className="form-select" style={{display: 'flex', alignItems: 'center', justifyContent: 'center', height: '38px'}}>
                        <LoadingSpinner size="small" />
                      </div>
                    ) : (
                      <select
                        className="form-select"
                        value={paymentMethod}
                        onChange={(e) => setPaymentMethod(e.target.value)}
                      >
                        <option value="">בחר אמצעי תשלום...</option>
                        {sourceTypes.map(sourceType => (
                          <option key={sourceType} value={sourceType}>{sourceType}</option>
                        ))}
                        <option value="other">אחר</option>
                      </select>
                    )}
                    {paymentMethod === 'other' && (
                      <input
                        type="text"
                        className="form-input"
                        style={{marginTop: '8px'}}
                        placeholder="הכנס אמצעי תשלום אחר..."
                        onChange={(e) => setPaymentMethod(e.target.value)}
                      />
                    )}
                  </div>
                  {fileSource !== 'max' && (
                    <div className="form-group">
                      <label className="form-label">זיהוי תשלום (אופציונלי)</label>
                    {loadingDropdowns ? (
                      <div className="form-select" style={{display: 'flex', alignItems: 'center', justifyContent: 'center', height: '38px'}}>
                        <LoadingSpinner size="small" />
                      </div>
                    ) : (
                      <select
                        className="form-select"
                        value={paymentIdentifier}
                        onChange={(e) => setPaymentIdentifier(e.target.value)}
                      >
                        <option value="">בחר זיהוי תשלום...</option>
                        {paymentMethods.map(paymentMethod => (
                          <option key={paymentMethod} value={paymentMethod}>{paymentMethod}</option>
                        ))}
                        <option value="other">אחר</option>
                      </select>
                    )}
                    {paymentIdentifier === 'other' && (
                      <input
                        type="text"
                        className="form-input"
                        style={{marginTop: '8px'}}
                        placeholder="הכנס זיהוי תשלום אחר..."
                        onChange={(e) => setPaymentIdentifier(e.target.value)}
                      />
                    )}
                    </div>
                  )}
                </div>

                {/* Date Filter Section */}
                <div className="form-group">
                  <label className="form-checkbox">
                    <input
                      type="checkbox"
                      checked={dateFilterEnabled}
                      onChange={(e) => setDateFilterEnabled(e.target.checked)}
                    />
                    <span className="checkmark"></span>
                    סינון לפי תאריך (אופציונלי)
                  </label>
                  <p className="form-help">
                    בחר באפשרות זו כדי לייבא רק נתונים מטווח תאריכים מסוים
                  </p>
                </div>

                {dateFilterEnabled && (
                  <div>
                    {/* Simplified quick date buttons when filter is enabled */}
                    {selectedCashFlow && latestTransactionInfo?.latestTransactionDate && (
                      <div style={{
                        background: 'linear-gradient(135deg, #e3f2fd 0%, #f3e5f5 100%)',
                        borderRadius: '12px',
                        padding: '16px',
                        marginBottom: '20px',
                        textAlign: 'center',
                        border: '1px solid rgba(102, 126, 234, 0.2)',
                        boxShadow: '0 4px 16px rgba(102, 126, 234, 0.1)'
                      }}>
                        <div style={{fontSize: '16px', marginBottom: '12px', color: '#667eea', fontWeight: '600'}}>
                          🔄 עדכון מהיר:
                        </div>
                        <div style={{display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap'}}>
                          <button
                            type="button"
                            onClick={handleUseSameDate}
                            style={{
                              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                              border: 'none',
                              borderRadius: '10px',
                              padding: '10px 16px',
                              color: 'white',
                              fontSize: '14px',
                              fontWeight: '600',
                              cursor: 'pointer',
                              transition: 'all 0.3s ease',
                              boxShadow: '0 4px 12px rgba(102, 126, 234, 0.3)'
                            }}
                            onMouseOver={(e) => {
                              e.target.style.transform = 'translateY(-2px)';
                              e.target.style.boxShadow = '0 6px 16px rgba(102, 126, 234, 0.4)';
                            }}
                            onMouseOut={(e) => {
                              e.target.style.transform = 'translateY(0)';
                              e.target.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.3)';
                            }}
                          >
                            📅 מאותו יום
                          </button>
                          <button
                            type="button"
                            onClick={handleUseNextDay}
                            style={{
                              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                              border: 'none',
                              borderRadius: '10px',
                              padding: '10px 16px',
                              color: 'white',
                              fontSize: '14px',
                              fontWeight: '600',
                              cursor: 'pointer',
                              transition: 'all 0.3s ease',
                              boxShadow: '0 4px 12px rgba(102, 126, 234, 0.3)'
                            }}
                            onMouseOver={(e) => {
                              e.target.style.transform = 'translateY(-2px)';
                              e.target.style.boxShadow = '0 6px 16px rgba(102, 126, 234, 0.4)';
                            }}
                            onMouseOut={(e) => {
                              e.target.style.transform = 'translateY(0)';
                              e.target.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.3)';
                            }}
                          >
                            🗓️ מהיום שאחרי
                          </button>
                        </div>
                      </div>
                    )}

                    <div className="settings-grid">
                      <div className="form-group">
                        <label className="form-label">תאריך התחלה</label>
                        <input
                          type="date"
                          className="form-input"
                          value={startDate}
                          onChange={(e) => setStartDate(e.target.value)}
                          placeholder="dd/mm/yyyy"
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label">תאריך סיום (אופציונלי)</label>
                        <input
                          type="date"
                          className="form-input"
                          value={endDate}
                          onChange={(e) => setEndDate(e.target.value)}
                          placeholder="dd/mm/yyyy"
                        />
                        <p className="form-help" style={{fontSize: '12px', marginTop: '4px'}}>
                          אם לא יצוין - יייבא עד סוף הקובץ
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Force Import Option */}
                <div className="form-group">
                  <label className="form-checkbox">
                    <input
                      type="checkbox"
                      checked={forceImport}
                      onChange={(e) => setForceImport(e.target.checked)}
                    />
                    <span className="checkmark"></span>
                    ייבוא כפוי (התעלם מכפילויות)
                  </label>
                  <p className="form-help">
                    בחר באפשרות זו כדי לייבא תנועות גם אם הן כבר קיימות במערכת
                  </p>
                </div>

                {/* Upload Button */}
                <div className="upload-actions">
                  <button
                    className="btn btn-primary btn-lg"
                    onClick={handleUpload}
                    disabled={!selectedFile || !selectedCashFlow || initialUploadMutation.isLoading}
                  >
                    {initialUploadMutation.isLoading ? (
                      <>
                        <LoadingSpinner size="small" />
                        מעלה קובץ...
                      </>
                    ) : (
                      'העלה קובץ'
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
        
        {/* Step 1: Progress Tracking */}
        {currentStep === 1 && (
          <ProgressTracking
            uploadId={uploadId}
            onComplete={handleProgressComplete}
            onError={handleProgressError}
          />
        )}
        
        {/* Step 2: Currency Groups Review or Legacy Currency Selection */}
        {currentStep === 2 && currencyGroupsTempId ? (
          <CurrencyGroupsReview
            tempId={currencyGroupsTempId}
            onComplete={handleCurrencyGroupsComplete}
            onBack={handleBackToUpload}
          />
        ) : currentStep === 2 && currencyGroups ? (
          <CurrencySelection
            currencyGroups={currencyGroups}
            onCurrencySelect={handleCurrencySelect}
            onBack={handleBackToUpload}
          />
        ) : null}
        
        {/* Step 3: Duplicate Review */}
        {currentStep === 3 && (duplicatesTempId || duplicates) && (
          <DuplicateReview
            tempId={duplicatesTempId}
            duplicates={duplicates}
            onComplete={duplicatesTempId ? handleDuplicatesComplete : handleDuplicateResolve}
            onBack={handleBackFromDuplicates}
          />
        )}

        {/* Step 4: Upload Result */}
        {(uploadResult || currentStep === 4) && (
          <div className="upload-section">
            <div className={`card ${uploadResult?.success ? 'success' : 'error'}`}>
              <div className="card-header">
                <h3>
                  {uploadResult?.success ? '✅ העלאה הושלמה בהצלחה' : '❌ שגיאה בהעלאה'}
                </h3>
              </div>
              <div className="card-body">
                {uploadResult?.success ? (
                  <div className="upload-stats">
                    <div className="success-message">
                      <p>🎉 הקובץ עובד בהצלחה! התנועות נטענו למערכת בהצלחה.</p>
                    </div>
                    
                    <div className="stat-item">
                      <span className="stat-label">יובאו בהצלחה:</span>
                      <span className="stat-value success">{uploadResult.stats?.imported?.toLocaleString() || 0}</span>
                    </div>
                    {uploadResult.stats?.duplicates > 0 && (
                      <div className="stat-item">
                        <span className="stat-label">כפילויות (לא יובאו):</span>
                        <span className="stat-value warning">{uploadResult.stats?.duplicates?.toLocaleString() || 0}</span>
                      </div>
                    )}
                    {uploadResult.stats?.errors > 0 && (
                      <div className="stat-item">
                        <span className="stat-label">שגיאות:</span>
                        <span className="stat-value error">{uploadResult.stats?.errors?.toLocaleString() || 0}</span>
                      </div>
                    )}
                    
                    {uploadResult.fileFormat && (
                      <div className="stat-item">
                        <span className="stat-label">פורמט זוהה:</span>
                        <span className="stat-value">{uploadResult.fileFormat}</span>
                      </div>
                    )}
                    
                    <div className="upload-actions" style={{marginTop: '20px'}}>
                      <button
                        className="btn btn-primary"
                        onClick={handleBackToUpload}
                      >
                        העלה קובץ נוסף
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="error-message">
                    <div className="error-header">
                      <h4>שגיאה בעיבוד הקובץ</h4>
                    </div>
                    
                    <div className="error-content">
                      <p><strong>תיאור השגיאה:</strong> {uploadResult?.error}</p>
                      
                      {uploadResult?.error?.includes('timeout') && (
                        <div className="timeout-help">
                          <h5>💡 עצות לקבצים גדולים:</h5>
                          <ul>
                            <li>נסה לחלק את הקובץ לקבצים קטנים יותר (עד 100K רשומות כל אחד)</li>
                            <li>ודא שהחיבור לאינטרנט יציב</li>
                            <li>נסה להעלות בשעות לא עמוסות</li>
                            <li>אם הבעיה נמשכת, צור קשר עם התמיכה</li>
                          </ul>
                        </div>
                      )}
                      
                      {uploadResult?.details && (
                        <details className="error-details">
                          <summary>פרטים טכניים (לתמיכה)</summary>
                          <pre>{uploadResult.details}</pre>
                        </details>
                      )}
                    </div>
                    
                    <div className="upload-actions" style={{marginTop: '20px'}}>
                      <button
                        className="btn btn-secondary"
                        onClick={handleBackToUpload}
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

        {/* Supported Formats - Only show on initial step */}
        {currentStep === 0 && (
          <div className="upload-section">
            <div className="card">
              <div className="card-header">
                <h3>פורמטים נתמכים</h3>
              </div>
              <div className="card-body">
                <div className="supported-formats">
                  <div className="format-item">
                    <div className="format-icon">🏛️</div>
                    <div className="format-info">
                      <h4>ישראכרט (Isracard)</h4>
                      <p>קבצי אקסל מהאתר של ישראכרט</p>
                      <small>עמודות נדרשות: תיאור עסקה, תאריך עסקה, סכום</small>
                    </div>
                  </div>
                  
                  <div className="format-item">
                    <div className="format-icon">🏦</div>
                    <div className="format-info">
                      <h4>בנק לאומי</h4>
                      <p>קבצי אקסל מחשבון הבנק</p>
                      <small>עמודות נדרשות: תאריך, תיאור, זכות/חובה</small>
                    </div>
                  </div>
                  
                  <div className="format-item">
                    <div className="format-icon">🏦</div>
                    <div className="format-info">
                      <h4>בנק הפועלים</h4>
                      <p>קבצי אקסל מחשבון הבנק</p>
                      <small>עמודות נדרשות: תאריך ביצוע, פירוט נוסף, סכום</small>
                    </div>
                  </div>
                  
                  <div className="format-item">
                    <div className="format-icon">💳</div>
                    <div className="format-info">
                      <h4>מקס (Max)</h4>
                      <p>קבצי Excel מכרטיס האשראי מקס</p>
                      <small>עמודות נדרשות: תאריך עסקה, שם בית העסק, סכום חיוב</small>
                    </div>
                  </div>
                  
                  <div className="format-item">
                    <div className="format-icon">📊</div>
                    <div className="format-info">
                      <h4>פורמט כללי</h4>
                      <p>קבצי CSV או Excel עם עמודות סטנדרטיות</p>
                      <small>עמודות נדרשות: תאריך, תיאור/עסק, סכום</small>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Upload;