import React from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { getButtonVariant } from '@/lib/brandUtils';
import { useDesignVersion } from '@/contexts/DesignVersionContext';

interface BrandButtonProps extends React.ComponentProps<typeof Button> {
  brandVariant?: 'primary' | 'secondary' | 'accent';
}

export const BrandButton: React.FC<BrandButtonProps> = ({
  brandVariant,
  className,
  children,
  ...props
}) => {
  const { isV2 } = useDesignVersion();
  
  // Only apply brand classes in v2, pass through minimal classes in legacy
  const brandClass = isV2 && brandVariant ? getButtonVariant(brandVariant) : '';

  return (
    <Button 
      className={cn(brandClass, className)}
      {...props}
    >
      {children}
    </Button>
  );
};