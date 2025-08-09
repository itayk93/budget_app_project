import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import './CategoryDropdown.css';

const CategoryDropdown = ({ value, onChange, categories = [], placeholder = "בחר קטגוריה..." }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0 });
  const dropdownRef = useRef(null);
  const searchInputRef = useRef(null);
  const dropdownId = useRef(`dropdown-${Math.random().toString(36).substr(2, 9)}`).current;

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

  // Close dropdown when clicking outside, scrolling, or resizing
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        // Also check if the click is outside the dropdown menu itself (since it's in a portal)
        const dropdownMenu = document.querySelector('.dropdown-menu-portal');
        if (!dropdownMenu || !dropdownMenu.contains(event.target)) {
          // Remove active state when closing
          if (dropdownRef.current) {
            dropdownRef.current.classList.remove('dropdown-active');
            dropdownRef.current.removeAttribute('data-dropdown-id');
          }
          setIsOpen(false);
          setSearchTerm('');
        }
      }
    };

    const handleScroll = (event) => {
      if (isOpen) {
        // Don't close if scrolling inside the dropdown itself
        const dropdownMenu = document.querySelector('.dropdown-menu-portal');
        if (dropdownMenu && dropdownMenu.contains(event.target)) {
          return; // Allow scrolling inside dropdown
        }
        
        // Close dropdown only if scrolling outside of it
        if (dropdownRef.current) {
          dropdownRef.current.classList.remove('dropdown-active');
          dropdownRef.current.removeAttribute('data-dropdown-id');
        }
        setIsOpen(false);
        setSearchTerm('');
      }
    };

    const handleResize = () => {
      if (isOpen) {
        if (dropdownRef.current) {
          dropdownRef.current.classList.remove('dropdown-active');
          dropdownRef.current.removeAttribute('data-dropdown-id');
        }
        setIsOpen(false);
        setSearchTerm('');
      }
    };

    const handleEscape = (event) => {
      if (event.key === 'Escape' && isOpen) {
        if (dropdownRef.current) {
          dropdownRef.current.classList.remove('dropdown-active');
          dropdownRef.current.removeAttribute('data-dropdown-id');
        }
        setIsOpen(false);
        setSearchTerm('');
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      
      // Use a timeout to allow dropdown to render before adding scroll listeners
      const timeoutId = setTimeout(() => {
        window.addEventListener('scroll', handleScroll, true);
      }, 100);
      
      window.addEventListener('resize', handleResize);
      document.addEventListener('keydown', handleEscape);
      
      // Add a position update function that recalculates position
      const updatePosition = () => {
        if (dropdownRef.current) {
          const rect = dropdownRef.current.getBoundingClientRect();
          const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
          const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
          
          const dropdownHeight = 350;
          const windowHeight = window.innerHeight;
          const windowWidth = window.innerWidth;
          
          let top = rect.bottom + scrollTop + 4;
          let left = rect.left + scrollLeft;
          const width = Math.max(rect.width, 200);
          
          if (top + dropdownHeight > windowHeight + scrollTop) {
            top = rect.top + scrollTop - dropdownHeight - 4;
          }
          
          if (left + width > windowWidth + scrollLeft) {
            left = rect.right + scrollLeft - width;
          }
          
          if (left < scrollLeft) {
            left = scrollLeft + 4;
          }
          
          if (top < scrollTop + 10) {
            top = scrollTop + 10;
          }
          
          setDropdownPosition({ top, left, width });
        }
      };
      
      // Track the initial position to detect significant changes only
      let lastPosition = { top: 0, left: 0 };
      if (dropdownRef.current) {
        const rect = dropdownRef.current.getBoundingClientRect();
        lastPosition = { top: rect.top, left: rect.left };
      }
      
      // Only update position if the trigger element moved significantly
      const checkPositionChange = () => {
        if (dropdownRef.current) {
          const rect = dropdownRef.current.getBoundingClientRect();
          const currentPosition = { top: rect.top, left: rect.left };
          
          // Only update if position changed by more than 10px (significant movement)
          const topDiff = Math.abs(currentPosition.top - lastPosition.top);
          const leftDiff = Math.abs(currentPosition.left - lastPosition.left);
          
          if (topDiff > 10 || leftDiff > 10) {
            updatePosition();
            lastPosition = currentPosition;
          }
        }
      };
      
      // Check for position changes less frequently and only for significant moves
      const positionCheckInterval = setInterval(checkPositionChange, 300);
      
      return () => {
        clearTimeout(timeoutId);
        clearInterval(positionCheckInterval);
        document.removeEventListener('mousedown', handleClickOutside);
        window.removeEventListener('scroll', handleScroll, true);
        window.removeEventListener('resize', handleResize);
        document.removeEventListener('keydown', handleEscape);
      };
    }
  }, [isOpen]);

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
    
    // Remove active state when closing
    if (dropdownRef.current) {
      dropdownRef.current.classList.remove('dropdown-active');
      dropdownRef.current.removeAttribute('data-dropdown-id');
    }
    
    // Since we're now using unique categories from transactions (strings), 
    // we pass just the category name without ID
    const categoryName = category.category_name || category.name;
    onChange(categoryName);
    setIsOpen(false);
    setSearchTerm('');
  };

  const toggleDropdown = () => {
    console.log('🔍 [CategoryDropdown] Toggle dropdown, current isOpen:', isOpen);
    
    if (!isOpen) {
      // Mark this dropdown as active
      if (dropdownRef.current) {
        dropdownRef.current.classList.add('dropdown-active');
        dropdownRef.current.setAttribute('data-dropdown-id', dropdownId);
      }
      
      // Calculate position for dropdown when opening
      if (dropdownRef.current) {
        const rect = dropdownRef.current.getBoundingClientRect();
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
        
        const dropdownHeight = 350; // max-height from CSS
        const windowHeight = window.innerHeight;
        const windowWidth = window.innerWidth;
        
        let top = rect.bottom + scrollTop + 4;
        let left = rect.left + scrollLeft;
        const width = Math.max(rect.width, 200); // minimum width
        
        // Check if dropdown would go off-screen vertically
        if (top + dropdownHeight > windowHeight + scrollTop) {
          // Position above the trigger
          top = rect.top + scrollTop - dropdownHeight - 4;
        }
        
        // Check if dropdown would go off-screen horizontally (RTL support)
        if (left + width > windowWidth + scrollLeft) {
          // Align to the right edge of the trigger
          left = rect.right + scrollLeft - width;
        }
        
        // Ensure dropdown doesn't go off the left edge
        if (left < scrollLeft) {
          left = scrollLeft + 4;
        }
        
        // Ensure minimum distance from screen edges
        if (top < scrollTop + 10) {
          top = scrollTop + 10;
        }
        
        setDropdownPosition({ top, left, width });
      }
      setSearchTerm('');
    } else {
      // Remove active state when closing
      if (dropdownRef.current) {
        dropdownRef.current.classList.remove('dropdown-active');
        dropdownRef.current.removeAttribute('data-dropdown-id');
      }
    }
    
    setIsOpen(!isOpen);
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
    <div className={`simple-category-dropdown ${isOpen ? 'dropdown-active' : ''}`} ref={dropdownRef}>
      <div 
        className="dropdown-trigger-simple"
        onClick={toggleDropdown}
      >
        <span className={`dropdown-value-simple ${!value ? 'placeholder' : ''}`}>
          {getDisplayValue()}
        </span>
        <span className={`dropdown-arrow-simple ${isOpen ? 'open' : ''}`}>▼</span>
      </div>

      {isOpen && createPortal(
        <div 
          className="dropdown-menu-simple dropdown-menu-portal"
          style={{
            position: 'fixed',
            top: `${dropdownPosition.top}px`,
            left: `${dropdownPosition.left}px`,
            width: `${dropdownPosition.width}px`,
            zIndex: 10000
          }}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
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
              onFocus={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
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
        </div>,
        document.body
      )}
    </div>
  );
};

export default CategoryDropdown;