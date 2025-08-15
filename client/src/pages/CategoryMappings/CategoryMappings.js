import React, { useState, useEffect, useCallback } from 'react';
import { cashFlowsAPI } from '../../services/api';
import './CategoryMappings.css';

const CategoryMappings = () => {
  const [mappings, setMappings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [csvData, setCsvData] = useState(null);
  const [showUpload, setShowUpload] = useState(false);
  const [importing, setImporting] = useState(false);
  const [cashFlows, setCashFlows] = useState([]);
  const [selectedCashFlow, setSelectedCashFlow] = useState(null);
  const [cashFlowsLoading, setCashFlowsLoading] = useState(true);

  const fetchCashFlows = useCallback(async () => {
    try {
      setCashFlowsLoading(true);
      const data = await cashFlowsAPI.getAll();
      setCashFlows(data || []);
      
      // Set default cash flow if available
      if (data && data.length > 0) {
        const defaultFlow = data.find(flow => flow.is_default) || data[0];
        setSelectedCashFlow(current => current ? current : defaultFlow);
      }
    } catch (err) {
      console.error('Error fetching cash flows:', err);
    } finally {
      setCashFlowsLoading(false);
    }
  }, []);

  const fetchMappings = useCallback(async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const url = selectedCashFlow 
        ? `/api/categories/business-mappings?cash_flow_id=${selectedCashFlow.id}`
        : '/api/categories/business-mappings';
        
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      setMappings(data.mappings || []);
      setError(null);
    } catch (err) {
      console.error('Error fetching mappings:', err);
      setError('שגיאה בטעינת נתוני החברות והקטגוריות');
    } finally {
      setLoading(false);
    }
  }, [selectedCashFlow]);

  useEffect(() => {
    fetchCashFlows();
  }, [fetchCashFlows]);

  useEffect(() => {
    if (selectedCashFlow) {
      fetchMappings();
    }
  }, [selectedCashFlow, fetchMappings]);

  const filteredMappings = mappings.filter(mapping => 
    mapping.business_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    mapping.category_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (mapping.business_country && mapping.business_country.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const exportToCSV = () => {
    if (mappings.length === 0) {
      alert('אין נתונים לייצוא');
      return;
    }

    const headers = ['תזרים', 'שם עסק', 'מדינה', 'קטגוריה'];
    const csvContent = [
      headers.join(','),
      ...mappings.map(mapping => 
        [
          mapping.cash_flow_id || '',
          mapping.business_name,
          mapping.business_country || '',
          mapping.category_name
        ].map(field => `"${field}"`)
          .join(',')
      )
    ].join('\n');

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'business_categories.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.csv')) {
      alert('אנא בחר קובץ CSV');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const csv = e.target.result;
        const parsedData = parseCSV(csv);
        setCsvData(parsedData);
      } catch (error) {
        alert('שגיאה בעיבוד הקובץ: ' + error.message);
      }
    };
    reader.readAsText(file, 'UTF-8');
  };

  const parseCSV = (csv) => {
    const lines = csv.split('\n').filter(line => line.trim());
    if (lines.length < 2) {
      throw new Error('הקובץ חייב להכיל לפחות שורת כותרות ושורת נתונים אחת');
    }

    const parseCSVLine = (line) => {
      const result = [];
      let current = '';
      let inQuotes = false;
      
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          result.push(current.trim().replace(/^"/, '').replace(/"$/, ''));
          current = '';
        } else {
          current += char;
        }
      }
      result.push(current.trim().replace(/^"/, '').replace(/"$/, ''));
      return result;
    };

    const headers = parseCSVLine(lines[0]);
    const requiredHeaders = ['שם עסק', 'קטגוריה']; // Only these are required
    
    if (!requiredHeaders.every(header => headers.includes(header))) {
      throw new Error(`הקובץ חייב להכיל לפחות את העמודות הבאות: ${requiredHeaders.join(', ')}`);
    }

    const data = [];
    for (let i = 1; i < lines.length; i++) {
      const values = parseCSVLine(lines[i]);
      if (values.length >= 2) {
        const row = {};
        headers.forEach((header, index) => {
          row[header] = values[index] || '';
        });
        
        if (row['שם עסק'] && row['קטגוריה']) {
          data.push(row);
        }
      }
    }

    if (data.length === 0) {
      throw new Error('לא נמצאו שורות תקינות בקובץ');
    }

    return data;
  };

  const performImport = async () => {
    if (!csvData) return;

    setImporting(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/categories/import-mappings', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          csvData,
          cash_flow_id: selectedCashFlow?.id
        })
      });

      const result = await response.json();
      
      if (result.success) {
        alert(result.message);
        setCsvData(null);
        setShowUpload(false);
        fetchMappings(); // Refresh the data
      } else {
        alert('שגיאה: ' + result.message);
      }
    } catch (error) {
      console.error('Import error:', error);
      alert('שגיאה בייבוא הנתונים');
    } finally {
      setImporting(false);
    }
  };

  const cancelImport = () => {
    setCsvData(null);
    setShowUpload(false);
  };

  if (loading || cashFlowsLoading) {
    return null;
  }

  if (cashFlows.length === 0) {
    return (
      <div className="category-mappings-container">
        <div className="error-container">
          <h2>לא נמצאו תזרימי מזומנים</h2>
          <p>אנא צור תזרים מזומנים כדי להמשיך</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="category-mappings-container">
        <div className="error-container">
          <h2>שגיאה</h2>
          <p>{error}</p>
          <button onClick={fetchMappings} className="retry-button">
            נסה שוב
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="category-mappings-container">
      <div className="header-section">
        <h1>ניהול קטגוריות חברות</h1>
        <p className="subtitle">
          ייצא ויבא קטגוריות עבור חברות בכמות גדולה
          {selectedCashFlow && (
            <span className="selected-flow-info"> - תזרים: {selectedCashFlow.name}</span>
          )}
        </p>
        
        {/* Cash Flow Selector */}
        {cashFlows.length > 1 && (
          <div className="cash-flow-selector">
            <label htmlFor="cashFlowSelect">בחר תזרים מזומנים:</label>
            <select 
              id="cashFlowSelect"
              value={selectedCashFlow?.id || ''}
              onChange={(e) => {
                const selected = cashFlows.find(cf => cf.id === e.target.value);
                setSelectedCashFlow(selected);
              }}
              className="form-control"
            >
              {cashFlows.map(cashFlow => (
                <option key={cashFlow.id} value={cashFlow.id}>
                  {cashFlow.name} ({cashFlow.currency})
                </option>
              ))}
            </select>
          </div>
        )}
        
        <div className="action-buttons">
          <button 
            onClick={exportToCSV} 
            className="btn btn-export"
            disabled={!selectedCashFlow}
          >
            <i className="fas fa-download"></i>
            ייצא ל-CSV
          </button>
          <button 
            onClick={() => setShowUpload(!showUpload)} 
            className="btn btn-import"
            disabled={!selectedCashFlow}
          >
            <i className="fas fa-upload"></i>
            ייבא מ-CSV
          </button>
        </div>
      </div>

      {showUpload && (
        <div className="upload-section">
          <div className="upload-card">
            <h3>ייבוא קטגוריות חברות</h3>
            <div className="upload-instructions">
              <h4>הוראות שימוש:</h4>
              <ol>
                <li>ייצא את הנתונים הנוכחיים ל-CSV (4 עמודות: תזרים, שם עסק, מדינה, קטגוריה)</li>
                <li>ערוך את הקטגוריות ואת המדינות בקובץ</li>
                <li>העלה את הקובץ המעודכן כאן</li>
                <li>הקובץ חייב להכיל לפחות את העמודות: "שם עסק" ו"קטגוריה"</li>
              </ol>
            </div>
            
            <div className="file-upload">
              <input 
                type="file" 
                accept=".csv" 
                onChange={handleFileUpload}
                className="file-input"
              />
            </div>

            {csvData && (
              <div className="csv-preview">
                <h4>תצוגה מקדימה ({csvData.length} שורות):</h4>
                <div className="preview-table">
                  <table>
                    <thead>
                      <tr>
                        <th>תזרים</th>
                        <th>שם עסק</th>
                        <th>מדינה</th>
                        <th>קטגוריה</th>
                      </tr>
                    </thead>
                    <tbody>
                      {csvData.slice(0, 5).map((row, index) => (
                        <tr key={index}>
                          <td>{row['תזרים'] || ''}</td>
                          <td>{row['שם עסק']}</td>
                          <td>{row['מדינה'] || ''}</td>
                          <td>{row['קטגוריה']}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {csvData.length > 5 && (
                    <p className="more-rows">... ועוד {csvData.length - 5} שורות</p>
                  )}
                </div>
                
                <div className="import-actions">
                  <button 
                    onClick={performImport} 
                    disabled={importing}
                    className="btn btn-confirm"
                  >
                    {importing ? 'מייבא...' : 'אשר ויבא'}
                  </button>
                  <button 
                    onClick={cancelImport}
                    className="btn btn-cancel"
                  >
                    ביטול
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="search-section">
        <input 
          type="text"
          placeholder="חיפוש לפי שם חברה, קטגוריה או מדינה..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="search-input"
        />
      </div>

      <div className="mappings-section">
        <div className="mappings-header">
          <h3>רשימת חברות וקטגוריות ({filteredMappings.length})</h3>
        </div>
        
        {filteredMappings.length === 0 ? (
          <div className="no-data">
            <div className="empty-icon">📊</div>
            <h3>אין נתונים להצגה</h3>
            <p>
              {searchTerm 
                ? 'לא נמצאו נתונים מתאימים לחיפוש'
                : selectedCashFlow 
                  ? `לא נמצאו עסקאות עם קטגוריות בתזרים "${selectedCashFlow.name}"`
                  : 'לא נמצאו נתונים'
              }
            </p>
          </div>
        ) : (
          <div className="mappings-table">
            <table>
              <thead>
                <tr>
                  <th>תזרים</th>
                  <th>שם חברה</th>
                  <th>מדינה</th>
                  <th>קטגוריה</th>
                </tr>
              </thead>
              <tbody>
                {filteredMappings.map((mapping, index) => (
                  <tr key={index}>
                    <td>
                      <span className="cash-flow-badge">
                        {cashFlows.find(cf => cf.id === mapping.cash_flow_id)?.name || 'לא ידוע'}
                      </span>
                    </td>
                    <td>{mapping.business_name}</td>
                    <td>{mapping.business_country || 'לא נקבע'}</td>
                    <td>
                      <span className="category-badge">
                        {mapping.category_name}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default CategoryMappings;