import React, { useState, useEffect, useRef } from 'react';
import './CategoryAutocomplete.css';
import '../Upload/CategoryDropdown.css';

const CategoryAutocomplete = ({ 
  value, 
  onChange, 
  placeholder = "הקלד לחיפוש קטגוריה...", 
  disabled = false,
  autoFocus = false 
}) => {
  const [inputValue, setInputValue] = useState(value || '');
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const inputRef = useRef(null);
  const suggestionsRef = useRef(null);

  useEffect(() => {
    setInputValue(value || '');
  }, [value]);

  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus();
    }
  }, [autoFocus]);

  const fetchCategorySuggestions = async (query = '') => {
    console.log('🔍 [CategoryAutocomplete] fetchCategorySuggestions called with query:', query);
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const url = query ? `/api/categories/search?q=${encodeURIComponent(query)}` : '/api/categories/search?q=';
      console.log('🔍 [CategoryAutocomplete] Making request to URL:', url);
      console.log('🔍 [CategoryAutocomplete] Token exists:', !!token);
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      console.log('🔍 [CategoryAutocomplete] Response status:', response.status);
      console.log('🔍 [CategoryAutocomplete] Response ok:', response.ok);

      if (response.ok) {
        const data = await response.json();
        console.log('🔍 [CategoryAutocomplete] Response data:', data);
        console.log('🔍 [CategoryAutocomplete] Data length:', data?.length || 0);
        setSuggestions(data || []);
        setShowSuggestions(data.length > 0);
        setSelectedIndex(-1);
        console.log('🔍 [CategoryAutocomplete] ShowSuggestions set to:', data.length > 0);
      } else {
        console.log('🔍 [CategoryAutocomplete] Response not ok, clearing suggestions');
        setSuggestions([]);
        setShowSuggestions(false);
      }
    } catch (error) {
      console.error('🔍 [CategoryAutocomplete] Error fetching categories:', error);
      setSuggestions([]);
      setShowSuggestions(false);
    } finally {
      setLoading(false);
      console.log('🔍 [CategoryAutocomplete] fetchCategorySuggestions completed');
    }
  };



  const handleInputChange = (e) => {
    const newValue = e.target.value;
    console.log('🔍 [CategoryAutocomplete] handleInputChange called with value:', newValue);
    setInputValue(newValue);
    onChange(newValue);
    
    // Debounce the API call
    clearTimeout(window.categorySearchTimeout);
    console.log('🔍 [CategoryAutocomplete] Setting timeout for search with value:', newValue);
    window.categorySearchTimeout = setTimeout(() => {
      console.log('🔍 [CategoryAutocomplete] Timeout fired, calling fetchCategorySuggestions');
      fetchCategorySuggestions(newValue);
    }, 300);
  };

  const handleSuggestionClick = (categoryName) => {
    setInputValue(categoryName);
    onChange(categoryName);
    setShowSuggestions(false);
    setSelectedIndex(-1);
  };

  // Get all visible categories in a flat array for keyboard navigation
  const getVisibleCategories = () => {
    return suggestions.map(suggestion => suggestion.category_name);
  };

  const handleKeyDown = (e) => {
    if (!showSuggestions) return;

    const visibleCategories = getVisibleCategories();
    
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => 
          prev < visibleCategories.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => prev > 0 ? prev - 1 : -1);
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && selectedIndex < visibleCategories.length) {
          handleSuggestionClick(visibleCategories[selectedIndex]);
        }
        break;
      case 'Escape':
        setShowSuggestions(false);
        setSelectedIndex(-1);
        break;
      default:
        break;
    }
  };

  const handleInputFocus = () => {
    console.log('🔍 [CategoryAutocomplete] handleInputFocus called');
    console.log('🔍 [CategoryAutocomplete] Current suggestions length:', suggestions.length);
    console.log('🔍 [CategoryAutocomplete] Current inputValue:', inputValue);
    
    if (suggestions.length === 0) {
      console.log('🔍 [CategoryAutocomplete] No suggestions, calling fetchCategorySuggestions');
      fetchCategorySuggestions(inputValue);
    } else {
      console.log('🔍 [CategoryAutocomplete] Have suggestions, showing them');
      setShowSuggestions(true);
    }
  };

  const handleInputBlur = () => {
    // Delay hiding suggestions to allow clicking on them
    setTimeout(() => {
      setShowSuggestions(false);
      setSelectedIndex(-1);
    }, 200);
  };

  return (
    <div className="category-autocomplete">
      <div className="autocomplete-input-container">
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={handleInputFocus}
          onBlur={handleInputBlur}
          placeholder={placeholder}
          disabled={disabled}
          className="autocomplete-input"
          autoComplete="off"
        />
        {loading && (
          <div className="autocomplete-loading">
            <i className="fas fa-spinner fa-spin"></i>
          </div>
        )}
      </div>
      
      {showSuggestions && suggestions.length > 0 && (
        <div className="dropdown-menu-simple autocomplete-suggestions" ref={suggestionsRef}>
          <div className="dropdown-options-simple">
            <div className="category-group-simple">
              <div className="group-header-simple">
                <span className="group-icon-simple">📋</span>
                <span className="group-name-simple">קטגוריות מהעסקאות</span>
              </div>
              <div className="group-options-simple">
                {suggestions.map((suggestion, index) => {
                  const isKeyboardSelected = selectedIndex === index;
                  const isValueSelected = suggestion.category_name === inputValue;
                  
                  return (
                    <div
                      key={`${suggestion.category_name}-${index}`}
                      className={`dropdown-option-simple ${
                        isKeyboardSelected ? 'keyboard-selected' : ''
                      } ${isValueSelected ? 'selected' : ''}`}
                      onClick={() => handleSuggestionClick(suggestion.category_name)}
                    >
                      {suggestion.category_name}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
      
      {inputValue && inputValue.length >= 1 && !loading && suggestions.length === 0 && showSuggestions && (
        <div className="autocomplete-suggestions">
          <div className="autocomplete-no-results">
            אין תוצאות עבור "{inputValue}"
          </div>
        </div>
      )}
    </div>
  );
};

export default CategoryAutocomplete;