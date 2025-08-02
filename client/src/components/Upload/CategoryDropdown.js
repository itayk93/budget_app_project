import React, { useState, useRef, useEffect } from 'react';
import './CategoryDropdown.css';

const CategoryDropdown = ({ value, onChange, placeholder = "בחר קטגוריה..." }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const dropdownRef = useRef(null);

  // Predefined category groups (same as CategoryTransferModal)
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

  // Filter categories based on search term
  const filteredGroups = Object.entries(categoryGroups).reduce((filtered, [groupName, groupData]) => {
    const matchingCategories = groupData.categories.filter(categoryName => 
      categoryName.toLowerCase().includes(searchTerm.toLowerCase())
    );
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
    for (const groupData of Object.values(categoryGroups)) {
      const category = groupData.categories.find(cat => cat === value);
      if (category) return category;
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

  const handleCategorySelect = (categoryName) => {
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
                  {groupData.categories.map((categoryName) => (
                    <div
                      key={categoryName}
                      className={`category-option ${value === categoryName ? 'selected' : ''}`}
                      onClick={() => handleCategorySelect(categoryName)}
                    >
                      {categoryName}
                    </div>
                  ))}
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