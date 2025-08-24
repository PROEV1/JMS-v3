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

    // Helper function to get field value with fallback for different naming conventions
    const getFieldValue = (path: string) => {
      // Try exact path first
      const keys = path.split('.');
      let value = surveyData;
      for (const key of keys) {
        value = value?.[key];
      }
      if (value !== undefined) return value;

      // Try flat structure for dynamic forms
      return surveyData[path] || surveyData[keys[keys.length - 1]];
    };

    // Step-specific validation
    switch (currentStep) {
      case 0: // Property Details
        if (!getFieldValue('propertyDetails.propertyType') && !getFieldValue('propertyType')) {
          errors.push('Property type is required');
          canContinue = false;
        }
        if (!getFieldValue('propertyDetails.parkingType') && !getFieldValue('parkingType')) {
          errors.push('Parking type is required');
          canContinue = false;
        }
        if (!getFieldValue('propertyDetails.postcode')?.trim() && !getFieldValue('postcode')?.trim()) {
          errors.push('Postcode is required');
          canContinue = false;
        }
        break;

      case 1: // Parking Access
        // Support both old field names and new dynamic field names
        const propertyAccess = getFieldValue('parkingAccess.propertyAccess') || getFieldValue('accessType') || getFieldValue('propertyAccess');
        const vehicleAccess = getFieldValue('parkingAccess.vehicleAccess') || getFieldValue('vehicleAccess');
        
        if (!propertyAccess) {
          errors.push('Property access type is required');
          canContinue = false;
        }
        if (!vehicleAccess) {
          errors.push('Vehicle access difficulty is required');
          canContinue = false;
        }
        break;

      case 2: // Charger Location
        const chargerPhotos = getFieldValue('chargerLocation.photos') || getFieldValue('chargerLocationPhotos') || [];
        if (chargerPhotos.length < 3) {
          errors.push(`At least 3 charger location photos are required (${chargerPhotos.length}/3)`);
          canContinue = false;
        }
        break;

      case 3: // Consumer Unit
        const consumerPhotos = getFieldValue('consumerUnit.photos') || getFieldValue('consumerUnitPhotos') || [];
        if (consumerPhotos.length < 1) {
          errors.push('At least 1 consumer unit photo is required');
          canContinue = false;
        }
        break;

      case 4: // Video (optional)
        // No validation required for video step
        break;

      case 5: // Confirm & Submit
        if (!getFieldValue('consent')) {
          errors.push('You must agree to the terms before submitting');
          canContinue = false;
        }
        
        // Final validation - all previous requirements
        const finalChargerPhotos = getFieldValue('chargerLocation.photos') || getFieldValue('chargerLocationPhotos') || [];
        const finalConsumerPhotos = getFieldValue('consumerUnit.photos') || getFieldValue('consumerUnitPhotos') || [];
        
        if (finalChargerPhotos.length < 3) {
          errors.push('Charger location photos incomplete (3 required)');
          canContinue = false;
        }
        
        if (finalConsumerPhotos.length < 1) {
          errors.push('Consumer unit photo required');
          canContinue = false;
        }

        const hasPropertyType = getFieldValue('propertyDetails.propertyType') || getFieldValue('propertyType');
        const hasParkingType = getFieldValue('propertyDetails.parkingType') || getFieldValue('parkingType');
        if (!hasPropertyType || !hasParkingType) {
          errors.push('Property details incomplete');
          canContinue = false;
        }

        const hasPropertyAccess = getFieldValue('parkingAccess.propertyAccess') || getFieldValue('accessType') || getFieldValue('propertyAccess');
        const hasVehicleAccess = getFieldValue('parkingAccess.vehicleAccess') || getFieldValue('vehicleAccess');
        if (!hasPropertyAccess || !hasVehicleAccess) {
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