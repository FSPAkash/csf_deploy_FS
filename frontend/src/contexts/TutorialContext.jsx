import { createContext, useContext, useState, useCallback, useEffect } from 'react';

const TutorialContext = createContext(null);

export function useTutorial() {
  const context = useContext(TutorialContext);
  if (!context) {
    throw new Error('useTutorial must be used within TutorialProvider');
  }
  return context;
}

export function TutorialProvider({ children }) {
  const [isActive, setIsActive] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState(new Set());
  const [stepValidation, setStepValidation] = useState({});

  const startTutorial = useCallback(() => {
    setIsActive(true);
    setCurrentStep(0);
    setCompletedSteps(new Set());
    setStepValidation({});
  }, []);

  const endTutorial = useCallback(() => {
    setIsActive(false);
    setCurrentStep(0);
    setCompletedSteps(new Set());
    setStepValidation({});
  }, []);

  const nextStep = useCallback(() => {
    setCompletedSteps(prev => new Set([...prev, currentStep]));
    setCurrentStep(prev => prev + 1);
  }, [currentStep]);

  const previousStep = useCallback(() => {
    setCurrentStep(prev => Math.max(0, prev - 1));
  }, []);

  const validateStep = useCallback((stepIndex, isValid) => {
    setStepValidation(prev => ({
      ...prev,
      [stepIndex]: isValid,
    }));
  }, []);

  const skipToStep = useCallback((stepIndex) => {
    setCurrentStep(stepIndex);
  }, []);

  const value = {
    isActive,
    currentStep,
    completedSteps,
    stepValidation,
    startTutorial,
    endTutorial,
    nextStep,
    previousStep,
    validateStep,
    skipToStep,
    // Helper to check if tutorial is at a specific step
    isAtStep: (stepIndex) => isActive && currentStep === stepIndex,
    // Check if we're between two steps (inclusive)
    isBetweenSteps: (startStep, endStep) => isActive && currentStep >= startStep && currentStep <= endStep,
  };

  return (
    <TutorialContext.Provider value={value}>
      {children}
    </TutorialContext.Provider>
  );
}
