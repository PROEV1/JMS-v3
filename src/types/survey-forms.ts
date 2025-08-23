export type SurveyFieldType = 
  | 'text' | 'long_text' | 'number' | 'currency' | 'email' | 'phone'
  | 'select' | 'multiselect' | 'radio' | 'checkbox'
  | 'date' | 'time' | 'address'
  | 'file' | 'photo' | 'video' | 'signature' | 'geotag';

export interface SurveyFieldOption {
  value: string;
  label: string;
}

export interface SurveyFieldSettings {
  label: string;
  placeholder?: string;
  helpText?: string;
  required: boolean;
  minValue?: number;
  maxValue?: number;
  regex?: string;
  inputMask?: string;
  defaultValue?: string;
  options?: SurveyFieldOption[];
  mediaSettings?: {
    minItems?: number;
    maxItems?: number;
    maxSizeMB?: number;
    maxVideoLengthSeconds?: number;
  };
}

export interface SurveyFieldLogic {
  condition: {
    fieldKey: string;
    operator: 'equals' | 'not_equals' | 'contains';
    value: string;
  };
  action: 'show' | 'require';
}

export interface SurveyField {
  key: string;
  type: SurveyFieldType;
  settings: SurveyFieldSettings;
  logic?: SurveyFieldLogic[];
  order: number;
}

export interface SurveyStep {
  key: string;
  title: string;
  description?: string;
  progressLabel?: string;
  fields: SurveyField[];
  order: number;
}

export interface SurveyFormSchema {
  title: string;
  description?: string;
  steps: SurveyStep[];
  designSettings: {
    useDualBrand: boolean;
    primaryColor?: string;
    accentColor?: string;
  };
}

export interface SurveyForm {
  id: string;
  name: string;
  description?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface SurveyFormVersion {
  id: string;
  form_id: string;
  version_number: number;
  status: 'draft' | 'published';
  schema: SurveyFormSchema;
  published_at?: string;
  published_by?: string;
  created_at: string;
  updated_at: string;
}

export interface SurveyFormMapping {
  id: string;
  context_type: 'direct' | 'partner';
  form_version_id: string;
  is_active: boolean;
  mapped_by: string;
  mapped_at: string;
}

export interface SurveyFormTemplate {
  name: string;
  description: string;
  schema: SurveyFormSchema;
}

export const DEFAULT_EV_INSTALL_TEMPLATE: SurveyFormTemplate = {
  name: "EV Home Install Survey",
  description: "Standard survey for home EV charger installations",
  schema: {
    title: "EV Charger Installation Survey",
    description: "Please provide information about your property for the installation",
    designSettings: {
      useDualBrand: true
    },
    steps: [
      {
        key: "property_details",
        title: "Property Details",
        description: "Tell us about your property type and parking",
        progressLabel: "Property Info",
        order: 0,
        fields: [
          {
            key: "property_type",
            type: "radio",
            order: 0,
            settings: {
              label: "Property Type",
              required: true,
              options: [
                { value: "house", label: "House" },
                { value: "flat", label: "Flat/Apartment" },
                { value: "commercial", label: "Commercial Property" }
              ]
            }
          },
          {
            key: "parking_type",
            type: "radio",
            order: 1,
            settings: {
              label: "Parking Type",
              required: true,
              options: [
                { value: "driveway", label: "Private Driveway" },
                { value: "garage", label: "Garage" },
                { value: "allocated", label: "Allocated Space" },
                { value: "street", label: "Street Parking" }
              ]
            }
          },
          {
            key: "postcode",
            type: "text",
            order: 2,
            settings: {
              label: "Postcode",
              required: true,
              placeholder: "e.g. SW1A 1AA"
            }
          }
        ]
      },
      {
        key: "parking_access",
        title: "Parking & Access",
        description: "Help us understand access to your parking area",
        progressLabel: "Access Info",
        order: 1,
        fields: [
          {
            key: "property_access",
            type: "radio",
            order: 0,
            settings: {
              label: "Property Access",
              required: true,
              options: [
                { value: "easy", label: "Easy access, no restrictions" },
                { value: "gates", label: "Gated access" },
                { value: "stairs", label: "Stairs or steps required" },
                { value: "difficult", label: "Difficult access" }
              ]
            }
          },
          {
            key: "vehicle_access",
            type: "radio",
            order: 1,
            settings: {
              label: "Vehicle Access Difficulty",
              required: true,
              options: [
                { value: "easy", label: "Easy - Van can park close" },
                { value: "moderate", label: "Moderate - Some walking required" },
                { value: "difficult", label: "Difficult - Long walk/carry required" }
              ]
            }
          }
        ]
      },
      {
        key: "charger_location",
        title: "Charger Location Photos",
        description: "Please provide photos of where you'd like the charger installed",
        progressLabel: "Location Photos",
        order: 2,
        fields: [
          {
            key: "charger_location_photos",
            type: "photo",
            order: 0,
            settings: {
              label: "Charger Location Photos",
              helpText: "Take photos showing the proposed charger location and surrounding area",
              required: true,
              mediaSettings: {
                minItems: 3,
                maxItems: 10,
                maxSizeMB: 10
              }
            }
          },
          {
            key: "charger_location_notes",
            type: "long_text",
            order: 1,
            settings: {
              label: "Additional Notes",
              placeholder: "Any additional details about the location...",
              required: false
            }
          }
        ]
      },
      {
        key: "consumer_unit",
        title: "Consumer Unit Photos",
        description: "Photos of your electrical consumer unit (fuse box)",
        progressLabel: "Electrical Photos",
        order: 3,
        fields: [
          {
            key: "consumer_unit_photos",
            type: "photo",
            order: 0,
            settings: {
              label: "Consumer Unit Photos",
              helpText: "Photos of your fuse box/consumer unit with the cover open if safely accessible",
              required: true,
              mediaSettings: {
                minItems: 1,
                maxItems: 5,
                maxSizeMB: 10
              }
            }
          },
          {
            key: "consumer_unit_notes",
            type: "long_text",
            order: 1,
            settings: {
              label: "Electrical Notes",
              placeholder: "Any electrical concerns or notes...",
              required: false
            }
          }
        ]
      },
      {
        key: "video_walkthrough",
        title: "Video Walkthrough",
        description: "Optional video walkthrough of the installation area",
        progressLabel: "Video (Optional)",
        order: 4,
        fields: [
          {
            key: "walkthrough_video",
            type: "video",
            order: 0,
            settings: {
              label: "Video Walkthrough",
              helpText: "Short video showing the route from road to charger location",
              required: false,
              mediaSettings: {
                maxItems: 1,
                maxSizeMB: 100,
                maxVideoLengthSeconds: 300
              }
            }
          }
        ]
      },
      {
        key: "confirmation",
        title: "Confirm & Submit",
        description: "Review and submit your survey",
        progressLabel: "Submit",
        order: 5,
        fields: [
          {
            key: "consent",
            type: "checkbox",
            order: 0,
            settings: {
              label: "I confirm that the information provided is accurate and I consent to the installation survey",
              required: true
            }
          }
        ]
      }
    ]
  }
};