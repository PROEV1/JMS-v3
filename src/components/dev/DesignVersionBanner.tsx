import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Palette, RotateCcw } from 'lucide-react';
import { useDesignVersion } from '@/contexts/DesignVersionContext';

export function DesignVersionBanner() {
  const { currentVersion, setVersion, isV2 } = useDesignVersion();

  // Only show in development
  if (import.meta.env.PROD) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-lg border bg-background/95 backdrop-blur-sm p-3 shadow-lg">
      <div className="flex items-center gap-2 text-sm">
        <Palette className="h-4 w-4" />
        <span>Design:</span>
        <Badge variant="outline" className="capitalize">
          {currentVersion}
        </Badge>
      </div>
      
      <Button
        size="sm"
        variant="outline"
        onClick={() => setVersion(isV2 ? 'legacy' : 'v2')}
        className="h-7 px-2"
      >
        {isV2 ? (
          <>
            <RotateCcw className="h-3 w-3 mr-1" />
            Legacy
          </>
        ) : (
          <>
            <Palette className="h-3 w-3 mr-1" />
            v2
          </>
        )}
      </Button>
    </div>
  );
}