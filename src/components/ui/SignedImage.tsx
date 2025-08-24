import React, { useState, useEffect } from 'react';
import { getSecureFileUrl } from '@/utils/secureStorage';

interface SignedImageProps extends Omit<React.ImgHTMLAttributes<HTMLImageElement>, 'src'> {
  bucket: string;
  path?: string;
  fallbackUrl?: string; // For dual-read during migration
  expiresIn?: number; // TTL in seconds, default 3600 (1 hour)
  className?: string;
}

export function SignedImage({ 
  bucket, 
  path, 
  fallbackUrl, 
  expiresIn = 3600,
  className,
  alt = "Image",
  ...props 
}: SignedImageProps) {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let mounted = true;
    let refreshTimer: NodeJS.Timeout;

    const loadSignedUrl = async () => {
      if (!path) {
        // Use fallback URL during migration
        if (fallbackUrl) {
          setSignedUrl(fallbackUrl);
          setLoading(false);
        } else {
          setError(true);
          setLoading(false);
        }
        return;
      }

      try {
        const result = await getSecureFileUrl(bucket, path, expiresIn);
        
        if (!mounted) return;
        
        if (result.ok && result.data) {
          setSignedUrl(result.data);
          setError(false);
          
          // Set up auto-refresh before expiry (refresh at 90% of TTL)
          const refreshAt = (expiresIn * 0.9) * 1000;
          refreshTimer = setTimeout(() => {
            if (mounted) loadSignedUrl();
          }, refreshAt);
        } else {
          // Fallback to public URL if available
          if (fallbackUrl) {
            setSignedUrl(fallbackUrl);
          } else {
            setError(true);
          }
        }
      } catch (err) {
        if (!mounted) return;
        
        // Fallback to public URL if available
        if (fallbackUrl) {
          setSignedUrl(fallbackUrl);
        } else {
          setError(true);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };

    loadSignedUrl();

    return () => {
      mounted = false;
      if (refreshTimer) clearTimeout(refreshTimer);
    };
  }, [bucket, path, fallbackUrl, expiresIn]);

  if (loading) {
    return (
      <div className={`bg-muted animate-pulse rounded ${className}`} {...props}>
        <div className="h-full w-full flex items-center justify-center text-muted-foreground text-sm">
          Loading...
        </div>
      </div>
    );
  }

  if (error || !signedUrl) {
    return (
      <div className={`bg-muted rounded flex items-center justify-center ${className}`} {...props}>
        <div className="text-muted-foreground text-sm">Image unavailable</div>
      </div>
    );
  }

  return (
    <img
      src={signedUrl}
      alt={alt}
      className={className}
      onError={() => {
        setError(true);
        // Try to refresh the signed URL on error
        if (path) {
          getSecureFileUrl(bucket, path, expiresIn).then(result => {
            if (result.ok && result.data) {
              setSignedUrl(result.data);
              setError(false);
            }
          });
        }
      }}
      {...props}
    />
  );
}