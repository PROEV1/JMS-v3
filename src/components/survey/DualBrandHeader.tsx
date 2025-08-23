import React from 'react';
import { ProEVLogo } from '@/components/ProEVLogo';

interface PartnerBrand {
  name: string;
  logo_url: string;
  hex: string;
}

interface DualBrandHeaderProps {
  partnerBrand?: PartnerBrand;
}

export function DualBrandHeader({ partnerBrand }: DualBrandHeaderProps) {
  return (
    <div className="border-b border-slate-200">
      {partnerBrand?.hex && (
        <div 
          className="h-1" 
          style={{ backgroundColor: partnerBrand.hex }}
        />
      )}
      
      <div className="max-w-6xl mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          {partnerBrand ? (
            <>
              <div className="flex items-center">
                <img
                  src={partnerBrand.logo_url}
                  alt={partnerBrand.name}
                  className="h-8 object-contain"
                />
              </div>
              <div className="flex items-center">
                <ProEVLogo className="h-8" />
              </div>
            </>
          ) : (
            <div className="flex items-center">
              <ProEVLogo className="h-8" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}