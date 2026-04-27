import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  FlatList,
  Text,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
  Alert,
  Platform,
} from 'react-native';
import { MapPin, X, Navigation } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { useDebounce } from '@/hooks/useDebounce';
import * as Location from 'expo-location';

export interface CityResult {
  id: string;
  name: string;
  country: string;
  countryCode: string;
  latitude: number;
  longitude: number;
  fullAddress: string;
  region?: string;
  population?: number;
}

interface CityAutocompleteProps {
  value?: string;
  onSelect: (city: CityResult) => void;
  onClear?: () => void;
  placeholder?: string;
  style?: ViewStyle;
  maxResults?: number;
  includeLocationButton?: boolean;
  minChars?: number;
}

const MAPBOX_TOKEN = process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN;

// Cache local pour les requêtes récentes
const cityCache = new Map<string, { data: CityResult[]; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export function CityAutocomplete({
  value,
  onSelect,
  onClear,
  placeholder = 'Rechercher une ville...',
  style,
  maxResults = 5,
  includeLocationButton = true,
  minChars = 2,
}: CityAutocompleteProps) {
  const [query, setQuery] = useState(value || '');
  const [results, setResults] = useState<CityResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [gettingLocation, setGettingLocation] = useState(false);
  const inputRef = useRef<TextInput>(null);
  const debouncedQuery = useDebounce(query, 300);

  // Recherche avec Mapbox Geocoding API
  const searchCities = useCallback(async (searchText: string) => {
    if (!searchText || searchText.length < minChars) {
      setResults([]);
      return;
    }

    // Check cache
    const cacheKey = `${searchText.toLowerCase()}_${maxResults}`;
    const cached = cityCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      setResults(cached.data.slice(0, maxResults));
      return;
    }

    setLoading(true);
    try {
      // Mapbox Geocoding API - gratuit jusqu'à 100K requêtes/mois
      const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
        searchText
      )}.json?access_token=${MAPBOX_TOKEN}&types=place&language=fr&limit=${maxResults * 2}`;

      const response = await fetch(url);
      const data = await response.json();

      if (data.features) {
        const cities: CityResult[] = data.features
          .map((feature: any) => ({
            id: feature.id,
            name: feature.text,
            country: feature.context?.find((c: any) => c.id.startsWith('country.'))?.text || '',
            countryCode:
              feature.context?.find((c: any) => c.id.startsWith('country.'))?.short_code?.toUpperCase() || '',
            latitude: feature.center[1],
            longitude: feature.center[0],
            fullAddress: feature.place_name,
            region: feature.context?.find((c: any) => c.id.startsWith('region.'))?.text,
            population: feature.properties?.population,
          }))
          .filter((city: CityResult) => city.name && city.country);

        // Deduplicate by name+country and sort by population
        const uniqueCities = cities
          .filter(
            (city, index, self) =>
              index === self.findIndex((c) => c.name === city.name && c.country === city.country)
          )
          .slice(0, maxResults);

        // Cache results
        cityCache.set(cacheKey, { data: uniqueCities, timestamp: Date.now() });
        setResults(uniqueCities);
      }
    } catch (error) {
      console.error('City search error:', error);
    } finally {
      setLoading(false);
    }
  }, [maxResults, minChars]);

  // Effect for debounced search
  useEffect(() => {
    if (debouncedQuery && debouncedQuery.length >= minChars) {
      searchCities(debouncedQuery);
      setShowResults(true);
    } else {
      setResults([]);
      setShowResults(false);
    }
  }, [debouncedQuery, searchCities, minChars]);

  // Get location via IP-based geolocation (fallback for web)
  const getLocationFromIP = async (): Promise<CityResult | null> => {
    try {
      // Use a free IP geolocation service
      const response = await fetch('https://ipapi.co/json/');
      if (!response.ok) throw new Error('IP geolocation failed');

      const data = await response.json();

      if (data.city && data.country_name) {
        return {
          id: `ip-${data.city}`,
          name: data.city,
          country: data.country_name,
          countryCode: data.country_code?.toUpperCase() || '',
          latitude: data.latitude,
          longitude: data.longitude,
          fullAddress: `${data.city}, ${data.country_name}`,
          region: data.region,
        };
      }
      return null;
    } catch (error) {
      console.warn('IP geolocation failed:', error);
      return null;
    }
  };

  // Get current location with timeout and fallback
  const handleGetCurrentLocation = async () => {
    setGettingLocation(true);
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    const isWeb = Platform.OS === 'web';

    const getLocationWithTimeout = async () => {
      // Check if location services are enabled
      const isEnabled = await Location.hasServicesEnabledAsync();
      if (!isEnabled) {
        throw new Error('Le service de localisation est désactivé. Veuillez activer le GPS dans les paramètres de votre appareil.');
      }

      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        throw new Error('Permission de localisation refusée. Veuillez autoriser l\'accès à votre position.');
      }

      // Create timeout promise
      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => {
          reject(new Error('Délai de localisation dépassé'));
        }, 10000); // 10 second timeout
      });

      // Get position with timeout race
      const locationPromise = Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      return Promise.race([locationPromise, timeoutPromise]);
    };

    try {
      // Try native geolocation first
      const location = await getLocationWithTimeout();

      // Clear timeout if successful
      if (timeoutId) clearTimeout(timeoutId);

      // Reverse geocoding avec Mapbox
      const { latitude, longitude } = location.coords;
      const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${longitude},${latitude}.json?access_token=${MAPBOX_TOKEN}&types=place&language=fr&limit=1`;

      const response = await fetch(url);
      const data = await response.json();

      if (data.features && data.features.length > 0) {
        const feature = data.features[0];
        const city: CityResult = {
          id: feature.id,
          name: feature.text,
          country: feature.context?.find((c: any) => c.id.startsWith('country.'))?.text || '',
          countryCode:
            feature.context?.find((c: any) => c.id.startsWith('country.'))?.short_code?.toUpperCase() || '',
          latitude,
          longitude,
          fullAddress: feature.place_name,
          region: feature.context?.find((c: any) => c.id.startsWith('region.'))?.text,
        };

        setQuery(city.name);
        onSelect(city);
        setShowResults(false);
        return;
      }
      throw new Error('Aucune ville trouvée');
    } catch (error: any) {
      // Clear timeout on error
      if (timeoutId) clearTimeout(timeoutId);

      console.warn('Native geolocation failed, trying IP fallback:', error);

      // Try IP-based geolocation as fallback (especially for web)
      const ipCity = await getLocationFromIP();

      if (ipCity) {
        setQuery(ipCity.name);
        onSelect(ipCity);
        setShowResults(false);
        Alert.alert('Localisation', `${ipCity.name}, ${ipCity.country}`);
        return;
      }

      // No fallback available
      console.error('Geolocation error:', error);

      let message = 'Impossible de détecter votre position.';
      if (isWeb) {
        message += '\n\nSur le web, la géolocalisation précise nécessite HTTPS (sauf localhost). Veuillez saisir votre ville manuellement ou utiliser l\'application mobile.';
      } else {
        message += ' ' + (error?.message || 'Vérifiez que le GPS est activé.');
      }

      Alert.alert('Erreur de localisation', message);
    } finally {
      setGettingLocation(false);
    }
  };

  const handleSelect = (city: CityResult) => {
    setQuery(city.name);
    onSelect(city);
    setShowResults(false);
    inputRef.current?.blur();
  };

  const handleClear = () => {
    setQuery('');
    setResults([]);
    setShowResults(false);
    onClear?.();
    inputRef.current?.focus();
  };

  return (
    <View style={[styles.container, style]}>
      <View style={styles.inputContainer}>
        <MapPin size={20} color={Colors.text.muted} style={styles.icon} />
        <TextInput
          ref={inputRef}
          value={query}
          onChangeText={setQuery}
          placeholder={placeholder}
          style={styles.input}
          placeholderTextColor={Colors.text.muted}
          autoCapitalize="words"
          onFocus={() => query.length >= minChars && setShowResults(true)}
        />
        {loading || gettingLocation ? (
          <ActivityIndicator size="small" color={Colors.primary.orange} style={styles.loader} />
        ) : query ? (
          <TouchableOpacity onPress={handleClear} style={styles.clearButton}>
            <X size={18} color={Colors.text.muted} />
          </TouchableOpacity>
        ) : includeLocationButton ? (
          <TouchableOpacity onPress={handleGetCurrentLocation} style={styles.locationButton}>
            <Navigation size={18} color={Colors.primary.orange} />
          </TouchableOpacity>
        ) : null}
      </View>

      {showResults && results.length > 0 && (
        <View style={styles.resultsContainer}>
          <FlatList
            data={results}
            keyExtractor={(item) => item.id}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.resultItem}
                onPress={() => handleSelect(item)}
                activeOpacity={0.7}
              >
                <View style={styles.resultContent}>
                  <Text style={styles.cityName}>{item.name}</Text>
                  <Text style={styles.cityDetails}>
                    {item.region ? `${item.region}, ` : ''}
                    {item.country}
                  </Text>
                </View>
                {item.population && (
                  <Text style={styles.population}>
                    {(item.population / 1000000).toFixed(1)}M hab.
                  </Text>
                )}
              </TouchableOpacity>
            )}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    zIndex: 1000,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background.elevated,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border.light,
    paddingHorizontal: 12,
    minHeight: 48,
  },
  icon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    color: Colors.text.primary,
    fontSize: 16,
    paddingVertical: 12,
  },
  loader: {
    marginLeft: 8,
  },
  clearButton: {
    padding: 4,
    marginLeft: 8,
  },
  locationButton: {
    padding: 4,
    marginLeft: 8,
  },
  resultsContainer: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    marginTop: 4,
    backgroundColor: Colors.background.elevated,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border.light,
    maxHeight: 250,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  resultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  resultContent: {
    flex: 1,
  },
  cityName: {
    color: Colors.text.primary,
    fontSize: 16,
    fontWeight: '500',
  },
  cityDetails: {
    color: Colors.text.muted,
    fontSize: 13,
    marginTop: 2,
  },
  population: {
    color: Colors.text.secondary,
    fontSize: 12,
    marginLeft: 8,
  },
  separator: {
    height: 1,
    backgroundColor: Colors.border.light,
    marginHorizontal: 16,
  },
});
