import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { LucideIcon } from 'lucide-react';

interface KpiCardProps {
  title: string;
  value: number;
  icon: LucideIcon;
  variant: 'success' | 'warning' | 'danger' | 'info' | 'neutral';
  onClick?: () => void;
  subtitle?: string;
}

const variantStyles = {
  success: 'bg-gradient-to-br from-green-50 to-green-100 border-green-200 hover:border-green-300',
  warning: 'bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200 hover:border-orange-300',
  danger: 'bg-gradient-to-br from-red-50 to-red-100 border-red-200 hover:border-red-300',
  info: 'bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200 hover:border-blue-300',
  neutral: 'bg-gradient-to-br from-gray-50 to-gray-100 border-gray-200 hover:border-gray-300'
};

export function KpiCard({ title, value, icon: Icon, variant, onClick, subtitle }: KpiCardProps) {
  const isClickable = !!onClick;
  
  return (
    <Card 
      className={`
        ${variantStyles[variant]}
        ${isClickable ? 'cursor-pointer transition-all duration-200 hover:shadow-md active:scale-[0.98]' : ''}
      `}
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="p-2 bg-white/60 rounded-lg">
            <Icon className="h-4 w-4 text-foreground" />
          </div>
        </div>
        
        <div className="space-y-1">
          <div className="text-2xl font-bold text-foreground">{value}</div>
          <div className="text-sm font-medium text-foreground">{title}</div>
          {subtitle && (
            <div className="text-xs text-muted-foreground">{subtitle}</div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}