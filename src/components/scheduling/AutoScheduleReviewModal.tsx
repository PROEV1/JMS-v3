import { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import { CalendarDays, Clock, User, AlertTriangle, CheckCircle, Bot, Send, Package, MapPin } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Order, EngineerSettings, getOrderEstimatedHours, getOrderEstimatedMinutes } from '@/utils/schedulingUtils';
import { getSmartEngineerRecommendations, getSchedulingSettings, getAllEngineersForSchedulingFast, getEngineerDailyWorkload, getClientBlockedDatesMap, getWorkloadMap, getEngineerSlotPool } from '@/utils/schedulingUtils';
import { calculateDayFit, getWorkingDayInfo } from '@/utils/dayFitUtils';
import { getLocationDisplayText } from '@/utils/postcodeUtils';

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

interface UnscheduledOrder {
  order: Order;
  reason: string;
  details?: string;
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
  const [unscheduledOrders, setUnscheduledOrders] = useState<UnscheduledOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [generated, setGenerated] = useState(false);
  const [virtualLedger, setVirtualLedger] = useState<Map<string, VirtualLedgerEntry>>(new Map());
  const [batchCapacityInfo, setBatchCapacityInfo] = useState<BatchCapacityInfo[]>([]);
  const [preflightChecking, setPreflightChecking] = useState(false);
  const [progressCurrent, setProgressCurrent] = useState(0);
  const [progressTotal, setProgressTotal] = useState(0);
  const [progressText, setProgressText] = useState('');
  // Cache for workload lookups to speed up generation
  const [workloadCache, setWorkloadCache] = useState<Map<string, number>>(new Map());
  // Ref to prevent concurrent generation runs
  const isGeneratingRef = useRef(false);
  // Cancel flag for interrupting long operations
  const [isCancelled, setIsCancelled] = useState(false);
  const cancelledRef = useRef(false);
  // Snapshot of orders when generation starts (to prevent flickering from prop changes)
  const ordersSnapshotRef = useRef<Order[]>([]);
  // Multi-pass scheduling options (default to ON for better success)
  const [guaranteeSchedule, setGuaranteeSchedule] = useState(true);
  // Auto-fix preflight failures option
  const [autoFixPreflightFailures, setAutoFixPreflightFailures] = useState(true);
  // Diagnostics
  const [diagnostics, setDiagnostics] = useState<{
    mapbox429Count: number;
    fallbacksUsed: number;
    unboundedMatches: number;
  }>({ mapbox429Count: 0, fallbacksUsed: 0, unboundedMatches: 0 });

  useEffect(() => {
    if (isOpen && orders.length > 0 && !generated && !isGeneratingRef.current) {
      generateProposals();
    }
  }, [isOpen, orders, generated]);

