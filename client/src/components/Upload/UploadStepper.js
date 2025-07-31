import React from 'react';
import './UploadStepper.css';

const UploadStepper = ({ currentStep, steps }) => {
  return (
    <div className="upload-stepper">
      <div className="stepper-container">
        {steps.map((step, index) => (
          <div
            key={index}
            className={`stepper-item ${
              index < currentStep ? 'completed' : 
              index === currentStep ? 'active' : 'pending'
            }`}
          >
            <div className="stepper-number">
              {index < currentStep ? (
                <i className="fas fa-check"></i>
              ) : (
                index + 1
              )}
            </div>
            <div className="stepper-content">
              <div className="stepper-title">{step.title}</div>
              <div className="stepper-description">{step.description}</div>
            </div>
            {index < steps.length - 1 && (
              <div className={`stepper-line ${index < currentStep ? 'completed' : ''}`}></div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default UploadStepper;