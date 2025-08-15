import React from 'react';
import { cn } from '@/lib/utils';
import { PAGE_LAYOUTS } from '@/lib/brandUtils';

interface BrandLayoutProps {
  children: React.ReactNode;
  className?: string;
}

export const BrandPage: React.FC<BrandLayoutProps> = ({ children, className }) => (
  <div className={cn(PAGE_LAYOUTS.fullPage, className)}>
    {children}
  </div>
);

export const BrandContainer: React.FC<BrandLayoutProps> = ({ children, className }) => (
  <div className={cn(PAGE_LAYOUTS.container, className)}>
    {children}
  </div>
);

interface BrandLoadingProps {
  className?: string;
}

export const BrandLoading: React.FC<BrandLoadingProps> = ({ className }) => (
  <div className="min-h-screen bg-background flex items-center justify-center">
    <div className={cn(PAGE_LAYOUTS.loadingSpinner, className)}></div>
  </div>
);