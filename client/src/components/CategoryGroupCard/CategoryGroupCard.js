import React, { useState } from 'react';
import CategoryCard from '../CategoryCard/CategoryCard';
import './CategoryGroupCard.css';

const CategoryGroupCard = ({ 
  groupName, 
  categories, 
  onCategoryClick,
  formatCurrency,
  formatDate,
  onDataChange,
  year,
  month
}) => {
  const [isOpen, setIsOpen] = useState(false);

  console.log(`🎯 CategoryGroupCard rendering: ${groupName} with ${categories.length} categories`);
  console.log(`📋 Categories in group "${groupName}":`, categories.map(c => ({
    name: c.name,
    amount: c.amount || c.spent || 0,
    shared_category: c.shared_category
  })));

  // Calculate group totals
  const calculateGroupTotals = () => {
    let totalSpent = 0;
    
    categories.forEach(categoryData => {
      const amount = Math.abs(categoryData.amount || categoryData.spent || 0);
      totalSpent += amount;
      console.log(`   💰 "${categoryData.name}": ${amount} ₪`);
    });
    
    console.log(`📊 TOTAL for group "${groupName}": ${totalSpent} ₪`);
    return { totalSpent };
  };

  const { totalSpent } = calculateGroupTotals();

  const toggleOpen = () => {
    setIsOpen(!isOpen);
    console.log(`🔄 Toggling ${groupName}: ${!isOpen ? 'opened' : 'closed'}`);
  };

  // Use the formatCurrency prop or fallback to local function
  const formatCurrencyLocal = formatCurrency || ((amount) => {
    return `${Math.abs(amount).toLocaleString('he-IL', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} ₪`;
  });

  return (
    <div className="category-group-card">
      {/* Group Header */}
      <div className="group-header" onClick={toggleOpen}>
        <div className="group-info">
          <h3 className="group-name">{groupName}</h3>
          <div className="group-amount">
            {formatCurrencyLocal(totalSpent)}
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
                  categoryName={category.name}
                  categoryData={category}
                  formatCurrency={formatCurrency}
                  formatDate={formatDate}
                  onDataChange={onDataChange}
                  year={year}
                  month={month}
                  isInGroup={true}
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