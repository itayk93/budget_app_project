import React, { useState } from 'react';
import api from '../../services/api';

const BlinkUpload = ({ onUploadComplete, cashFlowId }) => {
    const [isUploading, setIsUploading] = useState(false);
    const [uploadResult, setUploadResult] = useState(null);
    const [dragActive, setDragActive] = useState(false);

    const handleFileUpload = async (file) => {
        if (!file) return;

        // Validate file type
        const allowedTypes = ['.xlsx', '.xls'];
        const fileName = file.name.toLowerCase();
        const isValidFile = allowedTypes.some(type => fileName.endsWith(type));

        if (!isValidFile) {
            setUploadResult({
                success: false,
                error: 'רק קבצי Excel (.xlsx, .xls) מותרים לעלייה'
            });
            return;
        }

        if (!cashFlowId) {
            setUploadResult({
                success: false,
                error: 'נא לבחור חשבון השקעות'
            });
            return;
        }

        setIsUploading(true);
        setUploadResult(null);

        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('cash_flow_id', cashFlowId);
            formData.append('force_import', 'false');

            const response = await api.post('/upload/blink-stocks', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
                timeout: 60000 // 60 seconds timeout
            });

            setUploadResult({
                success: true,
                message: response.data.message,
                stats: response.data.stats
            });

            // Call parent callback if provided
            if (onUploadComplete) {
                onUploadComplete(response.data);
            }

        } catch (error) {
            console.error('Blink upload error:', error);
            
            let errorMessage = 'שגיאה בהעלאת הקובץ';
            if (error.response?.data?.details) {
                errorMessage = error.response.data.details;
            } else if (error.response?.data?.error) {
                errorMessage = error.response.data.error;
            } else if (error.message) {
                errorMessage = error.message;
            }

            setUploadResult({
                success: false,
                error: errorMessage
            });
        } finally {
            setIsUploading(false);
        }
    };

    const handleDrop = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);

        const files = e.dataTransfer.files;
        if (files && files.length > 0) {
            handleFileUpload(files[0]);
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
            handleFileUpload(files[0]);
        }
    };

    return (
        <div className="blink-upload-component">
            <div className="card">
                <div className="card-header">
                    <h5 className="mb-0">
                        <i className="fas fa-upload me-2"></i>
                        העלאת קובץ Blink
                    </h5>
                    <small className="text-muted">
                        העלה קובץ Excel של עסקאות מניות מ-Blink
                    </small>
                </div>
                
                <div className="card-body">
                    {!cashFlowId && (
                        <div className="alert alert-warning">
                            <i className="fas fa-exclamation-triangle me-2"></i>
                            נא לבחור חשבון השקעות לפני העלאת הקובץ
                        </div>
                    )}

                    <div 
                        className={`upload-drop-zone ${dragActive ? 'drag-active' : ''} ${!cashFlowId ? 'disabled' : ''}`}
                        onDrop={handleDrop}
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                    >
                        <div className="upload-content">
                            <i className="fas fa-cloud-upload-alt upload-icon"></i>
                            
                            {isUploading ? (
                                <div className="uploading-state">
                                    <div className="spinner-border text-primary" role="status">
                                        <span className="visually-hidden">טוען...</span>
                                    </div>
                                    <p className="mt-2 mb-0">מעלה קובץ Blink...</p>
                                </div>
                            ) : (
                                <div className="upload-prompt">
                                    <h6>גרור קובץ Excel לכאן או לחץ לבחירה</h6>
                                    <p className="text-muted">
                                        קבצי Excel בלבד (.xlsx, .xls)
                                    </p>
                                    <input
                                        type="file"
                                        id="blinkFileInput"
                                        className="d-none"
                                        accept=".xlsx,.xls"
                                        onChange={handleFileInputChange}
                                        disabled={!cashFlowId || isUploading}
                                    />
                                    <label 
                                        htmlFor="blinkFileInput" 
                                        className={`btn btn-outline-primary ${!cashFlowId ? 'disabled' : ''}`}
                                    >
                                        <i className="fas fa-file-excel me-2"></i>
                                        בחר קובץ
                                    </label>
                                </div>
                            )}
                        </div>
                    </div>

                    {uploadResult && (
                        <div className={`alert ${uploadResult.success ? 'alert-success' : 'alert-danger'} mt-3`}>
                            <div className="d-flex align-items-start">
                                <i className={`fas ${uploadResult.success ? 'fa-check-circle' : 'fa-exclamation-circle'} me-2 mt-1`}></i>
                                <div className="flex-grow-1">
                                    {uploadResult.success ? (
                                        <div>
                                            <strong>הקובץ הועלה בהצלחה!</strong>
                                            <p className="mb-2">{uploadResult.message}</p>
                                            {uploadResult.stats && (
                                                <div className="upload-stats">
                                                    <small className="d-block">
                                                        <strong>סטטיסטיקות:</strong>
                                                    </small>
                                                    <small className="d-block">
                                                        • עסקאות עובדו: {uploadResult.stats.transactionsProcessed}
                                                    </small>
                                                    <small className="d-block">
                                                        • עסקאות נשמרו: {uploadResult.stats.transactionsSaved}
                                                    </small>
                                                    {uploadResult.stats.duplicatesFound > 0 && (
                                                        <small className="d-block text-warning">
                                                            • כפילות נמצאו: {uploadResult.stats.duplicatesFound}
                                                        </small>
                                                    )}
                                                    {uploadResult.stats.errors > 0 && (
                                                        <small className="d-block text-danger">
                                                            • שגיאות: {uploadResult.stats.errors}
                                                        </small>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <div>
                                            <strong>שגיאה בהעלאת הקובץ</strong>
                                            <p className="mb-0">{uploadResult.error}</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="upload-instructions mt-3">
                        <h6 className="mb-2">הוראות:</h6>
                        <ul className="list-unstyled">
                            <li><i className="fas fa-check text-success me-2"></i>וודא שהקובץ מכיל עסקאות מניות מ-Blink</li>
                            <li><i className="fas fa-check text-success me-2"></i>הקובץ צריך להיות בפורמט Excel (.xlsx או .xls)</li>
                            <li><i className="fas fa-check text-success me-2"></i>העסקאות יתווספו לחשבון ההשקעות הנבחר</li>
                            <li><i className="fas fa-check text-success me-2"></i>המערכת תזהה כפילות באופן אוטומטי</li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default BlinkUpload;