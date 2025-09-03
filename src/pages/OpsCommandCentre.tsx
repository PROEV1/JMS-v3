import React from 'react';
import { OpsKpiRow } from '@/components/ops/OpsKpiRow';
import { BucketsOverview } from '@/components/ops/BucketsOverview';
import { EscalationsTable } from '@/components/ops/EscalationsTable';
import { WeeklyCapacityView } from '@/components/scheduling/WeeklyCapacityView';
import { ProEVLogo } from '@/components/ProEVLogo';

export default function OpsCommandCentre() {
  return (
    <div className="container mx-auto py-6 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <ProEVLogo variant="main" size="lg" />
        <div className="text-right">
          <h1 className="text-3xl font-bold heading-large">Ops Command Centre</h1>
          <p className="text-muted-foreground body-text">Real-time operations dashboard</p>
        </div>
      </div>

      {/* Row 1: KPI Tiles */}
      <OpsKpiRow />

      {/* Row 2: Status Buckets Overview */}
      <BucketsOverview />

      {/* Row 3: Escalations & SLA Breaches */}
      <EscalationsTable />

      {/* Row 4: Scheduling Heatmap (Optional) */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Weekly Capacity Overview</h2>
        <WeeklyCapacityView />
      </div>
    </div>
  );
}