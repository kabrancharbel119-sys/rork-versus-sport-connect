import { useState, useEffect, useCallback, useRef } from 'react';
import * as ExpoLocation from 'expo-location';
import { Alert, Platform } from 'react-native';

// Geolocation error codes
const GEO_ERROR_CODES = {
  PERMISSION_DENIED: 1,
  POSITION_UNAVAILABLE: 2,
  TIMEOUT: 3,
};

function getGeolocationErrorMessage(code: number): string {
  switch (code) {
    case GEO_ERROR_CODES.PERMISSION_DENIED:
      return 'Permission de localisation refusée. Veuillez l\'activer dans les paramètres.';
    case GEO_ERROR_CODES.POSITION_UNAVAILABLE:
      return 'Service de localisation indisponible (vérifiez votre connexion ou activez le GPS).';
    case GEO_ERROR_CODES.TIMEOUT:
      return 'Délai de localisation dépassé. Veuillez réessayer.';
    default:
      return 'Erreur de localisation inconnue.';
  }
}

export interface LocationData {
  latitude: number;
  longitude: number;
  accuracy: number | null;
  altitude: number | null;
  city?: string;
  country?: string;
  region?: string;
  address?: string;
}

interface UseLocationOptions {
  enableHighAccuracy?: boolean;
  timeout?: number;
  maximumAge?: number;
  autoRequest?: boolean;
  onLocationChange?: (location: LocationData) => void;
  onError?: (error: Error) => void;
}

interface UseLocationReturn {
  location: LocationData | null;
  loading: boolean;
  error: Error | null;
  permissionStatus: ExpoLocation.PermissionStatus | null;
  requestPermission: () => Promise<boolean>;
  getCurrentLocation: () => Promise<LocationData | null>;
  getLocationName: () => Promise<string | null>;
  refreshLocation: () => Promise<void>;
  calculateDistance: (lat1: number, lon1: number, lat2: number, lon2: number) => number;
  isWithinRadius: (targetLat: number, targetLon: number, radiusKm: number) => boolean;
}

const MAPBOX_TOKEN = process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN;

