import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AlertTriangle, CheckCircle, FileText, Database, TrendingUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface AuditResults {
  sheet_analysis: {
    total_rows: number;
    total_job_ids: number;
    unique_job_ids: number;
    duplicate_job_ids: string[];
    blank_job_ids: number;
    total_emails: number;
    unique_emails: number;
    duplicate_emails: string[];
    blank_emails: number;
    blank_names: number;
  };
  database_analysis: {
    existing_job_ids_count: number;
    existing_job_ids: string[];
    missing_job_ids_count: number;
    missing_job_ids: string[];
    total_orders_for_partner: number;
    total_clients_for_partner: number;
  };
  recommendations: string[];
}

interface PartnerImportAuditModalProps {
  isOpen: boolean;
  onClose: () => void;
  profileId: string;
  profileName: string;
}

export function PartnerImportAuditModal({
  isOpen,
  onClose,
  profileId,
  profileName,
}: PartnerImportAuditModalProps) {
  const [loading, setLoading] = useState(false);
  const [auditResults, setAuditResults] = useState<AuditResults | null>(null);

  const runAudit = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('partner-import-audit', {
        body: { profile_id: profileId }
      });

      if (error) throw error;

      if (data.success) {
        setAuditResults(data.audit_results);
        toast.success("Import audit completed successfully");
      } else {
        throw new Error(data.error || 'Audit failed');
      }
    } catch (error) {
      console.error('Audit error:', error);
      toast.error("Failed to run import audit: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const StatCard = ({ title, value, icon: Icon, variant = "default" }: {
    title: string;
    value: number | string;
    icon: any;
    variant?: "default" | "secondary" | "destructive" | "outline";
  }) => (
    <Card className="relative">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Icon className="h-4 w-4" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">
          <Badge variant={variant}>{value}</Badge>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Import Audit - {profileName}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {!auditResults ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground mb-4">
                Analyze the Google Sheet data and compare with database records to identify import discrepancies.
              </p>
              <Button onClick={runAudit} disabled={loading}>
                {loading ? "Running Audit..." : "Run Import Audit"}
              </Button>
            </div>
          ) : (
            <ScrollArea className="h-[60vh]">
              <div className="space-y-6 pr-4">
                {/* Sheet Analysis */}
                <div>
                  <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Google Sheet Analysis
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <StatCard
                      title="Total Rows"
                      value={auditResults.sheet_analysis.total_rows}
                      icon={FileText}
                    />
                    <StatCard
                      title="Unique Job IDs"
                      value={auditResults.sheet_analysis.unique_job_ids}
                      icon={CheckCircle}
                      variant="secondary"
                    />
                    <StatCard
                      title="Duplicate Job IDs"
                      value={auditResults.sheet_analysis.duplicate_job_ids.length}
                      icon={AlertTriangle}
                      variant={auditResults.sheet_analysis.duplicate_job_ids.length > 0 ? "destructive" : "default"}
                    />
                    <StatCard
                      title="Blank Job IDs"
                      value={auditResults.sheet_analysis.blank_job_ids}
                      icon={AlertTriangle}
                      variant={auditResults.sheet_analysis.blank_job_ids > 0 ? "destructive" : "default"}
                    />
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-4">
                    <StatCard
                      title="Unique Emails"
                      value={auditResults.sheet_analysis.unique_emails}
                      icon={CheckCircle}
                      variant="secondary"
                    />
                    <StatCard
                      title="Blank Emails"
                      value={auditResults.sheet_analysis.blank_emails}
                      icon={AlertTriangle}
                      variant={auditResults.sheet_analysis.blank_emails > 0 ? "destructive" : "default"}
                    />
                    <StatCard
                      title="Blank Names"
                      value={auditResults.sheet_analysis.blank_names}
                      icon={AlertTriangle}
                      variant={auditResults.sheet_analysis.blank_names > 0 ? "destructive" : "default"}
                    />
                  </div>
                </div>

                <Separator />

                {/* Database Analysis */}
                <div>
                  <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                    <Database className="h-5 w-5" />
                    Database Analysis
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <StatCard
                      title="Existing Orders"
                      value={auditResults.database_analysis.total_orders_for_partner}
                      icon={Database}
                    />
                    <StatCard
                      title="Existing Clients"
                      value={auditResults.database_analysis.total_clients_for_partner}
                      icon={Database}
                    />
                    <StatCard
                      title="Job IDs in DB"
                      value={auditResults.database_analysis.existing_job_ids_count}
                      icon={CheckCircle}
                      variant="secondary"
                    />
                    <StatCard
                      title="Missing from DB"
                      value={auditResults.database_analysis.missing_job_ids_count}
                      icon={AlertTriangle}
                      variant={auditResults.database_analysis.missing_job_ids_count > 0 ? "destructive" : "secondary"}
                    />
                  </div>
                </div>

                <Separator />

                {/* Recommendations */}
                <div>
                  <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                    <TrendingUp className="h-5 w-5" />
                    Recommendations
                  </h3>
                  {auditResults.recommendations.length > 0 ? (
                    <div className="space-y-2">
                      {auditResults.recommendations.map((rec, index) => (
                        <div key={index} className="flex items-start gap-2 p-3 bg-muted rounded-lg">
                          <AlertTriangle className="h-4 w-4 text-warning mt-0.5 flex-shrink-0" />
                          <p className="text-sm">{rec}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 p-3 bg-green-50 rounded-lg">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <p className="text-sm text-green-700">No issues found. Import data looks clean!</p>
                    </div>
                  )}
                </div>

                {/* Detailed Lists */}
                {auditResults.sheet_analysis.duplicate_job_ids.length > 0 && (
                  <div>
                    <h4 className="font-medium mb-2">Duplicate Job IDs Found:</h4>
                    <div className="bg-muted p-3 rounded-lg max-h-32 overflow-y-auto">
                      <code className="text-xs">
                        {auditResults.sheet_analysis.duplicate_job_ids.join(', ')}
                      </code>
                    </div>
                  </div>
                )}

                {auditResults.database_analysis.missing_job_ids.length > 0 && (
                  <div>
                    <h4 className="font-medium mb-2">Job IDs Missing from Database (first 50):</h4>
                    <div className="bg-muted p-3 rounded-lg max-h-32 overflow-y-auto">
                      <code className="text-xs">
                        {auditResults.database_analysis.missing_job_ids.slice(0, 50).join(', ')}
                        {auditResults.database_analysis.missing_job_ids.length > 50 && '...'}
                      </code>
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>
          )}

          <div className="flex justify-end gap-2">
            {auditResults && (
              <Button variant="outline" onClick={() => setAuditResults(null)}>
                Run New Audit
              </Button>
            )}
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}