import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { AlertTriangle } from "lucide-react";

interface ChargerChangeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (reason: string, description?: string) => void;
  originalCharger: string;
  newCharger: string;
}

const CHANGE_REASONS = [
  { value: "damaged", label: "Original charger damaged" },
  { value: "faulty", label: "Original charger faulty" },
  { value: "missing", label: "Original charger missing" },
  { value: "wrong_model", label: "Wrong model assigned" },
  { value: "client_request", label: "Client requested different model" },
  { value: "better_fit", label: "Better fit for installation" },
  { value: "other", label: "Other reason" }
];

export function ChargerChangeModal({
  isOpen,
  onClose,
  onConfirm,
  originalCharger,
  newCharger
}: ChargerChangeModalProps) {
  const [selectedReason, setSelectedReason] = useState("");
  const [description, setDescription] = useState("");

  const handleConfirm = () => {
    if (!selectedReason) return;
    
    onConfirm(selectedReason, description.trim() || undefined);
    
    // Reset form
    setSelectedReason("");
    setDescription("");
  };

  const handleClose = () => {
    setSelectedReason("");
    setDescription("");
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-warning" />
            Charger Change Required
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="bg-warning/10 border border-warning/20 rounded-lg p-3">
            <p className="text-sm text-warning-foreground">
              You're changing from <strong>{originalCharger}</strong> to <strong>{newCharger}</strong>
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="reason">Reason for change *</Label>
            <Select value={selectedReason} onValueChange={setSelectedReason}>
              <SelectTrigger>
                <SelectValue placeholder="Select a reason..." />
              </SelectTrigger>
              <SelectContent>
                {CHANGE_REASONS.map((reason) => (
                  <SelectItem key={reason.value} value={reason.value}>
                    {reason.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedReason && (
            <div className="space-y-2">
              <Label htmlFor="description">
                Additional details {selectedReason === "other" ? "*" : "(optional)"}
              </Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Provide additional details about the charger change..."
                rows={3}
              />
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button 
            onClick={handleConfirm}
            disabled={!selectedReason || (selectedReason === "other" && !description.trim())}
          >
            Confirm Change
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}