import React, { useState } from 'react';
import CategoryCard from '../CategoryCard/CategoryCard';
import './CategoryGroupCard.css';

const CategoryGroupCard = ({ 
  groupName, 
  categories, 
  onCategoryClick
}) => {
  const [isOpen, setIsOpen] = useState(false);

  console.log(`🎯 CategoryGroupCard rendering: ${groupName} with ${categories.length} categories`);

  // Calculate group totals
  const calculateGroupTotals = () => {
    let totalSpent = 0;
    
    categories.forEach(categoryData => {
      totalSpent += Math.abs(categoryData.amount || categoryData.spent || 0);
    });
    
    return { totalSpent };
  };

  const { totalSpent } = calculateGroupTotals();

  const toggleOpen = () => {
    setIsOpen(!isOpen);
    console.log(`🔄 Toggling ${groupName}: ${!isOpen ? 'opened' : 'closed'}`);
  };

  // Format currency
  const formatCurrency = (amount) => {
    return `${Math.abs(amount).toLocaleString('he-IL', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} ₪`;
  };

  return (
    <div className="category-group-card">
      {/* Group Header */}
      <div className="group-header" onClick={toggleOpen}>
        <div className="group-info">
          <h3 className="group-name">{groupName}</h3>
          <div className="group-amount">
            {formatCurrency(totalSpent)}
          </div>
        </div>
        <div className="group-controls">
          <span className="category-count">{categories.length} קטגוריות</span>
          <span className={`expand-icon ${isOpen ? 'expanded' : ''}`}>
            ▼
          </span>
        </div>
      </div>

      {/* Expanded Content */}
      {isOpen && (
        <div className="group-content">
          <div className="group-categories">
            {categories.map((category) => (
              <div key={category.name} className="group-category-item">
                <CategoryCard
                  category={category}
                  onClick={() => {
                    console.log(`🖱️ Clicked category: ${category.name}`);
                    onCategoryClick(category.name);
                  }}
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default CategoryGroupCard;