export function useLocation(options: UseLocationOptions = {}): UseLocationReturn {
  const {
    enableHighAccuracy = true,
    timeout = 15000,
    maximumAge = 60000,
    autoRequest = false,
    onLocationChange,
    onError,
  } = options;

  const [location, setLocation] = useState<LocationData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [permissionStatus, setPermissionStatus] = useState<ExpoLocation.PermissionStatus | null>(null);
  
  const watchPositionSubscription = useRef<ExpoLocation.LocationSubscription | null>(null);

  // Request permission
  const requestPermission = useCallback(async (): Promise<boolean> => {
    try {
      const { status } = await ExpoLocation.requestForegroundPermissionsAsync();
      setPermissionStatus(status);
      return status === ExpoLocation.PermissionStatus.GRANTED;
    } catch (err) {
      console.error('Error requesting location permission:', err);
      return false;
    }
  }, []);

  // Get current location with reverse geocoding
  const getCurrentLocation = useCallback(async (): Promise<LocationData | null> => {
    setLoading(true);
    setError(null);

    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    try {
      // Check permission
      const hasPermission = await requestPermission();
      if (!hasPermission) {
        throw new Error('Permission de localisation refusée');
      }

      // Check if location services are enabled
      const isEnabled = await isLocationEnabled();
      if (!isEnabled) {
        throw new Error('Le service de localisation est désactivé. Veuillez activer le GPS.');
      }

      // Create a timeout promise
      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => {
          reject(new Error('Délai de localisation dépassé (15s). Vérifiez votre connexion GPS.'));
        }, timeout);
      });

      // Get position with timeout race
      const positionPromise = ExpoLocation.getCurrentPositionAsync({
        accuracy: enableHighAccuracy 
          ? ExpoLocation.Accuracy.High 
          : ExpoLocation.Accuracy.Balanced,
      });

      const position = await Promise.race([positionPromise, timeoutPromise]);

      const { latitude, longitude, accuracy, altitude } = position.coords;

      // Reverse geocoding with Mapbox
      let city: string | undefined;
      let country: string | undefined;
      let region: string | undefined;
      let address: string | undefined;

      try {
        const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${longitude},${latitude}.json?access_token=${MAPBOX_TOKEN}&types=place,country,region,address&language=fr&limit=1`;
        const response = await fetch(url);
        const data = await response.json();

        if (data.features && data.features.length > 0) {
          const feature = data.features[0];
          const context = feature.context || [];
          
          city = context.find((c: any) => c.id.startsWith('place.'))?.text || feature.text;
          country = context.find((c: any) => c.id.startsWith('country.'))?.text;
          region = context.find((c: any) => c.id.startsWith('region.'))?.text;
          address = feature.place_name;
        }
      } catch (geoError) {
        console.warn('Reverse geocoding failed:', geoError);
      }

      if (timeoutId) clearTimeout(timeoutId);

      const locationData: LocationData = {
        latitude,
        longitude,
        accuracy,
        altitude,
        city,
        country,
        region,
        address,
      };

      setLocation(locationData);
      onLocationChange?.(locationData);
      return locationData;
    } catch (err) {
      if (timeoutId) clearTimeout(timeoutId);

      let errorMessage: string;

      // Handle GeolocationPositionError (from browser)
      if (err && typeof err === 'object' && 'code' in err) {
        const code = (err as { code: number }).code;
        errorMessage = getGeolocationErrorMessage(code);
      } else if (err instanceof Error) {
        errorMessage = err.message;
      } else {
        errorMessage = 'Erreur de localisation inconnue';
      }

      const error = new Error(errorMessage);
      setError(error);
      onError?.(error);
      return null;
    } finally {
      setLoading(false);
    }
  }, [enableHighAccuracy, timeout, requestPermission, onLocationChange, onError]);

  // Get location name only (for display)
  const getLocationName = useCallback(async (): Promise<string | null> => {
    try {
      const loc = await getCurrentLocation();
      if (loc?.city && loc?.country) {
        return `${loc.city}, ${loc.country}`;
      }
      return loc?.address || null;
    } catch {
      return null;
    }
  }, [getCurrentLocation]);

  // Refresh location
  const refreshLocation = useCallback(async () => {
    await getCurrentLocation();
  }, [getCurrentLocation]);

  // Calculate distance between two points using Haversine formula
  const calculateDistance = useCallback((lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }, []);

  // Check if current location is within radius of target
  const isWithinRadius = useCallback((targetLat: number, targetLon: number, radiusKm: number): boolean => {
    if (!location) return false;
    const distance = calculateDistance(
      location.latitude, 
      location.longitude, 
      targetLat, 
      targetLon
    );
    return distance <= radiusKm;
  }, [location, calculateDistance]);

  // Watch position changes
  const startWatchingPosition = useCallback(async () => {
    const hasPermission = await requestPermission();
    if (!hasPermission) return;

    watchPositionSubscription.current = await ExpoLocation.watchPositionAsync(
      {
        accuracy: ExpoLocation.Accuracy.Balanced,
        timeInterval: 10000,
        distanceInterval: 100,
      },
      (position) => {
        const { latitude, longitude, accuracy, altitude } = position.coords;
        const locationData: LocationData = {
          latitude,
          longitude,
          accuracy,
          altitude,
          city: location?.city,
          country: location?.country,
          region: location?.region,
          address: location?.address,
        };
        setLocation(locationData);
        onLocationChange?.(locationData);
      }
    );
  }, [requestPermission, onLocationChange, location]);

  const stopWatchingPosition = useCallback(() => {
    if (watchPositionSubscription.current) {
      watchPositionSubscription.current.remove();
      watchPositionSubscription.current = null;
    }
  }, []);

  // Auto request on mount
  useEffect(() => {
    if (autoRequest) {
      getCurrentLocation();
    }

    return () => {
      stopWatchingPosition();
    };
  }, [autoRequest, getCurrentLocation, stopWatchingPosition]);

  return {
    location,
    loading,
    error,
    permissionStatus,
    requestPermission,
    getCurrentLocation,
    getLocationName,
    refreshLocation,
    calculateDistance,
    isWithinRadius,
  };
}

// Utility function for formatting distance
export function formatDistance(distanceKm: number): string {
  if (distanceKm < 1) {
    return `${Math.round(distanceKm * 1000)} m`;
  }
  if (distanceKm < 10) {
    return `${distanceKm.toFixed(1)} km`;
  }
  return `${Math.round(distanceKm)} km`;
}

// Utility for requesting background location (for future use)
export async function requestBackgroundLocationPermission(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  
  try {
    const { status } = await ExpoLocation.requestBackgroundPermissionsAsync();
    return status === ExpoLocation.PermissionStatus.GRANTED;
  } catch {
    return false;
  }
}

// Check if location services are enabled
export async function isLocationEnabled(): Promise<boolean> {
  try {
    const enabled = await ExpoLocation.hasServicesEnabledAsync();
    return enabled;
  } catch {
    return false;
  }
}
