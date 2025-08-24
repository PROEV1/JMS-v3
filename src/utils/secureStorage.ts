import { supabase } from '@/integrations/supabase/client';
import { safeApiCall, ApiResponse } from './apiErrorHandler';

/**
 * Secure storage utilities with signed URLs and proper access control
 * Never expose direct storage URLs to users
 */

export interface SecureFileUpload {
  file: File;
  path: string;
  metadata?: Record<string, any>;
}

/**
 * Upload file to secure private bucket with metadata
 */
export async function uploadSecureFile(
  bucket: string,
  upload: SecureFileUpload
): Promise<ApiResponse<{ path: string; signedUrl: string }>> {
  return safeApiCall(
    async () => {
      // Upload to private bucket
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(upload.path, upload.file, {
          upsert: false,
          contentType: upload.file.type,
          metadata: upload.metadata,
        });
      
      if (uploadError) throw uploadError;
      
      // Get signed URL for immediate access
      const { data: urlData, error: urlError } = await supabase.storage
        .from(bucket)
        .createSignedUrl(uploadData.path, 3600); // 1 hour expiry
      
      if (urlError) throw urlError;
      
      return {
        data: {
          path: uploadData.path,
          signedUrl: urlData.signedUrl,
        },
      };
    },
    `Upload secure file to ${bucket}/${upload.path}`
  );
}

/**
 * Get signed URL for private file with access control
 */
export async function getSecureFileUrl(
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
    `Get secure URL for ${bucket}/${path}`
  );
}

/**
 * Get multiple signed URLs efficiently
 */
export async function getSecureFileUrls(
  bucket: string,
  paths: string[],
  expiresIn = 3600
): Promise<ApiResponse<Record<string, string>>> {
  return safeApiCall(
    async () => {
      const urlPromises = paths.map(async (path) => {
        const { data, error } = await supabase.storage
          .from(bucket)
          .createSignedUrl(path, expiresIn);
        
        if (error) throw error;
        return { path, url: data.signedUrl };
      });
      
      const results = await Promise.all(urlPromises);
      const urlMap = results.reduce((acc, { path, url }) => {
        acc[path] = url;
        return acc;
      }, {} as Record<string, string>);
      
      return { data: urlMap };
    },
    `Get secure URLs for ${paths.length} files`
  );
}

/**
 * Delete secure files with proper cleanup
 */
export async function deleteSecureFiles(
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
    `Delete ${paths.length} files from ${bucket}`
  );
}

/**
 * List files in secure bucket with metadata
 */
export async function listSecureFiles(
  bucket: string,
  folder?: string,
  options?: {
    limit?: number;
    offset?: number;
    sortBy?: { column: string; order: 'asc' | 'desc' };
  }
): Promise<ApiResponse<any[]>> {
  return safeApiCall(
    async () => {
      const { data, error } = await supabase.storage
        .from(bucket)
        .list(folder, options);
      
      if (error) throw error;
      return { data };
    },
    `List files in ${bucket}${folder ? `/${folder}` : ''}`
  );
}

/**
 * Helper to generate secure file path with user isolation
 */
export function generateSecureFilePath(
  userId: string,
  category: string,
  fileName: string
): string {
  const timestamp = Date.now();
  const cleanFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
  return `${userId}/${category}/${timestamp}_${cleanFileName}`;
}

/**
 * Helper to check if user can access file path
 */
export async function canAccessFile(
  filePath: string,
  userId?: string
): Promise<boolean> {
  try {
    // Extract user ID from path (assumes format: userId/category/filename)
    const pathParts = filePath.split('/');
    const fileOwnerId = pathParts[0];
    
    // If no userId provided, get current user
    if (!userId) {
      const { data: user } = await supabase.auth.getUser();
      userId = user.user?.id;
    }
    
    if (!userId) return false;
    
    // Users can access their own files
    if (fileOwnerId === userId) return true;
    
    // Check if user is admin
    const { data: isAdmin } = await supabase.rpc('is_admin', { user_uuid: userId });
    if (isAdmin) return true;
    
    return false;
  } catch (error) {
    console.error('Error checking file access:', error);
    return false;
  }
}

/**
 * Secure file download with access control
 */
export async function downloadSecureFile(
  bucket: string,
  path: string
): Promise<ApiResponse<Blob>> {
  return safeApiCall(
    async () => {
      // Check access first
      const hasAccess = await canAccessFile(path);
      if (!hasAccess) {
        throw new Error('Access denied to file');
      }
      
      const { data, error } = await supabase.storage
        .from(bucket)
        .download(path);
      
      if (error) throw error;
      return { data };
    },
    `Download secure file from ${bucket}/${path}`
  );
}