// Helper utility for job type display and formatting

export type JobType = 'installation' | 'assessment' | 'service_call';

export const getJobTypeLabel = (jobType?: string): string => {
  if (!jobType) return 'Installation'; // Default for existing orders
  
  switch (jobType.toLowerCase()) {
    case 'installation':
      return 'Installation';
    case 'assessment':
      return 'Assessment';
    case 'service_call':
      return 'Service Call';
    default:
      return 'Installation'; // Fallback
  }
};

export const getJobTypeColor = (jobType?: string): string => {
  if (!jobType) return 'bg-primary text-primary-foreground'; // Default
  
  switch (jobType.toLowerCase()) {
    case 'installation':
      return 'bg-primary text-primary-foreground';
    case 'assessment':
      return 'bg-blue-500 text-white';
    case 'service_call':
      return 'bg-orange-500 text-white';
    default:
      return 'bg-primary text-primary-foreground';
  }
};