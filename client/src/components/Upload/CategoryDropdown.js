import React, { useState, useRef, useEffect } from 'react';
import './CategoryDropdown.css';

const CategoryDropdown = ({ value, onChange, categories = [], placeholder = "בחר קטגוריה..." }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const dropdownRef = useRef(null);
  const searchInputRef = useRef(null);

  // Debug: Log categories received only when they change
  useEffect(() => {
    console.log('🔍 [CategoryDropdown] Categories updated:', categories, 'Length:', categories?.length);
  }, [categories]);

  // Function to categorize categories into groups
  const getCategoryGroup = (category) => {
    // Handle both object format and string format
    const categoryName = (typeof category === 'string' ? category : (category.category_name || category.name || '')).toLowerCase();
    
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
    
    // Convert string categories to object format for consistency
    const categoryObj = typeof category === 'string' 
      ? { name: category, category_name: category, id: null }
      : category;
    
    groups[groupName].categories.push(categoryObj);
    return groups;
  }, {});

  // Filter categories based on search term
  const filterCategories = (categories, searchTerm) => {
    if (!searchTerm.trim()) return categories;
    
    return categories.filter(category => {
      const categoryName = (category.category_name || category.name || '').toLowerCase();
      const search = searchTerm.toLowerCase();
      
      // Check if category name contains search term or starts with it
      return categoryName.includes(search) || 
             categoryName.split(' ').some(word => word.startsWith(search));
    });
  };

  // Sort groups by order and filter categories based on search
  const sortedGroups = Object.entries(groupedCategories)
    .sort(([, a], [, b]) => a.order - b.order)
    .map(([groupName, groupData]) => ({
      name: groupName,
      ...groupData,
      categories: filterCategories(
        groupData.categories.sort((a, b) => 
          (a.category_name || a.name).localeCompare(b.category_name || b.name, 'he')
        ),
        searchTerm
      )
    }))
    .filter(group => group.categories.length > 0); // Only show groups with matching categories

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

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      setTimeout(() => {
        searchInputRef.current.focus();
      }, 100);
    }
  }, [isOpen]);

  const handleCategorySelect = (category) => {
    console.log('🔍 [CategoryDropdown] Selected category:', category);
    // Since we're now using unique categories from transactions (strings), 
    // we pass just the category name without ID
    const categoryName = category.category_name || category.name;
    onChange(categoryName);
    setIsOpen(false);
    setSearchTerm('');
  };

  const toggleDropdown = () => {
    console.log('🔍 [CategoryDropdown] Toggle dropdown, current isOpen:', isOpen);
    setIsOpen(!isOpen);
    if (!isOpen) {
      setSearchTerm('');
    }
  };

  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value);
  };

  // Handle keyboard navigation
  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      setIsOpen(false);
      setSearchTerm('');
    } else if (e.key === 'Enter' && sortedGroups.length > 0) {
      // Auto-select first result on Enter
      const firstGroup = sortedGroups[0];
      if (firstGroup.categories.length > 0) {
        handleCategorySelect(firstGroup.categories[0]);
      }
    }
  };

  // Highlight matching text in category names
  const highlightMatch = (text, searchTerm) => {
    if (!searchTerm.trim()) return text;
    
    const regex = new RegExp(`(${searchTerm})`, 'gi');
    const parts = text.split(regex);
    
    return parts.map((part, index) => 
      regex.test(part) ? 
        <span key={index} className="highlight-match-simple">{part}</span> : 
        part
    );
  };

  // Get display value
  const getDisplayValue = () => {
    if (!value) return placeholder;
    
    // Since we're now using category names directly, just return the value
    return value;
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
          <div className="dropdown-search-simple">
            <input
              ref={searchInputRef}
              type="text"
              className="search-input-simple"
              placeholder="חפש קטגוריה..."
              value={searchTerm}
              onChange={handleSearchChange}
              onKeyDown={handleKeyDown}
              onClick={(e) => e.stopPropagation()}
            />
          </div>
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
                        {highlightMatch(category.category_name || category.name, searchTerm)}
                      </div>
                    ))}
                  </div>
                </div>
              ))
            ) : (
              <div className="no-categories-simple">
                {searchTerm ? `לא נמצאו קטגוריות עבור "${searchTerm}"` : 'אין קטגוריות זמינות'}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default CategoryDropdown;