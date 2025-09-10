import { usePartnerAuth } from '@/hooks/usePartnerAuth';
import { PartnerDashboard } from '@/components/partner/PartnerDashboard';
import { PartnerAuth } from '@/components/partner/PartnerAuth';
import { Skeleton } from '@/components/ui/skeleton';

export default function PartnerPortal() {
  console.log('🚨 PartnerPortal component is rendering - this should NOT happen for lee@proev.co.uk');
  console.log('🚨 Current URL pathname:', window.location.pathname); 
  console.log('🚨 Current URL full:', window.location.href);
  
  const { partnerUser, loading, isPartnerUser } = usePartnerAuth();

  // Remove redirect logic - let component handle auth internally

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto p-6 space-y-6">
          <Skeleton className="h-16 w-full" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
          </div>
          <Skeleton className="h-96 w-full" />
        </div>
      </div>
    );
  }

  if (!isPartnerUser) {
    return <PartnerAuth />;
  }

  return <PartnerDashboard partnerUser={partnerUser!} />;
}