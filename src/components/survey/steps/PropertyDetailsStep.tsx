import React from 'react';
import { CardSelectGroup } from '../CardSelectGroup';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Home, Building, Building2 } from 'lucide-react';

const propertyTypes = [
  { id: 'house', label: 'House', icon: Home },
  { id: 'flat', label: 'Flat/Apartment', icon: Building },
  { id: 'commercial', label: 'Commercial', icon: Building2 },
];

const parkingTypes = [
  { id: 'driveway', label: 'Private Driveway', icon: Home },
  { id: 'garage', label: 'Garage', icon: Building },
  { id: 'street', label: 'Street Parking', icon: Building2 },
];

interface PropertyDetailsStepProps {
  data: any;
  updateData: (key: string, value: any) => void;
  surveyId?: string | null;
  orderId?: string;
}

export function PropertyDetailsStep({ data, updateData }: PropertyDetailsStepProps) {
  const propertyData = data.propertyDetails || {};

  const handleChange = (field: string, value: any) => {
    updateData('propertyDetails', {
      ...propertyData,
      [field]: value,
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-900 mb-2">
          Tell us about your property
        </h2>
        <p className="text-slate-600 text-sm">
          This helps us understand your installation requirements
        </p>
      </div>

      <div className="space-y-6">
        <div>
          <Label className="text-base font-medium mb-3 block">Property Type</Label>
          <CardSelectGroup
            options={propertyTypes}
            value={propertyData.propertyType}
            onChange={(value) => handleChange('propertyType', value)}
          />
        </div>

        <div>
          <Label className="text-base font-medium mb-3 block">Parking Arrangement</Label>
          <CardSelectGroup
            options={parkingTypes}
            value={propertyData.parkingType}
            onChange={(value) => handleChange('parkingType', value)}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="postcode">Postcode</Label>
            <Input
              id="postcode"
              value={propertyData.postcode || ''}
              onChange={(e) => handleChange('postcode', e.target.value)}
              placeholder="e.g. SW1A 1AA"
            />
          </div>
          <div>
            <Label htmlFor="yearBuilt">Year Built (approx)</Label>
            <Input
              id="yearBuilt"
              type="number"
              value={propertyData.yearBuilt || ''}
              onChange={(e) => handleChange('yearBuilt', e.target.value)}
              placeholder="e.g. 1995"
            />
          </div>
        </div>

        <div>
          <Label htmlFor="notes">Additional Notes</Label>
          <Textarea
            id="notes"
            value={propertyData.notes || ''}
            onChange={(e) => handleChange('notes', e.target.value)}
            placeholder="Any additional details about your property..."
            rows={3}
          />
        </div>
      </div>
    </div>
  );
}