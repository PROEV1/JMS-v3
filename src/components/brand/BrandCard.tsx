import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { getTypographyClass } from '@/lib/brandUtils';

interface BrandCardProps {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  iconBg?: string;
  iconColor?: string;
  badge?: React.ReactNode;
  onClick?: () => void;
  className?: string;
  children?: React.ReactNode;
  interactive?: boolean;
}

export const BrandCard: React.FC<BrandCardProps> = ({
  title,
  description,
  icon,
  iconBg = 'icon-bg-teal',
  iconColor = 'text-brand-teal',
  badge,
  onClick,
  className,
  children,
  interactive = false,
}) => {
  return (
    <Card 
      className={cn(
        interactive ? 'brand-card-interactive' : 'brand-card',
        className
      )}
      onClick={onClick}
    >
      <CardContent className="p-8">
        <div className="text-center space-y-4">
          {icon && (
            <div className={cn("w-16 h-16 rounded-2xl flex items-center justify-center mx-auto", iconBg)}>
              <div className={iconColor}>
                {icon}
              </div>
            </div>
          )}
          <div>
            <h3 className={cn("text-xl font-semibold text-primary mb-1", getTypographyClass('heading3'))}>
              {title}
            </h3>
            {description && (
              <p className={cn("text-sm text-muted-foreground mb-3", getTypographyClass('body'))}>
                {description}
              </p>
            )}
            {badge}
          </div>
          {children}
        </div>
      </CardContent>
    </Card>
  );
};