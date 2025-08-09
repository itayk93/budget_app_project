import React, { useState, useEffect, useCallback } from 'react';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';
import './CategoryOrder.css';

// Suppress react-beautiful-dnd defaultProps warning
const originalError = console.error;
console.error = (...args) => {
  if (typeof args[0] === 'string' && args[0].includes('defaultProps will be removed from memo components')) {
    return;
  }
  originalError.apply(console, args);
};

const CategoryOrder = () => {
  const [categories, setCategories] = useState([]);
  const [sharedCategories, setSharedCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState(null);
  const [saveTimeout, setSaveTimeout] = useState(null);
  const [retryCount, setRetryCount] = useState(0);

  const MAX_RETRY_ATTEMPTS = 3;
  const SAVE_DELAY = 800;

  const showAlert = (message, type = 'info') => {
    const alertClass = type === 'error' ? 'alert-error' : type === 'success' ? 'alert-success' : 'alert-info';
    const alertElement = document.createElement('div');
    alertElement.className = `alert ${alertClass}`;
    alertElement.textContent = message;
    document.body.appendChild(alertElement);
    
    setTimeout(() => {
      alertElement.classList.add('fade-out');
      setTimeout(() => {
        if (document.body.contains(alertElement)) {
          document.body.removeChild(alertElement);
        }
      }, 300);
    }, 3000);
  };

  const fetchCategories = useCallback(async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await fetch('/api/categories/order', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      setCategories(data.categories || []);
      setSharedCategories(data.sharedCategories || []);
      setError(null);
    } catch (err) {
      console.error('Error fetching categories:', err);
      setError('שגיאה בטעינת הקטגוריות');
      showAlert('שגיאה בטעינת הקטגוריות', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  const debouncedSave = useCallback(async (updatedCategories, retryAttempt = 0) => {
    if (saveTimeout) {
      clearTimeout(saveTimeout);
    }

    const timeoutId = setTimeout(async () => {
      try {
        setSaving(true);
        const token = localStorage.getItem('token');
        const response = await fetch('/api/categories/reorder', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ categories: updatedCategories })
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        setLastSaved(new Date());
        setRetryCount(0);
        showAlert('הסדר נשמר בהצלחה', 'success');
      } catch (err) {
        console.error('Error saving order:', err);
        
        if (retryAttempt < MAX_RETRY_ATTEMPTS) {
          setRetryCount(retryAttempt + 1);
          showAlert(`שגיאה בשמירה, מנסה שוב... (ניסיון ${retryAttempt + 1}/${MAX_RETRY_ATTEMPTS})`, 'error');
          setTimeout(() => {
            debouncedSave(updatedCategories, retryAttempt + 1);
          }, 1000 * (retryAttempt + 1));
        } else {
          showAlert('שגיאה בשמירת הסדר', 'error');
          setRetryCount(0);
        }
      } finally {
        setSaving(false);
      }
    }, retryAttempt === 0 ? SAVE_DELAY : 0);

    setSaveTimeout(timeoutId);
  }, [saveTimeout]);

  const updateSharedCategory = async (categoryName, sharedCategory) => {
    try {
      const token = localStorage.getItem('token');
      
      // Find the category to get its ID
      const category = categories.find(cat => (cat.category_name || cat.name) === categoryName);
      if (!category) {
        throw new Error('Category not found');
      }
      
      const response = await fetch('/api/categories/update-shared-category', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          categoryId: category.id, 
          sharedCategoryName: sharedCategory || null 
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const updatedCategories = categories.map(cat => 
        (cat.category_name || cat.name) === categoryName 
          ? { ...cat, shared_category: sharedCategory || null }
          : cat
      );
      
      setCategories(updatedCategories);
      
      const newSharedCategories = [...new Set(
        updatedCategories
          .map(cat => cat.shared_category)
          .filter(Boolean)
      )];
      setSharedCategories(newSharedCategories);
      
      showAlert('קטגוריה משותפת עודכנה', 'success');
    } catch (err) {
      console.error('Error updating shared category:', err);
      showAlert('שגיאה בעדכון קטגוריה משותפת', 'error');
    }
  };

  const updateWeeklyDisplay = async (categoryName, weeklyDisplay) => {
    try {
      const token = localStorage.getItem('token');
      
      // Find the category to get its ID
      const category = categories.find(cat => (cat.category_name || cat.name) === categoryName);
      if (!category) {
        throw new Error('Category not found');
      }
      
      const response = await fetch('/api/categories/update-weekly-display', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          categoryId: category.id, 
          showInWeeklyView: weeklyDisplay 
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const updatedCategories = categories.map(cat => 
        (cat.category_name || cat.name) === categoryName 
          ? { ...cat, show_in_weekly_view: weeklyDisplay }
          : cat
      );
      
      setCategories(updatedCategories);
      
      showAlert(weeklyDisplay ? 'תצוגה שבועית הופעלה' : 'תצוגה שבועית בוטלה', 'success');
    } catch (err) {
      console.error('Error updating weekly display:', err);
      showAlert('שגיאה בעדכון תצוגה שבועית', 'error');
    }
  };

  const onDragEnd = (result) => {
    if (!result.destination) return;

    const items = Array.from(categories);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    const updatedCategories = items.map((cat, index) => ({
      ...cat,
      display_order: index + 1
    }));

    setCategories(updatedCategories);
    debouncedSave(updatedCategories);
  };

  const moveCategory = (fromIndex, toIndex) => {
    const items = Array.from(categories);
    const [movedItem] = items.splice(fromIndex, 1);
    items.splice(toIndex, 0, movedItem);

    const updatedCategories = items.map((cat, index) => ({
      ...cat,
      display_order: index + 1
    }));

    setCategories(updatedCategories);
    debouncedSave(updatedCategories);
  };

  const moveToTop = (index) => moveCategory(index, 0);
  const moveToBottom = (index) => moveCategory(index, categories.length - 1);
  const moveUp = (index) => index > 0 && moveCategory(index, index - 1);
  const moveDown = (index) => index < categories.length - 1 && moveCategory(index, index + 1);

  const moveToPosition = (fromIndex) => {
    const position = prompt('הזן מיקום חדש (1-' + categories.length + '):');
    const newIndex = parseInt(position) - 1;
    
    if (!isNaN(newIndex) && newIndex >= 0 && newIndex < categories.length && newIndex !== fromIndex) {
      moveCategory(fromIndex, newIndex);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  if (loading) {
    return (
      <div className="category-order-container">
        <div className="loading-spinner">
          <div className="spinner"></div>
          <p>טוען קטגוריות...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="category-order-container">
        <div className="error-container">
          <h2>שגיאה</h2>
          <p>{error}</p>
          <button onClick={fetchCategories} className="retry-button">
            נסה שוב
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="category-order-container">
      <div className="header-section">
        <h1>ניהול סדר קטגוריות</h1>
        <p className="subtitle">גרור ושחרר או השתמש בכפתורים לשינוי סדר הקטגוריות</p>
        
        <div className="status-bar">
          {saving && (
            <div className="saving-indicator">
              <div className="saving-spinner"></div>
              <span>שומר...</span>
              {retryCount > 0 && <span className="retry-text">(ניסיון {retryCount})</span>}
            </div>
          )}
          {lastSaved && !saving && (
            <div className="last-saved">
              נשמר לאחרונה: {lastSaved.toLocaleTimeString('he-IL')}
            </div>
          )}
        </div>
      </div>

      <div className="controls-section">
        <div className="shared-categories-section">
          <h3>קטגוריות משותפות קיימות:</h3>
          <div className="shared-tags">
            {sharedCategories.length > 0 ? (
              sharedCategories.map(shared => (
                <span key={shared} className="shared-tag">{shared}</span>
              ))
            ) : (
              <span className="no-shared">אין קטגוריות משותפות</span>
            )}
          </div>
        </div>
      </div>

      <DragDropContext onDragEnd={onDragEnd}>
        <Droppable droppableId="categories">
          {(provided, snapshot) => (
            <div
              {...provided.droppableProps}
              ref={provided.innerRef}
              className={`categories-list ${snapshot.isDraggingOver ? 'dragging-over' : ''}`}
            >
              {(categories || []).filter(category => category && (category.category_name || category.name)).map((category, index) => (
                <Draggable
                  key={category.category_name || category.name}
                  draggableId={category.category_name || category.name}
                  index={index}
                >
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.draggableProps}
                      className={`category-item ${snapshot.isDragging ? 'dragging' : ''}`}
                    >
                      <div className="category-content">
                        <div 
                          {...provided.dragHandleProps}
                          className="drag-handle"
                          title="גרור לשינוי מיקום"
                        >
                          ⋮⋮
                        </div>
                        
                        <div className="category-info">
                          <div className="category-header">
                            <span className="category-name">{category.category_name || category.name}</span>
                            <span className="position-badge">#{index + 1}</span>
                          </div>
                          
                          <div className="category-details">
                            <span className="transaction-count">
                              {category.transaction_count || 0} עסקאות
                            </span>
                            {category.shared_category && (
                              <span className="shared-category-badge">
                                🏷️ {category.shared_category}
                              </span>
                            )}
                          </div>

                          <div className="shared-category-controls">
                            <select
                              value={category.shared_category || ''}
                              onChange={(e) => {
                                if (e.target.value === 'custom') {
                                  const customValue = prompt('הזן קטגוריה משותפת חדשה:');
                                  if (customValue) {
                                    updateSharedCategory(category.category_name || category.name, customValue);
                                  }
                                } else {
                                  updateSharedCategory(category.category_name || category.name, e.target.value);
                                }
                              }}
                              className="shared-select"
                            >
                              <option value="">בחר קטגוריה משותפת</option>
                              {sharedCategories.map(shared => (
                                <option key={shared} value={shared}>{shared}</option>
                              ))}
                              <option value="custom">➕ הוסף חדש...</option>
                            </select>
                          </div>

                          <div className="weekly-display-controls">
                            <label className="weekly-checkbox-label">
                              <input
                                type="checkbox"
                                checked={category.show_in_weekly_view || category.weekly_display || false}
                                onChange={(e) => updateWeeklyDisplay(category.category_name || category.name, e.target.checked)}
                                className="weekly-checkbox"
                              />
                              <span className="weekly-checkbox-text">תצוגה שבועית</span>
                            </label>
                          </div>
                        </div>

                        <div className="action-buttons">
                          <div className="primary-actions">
                            <button
                              onClick={() => moveToTop(index)}
                              disabled={index === 0}
                              className="action-btn top-btn"
                              title="העבר לראש"
                            >
                              ⬆️⬆️
                            </button>
                            <button
                              onClick={() => moveUp(index)}
                              disabled={index === 0}
                              className="action-btn up-btn"
                              title="העבר למעלה"
                            >
                              ⬆️
                            </button>
                            <button
                              onClick={() => moveDown(index)}
                              disabled={index === categories.length - 1}
                              className="action-btn down-btn"
                              title="העבר למטה"
                            >
                              ⬇️
                            </button>
                            <button
                              onClick={() => moveToBottom(index)}
                              disabled={index === categories.length - 1}
                              className="action-btn bottom-btn"
                              title="העבר לסוף"
                            >
                              ⬇️⬇️
                            </button>
                          </div>
                          
                          <button
                            onClick={() => moveToPosition(index)}
                            className="action-btn position-btn"
                            title="העבר למיקום ספציפי"
                          >
                            📍
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </Draggable>
              ))}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>

      {categories.length === 0 && (
        <div className="empty-state">
          <div className="empty-icon">📋</div>
          <h3>אין קטגוריות</h3>
          <p>נראה שאין לך קטגוריות עדיין</p>
        </div>
      )}
    </div>
  );
};

export default CategoryOrder;