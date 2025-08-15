import React from 'react';

interface ProEVLogoProps {
  variant?: 'main' | 'icon';
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

export const ProEVLogo: React.FC<ProEVLogoProps> = ({ 
  variant = 'main', 
  size = 'md', 
  className = '' 
}) => {
  const sizeClasses = {
    sm: 'h-8',
    md: 'h-12',
    lg: 'h-16',
    xl: 'h-20'
  };

  return (
    <img 
      src="/lovable-uploads/3dcd69bc-de64-4dd6-a9d1-b8ce69f1751d.png"
      className={`${sizeClasses[size]} w-auto ${className}`}
      alt="Pro EV Logo" 
    />
  );
};