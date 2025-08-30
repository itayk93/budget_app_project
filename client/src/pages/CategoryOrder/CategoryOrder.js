import React, { useState, useEffect, useCallback } from 'react';

const CategoryOrder = () => {
  const [categories, setCategories] = useState([]);
  const [sharedCategories, setSharedCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState(null);
  const [saveTimeout, setSaveTimeout] = useState(null);

  const SAVE_DELAY = 800;

  const showAlert = (message, type = 'info') => {
    const alertElement = document.createElement('div');
    alertElement.className = `fixed top-5 left-1/2 transform -translate-x-1/2 px-6 py-4 rounded-lg text-white font-medium z-50 ${
      type === 'error' ? 'bg-red-500' : type === 'success' ? 'bg-green-500' : 'bg-blue-500'
    }`;
    alertElement.textContent = message;
    document.body.appendChild(alertElement);
    
    setTimeout(() => {
      alertElement.classList.add('opacity-0');
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
      console.log('🔍 [CATEGORY ORDER] API Response:', data);
      console.log('🔍 [CATEGORY ORDER] Categories count:', data.categories ? data.categories.length : 'undefined');
      console.log('🔍 [CATEGORY ORDER] Shared categories:', data.sharedCategories);
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

  const debouncedSave = useCallback(async (updatedCategories) => {
    console.log('🔍 [DEBOUNCED SAVE] Called with', updatedCategories.length, 'categories');
    
    if (saveTimeout) {
      clearTimeout(saveTimeout);
      console.log('🔍 [DEBOUNCED SAVE] Cleared existing timeout');
    }

    const timeoutId = setTimeout(async () => {
      try {
        console.log('🔍 [DEBOUNCED SAVE] Starting save process');
        setSaving(true);
        const token = localStorage.getItem('token');
        
        const categoryOrders = updatedCategories.map(cat => ({
          id: cat.id,
          display_order: cat.display_order
        }));
        
        console.log('🔍 [DEBOUNCED SAVE] Category orders to send:', categoryOrders);
        
        const response = await fetch('/api/categories/reorder', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ categoryOrders })
        });

        console.log('🔍 [DEBOUNCED SAVE] Response status:', response.status);

        if (!response.ok) {
          const errorText = await response.text();
          console.log('🔍 [DEBOUNCED SAVE] Error response:', errorText);
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        setLastSaved(new Date());
        showAlert('הסדר נשמר בהצלחה', 'success');
        console.log('🔍 [DEBOUNCED SAVE] Successfully saved');
      } catch (err) {
        console.error('Error saving order:', err);
        showAlert('שגיאה בשמירת הסדר', 'error');
      } finally {
        setSaving(false);
      }
    }, SAVE_DELAY);

    setSaveTimeout(timeoutId);
    console.log('🔍 [DEBOUNCED SAVE] Set timeout with delay:', SAVE_DELAY);
  }, [saveTimeout]);

  const updateSharedCategory = async (categoryName, sharedCategory) => {
    try {
      const token = localStorage.getItem('token');
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
          ? { ...cat, show_in_weekly_view: weeklyDisplay, weekly_display: weeklyDisplay }
          : cat
      );
      
      setCategories(updatedCategories);
      showAlert(weeklyDisplay ? 'תצוגה שבועית הופעלה' : 'תצוגה שבועית בוטלה', 'success');
    } catch (err) {
      console.error('Error updating weekly display:', err);
      showAlert('שגיאה בעדכון תצוגה שבועית', 'error');
    }
  };

  const moveCategory = (fromIndex, direction) => {
    console.log('🔍 [MOVE CATEGORY] Called with:', {fromIndex, direction});
    console.log('🔍 [MOVE CATEGORY] Current categories length:', categories.length);
    
    const newCategories = [...categories];
    let toIndex;
    
    switch (direction) {
      case 'top':
        toIndex = 0;
        break;
      case 'up':
        toIndex = Math.max(0, fromIndex - 1);
        break;
      case 'down':
        toIndex = Math.min(categories.length - 1, fromIndex + 1);
        break;
      case 'bottom':
        toIndex = categories.length - 1;
        break;
      default:
        return;
    }
    
    if (fromIndex === toIndex) {
      console.log('🔍 [MOVE CATEGORY] No change needed - same position');
      return;
    }
    
    console.log('🔍 [MOVE CATEGORY] Moving from', fromIndex, 'to', toIndex);
    
    const [movedItem] = newCategories.splice(fromIndex, 1);
    newCategories.splice(toIndex, 0, movedItem);

    const updatedCategories = newCategories.map((cat, index) => ({
      ...cat,
      display_order: index
    }));

    console.log('🔍 [MOVE CATEGORY] Updated categories:', updatedCategories.map(c => `${c.category_name || c.name}(${c.display_order})`));
    
    setCategories(updatedCategories);
    console.log('🔍 [MOVE CATEGORY] About to call debouncedSave');
    debouncedSave(updatedCategories);
  };

  const moveToPosition = (fromIndex) => {
    const position = prompt('הזן מיקום חדש (1-' + categories.length + '):');
    const newIndex = parseInt(position) - 1;
    
    if (!isNaN(newIndex) && newIndex >= 0 && newIndex < categories.length && newIndex !== fromIndex) {
      const newCategories = [...categories];
      const [movedItem] = newCategories.splice(fromIndex, 1);
      newCategories.splice(newIndex, 0, movedItem);

      const updatedCategories = newCategories.map((cat, index) => ({
        ...cat,
        display_order: index
      }));

      setCategories(updatedCategories);
      debouncedSave(updatedCategories);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 text-lg">טוען קטגוריות...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center bg-white p-8 rounded-lg shadow-lg">
          <h2 className="text-2xl font-bold text-red-600 mb-4">שגיאה</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button 
            onClick={fetchCategories} 
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            נסה שוב
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6" dir="rtl">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h1 className="text-3xl font-bold text-gray-800 text-center mb-2">
            ניהול סדר קטגוריות
          </h1>
          <p className="text-gray-600 text-center mb-4">
            השתמש בכפתורים כדי לשנות את סדר הקטגוריות
          </p>
          
          {/* Status Bar */}
          <div className="flex justify-center items-center gap-4 flex-wrap">
            {saving && (
              <div className="flex items-center gap-2 bg-yellow-100 text-yellow-800 px-4 py-2 rounded-lg">
                <div className="animate-spin h-4 w-4 border-2 border-yellow-600 border-t-transparent rounded-full"></div>
                <span>שומר...</span>
              </div>
            )}
            {lastSaved && !saving && (
              <div className="bg-green-100 text-green-800 px-4 py-2 rounded-lg text-sm">
                נשמר לאחרונה: {lastSaved.toLocaleTimeString('he-IL')}
              </div>
            )}
          </div>
        </div>

        {/* Shared Categories */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-3">קטגוריות משותפות קיימות:</h3>
          <div className="flex flex-wrap gap-2">
            {sharedCategories.length > 0 ? (
              sharedCategories.map(shared => (
                <span key={shared} className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium">
                  {shared}
                </span>
              ))
            ) : (
              <span className="text-gray-500 italic text-sm">אין קטגוריות משותפות</span>
            )}
          </div>
        </div>

        {/* Categories List */}
        <div className="space-y-4">
          {(categories || []).map((category, index) => (
            <div key={category.id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-center">
                
                {/* Category Info */}
                <div className="lg:col-span-2">
                  <div className="flex items-center gap-3 mb-3">
                    <h3 className="text-lg font-semibold text-gray-800">
                      {category.category_name || category.name}
                    </h3>
                    <span className="bg-blue-600 text-white px-2 py-1 rounded text-sm font-medium">
                      #{index + 1}
                    </span>
                  </div>
                  
                  <div className="flex flex-wrap items-center gap-4 mb-4">
                    <span className="bg-gray-100 text-gray-600 px-3 py-1 rounded text-sm">
                      {category.transaction_count || 0} עסקאות
                    </span>
                    {category.shared_category && (
                      <span className="bg-green-100 text-green-800 px-3 py-1 rounded text-sm font-medium">
                        🏷️ {category.shared_category}
                      </span>
                    )}
                  </div>

                  {/* Shared Category Dropdown */}
                  <div className="mb-4">
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
                      className="w-full max-w-xs border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="">בחר קטגוריה משותפת</option>
                      {sharedCategories.map(shared => (
                        <option key={shared} value={shared}>{shared}</option>
                      ))}
                      <option value="custom">➕ הוסף חדש...</option>
                    </select>
                  </div>

                  {/* Weekly Display Checkbox */}
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={category.show_in_weekly_view || category.weekly_display || false}
                      onChange={(e) => updateWeeklyDisplay(category.category_name || category.name, e.target.checked)}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700">תצוגה שבועית</span>
                  </label>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-wrap gap-2 justify-end">
                  <button
                    onClick={() => moveCategory(index, 'top')}
                    disabled={index === 0}
                    className="px-3 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium transition-colors"
                    title="העבר לראש"
                  >
                    ⬆️⬆️
                  </button>
                  <button
                    onClick={() => moveCategory(index, 'up')}
                    disabled={index === 0}
                    className="px-3 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium transition-colors"
                    title="העבר למעלה"
                  >
                    ⬆️
                  </button>
                  <button
                    onClick={() => moveCategory(index, 'down')}
                    disabled={index === categories.length - 1}
                    className="px-3 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium transition-colors"
                    title="העבר למטה"
                  >
                    ⬇️
                  </button>
                  <button
                    onClick={() => moveCategory(index, 'bottom')}
                    disabled={index === categories.length - 1}
                    className="px-3 py-2 bg-orange-500 text-white rounded hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium transition-colors"
                    title="העבר לסוף"
                  >
                    ⬇️⬇️
                  </button>
                  <button
                    onClick={() => moveToPosition(index)}
                    className="px-3 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 text-sm font-medium transition-colors"
                    title="העבר למיקום ספציפי"
                  >
                    📍
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {categories.length === 0 && (
          <div className="bg-white rounded-lg shadow-sm p-12 text-center">
            <div className="text-6xl mb-4 opacity-70">📋</div>
            <h3 className="text-xl font-semibold text-gray-800 mb-2">אין קטגוריות</h3>
            <p className="text-gray-600">נראה שאין לך קטגוריות עדיין</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default CategoryOrder;