import createContextHook from '@nkzw/create-context-hook';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useEffect, useCallback, useRef } from 'react';
import { Platform, Alert } from 'react-native';
import * as Location from 'expo-location';
import { UserLocation } from '@/types';

const LOCATION_STORAGE_KEY = 'vs_location';

export const [LocationProvider, useLocation] = createContextHook(() => {
  const queryClient = useQueryClient();
  const [location, setLocation] = useState<UserLocation | null>(null);
  const [permissionStatus, setPermissionStatus] = useState<'granted' | 'denied' | 'undetermined'>('undetermined');
  const [error, setError] = useState<string | null>(null);
  const autoRequestedRef = useRef(false);

  const locationQuery = useQuery({
    queryKey: ['location'],
    queryFn: async () => {
      const stored = await AsyncStorage.getItem(LOCATION_STORAGE_KEY);
      if (stored) return JSON.parse(stored) as UserLocation;
      return null;
    },
  });

  useEffect(() => {
    if (locationQuery.data) setLocation(locationQuery.data);
  }, [locationQuery.data]);

  const requestPermission = useCallback(async (): Promise<'granted' | 'denied'> => {
    try {
      if (Platform.OS === 'web') {
        setPermissionStatus('granted');
        return 'granted';
      }
      const { status } = await Location.requestForegroundPermissionsAsync();
      const result = status === 'granted' ? 'granted' : 'denied';
      setPermissionStatus(result);
      if (result === 'denied') {
        setError('Permission de localisation refusée. Activez-la dans les paramètres de votre appareil.');
      }
      return result;
    } catch (e) {
      console.error('[Location] Permission error:', e);
      setPermissionStatus('denied');
      setError('Impossible de demander la permission de localisation.');
      return 'denied';
    }
  }, []);

  const fetchLocation = useCallback(async (): Promise<UserLocation | null> => {
    setError(null);

    if (Platform.OS === 'web') {
      return new Promise<UserLocation | null>((resolve) => {
        if (!navigator?.geolocation) {
          setError('La géolocalisation n\'est pas supportée par ce navigateur.');
          resolve(null);
          return;
        }
        navigator.geolocation.getCurrentPosition(
          async (pos) => {
            const { latitude, longitude } = pos.coords;
            let city = 'Unknown';
            let country = 'Unknown';
            try {
              const [geocode] = await Location.reverseGeocodeAsync({ latitude, longitude }).catch(() => [null]);
              if (geocode) {
                city = geocode.city || geocode.subregion || 'Unknown';
                country = geocode.country || 'Unknown';
              }
            } catch {}
            const newLocation: UserLocation = { latitude, longitude, city, country, lastUpdated: new Date() };
            await AsyncStorage.setItem(LOCATION_STORAGE_KEY, JSON.stringify(newLocation));
            setLocation(newLocation);
            queryClient.invalidateQueries({ queryKey: ['location'] });
            resolve(newLocation);
          },
          (err) => {
            const msg = err.code === 1
              ? 'Permission de localisation refusée.'
              : err.code === 2
              ? 'Service de localisation indisponible. Activez le GPS.'
              : 'Délai de localisation dépassé.';
            setError(msg);
            setPermissionStatus('denied');
            resolve(null);
          },
          { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 }
        );
      });
    }

    const servicesEnabled = await Location.hasServicesEnabledAsync();
    if (!servicesEnabled) {
      setError('Le service de localisation (GPS) est désactivé. Activez-le dans les paramètres.');
      setPermissionStatus('denied');
      return null;
    }

    const perm = await requestPermission();
    if (perm !== 'granted') return null;

    try {
      const currentLocation = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const { latitude, longitude } = currentLocation.coords;
      let city = 'Unknown';
      let country = 'Unknown';
      try {
        const [geocode] = await Location.reverseGeocodeAsync({ latitude, longitude }).catch(() => [null]);
        if (geocode) {
          city = geocode.city || geocode.subregion || 'Unknown';
          country = geocode.country || 'Unknown';
        }
      } catch {}
      const newLocation: UserLocation = { latitude, longitude, city, country, lastUpdated: new Date() };
      await AsyncStorage.setItem(LOCATION_STORAGE_KEY, JSON.stringify(newLocation));
      setLocation(newLocation);
      queryClient.invalidateQueries({ queryKey: ['location'] });
      return newLocation;
    } catch (e: any) {
      console.error('[Location] Fetch error:', e);
      setError('Impossible d\'obtenir votre position. Vérifiez votre connexion GPS.');
      return null;
    }
  }, [requestPermission, queryClient]);

  const updateLocationMutation = useMutation({
    mutationFn: fetchLocation,
  });

  const getDistance = useCallback((lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }, []);

  const isWithinRadius = useCallback((targetLat: number, targetLon: number, radiusKm: number = 50): boolean => {
    if (!location) return false;
    return getDistance(location.latitude, location.longitude, targetLat, targetLon) <= radiusKm;
  }, [location, getDistance]);

  // Auto-request permission and fetch location on mount if none stored
  useEffect(() => {
    if (autoRequestedRef.current) return;
    autoRequestedRef.current = true;

    if (locationQuery.data) {
      setLocation(locationQuery.data);
      return;
    }

    // No stored location — request permission and fetch GPS
    (async () => {
      const perm = await requestPermission();
      if (perm === 'granted') {
        await fetchLocation();
      }
    })();
  }, [locationQuery.data, requestPermission, fetchLocation]);

  const clearLocation = useCallback(async () => {
    await AsyncStorage.removeItem(LOCATION_STORAGE_KEY);
    setLocation(null);
    setPermissionStatus('undetermined');
    queryClient.invalidateQueries({ queryKey: ['location'] });
  }, [queryClient]);

  return {
    location,
    permissionStatus,
    error,
    isLoading: locationQuery.isLoading,
    requestPermission,
    updateLocation: fetchLocation,
    isUpdating: updateLocationMutation.isPending,
    getDistance,
    isWithinRadius,
    clearLocation,
  };
});
