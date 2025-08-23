import React from 'react';
import { CardSelectGroup } from '../CardSelectGroup';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Car, Lock, Key, Clock } from 'lucide-react';

const accessTypes = [
  { id: 'always_open', label: 'Always Accessible', icon: Key, description: 'No restrictions' },
  { id: 'gated', label: 'Gated Access', icon: Lock, description: 'Requires gate code/key' },
  { id: 'restricted_hours', label: 'Time Restricted', icon: Clock, description: 'Limited access hours' },
];

const vehicleAccess = [
  { id: 'easy', label: 'Easy Access', icon: Car, description: 'Van can park very close' },
  { id: 'moderate', label: 'Moderate Access', icon: Car, description: 'Short walk with equipment' },
  { id: 'difficult', label: 'Difficult Access', icon: Car, description: 'Long carry required' },
];

interface ParkingAccessStepProps {
  data: any;
  updateData: (key: string, value: any) => void;
}

export function ParkingAccessStep({ data, updateData }: ParkingAccessStepProps) {
  const parkingData = data.parkingAccess || {};

  const handleChange = (field: string, value: any) => {
    updateData('parkingAccess', {
      ...parkingData,
      [field]: value,
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-900 mb-2">
          Parking & Access Details
        </h2>
        <p className="text-slate-600 text-sm">
          Help our engineers understand how to access your property
        </p>
      </div>

      <div className="space-y-6">
        <div>
          <Label className="text-base font-medium mb-3 block">Property Access</Label>
          <CardSelectGroup
            options={accessTypes}
            value={parkingData.accessType}
            onChange={(value) => handleChange('accessType', value)}
          />
        </div>

        <div>
          <Label className="text-base font-medium mb-3 block">Vehicle Access for Installation</Label>
          <CardSelectGroup
            options={vehicleAccess}
            value={parkingData.vehicleAccess}
            onChange={(value) => handleChange('vehicleAccess', value)}
          />
        </div>

        <div>
          <Label htmlFor="accessNotes">Access Instructions</Label>
          <Textarea
            id="accessNotes"
            value={parkingData.accessNotes || ''}
            onChange={(e) => handleChange('accessNotes', e.target.value)}
            placeholder="Gate codes, parking instructions, access restrictions, etc..."
            rows={4}
          />
        </div>
      </div>
    </div>
  );
}