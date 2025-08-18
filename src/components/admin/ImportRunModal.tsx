import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Upload, FileSpreadsheet, AlertCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface ImportRunModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (csvData?: string, dryRun?: boolean) => Promise<void>;
  sourceType: 'csv' | 'gsheet';
  gsheetId?: string;
  gsheetSheetName?: string;
}

export default function ImportRunModal({
  isOpen,
  onClose,
  onImport,
  sourceType,
  gsheetId,
  gsheetSheetName
}: ImportRunModalProps) {
  const [csvData, setCsvData] = useState('');
  const [dryRun, setDryRun] = useState(true);
  const [isImporting, setIsImporting] = useState(false);

  const handleImport = async () => {
    setIsImporting(true);
    try {
      if (sourceType === 'csv') {
        await onImport(csvData, dryRun);
      } else {
        await onImport(undefined, dryRun);
      }
      if (!dryRun) {
        onClose();
      }
    } finally {
      setIsImporting(false);
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type === 'text/csv') {
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        setCsvData(content);
      };
      reader.readAsText(file);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {sourceType === 'csv' ? (
              <Upload className="h-5 w-5" />
            ) : (
              <FileSpreadsheet className="h-5 w-5" />
            )}
            Run Import - {sourceType.toUpperCase()}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {sourceType === 'gsheet' && (
            <div className="space-y-2">
              <Label>Google Sheets Source</Label>
              <div className="p-3 bg-muted rounded-lg">
                <div className="flex items-center gap-2">
                  <FileSpreadsheet className="h-4 w-4" />
                  <span className="font-mono text-sm">
                    {gsheetId}/{gsheetSheetName || 'Sheet1'}
                  </span>
                </div>
              </div>
            </div>
          )}

          {sourceType === 'csv' && (
            <div className="space-y-2">
              <Label>CSV Data</Label>
              <div className="space-y-2">
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleFileUpload}
                  className="block w-full text-sm text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90"
                />
                <Textarea
                  value={csvData}
                  onChange={(e) => setCsvData(e.target.value)}
                  placeholder="Or paste CSV data here..."
                  rows={8}
                  className="font-mono text-sm"
                />
              </div>
            </div>
          )}

          <div className="flex items-center space-x-2">
            <Switch
              id="dry_run"
              checked={dryRun}
              onCheckedChange={setDryRun}
            />
            <Label htmlFor="dry_run" className="flex items-center gap-2">
              Dry Run Mode
              <Badge variant={dryRun ? 'default' : 'destructive'}>
                {dryRun ? 'Safe Preview' : 'Live Import'}
              </Badge>
            </Label>
          </div>

          {!dryRun && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <strong>Warning:</strong> Live import will modify your database. 
                Make sure you've tested with dry run mode first.
              </AlertDescription>
            </Alert>
          )}

          <div className="flex justify-end space-x-2">
            <Button variant="outline" onClick={onClose} disabled={isImporting}>
              Cancel
            </Button>
            <Button 
              onClick={handleImport} 
              disabled={isImporting || (sourceType === 'csv' && !csvData.trim())}
            >
              {isImporting ? (
                'Processing...'
              ) : (
                <>
                  {dryRun ? (
                    <>
                      <FileSpreadsheet className="h-4 w-4 mr-2" />
                      Preview Import
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4 mr-2" />
                      Run Import
                    </>
                  )}
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}