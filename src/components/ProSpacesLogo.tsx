import React from 'react';

interface ProSpacesLogoProps {
  variant?: 'main' | 'icon' | 'stacked' | 'monochrome';
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export const ProSpacesLogo: React.FC<ProSpacesLogoProps> = ({ 
  variant = 'main', 
  className = '', 
  size = 'md' 
}) => {
  const getSizeClasses = () => {
    switch (size) {
      case 'sm': return 'h-6';
      case 'md': return 'h-8';
      case 'lg': return 'h-12';
      case 'xl': return 'h-16';
      default: return 'h-8';
    }
  };

  return (
    <img 
      src="/lovable-uploads/97d9570a-a316-4ac2-8def-5eeab6670140.png" 
      alt="ProSpaces Logo" 
      className={`${getSizeClasses()} w-auto ${className}`}
    />
  );
};