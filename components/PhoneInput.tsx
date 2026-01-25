import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  FlatList,
  Pressable,
} from 'react-native';
import { ChevronDown, Search, Check } from 'lucide-react-native';
import { Colors } from '@/constants/colors';

interface Country {
  code: string;
  dialCode: string;
  name: string;
  flag: string;
  placeholder: string;
  format: string; // Pattern with X for digits
  maxLength: number;
}

const COUNTRIES: Country[] = [
  { code: 'CI', dialCode: '+225', name: "Côte d'Ivoire", flag: '🇨🇮', placeholder: '07 00 00 00 00', format: 'XX XX XX XX XX', maxLength: 10 },
  { code: 'CA', dialCode: '+1', name: 'Canada', flag: '🇨🇦', placeholder: '514 123 4567', format: 'XXX XXX XXXX', maxLength: 10 },
  { code: 'SN', dialCode: '+221', name: 'Sénégal', flag: '🇸🇳', placeholder: '77 123 45 67', format: 'XX XXX XX XX', maxLength: 9 },
  { code: 'ML', dialCode: '+223', name: 'Mali', flag: '🇲🇱', placeholder: '70 12 34 56', format: 'XX XX XX XX', maxLength: 8 },
  { code: 'BF', dialCode: '+226', name: 'Burkina Faso', flag: '🇧🇫', placeholder: '70 12 34 56', format: 'XX XX XX XX', maxLength: 8 },
  { code: 'GN', dialCode: '+224', name: 'Guinée', flag: '🇬🇳', placeholder: '620 12 34 56', format: 'XXX XX XX XX', maxLength: 9 },
  { code: 'BJ', dialCode: '+229', name: 'Bénin', flag: '🇧🇯', placeholder: '97 12 34 56', format: 'XX XX XX XX', maxLength: 8 },
  { code: 'TG', dialCode: '+228', name: 'Togo', flag: '🇹🇬', placeholder: '90 12 34 56', format: 'XX XX XX XX', maxLength: 8 },
  { code: 'NE', dialCode: '+227', name: 'Niger', flag: '🇳🇪', placeholder: '90 12 34 56', format: 'XX XX XX XX', maxLength: 8 },
  { code: 'CM', dialCode: '+237', name: 'Cameroun', flag: '🇨🇲', placeholder: '6 70 12 34 56', format: 'X XX XX XX XX', maxLength: 9 },
  { code: 'GA', dialCode: '+241', name: 'Gabon', flag: '🇬🇦', placeholder: '07 12 34 56', format: 'XX XX XX XX', maxLength: 8 },
  { code: 'CG', dialCode: '+242', name: 'Congo', flag: '🇨🇬', placeholder: '06 123 4567', format: 'XX XXX XXXX', maxLength: 9 },
  { code: 'CD', dialCode: '+243', name: 'RD Congo', flag: '🇨🇩', placeholder: '810 123 456', format: 'XXX XXX XXX', maxLength: 9 },
  { code: 'MA', dialCode: '+212', name: 'Maroc', flag: '🇲🇦', placeholder: '6 12 34 56 78', format: 'X XX XX XX XX', maxLength: 9 },
  { code: 'DZ', dialCode: '+213', name: 'Algérie', flag: '🇩🇿', placeholder: '5 12 34 56 78', format: 'X XX XX XX XX', maxLength: 9 },
  { code: 'TN', dialCode: '+216', name: 'Tunisie', flag: '🇹🇳', placeholder: '20 123 456', format: 'XX XXX XXX', maxLength: 8 },
  { code: 'FR', dialCode: '+33', name: 'France', flag: '🇫🇷', placeholder: '6 12 34 56 78', format: 'X XX XX XX XX', maxLength: 9 },
  { code: 'BE', dialCode: '+32', name: 'Belgique', flag: '🇧🇪', placeholder: '470 12 34 56', format: 'XXX XX XX XX', maxLength: 9 },
  { code: 'CH', dialCode: '+41', name: 'Suisse', flag: '🇨🇭', placeholder: '79 123 45 67', format: 'XX XXX XX XX', maxLength: 9 },
  { code: 'US', dialCode: '+1', name: 'États-Unis', flag: '🇺🇸', placeholder: '202 555 0123', format: 'XXX XXX XXXX', maxLength: 10 },
];

