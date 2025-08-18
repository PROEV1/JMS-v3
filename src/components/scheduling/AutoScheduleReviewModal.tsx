import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import { CalendarDays, Clock, User, AlertTriangle, CheckCircle, Bot, Send, Package } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Order, EngineerSettings, getOrderEstimatedHours, getOrderEstimatedMinutes } from '@/utils/schedulingUtils';
import { getSmartEngineerRecommendations, getSchedulingSettings, getAllEngineersForScheduling, getEngineerDailyWorkload } from '@/utils/schedulingUtils';
import { calculateDayFit } from '@/utils/dayFitUtils';

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
  alternatives?: any[]; // Store alternative candidates for fallback
}

interface VirtualLedgerEntry {
  engineerId: string;
  date: string;
  jobCount: number;
  estimatedMinutes: number;
  orders: Order[];
}

interface BatchCapacityInfo {
  engineerName: string;
  date: string;
  currentJobs: number;
  maxJobs: number;
  reservedInBatch: number;
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
  const [virtualLedger, setVirtualLedger] = useState<Map<string, VirtualLedgerEntry>>(new Map());
  const [batchCapacityInfo, setBatchCapacityInfo] = useState<BatchCapacityInfo[]>([]);

  useEffect(() => {
    if (isOpen && orders.length > 0 && !generated) {
      generateProposals();
    }
  }, [isOpen, orders, generated]);

