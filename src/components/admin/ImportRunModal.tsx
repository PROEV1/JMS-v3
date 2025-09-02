import React, { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle2, XCircle, Clock, Pause, Play, Square, Download } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';

interface ImportResult {
  success: boolean;
  unmapped_engineers?: Array<string>; // Add this to handle blocking
  chunk_info?: {
    start_row: number;
    end_row: number;
    processed_count: number;
    total_rows: number;
    has_more: boolean;
    next_start_row: number | null;
  };
  summary: {
    processed: number;
    inserted_count: number;
    updated_count: number;
    skipped_count: number;
    duplicates_count?: number; // Add duplicates count
    errors: Array<{ row: number; error: string; data?: any }>;
    warnings: Array<{ row: number; warning: string; data?: any }>;
    dry_run?: boolean;
    preview_inserted_count?: number;
    preview_updated_count?: number;
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

interface ChunkedImportProgress {
  currentChunk: number;
  totalChunks: number;
  processedRows: number;
  totalRows: number;
  aggregatedResult: ImportResult;
  isRunning: boolean;
  canCancel: boolean;
}

interface ImportRunModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (csvData?: string, dryRun?: boolean, createMissingOrders?: boolean, startRow?: number, maxRows?: number, totalRows?: number, verbose?: boolean) => Promise<ImportResult | void>;
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
  const [chunkSize, setChunkSize] = useState(200); // Increased default
  const [progress, setProgress] = useState<ChunkedImportProgress | null>(null);
  const cancelledRef = useRef(false);
  const [parallelChunks, setParallelChunks] = useState(1);
  const [verboseLogging, setVerboseLogging] = useState(false);

  const handleImport = async () => {
    setIsImporting(true);
    setImportResult(null);
    setProgress(null);
    cancelledRef.current = false;
    
    try {
      // First, get total row count with minimal data fetch
      const previewResult = await onImport(sourceType === 'csv' ? csvData : undefined, true, createMissingOrders, 0, 1, undefined, verboseLogging) as ImportResult;
      
      if (!previewResult?.chunk_info) {
        throw new Error('Unable to determine total row count');
      }

      const totalRows = previewResult.chunk_info.total_rows;
      
      if (totalRows === 0) {
        throw new Error('No data rows found to import');
      }

      const totalChunks = Math.ceil(totalRows / chunkSize);

      console.log(`Starting ${parallelChunks > 1 ? 'parallel' : 'sequential'} chunked import: ${totalRows} rows, ${totalChunks} chunks of ${chunkSize}`);

      // Initialize aggregated result
      const aggregatedResult: ImportResult = {
        success: true,
        summary: {
          processed: 0,
          inserted_count: 0,
          updated_count: 0,
          skipped_count: 0,
          duplicates_count: 0, // Initialize duplicates count
          errors: [],
          warnings: [],
          dry_run: dryRun
        },
        preview: {
          updates: [],
          skips: [],
          inserts: []
        }
      };

      // Process chunks (sequential or parallel)
      if (parallelChunks === 1) {
        // Sequential processing (original logic)
        let currentStartRow = 0;
        let chunkNum = 0;

        while (currentStartRow < totalRows && !cancelledRef.current) {
          chunkNum++;
          console.log(`Processing chunk ${chunkNum}/${totalChunks}: rows ${currentStartRow + 1}-${Math.min(currentStartRow + chunkSize, totalRows)}`);

          setProgress({
            currentChunk: chunkNum,
            totalChunks,
            processedRows: currentStartRow,
            totalRows,
            aggregatedResult: { ...aggregatedResult },
            isRunning: true,
            canCancel: true
          });

          try {
            const chunkResult = await onImport(
              sourceType === 'csv' ? csvData : undefined, 
              dryRun, 
              createMissingOrders, 
              currentStartRow, 
              chunkSize,
              totalRows, // Pass total rows to avoid recounting
              verboseLogging
            ) as ImportResult;

            if (!chunkResult?.success) {
              throw new Error(chunkResult?.summary?.errors?.[0]?.error || 'Chunk processing failed');
            }

            // Aggregate results
            aggregatedResult.summary.processed += chunkResult.summary.processed;
            aggregatedResult.summary.inserted_count += chunkResult.summary.inserted_count;
            aggregatedResult.summary.updated_count += chunkResult.summary.updated_count;
            aggregatedResult.summary.skipped_count += chunkResult.summary.skipped_count;
            aggregatedResult.summary.duplicates_count = (aggregatedResult.summary.duplicates_count || 0) + (chunkResult.summary.duplicates_count || 0);
            aggregatedResult.summary.errors.push(...chunkResult.summary.errors);
            aggregatedResult.summary.warnings.push(...chunkResult.summary.warnings);

            // Aggregate preview data
            if (chunkResult.preview) {
              aggregatedResult.preview!.updates.push(...(chunkResult.preview.updates || []));
              aggregatedResult.preview!.skips.push(...(chunkResult.preview.skips || []));
              aggregatedResult.preview!.inserts.push(...(chunkResult.preview.inserts || []));
            }

            // Move to next chunk
            currentStartRow = chunkResult.chunk_info?.next_start_row || currentStartRow + chunkSize;
            
            if (!chunkResult.chunk_info?.has_more) {
              break;
            }

          } catch (chunkError: any) {
            console.error(`Chunk ${chunkNum} failed:`, chunkError);
            aggregatedResult.summary.errors.push({
              row: currentStartRow + 1,
              error: `Chunk ${chunkNum} failed: ${chunkError.message}`
            });
            
            // Continue with next chunk or stop based on severity
            if (chunkError.message.includes('CPU') || chunkError.message.includes('timeout')) {
              throw chunkError; // Fatal error, stop processing
            }
            
            currentStartRow += chunkSize; // Skip this chunk
          }
        }

        // Update final progress
        setProgress({
          currentChunk: chunkNum,
          totalChunks,
          processedRows: totalRows,
          totalRows,
          aggregatedResult: { ...aggregatedResult },
          isRunning: false,
          canCancel: false
        });
      } else {
        // Parallel processing
        const chunkPromises: Promise<{ result: ImportResult; startRow: number; chunkNum: number }>[] = [];
        
        for (let chunkNum = 1; chunkNum <= Math.min(parallelChunks, totalChunks) && !cancelledRef.current; chunkNum++) {
          const startRow = (chunkNum - 1) * chunkSize;
          if (startRow >= totalRows) break;
          
          const chunkPromise = onImport(
            sourceType === 'csv' ? csvData : undefined, 
            dryRun, 
            createMissingOrders, 
            startRow, 
            chunkSize,
            totalRows,
            verboseLogging
          ).then(result => ({
            result: result as ImportResult,
            startRow,
            chunkNum
          }));
          
          chunkPromises.push(chunkPromise);
        }

        // Process parallel chunks
        const chunkResults = await Promise.allSettled(chunkPromises);
        let processedRows = 0;
        let completedChunks = 0;
        
        chunkResults.forEach((chunkResult, index) => {
          if (chunkResult.status === 'fulfilled') {
            const { result } = chunkResult.value;
            
            // Aggregate results
            aggregatedResult.summary.processed += result.summary.processed;
            aggregatedResult.summary.inserted_count += result.summary.inserted_count;
            aggregatedResult.summary.updated_count += result.summary.updated_count;
            aggregatedResult.summary.skipped_count += result.summary.skipped_count;
            aggregatedResult.summary.duplicates_count = (aggregatedResult.summary.duplicates_count || 0) + (result.summary.duplicates_count || 0);
            aggregatedResult.summary.errors.push(...result.summary.errors);
            aggregatedResult.summary.warnings.push(...result.summary.warnings);

            // Aggregate preview data
            if (result.preview) {
              aggregatedResult.preview!.updates.push(...(result.preview.updates || []));
              aggregatedResult.preview!.skips.push(...(result.preview.skips || []));
              aggregatedResult.preview!.inserts.push(...(result.preview.inserts || []));
            }
            
            processedRows += result.summary.processed;
            completedChunks++;
          } else {
            aggregatedResult.summary.errors.push({
              row: (index * chunkSize) + 1,
              error: `Parallel chunk ${index + 1} failed: ${chunkResult.reason}`
            });
          }
        });

        // Continue with remaining chunks if there are more
        let currentStartRow = parallelChunks * chunkSize;
        let chunkNum = parallelChunks;
        
        while (currentStartRow < totalRows && !cancelledRef.current) {
          chunkNum++;
          
          setProgress({
            currentChunk: chunkNum,
            totalChunks,
            processedRows: currentStartRow,
            totalRows,
            aggregatedResult: { ...aggregatedResult },
            isRunning: true,
            canCancel: true
          });

          try {
            const chunkResult = await onImport(
              sourceType === 'csv' ? csvData : undefined, 
              dryRun, 
              createMissingOrders, 
              currentStartRow, 
              chunkSize,
              totalRows,
              verboseLogging
            ) as ImportResult;

            if (!chunkResult?.success) {
              throw new Error(chunkResult?.summary?.errors?.[0]?.error || 'Chunk processing failed');
            }

            // Aggregate results
            aggregatedResult.summary.processed += chunkResult.summary.processed;
            aggregatedResult.summary.inserted_count += chunkResult.summary.inserted_count;
            aggregatedResult.summary.updated_count += chunkResult.summary.updated_count;
            aggregatedResult.summary.skipped_count += chunkResult.summary.skipped_count;
            aggregatedResult.summary.duplicates_count = (aggregatedResult.summary.duplicates_count || 0) + (chunkResult.summary.duplicates_count || 0);
            aggregatedResult.summary.errors.push(...chunkResult.summary.errors);
            aggregatedResult.summary.warnings.push(...chunkResult.summary.warnings);

            // Aggregate preview data
            if (chunkResult.preview) {
              aggregatedResult.preview!.updates.push(...(chunkResult.preview.updates || []));
              aggregatedResult.preview!.skips.push(...(chunkResult.preview.skips || []));
              aggregatedResult.preview!.inserts.push(...(chunkResult.preview.inserts || []));
            }

            // Move to next chunk
            currentStartRow = chunkResult.chunk_info?.next_start_row || currentStartRow + chunkSize;
            
            if (!chunkResult.chunk_info?.has_more) {
              break;
            }

          } catch (chunkError: any) {
            console.error(`Chunk ${chunkNum} failed:`, chunkError);
            aggregatedResult.summary.errors.push({
              row: currentStartRow + 1,
              error: `Chunk ${chunkNum} failed: ${chunkError.message}`
            });
            
            currentStartRow += chunkSize; // Skip this chunk
          }
        }

        // Update final progress for parallel processing
        setProgress({
          currentChunk: Math.max(completedChunks, totalChunks),
          totalChunks,
          processedRows: totalRows,
          totalRows,
          aggregatedResult: { ...aggregatedResult },
          isRunning: false,
          canCancel: false
        });
      }

      if (cancelledRef.current) {
        aggregatedResult.summary.errors.push({
          row: 0,
          error: 'Import was cancelled by user'
        });
        aggregatedResult.success = false;
      }

      setImportResult(aggregatedResult);
      
      if (!dryRun && aggregatedResult.success && !cancelledRef.current) {
        setTimeout(() => onClose(), 2000); // Auto-close after 2 seconds on successful live import
      }

    } catch (error: any) {
      console.error('Chunked import failed:', error);
      setImportResult({
        success: false,
        summary: {
          processed: 0,
          inserted_count: 0,
          updated_count: 0,
          skipped_count: 0,
          duplicates_count: 0,
          errors: [{ row: 0, error: error.message }],
          warnings: []
        }
      });
      setProgress(null);
    } finally {
      setIsImporting(false);
    }
  };

  const handleCancel = () => {
    cancelledRef.current = true;
    setIsImporting(false);
  };

  const handleClose = () => {
    if (isImporting) {
      handleCancel();
    }
    setImportResult(null); // Clear results when closing
    setProgress(null);
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

  const downloadErrorReport = (result: ImportResult) => {
    const errors = result.summary.errors || [];
    console.log('Downloading import errors:', errors);
    
    if (errors.length === 0) {
      alert('No errors to download.');
      return;
    }

    const csvData = [
      ['Row Number', 'Error Message', 'Partner External ID', 'Extra Data'],
      ...errors.map(error => [
        String(error.row || ''),
        String(error.error || ''),
        String(error.data?.partner_external_id || ''),
        JSON.stringify(error.data || {})
      ])
    ];

    const csvContent = csvData.map(row => 
      row.map(cell => `"${String(cell).replace(/"/g, '""')}"`)
    ).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `import-errors-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
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
          <DialogDescription>
            Configure and execute the import process for your data source.
          </DialogDescription>
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

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="chunk_size">Rows per Batch</Label>
                <div className="flex items-center space-x-2">
                  <input
                    type="range"
                    id="chunk_size"
                    min="100"
                    max="500"
                    step="50"
                    value={chunkSize}
                    onChange={(e) => setChunkSize(Number(e.target.value))}
                    className="flex-1"
                    disabled={isImporting}
                  />
                  <Badge variant="outline" className="min-w-[60px] text-center">
                    {chunkSize}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  Larger batches are faster but may timeout on slow networks.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="parallel_chunks">Parallel Chunks</Label>
                <div className="flex items-center space-x-2">
                  <input
                    type="range"
                    id="parallel_chunks"
                    min="1"
                    max="4"
                    step="1"
                    value={parallelChunks}
                    onChange={(e) => setParallelChunks(Number(e.target.value))}
                    className="flex-1"
                    disabled={isImporting}
                  />
                  <Badge variant="outline" className="min-w-[40px] text-center">
                    {parallelChunks}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  Process multiple chunks simultaneously for speed.
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="verbose_logging"
                checked={verboseLogging}
                onCheckedChange={setVerboseLogging}
              />
              <Label htmlFor="verbose_logging" className="flex items-center gap-2">
                Verbose Logging
                <Badge variant={verboseLogging ? 'default' : 'secondary'}>
                  {verboseLogging ? 'Detailed' : 'Summary Only'}
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

          {/* Progress Display */}
          {progress && (
            <Card className="border-blue-200 bg-blue-50">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    {progress.isRunning ? (
                      <Play className="h-4 w-4 text-blue-600" />
                    ) : (
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                    )}
                    Processing Import
                  </div>
                  <Badge variant="outline">
                    {progress.currentChunk}/{progress.totalChunks} chunks
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Rows processed:</span>
                    <span className="font-medium">
                      {progress.processedRows?.toLocaleString() || 0} / {progress.totalRows?.toLocaleString() || 'Unknown'}
                    </span>
                  </div>
                  <Progress 
                    value={progress.totalRows ? (progress.processedRows / progress.totalRows) * 100 : 0} 
                    className="h-2"
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="text-center p-2 bg-white rounded">
                    <div className="font-bold text-green-600">{progress.aggregatedResult.summary.inserted_count}</div>
                    <div className="text-green-600">Inserted</div>
                  </div>
                  <div className="text-center p-2 bg-white rounded">
                    <div className="font-bold text-blue-600">{progress.aggregatedResult.summary.updated_count}</div>
                    <div className="text-blue-600">Updated</div>
                  </div>
                  {progress.aggregatedResult.summary.duplicates_count > 0 && (
                    <div className="text-center p-2 bg-white rounded">
                      <div className="font-bold text-orange-600">{progress.aggregatedResult.summary.duplicates_count}</div>
                      <div className="text-orange-600">Duplicates</div>
                    </div>
                  )}
                </div>

                {progress.aggregatedResult.summary.errors.length > 0 && (
                  <Alert className="bg-red-50 border-red-200">
                    <AlertCircle className="h-4 w-4 text-red-600" />
                    <AlertDescription className="text-red-700">
                      <strong>{progress.aggregatedResult.summary.errors.length} errors</strong> encountered so far.
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>
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
                  {importResult.unmapped_engineers ? (
                    `Found ${importResult.unmapped_engineers.length} unmapped engineers - import blocked`
                  ) : (
                    `Processed ${importResult.summary.processed} rows`
                  )}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Unmapped Engineers Blocking UI */}
                {importResult.unmapped_engineers && (
                  <div className="space-y-4">
                    <Alert>
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        <strong>Import Blocked:</strong> The following engineers from your data are not mapped to internal engineers. 
                        Please go back to the Import Profile settings and map these engineers before running the import.
                      </AlertDescription>
                    </Alert>
                    
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Unmapped Engineers:</Label>
                      <div className="flex flex-wrap gap-2">
                        {importResult.unmapped_engineers.map((engineer, index) => (
                          <Badge key={index} variant="destructive" className="text-xs">
                            {engineer}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    
                    <Alert>
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        <strong>Next Steps:</strong>
                        <ol className="mt-2 list-decimal list-inside space-y-1">
                          <li>Close this dialog</li>
                          <li>Edit the Import Profile</li>
                          <li>Add engineer mappings in the "Engineer Mappings" section</li>
                          <li>Map each partner engineer name to an internal engineer</li>
                          <li>Save the profile and try importing again</li>
                        </ol>
                      </AlertDescription>
                    </Alert>
                  </div>
                )}
                
                {/* Normal Import Results */}
                {!importResult.unmapped_engineers && (
                  <>
                     {/* Summary Statistics */}
                     <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                       <div className="text-center p-3 bg-purple-50 rounded-lg">
                         <div className="text-2xl font-bold text-purple-600">
                           {(importResult.summary.inserted_count || 0) + (importResult.summary.updated_count || 0)}
                         </div>
                         <div className="text-sm text-purple-600">{importResult.summary.dry_run ? 'Would Affect' : 'Affected'}</div>
                       </div>
                       <div className="text-center p-3 bg-green-50 rounded-lg">
                         <div className="text-2xl font-bold text-green-600">{importResult.summary.inserted_count}</div>
                         <div className="text-sm text-green-600">{importResult.summary.dry_run ? 'Would Insert' : 'Inserted'}</div>
                       </div>
                       <div className="text-center p-3 bg-blue-50 rounded-lg">
                         <div className="text-2xl font-bold text-blue-600">{importResult.summary.updated_count}</div>
                         <div className="text-sm text-blue-600">{importResult.summary.dry_run ? 'Would Update' : 'Updated'}</div>
                       </div>
                       <div className="text-center p-3 bg-orange-50 rounded-lg">
                         <div className="text-2xl font-bold text-orange-600">{importResult.summary.duplicates_count || 0}</div>
                         <div className="text-sm text-orange-600">Duplicates</div>
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

                {/* Download buttons for errors/warnings */}
                {importResult.summary.errors.length > 0 && (
                  <div className="flex justify-start mt-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => downloadErrorReport(importResult)}
                    >
                      <Download className="h-3 w-3 mr-1" />
                      Download Errors CSV
                    </Button>
                  </div>
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
                </>
              )}
              </CardContent>
            </Card>
          )}

          <div className="flex justify-end space-x-2">
            <Button variant="outline" onClick={handleClose} disabled={false}>
              {isImporting ? 'Close' : 'Cancel'}
            </Button>
            
            {isImporting && progress?.canCancel && (
              <Button variant="destructive" onClick={handleCancel}>
                <Square className="h-4 w-4 mr-2" />
                Cancel Import
              </Button>
            )}
            
            <Button 
              onClick={handleImport} 
              disabled={isImporting || (sourceType === 'csv' && !csvData.trim()) || (importResult?.unmapped_engineers && importResult.unmapped_engineers.length > 0)}
            >
              {isImporting ? (
                <>
                  <Clock className="h-4 w-4 mr-2 animate-spin" />
                  Processing...
                </>
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