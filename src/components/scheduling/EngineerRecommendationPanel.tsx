import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { Order, Engineer, getSmartEngineerRecommendations, clearDistanceCache } from '@/utils/schedulingUtils';
import { getLocationDisplayText, getBestPostcode } from '@/utils/postcodeUtils';
import { MapPin, Clock, User, Star, Zap, CheckCircle, X, RefreshCw } from 'lucide-react';

interface EngineerSuggestion {
  engineer: Engineer;
  availableDate?: string;
  distance: number;
  travelTime: number;
  score: number;
  reasons: string[];
  dailyWorkloadThatDay?: number;
  travelSource: 'mapbox' | 'service-area-estimate' | 'fallback-default';
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
    const displayPostcode = getLocationDisplayText(order);
    setDebugInfo(`Job: ${order.order_number} | Checking postcode sources...`);
    
    try {
      const result = await getSmartEngineerRecommendations(order, getBestPostcode(order), { fastMode: true });
      setSuggestions(result.recommendations);
      setSettings(result.settings);
      
      if ('error' in result && result.error) {
        setDebugInfo(`Job: ${order.order_number} | Error: ${result.error}`);
      } else if ('diagnostics' in result) {
        let diagnostics = result.diagnostics ? 
          ` | Excluded: ${result.diagnostics.excludedEngineers}/${result.diagnostics.totalEngineers}` : '';
        
        // Add detailed exclusion reasons for debugging
        if (result.diagnostics?.exclusionReasons) {
          const exclusionSummary = Object.entries(result.diagnostics.exclusionReasons)
            .map(([name, reasons]) => `${name}: ${(reasons as string[]).join(', ')}`)
            .join(' | ');
          if (exclusionSummary) {
            diagnostics += ` | Exclusions: ${exclusionSummary}`;
          }
        }
        
        setDebugInfo(`Job: ${order.order_number} | Postcode: ${displayPostcode} | Found ${result.recommendations.length} recommendations${diagnostics}`);
      } else {
        setDebugInfo(`Job: ${order.order_number} | Postcode: ${displayPostcode} | Found ${result.recommendations.length} recommendations`);
      }
    } catch (error) {
      console.error('Error loading smart recommendations:', error);
      setSuggestions([]);
      setDebugInfo(`Job: ${order.order_number} | Error: ${error.message}`);
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
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <MapPin className="h-4 w-4" />
              <span>Order: {order.order_number}</span>
              <span>•</span>
              <span>Postcode: {getLocationDisplayText(order)}</span>
            </div>
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
          <div className="space-y-4">
            {/* Featured Recommendations */}
            {suggestions.slice(0, 3).length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Star className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium text-primary">Featured ({Math.min(3, suggestions.length)})</span>
                </div>
                <div className="space-y-2">
                  {suggestions.slice(0, 3).map((suggestion, index) => (
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
                             <Badge 
                               variant={suggestion.travelSource === 'mapbox' ? 'default' : 'secondary'} 
                               className="text-xs ml-1"
                             >
                               {suggestion.travelSource === 'mapbox' ? 'Live' : 
                                suggestion.travelSource === 'service-area-estimate' ? 'Est.' : 'Default'}
                             </Badge>
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
                            Featured
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
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* All Engineers */}
            {suggestions.length > 3 && (
              <div>
                <Separator className="my-3" />
                <div className="flex items-center gap-2 mb-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium text-muted-foreground">All Qualifying Engineers ({suggestions.length})</span>
                </div>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {suggestions.map((suggestion, index) => (
                    <div 
                      key={suggestion.engineer.id}
                      className="p-2 rounded border border-border hover:border-primary cursor-pointer transition-all duration-200"
                      onClick={() => onSelectEngineer(suggestion.engineer.id, suggestion.availableDate)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Avatar className="h-6 w-6">
                            <AvatarFallback className="text-xs">
                              {suggestion.engineer.name.split(' ').map(n => n[0]).join('')}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="text-sm font-medium">{suggestion.engineer.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {suggestion.availableDate ? new Date(suggestion.availableDate).toLocaleDateString() : 'Date TBD'}
                            </p>
                          </div>
                        </div>
                        <div className="text-right text-xs text-muted-foreground">
                          <div>{suggestion.distance.toFixed(1)}mi</div>
                          <div>{suggestion.travelTime}min</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}