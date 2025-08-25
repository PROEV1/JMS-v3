import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Palette, RotateCcw } from 'lucide-react';
import { useDesignVersion } from '@/contexts/DesignVersionContext';

export function DesignVersionToggle() {
  const { currentVersion, setVersion } = useDesignVersion();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Palette className="h-5 w-5" />
          Design Version Control
        </CardTitle>
        <CardDescription>
          Switch between design versions instantly. Changes apply immediately without page reload.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-sm font-medium">Current Version</p>
            <Badge variant="outline" className="capitalize">
              {currentVersion}
            </Badge>
          </div>
          
          <Select value={currentVersion} onValueChange={setVersion}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="legacy">
                <div className="flex items-center gap-2">
                  <RotateCcw className="h-4 w-4" />
                  Legacy
                </div>
              </SelectItem>
              <SelectItem value="v2">
                <div className="flex items-center gap-2">
                  <Palette className="h-4 w-4" />
                  Design v2
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2 text-sm text-muted-foreground">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="font-medium text-foreground">Legacy</p>
              <p>Current production design</p>
            </div>
            <div>
              <p className="font-medium text-foreground">Design v2</p>
              <p>Enhanced brand system with improved consistency</p>
            </div>
          </div>
        </div>

        <div className="rounded-lg bg-muted/50 p-3 text-xs">
          <p className="font-medium mb-1">Rollback Instructions:</p>
          <ul className="space-y-1 text-muted-foreground">
            <li>• Select "Legacy" to instantly revert to current design</li>
            <li>• Add ?design=legacy to any URL for quick override</li>
            <li>• Settings are saved per browser</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}