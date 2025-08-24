import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Upload, Camera, X, Image, Video } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { SurveyField } from '@/types/survey-forms';
import { supabase } from '@/integrations/supabase/client';

interface MediaUploadFieldProps {
  field: SurveyField;
  value: any[];
  onChange: (files: any[]) => void;
  orderId?: string;
  surveyId?: string;
  token?: string;
}

export function MediaUploadField({ field, value = [], onChange, orderId, surveyId, token }: MediaUploadFieldProps) {
  const [uploading, setUploading] = useState(false);
  const { toast } = useToast();
  
  const { settings } = field;
  const mediaSettings = settings.mediaSettings || {};
  const maxFiles = mediaSettings.maxItems || 10;
  const minFiles = mediaSettings.minItems || 0;
  const maxFileSize = (mediaSettings.maxSizeMB || 10) * 1024 * 1024; // Convert to bytes

  const acceptedTypes = field.type === 'photo' 
    ? { 'image/*': ['.jpg', '.jpeg', '.png', '.webp'] }
    : field.type === 'video'
    ? { 'video/*': ['.mp4', '.mov', '.avi'] }
    : { '*/*': [] };

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (value.length + acceptedFiles.length > maxFiles) {
      toast({
        title: `Maximum ${maxFiles} files allowed`,
        variant: 'destructive'
      });
      return;
    }

    if (!orderId || !token) {
      toast({
        title: 'Upload not available',
        description: 'Missing required upload configuration',
        variant: 'destructive'
      });
      return;
    }

    setUploading(true);

    const newFiles = [];
    for (const file of acceptedFiles) {
      if (file.size > maxFileSize) {
        toast({
          title: `File ${file.name} is too large`,
          description: `Maximum size: ${Math.round(maxFileSize / 1024 / 1024)}MB`,
          variant: 'destructive'
        });
        continue;
      }

      try {
        // Upload to Supabase Storage via edge function
        const formData = new FormData();
        formData.append('file', file);
        formData.append('orderId', orderId);
        formData.append('surveyId', surveyId || '');
        formData.append('mediaType', file.type.startsWith('video/') ? 'video' : 'image');
        formData.append('fieldKey', field.key);
        formData.append('token', token);
        formData.append('position', value.length.toString());
        formData.append('isMain', 'false');

        const { data: uploadData, error: uploadError } = await supabase.functions.invoke('survey-upload', {
          body: formData
        });

        if (uploadError) throw uploadError;

        if (!uploadData.success) {
          throw new Error(uploadData.error || 'Upload failed');
        }

        const uploadedFile = {
          id: uploadData.data.id,
          name: uploadData.data.file_name,
          size: uploadData.data.file_size,
          type: uploadData.data.media_type,
          url: uploadData.data.signed_url,
          storage_path: uploadData.data.storage_path,
          storage_bucket: uploadData.data.storage_bucket,
        };

        newFiles.push(uploadedFile);
      } catch (error) {
        console.error('Upload error:', error);
        toast({
          title: `Failed to upload ${file.name}`,
          description: error instanceof Error ? error.message : 'Upload failed',
          variant: 'destructive'
        });
      }
    }

    if (newFiles.length > 0) {
      onChange([...value, ...newFiles]);
    }
    setUploading(false);
  }, [value, maxFiles, maxFileSize, onChange, toast, orderId, surveyId, token, field.key]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: acceptedTypes,
    maxFiles: maxFiles - value.length,
    disabled: uploading || value.length >= maxFiles,
  });

  const removeFile = async (fileId: string) => {
    const fileToRemove = value.find(f => f.id === fileId);
    
    // If it's an uploaded file with a database ID, delete from database
    if (fileToRemove?.id && typeof fileToRemove.id === 'string' && fileToRemove.id.length > 10) {
      try {
        const { error } = await supabase
          .from('client_survey_media')
          .delete()
          .eq('id', fileToRemove.id);
        
        if (error) {
          console.error('Error deleting file from database:', error);
          toast({
            title: 'Error',
            description: 'Failed to delete file',
            variant: 'destructive'
          });
          return;
        }
      } catch (error) {
        console.error('Error deleting file:', error);
      }
    }
    
    // If it's a blob URL, revoke it
    if (fileToRemove?.url && fileToRemove.url.startsWith('blob:')) {
      URL.revokeObjectURL(fileToRemove.url);
    }
    
    onChange(value.filter(f => f.id !== fileId));
  };

  const canUploadMore = value.length < maxFiles;
  const isMinimumMet = value.length >= minFiles;

  return (
    <div className="space-y-4">
      {/* Upload Zone */}
      {canUploadMore && (
        <div
          {...getRootProps()}
          className={`
            border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer
            ${isDragActive 
              ? 'border-primary bg-primary/5' 
              : 'border-muted-foreground/25 hover:border-primary hover:bg-accent'
            }
            ${uploading ? 'opacity-50 cursor-not-allowed' : ''}
          `}
        >
          <input {...getInputProps()} />
          
          <div className="space-y-4">
            {field.type === 'photo' ? (
              <Image className="h-12 w-12 text-muted-foreground mx-auto" />
            ) : field.type === 'video' ? (
              <Video className="h-12 w-12 text-muted-foreground mx-auto" />
            ) : (
              <Upload className="h-12 w-12 text-muted-foreground mx-auto" />
            )}
            
            <div>
              <p className="text-slate-600 font-medium">
                {isDragActive 
                  ? `Drop ${field.type}s here...` 
                  : `Drag & drop ${field.type}s or click to browse`
                }
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                {field.type === 'photo' 
                  ? `Images ≤ ${Math.round(maxFileSize / 1024 / 1024)}MB`
                  : field.type === 'video'
                  ? `Video ≤ ${Math.round(maxFileSize / 1024 / 1024)}MB`
                  : `Files ≤ ${Math.round(maxFileSize / 1024 / 1024)}MB`
                }
              </p>
              {minFiles > 0 && (
                <p className="text-xs text-muted-foreground">
                  {minFiles} file{minFiles !== 1 ? 's' : ''} required
                </p>
              )}
            </div>

            <Button type="button" variant="outline" size="sm">
              <Upload className="h-4 w-4 mr-2" />
              Browse Files
            </Button>
          </div>
        </div>
      )}

      {/* File List */}
      {value.length > 0 && (
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium">
              {value.length} of {maxFiles} {field.type}s selected
            </span>
            <span className={`text-sm ${isMinimumMet ? 'text-green-600' : 'text-amber-600'}`}>
              {minFiles > 0 && `${minFiles} required`}
            </span>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {value.map((file) => (
              <div key={file.id} className="relative group">
                {field.type === 'photo' && file.url ? (
                  <img
                    src={file.url}
                    alt={file.name}
                    className="w-full h-24 object-cover rounded-lg border"
                  />
                ) : field.type === 'video' ? (
                  <div className="w-full h-24 bg-slate-100 rounded-lg border flex items-center justify-center">
                    <Video className="h-6 w-6 text-slate-400" />
                  </div>
                ) : (
                  <div className="w-full h-24 bg-slate-100 rounded-lg border flex items-center justify-center">
                    <Upload className="h-6 w-6 text-slate-400" />
                  </div>
                )}
                
                {/* Overlay */}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors rounded-lg">
                  <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      size="sm"
                      variant="destructive"
                      className="h-6 w-6 p-0"
                      onClick={() => removeFile(file.id)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
                
                <div className="absolute bottom-2 left-2 right-2">
                  <p className="text-xs text-white bg-black/50 rounded px-2 py-1 truncate">
                    {file.name}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Validation Message */}
      {minFiles > 0 && value.length < minFiles && (
        <div className="text-sm text-amber-600">
          {minFiles - value.length} more {field.type}{minFiles - value.length !== 1 ? 's' : ''} required
        </div>
      )}
    </div>
  );
}