import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Trash2, AlertTriangle, BarChart3 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

interface DeletePartnerJobsModalProps {
  isOpen: boolean;
  onClose: () => void;
  partnerId: string;
  partnerName: string;
}

interface DeleteStats {
  orders: number;
  job_offers: number;
  order_activity: number;
  order_completion_checklist: number;
  engineer_uploads: number;
  order_payments: number;
}

interface ImportRun {
  id: string;
  run_id: string;
  created_at: string;
  total_rows: number;
  inserted_count: number;
  updated_count: number;
}

export function DeletePartnerJobsModal({ isOpen, onClose, partnerId, partnerName }: DeletePartnerJobsModalProps) {
  const [selectedRun, setSelectedRun] = useState<string>("all");
  const [confirmationText, setConfirmationText] = useState("");
  const [previewStats, setPreviewStats] = useState<DeleteStats | null>(null);
  const queryClient = useQueryClient();

  // Fetch import runs for this partner
  const { data: importRuns } = useQuery({
    queryKey: ["partner-import-runs", partnerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("partner_import_logs")
        .select("id, run_id, created_at, total_rows, inserted_count, updated_count")
        .eq("partner_id", partnerId)
        .order("created_at", { ascending: false })
        .limit(20);

      if (error) throw error;
      return data as ImportRun[];
    },
    enabled: isOpen
  });

  // Dry run mutation
  const dryRunMutation = useMutation({
    mutationFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('No active session found');
      }

      const { data, error } = await supabase.functions.invoke("admin-delete-partner-jobs", {
        body: {
          partner_id: partnerId,
          import_run_id: selectedRun === "all" ? undefined : selectedRun,
          dry_run: true
        },
        headers: {
          Authorization: `Bearer ${session.access_token}`
        }
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      setPreviewStats(data.stats);
      toast.success("Preview generated successfully");
    },
    onError: (error: any) => {
      toast.error("Failed to generate preview: " + error.message);
    }
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('No active session found');
      }

      const { data, error } = await supabase.functions.invoke("admin-delete-partner-jobs", {
        body: {
          partner_id: partnerId,
          import_run_id: selectedRun === "all" ? undefined : selectedRun,
          dry_run: false
        },
        headers: {
          Authorization: `Bearer ${session.access_token}`
        }
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast.success(`Successfully deleted ${data.stats.orders} orders and related records`);
      queryClient.invalidateQueries({ queryKey: ["partner-import-runs"] });
      onClose();
      setPreviewStats(null);
      setConfirmationText("");
    },
    onError: (error: any) => {
      toast.error("Failed to delete jobs: " + error.message);
    }
  });

  const handlePreview = () => {
    dryRunMutation.mutate();
  };

  const handleDelete = () => {
    if (confirmationText !== "DELETE") {
      toast.error("Please type DELETE to confirm");
      return;
    }
    deleteMutation.mutate();
  };

  const handleClose = () => {
    setPreviewStats(null);
    setConfirmationText("");
    setSelectedRun("all");
    onClose();
  };

  const isDeleteDisabled = confirmationText !== "DELETE" || !previewStats || previewStats.orders === 0;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Trash2 className="h-5 w-5 text-destructive" />
            Delete Partner Jobs
          </DialogTitle>
          <DialogDescription>
            Delete imported jobs for partner: <span className="font-semibold">{partnerName}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <div className="space-y-4">
            <div>
              <Label htmlFor="run-selector">Import Run Scope</Label>
              <Select value={selectedRun} onValueChange={setSelectedRun}>
                <SelectTrigger>
                  <SelectValue placeholder="Select import run" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All partner jobs</SelectItem>
                  {importRuns?.map((run) => (
                    <SelectItem key={run.id} value={run.run_id}>
                      {new Date(run.created_at).toLocaleDateString()} - {run.total_rows} rows 
                      ({run.inserted_count} inserted, {run.updated_count} updated)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-2">
              <Button
                onClick={handlePreview}
                disabled={dryRunMutation.isPending}
                variant="outline"
                className="flex items-center gap-2"
              >
                {dryRunMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <BarChart3 className="h-4 w-4" />
                )}
                Preview Deletion
              </Button>
            </div>
          </div>

          {previewStats && (
            <div className="space-y-4">
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Preview Results:</strong> The following records will be deleted:
                </AlertDescription>
              </Alert>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span>Orders:</span>
                    <span className="font-semibold">{previewStats.orders}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Job Offers:</span>
                    <span>{previewStats.job_offers}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Order Activity:</span>
                    <span>{previewStats.order_activity}</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span>Completion Items:</span>
                    <span>{previewStats.order_completion_checklist}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Engineer Uploads:</span>
                    <span>{previewStats.engineer_uploads}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Payments:</span>
                    <span>{previewStats.order_payments}</span>
                  </div>
                </div>
              </div>

              {previewStats.orders > 0 && (
                <div className="space-y-4 border-t pt-4">
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      <strong>Warning:</strong> This action cannot be undone. All related data will be permanently deleted.
                    </AlertDescription>
                  </Alert>

                  <div>
                    <Label htmlFor="confirmation">Type "DELETE" to confirm deletion:</Label>
                    <Input
                      id="confirmation"
                      value={confirmationText}
                      onChange={(e) => setConfirmationText(e.target.value)}
                      placeholder="DELETE"
                      className="mt-1"
                    />
                  </div>

                  <Button
                    onClick={handleDelete}
                    disabled={isDeleteDisabled || deleteMutation.isPending}
                    variant="destructive"
                    className="w-full"
                  >
                    {deleteMutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Deleting...
                      </>
                    ) : (
                      <>
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete {previewStats.orders} Orders
                      </>
                    )}
                  </Button>
                </div>
              )}

              {previewStats.orders === 0 && (
                <Alert>
                  <AlertDescription>
                    No matching orders found for deletion.
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}