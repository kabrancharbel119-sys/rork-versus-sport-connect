import createContextHook from '@nkzw/create-context-hook';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useEffect, useCallback } from 'react';
import { Platform } from 'react-native';
import * as Location from 'expo-location';
import { UserLocation } from '@/types';

const LOCATION_STORAGE_KEY = 'vs_location';
const DEFAULT_LOCATION: UserLocation = { latitude: 5.3599, longitude: -4.0083, city: 'Abidjan', country: 'Côte d\'Ivoire', lastUpdated: new Date() };

export const [LocationProvider, useLocation] = createContextHook(() => {
  const queryClient = useQueryClient();
  const [location, setLocation] = useState<UserLocation | null>(null);
  const [permissionStatus, setPermissionStatus] = useState<'granted' | 'denied' | 'undetermined'>('undetermined');

  const locationQuery = useQuery({
    queryKey: ['location'],
    queryFn: async () => {
      console.log('[Location] Loading stored location...');
      const stored = await AsyncStorage.getItem(LOCATION_STORAGE_KEY);
      if (stored) return JSON.parse(stored) as UserLocation;
      return DEFAULT_LOCATION;
    },
  });

  useEffect(() => {
    if (locationQuery.data) setLocation(locationQuery.data);
  }, [locationQuery.data]);

  const requestPermissionMutation = useMutation({
    mutationFn: async () => {
      console.log('[Location] Requesting permission...');
      if (Platform.OS === 'web') {
        setPermissionStatus('granted');
        return 'granted';
      }
      const { status } = await Location.requestForegroundPermissionsAsync();
      setPermissionStatus(status === 'granted' ? 'granted' : 'denied');
      return status;
    },
  });

  const updateLocationMutation = useMutation({
    mutationFn: async () => {
      console.log('[Location] Updating location...');
      if (Platform.OS === 'web') {
        await AsyncStorage.setItem(LOCATION_STORAGE_KEY, JSON.stringify(DEFAULT_LOCATION));
        return DEFAULT_LOCATION;
      }
      const currentLocation = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const [geocode] = await Location.reverseGeocodeAsync({ latitude: currentLocation.coords.latitude, longitude: currentLocation.coords.longitude }).catch(() => [null]);
      const newLocation: UserLocation = {
        latitude: currentLocation.coords.latitude,
        longitude: currentLocation.coords.longitude,
        city: geocode?.city || geocode?.subregion || 'Unknown',
        country: geocode?.country || 'Unknown',
        lastUpdated: new Date(),
      };
      await AsyncStorage.setItem(LOCATION_STORAGE_KEY, JSON.stringify(newLocation));
      return newLocation;
    },
    onSuccess: (data) => {
      setLocation(data);
      queryClient.invalidateQueries({ queryKey: ['location'] });
    },
  });

  const getDistance = useCallback((lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }, []);

  const isWithinRadius = useCallback((targetLat: number, targetLon: number, radiusKm: number = 50): boolean => {
    if (!location) return true;
    return getDistance(location.latitude, location.longitude, targetLat, targetLon) <= radiusKm;
  }, [location, getDistance]);

  return {
    location,
    permissionStatus,
    isLoading: locationQuery.isLoading,
    requestPermission: requestPermissionMutation.mutateAsync,
    updateLocation: updateLocationMutation.mutateAsync,
    isUpdating: updateLocationMutation.isPending,
    getDistance,
    isWithinRadius,
  };
});
