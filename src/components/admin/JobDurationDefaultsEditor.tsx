import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface JobDurationDefaultsEditorProps {
  defaults: Record<string, number>;
  onUpdate: (defaults: Record<string, number>) => void;
}

export default function JobDurationDefaultsEditor({ defaults, onUpdate }: JobDurationDefaultsEditorProps) {
  const { toast } = useToast();
  const [newJobType, setNewJobType] = useState('');
  const [newDuration, setNewDuration] = useState('');

  const handleAddDefault = () => {
    if (!newJobType.trim()) {
      toast({
        title: "Job type required",
        description: "Please enter a job type name",
        variant: "destructive",
      });
      return;
    }

    const duration = parseFloat(newDuration);
    if (isNaN(duration) || duration <= 0) {
      toast({
        title: "Invalid duration",
        description: "Duration must be a positive number",
        variant: "destructive",
      });
      return;
    }

    // Normalize the job type key
    const normalizedKey = newJobType.toLowerCase().replace(/[^a-z0-9]/g, '');
    
    onUpdate({
      ...defaults,
      [normalizedKey]: duration
    });

    setNewJobType('');
    setNewDuration('');
  };

  const handleUpdateDefault = (key: string, value: string) => {
    const duration = parseFloat(value);
    if (isNaN(duration) || duration <= 0) {
      return;
    }

    onUpdate({
      ...defaults,
      [key]: duration
    });
  };

  const handleRemoveDefault = (key: string) => {
    const updated = { ...defaults };
    delete updated[key];
    onUpdate(updated);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Job Duration Defaults</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3">
          {Object.entries(defaults).map(([jobType, duration]) => (
            <div key={jobType} className="flex items-center gap-2">
              <Label className="min-w-0 flex-1 text-sm font-medium">
                {jobType}
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  step="0.1"
                  min="0.1"
                  max="12"
                  value={duration}
                  onChange={(e) => handleUpdateDefault(jobType, e.target.value)}
                  className="w-20"
                />
                <span className="text-sm text-muted-foreground">hours</span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleRemoveDefault(jobType)}
                  className="p-1.5"
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>
          ))}
        </div>

        <div className="border-t pt-3">
          <div className="flex items-center gap-2">
            <Input
              placeholder="Job type name"
              value={newJobType}
              onChange={(e) => setNewJobType(e.target.value)}
              className="flex-1"
            />
            <Input
              type="number"
              step="0.1"
              min="0.1"
              max="12"
              placeholder="Hours"
              value={newDuration}
              onChange={(e) => setNewDuration(e.target.value)}
              className="w-20"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleAddDefault}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Job type will be normalized (e.g., "Service Call" → "service_call")
          </p>
        </div>
      </CardContent>
    </Card>
  );
}