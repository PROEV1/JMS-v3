export const isToday = (date: string | null): boolean => {
  if (!date) return false;
  const jobDate = new Date(date);
  const today = new Date();
  return jobDate.toDateString() === today.toDateString();
};

export const isThisWeek = (date: string | null): boolean => {
  if (!date) return false;
  const jobDate = new Date(date);
  const now = new Date();
  const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  return jobDate >= now && jobDate <= weekFromNow;
};

export const formatTimeSlot = (date: string | null): string => {
  if (!date) return 'Time TBC';
  return new Date(date).toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit'
  });
};

export const formatDateOnly = (date: string | null): string => {
  if (!date) return 'Not scheduled';
  return new Date(date).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
};

export const isWithinLastDays = (date: string | null, days: number): boolean => {
  if (!date) return false;
  const jobDate = new Date(date);
  const now = new Date();
  const daysAgo = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  return jobDate >= daysAgo && jobDate <= now;
};