import React, { useState, useRef, useEffect } from 'react';
import './CategoryDropdown.css';

const CategoryDropdown = ({ value, onChange, categories = [], placeholder = "בחר קטגוריה..." }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  console.log('🔍 [CategoryDropdown] Rendered with categories:', categories);
  console.log('🔍 [CategoryDropdown] Categories length:', categories.length);
  console.log('🔍 [CategoryDropdown] First category sample:', categories[0]);

  // Function to categorize categories into groups
  const getCategoryGroup = (category) => {
    const categoryName = (category.category_name || category.name || '').toLowerCase();
    
    if (categoryName.includes('הכנסה') || categoryName.includes('משכורת') || categoryName.includes('עבודה') || categoryName.includes('פנסיה')) {
      return { name: 'הכנסות', icon: '💰', order: 1 };
    } else if (categoryName.includes('משכנתא') || categoryName.includes('שכר דירה') || categoryName.includes('ארנונה') || 
               categoryName.includes('חשמל') || categoryName.includes('גז') || categoryName.includes('מים') || 
               categoryName.includes('אינטרנט') || categoryName.includes('טלפון') || categoryName.includes('ביטוח דירה') ||
               categoryName.includes('ועד בית') || categoryName.includes('תיקון')) {
      return { name: 'דיור', icon: '🏠', order: 2 };
    } else if (categoryName.includes('סופר') || categoryName.includes('אוכל') || categoryName.includes('מסעדה') || 
               categoryName.includes('בגדים') || categoryName.includes('קניות') || categoryName.includes('קוסמטיקה')) {
      return { name: 'הוצאות משתנות', icon: '🛒', order: 3 };
    } else if (categoryName.includes('דלק') || categoryName.includes('תחבורה') || categoryName.includes('ביטוח רכב') || 
               categoryName.includes('תחזוקת רכב') || categoryName.includes('חנייה') || categoryName.includes('רכב')) {
      return { name: 'תחבורה', icon: '🚗', order: 4 };
    } else if (categoryName.includes('רופא') || categoryName.includes('תרופות') || categoryName.includes('פארמה') || 
               categoryName.includes('בריאות') || categoryName.includes('רפואה')) {
      return { name: 'בריאות', icon: '🏥', order: 5 };
    } else if (categoryName.includes('קולנוע') || categoryName.includes('ספורט') || categoryName.includes('חופשות') || 
               categoryName.includes('טיסות') || categoryName.includes('נופש') || categoryName.includes('פנאי') || 
               categoryName.includes('טיסה') || categoryName.includes('ירח דבש')) {
      return { name: 'פנאי ובידור', icon: '🎭', order: 6 };
    } else if (categoryName.includes('נטפליקס') || categoryName.includes('ספוטיפיי') || categoryName.includes('משחקים') || 
               categoryName.includes('אפליקציות') || categoryName.includes('דיגיטל')) {
      return { name: 'דיגיטל', icon: '💻', order: 7 };
    } else if (categoryName.includes('לימודים') || categoryName.includes('ספרים') || categoryName.includes('קורסים') || 
               categoryName.includes('חינוך')) {
      return { name: 'חינוך', icon: '🎓', order: 8 };
    } else if (categoryName.includes('חסכון') || categoryName.includes('השקעות') || categoryName.includes('קרן פנסיה') || 
               categoryName.includes('ביטוח חיים') || categoryName.includes('הפקדות')) {
      return { name: 'חסכון והשקעות', icon: '💎', order: 9 };
    } else {
      return { name: 'אחר', icon: '📝', order: 10 };
    }
  };

  // Group categories by type
  const groupedCategories = categories.reduce((groups, category) => {
    const group = getCategoryGroup(category);
    const groupName = group.name;
    
    if (!groups[groupName]) {
      groups[groupName] = {
        icon: group.icon,
        order: group.order,
        categories: []
      };
    }
    groups[groupName].categories.push(category);
    return groups;
  }, {});

  // Sort groups by order and categories within groups alphabetically
  const sortedGroups = Object.entries(groupedCategories)
    .sort(([, a], [, b]) => a.order - b.order)
    .map(([groupName, groupData]) => ({
      name: groupName,
      ...groupData,
      categories: groupData.categories.sort((a, b) => 
        (a.category_name || a.name).localeCompare(b.category_name || b.name, 'he')
      )
    }));

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleCategorySelect = (category) => {
    console.log('🔍 [CategoryDropdown] Selected category:', category);
    onChange(category.category_name || category.name);
    setIsOpen(false);
  };

  const toggleDropdown = () => {
    console.log('🔍 [CategoryDropdown] Toggle dropdown, current isOpen:', isOpen);
    setIsOpen(!isOpen);
  };

  // Get display value
  const getDisplayValue = () => {
    if (!value) return placeholder;
    
    // Find the category by value
    const category = categories.find(cat => 
      cat.category_name === value || cat.name === value || cat.id === value
    );
    
    return category ? (category.category_name || category.name) : value;
  };

  return (
    <div className="simple-category-dropdown" ref={dropdownRef}>
      <div 
        className="dropdown-trigger-simple"
        onClick={toggleDropdown}
      >
        <span className={`dropdown-value-simple ${!value ? 'placeholder' : ''}`}>
          {getDisplayValue()}
        </span>
        <span className={`dropdown-arrow-simple ${isOpen ? 'open' : ''}`}>▼</span>
      </div>

      {isOpen && (
        <div className="dropdown-menu-simple">
          <div className="dropdown-options-simple">
            {sortedGroups.length > 0 ? (
              sortedGroups.map((group) => (
                <div key={group.name} className="category-group-simple">
                  <div className="group-header-simple">
                    <span className="group-icon-simple">{group.icon}</span>
                    <span className="group-name-simple">{group.name}</span>
                  </div>
                  <div className="group-options-simple">
                    {group.categories.map((category) => (
                      <div
                        key={category.id || category.category_name || category.name}
                        className={`dropdown-option-simple ${value === (category.category_name || category.name) ? 'selected' : ''}`}
                        onClick={() => handleCategorySelect(category)}
                      >
                        {category.category_name || category.name}
                      </div>
                    ))}
                  </div>
                </div>
              ))
            ) : (
              <div className="no-categories-simple">אין קטגוריות זמינות</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default CategoryDropdown;