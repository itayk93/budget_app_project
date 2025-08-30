import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useQuery, useMutation } from 'react-query';
import { cashFlowsAPI, uploadAPI } from '../../services/api';
import LoadingSpinner from '../../components/Common/LoadingSpinner';
import UploadStepper from '../../components/Upload/UploadStepper';
import CurrencySelection from '../../components/Upload/CurrencySelection';
import CurrencyGroupsReview from '../../components/Upload/CurrencyGroupsReview';
import DuplicateReview from '../../components/Upload/DuplicateReview';
import ProgressTracking from '../../components/Upload/ProgressTracking';
import TransactionReviewModal from '../../components/Upload/TransactionReviewModal';

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
  
  // Transaction review modal state
  const [showTransactionReview, setShowTransactionReview] = useState(false);
  const [reviewTransactions, setReviewTransactions] = useState([]);
  const [reviewFileSource, setReviewFileSource] = useState('');
  
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

  // Clean business names - replace slashes with spaces, remove problematic characters, and normalize whitespace
  const cleanBusinessNames = (transactions) => {
    return transactions.map(txn => ({
      ...txn,
      business_name: txn.business_name ? 
        txn.business_name
          .replace(/\//g, ' ') // Replace slashes with spaces
          .replace(/[״""''`]/g, '') // Remove quotes and apostrophes
          .replace(/[';]/g, '') // Remove semicolons and single quotes (SQL injection prevention)
          .replace(/\s+/g, ' ') // Replace multiple spaces with single space
          .trim() 
        : txn.business_name
    }));
  };

  // Check for duplicates using the dedicated duplicate checking endpoint
  const checkForDuplicates = useCallback(async (transactions, fileSource, paymentIdentifier, cashFlowId) => {
    try {
      console.log('🔍 Checking for duplicates in bank scraper transactions...');
      console.log('🔍 Using cash flow ID for duplicate check:', cashFlowId);
      
      const token = localStorage.getItem('token');
      
      const response = await fetch('/api/upload/check-duplicates', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          transactions,
          cash_flow_id: cashFlowId || selectedCashFlow
        })
      });
      
      if (!response.ok) {
        console.error('❌ Duplicate check request failed:', response.status, response.statusText);
        return { has_duplicates: false, transactions };
      }
      
      const result = await response.json();
      console.log('🔍 Duplicate check result:', result);
      
      return result;
      
    } catch (error) {
      console.error('❌ Error checking for duplicates:', error);
      return { has_duplicates: false, transactions };
    }
  }, [selectedCashFlow]);

  // Check for bank scraper data in sessionStorage on component mount
  useEffect(() => {
    const checkBankScraperData = async () => {
      try {
        const bankScraperData = sessionStorage.getItem('bankScraperTransactions');
        if (bankScraperData) {
          console.log('🏦 Bank scraper data found in sessionStorage, processing...');
          const data = JSON.parse(bankScraperData);
          
          // Validate the data structure
          if (data.transactions && Array.isArray(data.transactions) && data.transactions.length > 0) {
            console.log(`✅ Found ${data.transactions.length} bank scraper transactions from ${data.configName || 'Unknown'}`);
            
            // Create a dummy uploadId for bank scraper transactions
            const dummyUploadId = `bank-scraper-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
            setUploadId(dummyUploadId);
            console.log(`📝 Created dummy uploadId for bank scraper: ${dummyUploadId}`);
            
            // Clean business names - replace slashes with spaces
            const cleanedTransactions = cleanBusinessNames(data.transactions);
            console.log('🧹 Cleaned business names (replaced / with spaces)');
            
            // Auto-select the account number as payment method if available
            if (data.accountNumber) {
              setPaymentIdentifier(data.accountNumber);
            }
            
            // Set file source to bank scraper
            setFileSource('bank_scraper');
            
            // Find default cash flow for duplicate checking
            const defaultCashFlow = cashFlows?.find(cf => cf.is_default) || cashFlows?.[0];
            const cashFlowForDuplicateCheck = selectedCashFlow || defaultCashFlow?.id;
            
            console.log('🔍 Cash flow for duplicate check:', { 
              selectedCashFlow, 
              defaultCashFlow: defaultCashFlow?.name, 
              cashFlowForDuplicateCheck 
            });

            // Check for duplicates with either selected cash flow or default
            if (cashFlowForDuplicateCheck) {
              console.log('🔍 Checking for duplicates before opening modal...');
              const duplicateResult = await checkForDuplicates(cleanedTransactions, 'bank_scraper', data.accountNumber, cashFlowForDuplicateCheck);
              
              if (duplicateResult && duplicateResult.has_duplicates) {
                console.log('⚠️ Duplicates found, using system duplicate handling');
                // Use the system's duplicate handling mechanism
                if (duplicateResult.transactions) {
                  setReviewTransactions(duplicateResult.transactions);
                  setReviewFileSource('bank_scraper');
                  setShowTransactionReview(true);
                }
              } else {
                // No duplicates, proceed normally
                console.log('✅ No duplicates found, opening transaction review modal');
                setReviewTransactions(cleanedTransactions);
                setReviewFileSource(data.source || 'bank_scraper');
                setShowTransactionReview(true);
              }
            } else {
              // No cash flows available, just open the modal with cleaned transactions
              console.log('ℹ️ No cash flows available, opening modal without duplicate check');
              setReviewTransactions(cleanedTransactions);
              setReviewFileSource(data.source || 'bank_scraper');
              setShowTransactionReview(true);
            }
            
            // Clear the session storage data since we've processed it
            sessionStorage.removeItem('bankScraperTransactions');
            
            console.log('🎯 Transaction processing completed');
          } else {
            console.log('⚠️ Invalid bank scraper data structure, ignoring');
            sessionStorage.removeItem('bankScraperTransactions');
          }
        }
      } catch (error) {
        console.error('❌ Error processing bank scraper data from sessionStorage:', error);
        // Clear invalid data
        sessionStorage.removeItem('bankScraperTransactions');
      }
    };
    
    // Small delay to ensure component is fully mounted and cash flow is available
    const timer = setTimeout(checkBankScraperData, 500);
    return () => clearTimeout(timer);
  }, [selectedCashFlow, checkForDuplicates, cashFlows]); // Add cashFlows as dependency

  // Fetch latest transaction date when cash flow is selected
  const fetchLatestTransactionDate = async (cashFlowId, sourceType = null) => {
    if (!cashFlowId) {
      setLatestTransactionInfo(null);
      return;
    }
    
    setLoadingLatestDate(true);
    try {
      // Use general transaction date for BudgetLens, otherwise use file source specific
      const effectiveSource = sourceType === 'budgetlens' ? null : sourceType;
      const result = await cashFlowsAPI.getLatestTransactionDate(cashFlowId, effectiveSource);
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
      fetchLatestTransactionDate(selectedCashFlow, fileSource);
    } else {
      setLatestTransactionInfo(null);
    }
  }, [selectedCashFlow, fileSource]);

  // Watch for file source changes to auto-detect payment identifier and payment method
  useEffect(() => {
    if ((fileSource === 'cal' || fileSource === 'americanexpress') && selectedFile) {
      const fileName = selectedFile.name;
      // Look for patterns like "7209" or "3079" in file names
      const match = fileName.match(/(\d{4})/);
      if (match && match[1]) {
        setPaymentIdentifier(match[1]);
      }
    } else if (fileSource !== 'cal' && fileSource !== 'americanexpress') {
      // Clear auto-detected payment identifier for non-CAL and non-AmEx files
      if (paymentIdentifier && selectedFile) {
        const fileName = selectedFile.name;
        const match = fileName.match(/(\d{4})/);
        if (match && match[1] === paymentIdentifier) {
          setPaymentIdentifier('');
        }
      }
    }
    
    // Auto-select payment method for credit card sources
    if (fileSource === 'cal' || fileSource === 'max' || fileSource === 'americanexpress') {
      setPaymentMethod('creditCard');
    } else if (fileSource !== 'cal' && fileSource !== 'max' && fileSource !== 'americanexpress' && paymentMethod === 'creditCard') {
      // Clear auto-selected payment method when switching away from credit card sources
      setPaymentMethod('');
    }
  }, [fileSource, selectedFile, paymentIdentifier, paymentMethod]);

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
    if (!dateString || dateString === null || dateString === undefined) {
      return '';
    }
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      return '';
    }
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
        setUploadId(null); // Clear upload ID after successful completion
        
        // Clear transaction review state to prevent modal from reopening
        setShowTransactionReview(false);
        setReviewTransactions([]);
        setReviewFileSource('');
        
        setCurrentStep(4); // Move to completion step
      },
      onError: (error) => {
        setUploadResult({
          success: false,
          error: error.response?.data?.error || error.message || 'שגיאה בייבוא הקובץ'
        });
        setIsFinalizingImport(false); // Reset finalization state even on error
        isFinalizingImportRef.current = false; // Reset ref as well
        
        // Clear transaction review state on error as well
        setShowTransactionReview(false);
        setReviewTransactions([]);
        setReviewFileSource('');
      }
    }
  );

  const handleFileSelect = (file) => {
    if (file && (file.type.includes('excel') || file.type.includes('sheet') || file.name.endsWith('.csv'))) {
      setSelectedFile(file);
      setUploadResult(null);
      
      // Auto-detect payment identifier for CAL and American Express files
      if (fileSource === 'cal' || fileSource === 'americanexpress') {
        const fileName = file.name;
        // Look for patterns like "7209" in Cal file names or "3079" in AmEx file names
        // Example: פירוט חיובים לכרטיס דיינרס מסטרקארד 7209 - 02.08.25.xlsx
        // Example: 3079_08_2025.xlsx
        const match = fileName.match(/(\d{4})/);
        if (match && match[1]) {
          setPaymentIdentifier(match[1]);
        }
      }
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

    // Clear any previous upload state before starting new upload
    setShowTransactionReview(false);
    setReviewTransactions([]);
    setReviewFileSource('');
    setUploadResult(null);
    setCurrentStep(1); // Set to progress tracking step

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
    console.log('🔍 Current fileSource:', fileSource);
    console.log('🔍 Result fileSource:', result.fileSource);
    console.log('🔍 Result needs_transaction_review:', result.needs_transaction_review);
    console.log('🔍 Result transactions:', result.transactions?.length || 0);
    console.log('🔍 Current step:', currentStep);
    
    // Prevent processing if we're already in completion step or finalizing
    if (currentStep === 4 || isFinalizingImport || isFinalizingImportRef.current || showTransactionReview) {
      console.log('⏭️ Already completed upload (step 4) or finalizing import or transaction review modal is open, skipping duplicate call');
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
    } else if (result.needs_transaction_review && result.transactions) {
      // Transaction review needed (including files with duplicates)
      if (result.has_duplicates) {
        console.log('🔄 Transaction review with duplicates detected, showing unified modal');
      } else {
        console.log('🔄 Non-BudgetLens file detected, showing transaction review modal');
      }
      setReviewTransactions(result.transactions);
      setReviewFileSource(result.fileSource || fileSource);
      setShowTransactionReview(true);
    } else if (result.has_duplicates && (result.duplicates_temp_id || result.temp_duplicates_id)) {
      // Legacy duplicates flow - should not happen with new integrated approach
      const tempId = result.duplicates_temp_id || result.temp_duplicates_id;
      console.log('🔄 Legacy duplicates detected, moving to review step with tempId:', tempId);
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
    console.log('🌍 Currency selected:', currency, 'for fileSource:', fileSource);
    
    // Prepare data for duplicate check or final import
    const data = {
      uploadId,
      selectedCurrency: currency,
      cashFlowId: selectedCashFlow,
      fileSource: fileSource
    };
    
    console.log('📊 Checking for duplicates with data:', data);
    
    // Check for duplicates with selected currency
    uploadAPI.checkDuplicates(data).then(result => {
      console.log('🔍 Duplicate check result:', result);
      
      if (result.duplicates && Object.keys(result.duplicates).length > 0) {
        console.log('⚠️ Duplicates found, moving to duplicates review');
        setDuplicates(result.duplicates);
        setCurrentStep(3);
      } else {
        console.log('✅ No duplicates found, proceeding to final import');
        finalizeImport(result);
      }
    }).catch(error => {
      console.error('❌ Error checking duplicates:', error);
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
    
    // Clear transaction review state
    setShowTransactionReview(false);
    setReviewTransactions([]);
    setReviewFileSource('');
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

  // Handle transaction review modal
  const handleTransactionReviewConfirm = async (reviewData) => {
    try {
      setShowTransactionReview(false);
      setReviewTransactions([]); // Clear review transactions
      setReviewFileSource(''); // Clear file source
      
      // Debug: Check uploadId before sending
      console.log(`🔍 [FRONTEND DEBUG] uploadId before finalize:`, uploadId);
      console.log(`🔍 [FRONTEND DEBUG] selectedCashFlow:`, selectedCashFlow);
      
      // Send reviewed transactions to backend for final import
      const finalData = {
        uploadId,
        transactions: reviewData.transactions,
        deletedIndices: reviewData.deletedIndices,
        cashFlowId: reviewData.cashFlowId || selectedCashFlow,
        fileSource: reviewFileSource,
        duplicateActions: reviewData.duplicateActions || {}
      };
      
      console.log(`🔍 [FRONTEND DEBUG] finalData:`, finalData);
      
      // Debug: Check recipient_name in transactions being sent
      reviewData.transactions.forEach((tx, index) => {
        if (tx.business_name && tx.business_name.includes('PAYBOX')) {
          console.log(`🎯 [FRONTEND DEBUG] Sending transaction ${index}:`, {
            business_name: tx.business_name,
            recipient_name: tx.recipient_name,
            amount: tx.amount,
            notes: tx.notes
          });
        }
      });
      
      // Debug: Check duplicateActions being sent
      console.log(`🎯 [FRONTEND DEBUG] Sending duplicateActions:`, reviewData.duplicateActions);
      
      finalImportMutation.mutate(finalData);
    } catch (error) {
      console.error('Error confirming transaction review:', error);
      setUploadResult({
        success: false,
        error: 'שגיאה באישור העסקאות'
      });
    }
  };

  const handleTransactionReviewCancel = () => {
    setShowTransactionReview(false);
    setReviewTransactions([]);
    setReviewFileSource('');
    setUploadId(null); // Clear upload ID to stop progress tracking
    handleBackToUpload();
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
    <div className="min-h-screen bg-gray-50 p-4 md:p-8 font-['Heebo']">
      <div className="max-w-5xl mx-auto">
        {/* Modern Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-8">
          <div className="mb-6 md:mb-0">
            <h1 className="text-4xl font-bold text-gray-900 mb-3">
              העלאת קבצי בנק
            </h1>
            <p className="text-gray-600 text-lg">העלה קבצי Excel או CSV מהבנק לייבוא אוטומטי של תנועות</p>
          </div>
          <div className="flex-shrink-0">
            <button
              className="inline-flex items-center gap-2 px-6 py-3 bg-white text-gray-700 font-medium rounded-xl border border-gray-200 hover:bg-gray-50 hover:border-gray-300 transition-all duration-200 shadow-sm hover:shadow-md"
              onClick={() => window.location.href = '/upload/file-merger'}
            >
              🔗 מיזוג קבצים
            </button>
          </div>
        </div>

        {/* Upload Stepper */}
        {currentStep > 0 && (
          <div className="mb-8">
            <UploadStepper currentStep={currentStep} steps={steps} />
          </div>
        )}
        {/* Step 0: Initial Upload */}
        {currentStep === 0 && (
          <div className="space-y-8">
            <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
              <div className="bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200 px-6 py-4">
                <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                  📂 העלאת קובץ
                </h3>
              </div>
              <div className="p-8">
                {/* Modern File Drop Zone */}
                <div
                  className={`relative border-2 border-dashed rounded-lg p-6 text-center transition-all duration-200 cursor-pointer ${
                    isDragOver 
                      ? 'border-gray-400 bg-gray-50' 
                      : selectedFile 
                      ? 'border-gray-400 bg-gray-50' 
                      : 'border-gray-300 bg-white hover:border-gray-400 hover:bg-gray-50'
                  }`}
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                >
                  {selectedFile ? (
                    <div className="flex items-center justify-between p-6 bg-white rounded-xl border border-green-200 shadow-sm">
                      <div className="flex items-center gap-4">
                        <div className="text-5xl">📄</div>
                        <div className="text-right">
                          <div className="font-semibold text-gray-900 text-lg">{selectedFile.name}</div>
                          <div className="text-green-600 font-medium">{formatFileSize(selectedFile.size)}</div>
                        </div>
                      </div>
                      <button
                        className="px-4 py-2 text-red-600 bg-red-50 hover:bg-red-100 rounded-lg font-medium transition-colors duration-200 border border-red-200 hover:border-red-300"
                        onClick={() => setSelectedFile(null)}
                      >
                        הסר
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="text-4xl text-gray-400">📁</div>
                      <div>
                        <p className="text-base text-gray-700 mb-2">
                          גרור קובץ לכאן או{' '}
                          <button 
                            className="text-gray-700 underline hover:text-gray-900" 
                            onClick={() => document.getElementById('file-input').click()}
                          >
                            בחר קובץ
                          </button>
                        </p>
                        <p className="text-gray-500 text-sm">קבצי Excel (.xlsx, .xls) או CSV</p>
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

                {/* Modern Cash Flow Selection */}
                <div className="space-y-2 mb-10">
                  <label className="text-base font-semibold text-gray-800 flex items-center gap-2">
                    💰 תזרים מזומנים
                  </label>
                  <select
                    className="w-full p-3 text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-500 focus:border-gray-500 transition-all duration-200 bg-white shadow-sm"
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

                {/* Modern Date suggestion message */}
                {selectedCashFlow && latestTransactionInfo?.latestTransactionDate && (
                  <div className="bg-gradient-to-br from-pink-400 via-purple-500 to-red-500 rounded-2xl p-8 text-white text-center shadow-2xl border border-white/20">
                    <div className="text-2xl mb-3">
                      📅 ✨
                    </div>
                    <div className="text-lg font-medium mb-4">
                      התאריך האחרון של התזרים "{latestTransactionInfo.cashFlowName}" הוא{' '}
                      <strong className="font-bold">{formatDateForDisplay(latestTransactionInfo.latestTransactionDate)}</strong>
                    </div>
                    <div className="text-sm mb-6 opacity-90">
                      אז מאיזה תאריך אתה רוצה להעלות את הנתונים? 🤔
                    </div>
                    <div className="flex gap-3 justify-center flex-wrap">
                      <button
                        type="button"
                        onClick={() => {
                          setDateFilterEnabled(true);
                          handleUseSameDate();
                        }}
                        className="px-6 py-3 bg-white/25 border-2 border-white/40 rounded-xl text-white font-semibold text-sm backdrop-blur-md shadow-lg hover:bg-white/35 hover:scale-105 transition-all duration-300"
                      >
                        📅 מאותו יום ({formatDateForDisplay(latestTransactionInfo.latestTransactionDate)})
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setDateFilterEnabled(true);
                          handleUseNextDay();
                        }}
                        className="px-6 py-3 bg-white/25 border-2 border-white/40 rounded-xl text-white font-semibold text-sm backdrop-blur-md shadow-lg hover:bg-white/35 hover:scale-105 transition-all duration-300"
                      >
                        🗓️ מהיום שאחרי ({latestTransactionInfo?.latestTransactionDate ? formatDateForDisplay(addOneDay(latestTransactionInfo.latestTransactionDate)) : ''})
                      </button>
                      <button
                        type="button"
                        onClick={handleUploadAll}
                        className="px-6 py-3 bg-white/25 border-2 border-white/40 rounded-xl text-white font-semibold text-sm backdrop-blur-md shadow-lg hover:bg-white/35 hover:scale-105 transition-all duration-300"
                      >
                        📤 העלה הכל
                      </button>
                    </div>
                  </div>
                )}

                {/* Modern Loading message */}
                {selectedCashFlow && loadingLatestDate && (
                  <div className="bg-gradient-to-r from-blue-400 to-cyan-400 rounded-2xl p-6 text-white text-center shadow-xl border border-white/20">
                    <div className="flex items-center justify-center gap-3">
                      <LoadingSpinner size="small" />
                      <span className="text-lg font-medium">בודק את התאריך האחרון...</span>
                    </div>
                  </div>
                )}

                {/* Modern No transactions message */}
                {selectedCashFlow && latestTransactionInfo && !latestTransactionInfo.latestTransactionDate && (
                  <div className="bg-gradient-to-br from-yellow-200 via-orange-200 to-red-200 rounded-2xl p-8 text-amber-800 text-center shadow-xl border border-amber-300/50">
                    <div className="text-3xl mb-4">
                      🎉 ✨
                    </div>
                    <div className="text-xl font-semibold">
                      זה התזרים הראשון שלך! בחר תאריך התחלה לייבוא 📅
                    </div>
                  </div>
                )}

                {/* Modern Upload Settings Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                      🏢 מקור הקבצים
                    </label>
                    <select
                      className="w-full p-2.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-white"
                      value={fileSource}
                      onChange={(e) => setFileSource(e.target.value)}
                    >
                      <option value="other">כללי</option>
                      <option value="isracard">ישראכרט</option>
                      <option value="bank_yahav">בנק יהב</option>
                      <option value="budgetlens">BudgetLens</option>
                      <option value="cal">כאל</option>
                      <option value="max">מקס</option>
                      <option value="americanexpress">American Express</option>
                      <option value="blink">blink</option>
                      <option value="bank_scraper">Bank Scraper</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                      💳 אמצעי תשלום (אופציונלי)
                    </label>
                    {loadingDropdowns ? (
                      <div className="w-full p-2.5 text-sm border border-gray-300 rounded-md flex items-center justify-center bg-gray-50">
                        <LoadingSpinner size="small" />
                      </div>
                    ) : (
                      <select
                        className="w-full p-2.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-white"
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
                        className="w-full p-2.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-white mt-2"
                        placeholder="הכנס אמצעי תשלום אחר..."
                        onChange={(e) => setPaymentMethod(e.target.value)}
                      />
                    )}
                  </div>
                  {fileSource !== 'max' && (
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                        🔢 זיהוי תשלום (אופציונלי)
                      </label>
                    {loadingDropdowns ? (
                      <div className="w-full p-2.5 text-sm border border-gray-300 rounded-md flex items-center justify-center bg-gray-50">
                        <LoadingSpinner size="small" />
                      </div>
                    ) : (
                      <select
                        className="w-full p-2.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-white"
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
                        className="w-full p-2.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-white mt-2"
                        placeholder="הכנס זיהוי תשלום אחר..."
                        onChange={(e) => setPaymentIdentifier(e.target.value)}
                      />
                    )}
                    </div>
                  )}
                </div>

                {/* Modern Date Filter Section */}
                <div className="space-y-4">
                  <label className="flex items-center gap-3 cursor-pointer p-4 bg-gray-50 rounded-lg border border-gray-200 hover:bg-gray-100 transition-colors duration-200">
                    <input
                      type="checkbox"
                      className="w-5 h-5 text-gray-600 bg-white border-gray-300 rounded focus:ring-gray-500 focus:ring-2"
                      checked={dateFilterEnabled}
                      onChange={(e) => setDateFilterEnabled(e.target.checked)}
                    />
                    <div>
                      <div className="font-semibold text-gray-800 flex items-center gap-2">
                        📅 סינון לפי תאריך (אופציונלי)
                      </div>
                      <p className="text-sm text-gray-600">
                        בחר באפשרות זו כדי לייבא רק נתונים מטווח תאריכים מסוים
                      </p>
                    </div>
                  </label>
                </div>

                {dateFilterEnabled && (
                  <div className="space-y-6">
                    {/* Modern quick date buttons */}
                    {selectedCashFlow && latestTransactionInfo?.latestTransactionDate && (
                      <div className="bg-gray-100 rounded-lg p-6 text-center border border-gray-200 shadow-sm">
                        <div className="text-lg mb-4 text-gray-700 font-semibold">
                          🔄 עדכון מהיר:
                        </div>
                        <div className="flex gap-3 justify-center flex-wrap">
                          <button
                            type="button"
                            onClick={handleUseSameDate}
                            className="px-4 py-2 bg-gray-800 text-white rounded-lg font-semibold text-sm hover:bg-gray-700 hover:scale-105 transition-all duration-300 shadow-md"
                          >
                            📅 מאותו יום
                          </button>
                          <button
                            type="button"
                            onClick={handleUseNextDay}
                            className="px-4 py-2 bg-gray-800 text-white rounded-lg font-semibold text-sm hover:bg-gray-700 hover:scale-105 transition-all duration-300 shadow-md"
                          >
                            🗓️ מהיום שאחרי
                          </button>
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-sm font-semibold text-gray-700">תאריך התחלה</label>
                        <input
                          type="date"
                          className="w-full p-2.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-gray-500 focus:border-gray-500 transition-all duration-200 bg-white"
                          value={startDate}
                          onChange={(e) => setStartDate(e.target.value)}
                          placeholder="dd/mm/yyyy"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-semibold text-gray-700">תאריך סיום (אופציונלי)</label>
                        <input
                          type="date"
                          className="w-full p-2.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-gray-500 focus:border-gray-500 transition-all duration-200 bg-white"
                          value={endDate}
                          onChange={(e) => setEndDate(e.target.value)}
                          placeholder="dd/mm/yyyy"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          אם לא יצוין - יייבא עד סוף הקובץ
                        </p>
                      </div>
                    </div>
                  </div>
                )}


                {/* Modern Upload Button */}
                <div className="flex justify-center mt-8">
                  <button
                    className={`px-12 py-4 text-lg font-bold rounded-lg transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105 ${
                      !selectedFile || !selectedCashFlow || initialUploadMutation.isLoading
                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                        : 'bg-gray-900 text-white hover:bg-gray-800'
                    }`}
                    onClick={handleUpload}
                    disabled={!selectedFile || !selectedCashFlow || initialUploadMutation.isLoading}
                  >
                    {initialUploadMutation.isLoading ? (
                      <div className="flex items-center gap-3">
                        <LoadingSpinner size="small" />
                        <span>מעלה קובץ...</span>
                      </div>
                    ) : (
                      <span className="flex items-center gap-2">
                        🚀 העלה קובץ
                      </span>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
        
        {/* Step 1: Progress Tracking */}
        {currentStep === 1 && !showTransactionReview && (
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
                    {uploadResult.stats?.replaced > 0 && (
                      <div className="stat-item">
                        <span className="stat-label">הוחלפו:</span>
                        <span className="stat-value success">{uploadResult.stats?.replaced?.toLocaleString() || 0}</span>
                      </div>
                    )}
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
                      <h4>בנק יהב</h4>
                      <p>קבצי אקסל (.xls/.xlsx) מחשבון הבנק</p>
                      <small>עמודות נדרשות: תאריך, אסמכתא, תיאור פעולה, חובה/זכות</small>
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
                    <div className="format-icon">💰</div>
                    <div className="format-info">
                      <h4>American Express</h4>
                      <p>קבצי Excel מכרטיס האשראי American Express</p>
                      <small>עמודות נדרשות: תאריך רכישה, שם בית עסק, סכום חיוב</small>
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

      {/* Transaction Review Modal */}
      <TransactionReviewModal
        isOpen={showTransactionReview}
        onClose={handleTransactionReviewCancel}
        onConfirm={handleTransactionReviewConfirm}
        transactions={reviewTransactions}
        fileSource={reviewFileSource}
        cashFlowId={selectedCashFlow}
      />
    </div>
  );
};

export default Upload;