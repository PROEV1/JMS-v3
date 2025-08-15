import React from 'react';
import { cn } from '@/lib/utils';
import { getTypographyClass } from '@/lib/brandUtils';

interface BrandTypographyProps {
  variant: 'heading1' | 'heading2' | 'heading3' | 'body' | 'title';
  children: React.ReactNode;
  className?: string;
  as?: keyof JSX.IntrinsicElements;
}

export const BrandTypography: React.FC<BrandTypographyProps> = ({
  variant,
  children,
  className,
  as: Component = 'div',
}) => {
  return (
    <Component className={cn(getTypographyClass(variant), className)}>
      {children}
    </Component>
  );
};

// Convenience components for common usage
export const BrandHeading1: React.FC<Omit<BrandTypographyProps, 'variant'>> = (props) => (
  <BrandTypography variant="heading1" as="h1" {...props} />
);

export const BrandHeading2: React.FC<Omit<BrandTypographyProps, 'variant'>> = (props) => (
  <BrandTypography variant="heading2" as="h2" {...props} />
);

export const BrandHeading3: React.FC<Omit<BrandTypographyProps, 'variant'>> = (props) => (
  <BrandTypography variant="heading3" as="h3" {...props} />
);

export const BrandBody: React.FC<Omit<BrandTypographyProps, 'variant'>> = (props) => (
  <BrandTypography variant="body" as="p" {...props} />
);

export const BrandTitle: React.FC<Omit<BrandTypographyProps, 'variant'>> = (props) => (
  <BrandTypography variant="title" as="div" {...props} />
);