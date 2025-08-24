import { supabase } from '@/integrations/supabase/client';
import { handleApiError, showErrorToast, showSuccessToast, safeApiCall, ApiResponse } from './apiErrorHandler';

/**
 * Standardized helpers for API calls with consistent error handling
 * All functions return {ok: boolean, data?, code?, message} format
 */

/**
 * Safe wrapper for Supabase queries with standardized error handling
 */
export async function safeQuery<T>(
  queryFn: () => Promise<any>,
  context: string,
  showToastOnError = true
): Promise<ApiResponse<T>> {
  const result = await safeApiCall<T>(queryFn, context);
  
  if (!result.ok && showToastOnError) {
    showErrorToast(result);
  }
  
  return result;
}

/**
 * Safe wrapper for Supabase mutations with standardized error handling and success toasts
 */
export async function safeMutation<T>(
  mutationFn: () => Promise<any>,
  context: string,
  successMessage?: string,
  showToastOnError = true
): Promise<ApiResponse<T>> {
  const result = await safeApiCall<T>(mutationFn, context);
  
  if (result.ok && successMessage) {
    showSuccessToast(successMessage);
  } else if (!result.ok && showToastOnError) {
    showErrorToast(result);
  }
  
  return result;
}

/**
 * Safe wrapper for Edge Function invocations with standardized error handling
 */
export async function safeInvoke<T>(
  functionName: string,
  payload?: any,
  context?: string,
  showToastOnError = true
): Promise<ApiResponse<T>> {
  const result = await safeApiCall<T>(
    () => supabase.functions.invoke(functionName, { body: payload }),
    context || `Edge Function: ${functionName}`
  );
  
  if (!result.ok && showToastOnError) {
    showErrorToast(result);
  }
  
  return result;
}

/**
 * Get signed URL for private storage files with error handling
 */
export async function getSignedUrl(
  bucket: string,
  path: string,
  expiresIn = 3600
): Promise<ApiResponse<string>> {
  return safeApiCall(
    async () => {
      const { data, error } = await supabase.storage
        .from(bucket)
        .createSignedUrl(path, expiresIn);
      
      if (error) throw error;
      return { data: data.signedUrl };
    },
    `Get signed URL for ${bucket}/${path}`
  );
}

/**
 * Upload file to storage with standardized error handling
 */
export async function uploadFile(
  bucket: string,
  path: string,
  file: File,
  options?: { upsert?: boolean; contentType?: string }
): Promise<ApiResponse<{ path: string; fullPath: string }>> {
  return safeApiCall(
    async () => {
      const { data, error } = await supabase.storage
        .from(bucket)
        .upload(path, file, {
          upsert: options?.upsert || false,
          contentType: options?.contentType || file.type,
        });
      
      if (error) throw error;
      
      return {
        data: {
          path: data.path,
          fullPath: data.fullPath,
        },
      };
    },
    `Upload file to ${bucket}/${path}`
  );
}

/**
 * Delete file from storage with standardized error handling
 */
export async function deleteFile(
  bucket: string,
  paths: string[]
): Promise<ApiResponse<void>> {
  return safeApiCall(
    async () => {
      const { error } = await supabase.storage
        .from(bucket)
        .remove(paths);
      
      if (error) throw error;
      return { data: undefined };
    },
    `Delete files from ${bucket}`
  );
}

/**
 * Helper to check if current user is admin
 */
export async function checkIsAdmin(): Promise<ApiResponse<boolean>> {
  return safeQuery(
    async () => {
      const { data: result } = await supabase.rpc('is_admin');
      return { data: result };
    },
    'Check admin status',
    false // Don't show toast for this check
  );
}

/**
 * Helper to get current user's profile
 */
export async function getCurrentUserProfile(): Promise<ApiResponse<any>> {
  return safeQuery(
    async () => {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error('No authenticated user');
      
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.user.id)
        .single();
      
      if (error) throw error;
      return { data };
    },
    'Get current user profile',
    false // Don't show toast for this check
  );
}

/**
 * Standardized pagination helper
 */
export interface PaginationOptions {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export function applyPagination(
  query: any,
  options: PaginationOptions = {}
) {
  const { page = 1, limit = 50, sortBy, sortOrder = 'asc' } = options;
  const from = (page - 1) * limit;
  const to = from + limit - 1;
  
  let paginatedQuery = query.range(from, to);
  
  if (sortBy) {
    paginatedQuery = paginatedQuery.order(sortBy, { ascending: sortOrder === 'asc' });
  }
  
  return paginatedQuery;
}