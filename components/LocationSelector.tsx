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
} from 'react-native';
import { MapPin, X, Navigation, ChevronDown, ChevronRight } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { useDebounce } from '@/hooks/useDebounce';
import * as Location from 'expo-location';

// Liste des pays principaux (peut être étendue)
const COUNTRIES = [
  { code: 'CI', name: "Côte d'Ivoire" },
  { code: 'FR', name: 'France' },
  { code: 'SN', name: 'Sénégal' },
  { code: 'CM', name: 'Cameroun' },
  { code: 'MA', name: 'Maroc' },
  { code: 'TN', name: 'Tunisie' },
  { code: 'DZ', name: 'Algérie' },
  { code: 'ML', name: 'Mali' },
  { code: 'BF', name: 'Burkina Faso' },
  { code: 'GN', name: 'Guinée' },
  { code: 'TG', name: 'Togo' },
  { code: 'BJ', name: 'Bénin' },
  { code: 'GH', name: 'Ghana' },
  { code: 'NG', name: 'Nigéria' },
  { code: 'CA', name: 'Canada' },
  { code: 'US', name: 'États-Unis' },
  { code: 'BE', name: 'Belgique' },
  { code: 'CH', name: 'Suisse' },
  { code: 'DE', name: 'Allemagne' },
  { code: 'IT', name: 'Italie' },
  { code: 'ES', name: 'Espagne' },
  { code: 'PT', name: 'Portugal' },
  { code: 'GB', name: 'Royaume-Uni' },
  { code: 'BR', name: 'Brésil' },
  { code: 'ZA', name: 'Afrique du Sud' },
  { code: 'EG', name: 'Égypte' },
  { code: 'KE', name: 'Kenya' },
  { code: 'RW', name: 'Rwanda' },
  { code: 'ET', name: 'Éthiopie' },
  { code: 'AU', name: 'Australie' },
  { code: 'IN', name: 'Inde' },
  { code: 'JP', name: 'Japon' },
  { code: 'CN', name: 'Chine' },
  { code: 'MX', name: 'Mexique' },
  { code: 'AR', name: 'Argentine' },
  { code: 'CL', name: 'Chili' },
  { code: 'CO', name: 'Colombie' },
  { code: 'PE', name: 'Pérou' },
  { code: 'AE', name: 'Émirats Arabes Unis' },
  { code: 'QA', name: 'Qatar' },
  { code: 'SA', name: 'Arabie Saoudite' },
  { code: 'TR', name: 'Turquie' },
  { code: 'RU', name: 'Russie' },
  { code: 'UA', name: 'Ukraine' },
  { code: 'PL', name: 'Pologne' },
  { code: 'SE', name: 'Suède' },
  { code: 'NO', name: 'Norvège' },
  { code: 'DK', name: 'Danemark' },
  { code: 'NL', name: 'Pays-Bas' },
  { code: 'AT', name: 'Autriche' },
  { code: 'CZ', name: 'République Tchèque' },
  { code: 'HU', name: 'Hongrie' },
  { code: 'RO', name: 'Roumanie' },
  { code: 'BG', name: 'Bulgarie' },
  { code: 'HR', name: 'Croatie' },
  { code: 'GR', name: 'Grèce' },
  { code: 'IE', name: 'Irlande' },
  { code: 'FI', name: 'Finlande' },
  { code: 'IS', name: 'Islande' },
  { code: 'NZ', name: 'Nouvelle-Zélande' },
  { code: 'ID', name: 'Indonésie' },
  { code: 'TH', name: 'Thaïlande' },
  { code: 'VN', name: 'Vietnam' },
  { code: 'MY', name: 'Malaisie' },
  { code: 'PH', name: 'Philippines' },
  { code: 'KR', name: 'Corée du Sud' },
  { code: 'TW', name: 'Taïwan' },
  { code: 'PK', name: 'Pakistan' },
  { code: 'BD', name: 'Bangladesh' },
  { code: 'LK', name: 'Sri Lanka' },
  { code: 'NP', name: 'Népal' },
  { code: 'MM', name: 'Myanmar' },
  { code: 'KH', name: 'Cambodge' },
  { code: 'LA', name: 'Laos' },
  { code: 'SG', name: 'Singapour' },
  { code: 'MN', name: 'Mongolie' },
  { code: 'KZ', name: 'Kazakhstan' },
  { code: 'UZ', name: 'Ouzbékistan' },
  { code: 'AZ', name: 'Azerbaïdjan' },
  { code: 'GE', name: 'Géorgie' },
  { code: 'AM', name: 'Arménie' },
  { code: 'MD', name: 'Moldavie' },
  { code: 'BY', name: 'Biélorussie' },
  { code: 'LT', name: 'Lituanie' },
  { code: 'LV', name: 'Lettonie' },
  { code: 'EE', name: 'Estonie' },
  { code: 'SI', name: 'Slovénie' },
  { code: 'SK', name: 'Slovaquie' },
  { code: 'MK', name: 'Macédoine du Nord' },
  { code: 'AL', name: 'Albanie' },
  { code: 'ME', name: 'Monténégro' },
  { code: 'BA', name: 'Bosnie-Herzégovine' },
  { code: 'RS', name: 'Serbie' },
  { code: 'XK', name: 'Kosovo' },
  { code: 'CY', name: 'Chypre' },
  { code: 'MT', name: 'Malte' },
  { code: 'LU', name: 'Luxembourg' },
  { code: 'LI', name: 'Liechtenstein' },
  { code: 'MC', name: 'Monaco' },
  { code: 'AD', name: 'Andorre' },
  { code: 'SM', name: 'Saint-Marin' },
  { code: 'VA', name: 'Vatican' },
  { code: 'IL', name: 'Israël' },
  { code: 'LB', name: 'Liban' },
  { code: 'JO', name: 'Jordanie' },
  { code: 'SY', name: 'Syrie' },
  { code: 'IQ', name: 'Irak' },
  { code: 'IR', name: 'Iran' },
  { code: 'AF', name: 'Afghanistan' },
  { code: 'PK', name: 'Pakistan' },
  { code: 'IN', name: 'Inde' },
  { code: 'NP', name: 'Népal' },
  { code: 'BT', name: 'Bhoutan' },
  { code: 'BD', name: 'Bangladesh' },
  { code: 'MV', name: 'Maldives' },
  { code: 'LK', name: 'Sri Lanka' },
  { code: 'MM', name: 'Myanmar' },
  { code: 'TH', name: 'Thaïlande' },
  { code: 'LA', name: 'Laos' },
  { code: 'KH', name: 'Cambodge' },
  { code: 'VN', name: 'Vietnam' },
  { code: 'MY', name: 'Malaisie' },
  { code: 'SG', name: 'Singapour' },
  { code: 'ID', name: 'Indonésie' },
  { code: 'PH', name: 'Philippines' },
  { code: 'BN', name: 'Brunei' },
  { code: 'TL', name: 'Timor-Leste' },
  { code: 'PG', name: 'Papouasie-Nouvelle-Guinée' },
  { code: 'FJ', name: 'Fidji' },
  { code: 'SB', name: 'Îles Salomon' },
  { code: 'VU', name: 'Vanuatu' },
  { code: 'NC', name: 'Nouvelle-Calédonie' },
  { code: 'PF', name: 'Polynésie française' },
  { code: 'WS', name: 'Samoa' },
  { code: 'TO', name: 'Tonga' },
  { code: 'KI', name: 'Kiribati' },
  { code: 'TV', name: 'Tuvalu' },
  { code: 'NR', name: 'Nauru' },
  { code: 'PW', name: 'Palaos' },
  { code: 'FM', name: 'Micronésie' },
  { code: 'MH', name: 'Îles Marshall' },
  { code: 'CK', name: 'Îles Cook' },
  { code: 'NU', name: 'Niue' },
  { code: 'TK', name: 'Tokelau' },
  { code: 'AS', name: 'Samoa américaines' },
  { code: 'WF', name: 'Wallis-et-Futuna' },
  { code: 'GF', name: 'Guyane française' },
  { code: 'GP', name: 'Guadeloupe' },
  { code: 'MQ', name: 'Martinique' },
  { code: 'RE', name: 'La Réunion' },
  { code: 'YT', name: 'Mayotte' },
  { code: 'PM', name: 'Saint-Pierre-et-Miquelon' },
  { code: 'BL', name: 'Saint-Barthélemy' },
  { code: 'MF', name: 'Saint-Martin' },
  { code: 'SX', name: 'Saint-Martin (partie néerlandaise)' },
  { code: 'AW', name: 'Aruba' },
  { code: 'CW', name: 'Curaçao' },
  { code: 'BQ', name: 'Bonaire' },
  { code: 'AI', name: 'Anguilla' },
  { code: 'BM', name: 'Bermudes' },
  { code: 'KY', name: 'Îles Caïmans' },
  { code: 'TC', name: 'Îles Turques-et-Caïques' },
  { code: 'VG', name: 'Îles Vierges britanniques' },
  { code: 'VI', name: 'Îles Vierges des États-Unis' },
  { code: 'PR', name: 'Porto Rico' },
  { code: 'DO', name: 'République dominicaine' },
  { code: 'HT', name: 'Haïti' },
  { code: 'JM', name: 'Jamaïque' },
  { code: 'CU', name: 'Cuba' },
  { code: 'BS', name: 'Bahamas' },
  { code: 'BZ', name: 'Belize' },
  { code: 'GT', name: 'Guatemala' },
  { code: 'HN', name: 'Honduras' },
  { code: 'SV', name: 'Salvador' },
  { code: 'NI', name: 'Nicaragua' },
  { code: 'CR', name: 'Costa Rica' },
  { code: 'PA', name: 'Panama' },
  { code: 'GY', name: 'Guyana' },
  { code: 'SR', name: 'Suriname' },
  { code: 'GF', name: 'Guyane française' },
  { code: 'VE', name: 'Venezuela' },
  { code: 'BO', name: 'Bolivie' },
  { code: 'PY', name: 'Paraguay' },
  { code: 'UY', name: 'Uruguay' },
  { code: 'EC', name: 'Équateur' },
  { code: 'GY', name: 'Guyana' },
  { code: 'SR', name: 'Suriname' },
  { code: 'FK', name: 'Îles Falkland' },
  { code: 'GS', name: 'Géorgie du Sud-et-les Îles Sandwich du Sud' },
  { code: 'SH', name: 'Sainte-Hélène' },
  { code: 'AC', name: "Île de l'Ascension" },
  { code: 'TA', name: 'Tristan da Cunha' },
  { code: 'IO', name: "Territoire britannique de l'océan Indien" },
  { code: 'CC', name: 'Îles Cocos' },
  { code: 'CX', name: 'Île Christmas' },
  { code: 'NF', name: 'Île Norfolk' },
  { code: 'PN', name: 'Pitcairn' },
  { code: 'GI', name: 'Gibraltar' },
  { code: 'FO', name: 'Îles Féroé' },
  { code: 'AX', name: 'Åland' },
  { code: 'SJ', name: 'Svalbard et Jan Mayen' },
  { code: 'BV', name: 'Île Bouvet' },
  { code: 'HM', name: 'Îles Heard-et-MacDonald' },
  { code: 'UM', name: 'Îles mineures éloignées des États-Unis' },
  { code: 'AN', name: 'Antilles néerlandaises' },
  { code: 'CD', name: 'Congo (RDC)' },
  { code: 'CG', name: 'Congo' },
  { code: 'GA', name: 'Gabon' },
  { code: 'GQ', name: 'Guinée équatoriale' },
  { code: 'ST', name: 'Sao Tomé-et-Principe' },
  { code: 'CV', name: 'Cap-Vert' },
  { code: 'GW', name: 'Guinée-Bissau' },
  { code: 'SL', name: 'Sierra Leone' },
  { code: 'LR', name: 'Liberia' },
  { code: 'MR', name: 'Mauritanie' },
  { code: 'NE', name: 'Niger' },
  { code: 'TD', name: 'Tchad' },
  { code: 'CF', name: 'République centrafricaine' },
  { code: 'SO', name: 'Somalie' },
  { code: 'DJ', name: 'Djibouti' },
  { code: 'ER', name: 'Érythrée' },
  { code: 'SS', name: 'Soudan du Sud' },
  { code: 'SD', name: 'Soudan' },
  { code: 'BI', name: 'Burundi' },
  { code: 'KM', name: 'Comores' },
  { code: 'MG', name: 'Madagascar' },
  { code: 'MU', name: 'Maurice' },
  { code: 'SC', name: 'Seychelles' },
  { code: 'LS', name: 'Lesotho' },
  { code: 'SZ', name: 'Eswatini' },
  { code: 'NA', name: 'Namibie' },
  { code: 'BW', name: 'Botswana' },
  { code: 'ZW', name: 'Zimbabwe' },
  { code: 'MZ', name: 'Mozambique' },
  { code: 'ZM', name: 'Zambie' },
  { code: 'MW', name: 'Malawi' },
  { code: 'AO', name: 'Angola' },
  { code: 'GM', name: 'Gambie' },
  { code: 'GN', name: 'Guinée' },
  { code: 'GH', name: 'Ghana' },
];

