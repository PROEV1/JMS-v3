import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle2, XCircle, Clock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface ImportResult {
  success: boolean;
  summary: {
    processed: number;
    inserted_count: number;
    updated_count: number;
    skipped_count: number;
    errors: Array<{ row: number; error: string; data?: any }>;
    warnings: Array<{ row: number; warning: string; data?: any }>;
  };
  preview?: {
    updates: Array<{ 
      row: number; 
      external_id: string; 
      current_status: string; 
      new_status: string; 
      reason: string;
      data?: any;
    }>;
    skips: Array<{ 
      row: number; 
      external_id: string; 
      reason: string; 
      data?: any;
    }>;
    inserts: Array<{ 
      row: number; 
      external_id: string; 
      status: string; 
      reason: string;
      data?: any;
    }>;
  };
}

interface ImportRunModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (csvData?: string, dryRun?: boolean, createMissingOrders?: boolean) => Promise<ImportResult | void>;
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
  const [createMissingOrders, setCreateMissingOrders] = useState(true);
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);

  const handleImport = async () => {
    setIsImporting(true);
    setImportResult(null);
    try {
      const result = await onImport(sourceType === 'csv' ? csvData : undefined, dryRun, createMissingOrders);
      if (result) {
        setImportResult(result);
      }
      if (!dryRun) {
        onClose();
      }
    } finally {
      setIsImporting(false);
    }
  };

  const handleClose = () => {
    setImportResult(null); // Clear results when closing
    onClose();
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
    <Dialog open={isOpen} onOpenChange={handleClose}>
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

          <div className="space-y-4">
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

            <div className="flex items-center space-x-2">
              <Switch
                id="create_missing_orders"
                checked={createMissingOrders}
                onCheckedChange={setCreateMissingOrders}
              />
              <Label htmlFor="create_missing_orders" className="flex items-center gap-2">
                Create Missing Orders
                <Badge variant={createMissingOrders ? 'default' : 'secondary'}>
                  {createMissingOrders ? 'Enabled' : 'Disabled'}
                </Badge>
              </Label>
            </div>

            {createMissingOrders && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Note:</strong> New orders will be created for rows that don't exist in the system.
                  This requires client_name and client_email in your data.
                </AlertDescription>
              </Alert>
            )}
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

          {importResult && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {importResult.success ? (
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                  ) : (
                    <XCircle className="h-5 w-5 text-red-500" />
                  )}
                  Import Results
                </CardTitle>
                <CardDescription>
                  Processed {importResult.summary.processed} rows
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Summary Statistics */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center p-3 bg-blue-50 rounded-lg">
                    <div className="text-2xl font-bold text-blue-600">{importResult.summary.updated_count}</div>
                    <div className="text-sm text-blue-600">Updates</div>
                  </div>
                  <div className="text-center p-3 bg-yellow-50 rounded-lg">
                    <div className="text-2xl font-bold text-yellow-600">{importResult.summary.skipped_count}</div>
                    <div className="text-sm text-yellow-600">Skipped</div>
                  </div>
                  <div className="text-center p-3 bg-green-50 rounded-lg">
                    <div className="text-2xl font-bold text-green-600">{importResult.summary.inserted_count}</div>
                    <div className="text-sm text-green-600">Inserted</div>
                  </div>
                  <div className="text-center p-3 bg-red-50 rounded-lg">
                    <div className="text-2xl font-bold text-red-600">{importResult.summary.errors.length}</div>
                    <div className="text-sm text-red-600">Errors</div>
                  </div>
                </div>

                {/* Detailed Preview */}
                {importResult.preview && (
                  <Tabs defaultValue="updates" className="w-full">
                    <TabsList className="grid w-full grid-cols-4">
                      <TabsTrigger value="updates" className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4" />
                        Updates ({importResult.preview.updates.length})
                      </TabsTrigger>
                      <TabsTrigger value="inserts" className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4" />
                        New ({importResult.preview.inserts?.length || 0})
                      </TabsTrigger>
                      <TabsTrigger value="skips" className="flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        Skipped ({importResult.preview.skips.length})
                      </TabsTrigger>
                      <TabsTrigger value="errors" className="flex items-center gap-2">
                        <XCircle className="h-4 w-4" />
                        Errors ({importResult.summary.errors.length})
                      </TabsTrigger>
                    </TabsList>
                    
                    <TabsContent value="updates" className="space-y-2 max-h-64 overflow-y-auto">
                      {importResult.preview.updates.length > 0 ? (
                        importResult.preview.updates.map((update, index) => (
                          <div key={index} className="border rounded-lg p-3 space-y-2">
                            <div className="flex justify-between items-start">
                              <div>
                                <div className="font-mono text-sm font-medium">{update.external_id}</div>
                                <div className="text-sm text-muted-foreground">Row {update.row}</div>
                              </div>
                              <div className="text-right">
                                <Badge variant="outline" className="text-xs">
                                  {update.current_status} → {update.new_status}
                                </Badge>
                              </div>
                            </div>
                            <div className="text-sm text-muted-foreground">{update.reason}</div>
                            {update.data?.partner_status && (
                              <div className="text-xs text-muted-foreground">
                                Partner Status: {update.data.partner_status}
                              </div>
                            )}
                          </div>
                        ))
                      ) : (
                        <div className="text-center py-4 text-muted-foreground">No updates to preview</div>
                      )}
                    </TabsContent>
                    
                    <TabsContent value="skips" className="space-y-2 max-h-64 overflow-y-auto">
                      {importResult.preview.skips.length > 0 ? (
                        importResult.preview.skips.map((skip, index) => (
                          <div key={index} className="border rounded-lg p-3 space-y-2">
                            <div className="flex justify-between items-start">
                              <div>
                                <div className="font-mono text-sm font-medium">{skip.external_id}</div>
                                <div className="text-sm text-muted-foreground">Row {skip.row}</div>
                              </div>
                              <Badge variant="secondary" className="text-xs">Skipped</Badge>
                            </div>
                            <div className="text-sm text-muted-foreground">{skip.reason}</div>
                            {skip.data?.partner_status && (
                              <div className="text-xs text-muted-foreground">
                                Partner Status: {skip.data.partner_status}
                              </div>
                            )}
                          </div>
                        ))
                      ) : (
                        <div className="text-center py-4 text-muted-foreground">No skips to preview</div>
                      )}
                    </TabsContent>
                    
                    <TabsContent value="inserts" className="space-y-2 max-h-64 overflow-y-auto">
                      {importResult.preview.inserts && importResult.preview.inserts.length > 0 ? (
                        importResult.preview.inserts.map((insert, index) => (
                          <div key={index} className="border border-green-200 rounded-lg p-3 space-y-2 bg-green-50">
                            <div className="flex justify-between items-start">
                              <div>
                                <div className="font-mono text-sm font-medium">{insert.external_id}</div>
                                <div className="text-sm text-muted-foreground">Row {insert.row}</div>
                              </div>
                              <Badge variant="default" className="text-xs bg-green-600">New Order</Badge>
                            </div>
                            <div className="text-sm text-green-700">{insert.reason}</div>
                            {insert.data?.partner_status && (
                              <div className="text-xs text-green-600">
                                Partner Status: {insert.data.partner_status}
                              </div>
                            )}
                          </div>
                        ))
                      ) : (
                        <div className="text-center py-4 text-muted-foreground">No new orders to create</div>
                      )}
                    </TabsContent>
                    
                    <TabsContent value="errors" className="space-y-2 max-h-64 overflow-y-auto">
                      {importResult.summary.errors.length > 0 ? (
                        importResult.summary.errors.map((error, index) => (
                          <div key={index} className="border border-red-200 rounded-lg p-3 space-y-2 bg-red-50">
                            <div className="flex justify-between items-start">
                              <div>
                                <div className="text-sm font-medium text-red-700">Row {error.row}</div>
                              </div>
                              <Badge variant="destructive" className="text-xs">Error</Badge>
                            </div>
                            <div className="text-sm text-red-600">{error.error}</div>
                            {error.data && (
                              <div className="text-xs text-red-500 font-mono">
                                {JSON.stringify(error.data, null, 2)}
                              </div>
                            )}
                          </div>
                        ))
                      ) : (
                        <div className="text-center py-4 text-muted-foreground">No errors to show</div>
                      )}
                    </TabsContent>
                  </Tabs>
                )}

                {importResult.summary.warnings.length > 0 && (
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      <strong>{importResult.summary.warnings.length} warnings:</strong>
                      <ul className="mt-2 space-y-1">
                        {importResult.summary.warnings.slice(0, 3).map((warning, index) => (
                          <li key={index} className="text-sm">
                            Row {warning.row}: {warning.warning}
                          </li>
                        ))}
                        {importResult.summary.warnings.length > 3 && (
                          <li className="text-sm font-medium">
                            ... and {importResult.summary.warnings.length - 3} more warnings
                          </li>
                        )}
                      </ul>
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>
          )}

          <div className="flex justify-end space-x-2">
            <Button variant="outline" onClick={handleClose} disabled={isImporting}>
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