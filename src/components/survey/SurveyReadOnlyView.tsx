import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { SignedImage } from '@/components/ui/SignedImage';
import { SignedFile } from '@/components/ui/SignedFile';
import { Image, Video, FileText } from 'lucide-react';
import { ImageModal } from '@/components/ui/ImageModal';

interface SurveyReadOnlyViewProps {
  survey: any;
  media: any[];
}

export function SurveyReadOnlyView({ survey, media }: SurveyReadOnlyViewProps) {
  const responses = survey.responses || {};

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      draft: { label: 'Draft', color: 'bg-slate-100 text-slate-700' },
      submitted: { label: 'Submitted', color: 'bg-blue-100 text-blue-700' },
      under_review: { label: 'Under Review', color: 'bg-yellow-100 text-yellow-700' },
      rework_requested: { label: 'Rework Requested', color: 'bg-red-100 text-red-700' },
      resubmitted: { label: 'Resubmitted', color: 'bg-purple-100 text-purple-700' },
      approved: { label: 'Approved', color: 'bg-green-100 text-green-700' },
    };
    
    const config = statusConfig[status as keyof typeof statusConfig];
    return (
      <Badge className={config?.color || 'bg-slate-100 text-slate-700'}>
        {config?.label || status}
      </Badge>
    );
  };

  const renderMediaForField = (fieldKey: string) => {
    const fieldMedia = media.filter(m => m.field_key === fieldKey);
    if (!fieldMedia.length) return null;

    return (
      <div className="mt-3">
        <div className="text-sm font-medium text-slate-600 mb-2">Uploaded Media:</div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {fieldMedia.map((item, index) => {
            console.log('Media item:', item); // Debug log
            return (
              <div key={index} className="relative group">
                {item.media_type === 'image' ? (
                  <div className="aspect-square rounded-lg overflow-hidden bg-slate-100">
                    {item.storage_path && item.storage_bucket ? (
                      <ImageModal
                        src={`/api/storage/${item.storage_bucket}/${item.storage_path}`}
                        alt={item.file_name || 'Survey image'}
                        className="w-full h-full"
                      >
                        <SignedImage
                          bucket={item.storage_bucket}
                          path={item.storage_path}
                          fallbackUrl="/placeholder.svg"
                          className="w-full h-full object-cover cursor-pointer"
                          alt={item.file_name || 'Survey image'}
                        />
                      </ImageModal>
                    ) : item.file_url && !item.file_url.startsWith('blob:') && item.file_url.startsWith('http') ? (
                      <ImageModal
                        src={item.file_url}
                        alt={item.file_name || 'Survey image'}
                        className="w-full h-full"
                      >
                        <img
                          src={item.file_url}
                          alt={item.file_name || 'Survey image'}
                          className="w-full h-full object-cover cursor-pointer"
                          onError={(e) => {
                            const target = e.currentTarget;
                            target.src = '/placeholder.svg';
                          }}
                        />
                      </ImageModal>
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-500">
                        <div className="text-center">
                          <Image size={24} className="mx-auto mb-2" />
                          <p className="text-xs">Image Unavailable</p>
                          <p className="text-[10px] text-slate-400 mt-1">
                            {item.storage_path ? 'Storage path exists' : 'No storage path'}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
              ) : item.media_type === 'video' ? (
                <div className="aspect-video rounded-lg overflow-hidden bg-slate-100 flex items-center justify-center">
                  {item.storage_path ? (
                    <SignedFile
                      bucket={item.storage_bucket || 'client-documents'}
                      path={item.storage_path}
                      fileName={item.file_name}
                      variant="ghost"
                      className="w-full h-full"
                      showIcon={false}
                    >
                      <div className="flex flex-col items-center justify-center h-full text-slate-600">
                        <Video size={32} className="mb-2" />
                        <span className="text-sm text-center px-2">{item.file_name}</span>
                      </div>
                    </SignedFile>
                  ) : item.file_url && !item.file_url.startsWith('blob:') ? (
                    <a href={item.file_url} target="_blank" rel="noopener noreferrer" className="flex flex-col items-center justify-center h-full text-slate-600 hover:text-slate-800">
                      <Video size={32} className="mb-2" />
                      <span className="text-sm text-center px-2">{item.file_name}</span>
                    </a>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full text-slate-500">
                      <Video size={32} className="mb-2" />
                      <span className="text-sm text-center px-2">Video Unavailable</span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="aspect-square rounded-lg bg-slate-100 flex items-center justify-center">
                  {item.storage_path ? (
                    <SignedFile
                      bucket={item.storage_bucket || 'client-documents'}
                      path={item.storage_path}
                      fileName={item.file_name}
                      variant="ghost"
                      className="w-full h-full"
                      showIcon={false}
                    >
                      <div className="flex flex-col items-center justify-center h-full text-slate-600">
                        <FileText size={32} className="mb-2" />
                        <span className="text-sm text-center px-2">{item.file_name}</span>
                      </div>
                    </SignedFile>
                  ) : item.file_url && !item.file_url.startsWith('blob:') ? (
                    <a href={item.file_url} target="_blank" rel="noopener noreferrer" className="flex flex-col items-center justify-center h-full text-slate-600 hover:text-slate-800">
                      <FileText size={32} className="mb-2" />
                      <span className="text-sm text-center px-2">{item.file_name}</span>
                    </a>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full text-slate-500">
                      <FileText size={32} className="mb-2" />
                      <span className="text-sm text-center px-2">File Unavailable</span>
                    </div>
                  )}
                </div>
              )}
            </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderPhotosFromArray = (photos: any[], title: string) => {
    if (!photos || !photos.length) return null;
    
    return (
      <div className="mt-4">
        <div className="text-sm font-medium text-slate-600 mb-2">{title}:</div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {photos.map((photo: any, index: number) => (
            <div key={index} className="aspect-square rounded-lg overflow-hidden bg-slate-100">
              {photo.url ? (
                <ImageModal
                  src={photo.url}
                  alt={photo.name || `${title} ${index + 1}`}
                  className="w-full h-full"
                >
                  <img 
                    src={photo.url} 
                    alt={photo.name || `${title} ${index + 1}`}
                    className="w-full h-full object-cover cursor-pointer"
                    onError={(e) => {
                      const target = e.currentTarget;
                      target.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="%23f3f4f6"/><text x="50" y="50" text-anchor="middle" dy="0.3em" fill="%236b7280">Image</text></svg>';
                    }}
                  />
                </ImageModal>
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <div className="text-center">
                    <Image size={24} className="mx-auto mb-2 text-slate-400" />
                    <p className="text-xs text-slate-600">{photo.name}</p>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderVideoFromArray = (videos: any[], title: string) => {
    if (!videos || !videos.length) return null;
    
    return (
      <div className="mt-4">
        <div className="text-sm font-medium text-slate-600 mb-2">{title}:</div>
        <div className="space-y-3">
          {videos.map((video: any, index: number) => (
            <div key={index} className="border rounded-lg p-4">
              <div className="flex items-center gap-3 mb-3">
                <Video className="h-6 w-6 text-slate-600" />
                <div>
                  <p className="font-medium text-sm">{video.name}</p>
                  <p className="text-xs text-slate-600">
                    {video.size ? `${(video.size / 1024 / 1024).toFixed(1)} MB` : 'Video file'}
                  </p>
                </div>
              </div>
              {video.url && (
                <video 
                  controls 
                  className="w-full rounded"
                  style={{ maxHeight: '300px' }}
                  preload="metadata"
                >
                  <source src={video.url} type="video/mp4" />
                  <source src={video.url} type="video/mov" />
                  Your browser does not support the video tag.
                </video>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Survey Submission</h1>
          <div className="flex items-center justify-center gap-4">
            {getStatusBadge(survey.status)}
            <span className="text-slate-600">
              Submitted: {new Date(survey.submitted_at || survey.created_at).toLocaleDateString()}
            </span>
          </div>
        </div>

        {/* Survey Responses */}
        <div className="space-y-6">
          {/* Property Details */}
          {(responses.property_type || responses.parking_type) && (
            <Card>
              <CardHeader>
                <CardTitle>Property Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {responses.property_type && (
                    <div>
                      <span className="text-slate-600 font-medium">Property Type:</span>
                      <span className="ml-2 capitalize">{responses.property_type}</span>
                    </div>
                  )}
                  {responses.parking_type && (
                    <div>
                      <span className="text-slate-600 font-medium">Parking:</span>
                      <span className="ml-2 capitalize">{responses.parking_type}</span>
                    </div>
                  )}
                </div>
                {renderMediaForField('propertyDetails')}
              </CardContent>
            </Card>
          )}

          {/* Charger Location */}
          {(responses.charger_location_notes || responses.charger_location_photos) && (
            <Card>
              <CardHeader>
                <CardTitle>Charger Location</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {responses.charger_location_notes && (
                  <div>
                    <span className="text-slate-600 font-medium">Notes:</span>
                    <p className="mt-1 text-slate-900">{responses.charger_location_notes}</p>
                  </div>
                )}
                {renderPhotosFromArray(responses.charger_location_photos, "Charger Location Photos")}
                {renderMediaForField('chargerLocation')}
              </CardContent>
            </Card>
          )}

          {/* Consumer Unit */}
          {(responses.consumer_unit_notes || responses.consumer_unit_photos) && (
            <Card>
              <CardHeader>
                <CardTitle>Consumer Unit Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {responses.consumer_unit_notes && (
                  <div>
                    <span className="text-slate-600 font-medium">Notes:</span>
                    <p className="mt-1 text-slate-900">{responses.consumer_unit_notes}</p>
                  </div>
                )}
                {renderPhotosFromArray(responses.consumer_unit_photos, "Consumer Unit Photos")}
                {renderMediaForField('consumerUnit')}
              </CardContent>
            </Card>
          )}

          {/* Walkthrough Video */}
          {responses.walkthrough_video && (
            <Card>
              <CardHeader>
                <CardTitle>Walkthrough Video</CardTitle>
              </CardHeader>
              <CardContent>
                {renderVideoFromArray(responses.walkthrough_video, "Property Walkthrough")}
                {renderMediaForField('walkthrough')}
              </CardContent>
            </Card>
          )}

          {/* Consent */}
          {responses.consent && (
            <Card>
              <CardHeader>
                <CardTitle>Consent</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <span className="text-slate-600 font-medium">Terms and conditions accepted:</span>
                  <Badge className="bg-green-100 text-green-700">Yes</Badge>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Legacy format support - Property Details */}
          {responses.propertyDetails && (
            <Card>
              <CardHeader>
                <CardTitle>Property Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {responses.propertyDetails.propertyType && (
                    <div>
                      <span className="text-slate-600 font-medium">Property Type:</span>
                      <span className="ml-2">{responses.propertyDetails.propertyType}</span>
                    </div>
                  )}
                  {responses.propertyDetails.parkingType && (
                    <div>
                      <span className="text-slate-600 font-medium">Parking:</span>
                      <span className="ml-2">{responses.propertyDetails.parkingType}</span>
                    </div>
                  )}
                  {responses.propertyDetails.postcode && (
                    <div>
                      <span className="text-slate-600 font-medium">Postcode:</span>
                      <span className="ml-2">{responses.propertyDetails.postcode}</span>
                    </div>
                  )}
                  {responses.propertyDetails.yearBuilt && (
                    <div>
                      <span className="text-slate-600 font-medium">Year Built:</span>
                      <span className="ml-2">{responses.propertyDetails.yearBuilt}</span>
                    </div>
                  )}
                </div>
                {responses.propertyDetails.notes && (
                  <div>
                    <span className="text-slate-600 font-medium">Notes:</span>
                    <p className="mt-1 text-slate-900">{responses.propertyDetails.notes}</p>
                  </div>
                )}
                {renderMediaForField('propertyDetails')}
              </CardContent>
            </Card>
          )}

          {/* Legacy format support - other sections */}
          {responses.parkingAccess && (
            <Card>
              <CardHeader>
                <CardTitle>Parking Access</CardTitle>
              </CardHeader>
              <CardContent>
                <div>
                  <span className="text-slate-600 font-medium">Access Type:</span>
                  <span className="ml-2">{responses.parkingAccess}</span>
                </div>
                {renderMediaForField('parkingAccess')}
              </CardContent>
            </Card>
          )}

          {responses.chargerLocation && (
            <Card>
              <CardHeader>
                <CardTitle>Charger Location</CardTitle>
              </CardHeader>
              <CardContent>
                <div>
                  <span className="text-slate-600 font-medium">Preferred Location:</span>
                  <span className="ml-2">{responses.chargerLocation}</span>
                </div>
                {renderMediaForField('chargerLocation')}
              </CardContent>
            </Card>
          )}

          {responses.consumerUnit && (
            <Card>
              <CardHeader>
                <CardTitle>Consumer Unit Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {Object.entries(responses.consumerUnit).map(([key, value]) => (
                    <div key={key}>
                      <span className="text-slate-600 font-medium capitalize">
                        {key.replace(/([A-Z])/g, ' $1')}:
                      </span>
                      <span className="ml-2">{String(value)}</span>
                    </div>
                  ))}
                </div>
                {renderMediaForField('consumerUnit')}
              </CardContent>
            </Card>
          )}

          {responses.videoSummary && (
            <Card>
              <CardHeader>
                <CardTitle>Video Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-slate-900">{responses.videoSummary}</p>
                {renderMediaForField('videoSummary')}
              </CardContent>
            </Card>
          )}

          {responses.additionalMedia && (
            <Card>
              <CardHeader>
                <CardTitle>Additional Documentation</CardTitle>
              </CardHeader>
              <CardContent>
                {responses.additionalMedia.notes && (
                  <p className="text-slate-900 mb-4">{responses.additionalMedia.notes}</p>
                )}
                {renderMediaForField('additionalMedia')}
              </CardContent>
            </Card>
          )}

          {/* Review Information */}
          {(survey.review_notes || survey.rework_reason) && (
            <Card>
              <CardHeader>
                <CardTitle>Review Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {survey.review_notes && (
                  <div>
                    <span className="text-slate-600 font-medium">Review Notes:</span>
                    <p className="mt-1 text-slate-900">{survey.review_notes}</p>
                  </div>
                )}
                {survey.rework_reason && (
                  <div>
                    <span className="text-slate-600 font-medium">Rework Reason:</span>
                    <p className="mt-1 text-slate-900">{survey.rework_reason}</p>
                  </div>
                )}
                {survey.reviewed_at && (
                  <div className="text-sm text-slate-600">
                    Reviewed: {new Date(survey.reviewed_at).toLocaleDateString()}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}