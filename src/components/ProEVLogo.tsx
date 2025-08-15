import React, { useState } from 'react';

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
  const [currentLogoIndex, setCurrentLogoIndex] = useState(0);
  
  const logoFallbacks = [
    "/lovable-uploads/548560c2-21a1-4b43-8030-675a4bcbd9ba.png",
    "/lovable-uploads/3add86aa-4857-42e8-9672-5ea09a594bb2.png",
    "/pro-ev-logo.png",
    "/lovable-uploads/97d9570a-a316-4ac2-8def-5eeab6670140.png"
  ];

  const sizeClasses = {
    sm: 'h-8',
    md: 'h-12',
    lg: 'h-16',
    xl: 'h-20'
  };

  const handleImageError = () => {
    if (currentLogoIndex < logoFallbacks.length - 1) {
      setCurrentLogoIndex(currentLogoIndex + 1);
    }
  };

  return (
    <img 
      src={logoFallbacks[currentLogoIndex]}
      className={`${sizeClasses[size]} w-auto ${className}`}
      alt="Pro EV Logo"
      onError={handleImageError}
    />
  );
};