// Trier par nom
COUNTRIES.sort((a, b) => a.name.localeCompare(b.name, 'fr'));

export interface LocationResult {
  city: string;
  country: string;
  countryCode: string;
  latitude: number;
  longitude: number;
  fullAddress?: string;
}

interface LocationSelectorProps {
  initialCity?: string;
  initialCountry?: string;
  onSelect: (location: LocationResult) => void;
  onClear?: () => void;
  style?: ViewStyle;
  includeLocationButton?: boolean;
}

const MAPBOX_TOKEN = process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN;

// Check if Mapbox token is configured
const isMapboxConfigured = !!MAPBOX_TOKEN && MAPBOX_TOKEN !== 'undefined' && !MAPBOX_TOKEN.includes('votre_token');

export function LocationSelector({
  initialCity = '',
  initialCountry = '',
  onSelect,
  onClear,
  style,
  includeLocationButton = true,
}: LocationSelectorProps) {
  // Step 1: Country selection
  const [countryQuery, setCountryQuery] = useState(initialCountry);
  const [showCountryList, setShowCountryList] = useState(false);
  const [selectedCountry, setSelectedCountry] = useState<{ code: string; name: string } | null>(
    initialCountry ? COUNTRIES.find(c => c.name === initialCountry || c.code === initialCountry) || null : null
  );

  // Step 2: City selection
  const [cityQuery, setCityQuery] = useState(initialCity);
  const [cityResults, setCityResults] = useState<Array<{
    id: string;
    name: string;
    region?: string;
    latitude: number;
    longitude: number;
  }>>([]);
  const [showCityResults, setShowCityResults] = useState(false);
  const [loadingCities, setLoadingCities] = useState(false);
  const [gettingLocation, setGettingLocation] = useState(false);

  const debouncedCityQuery = useDebounce(cityQuery, 300);
  const countryInputRef = useRef<TextInput>(null);
  const cityInputRef = useRef<TextInput>(null);

  // Filter countries based on query
  const filteredCountries = useCallback(() => {
    const q = countryQuery.toLowerCase().trim();
    if (!q) return COUNTRIES; // Show all countries by default
    return COUNTRIES.filter(c => 
      c.name.toLowerCase().includes(q) || 
      c.code.toLowerCase().includes(q)
    );
  }, [countryQuery]);

  // Search cities with Mapbox
  const searchCities = useCallback(async (query: string, countryCode?: string) => {
    if (!query.trim() || query.length < 2) {
      setCityResults([]);
      return;
    }

    setLoadingCities(true);
    try {
      // Build filter for country if selected
      // Use 10 results instead of 5, and add autocomplete=true for better matching
      let url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${MAPBOX_TOKEN}&types=place&language=fr&limit=10&autocomplete=true`;
      
      if (countryCode) {
        url += `&country=${countryCode.toLowerCase()}`;
      }

      const response = await fetch(url);
      const data = await response.json();

      if (data.features) {
        const cities = data.features.map((f: any) => ({
          id: f.id,
          name: f.text,
          region: f.context?.find((c: any) => c.id.startsWith('region.'))?.text,
          latitude: f.center[1],
          longitude: f.center[0],
        }));
        setCityResults(cities);
        setShowCityResults(true);
      }
    } catch (error) {
      console.warn('City search failed:', error);
    } finally {
      setLoadingCities(false);
    }
  }, [MAPBOX_TOKEN]);

  // Effect to search cities when query changes
  useEffect(() => {
    if (debouncedCityQuery && debouncedCityQuery.length >= 2 && selectedCountry) {
      searchCities(debouncedCityQuery, selectedCountry.code);
    } else if (debouncedCityQuery && debouncedCityQuery.length >= 2) {
      searchCities(debouncedCityQuery);
    } else {
      setCityResults([]);
      setShowCityResults(false);
    }
  }, [debouncedCityQuery, selectedCountry, searchCities]);

  // Handle country selection
  const handleSelectCountry = (country: { code: string; name: string }) => {
    setSelectedCountry(country);
    setCountryQuery(country.name);
    setShowCountryList(false);
    // Clear city when country changes
    setCityQuery('');
    setCityResults([]);
    // Focus city input
    setTimeout(() => cityInputRef.current?.focus(), 100);
  };

  // Handle city selection
  const handleSelectCity = (city: typeof cityResults[0]) => {
    const countryName = selectedCountry?.name || '';
    const countryCode = selectedCountry?.code || '';
    
    setCityQuery(city.name);
    setShowCityResults(false);
    
    onSelect({
      city: city.name,
      country: countryName,
      countryCode: countryCode,
      latitude: city.latitude,
      longitude: city.longitude,
      fullAddress: `${city.name}${city.region ? ', ' + city.region : ''}${countryName ? ', ' + countryName : ''}`,
    });
  };

  // Handle clear
  const handleClear = () => {
    setSelectedCountry(null);
    setCountryQuery('');
    setCityQuery('');
    setCityResults([]);
    setShowCountryList(false);
    setShowCityResults(false);
    onClear?.();
  };

  // Get current location
  const handleGetCurrentLocation = async () => {
    setGettingLocation(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission requise', 'Autorisez l\'accès à la localisation pour détecter votre ville automatiquement.');
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      // Reverse geocoding
      const { latitude, longitude } = location.coords;
      const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${longitude},${latitude}.json?access_token=${MAPBOX_TOKEN}&types=place,country&language=fr&limit=1`;

      const response = await fetch(url);
      const data = await response.json();

      if (data.features && data.features.length > 0) {
        const placeFeature = data.features.find((f: any) => f.place_type?.includes('place')) || data.features[0];
        const countryFeature = data.features.find((f: any) => f.place_type?.includes('country'));
        
        const cityName = placeFeature.text;
        const countryName = countryFeature?.text || '';
        const countryCode = countryFeature?.properties?.short_code?.toUpperCase() || '';

        // Find country in our list
        const country = COUNTRIES.find(c => c.code === countryCode) || { code: countryCode, name: countryName };
        
        setSelectedCountry(country);
        setCountryQuery(country.name);
        setCityQuery(cityName);
        
        onSelect({
          city: cityName,
          country: country.name,
          countryCode: country.code,
          latitude,
          longitude,
          fullAddress: placeFeature.place_name,
        });

        Alert.alert('Localisation', `${cityName}, ${country.name}`);
      }
    } catch (error) {
      console.error('Geolocation error:', error);
      Alert.alert('Erreur', 'Impossible de détecter votre position. Veuillez saisir manuellement.');
    } finally {
      setGettingLocation(false);
    }
  };

  return (
    <View style={[styles.container, style]}>
      {/* Country Selection */}
      <View style={styles.countrySection}>
        <Text style={styles.label}>Pays *</Text>
        <View style={styles.inputWrapper}>
          <TextInput
            ref={countryInputRef}
            style={styles.input}
            placeholder="Rechercher un pays..."
            placeholderTextColor={Colors.text.muted}
            value={countryQuery}
            onChangeText={(text) => {
              setCountryQuery(text);
              setShowCountryList(true);
              if (selectedCountry && text !== selectedCountry.name) {
                setSelectedCountry(null);
              }
            }}
            onFocus={() => setShowCountryList(true)}
            autoCapitalize="none"
          />
          {countryQuery ? (
            <TouchableOpacity onPress={handleClear} style={styles.clearButton}>
              <X size={18} color={Colors.text.muted} />
            </TouchableOpacity>
          ) : includeLocationButton ? (
            <TouchableOpacity 
              onPress={handleGetCurrentLocation} 
              style={styles.locationButton}
              disabled={gettingLocation}
            >
              {gettingLocation ? (
                <ActivityIndicator size="small" color={Colors.primary.orange} />
              ) : (
                <Navigation size={18} color={Colors.primary.orange} />
              )}
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Country List */}
        {showCountryList && (
          <View style={styles.listContainer}>
            <FlatList
              data={filteredCountries()}
              keyExtractor={(item) => item.code}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.listItem,
                    selectedCountry?.code === item.code && styles.listItemSelected
                  ]}
                  onPress={() => handleSelectCountry(item)}
                >
                  <Text style={[
                    styles.listItemText,
                    selectedCountry?.code === item.code && styles.listItemTextSelected
                  ]}>
                    {item.name}
                  </Text>
                  {selectedCountry?.code === item.code && (
                    <ChevronRight size={16} color={Colors.primary.orange} />
                  )}
                </TouchableOpacity>
              )}
              style={styles.countryList}
              keyboardShouldPersistTaps="handled"
            />
          </View>
        )}
      </View>

      {/* City Selection */}
      <View style={styles.citySection}>
        <Text style={styles.label}>Ville *</Text>
        {!isMapboxConfigured && (
          <Text style={styles.warningText}>
            ⚠️ Configuration requise : Ajoutez EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN dans votre fichier .env
          </Text>
        )}
        <View style={styles.inputWrapper}>
          <MapPin size={18} color={Colors.text.muted} style={styles.inputIcon} />
          <TextInput
            ref={cityInputRef}
            style={[styles.input, styles.inputWithIcon]}
            placeholder={selectedCountry ? "Ex: Abidjan" : "D'abord choisissez un pays..."}
            placeholderTextColor={Colors.text.muted}
            value={cityQuery}
            onChangeText={(text) => {
              setCityQuery(text);
              if (!selectedCountry) {
                // If no country selected, show hint
                setShowCountryList(true);
              }
            }}
            onFocus={() => {
              if (cityResults.length > 0) setShowCityResults(true);
            }}
            autoCapitalize="words"
            editable={!!selectedCountry}
          />
          {loadingCities && (
            <ActivityIndicator size="small" color={Colors.primary.orange} style={styles.loader} />
          )}
        </View>

        {/* City Results */}
        {cityResults.length > 0 && (
          <View style={styles.listContainer}>
            <FlatList
              data={cityResults}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.listItem}
                  onPress={() => handleSelectCity(item)}
                >
                  <View>
                    <Text style={styles.cityName}>{item.name}</Text>
                    {item.region && (
                      <Text style={styles.cityRegion}>{item.region}</Text>
                    )}
                  </View>
                </TouchableOpacity>
              )}
              style={styles.cityList}
              keyboardShouldPersistTaps="handled"
            />
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 16,
  },
  countrySection: {
    zIndex: 20,
  },
  citySection: {
    zIndex: 10,
  },
  label: {
    color: Colors.text.primary,
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border.light,
    paddingHorizontal: 12,
    minHeight: 48,
  },
  input: {
    flex: 1,
    color: Colors.text.primary,
    fontSize: 15,
    paddingVertical: 12,
  },
  inputWithIcon: {
    paddingLeft: 8,
  },
  inputIcon: {
    marginLeft: 4,
  },
  clearButton: {
    padding: 8,
  },
  locationButton: {
    padding: 8,
  },
  loader: {
    marginLeft: 8,
  },
  listContainer: {
    backgroundColor: Colors.background.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border.light,
    marginTop: 4,
    maxHeight: 200,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  countryList: {
    maxHeight: 280,
  },
  cityList: {
    maxHeight: 200,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.light + '40',
  },
  listItemSelected: {
    backgroundColor: Colors.primary.orange + '10',
  },
  listItemText: {
    color: Colors.text.primary,
    fontSize: 14,
  },
  listItemTextSelected: {
    color: Colors.primary.orange,
    fontWeight: '600',
  },
  cityName: {
    color: Colors.text.primary,
    fontSize: 14,
    fontWeight: '500',
  },
  cityRegion: {
    color: Colors.text.muted,
    fontSize: 12,
    marginTop: 2,
  },
  warningText: {
    color: Colors.status.warning || '#FF9800',
    fontSize: 12,
    marginBottom: 8,
    fontStyle: 'italic',
  },
});