  const generateProposals = async () => {
    // Prevent concurrent runs
    if (isGeneratingRef.current) {
      console.log('⚠️ Generation already in progress, ignoring new request');
      return;
    }
    
    isGeneratingRef.current = true;
    setLoading(true);
    setGenerated(true); // Set early to prevent new triggers
    setIsCancelled(false);
    cancelledRef.current = false;
    
    // Capture orders snapshot to prevent flickering from prop changes
    const ordersSnapshot = [...orders];
    ordersSnapshotRef.current = ordersSnapshot;
    
    setProgressCurrent(0);
    setProgressTotal(ordersSnapshot.length);
    setProgressText('Initializing bulk data loading...');
    console.log('🚀 Starting FAST intelligent batch scheduling for', ordersSnapshot.length, 'orders');
    
    try {
      // STEP 1: Bulk-load all data upfront
      setProgressText('Loading engineers and settings...');
      const settings = await getSchedulingSettings();
      const allEngineers = await getAllEngineersForSchedulingFast(); // 🚀 FAST VERSION
      
      if (cancelledRef.current) {
        console.log('❌ Cancelled during engineer loading');
        return;
      }

      setProgressText('Fetching client blocked dates...');
      const clientIds = [...new Set(ordersSnapshot.map(o => o.client_id))];
      const clientBlockedDatesMap = await getClientBlockedDatesMap(clientIds); // 🚀 BULK FETCH
      
      if (cancelledRef.current) {
        console.log('❌ Cancelled during blocked dates loading');
        return;
      }

      setProgressText('Precomputing workload map...');
      const engineerIds = allEngineers.map(e => e.id);
      const startDate = new Date().toISOString().split('T')[0];
      const workloadMap = await getWorkloadMap(engineerIds, startDate, 90); // 🚀 PRECOMPUTE 90 days
      
      if (cancelledRef.current) {
        console.log('❌ Cancelled during workload precomputation');
        return;
      }

      console.log(`✅ Bulk data loaded: ${allEngineers.length} engineers, ${clientBlockedDatesMap.size} clients with blocked dates, ${workloadMap.size} workload entries`);
      
      // Helper function to get workload from precomputed map
      const workloadLookup = (engineerId: string, date: string): number => {
        return workloadMap.get(`${engineerId}_${date}`) || 0;
      };

      const proposals: ProposedAssignment[] = [];
      const unscheduled: UnscheduledOrder[] = [];
      const ledger = new Map<string, VirtualLedgerEntry>();
      const capacityInfo: BatchCapacityInfo[] = [];
      
      // STEP 2: Process orders with concurrency
      const CONCURRENCY_LIMIT = 6; // Process 6 orders at a time
      let passNumber = 1;
      const maxPasses = guaranteeSchedule ? 3 : 1;
      
      setProgressText('Processing orders with smart recommendations...');
      
      // PASS 1: Standard fast mode (top 6, 30 days)
      await processOrdersInPasses(
        ordersSnapshot, allEngineers, settings, workloadLookup, 
        clientBlockedDatesMap, proposals, unscheduled, ledger, capacityInfo, 
        CONCURRENCY_LIMIT, 1, maxPasses
      );
      
      // PASS 2: Enhanced mode for unscheduled (top 12, 60 days, relaxed travel)
      if (guaranteeSchedule && unscheduled.length > 0 && passNumber < maxPasses) {
        console.log(`🔄 PASS 2: Re-attempting ${unscheduled.length} unscheduled orders with expanded criteria`);
        setProgressText(`Pass 2: Expanding search for ${unscheduled.length} remaining orders...`);
        
        const remainingOrders = unscheduled.map(u => u.order);
        unscheduled.length = 0; // Clear for second pass
        
        await processOrdersInPasses(
          remainingOrders, allEngineers, settings, workloadLookup,
          clientBlockedDatesMap, proposals, unscheduled, ledger, capacityInfo,
          CONCURRENCY_LIMIT, 2, maxPasses
        );
      }
      
      // PASS 3: Maximum expansion for critical orders (top 24, 90 days, allow overfill)
      if (guaranteeSchedule && unscheduled.length > 0 && passNumber < maxPasses) {
        console.log(`🔄 PASS 3: Final attempt for ${unscheduled.length} orders with maximum expansion`);
        setProgressText(`Pass 3: Final scheduling attempt with expanded capacity...`);
        
        const remainingOrders = unscheduled.map(u => u.order).sort((a, b) => 
          (getOrderEstimatedHours(b) || 0) - (getOrderEstimatedHours(a) || 0)
        );
        unscheduled.length = 0; // Clear for final pass
        
        await processOrdersInPasses(
          remainingOrders, allEngineers, settings, workloadLookup,
          clientBlockedDatesMap, proposals, unscheduled, ledger, capacityInfo,
          CONCURRENCY_LIMIT, 3, maxPasses
        );
      }

      console.log(`\n🎯 Multi-pass scheduling complete: ${proposals.length}/${ordersSnapshot.length} orders scheduled`);
      console.log('Virtual capacity reservations:', Array.from(ledger.values()));

      setVirtualLedger(ledger);
      setBatchCapacityInfo(capacityInfo);
      setProposedAssignments(proposals);
      setUnscheduledOrders(unscheduled);
      
    } catch (error) {
      console.error('Error in multi-pass intelligent batch scheduling:', error);
      toast.error('Failed to generate intelligent scheduling proposals');
      setGenerated(false); // Reset on error to allow retry
    } finally {
      setLoading(false);
      setProgressCurrent(0);
      setProgressTotal(0);
      setProgressText('');
      isGeneratingRef.current = false; // Always reset the guard
    }
  };

