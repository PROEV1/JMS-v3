import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Calendar, 
  User, 
  Clock, 
  MapPin, 
  FileText,
  Edit3
} from "lucide-react";
import { format } from "date-fns";

interface InstallBookingCardProps {
  scheduledDate: string | null;
  timeWindow: string | null;
  engineer: {
    name: string;
    email: string;
  } | null;
  estimatedDuration: number | null;
  internalNotes: string | null;
  jobAddress: string | null;
  onEdit?: () => void;
}

export function InstallBookingCard({
  scheduledDate,
  timeWindow,
  engineer,
  estimatedDuration,
  internalNotes,
  jobAddress,
  onEdit
}: InstallBookingCardProps) {
  const formatDate = (dateString: string | null) => {
    if (!dateString) return null;
    return format(new Date(dateString), 'EEEE do MMMM, yyyy');
  };

  const formatTimeWindow = (window: string | null) => {
    if (!window) return null;
    switch (window) {
      case 'morning': return '8:00 AM - 12:00 PM';
      case 'afternoon': return '12:00 PM - 5:00 PM';
      case 'all_day': return '8:00 AM - 5:00 PM';
      default: return window;
    }
  };

  const isScheduled = scheduledDate && engineer;

  return (
    <Card className={`${isScheduled ? 'border-primary bg-primary/5' : 'border-dashed'}`}>
      <CardContent className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h4 className="font-semibold text-lg">
              {isScheduled ? '📅 Installation Booking' : '⏳ Booking Pending'}
            </h4>
            <p className="text-sm text-muted-foreground">
              {isScheduled ? 'Installation has been scheduled' : 'Awaiting installation scheduling'}
            </p>
          </div>
          {onEdit && (
            <Button variant="outline" size="sm" onClick={onEdit}>
              <Edit3 className="h-4 w-4 mr-2" />
              Change
            </Button>
          )}
        </div>

        {isScheduled ? (
          <div className="space-y-4">
            {/* Main booking details */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <Calendar className="h-5 w-5 text-primary" />
                  <div>
                    <div className="font-medium">{formatDate(scheduledDate)}</div>
                    <div className="text-sm text-muted-foreground">Installation Date</div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <User className="h-5 w-5 text-primary" />
                  <div>
                    <div className="font-medium">{engineer.name}</div>
                    <div className="text-sm text-muted-foreground">{engineer.email}</div>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                {timeWindow && (
                  <div className="flex items-center gap-3">
                    <Clock className="h-5 w-5 text-primary" />
                    <div>
                      <div className="font-medium">{formatTimeWindow(timeWindow)}</div>
                      <div className="text-sm text-muted-foreground">Time Window</div>
                    </div>
                  </div>
                )}

                {estimatedDuration && (
                  <div className="flex items-center gap-3">
                    <Clock className="h-5 w-5 text-primary" />
                    <div>
                      <div className="font-medium">{estimatedDuration} hours</div>
                      <div className="text-sm text-muted-foreground">Estimated Duration</div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Address */}
            {jobAddress && (
              <div className="flex items-start gap-3 pt-2 border-t">
                <MapPin className="h-5 w-5 text-primary mt-0.5" />
                <div>
                  <div className="font-medium">Installation Address</div>
                  <div className="text-sm text-muted-foreground">{jobAddress}</div>
                </div>
              </div>
            )}

            {/* Internal notes */}
            {internalNotes && (
              <div className="flex items-start gap-3 pt-2 border-t">
                <FileText className="h-5 w-5 text-primary mt-0.5" />
                <div>
                  <div className="font-medium">Installation Notes</div>
                  <div className="text-sm text-muted-foreground whitespace-pre-wrap">{internalNotes}</div>
                </div>
              </div>
            )}

            <div className="pt-2 border-t">
              <Badge variant="default" className="bg-green-100 text-green-800 border-green-200">
                ✅ Ready for Installation
              </Badge>
            </div>
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <Calendar className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p className="text-sm">Installation will be scheduled once payment and agreement are complete</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}