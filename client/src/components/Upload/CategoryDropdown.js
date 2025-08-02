import React, { useState, useRef, useEffect } from 'react';
import './CategoryDropdown.css';

const CategoryDropdown = ({ value, onChange, categories = [], placeholder = "בחר קטגוריה..." }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const dropdownRef = useRef(null);

  // Function to categorize a category name into groups
  const getCategoryGroup = (categoryName) => {
    if (!categoryName || typeof categoryName !== 'string') {
      return { name: 'אחר', icon: '📝' };
    }
    const name = categoryName.toLowerCase();
    
    if (name.includes('הכנסה') || name.includes('משכורת') || name.includes('עבודה') || name.includes('פנסיה')) {
      return { name: 'הכנסות', icon: '💰' };
    } else if (name.includes('משכנתא') || name.includes('שכר דירה') || name.includes('ארנונה') || 
               name.includes('חשמל') || name.includes('גז') || name.includes('מים') || 
               name.includes('אינטרנט') || name.includes('טלפון') || name.includes('ביטוח דירה') ||
               name.includes('ועד בית') || name.includes('תיקון')) {
      return { name: 'דיור', icon: '🏠' };
    } else if (name.includes('סופר') || name.includes('אוכל') || name.includes('מסעדה') || 
               name.includes('בגדים') || name.includes('קניות') || name.includes('קוסמטיקה')) {
      return { name: 'הוצאות משתנות', icon: '🛒' };
    } else if (name.includes('דלק') || name.includes('תחבורה') || name.includes('ביטוח רכב') || 
               name.includes('תחזוקת רכב') || name.includes('חנייה') || name.includes('רכב')) {
      return { name: 'תחבורה', icon: '🚗' };
    } else if (name.includes('רופא') || name.includes('תרופות') || name.includes('פארמה') || 
               name.includes('בריאות') || name.includes('רפואה')) {
      return { name: 'בריאות', icon: '🏥' };
    } else if (name.includes('קולנוע') || name.includes('ספורט') || name.includes('חופשות') || 
               name.includes('טיסות') || name.includes('נופש') || name.includes('פנאי') || 
               name.includes('טיסה') || name.includes('ירח דבש')) {
      return { name: 'פנאי ובידור', icon: '🎭' };
    } else if (name.includes('נטפליקס') || name.includes('ספוטיפיי') || name.includes('משחקים') || 
               name.includes('אפליקציות') || name.includes('דיגיטל')) {
      return { name: 'דיגיטל', icon: '💻' };
    } else if (name.includes('לימודים') || name.includes('ספרים') || name.includes('קורסים') || 
               name.includes('חינוך')) {
      return { name: 'חינוך', icon: '🎓' };
    } else if (name.includes('חסכון') || name.includes('השקעות') || name.includes('קרן פנסיה') || 
               name.includes('ביטוח חיים') || name.includes('הפקדות')) {
      return { name: 'חסכון והשקעות', icon: '💎' };
    } else {
      return { name: 'אחר', icon: '📝' };
    }
  };

  // Group categories by type
  const groupedCategories = categories && categories.length > 0 ? categories.reduce((groups, category) => {
    // Make sure category exists and has category_name
    if (!category || !category.category_name) {
      return groups;
    }
    
    const group = getCategoryGroup(category.category_name);
    const groupName = group.name;
    
    if (!groups[groupName]) {
      groups[groupName] = {
        icon: group.icon,
        categories: []
      };
    }
    groups[groupName].categories.push(category);
    return groups;
  }, {}) : {};

  // Predefined category groups as fallback (if no categories from API)
  const categoryGroups = {
    'הכנסות': {
      icon: '💰',
      categories: [
        'הכנסות קבועות',
        'הכנסות משתנות', 
        'משכורת',
        'עבודה נוספת',
        'השקעות',
        'מתנות',
        'החזרי מס',
        'אחר (הכנסות)'
      ]
    },
    'דיור': {
      icon: '🏠',
      categories: [
        'תשלום משכנתא',
        'שכר דירה',
        'ארנונה',
        'חשמל',
        'גז',
        'מים',
        'אינטרנט',
        'טלפון',
        'ביטוח דירה',
        'ועד בית',
        'תיקונים ותחזוקה'
      ]
    },
    'הוצאות משתנות': {
      icon: '🛒',
      categories: [
        'הוצאות משתנות',
        'סופר',
        'אוכל בחוץ',
        'בגדים ונעליים',
        'קניות',
        'קוסמטיקה'
      ]
    },
    'תחבורה': {
      icon: '🚗',
      categories: [
        'תחבורה',
        'דלק',
        'ביטוח רכב',
        'תחזוקת רכב',
        'חנייה',
        'תחבורה ציבורית',
        'רכב ותחבורה ציבורית'
      ]
    },
    'בריאות': {
      icon: '🏥',
      categories: [
        'בריאות',
        'רופא',
        'רופא שיניים',
        'תרופות',
        'פארמה',
        'ביטוח בריאות'
      ]
    },
    'פנאי ובידור': {
      icon: '🎭',
      categories: [
        'פנאי ובידור',
        'קולנוע',
        'מסעדות',
        'ספורט',
        'חופשות',
        'טיסות לחו״ל',
        'נופש'
      ]
    },
    'דיגיטל': {
      icon: '💻',
      categories: [
        'דיגיטל',
        'נטפליקס',
        'ספוטיפיי',
        'משחקים',
        'אפליקציות'
      ]
    },
    'חינוך': {
      icon: '🎓',
      categories: [
        'חינוך',
        'לימודים',
        'ספרים',
        'קורסים'
      ]
    },
    'חסכון והשקעות': {
      icon: '💎',
      categories: [
        'חסכון קבוע',
        'חסכון חד פעמי',
        'השקעות',
        'קרן פנסיה',
        'ביטוח חיים'
      ]
    },
    'אחר': {
      icon: '📝',
      categories: [
        'מתנות',
        'צדקה',
        'עמלות',
        'עמלות בנק',
        'עמלות כרטיס אשראי',
        'שונות',
        'הוצאות לא תזרימיות',
        'אחר'
      ]
    }
  };

  // Use dynamic categories if available, otherwise use predefined ones
  const finalGroupedCategories = Object.keys(groupedCategories).length > 0 ? groupedCategories : categoryGroups;

  // Filter categories based on search term
  const filteredGroups = Object.entries(finalGroupedCategories).reduce((filtered, [groupName, groupData]) => {
    const matchingCategories = groupData.categories.filter(category => {
      // Handle both string categories (predefined) and object categories (from API)
      const categoryName = typeof category === 'string' ? category : category.category_name;
      return categoryName.toLowerCase().includes(searchTerm.toLowerCase());
    });
    if (matchingCategories.length > 0) {
      filtered[groupName] = {
        ...groupData,
        categories: matchingCategories
      };
    }
    return filtered;
  }, {});

  // Get display value
  const getDisplayValue = () => {
    if (!value) return placeholder;
    
    // Find the category name by value
    for (const groupData of Object.values(finalGroupedCategories)) {
      const category = groupData.categories.find(cat => {
        if (typeof cat === 'string') {
          return cat === value;
        } else {
          return cat.category_name === value || cat.id === value;
        }
      });
      if (category) {
        return typeof category === 'string' ? category : category.category_name;
      }
    }
    return value; // fallback to raw value
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
        setSearchTerm('');
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleCategorySelect = (category) => {
    // Handle both string categories (predefined) and object categories (from API)
    const categoryName = typeof category === 'string' ? category : category.category_name;
    onChange(categoryName);
    setIsOpen(false);
    setSearchTerm('');
  };

  return (
    <div className="category-dropdown" ref={dropdownRef}>
      <div 
        className="dropdown-trigger"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className={`dropdown-value ${!value ? 'placeholder' : ''}`}>
          {getDisplayValue()}
        </span>
        <span className={`dropdown-arrow ${isOpen ? 'open' : ''}`}>▼</span>
      </div>

      {isOpen && (
        <div className="dropdown-menu">
          <div className="dropdown-search">
            <input
              type="text"
              placeholder="חפש קטגוריה..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              autoFocus
            />
          </div>

          <div className="dropdown-options">
            {Object.entries(filteredGroups).map(([groupName, groupData]) => (
              <div key={groupName} className="category-group">
                <div className="group-header">
                  <span className="group-icon">{groupData.icon}</span>
                  <span className="group-name">{groupName}</span>
                </div>
                <div className="group-categories">
                  {groupData.categories.map((category) => {
                    const categoryName = typeof category === 'string' ? category : category.category_name;
                    const categoryKey = typeof category === 'string' ? category : category.id;
                    return (
                      <div
                        key={categoryKey}
                        className={`category-option ${value === categoryName ? 'selected' : ''}`}
                        onClick={() => handleCategorySelect(category)}
                      >
                        {categoryName}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
            
            {Object.keys(filteredGroups).length === 0 && (
              <div className="no-results">לא נמצאו קטגוריות</div>
            )}

            <div className="new-category-option" onClick={() => handleCategorySelect('__new_category__')}>
              ➕ הוסף קטגוריה חדשה
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CategoryDropdown;