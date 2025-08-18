import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import { CalendarDays, Clock, User, AlertTriangle, CheckCircle, Bot, Send } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Order } from '@/utils/schedulingUtils';
import { getSmartEngineerRecommendations } from '@/utils/schedulingUtils';

interface Engineer {
  id: string;
  name: string;
  email: string;
}

interface ProposedAssignment {
  order: Order;
  recommendedEngineer: any;
  proposedDate: Date;
  conflicts: string[];
  score: number;
}

interface AutoScheduleReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  orders: Order[];
  engineers: Engineer[];
  onOffersSubmitted?: () => void;
}

export function AutoScheduleReviewModal({
  isOpen,
  onClose,
  orders,
  engineers,
  onOffersSubmitted
}: AutoScheduleReviewModalProps) {
  const [proposedAssignments, setProposedAssignments] = useState<ProposedAssignment[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [generated, setGenerated] = useState(false);

  useEffect(() => {
    if (isOpen && orders.length > 0 && !generated) {
      generateProposals();
    }
  }, [isOpen, orders, generated]);

  const generateProposals = async () => {
    setLoading(true);
    try {
      const proposals: ProposedAssignment[] = [];
      
      for (const order of orders) {
        try {
          // Get smart recommendations for this order
          const recommendations = await getSmartEngineerRecommendations(order, order.postcode, {
            startDate: new Date()
          });

          if (recommendations.recommendations && recommendations.recommendations.length > 0) {
            const bestEngineer = recommendations.recommendations[0];
            
            proposals.push({
              order,
              recommendedEngineer: bestEngineer,
              proposedDate: new Date(bestEngineer.availableDate),
              conflicts: bestEngineer.reasons.filter(r => r.includes('conflict') || r.includes('warning')),
              score: bestEngineer.score
            });
          }
        } catch (error) {
          console.error(`Error getting recommendations for order ${order.id}:`, error);
          // Continue with other orders
        }
      }

      setProposedAssignments(proposals);
      setGenerated(true);
    } catch (error) {
      console.error('Error generating proposals:', error);
      toast.error('Failed to generate scheduling proposals');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitOffers = async () => {
    setSubmitting(true);
    try {
      let successCount = 0;
      let failureCount = 0;

      // Send offers for all proposed assignments
      for (const proposal of proposedAssignments) {
        try {
          const { data, error } = await supabase.functions.invoke('send-offer', {
            body: {
              order_id: proposal.order.id,
              engineer_id: proposal.recommendedEngineer.engineer.id,
              offered_date: proposal.proposedDate.toISOString(),
              time_window: 'AM (9:00 - 12:00)', // Default time window
              delivery_channel: 'email'
            }
          });

          if (error || data?.error) {
            throw new Error(data?.error || 'Failed to send offer');
          }

          successCount++;
        } catch (error) {
          console.error(`Failed to send offer for order ${proposal.order.order_number}:`, error);
          failureCount++;
        }
      }

      if (successCount > 0) {
        toast.success(`Successfully sent ${successCount} installation offer${successCount > 1 ? 's' : ''}${failureCount > 0 ? `, ${failureCount} failed` : ''}`);
        onOffersSubmitted?.();
        onClose();
      } else {
        toast.error('Failed to send any offers');
      }

    } catch (error) {
      console.error('Error submitting offers:', error);
      toast.error('Failed to submit offers');
    } finally {
      setSubmitting(false);
    }
  };

  const hasConflicts = proposedAssignments.some(p => p.conflicts.length > 0);

  const handleClose = () => {
    if (!loading && !submitting) {
      setGenerated(false);
      setProposedAssignments([]);
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-5xl h-[90vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Bot className="w-5 h-5" />
            Auto-Schedule & Review
          </DialogTitle>
          <DialogDescription>
            Review AI-generated scheduling proposals for {orders.length} job{orders.length > 1 ? 's' : ''} before sending offers
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-hidden">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mb-4"></div>
              <p className="text-muted-foreground">Generating smart scheduling proposals...</p>
              <p className="text-sm text-muted-foreground mt-2">Analyzing engineer availability, travel times, and workloads</p>
            </div>
          ) : proposedAssignments.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64">
              <AlertTriangle className="w-12 h-12 text-warning mb-4" />
              <p className="text-muted-foreground">No scheduling proposals could be generated</p>
              <p className="text-sm text-muted-foreground mt-2">Check engineer availability and service areas</p>
            </div>
          ) : (
            <>
              {/* Summary */}
              <div className="grid grid-cols-3 gap-4 mb-6">
                <Card>
                  <CardContent className="pt-4">
                    <div className="text-center">
                      <p className="text-2xl font-bold text-primary">{proposedAssignments.length}</p>
                      <p className="text-sm text-muted-foreground">Proposals Generated</p>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <div className="text-center">
                      <p className="text-2xl font-bold text-success">{proposedAssignments.filter(p => p.conflicts.length === 0).length}</p>
                      <p className="text-sm text-muted-foreground">No Conflicts</p>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <div className="text-center">
                      <p className="text-2xl font-bold text-warning">{proposedAssignments.filter(p => p.conflicts.length > 0).length}</p>
                      <p className="text-sm text-muted-foreground">With Warnings</p>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Conflicts Alert */}
              {hasConflicts && (
                <Alert className="mb-4">
                  <AlertTriangle className="w-4 h-4" />
                  <AlertDescription>
                    Some proposals have warnings or conflicts. Review carefully before proceeding.
                  </AlertDescription>
                </Alert>
              )}

              {/* Proposals List */}
              <ScrollArea className="flex-1 h-0">
                <div className="space-y-4 pr-4">
                  {proposedAssignments.map((proposal, index) => (
                    <Card key={proposal.order.id} className={proposal.conflicts.length > 0 ? 'border-warning' : 'border-success'}>
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-lg flex items-center gap-2">
                            {proposal.conflicts.length === 0 ? (
                              <CheckCircle className="w-5 h-5 text-success" />
                            ) : (
                              <AlertTriangle className="w-5 h-5 text-warning" />
                            )}
                            Order #{proposal.order.order_number}
                          </CardTitle>
                          <Badge variant={proposal.conflicts.length === 0 ? 'default' : 'secondary'}>
                            Score: {Math.round(proposal.score)}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          {/* Order Info */}
                          <div>
                            <Label className="text-sm font-medium text-muted-foreground">Client</Label>
                            <p className="font-semibold">{proposal.order.client?.full_name}</p>
                            <p className="text-sm text-muted-foreground">{proposal.order.postcode}</p>
                          </div>

                          {/* Engineer Assignment */}
                          <div>
                            <Label className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                              <User className="w-4 h-4" />
                              Assigned Engineer
                            </Label>
                            <p className="font-semibold">{proposal.recommendedEngineer.engineer.name}</p>
                            <p className="text-sm text-muted-foreground">
                              {proposal.recommendedEngineer.distance}km • {proposal.recommendedEngineer.travelTime}min travel
                            </p>
                          </div>

                          {/* Proposed Date */}
                          <div>
                            <Label className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                              <CalendarDays className="w-4 h-4" />
                              Proposed Date
                            </Label>
                            <p className="font-semibold">
                              {proposal.proposedDate.toLocaleDateString('en-GB', {
                                weekday: 'short',
                                month: 'short',
                                day: 'numeric'
                              })}
                            </p>
                            <p className="text-sm text-muted-foreground">Morning slot</p>
                          </div>
                        </div>

                        {/* Conflicts/Warnings */}
                        {proposal.conflicts.length > 0 && (
                          <div className="mt-4 pt-4 border-t">
                            <Label className="text-sm font-medium text-warning mb-2 flex items-center gap-1">
                              <AlertTriangle className="w-4 h-4" />
                              Warnings
                            </Label>
                            <div className="space-y-1">
                              {proposal.conflicts.map((conflict, i) => (
                                <p key={i} className="text-sm text-muted-foreground">
                                  • {conflict}
                                </p>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Reasons */}
                        <div className="mt-4 pt-4 border-t">
                          <Label className="text-sm font-medium text-muted-foreground mb-2">Recommendation Factors</Label>
                          <div className="flex flex-wrap gap-1">
                            {proposal.recommendedEngineer.reasons.slice(0, 3).map((reason: string, i: number) => (
                              <Badge key={i} variant="outline" className="text-xs">
                                {reason}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </ScrollArea>
            </>
          )}
        </div>

        {/* Actions */}
        <div className="flex-shrink-0 flex justify-between items-center pt-4 border-t">
          <div className="text-sm text-muted-foreground">
            {proposedAssignments.length > 0 && (
              <>Offers will be sent via email with 24-hour expiration</>
            )}
          </div>
          <div className="flex gap-3">
            <Button 
              variant="outline" 
              onClick={handleClose}
              disabled={loading || submitting}
            >
              Cancel
            </Button>
            {!loading && proposedAssignments.length > 0 && (
              <Button 
                onClick={handleSubmitOffers}
                disabled={submitting}
                className="flex items-center gap-2"
              >
                <Send className="w-4 h-4" />
                {submitting ? 'Sending Offers...' : `Send ${proposedAssignments.length} Offer${proposedAssignments.length > 1 ? 's' : ''}`}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Label({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={className}>{children}</div>;
}