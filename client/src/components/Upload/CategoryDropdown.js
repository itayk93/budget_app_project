import React, { useState, useRef, useEffect } from 'react';
import './CategoryDropdown.css';

const CategoryDropdown = ({ value, onChange, categories = [], placeholder = "בחר קטגוריה..." }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const dropdownRef = useRef(null);

  // Group categories by type
  const groupedCategories = categories.reduce((groups, category) => {
    const group = category.type || 'אחר';
    if (!groups[group]) {
      groups[group] = [];
    }
    groups[group].push(category);
    return groups;
  }, {});

  // Category group icons
  const groupIcons = {
    'הכנסות': '💰',
    'דיור': '🏠',
    'הוצאות משתנות': '🛒',
    'תחבורה': '🚗',
    'בריאות': '🏥',
    'פנאי ובידור': '🎭',
    'דיגיטל': '💻',
    'חינוך': '🎓',
    'חסכון והשקעות': '💎',
    'אחר': '📝'
  };

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

  const selectedCategory = categories.find(cat => cat.id === value);

  const filteredGroups = Object.entries(groupedCategories).reduce((filtered, [groupName, groupCategories]) => {
    const filteredCategories = groupCategories.filter(category =>
      category.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
    if (filteredCategories.length > 0) {
      filtered[groupName] = filteredCategories;
    }
    return filtered;
  }, {});

  const handleCategorySelect = (categoryId) => {
    onChange(categoryId);
    setIsOpen(false);
    setSearchTerm('');
  };

  return (
    <div className="category-dropdown" ref={dropdownRef}>
      <div 
        className={`dropdown-trigger ${isOpen ? 'open' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className="selected-value">
          {selectedCategory ? selectedCategory.name : placeholder}
        </span>
        <span className={`dropdown-arrow ${isOpen ? 'open' : ''}`}>▼</span>
      </div>

      {isOpen && (
        <div className="dropdown-menu">
          <div className="dropdown-search">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="חפש קטגוריה..."
              className="search-input"
              autoFocus
            />
          </div>

          <div className="dropdown-options">
            {Object.entries(filteredGroups).map(([groupName, groupCategories]) => (
              <div key={groupName} className="category-group">
                <div className="group-header">
                  <span className="group-icon">{groupIcons[groupName] || '📝'}</span>
                  <span className="group-name">{groupName}</span>
                </div>
                <div className="group-options">
                  {groupCategories.map(category => (
                    <div
                      key={category.id}
                      className={`dropdown-option ${value === category.id ? 'selected' : ''}`}
                      onClick={() => handleCategorySelect(category.id)}
                    >
                      {category.name}
                    </div>
                  ))}
                </div>
              </div>
            ))}

            {Object.keys(filteredGroups).length === 0 && (
              <div className="no-results">
                לא נמצאו קטגוריות מתאימות
              </div>
            )}
          </div>

          <div className="dropdown-footer">
            <div
              className="add-new-category"
              onClick={() => {
                // TODO: Handle new category creation
                console.log('Add new category');
                setIsOpen(false);
              }}
            >
              ➕ הוסף קטגוריה חדשה
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CategoryDropdown;