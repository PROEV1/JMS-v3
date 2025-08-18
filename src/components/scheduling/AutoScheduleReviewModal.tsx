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
  selectedCandidate: any; // Currently selected candidate (can be primary or fallback)
  primaryCandidate: any; // Original recommendation
  proposedDate: Date;
  conflicts: string[];
  score: number;
  alternatives: any[]; // All alternative candidates for fallback
  status: 'ready' | 'preflight_checking' | 'preflight_failed' | 'sending' | 'sent' | 'failed';
  statusMessage?: string;
  usedFallback?: number; // Index of fallback used (0 = primary, 1+ = fallback)
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
  const [preflightChecking, setPreflightChecking] = useState(false);

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
              selectedCandidate: assignedCandidate,
              primaryCandidate: assignedCandidate,
              proposedDate: new Date(assignedCandidate.availableDate),
              conflicts: assignedCandidate.reasons.filter(r => r.includes('conflict') || r.includes('warning')),
              score: assignedCandidate.score,
              alternatives: [assignedCandidate, ...alternatives.slice(0, 4)], // Keep primary + 4 alternatives
              status: 'ready'
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

  // Switch to a fallback option for a specific proposal
  const handleUseFallback = async (proposalIndex: number, candidateIndex: number) => {
    const proposal = proposedAssignments[proposalIndex];
    const newCandidate = proposal.alternatives[candidateIndex];
    
    console.log(`Switching order ${proposal.order.order_number} to fallback #${candidateIndex}: ${newCandidate.engineer.name}`);
    
    // Update virtual ledger - remove old assignment
    const oldLedgerKey = `${proposal.selectedCandidate.engineer.id}_${proposal.selectedCandidate.availableDate}`;
    const oldEntry = virtualLedger.get(oldLedgerKey);
    if (oldEntry && oldEntry.jobCount > 0) {
      const updatedOldEntry = {
        ...oldEntry,
        jobCount: oldEntry.jobCount - 1,
        estimatedMinutes: oldEntry.estimatedMinutes - getOrderEstimatedMinutes(proposal.order),
        orders: oldEntry.orders.filter(o => o.id !== proposal.order.id)
      };
      
      if (updatedOldEntry.jobCount === 0) {
        virtualLedger.delete(oldLedgerKey);
      } else {
        virtualLedger.set(oldLedgerKey, updatedOldEntry);
      }
    }
    
    // Add new assignment to virtual ledger
    const newLedgerKey = `${newCandidate.engineer.id}_${newCandidate.availableDate}`;
    const newEntry = virtualLedger.get(newLedgerKey) || {
      engineerId: newCandidate.engineer.id,
      date: newCandidate.availableDate,
      jobCount: 0,
      estimatedMinutes: 0,
      orders: []
    };
    
    const updatedNewEntry = {
      ...newEntry,
      jobCount: newEntry.jobCount + 1,
      estimatedMinutes: newEntry.estimatedMinutes + getOrderEstimatedMinutes(proposal.order),
      orders: [...newEntry.orders, proposal.order]
    };
    
    virtualLedger.set(newLedgerKey, updatedNewEntry);
    
    // Update the proposal
    const updatedProposal = {
      ...proposal,
      selectedCandidate: newCandidate,
      proposedDate: new Date(newCandidate.availableDate),
      usedFallback: candidateIndex,
      status: 'ready' as const
    };
    
    // Update assignments array
    const newAssignments = [...proposedAssignments];
    newAssignments[proposalIndex] = updatedProposal;
    setProposedAssignments(newAssignments);
    
    // Refresh batch capacity info
    const newCapacityInfo = Array.from(virtualLedger.values()).map(entry => ({
      engineerName: proposal.alternatives.find(alt => alt.engineer.id === entry.engineerId)?.engineer.name || 'Unknown',
      date: entry.date,
      currentJobs: 0, // Will be fetched async if needed
      maxJobs: 3, // Default - could fetch from settings
      reservedInBatch: entry.jobCount
    }));
    setBatchCapacityInfo(newCapacityInfo);
    
    toast.success(`Switched to ${newCandidate.engineer.name} for order ${proposal.order.order_number}`);
  };

  // Perform preflight checks before sending offers
  const runPreflightChecks = async () => {
    setPreflightChecking(true);
    console.log('Running preflight capacity checks for all proposals...');
    
    try {
      const updatedAssignments = [...proposedAssignments];
      
      for (let i = 0; i < updatedAssignments.length; i++) {
        const proposal = updatedAssignments[i];
        updatedAssignments[i] = { ...proposal, status: 'preflight_checking' };
        setProposedAssignments([...updatedAssignments]); // Update UI
        
        // Get virtual orders for this engineer/date from current batch
        const virtualOrdersForCheck = Array.from(virtualLedger.values())
          .filter(entry => 
            entry.engineerId === proposal.selectedCandidate.engineer.id && 
            entry.date === proposal.selectedCandidate.availableDate
          )
          .flatMap(entry => entry.orders.filter(o => o.id !== proposal.order.id))
          .map(order => ({
            id: order.id,
            estimated_duration_hours: getOrderEstimatedHours(order)
          }));
        
        const { data: preflightResult, error } = await supabase.functions.invoke('preflight-capacity-check', {
          body: {
            order_id: proposal.order.id,
            engineer_id: proposal.selectedCandidate.engineer.id,
            offered_date: proposal.selectedCandidate.availableDate || proposal.proposedDate.toISOString(),
            virtual_orders: virtualOrdersForCheck
          }
        });
        
        if (error) {
          updatedAssignments[i] = {
            ...proposal,
            status: 'preflight_failed',
            statusMessage: 'Preflight check failed'
          };
        } else if (!preflightResult.canFit) {
          updatedAssignments[i] = {
            ...proposal,
            status: 'preflight_failed',
            statusMessage: preflightResult.reason
          };
        } else {
          updatedAssignments[i] = {
            ...proposal,
            status: 'ready',
            statusMessage: undefined
          };
        }
      }
      
      setProposedAssignments(updatedAssignments);
      
    } catch (error) {
      console.error('Error running preflight checks:', error);
      toast.error('Failed to run preflight capacity checks');
    } finally {
      setPreflightChecking(false);
    }
  };

  const handleSubmitOffers = async () => {
    // First run preflight checks
    await runPreflightChecks();
    
    // Check if any proposals failed preflight
    const failedPreflights = proposedAssignments.filter(p => p.status === 'preflight_failed');
    if (failedPreflights.length > 0) {
      toast.error(`${failedPreflights.length} proposal(s) failed preflight checks. Please use fallback options or adjust assignments.`);
      return;
    }
    
    setSubmitting(true);
    console.log('Starting resilient offer submission with automatic fallbacks for', proposedAssignments.length, 'proposals');
    
    try {
      let successCount = 0;
      let failureCount = 0;
      const updatedAssignments = [...proposedAssignments];

      for (let i = 0; i < updatedAssignments.length; i++) {
        const proposal = updatedAssignments[i];
        let offerSent = false;
        
        // Try all candidates starting from selected
        const selectedIndex = proposal.alternatives.findIndex(alt => alt === proposal.selectedCandidate);
        const candidatesToTry = [
          ...proposal.alternatives.slice(selectedIndex),
          ...proposal.alternatives.slice(0, selectedIndex)
        ];
        
        updatedAssignments[i] = { ...proposal, status: 'sending' };
        setProposedAssignments([...updatedAssignments]);
        
        for (let attemptIndex = 0; attemptIndex < candidatesToTry.length && !offerSent; attemptIndex++) {
          const candidate = candidatesToTry[attemptIndex];
          const isOriginalSelection = candidate === proposal.selectedCandidate;
          const attemptType = isOriginalSelection ? 'selected' : `fallback ${attemptIndex}`;
          
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
              
              if (attemptIndex === candidatesToTry.length - 1) {
                // This was the last candidate
                throw new Error(errorMsg);
              }
              continue; // Try next candidate
            }

            // Success!
            successCount++;
            offerSent = true;
            
            const finalFallbackIndex = proposal.alternatives.findIndex(alt => alt === candidate);
            updatedAssignments[i] = {
              ...proposal,
              status: 'sent',
              statusMessage: `Offer sent to ${candidate.engineer.name}`,
              usedFallback: finalFallbackIndex,
              selectedCandidate: candidate
            };
            
            console.log(`✅ ${attemptType} offer sent successfully for ${proposal.order.order_number} to ${candidate.engineer.name}`);
            
            if (!isOriginalSelection) {
              toast.info(`Order ${proposal.order.order_number}: Used fallback engineer ${candidate.engineer.name}`, {
                duration: 4000
              });
            }
            
          } catch (error) {
            console.error(`${attemptType} attempt failed for order ${proposal.order.order_number}:`, error);
            if (attemptIndex === candidatesToTry.length - 1) {
              // All alternatives exhausted
              failureCount++;
              updatedAssignments[i] = {
                ...proposal,
                status: 'failed',
                statusMessage: `All alternatives exhausted: ${error.message}`
              };
            }
          }
        }
        
        setProposedAssignments([...updatedAssignments]);
      }

      console.log('Resilient offer submission complete. Success:', successCount, 'Failed:', failureCount);

      if (successCount > 0) {
        const message = `Successfully sent ${successCount} installation offer${successCount > 1 ? 's' : ''}${failureCount > 0 ? `, ${failureCount} failed after trying all alternatives` : ''}`;
        toast.success(message);
        onOffersSubmitted?.();
        
        setTimeout(() => {
          onClose();
        }, 2000); // Give time to see the final status
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
                    <Card key={proposal.order.id} className={`${proposal.conflicts.length > 0 ? 'border-warning' : 'border-success'} ${proposal.status === 'preflight_failed' ? 'border-destructive' : ''} ${proposal.status === 'sent' ? 'border-green-500' : ''}`}>
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-lg flex items-center gap-2">
                            {proposal.status === 'sent' ? (
                              <CheckCircle className="w-5 h-5 text-green-500" />
                            ) : proposal.status === 'preflight_failed' || proposal.status === 'failed' ? (
                              <AlertTriangle className="w-5 h-5 text-destructive" />
                            ) : proposal.status === 'preflight_checking' || proposal.status === 'sending' ? (
                              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary"></div>
                            ) : proposal.conflicts.length === 0 ? (
                              <CheckCircle className="w-5 h-5 text-success" />
                            ) : (
                              <AlertTriangle className="w-5 h-5 text-warning" />
                            )}
                            Order #{proposal.order.order_number}
                            {proposal.usedFallback !== undefined && proposal.usedFallback > 0 && (
                              <Badge variant="outline" className="text-xs">
                                Fallback #{proposal.usedFallback}
                              </Badge>
                            )}
                          </CardTitle>
                          <div className="flex items-center gap-2">
                            <Badge variant={proposal.conflicts.length === 0 ? 'default' : 'secondary'}>
                              Score: {Math.round(proposal.score)}
                            </Badge>
                            {proposal.status === 'sent' && (
                              <Badge variant="default" className="bg-green-500">
                                Sent
                              </Badge>
                            )}
                          </div>
                        </div>
                        
                        {/* Status Message */}
                        {proposal.statusMessage && (
                          <p className={`text-sm mt-2 ${
                            proposal.status === 'sent' ? 'text-green-600' : 
                            proposal.status === 'preflight_failed' || proposal.status === 'failed' ? 'text-destructive' :
                            'text-muted-foreground'
                          }`}>
                            {proposal.statusMessage}
                          </p>
                        )}
                      </CardHeader>
                      
                      <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          {/* Order Info */}
                          <div>
                            <Label className="text-sm font-medium text-muted-foreground">Client & Duration</Label>
                            <p className="font-semibold">{proposal.order.client?.full_name}</p>
                            <p className="text-sm text-muted-foreground">
                              {proposal.order.postcode} • {getOrderEstimatedHours(proposal.order)}h job
                            </p>
                          </div>

                          {/* Engineer Assignment */}
                          <div>
                            <Label className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                              <User className="w-4 h-4" />
                              Selected Engineer
                            </Label>
                            <p className="font-semibold">{proposal.selectedCandidate.engineer.name}</p>
                            <p className="text-sm text-muted-foreground">
                              {proposal.selectedCandidate.distance}km • {proposal.selectedCandidate.travelTime}min travel
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

                        {/* Status-specific alerts */}
                        {proposal.status === 'preflight_failed' && (
                          <Alert className="mt-4 border-destructive">
                            <AlertTriangle className="w-4 h-4" />
                            <AlertDescription>
                              <strong>Capacity Check Failed:</strong> {proposal.statusMessage}
                              <br />
                              <span className="text-sm">Please select a fallback option below.</span>
                            </AlertDescription>
                          </Alert>
                        )}

                        {/* Conflicts/Warnings */}
                        {proposal.conflicts.length > 0 && proposal.status !== 'preflight_failed' && (
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

                        {/* Enhanced Fallback Options */}
                        <div className="mt-4 pt-4 border-t">
                          <Label className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-1">
                            <Clock className="w-4 h-4" />
                            Fallback Options ({proposal.alternatives.length} available)
                          </Label>
                          
                          <div className="space-y-2">
                            {proposal.alternatives.slice(0, 5).map((alt: any, altIndex: number) => {
                              const isSelected = alt === proposal.selectedCandidate;
                              const isPrimary = altIndex === 0;
                              
                              return (
                                <div key={altIndex} className={`p-3 rounded border transition-colors ${
                                  isSelected ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
                                } ${proposal.status === 'sent' || proposal.status === 'sending' ? 'opacity-50' : ''}`}>
                                  <div className="flex items-center justify-between">
                                    <div className="flex-1">
                                      <div className="flex items-center gap-2 mb-1">
                                        <span className="font-medium">{alt.engineer.name}</span>
                                        {isPrimary && (
                                          <Badge variant="outline" className="text-xs">Primary</Badge>
                                        )}
                                        {isSelected && (
                                          <Badge variant="default" className="text-xs">Selected</Badge>
                                        )}
                                      </div>
                                      
                                      <div className="grid grid-cols-2 gap-4 text-sm text-muted-foreground">
                                        <div>
                                          <CalendarDays className="w-3 h-3 inline mr-1" />
                                          {new Date(alt.availableDate).toLocaleDateString('en-GB', {
                                            weekday: 'short',
                                            month: 'short', 
                                            day: 'numeric'
                                          })}
                                        </div>
                                        <div>
                                          <Clock className="w-3 h-3 inline mr-1" />
                                          {alt.travelTime}min • {alt.distance}km
                                        </div>
                                      </div>
                                      
                                      {alt.reasons && alt.reasons.length > 0 && (
                                        <div className="mt-1">
                                          <Badge variant="outline" className="text-xs">
                                            {alt.reasons[0]}
                                          </Badge>
                                        </div>
                                      )}
                                    </div>
                                    
                                    {!isSelected && proposal.status === 'ready' && (
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => handleUseFallback(index, altIndex)}
                                        disabled={submitting || preflightChecking}
                                      >
                                        Use This
                                      </Button>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                          
                          <p className="text-xs text-muted-foreground mt-2">
                            {proposal.status === 'ready' ? 
                              'Click "Use This" to switch assignments or these will be tried automatically if the selected option fails.' :
                              'Alternatives are tried automatically if the primary fails during sending.'
                            }
                          </p>
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
              <>
                <Button 
                  variant="outline"
                  onClick={runPreflightChecks}
                  disabled={submitting || preflightChecking}
                  className="flex items-center gap-2"
                >
                  <CheckCircle className="w-4 h-4" />
                  {preflightChecking ? 'Checking...' : 'Preflight Check'}
                </Button>
                <Button 
                  onClick={handleSubmitOffers}
                  disabled={submitting || preflightChecking}
                  className="flex items-center gap-2"
                >
                  <Send className="w-4 h-4" />
                  {submitting ? 'Sending Offers...' : `Send ${proposedAssignments.length} Offer${proposedAssignments.length > 1 ? 's' : ''}`}
                </Button>
              </>
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