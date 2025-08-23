import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Upload, Camera, X, Star, Image, Video } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface MediaFile {
  id: string;
  file_url: string;
  file_name: string;
  file_size: number;
  media_type: 'image' | 'video';
  is_main: boolean;
  position: number;
}

interface MediaUploadZoneProps {
  mediaType: 'image' | 'video';
  surveyId: string | null;
  orderId: string;
  uploadType: string;
  maxFiles: number;
  minFiles: number;
  acceptedTypes: string[];
  maxFileSize: number;
  maxDuration?: number;
}

export function MediaUploadZone({
  mediaType,
  surveyId,
  orderId,
  uploadType,
  maxFiles,
  minFiles,
  acceptedTypes,
  maxFileSize,
  maxDuration
}: MediaUploadZoneProps) {
  const [files, setFiles] = useState<MediaFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const { toast } = useToast();

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (files.length + acceptedFiles.length > maxFiles) {
      toast({
        title: `Maximum ${maxFiles} files allowed`,
        variant: 'destructive'
      });
      return;
    }

    setUploading(true);
    setUploadProgress(0);

    for (let i = 0; i < acceptedFiles.length; i++) {
      const file = acceptedFiles[i];
      
      // Validate file size
      if (file.size > maxFileSize) {
        toast({
          title: `File ${file.name} is too large`,
          description: `Maximum size: ${Math.round(maxFileSize / 1024 / 1024)}MB`,
          variant: 'destructive'
        });
        continue;
      }

      try {
        // Upload to Supabase Storage
        const fileExt = file.name.split('.').pop();
        const fileName = `${uploadType}/${orderId}/${Date.now()}.${fileExt}`;
        
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('client-documents')
          .upload(fileName, file);

        if (uploadError) throw uploadError;

        // Get public URL
        const { data: { publicUrl } } = supabase.storage
          .from('client-documents')
          .getPublicUrl(fileName);

        // Save to database
        const { data: mediaData, error: dbError } = await supabase
          .from('client_survey_media')
          .insert({
            survey_id: surveyId,
            order_id: orderId,
            media_type: mediaType,
            file_url: publicUrl,
            file_name: file.name,
            file_size: file.size,
            position: files.length + i,
            is_main: files.length === 0 && i === 0, // First file is main
          })
          .select()
          .single();

        if (dbError) throw dbError;

        // Add to local state
        setFiles(prev => [...prev, {
          id: mediaData.id,
          file_url: publicUrl,
          file_name: file.name,
          file_size: file.size,
          media_type: mediaType,
          is_main: mediaData.is_main,
          position: mediaData.position,
        }]);

        setUploadProgress(((i + 1) / acceptedFiles.length) * 100);

      } catch (error) {
        console.error('Upload error:', error);
        toast({
          title: `Failed to upload ${file.name}`,
          variant: 'destructive'
        });
      }
    }

    setUploading(false);
    setUploadProgress(0);
  }, [files, maxFiles, maxFileSize, mediaType, orderId, surveyId, uploadType, toast]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: acceptedTypes.reduce((acc, type) => ({ ...acc, [type]: [] }), {}),
    maxFiles: maxFiles - files.length,
    disabled: uploading || files.length >= maxFiles,
  });

  const removeFile = async (fileId: string) => {
    try {
      await supabase
        .from('client_survey_media')
        .delete()
        .eq('id', fileId);

      setFiles(prev => prev.filter(f => f.id !== fileId));
      toast({ title: 'File removed' });
    } catch (error) {
      console.error('Remove error:', error);
      toast({ title: 'Failed to remove file', variant: 'destructive' });
    }
  };

  const setAsMain = async (fileId: string) => {
    try {
      // Unset all main flags first
      await supabase
        .from('client_survey_media')
        .update({ is_main: false })
        .eq('order_id', orderId)
        .eq('media_type', mediaType);

      // Set the selected file as main
      await supabase
        .from('client_survey_media')
        .update({ is_main: true })
        .eq('id', fileId);

      setFiles(prev => prev.map(f => ({
        ...f,
        is_main: f.id === fileId
      })));

      toast({ title: 'Main photo updated' });
    } catch (error) {
      console.error('Set main error:', error);
      toast({ title: 'Failed to set main photo', variant: 'destructive' });
    }
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: mediaType === 'video' ? { facingMode: 'environment' } : false,
        audio: mediaType === 'video'
      });
      
      // Create a simple camera interface (simplified for this example)
      toast({ title: 'Camera feature would open here' });
      
      // Clean up stream
      stream.getTracks().forEach(track => track.stop());
    } catch (error) {
      console.error('Camera error:', error);
      toast({ title: 'Camera not available', variant: 'destructive' });
    }
  };

  const isMinimumMet = files.length >= minFiles;
  const canUploadMore = files.length < maxFiles;

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
              : 'border-slate-300 hover:border-primary hover:bg-slate-50'
            }
            ${uploading ? 'opacity-50 cursor-not-allowed' : ''}
          `}
        >
          <input {...getInputProps()} />
          
          <div className="space-y-4">
            {mediaType === 'image' ? (
              <Image className="h-12 w-12 text-slate-400 mx-auto" />
            ) : (
              <Video className="h-12 w-12 text-slate-400 mx-auto" />
            )}
            
            <div>
              <p className="text-slate-600 font-medium">
                {isDragActive 
                  ? `Drop ${mediaType}s here...` 
                  : `Drag & drop ${mediaType}s or browse`
                }
              </p>
              <p className="text-sm text-slate-500 mt-1">
                {mediaType === 'image' 
                  ? `Images ≤ ${Math.round(maxFileSize / 1024 / 1024)}MB`
                  : `Video ≤ ${maxDuration}s, ${Math.round(maxFileSize / 1024 / 1024)}MB`
                }
              </p>
            </div>

            <div className="flex justify-center space-x-3">
              <Button type="button" variant="outline" size="sm">
                <Upload className="h-4 w-4 mr-2" />
                Browse Files
              </Button>
              
              {'mediaDevices' in navigator && (
                <Button 
                  type="button" 
                  variant="outline" 
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    startCamera();
                  }}
                >
                  <Camera className="h-4 w-4 mr-2" />
                  Use Camera
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Upload Progress */}
      {uploading && (
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Uploading...</span>
            <span>{Math.round(uploadProgress)}%</span>
          </div>
          <Progress value={uploadProgress} />
        </div>
      )}

      {/* File List */}
      {files.length > 0 && (
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium">
              {files.length} of {maxFiles} {mediaType}s uploaded
            </span>
            <span className={`text-sm ${isMinimumMet ? 'text-green-600' : 'text-amber-600'}`}>
              {minFiles > 0 && `${minFiles} required`}
            </span>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {files.map((file) => (
              <div key={file.id} className="relative group">
                {file.media_type === 'image' ? (
                  <img
                    src={file.file_url}
                    alt={file.file_name}
                    className="w-full h-24 object-cover rounded-lg border"
                  />
                ) : (
                  <div className="w-full h-24 bg-slate-100 rounded-lg border flex items-center justify-center">
                    <Video className="h-6 w-6 text-slate-400" />
                  </div>
                )}
                
                {/* Overlay */}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors rounded-lg">
                  <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity space-x-1">
                    {mediaType === 'image' && !file.is_main && (
                      <Button
                        size="sm"
                        variant="secondary"
                        className="h-6 w-6 p-0"
                        onClick={() => setAsMain(file.id)}
                      >
                        <Star className="h-3 w-3" />
                      </Button>
                    )}
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
                
                {/* Main indicator */}
                {file.is_main && (
                  <div className="absolute top-2 left-2">
                    <div className="bg-primary text-white text-xs px-2 py-1 rounded">
                      Main
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}