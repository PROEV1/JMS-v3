import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Download, FileText, Image, File } from 'lucide-react';
import { getSecureFileUrl } from '@/utils/secureStorage';
import { showErrorToast } from '@/utils/apiErrorHandler';

interface SignedFileProps {
  bucket: string;
  path?: string;
  fallbackUrl?: string; // For dual-read during migration
  fileName: string;
  fileSize?: number;
  mimeType?: string;
  expiresIn?: number; // TTL in seconds, default 3600 (1 hour)
  className?: string;
  variant?: 'default' | 'outline' | 'ghost';
  showIcon?: boolean;
  children?: React.ReactNode;
}

export function SignedFile({ 
  bucket, 
  path, 
  fallbackUrl, 
  fileName, 
  fileSize,
  mimeType,
  expiresIn = 3600,
  className,
  variant = 'outline',
  showIcon = true,
  children
}: SignedFileProps) {
  const [downloading, setDownloading] = useState(false);

  const getFileIcon = (fileName: string, mimeType?: string) => {
    const ext = fileName.split('.').pop()?.toLowerCase();
    const mime = mimeType?.toLowerCase();
    
    if (mime?.startsWith('image/') || ['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp'].includes(ext || '')) {
      return <Image className="h-4 w-4" />;
    }
    if (['pdf', 'doc', 'docx', 'txt'].includes(ext || '') || mime?.includes('document')) {
      return <FileText className="h-4 w-4" />;
    }
    return <File className="h-4 w-4" />;
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '';
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
  };

  const handleDownload = async () => {
    setDownloading(true);
    
    try {
      let downloadUrl = fallbackUrl;
      
      // Prefer signed URL if path is available
      if (path) {
        const result = await getSecureFileUrl(bucket, path, expiresIn);
        if (result.ok && result.data) {
          downloadUrl = result.data;
        }
      }
      
      if (!downloadUrl) {
        showErrorToast('File not available for download');
        return;
      }

      // Create temporary link and trigger download
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = fileName;
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
    } catch (error) {
      showErrorToast('Failed to download file');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <Button
      variant={variant}
      className={className}
      onClick={handleDownload}
      disabled={downloading}
    >
      {showIcon && getFileIcon(fileName, mimeType)}
      {children || (
        <span className="flex items-center gap-2">
          {fileName}
          {fileSize && <span className="text-muted-foreground">({formatFileSize(fileSize)})</span>}
          <Download className="h-4 w-4" />
        </span>
      )}
    </Button>
  );
}