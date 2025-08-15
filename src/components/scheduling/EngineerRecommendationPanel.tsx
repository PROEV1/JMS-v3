import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { Order, Engineer, getSmartEngineerRecommendations, clearDistanceCache } from '@/utils/schedulingUtils';
import { MapPin, Clock, User, Star, Zap, CheckCircle, X, RefreshCw } from 'lucide-react';

interface EngineerSuggestion {
  engineer: Engineer;
  availableDate?: string;
  distance: number;
  travelTime: number;
  score: number;
  reasons: string[];
}

interface EngineerRecommendationPanelProps {
  order: Order;
  engineers: Engineer[];
  onSelectEngineer: (engineerId: string | null, availableDate?: string) => void;
  isVisible: boolean;
}

export function EngineerRecommendationPanel({
  order,
  engineers,
  onSelectEngineer,
  isVisible
}: EngineerRecommendationPanelProps) {
  const [suggestions, setSuggestions] = useState<EngineerSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [settings, setSettings] = useState<any>(null);
  const [debugInfo, setDebugInfo] = useState<string>('');

  useEffect(() => {
    if (!isVisible || !order) return;
    loadSmartRecommendations();
  }, [order, engineers, isVisible]);

  const loadSmartRecommendations = async () => {
    setLoading(true);
    setDebugInfo(`Job: ${order.order_number} | Postcode: ${order.postcode || 'Not available'}`);
    
    try {
      const result = await getSmartEngineerRecommendations(order, engineers);
      setSuggestions(result.recommendations);
      setSettings(result.settings);
      
      setDebugInfo(prev => prev + `\nFound ${result.recommendations.length} recommendations`);
    } catch (error) {
      console.error('Error loading smart recommendations:', error);
      setSuggestions([]);
      setDebugInfo(prev => prev + `\nError: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleRefreshWithClearCache = async () => {
    console.log('🔄 CLEARING CACHE AND FORCING REFRESH');
    clearDistanceCache();
    setLoading(true);
    setSuggestions([]);
    setDebugInfo('Cache cleared - forcing fresh Mapbox API calls...');
    await loadSmartRecommendations();
  };

  if (!isVisible) return null;

  const getScoreColor = (score: number) => {
    if (score >= 120) return 'text-green-600';
    if (score >= 100) return 'text-blue-600';
    if (score >= 80) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getScoreIcon = (score: number) => {
    if (score >= 120) return <Star className="h-4 w-4 text-green-600" />;
    if (score >= 100) return <Zap className="h-4 w-4 text-blue-600" />;
    if (score >= 80) return <CheckCircle className="h-4 w-4 text-yellow-600" />;
    return <Clock className="h-4 w-4 text-red-600" />;
  };

  return (
    <Card className="w-80 shadow-lg border-2 border-primary/20 bg-background">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center justify-between">
          <div className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Smart Recommendations
          </div>
          <div className="flex gap-1">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleRefreshWithClearCache}
              disabled={loading}
              className="h-7 px-2"
            >
              <RefreshCw className="h-3 w-3" />
            </Button>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => onSelectEngineer(null)}
              className="h-7 w-7 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          For {order.order_number} - {order.postcode}
        </p>
        {settings && (
          <div className="bg-primary/10 border border-primary/20 rounded-md p-2 mt-2">
            <p className="text-xs text-primary-foreground">
              ✨ Shows first available slots after {settings.hours_advance_notice}h notice within {settings.max_distance_miles} miles
            </p>
          </div>
        )}
        
        {debugInfo && (
          <div className="bg-muted/50 rounded-md p-2 mt-2">
            <div className="text-xs font-medium mb-1">Debug Info:</div>
            {debugInfo.split('\n').map((line, i) => (
              <div key={i} className="text-xs font-mono">{line}</div>
            ))}
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-3 max-h-96 overflow-y-auto">
        {loading ? (
          <div className="text-center py-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
            <p className="text-sm text-muted-foreground mt-2">Calculating distances...</p>
          </div>
        ) : suggestions.length === 0 && !loading ? (
          <div className="text-center py-4 text-muted-foreground">
            <User className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No engineers available within distance limits</p>
            <p className="text-xs mt-1">Try adjusting the max distance in admin settings</p>
          </div>
        ) : (
          suggestions.map((suggestion, index) => (
            <div key={suggestion.engineer.id}>
              <div 
                className={`
                  p-3 rounded-lg border cursor-pointer transition-all duration-200
                  hover:border-primary hover:shadow-md
                  ${index === 0 ? 'border-primary/50 bg-primary/5' : 'border-border'}
                `}
                onClick={() => onSelectEngineer(suggestion.engineer.id, suggestion.availableDate)}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="text-xs">
                        {suggestion.engineer.name.split(' ').map(n => n[0]).join('')}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium text-sm">{suggestion.engineer.name}</p>
                      <p className="text-xs text-muted-foreground">{suggestion.engineer.region}</p>
                      {suggestion.availableDate && (
                        <p className="text-xs text-primary font-medium">
                          Available: {new Date(suggestion.availableDate).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {getScoreIcon(suggestion.score)}
                    <span className={`text-sm font-medium ${getScoreColor(suggestion.score)}`}>
                      {suggestion.score}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-1 text-xs text-muted-foreground mb-2">
                  <div className="flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    <span>{suggestion.distance.toFixed(1)}mi from {suggestion.engineer.starting_postcode || 'N/A'}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    <span>{suggestion.travelTime}min travel time</span>
                  </div>
                </div>

                <div className="flex flex-wrap gap-1 mb-2">
                  {index === 0 && (
                    <Badge className="text-xs bg-primary/10 text-primary border-primary">
                      Best Match
                    </Badge>
                  )}
                  <Badge variant="outline" className="text-xs text-green-600 border-green-200">
                    Next Available
                  </Badge>
                </div>

                <div className="space-y-1">
                  {suggestion.reasons.slice(0, 2).map((reason, idx) => (
                    <p key={idx} className="text-xs text-muted-foreground">
                      • {reason}
                    </p>
                  ))}
                </div>

                <Button 
                  size="sm" 
                  className="w-full mt-2" 
                  variant={index === 0 ? "default" : "outline"}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectEngineer(suggestion.engineer.id, suggestion.availableDate);
                  }}
                >
                  {index === 0 ? 'Assign (Recommended)' : 'Assign Engineer'}
                </Button>
              </div>
              {index < suggestions.length - 1 && <Separator className="my-2" />}
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}