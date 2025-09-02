import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Download, FileText, Calendar } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface ImportLog {
  id: string;
  run_id: string;
  created_at: string;
  total_rows: number;
  inserted_count: number;
  updated_count: number;
  skipped_count: number;
  dry_run: boolean;
  errors: Array<{ row: number; error: string; data?: any }>;
  warnings: Array<{ row: number; warning: string; data?: any }>;
}

interface ImportHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  partnerId: string;
  partnerName: string;
}

export default function ImportHistoryModal({
  isOpen,
  onClose,
  partnerId,
  partnerName
}: ImportHistoryModalProps) {
  const { data: importLogs, isLoading } = useQuery({
    queryKey: ['partner-import-history', partnerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('partner_import_logs')
        .select('*')
        .eq('partner_id', partnerId)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      return data as ImportLog[];
    },
    enabled: isOpen
  });

  const downloadErrorReport = (importLog: ImportLog) => {
    const errors = importLog.errors || [];
    if (errors.length === 0) {
      alert('No errors to download for this import run.');
      return;
    }

    const csvData = [
      ['Row Number', 'Error Message', 'Partner External ID', 'Extra Data'],
      ...errors.map(error => [
        error.row.toString(),
        error.error,
        error.data?.partner_external_id || '',
        JSON.stringify(error.data || {})
      ])
    ];

    const csvContent = csvData.map(row => 
      row.map(cell => `"${cell.replace(/"/g, '""')}"`)
    ).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `import-errors-${importLog.run_id}-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const downloadWarningReport = (importLog: ImportLog) => {
    const warnings = importLog.warnings || [];
    if (warnings.length === 0) {
      alert('No warnings to download for this import run.');
      return;
    }

    const csvData = [
      ['Row Number', 'Warning Message', 'Partner External ID', 'Extra Data'],
      ...warnings.map(warning => [
        warning.row.toString(),
        warning.warning,
        warning.data?.partner_external_id || '',
        JSON.stringify(warning.data || {})
      ])
    ];

    const csvContent = csvData.map(row => 
      row.map(cell => `"${cell.replace(/"/g, '""')}"`)
    ).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `import-warnings-${importLog.run_id}-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Import History - {partnerName}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {isLoading && (
            <div className="text-center py-8">Loading import history...</div>
          )}

          {!isLoading && (!importLogs || importLogs.length === 0) && (
            <div className="text-center py-8 text-muted-foreground">
              No import history found for this partner.
            </div>
          )}

          {importLogs && importLogs.map((log) => (
            <Card key={log.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    {new Date(log.created_at).toLocaleString()}
                    {log.dry_run && (
                      <Badge variant="secondary">Dry Run</Badge>
                    )}
                  </CardTitle>
                  <div className="text-xs text-muted-foreground font-mono">
                    Run ID: {log.run_id}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-4 gap-4 mb-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-primary">
                      {log.total_rows}
                    </div>
                    <div className="text-xs text-muted-foreground">Total Rows</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">
                      {log.inserted_count}
                    </div>
                    <div className="text-xs text-muted-foreground">Inserted</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">
                      {log.updated_count}
                    </div>
                    <div className="text-xs text-muted-foreground">Updated</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-yellow-600">
                      {log.skipped_count}
                    </div>
                    <div className="text-xs text-muted-foreground">Skipped</div>
                  </div>
                </div>

                {((log.errors && log.errors.length > 0) || (log.warnings && log.warnings.length > 0)) && (
                  <div className="flex items-center justify-between pt-4 border-t">
                    <div className="flex items-center gap-4 text-sm">
                      {log.errors && log.errors.length > 0 && (
                        <span className="text-red-600">
                          {log.errors.length} error{log.errors.length > 1 ? 's' : ''}
                        </span>
                      )}
                      {log.warnings && log.warnings.length > 0 && (
                        <span className="text-yellow-600">
                          {log.warnings.length} warning{log.warnings.length > 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                    <div className="flex gap-2">
                      {log.errors && log.errors.length > 0 && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => downloadErrorReport(log)}
                        >
                          <Download className="h-3 w-3 mr-1" />
                          Download Errors
                        </Button>
                      )}
                      {log.warnings && log.warnings.length > 0 && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => downloadWarningReport(log)}
                        >
                          <Download className="h-3 w-3 mr-1" />
                          Download Warnings
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}