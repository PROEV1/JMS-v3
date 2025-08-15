import React from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { getButtonVariant } from '@/lib/brandUtils';

interface BrandButtonProps extends React.ComponentProps<typeof Button> {
  brandVariant?: 'primary' | 'secondary' | 'accent';
}

export const BrandButton: React.FC<BrandButtonProps> = ({
  brandVariant,
  className,
  children,
  ...props
}) => {
  const brandClass = brandVariant ? getButtonVariant(brandVariant) : '';

  return (
    <Button 
      className={cn(brandClass, className)}
      {...props}
    >
      {children}
    </Button>
  );
};