  // Process orders in passes with different criteria
  const processOrdersInPasses = async (
    ordersToProcess: Order[],
    allEngineers: EngineerSettings[],
    settings: any,
    workloadLookup: (engineerId: string, date: string) => number,
    clientBlockedDatesMap: Map<string, Set<string>>,
    proposals: ProposedAssignment[],
    unscheduled: UnscheduledOrder[],
    ledger: Map<string, VirtualLedgerEntry>,
    capacityInfo: BatchCapacityInfo[],
    concurrencyLimit: number,
    passNumber: number,
    maxPasses: number
  ) => {
    try {
      // Configure pass-specific parameters - tuned for higher success rates
      const passConfig = {
        1: { maxCandidates: 8, searchDays: 45, travelRelaxation: 1.0, allowOverfill: false },
        2: { maxCandidates: 16, searchDays: 75, travelRelaxation: 1.25, allowOverfill: false },
        3: { maxCandidates: 32, searchDays: 120, travelRelaxation: 1.5, allowOverfill: true }
      };
      
      const config = passConfig[passNumber as keyof typeof passConfig] || passConfig[1];
      console.log(`🔧 Pass ${passNumber} config:`, config);
    
    // Process orders in batches with concurrency
    for (let batchStart = 0; batchStart < ordersToProcess.length; batchStart += concurrencyLimit) {
        if (cancelledRef.current) {
          console.log('❌ Cancelled during order processing');
          break;
        }

        const batchEnd = Math.min(batchStart + concurrencyLimit, ordersToProcess.length);
        const batchOrders = ordersToProcess.slice(batchStart, batchEnd);
        
        // Process this batch concurrently
        const batchPromises = batchOrders.map(async (order, batchIndex) => {
          const orderIndex = batchStart + batchIndex;
          
          if (cancelledRef.current) return;
          
          try {
            console.log(`\n🔄 Pass ${passNumber}: Processing order ${order.order_number} (${orderIndex + 1}/${ordersToProcess.length})`);
            setProgressCurrent(orderIndex + 1);
            
            // Calculate minimum start date based on advance notice settings
            const now = new Date();
            let startDate = new Date(now.getTime() + (settings.minimum_advance_hours * 60 * 60 * 1000));
            
            if (passNumber > 1) {
              // Expand search horizon for later passes - but don't go before minimum advance notice
              const expandedStart = new Date();
              expandedStart.setDate(expandedStart.getDate() - (passNumber - 1) * 10);
              const minimumAdvanceDate = new Date(now.getTime() + (settings.minimum_advance_hours * 60 * 60 * 1000));
              startDate = expandedStart > minimumAdvanceDate ? expandedStart : minimumAdvanceDate;
            }
            
            // Calculate earliest available start date based on client blocked dates
            let enhancedStartDate = startDate;
            const clientBlockedDatesSet = clientBlockedDatesMap.get(order.client_id);
            if (clientBlockedDatesSet && clientBlockedDatesSet.size > 0) {
              const blockDatesArray = Array.from(clientBlockedDatesSet).sort().reverse();
              if (blockDatesArray.length > 0) {
                const lastBlockedDate = new Date(blockDatesArray[0]);
                const dayAfterLastBlocked = new Date(lastBlockedDate);
                dayAfterLastBlocked.setDate(dayAfterLastBlocked.getDate() + 1);
                
                // Use the later date between minimum advance date and day after last blocked date
                if (dayAfterLastBlocked > enhancedStartDate) {
                  enhancedStartDate = dayAfterLastBlocked;
                  console.log(`Order ${order.order_number}: Client blocked until ${blockDatesArray[0]}, starting from ${enhancedStartDate.toISOString().split('T')[0]}`);
                }
              }
            }

            const recommendations = await getSmartEngineerRecommendations(order, order.postcode, {
              startDate: enhancedStartDate,
              preloadedEngineers: allEngineers, // 🚀 USE PRELOADED
              workloadLookup, // 🚀 USE PRECOMPUTED WORKLOAD
              clientBlockedDatesMap, // 🚀 USE PRELOADED BLOCKED DATES
              fastMode: true // 🚀 ENABLE FAST MODE FOR BATCH PROCESSING
            });

            console.log(`Found ${recommendations.recommendations?.length || 0} candidates for order ${order.order_number}`);

            if (!recommendations.recommendations || recommendations.recommendations.length === 0) {
              console.log('❌ No recommendations found for order:', order.order_number);
              unscheduled.push({
                order,
                reason: 'No available engineers',
                details: 'No engineers found that can serve this postcode or have availability'
              });
              return;
            }

            // Validate recommendation data structure to prevent undefined errors
            const validRecommendations = recommendations.recommendations.filter(rec => 
              rec?.engineer?.id && rec?.engineer?.name && rec?.availableDate
            );

            if (validRecommendations.length === 0) {
              console.log('❌ No valid recommendations after filtering for order:', order.order_number);
              unscheduled.push({
                order,
                reason: 'Invalid recommendation data',
                details: 'All recommendations missing required engineer or date information'
              });
              return;
            }

            // Replace the recommendations with validated ones
            recommendations.recommendations = validRecommendations;

            let assignedCandidate = null;
            const alternatives: any[] = [];
            
            // Limit candidates based on pass number
            const candidatesToCheck = recommendations.recommendations.slice(0, config.maxCandidates);

          // Generate slot pools for all candidates and try each candidate with their available slots
          const candidateSlotPools = new Map();
          
          // Pre-generate slot pools for all candidates
          for (const candidate of candidatesToCheck) {
            const engineerSettings = allEngineers.find(e => e.id === candidate.engineer.id);
            if (!engineerSettings) continue;
            
            if (!candidateSlotPools.has(candidate.engineer.id)) {
              const slotPool = await getEngineerSlotPool(
                engineerSettings,
                new Date(candidate.availableDate),
                config.searchDays || 90,
                settings,
                workloadLookup
              );
              candidateSlotPools.set(candidate.engineer.id, slotPool);
            }
          }
          
          // Try each candidate, but now iterate through their slot pool if first date fails
          for (let i = 0; i < candidatesToCheck.length; i++) {
            const candidate = candidatesToCheck[i];
            
            console.log(`  🔍 Checking candidate ${i + 1}: ${candidate.engineer.name}`);
            
            // Get engineer settings and slot pool
            const engineerSettings = allEngineers.find(e => e.id === candidate.engineer.id);
            if (!engineerSettings) {
              console.log(`  ❌ Engineer settings not found`);
              alternatives.push(candidate);
              continue;
            }
            
            const slotPool = candidateSlotPools.get(candidate.engineer.id) || [];
            let assignedToSlot = false;
            
            // Try slots in chronological order (nearest first)
            for (const slot of slotPool) {
              const ledgerKey = `${candidate.engineer.id}_${slot.date}`;
              
              console.log(`    📅 Trying slot: ${slot.date} (${slot.remainingJobs} remaining slots)`);
              
              // Get current virtual ledger entry for this engineer/date
              const virtualEntry = ledger.get(ledgerKey) || {
                engineerId: candidate.engineer.id,
                date: slot.date,
                jobCount: 0,
                estimatedMinutes: 0,
                orders: []
              };

              // Calculate total jobs including virtual assignments
              const totalVirtualJobs = slot.dbWorkload + virtualEntry.jobCount;
              
              // Get engineer's daily limit - use engineer.max_installs_per_day if available
              const engineerMaxJobs = (engineerSettings as any).max_installs_per_day || settings.max_jobs_per_day;
              
              // Check job count limit (soft constraint in later passes)
              const jobLimitExceeded = totalVirtualJobs >= engineerMaxJobs;
              const allowOverfillForThisPass = config.allowOverfill && passNumber >= 3;
              
              if (jobLimitExceeded && !allowOverfillForThisPass) {
                console.log(`    ❌ Job limit exceeded: ${totalVirtualJobs}/${engineerMaxJobs} jobs (Pass ${passNumber})`);
                continue; // Try next slot
              }

              // Check if adding this order would exceed daily capacity using virtual orders
              const virtualOrders = virtualEntry.orders.map(vOrder => ({
                ...vOrder,
                estimated_duration_hours: getOrderEstimatedHours(vOrder)
              }));

              try {
                const dayFit = await calculateDayFit(
                  engineerSettings,
                  new Date(slot.date),
                  order,
                  settings.day_lenience_minutes || 15,
                  virtualOrders,
                  !config.allowOverfill, // enforce job count unless overfill allowed
                  config.allowOverfill ? 1 : 0 // allow 1 extra job if overfill
                );

                if (!dayFit.canFit) {
                  console.log(`    ❌ Capacity exceeded: ${dayFit.reasons.join(', ')}`);
                  continue; // Try next slot
                }

                // ✅ This slot works! Update virtual ledger
                const updatedEntry: VirtualLedgerEntry = {
                  ...virtualEntry,
                  jobCount: virtualEntry.jobCount + 1,
                  estimatedMinutes: virtualEntry.estimatedMinutes + getOrderEstimatedMinutes(order),
                  orders: [...virtualEntry.orders, order]
                };
                
                ledger.set(ledgerKey, updatedEntry);
                
                // Create assigned candidate with the slot date
                assignedCandidate = {
                  ...candidate,
                  availableDate: slot.date
                };
                
                // Update capacity info for UI
                const existingCapacityIndex = capacityInfo.findIndex(info => 
                  info.engineerName === candidate.engineer.name && info.date === slot.date
                );
                
                if (existingCapacityIndex >= 0) {
                  capacityInfo[existingCapacityIndex].reservedInBatch++;
                } else {
                  capacityInfo.push({
                    engineerName: candidate.engineer.name,
                    date: slot.date,
                    currentJobs: slot.dbWorkload,
                    maxJobs: engineerMaxJobs,
                    reservedInBatch: 1
                  });
                }

                console.log(`    ✅ Assigned to ${candidate.engineer.name} on ${slot.date} (${totalVirtualJobs + 1}/${engineerMaxJobs} jobs)`);
                assignedToSlot = true;
                break; // Exit slot loop - found a fit!
                
              } catch (error) {
                console.error(`    ❌ Error checking day fit for slot ${slot.date}:`, error);
                continue; // Try next slot
              }
            }
            
            if (assignedToSlot) {
              break; // Exit candidate loop - assigned successfully
            } else {
              // No slots worked for this candidate, add to alternatives
              alternatives.push(candidate);
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
            
            // Determine the most specific reason why this order couldn't be scheduled
            let reason = 'No capacity available';
            let details = '';
            
            if (candidatesToCheck.length === 0) {
              reason = 'No engineer candidates';
              details = 'No engineers found with availability for this order';
            } else {
              // Check what was the most common issue
              const hasCapacityIssues = alternatives.some(alt => {
                const ledgerKey = `${alt.engineer.id}_${alt.availableDate}`;
                const virtualEntry = ledger.get(ledgerKey);
                const currentWorkload = workloadLookup(alt.engineer.id, alt.availableDate);
                return (currentWorkload + (virtualEntry?.jobCount || 0)) >= settings.max_jobs_per_day;
              });
              
              if (hasCapacityIssues) {
                reason = 'All engineers at capacity';
                details = `All available engineers have reached their daily job limit of ${settings.max_jobs_per_day}`;
              } else {
                reason = 'Duration/scheduling conflicts';
                details = 'Engineers available but order duration doesn\'t fit available time slots';
              }
            }
            
            unscheduled.push({
              order,
              reason,
              details
            });
          }
          
        } catch (error) {
          console.error(`Error processing order ${order.order_number}:`, error);
        }
        });

        // Wait for this batch to complete before starting the next batch
        await Promise.all(batchPromises);
      }
    } catch (error) {
      console.error('Error processing orders:', error);
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

  // Perform preflight checks before sending offers - returns updated proposals
  const runPreflightChecks = async (): Promise<ProposedAssignment[]> => {
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
        
        // Defensive checks to prevent undefined UUID errors
        if (!proposal.order?.id || !proposal.selectedCandidate?.engineer?.id) {
          console.error('Missing required IDs for preflight check:', {
            orderId: proposal.order?.id,
            engineerId: proposal.selectedCandidate?.engineer?.id,
            orderNumber: proposal.order?.order_number
          });
          updatedAssignments[i] = {
            ...proposal,
            status: 'preflight_failed',
            statusMessage: 'Missing required order or engineer ID'
          };
          continue;
        }

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
      
      // Auto-fix preflight failures by switching to fallbacks
      if (autoFixPreflightFailures) {
        for (let i = 0; i < updatedAssignments.length; i++) {
          const proposal = updatedAssignments[i];
          if (proposal.status === 'preflight_failed' && proposal.alternatives.length > 1) {
            console.log(`Auto-fixing preflight failure for order ${proposal.order.order_number}...`);
            
            // Try each fallback until we find one that passes preflight
            for (let fallbackIndex = 1; fallbackIndex < Math.min(proposal.alternatives.length, 4); fallbackIndex++) {
              const fallbackCandidate = proposal.alternatives[fallbackIndex];
              
              // Check if this fallback passes preflight
              const fallbackVirtualOrders = Array.from(virtualLedger.values())
                .filter(entry => 
                  entry.engineerId === fallbackCandidate.engineer.id && 
                  entry.date === fallbackCandidate.availableDate
                )
                .flatMap(entry => entry.orders.filter(o => o.id !== proposal.order.id))
                .map(order => ({
                  id: order.id,
                  estimated_duration_hours: getOrderEstimatedHours(order)
                }));
              
              const { data: fallbackResult, error: fallbackError } = await supabase.functions.invoke('preflight-capacity-check', {
                body: {
                  order_id: proposal.order.id,
                  engineer_id: fallbackCandidate.engineer.id,
                  offered_date: fallbackCandidate.availableDate,
                  virtual_orders: fallbackVirtualOrders
                }
              });
              
              if (!fallbackError && fallbackResult?.canFit) {
                console.log(`Auto-fix successful: switched to ${fallbackCandidate.engineer.name} for order ${proposal.order.order_number}`);
                
                // Update virtual ledger
                const oldLedgerKey = `${proposal.selectedCandidate.engineer.id}_${proposal.selectedCandidate.availableDate}`;
                const newLedgerKey = `${fallbackCandidate.engineer.id}_${fallbackCandidate.availableDate}`;
                
                // Remove from old ledger entry
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
                
                // Add to new ledger entry
                const newEntry = virtualLedger.get(newLedgerKey) || {
                  engineerId: fallbackCandidate.engineer.id,
                  date: fallbackCandidate.availableDate,
                  jobCount: 0,
                  estimatedMinutes: 0,
                  orders: []
                };
                
                virtualLedger.set(newLedgerKey, {
                  ...newEntry,
                  jobCount: newEntry.jobCount + 1,
                  estimatedMinutes: newEntry.estimatedMinutes + getOrderEstimatedMinutes(proposal.order),
                  orders: [...newEntry.orders, proposal.order]
                });
                
                // Update the proposal
                updatedAssignments[i] = {
                  ...proposal,
                  selectedCandidate: fallbackCandidate,
                  proposedDate: new Date(fallbackCandidate.availableDate),
                  usedFallback: fallbackIndex,
                  status: 'ready',
                  statusMessage: `Auto-fixed: switched to ${fallbackCandidate.engineer.name}`
                };
                
                break; // Found a working fallback, stop trying
              }
            }
          }
        }
      }
      
      setProposedAssignments(updatedAssignments);
      return updatedAssignments;
      
    } catch (error) {
      console.error('Error running preflight checks:', error);
      toast.error('Failed to run preflight capacity checks');
      return proposedAssignments;
    } finally {
      setPreflightChecking(false);
    }
  };

  const handleSubmitOffers = async () => {
    // First run preflight checks and get updated proposals
    const preflightedProposals = await runPreflightChecks();
    
    // Filter to only ready proposals
    const readyProposals = preflightedProposals.filter(p => p.status === 'ready');
    const failedProposals = preflightedProposals.filter(p => p.status === 'preflight_failed');
    
    if (readyProposals.length === 0) {
      toast.error('No proposals are ready to send. All failed preflight checks.');
      return;
    }
    
    if (failedProposals.length > 0) {
      toast.warning(`${failedProposals.length} proposal(s) failed preflight checks and will be skipped. Sending ${readyProposals.length} offers.`);
    }
    
    setSubmitting(true);
    console.log('Starting resilient offer submission for', readyProposals.length, 'ready proposals');
    
    try {
      let successCount = 0;
      let failureCount = 0;
      const updatedAssignments = [...preflightedProposals];

      // Process only ready proposals for sending
      const readyIndices = updatedAssignments
        .map((proposal, index) => ({ proposal, index }))
        .filter(({ proposal }) => proposal.status === 'ready')
        .map(({ index }) => index);
      
      for (const i of readyIndices) {
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
            
            updatedAssignments[i] = {
              ...proposal,
              status: 'sent',
              statusMessage: `Offer sent to ${candidate.engineer.name} successfully`
            };
            
            console.log(`✅ ${attemptType} offer sent successfully for ${proposal.order.order_number}`);
            
          } catch (error) {
            console.error(`${attemptType} offer failed:`, error);
            
            if (attemptIndex === candidatesToTry.length - 1) {
              // This was the last candidate - mark as failed
              updatedAssignments[i] = {
                ...proposal,
                status: 'failed',
                statusMessage: `All fallbacks failed: ${error.message}`
              };
              failureCount++;
            }
          }
        }
        
        setProposedAssignments([...updatedAssignments]); // Update UI after each proposal
      }

      // Final status update
      setProposedAssignments(updatedAssignments);
      
      if (successCount > 0) {
        toast.success(`Successfully sent ${successCount} of ${readyProposals.length} ready offers`);
        if (onOffersSubmitted) {
          onOffersSubmitted();
        }
        
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

  const handleCancel = () => {
    console.log('🛑 User cancelled operation');
    setIsCancelled(true);
    cancelledRef.current = true;
    setLoading(false);
    setProgressText('Cancelling...');
    toast.info('Operation cancelled');
  };

  const handleClose = () => {
    handleCancel(); // Cancel any ongoing operations
    setProposedAssignments([]);
    setUnscheduledOrders([]);
    setGenerated(false);
    setIsCancelled(false);
    cancelledRef.current = false;
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="h-[85vh] w-[95vw] max-w-[1200px] flex flex-col overflow-hidden">
        <DialogHeader className="flex-shrink-0 pb-4 border-b">
          <DialogTitle className="flex items-center gap-2 justify-between">
            <div className="flex items-center gap-2">
              <Bot className="h-5 w-5" />
              AI Scheduling Review
            </div>
            <div className="flex items-center gap-4">
              <label className="text-sm font-normal flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={guaranteeSchedule}
                  onChange={(e) => setGuaranteeSchedule(e.target.checked)}
                  className="rounded"
                />
                Guarantee schedule (multi-pass)
              </label>
              <label className="text-sm font-normal flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={autoFixPreflightFailures}
                  onChange={(e) => setAutoFixPreflightFailures(e.target.checked)}
                  className="rounded"
                />
                Auto-fix preflight failures
              </label>
            </div>
          </DialogTitle>
          <DialogDescription>
            Review and submit the automatically generated scheduling proposals for {orders.length} orders.
            {guaranteeSchedule && " Multi-pass mode will attempt to schedule all jobs using expanded criteria."}
            {autoFixPreflightFailures && " Auto-fix will automatically switch to fallback options if preflight checks fail."}
            {progressTotal > 0 && (
              <div className="flex items-center gap-2 mt-2">
                <div className="text-xs text-muted-foreground">
                  Processing {progressCurrent}/{progressTotal} orders
                </div>
                <div className="w-20 h-1 bg-muted rounded-full">
                  <div 
                    className="h-full bg-primary rounded-full transition-all duration-200"
                    style={{ width: `${(progressCurrent / progressTotal) * 100}%` }}
                  />
                </div>
              </div>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-hidden">
          <ScrollArea className="h-full">
            <div className="space-y-4 p-1">
              {loading ? (
                <div className="flex flex-col items-center justify-center h-64">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mb-4"></div>
                  <p className="text-muted-foreground">Generating smart scheduling proposals...</p>
                  <p className="text-sm text-muted-foreground mt-2">
                    {progressTotal > 0 
                      ? `Processing ${progressCurrent}/${progressTotal} orders - using cache for faster lookups`
                      : "Analyzing engineer availability, travel times, and workloads"
                    }
                  </p>
                </div>
              ) : proposedAssignments.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64">
                  <AlertTriangle className="w-12 h-12 text-warning mb-4" />
                  <p className="text-muted-foreground">No scheduling proposals could be generated</p>
                  <p className="text-sm text-muted-foreground mt-2">Check engineer availability and service areas</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Summary Section */}
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">Batch Summary</CardTitle>
                    </CardHeader>
                    <CardContent>
                       <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                         <div className="text-center p-2 bg-blue-50 rounded">
                           <div className="text-lg font-bold text-blue-700">{orders.length}</div>
                           <div className="text-xs text-blue-600">Total Selected</div>
                         </div>
                         <div className="text-center p-2 bg-green-50 rounded">
                           <div className="text-lg font-bold text-green-700">{proposedAssignments.length}</div>
                           <div className="text-xs text-green-600">Scheduled</div>
                         </div>
                         <div className="text-center p-2 bg-orange-50 rounded">
                           <div className="text-lg font-bold text-orange-700">{unscheduledOrders.length}</div>
                           <div className="text-xs text-orange-600">Unscheduled</div>
                         </div>
                         <div className="text-center p-2 bg-purple-50 rounded">
                           <div className="text-lg font-bold text-purple-700">
                             {orders.length > 0 ? Math.round((proposedAssignments.length / orders.length) * 100) : 0}%
                           </div>
                           <div className="text-xs text-purple-600">Success Rate</div>
                         </div>
                       </div>
                    </CardContent>
                  </Card>

                  {/* Virtual Capacity Info */}
                  {batchCapacityInfo.length > 0 && (
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base">Virtual Capacity Reservations</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                          {batchCapacityInfo.map((info, index) => (
                            <div key={index} className="p-2 bg-gray-50 rounded text-sm">
                              <div className="font-medium">{info.engineerName}</div>
                              <div className="text-xs text-gray-600">{new Date(info.date).toLocaleDateString()}</div>
                              <div className="text-xs mt-1">
                                {info.currentJobs + info.reservedInBatch}/{info.maxJobs} jobs (+{info.reservedInBatch} in batch)
                              </div>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Conflict Alerts */}
                  {proposedAssignments.some(p => p.conflicts.length > 0 || p.status === 'preflight_failed') && (
                    <Alert>
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription>
                        Some proposals have conflicts or failed preflight checks. Review and consider using fallback options before submitting.
                      </AlertDescription>
                    </Alert>
                  )}

                   {/* Unscheduled Orders */}
                   {unscheduledOrders.length > 0 && (
                     <Card className="border-amber-300 bg-amber-50">
                       <CardHeader>
                         <CardTitle className="text-lg flex items-center gap-2">
                           <AlertTriangle className="w-5 h-5 text-amber-600" />
                           Unscheduled Orders ({unscheduledOrders.length})
                         </CardTitle>
                       </CardHeader>
                       <CardContent>
                         <div className="space-y-3">
                           {unscheduledOrders.map((unscheduled, index) => (
                             <div key={index} className="flex items-start justify-between p-3 bg-white border border-amber-200 rounded-lg">
                               <div className="flex-1">
                                 <div className="flex items-center gap-2 mb-1">
                                   <span className="font-medium">{unscheduled.order.order_number}</span>
                                   <Badge variant="outline" className="text-amber-700 border-amber-300">
                                     {unscheduled.reason}
                                   </Badge>
                                 </div>
                                 <div className="text-sm text-muted-foreground mb-1 flex items-center gap-1">
                                   {unscheduled.order.client?.full_name} • <MapPin className="w-3 h-3" /> {getLocationDisplayText(unscheduled.order)}
                                 </div>
                                 {unscheduled.details && (
                                   <div className="text-xs text-amber-700 bg-amber-100 px-2 py-1 rounded mt-1">
                                     {unscheduled.details}
                                   </div>
                                 )}
                               </div>
                               <div className="ml-4 flex gap-2">
                                 <Button 
                                   size="sm" 
                                   variant="outline"
                                   onClick={() => {
                                     toast.info('Manual assignment feature coming soon');
                                   }}
                                 >
                                   Manual Assign
                                 </Button>
                               </div>
                             </div>
                           ))}
                         </div>
                       </CardContent>
                     </Card>
                   )}

                   {/* Individual Proposals */}
                  <div className="space-y-3">
                    {proposedAssignments.map((proposal, index) => (
                      <Card key={proposal.order.id} className={`${
                        proposal.status === 'preflight_failed' ? 'border-red-300 bg-red-50' :
                        proposal.status === 'ready' ? 'border-green-300 bg-green-50' :
                        proposal.status === 'sending' || proposal.status === 'preflight_checking' ? 'border-yellow-300 bg-yellow-50' :
                        proposal.status === 'sent' ? 'border-blue-300 bg-blue-50' :
                        proposal.status === 'failed' ? 'border-red-300 bg-red-50' :
                        'border-gray-300'
                      }`}>
                        <CardHeader className="pb-2">
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-sm flex items-center gap-2">
                              <Package className="w-4 h-4" />
                              {proposal.order.order_number}
                              {proposal.usedFallback && proposal.usedFallback > 0 && (
                                <Badge variant="outline" className="text-xs">
                                  Fallback #{proposal.usedFallback}
                                </Badge>
                              )}
                            </CardTitle>
                            <Badge 
                              variant={
                                proposal.status === 'ready' ? 'default' :
                                proposal.status === 'preflight_failed' ? 'destructive' :
                                proposal.status === 'sending' || proposal.status === 'preflight_checking' ? 'secondary' :
                                proposal.status === 'sent' ? 'default' :
                                proposal.status === 'failed' ? 'destructive' :
                                'outline'
                              }
                            >
                              {proposal.status === 'ready' && <CheckCircle className="w-3 h-3 mr-1" />}
                              {proposal.status === 'preflight_failed' && <AlertTriangle className="w-3 h-3 mr-1" />}
                              {proposal.status === 'sending' && 'Sending...'}
                              {proposal.status === 'preflight_checking' && 'Checking...'}
                              {proposal.status === 'sent' && 'Sent ✓'}
                              {proposal.status === 'failed' && 'Failed'}
                              {proposal.status === 'ready' && 'Ready'}
                              {proposal.status === 'preflight_failed' && 'Failed Check'}
                            </Badge>
                          </div>
                          {proposal.statusMessage && (
                            <p className="text-xs text-red-600">{proposal.statusMessage}</p>
                          )}
                        </CardHeader>
                        <CardContent className="space-y-3">
                          {/* Order Details */}
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                            <div>
                              <span className="font-medium">Client:</span>
                              <div className="text-muted-foreground">{proposal.order.client?.full_name}</div>
                              <div className="text-xs text-muted-foreground flex items-center gap-1">
                                <MapPin className="w-3 h-3" />
                                {getLocationDisplayText(proposal.order)}
                              </div>
                            </div>
                            <div>
                              <span className="font-medium">Duration:</span>
                              <div className="text-muted-foreground">{getOrderEstimatedHours(proposal.order)}h</div>
                            </div>
                            <div>
                              <span className="font-medium">Score:</span>
                              <div className="text-muted-foreground">{Math.round(proposal.score)}</div>
                            </div>
                          </div>

                          {/* Assignment Details */}
                          <div className="p-3 bg-white rounded border">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <User className="w-3 h-3" />
                                <span className="text-sm font-medium">{proposal.selectedCandidate?.engineer.name}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <CalendarDays className="w-3 h-3" />
                                <span className="text-sm">{new Date(proposal.proposedDate).toLocaleDateString('en-GB', {
                                  weekday: 'short',
                                  day: 'numeric',
                                  month: 'short'
                                })}</span>
                              </div>
                            </div>
                            
                            {/* Conflicts */}
                            {proposal.conflicts.length > 0 && (
                              <div className="mt-2">
                                <div className="flex items-center gap-2 text-orange-600 text-xs mb-1">
                                  <AlertTriangle className="w-3 h-3" />
                                  <span>Issues:</span>
                                </div>
                                <div className="pl-4">
                                  {proposal.conflicts.map((conflict, i) => (
                                    <div key={i} className="text-xs text-orange-700">• {conflict}</div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Fallback Options */}
                            {proposal.alternatives.length > 1 && (
                              <div className="mt-2">
                                <div className="text-xs font-medium mb-1">Alternatives:</div>
                                <div className="space-y-1">
                                  {proposal.alternatives.slice(1, 3).map((alt, altIndex) => (
                                    <div key={altIndex} className="flex items-center justify-between text-xs p-2 bg-gray-50 rounded">
                                       <span className="text-xs">
                                         {alt.engineer.name} • {new Date(alt.availableDate).toLocaleDateString('en-GB', {
                                           weekday: 'short',
                                           day: 'numeric',
                                           month: 'short'
                                         })} • Score: {Math.round(alt.score)}
                                       </span>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => handleUseFallback(index, altIndex + 1)}
                                        disabled={submitting}
                                        className="h-5 px-2 text-xs"
                                      >
                                        Use
                                      </Button>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
        </div>

        <div className="flex-shrink-0 flex items-center justify-between pt-3 border-t bg-background">
          <Button variant="outline" onClick={handleClose} disabled={submitting}>
            Cancel
          </Button>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              onClick={runPreflightChecks}
              disabled={submitting || preflightChecking || proposedAssignments.length === 0}
            >
              <Clock className="w-4 h-4 mr-2" />
              {preflightChecking ? 'Checking...' : 'Run Preflight'}
            </Button>
            <Button
              onClick={handleSubmitOffers}
              disabled={submitting || proposedAssignments.length === 0 || preflightChecking}
              className="flex items-center gap-2"
            >
              <Send className="w-4 h-4" />
              {submitting 
                ? 'Sending...' 
                : proposedAssignments.filter(p => p.status === 'ready').length > 0
                  ? `Send ${proposedAssignments.filter(p => p.status === 'ready').length} Offers`
                  : `Send ${proposedAssignments.length} Offers`
              }
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}