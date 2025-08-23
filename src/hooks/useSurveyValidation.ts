import { useMemo } from 'react';

interface SurveyData {
  propertyDetails?: any;
  parkingAccess?: any;
  chargerLocation?: {
    photos?: any[];
    notes?: string;
  };
  consumerUnit?: {
    photos?: any[];
    notes?: string;
  };
  video?: any;
  consent?: boolean;
}

interface ValidationResult {
  isValid: boolean;
  errors: string[];
  canContinue: boolean;
}

export function useSurveyValidation(surveyData: SurveyData, currentStep: number): ValidationResult {
  return useMemo(() => {
    const errors: string[] = [];
    let canContinue = true;

    // Step-specific validation
    switch (currentStep) {
      case 0: // Property Details
        if (!surveyData.propertyDetails?.propertyType) {
          errors.push('Property type is required');
          canContinue = false;
        }
        if (!surveyData.propertyDetails?.parkingType) {
          errors.push('Parking type is required');
          canContinue = false;
        }
        if (!surveyData.propertyDetails?.postcode?.trim()) {
          errors.push('Postcode is required');
          canContinue = false;
        }
        break;

      case 1: // Parking Access
        if (!surveyData.parkingAccess?.propertyAccess) {
          errors.push('Property access type is required');
          canContinue = false;
        }
        if (!surveyData.parkingAccess?.vehicleAccess) {
          errors.push('Vehicle access difficulty is required');
          canContinue = false;
        }
        break;

      case 2: // Charger Location
        const chargerPhotos = surveyData.chargerLocation?.photos || [];
        if (chargerPhotos.length < 3) {
          errors.push(`At least 3 charger location photos are required (${chargerPhotos.length}/3)`);
          canContinue = false;
        }
        break;

      case 3: // Consumer Unit
        const consumerPhotos = surveyData.consumerUnit?.photos || [];
        if (consumerPhotos.length < 1) {
          errors.push('At least 1 consumer unit photo is required');
          canContinue = false;
        }
        break;

      case 4: // Video (optional)
        // No validation required for video step
        break;

      case 5: // Confirm & Submit
        if (!surveyData.consent) {
          errors.push('You must agree to the terms before submitting');
          canContinue = false;
        }
        
        // Final validation - all previous requirements
        const finalChargerPhotos = surveyData.chargerLocation?.photos || [];
        const finalConsumerPhotos = surveyData.consumerUnit?.photos || [];
        
        if (finalChargerPhotos.length < 3) {
          errors.push('Charger location photos incomplete (3 required)');
          canContinue = false;
        }
        
        if (finalConsumerPhotos.length < 1) {
          errors.push('Consumer unit photo required');
          canContinue = false;
        }

        if (!surveyData.propertyDetails?.propertyType || !surveyData.propertyDetails?.parkingType) {
          errors.push('Property details incomplete');
          canContinue = false;
        }

        if (!surveyData.parkingAccess?.propertyAccess || !surveyData.parkingAccess?.vehicleAccess) {
          errors.push('Access information incomplete');
          canContinue = false;
        }
        break;
    }

    return {
      isValid: errors.length === 0,
      errors,
      canContinue
    };
  }, [surveyData, currentStep]);
}