  const generateProposals = async () => {
    setLoading(true);
    console.log('Starting intelligent batch scheduling for', orders.length, 'orders with virtual capacity tracking');
    
    try {
      const settings = await getSchedulingSettings();
      const allEngineers = await getAllEngineersForScheduling();
      const proposals: ProposedAssignment[] = [];
      const ledger = new Map<string, VirtualLedgerEntry>();
      const capacityInfo: BatchCapacityInfo[] = [];
      
      console.log('Loaded', allEngineers.length, 'engineers and settings:', settings);
      
      for (const order of orders) {
        try {
          console.log(`\n🔄 Processing order ${order.order_number} (${orders.indexOf(order) + 1}/${orders.length})`);
          
          // Get all recommendations for this order
          const recommendations = await getSmartEngineerRecommendations(order, order.postcode, {
            startDate: new Date()
          });

          console.log(`Found ${recommendations.recommendations?.length || 0} candidates for order ${order.order_number}`);

          if (!recommendations.recommendations || recommendations.recommendations.length === 0) {
            console.log('❌ No recommendations found for order:', order.order_number);
            continue;
          }

          let assignedCandidate = null;
          const alternatives: any[] = [];

          // Try each candidate in order of preference
          for (let i = 0; i < recommendations.recommendations.length; i++) {
            const candidate = recommendations.recommendations[i];
            const ledgerKey = `${candidate.engineer.id}_${candidate.availableDate}`;
            
            console.log(`  🔍 Checking candidate ${i + 1}: ${candidate.engineer.name} on ${candidate.availableDate}`);
            
            // Get current virtual ledger entry for this engineer/date
            const virtualEntry = ledger.get(ledgerKey) || {
              engineerId: candidate.engineer.id,
              date: candidate.availableDate,
              jobCount: 0,
              estimatedMinutes: 0,
              orders: []
            };

            // Get current database workload for this engineer/date
            const currentWorkload = await getEngineerDailyWorkload(candidate.engineer.id, candidate.availableDate);
            const totalVirtualJobs = currentWorkload + virtualEntry.jobCount;
            
            // Check job count limit
            if (totalVirtualJobs >= settings.max_jobs_per_day) {
              console.log(`  ❌ Job limit exceeded: ${totalVirtualJobs}/${settings.max_jobs_per_day} jobs`);
              alternatives.push(candidate); // Still keep as alternative
              continue;
            }

            // Find engineer settings for capacity check
            const engineerSettings = allEngineers.find(e => e.id === candidate.engineer.id);
            if (!engineerSettings) {
              console.log(`  ❌ Engineer settings not found`);
              alternatives.push(candidate);
              continue;
            }

            // Check if adding this order would exceed daily capacity using virtual orders
            const virtualOrders = virtualEntry.orders.map(vOrder => ({
              ...vOrder,
              estimated_duration_hours: getOrderEstimatedHours(vOrder)
            }));

            try {
              const dayFit = await calculateDayFit(
                engineerSettings,
                new Date(candidate.availableDate),
                order,
                settings.day_lenience_minutes || 15,
                virtualOrders
              );

              if (!dayFit.canFit) {
                console.log(`  ❌ Capacity exceeded: ${dayFit.reasons.join(', ')}`);
                alternatives.push(candidate);
                continue;
              }

              // ✅ This candidate fits! Update virtual ledger
              const updatedEntry: VirtualLedgerEntry = {
                ...virtualEntry,
                jobCount: virtualEntry.jobCount + 1,
                estimatedMinutes: virtualEntry.estimatedMinutes + getOrderEstimatedMinutes(order),
                orders: [...virtualEntry.orders, order]
              };
              
              ledger.set(ledgerKey, updatedEntry);
              assignedCandidate = candidate;
              
              // Update capacity info for UI
              const existingCapacityIndex = capacityInfo.findIndex(info => 
                info.engineerName === candidate.engineer.name && info.date === candidate.availableDate
              );
              
              if (existingCapacityIndex >= 0) {
                capacityInfo[existingCapacityIndex].reservedInBatch++;
              } else {
                capacityInfo.push({
                  engineerName: candidate.engineer.name,
                  date: candidate.availableDate,
                  currentJobs: currentWorkload,
                  maxJobs: settings.max_jobs_per_day,
                  reservedInBatch: 1
                });
              }

              console.log(`  ✅ Assigned to ${candidate.engineer.name} on ${candidate.availableDate} (${totalVirtualJobs + 1}/${settings.max_jobs_per_day} jobs)`);
              break;
              
            } catch (error) {
              console.error(`  ❌ Error checking day fit:`, error);
              alternatives.push(candidate);
              continue;
            }
          }

          if (assignedCandidate) {
            proposals.push({
              order,
              recommendedEngineer: assignedCandidate,
              proposedDate: new Date(assignedCandidate.availableDate),
              conflicts: assignedCandidate.reasons.filter(r => r.includes('conflict') || r.includes('warning')),
              score: assignedCandidate.score,
              alternatives: alternatives.slice(0, 3) // Keep top 3 alternatives
            });
          } else {
            console.log(`❌ No suitable candidate found for order ${order.order_number} after virtual capacity check`);
          }
          
        } catch (error) {
          console.error(`Error processing order ${order.order_number}:`, error);
        }
      }

      console.log(`\n🎯 Batch scheduling complete: ${proposals.length}/${orders.length} orders scheduled`);
      console.log('Virtual capacity reservations:', Array.from(ledger.values()));

      setVirtualLedger(ledger);
      setBatchCapacityInfo(capacityInfo);
      setProposedAssignments(proposals);
      setGenerated(true);
      
    } catch (error) {
      console.error('Error in intelligent batch scheduling:', error);
      toast.error('Failed to generate intelligent scheduling proposals');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitOffers = async () => {
    setSubmitting(true);
    console.log('Starting resilient offer submission with fallback alternatives for', proposedAssignments.length, 'proposals');
    
    try {
      let successCount = 0;
      let failureCount = 0;

      for (const proposal of proposedAssignments) {
        let offerSent = false;
        
        // Try primary assignment first
        const candidates = [proposal.recommendedEngineer, ...(proposal.alternatives || [])];
        
        for (let attemptIndex = 0; attemptIndex < candidates.length && !offerSent; attemptIndex++) {
          const candidate = candidates[attemptIndex];
          const attemptType = attemptIndex === 0 ? 'primary' : `fallback ${attemptIndex}`;
          
          try {
            console.log(`Sending ${attemptType} offer for order ${proposal.order.order_number} to ${candidate.engineer.name}`);
            
            const offerData = {
              order_id: proposal.order.id,
              engineer_id: candidate.engineer.id,
              offered_date: candidate.availableDate || proposal.proposedDate.toISOString(),
              time_window: 'AM (9:00 - 12:00)',
              delivery_channel: 'email'
            };

            const { data, error } = await supabase.functions.invoke('send-offer', {
              body: offerData
            });

            if (error || data?.error) {
              const errorMsg = data?.error || 'Failed to send offer';
              console.log(`${attemptType} offer failed for ${proposal.order.order_number}: ${errorMsg}`);
              
              if (attemptIndex === candidates.length - 1) {
                // This was the last candidate
                throw new Error(errorMsg);
              }
              // Try next candidate
              continue;
            }

            // Success!
            successCount++;
            offerSent = true;
            console.log(`✅ ${attemptType} offer sent successfully for ${proposal.order.order_number} to ${candidate.engineer.name}`);
            
            if (attemptIndex > 0) {
              toast.info(`Order ${proposal.order.order_number}: Used fallback engineer ${candidate.engineer.name}`, {
                duration: 4000
              });
            }
            
          } catch (error) {
            console.error(`${attemptType} attempt failed for order ${proposal.order.order_number}:`, error);
            if (attemptIndex === candidates.length - 1) {
              // All alternatives exhausted
              failureCount++;
              toast.error(`Failed to send offer for order ${proposal.order.order_number}: all alternatives exhausted`);
            }
          }
        }
      }

      console.log('Resilient offer submission complete. Success:', successCount, 'Failed:', failureCount);

      if (successCount > 0) {
        const message = `Successfully sent ${successCount} installation offer${successCount > 1 ? 's' : ''}${failureCount > 0 ? `, ${failureCount} failed after trying all alternatives` : ''}`;
        toast.success(message);
        onOffersSubmitted?.();
        onClose();
      } else {
        toast.error('Failed to send any offers despite trying alternatives');
      }

    } catch (error) {
      console.error('Error in resilient offer submission:', error);
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
      setVirtualLedger(new Map());
      setBatchCapacityInfo([]);
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
              <div className="grid grid-cols-4 gap-4 mb-6">
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
                <Card>
                  <CardContent className="pt-4">
                    <div className="text-center">
                      <p className="text-2xl font-bold text-accent">{batchCapacityInfo.length}</p>
                      <p className="text-sm text-muted-foreground">Slots Reserved</p>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Virtual Capacity Info */}
              {batchCapacityInfo.length > 0 && (
                <Card className="mb-4 border-accent/20 bg-accent/5">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Package className="w-4 h-4 text-accent" />
                      Intelligent Slot Reservation Active
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 text-sm">
                      {batchCapacityInfo.map((info, index) => (
                        <div key={index} className="flex items-center justify-between p-2 bg-background rounded border">
                          <span className="font-medium">{info.engineerName}</span>
                          <Badge variant="outline" className="text-xs">
                            {info.date}: {info.currentJobs + info.reservedInBatch}/{info.maxJobs}
                            {info.reservedInBatch > 0 && (
                              <span className="ml-1 text-accent">+{info.reservedInBatch}</span>
                            )}
                          </Badge>
                        </div>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      Reserved slots prevent double-booking during batch scheduling
                    </p>
                  </CardContent>
                </Card>
              )}

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
              <ScrollArea className="flex-1 h-full">
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

                        {/* Alternatives Info */}
                        {proposal.alternatives && proposal.alternatives.length > 0 && (
                          <div className="mt-4 pt-4 border-t">
                            <Label className="text-sm font-medium text-muted-foreground mb-2">Fallback Options</Label>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              {proposal.alternatives.slice(0, 2).map((alt: any, i: number) => (
                                <div key={i} className="text-xs p-2 bg-muted/30 rounded border">
                                  <div className="font-medium">{alt.engineer.name}</div>
                                  <div className="text-muted-foreground">
                                    {new Date(alt.availableDate).toLocaleDateString('en-GB', { 
                                      month: 'short', 
                                      day: 'numeric' 
                                    })} • {alt.travelTime}min
                                  </div>
                                </div>
                              ))}
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                              Used automatically if primary assignment fails
                            </p>
                          </div>
                        )}
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