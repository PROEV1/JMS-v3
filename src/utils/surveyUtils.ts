/**
 * Survey requirement utility functions
 */

export interface OrderWithPartner {
  survey_required?: boolean;
  is_partner_job?: boolean;
  partner_id?: string | null;
  partner?: {
    client_survey_required?: boolean | null;
  } | null;
}

/**
 * Determines if a survey is required for an order, considering both order-level
 * and partner-level settings. Partner settings override order settings.
 */
export function isSurveyRequiredForOrder(order: OrderWithPartner): boolean {
  // For partner jobs, check the partner's survey requirement setting
  if (order.is_partner_job && order.partner?.client_survey_required !== undefined) {
    return order.partner.client_survey_required === true;
  }
  
  // For non-partner jobs or when partner setting is undefined, use order setting
  return order.survey_required === true;
}

/**
 * Gets a human-readable explanation of why survey is/isn't required
 */
export function getSurveyRequirementReason(order: OrderWithPartner): string {
  if (order.is_partner_job && order.partner?.client_survey_required !== undefined) {
    return order.partner.client_survey_required 
      ? 'Survey required by partner'
      : 'Survey not required by partner';
  }
  
  return order.survey_required 
    ? 'Survey required for this order'
    : 'Survey not required for this order';
}