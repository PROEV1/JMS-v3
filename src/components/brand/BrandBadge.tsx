import React from 'react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { getBadgeVariant, getStatusColor } from '@/lib/brandUtils';
import { useDesignVersion } from '@/contexts/DesignVersionContext';

interface BrandBadgeProps {
  children: React.ReactNode;
  variant?: 'teal' | 'pink' | 'cream' | 'blue';
  status?: 'sent' | 'accepted' | 'declined' | 'pending' | 'expired' | 'complete' | 'active';
  className?: string;
}

export const BrandBadge: React.FC<BrandBadgeProps> = ({
  children,
  variant,
  status,
  className,
}) => {
  const { isV2 } = useDesignVersion();
  
  // Only apply brand classes in v2, pass through minimal classes in legacy
  const badgeClass = isV2 ? (status 
    ? getStatusColor(status)
    : variant 
    ? getBadgeVariant(variant)
    : '') : '';

  return (
    <Badge className={cn(badgeClass, className)}>
      {children}
    </Badge>
  );
};