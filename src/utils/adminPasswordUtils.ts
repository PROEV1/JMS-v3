import { apiClient, buildFunctionUrl } from '@/lib/apiClient';

export async function setUserPassword(email: string, password: string) {
  try {
    const url = buildFunctionUrl('admin-set-password');
    const response = await apiClient.post(url, { email, password });
    return { success: true, data: response };
  } catch (error: any) {
    console.error('Error setting password:', error);
    return { 
      success: false, 
      error: error.message || 'Failed to set password' 
    };
  }
}

// Convenience function for the specific user
export async function setDarrenPassword() {
  return setUserPassword('darren.cope@proev.co.uk', 'Pr0ev123');
}