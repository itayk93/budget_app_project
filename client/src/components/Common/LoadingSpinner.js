import React from 'react';

const LoadingSpinner = ({ size = 'medium', text = '' }) => {
  const sizeClass = {
    small: 'w-4 h-4',
    medium: 'w-8 h-8',
    large: 'w-12 h-12'
  }[size];

  return (
    <div className="d-flex flex-column align-center justify-center gap-md">
      <div className={`spinner ${sizeClass}`}></div>
      {text && <span className="text-muted text-sm">{text}</span>}
    </div>
  );
};

export default LoadingSpinner;