const formatPhoneNumber = (digits: string, format: string): string => {
  let result = '';
  let digitIndex = 0;
  
  for (let i = 0; i < format.length && digitIndex < digits.length; i++) {
    if (format[i] === 'X') {
      result += digits[digitIndex];
      digitIndex++;
    } else {
      result += format[i];
    }
  }
  
  return result;
};

interface PhoneInputProps {
  label?: string;
  value: string;
  onChangeText: (fullNumber: string, nationalNumber: string, countryCode: string) => void;
  error?: string;
  defaultCountry?: string;
}

const DEFAULT_COUNTRY: Country = COUNTRIES[0] || {
  code: 'CI',
  dialCode: '+225',
  name: "Côte d'Ivoire",
  flag: '🇨🇮',
  placeholder: '07 00 00 00 00',
  format: 'XX XX XX XX XX',
  maxLength: 10,
};

export function PhoneInput({
  label,
  value,
  onChangeText,
  error,
  defaultCountry = 'CI',
}: PhoneInputProps) {
  const [selectedCountry, setSelectedCountry] = useState<Country>(() => {
    const found = COUNTRIES.find(c => c.code === defaultCountry);
    return found || DEFAULT_COUNTRY;
  });
  const [modalVisible, setModalVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [localNationalNumber, setLocalNationalNumber] = useState('');

  const filteredCountries = COUNTRIES.filter(
    country =>
      country.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      country.dialCode.includes(searchQuery)
  );

  const handlePhoneChange = (text: string) => {
    const maxLen = selectedCountry?.maxLength || 10;
    const cleaned = text.replace(/[^0-9]/g, '').slice(0, maxLen);
    setLocalNationalNumber(cleaned);
    const dialCode = selectedCountry?.dialCode || '+225';
    const fullNumber = dialCode + cleaned;
    console.log('[PhoneInput] handlePhoneChange:', {
      input: text,
      cleaned,
      dialCode: selectedCountry.dialCode,
      fullNumber,
      maxLength: selectedCountry.maxLength,
    });
    onChangeText(fullNumber, cleaned, selectedCountry.dialCode);
  };

  const handleCountrySelect = (country: Country) => {
    console.log('[PhoneInput] Country selected:', {
      country: country.name,
      dialCode: country.dialCode,
      previousCountry: selectedCountry.name,
      previousMaxLength: selectedCountry.maxLength,
      newMaxLength: country.maxLength,
    });
    
    // Clear phone number when changing country (formats are different)
    setLocalNationalNumber('');
    setSelectedCountry(country);
    setModalVisible(false);
    setSearchQuery('');
    
    // Notify parent with empty number for new country
    console.log('[PhoneInput] Cleared number for new country:', country.dialCode);
    onChangeText(country.dialCode, '', country.dialCode);
  };

  const displayNumber = localNationalNumber 
    ? formatPhoneNumber(localNationalNumber, selectedCountry?.format || 'XX XX XX XX XX')
    : '';

  return (
    <View style={styles.container}>
      {label && <Text style={styles.label}>{label}</Text>}
      
      <View style={[
        styles.inputContainer,
        isFocused && styles.inputContainerFocused,
        error && styles.inputContainerError,
      ]}>
        <TouchableOpacity
          style={styles.countrySelector}
          onPress={() => setModalVisible(true)}
          testID="country-selector"
        >
          <Text style={styles.flag}>{selectedCountry.flag}</Text>
          <Text style={styles.dialCode}>{selectedCountry.dialCode}</Text>
          <ChevronDown size={16} color={Colors.text.muted} />
        </TouchableOpacity>

        <View style={styles.separator} />

        <TextInput
          style={styles.input}
          value={displayNumber}
          onChangeText={handlePhoneChange}
          placeholder={selectedCountry.placeholder}
          placeholderTextColor={Colors.text.muted}
          keyboardType="phone-pad"
          textContentType="telephoneNumber"
          autoComplete="tel"
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          maxLength={selectedCountry?.format?.length || 15}
          testID="phone-input"
        />
      </View>

      {error && <Text style={styles.errorText}>{error}</Text>}

      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setModalVisible(false)}
      >
        <Pressable 
          style={styles.modalOverlay}
          onPress={() => setModalVisible(false)}
        >
          <Pressable style={styles.modalContent} onPress={e => e.stopPropagation()}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Sélectionner un pays</Text>
              <TouchableOpacity
                onPress={() => setModalVisible(false)}
                style={styles.closeButton}
              >
                <Text style={styles.closeButtonText}>Fermer</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.searchContainer}>
              <Search size={20} color={Colors.text.muted} />
              <TextInput
                style={styles.searchInput}
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Rechercher un pays..."
                placeholderTextColor={Colors.text.muted}
                autoCapitalize="none"
              />
            </View>

            <FlatList
              data={filteredCountries}
              keyExtractor={item => item.code + item.dialCode}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.countryItem,
                    selectedCountry.code === item.code && styles.countryItemSelected,
                  ]}
                  onPress={() => handleCountrySelect(item)}
                >
                  <Text style={styles.countryFlag}>{item.flag}</Text>
                  <View style={styles.countryInfo}>
                    <Text style={styles.countryName}>{item.name}</Text>
                    <Text style={styles.countryDialCode}>{item.dialCode}</Text>
                  </View>
                  {selectedCountry.code === item.code && (
                    <Check size={20} color={Colors.primary.orange} />
                  )}
                </TouchableOpacity>
              )}
              showsVerticalScrollIndicator={false}
              ItemSeparatorComponent={() => <View style={styles.itemSeparator} />}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  label: {
    color: Colors.text.secondary,
    fontSize: 14,
    fontWeight: '500' as const,
    marginBottom: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background.card,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: Colors.background.cardLight,
    overflow: 'hidden',
  },
  inputContainerFocused: {
    borderColor: Colors.primary.orange,
  },
  inputContainerError: {
    borderColor: Colors.status.error,
  },
  countrySelector: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 14,
    gap: 6,
  },
  flag: {
    fontSize: 20,
  },
  dialCode: {
    color: Colors.text.primary,
    fontSize: 16,
    fontWeight: '500' as const,
  },
  separator: {
    width: 1,
    height: 24,
    backgroundColor: Colors.background.cardLight,
  },
  input: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 14,
    color: Colors.text.primary,
    fontSize: 16,
  },
  errorText: {
    color: Colors.status.error,
    fontSize: 12,
    marginTop: 6,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Colors.background.dark,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '80%',
    paddingBottom: 40,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: Colors.background.cardLight,
  },
  modalTitle: {
    color: Colors.text.primary,
    fontSize: 18,
    fontWeight: '600' as const,
  },
  closeButton: {
    padding: 4,
  },
  closeButtonText: {
    color: Colors.primary.orange,
    fontSize: 16,
    fontWeight: '500' as const,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background.card,
    margin: 16,
    paddingHorizontal: 12,
    borderRadius: 10,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    color: Colors.text.primary,
    fontSize: 16,
  },
  countryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    gap: 12,
  },
  countryItemSelected: {
    backgroundColor: `${Colors.primary.orange}15`,
  },
  countryFlag: {
    fontSize: 28,
  },
  countryInfo: {
    flex: 1,
  },
  countryName: {
    color: Colors.text.primary,
    fontSize: 16,
    fontWeight: '500' as const,
  },
  countryDialCode: {
    color: Colors.text.muted,
    fontSize: 14,
    marginTop: 2,
  },
  itemSeparator: {
    height: 1,
    backgroundColor: Colors.background.cardLight,
    marginHorizontal: 20,
  },
});
