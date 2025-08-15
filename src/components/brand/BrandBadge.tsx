import React from 'react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { getBadgeVariant, getStatusColor } from '@/lib/brandUtils';

interface BrandBadgeProps {
  children: React.ReactNode;
  variant?: 'teal' | 'green' | 'pink' | 'cream';
  status?: 'sent' | 'accepted' | 'declined' | 'pending' | 'expired' | 'complete' | 'active';
  className?: string;
}

export const BrandBadge: React.FC<BrandBadgeProps> = ({
  children,
  variant,
  status,
  className,
}) => {
  const badgeClass = status 
    ? getStatusColor(status)
    : variant 
    ? getBadgeVariant(variant)
    : '';

  return (
    <Badge className={cn(badgeClass, className)}>
      {children}
    </Badge>
  );
};