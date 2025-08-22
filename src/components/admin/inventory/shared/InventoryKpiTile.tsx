import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { LucideIcon } from 'lucide-react';

interface InventoryKpiTileProps {
  title: string;
  value: number;
  icon: LucideIcon;
  variant: 'success' | 'warning' | 'danger' | 'info' | 'neutral';
  onClick?: () => void;
  subtitle?: string;
  percentage?: string;
  trend?: string;
}

const variantStyles = {
  success: 'bg-gradient-to-br from-green-50 to-green-100 border-green-200 hover:border-green-300',
  warning: 'bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200 hover:border-orange-300',
  danger: 'bg-gradient-to-br from-red-50 to-red-100 border-red-200 hover:border-red-300',
  info: 'bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200 hover:border-blue-300',
  neutral: 'bg-gradient-to-br from-gray-50 to-gray-100 border-gray-200 hover:border-gray-300'
};

export function InventoryKpiTile({ 
  title, 
  value, 
  icon: Icon, 
  variant, 
  onClick, 
  subtitle,
  percentage,
  trend 
}: InventoryKpiTileProps) {
  const isClickable = !!onClick;
  
  return (
    <Card 
      className={`
        ${variantStyles[variant]}
        ${isClickable ? 'cursor-pointer transition-all duration-200 hover:shadow-md active:scale-[0.98]' : ''}
      `}
      onClick={onClick}
    >
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/60 rounded-lg">
              <Icon className="h-5 w-5 text-foreground" />
            </div>
            <h3 className="font-semibold text-sm text-foreground">{title}</h3>
          </div>
        </div>
        
        <div className="space-y-3">
          <div className="text-center">
            <div className="text-3xl font-bold text-foreground mb-1">{value}</div>
            {percentage && (
              <div className="text-xs text-muted-foreground">
                {percentage}
              </div>
            )}
          </div>
          
          {(subtitle || trend) && (
            <div className="flex justify-between text-xs text-muted-foreground">
              {subtitle && <span>{subtitle}</span>}
              {trend && <span>{trend}</span>}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}