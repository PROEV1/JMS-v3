import { useState, useCallback } from 'react';
import { 
  uploadSecureFile, 
  getSecureFileUrl, 
  deleteSecureFiles,
  generateSecureFilePath,
  SecureFileUpload
} from '@/utils/secureStorage';
import { useAuth } from './useAuth';
import { showErrorToast, showSuccessToast } from '@/utils/apiErrorHandler';

export interface UseSecureStorageResult {
  uploading: boolean;
  uploadFile: (
    bucket: string,
    file: File,
    category: string,
    metadata?: Record<string, any>
  ) => Promise<{ path: string; signedUrl: string } | null>;
  getFileUrl: (bucket: string, path: string) => Promise<string | null>;
  deleteFiles: (bucket: string, paths: string[]) => Promise<boolean>;
}

/**
 * Hook for secure storage operations with proper error handling
 */
export function useSecureStorage(): UseSecureStorageResult {
  const [uploading, setUploading] = useState(false);
  const { user } = useAuth();

  const uploadFile = useCallback(async (
    bucket: string,
    file: File,
    category: string,
    metadata?: Record<string, any>
  ) => {
    if (!user) {
      showErrorToast('You must be logged in to upload files');
      return null;
    }

    setUploading(true);
    try {
      const path = generateSecureFilePath(user.id, category, file.name);
      const upload: SecureFileUpload = {
        file,
        path,
        metadata,
      };

      const result = await uploadSecureFile(bucket, upload);
      
      if (result.ok) {
        showSuccessToast('File uploaded successfully');
        return result.data!;
      } else {
        showErrorToast(result);
        return null;
      }
    } catch (error) {
      showErrorToast('Failed to upload file');
      return null;
    } finally {
      setUploading(false);
    }
  }, [user]);

  const getFileUrl = useCallback(async (bucket: string, path: string) => {
    const result = await getSecureFileUrl(bucket, path);
    
    if (result.ok) {
      return result.data!;
    } else {
      showErrorToast(result);
      return null;
    }
  }, []);

  const deleteFiles = useCallback(async (bucket: string, paths: string[]) => {
    const result = await deleteSecureFiles(bucket, paths);
    
    if (result.ok) {
      showSuccessToast(`Deleted ${paths.length} file(s)`);
      return true;
    } else {
      showErrorToast(result);
      return false;
    }
  }, []);

  return {
    uploading,
    uploadFile,
    getFileUrl,
    deleteFiles,
  };
}