import { useMemo } from 'react';
import { SurveyFormSchema, SurveyField } from '@/types/survey-forms';

interface SurveyData {
  [key: string]: any;
}

interface ValidationResult {
  isValid: boolean;
  errors: string[];
  canContinue: boolean;
}

export function useSurveyValidation(
  surveyData: SurveyData, 
  currentStep: number, 
  schema?: SurveyFormSchema
): ValidationResult {
  return useMemo(() => {
    const errors: string[] = [];
    let canContinue = true;

    // If no schema is provided, fall back to legacy validation
    if (!schema) {
      return { isValid: true, errors: [], canContinue: true };
    }

    // Get current step fields from schema
    const currentStepFields = schema.steps[currentStep]?.fields || [];

    // Validate each field in the current step
    for (const field of currentStepFields) {
      const fieldValue = surveyData[field.key];
      const isRequired = field.settings?.required || false;

      // Check if field should be shown based on logic
      const shouldShow = !field.logic || field.logic.every(logic => {
        if (logic.action !== 'show') return true; // Only check show conditions
        
        const ruleValue = surveyData[logic.condition.fieldKey];
        switch (logic.condition.operator) {
          case 'equals':
            return ruleValue === logic.condition.value;
          case 'not_equals':
            return ruleValue !== logic.condition.value;
          case 'contains':
            return Array.isArray(ruleValue) && ruleValue.includes(logic.condition.value);
          default:
            return true;
        }
      });

      if (!shouldShow) continue;

      // Required field validation
      if (isRequired) {
        if (field.type === 'photo' || field.type === 'video' || field.type === 'file') {
          const mediaFiles = Array.isArray(fieldValue) ? fieldValue : [];
          const minFiles = field.settings?.mediaSettings?.minItems || 1;
          
          if (mediaFiles.length < minFiles) {
            errors.push(`${field.settings?.label || field.key} requires at least ${minFiles} file(s) (${mediaFiles.length}/${minFiles})`);
            canContinue = false;
          }
        } else if (field.type === 'checkbox') {
          if (!fieldValue) {
            errors.push(`${field.settings?.label || field.key} must be checked`);
            canContinue = false;
          }
        } else {
          if (!fieldValue || (typeof fieldValue === 'string' && !fieldValue.trim())) {
            errors.push(`${field.settings?.label || field.key} is required`);
            canContinue = false;
          }
        }
      }

      // Type-specific validation
      if (fieldValue) {
        switch (field.type) {
          case 'email':
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(fieldValue)) {
              errors.push(`${field.settings?.label || field.key} must be a valid email`);
              canContinue = false;
            }
            break;
          case 'phone':
            const phoneRegex = /^[\d\s\-\+\(\)]+$/;
            if (!phoneRegex.test(fieldValue)) {
              errors.push(`${field.settings?.label || field.key} must be a valid phone number`);
              canContinue = false;
            }
            break;
          case 'number':
          case 'currency':
            if (isNaN(Number(fieldValue))) {
              errors.push(`${field.settings?.label || field.key} must be a valid number`);
              canContinue = false;
            }
            break;
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      canContinue
    };
  }, [surveyData, currentStep, schema]);
}