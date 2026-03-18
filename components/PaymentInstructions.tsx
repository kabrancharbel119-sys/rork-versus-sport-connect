import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Clipboard, Alert } from 'react-native';
import { Copy, Info } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { Card } from '@/components/Card';
import { PAYMENT_CONFIG } from '@/lib/api/tournament-payments';
import type { PaymentMethod } from '@/types';

interface PaymentInstructionsProps {
  amount: number;
  tournamentName: string;
  teamName: string;
  onMethodSelect?: (method: PaymentMethod) => void;
}

export function PaymentInstructions({ amount, tournamentName, teamName, onMethodSelect }: PaymentInstructionsProps) {
  const copyToClipboard = (text: string, label: string) => {
    Clipboard.setString(text);
    Alert.alert('Copié !', `${label} copié dans le presse-papier`);
  };

  const reference = `${teamName} - ${tournamentName}`;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Info size={20} color={Colors.primary.orange} />
        <Text style={styles.headerText}>Instructions de paiement</Text>
      </View>

      <Card style={styles.amountCard}>
        <Text style={styles.amountLabel}>Montant à payer</Text>
        <Text style={styles.amountValue}>{amount.toLocaleString()} FCFA</Text>
      </Card>

      <Text style={styles.sectionTitle}>Choisissez votre méthode de paiement :</Text>

      {/* Wave */}
      <TouchableOpacity
        style={styles.methodCard}
        onPress={() => onMethodSelect?.('wave')}
        activeOpacity={0.7}
      >
        <View style={styles.methodHeader}>
          <View style={[styles.methodBadge, { backgroundColor: Colors.primary.orange + '20' }]}>
            <Text style={[styles.methodBadgeText, { color: Colors.primary.orange }]}>WAVE</Text>
          </View>
        </View>
        <View style={styles.methodRow}>
          <Text style={styles.methodLabel}>Numéro :</Text>
          <View style={styles.methodValueContainer}>
            <Text style={styles.methodValue}>{PAYMENT_CONFIG.wave.number}</Text>
            <TouchableOpacity
              onPress={() => copyToClipboard(PAYMENT_CONFIG.wave.number, 'Numéro Wave')}
              style={styles.copyButton}
            >
              <Copy size={16} color={Colors.primary.orange} />
            </TouchableOpacity>
          </View>
        </View>
        <View style={styles.methodRow}>
          <Text style={styles.methodLabel}>Nom :</Text>
          <Text style={styles.methodValue}>{PAYMENT_CONFIG.wave.name}</Text>
        </View>
      </TouchableOpacity>

      {/* Orange Money */}
      <TouchableOpacity
        style={styles.methodCard}
        onPress={() => onMethodSelect?.('orange')}
        activeOpacity={0.7}
      >
        <View style={styles.methodHeader}>
          <View style={[styles.methodBadge, { backgroundColor: '#FF6600' + '20' }]}>
            <Text style={[styles.methodBadgeText, { color: '#FF6600' }]}>ORANGE MONEY</Text>
          </View>
        </View>
        <View style={styles.methodRow}>
          <Text style={styles.methodLabel}>Numéro :</Text>
          <View style={styles.methodValueContainer}>
            <Text style={styles.methodValue}>{PAYMENT_CONFIG.orange.number}</Text>
            <TouchableOpacity
              onPress={() => copyToClipboard(PAYMENT_CONFIG.orange.number, 'Numéro Orange')}
              style={styles.copyButton}
            >
              <Copy size={16} color="#FF6600" />
            </TouchableOpacity>
          </View>
        </View>
        <View style={styles.methodRow}>
          <Text style={styles.methodLabel}>Nom :</Text>
          <Text style={styles.methodValue}>{PAYMENT_CONFIG.orange.name}</Text>
        </View>
      </TouchableOpacity>

      <Card style={styles.referenceCard}>
        <Text style={styles.referenceLabel}>Référence à indiquer :</Text>
        <View style={styles.referenceValueContainer}>
          <Text style={styles.referenceValue}>{reference}</Text>
          <TouchableOpacity
            onPress={() => copyToClipboard(reference, 'Référence')}
            style={styles.copyButton}
          >
            <Copy size={16} color={Colors.primary.orange} />
          </TouchableOpacity>
        </View>
      </Card>

      <View style={styles.warningBox}>
        <Info size={16} color={Colors.status.warning} />
        <Text style={styles.warningText}>
          Après avoir effectué le paiement, vous devrez soumettre une preuve (capture d'écran ou numéro de transaction) dans les {PAYMENT_CONFIG.paymentDeadlineHours} heures.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  headerText: {
    color: Colors.text.primary,
    fontSize: 18,
    fontWeight: '700',
  },
  amountCard: {
    alignItems: 'center',
    padding: 20,
    backgroundColor: Colors.primary.orange + '10',
    borderColor: Colors.primary.orange + '30',
  },
  amountLabel: {
    color: Colors.text.muted,
    fontSize: 13,
    marginBottom: 4,
  },
  amountValue: {
    color: Colors.primary.orange,
    fontSize: 32,
    fontWeight: '800',
  },
  sectionTitle: {
    color: Colors.text.primary,
    fontSize: 15,
    fontWeight: '600',
    marginTop: 8,
  },
  methodCard: {
    backgroundColor: Colors.background.card,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border.light,
    gap: 12,
  },
  methodHeader: {
    marginBottom: 4,
  },
  methodBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  methodBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  methodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  methodLabel: {
    color: Colors.text.muted,
    fontSize: 13,
    fontWeight: '600',
  },
  methodValueContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  methodValue: {
    color: Colors.text.primary,
    fontSize: 15,
    fontWeight: '700',
  },
  copyButton: {
    padding: 4,
  },
  referenceCard: {
    padding: 16,
    backgroundColor: Colors.background.cardLight,
  },
  referenceLabel: {
    color: Colors.text.muted,
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
  },
  referenceValueContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  referenceValue: {
    color: Colors.text.primary,
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: Colors.status.warning + '15',
    borderWidth: 1,
    borderColor: Colors.status.warning + '30',
    borderRadius: 10,
    padding: 12,
  },
  warningText: {
    color: Colors.text.secondary,
    fontSize: 12,
    flex: 1,
    lineHeight: 17,
  },
});
