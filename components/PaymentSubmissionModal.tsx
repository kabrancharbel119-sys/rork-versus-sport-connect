import React, { useState } from 'react';
import { StyleSheet, View, Text, TextInput, TouchableOpacity, Modal, ScrollView, Alert, ActivityIndicator, Image } from 'react-native';
import { X, Upload, FileText, User, CheckCircle } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { Colors } from '@/constants/colors';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { tournamentPaymentsApi } from '@/lib/api/tournament-payments';
import { supabase } from '@/lib/supabase';
import type { PaymentMethod } from '@/types';

interface PaymentSubmissionModalProps {
  visible: boolean;
  onClose: () => void;
  tournamentId: string;
  teamId: string;
  amount: number;
  method: PaymentMethod;
  onSuccess: () => void;
}

export function PaymentSubmissionModal({
  visible,
  onClose,
  tournamentId,
  teamId,
  amount,
  method,
  onSuccess,
}: PaymentSubmissionModalProps) {
  const [screenshotUri, setScreenshotUri] = useState<string | null>(null);
  const [transactionRef, setTransactionRef] = useState('');
  const [senderName, setSenderName] = useState('');
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission requise', 'Nous avons besoin de votre permission pour accéder à vos photos.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setScreenshotUri(result.assets[0].uri);
    }
  };

  const uploadScreenshot = async (uri: string): Promise<string> => {
    try {
      const response = await fetch(uri);
      const blob = await response.blob();
      const fileExt = uri.split('.').pop() || 'jpg';
      const fileName = `payment-${tournamentId}-${teamId}-${Date.now()}.${fileExt}`;
      const filePath = `tournament-payments/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('public')
        .upload(filePath, blob, {
          contentType: `image/${fileExt}`,
          upsert: false,
        });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('public')
        .getPublicUrl(filePath);

      return publicUrl;
    } catch (error) {
      console.error('Upload error:', error);
      throw new Error('Échec de l\'upload de l\'image');
    }
  };

  const handleSubmit = async () => {
    // Validation
    if (!senderName.trim()) {
      Alert.alert('Erreur', 'Veuillez entrer le nom de l\'expéditeur');
      return;
    }

    if (!screenshotUri && !transactionRef.trim()) {
      Alert.alert('Erreur', 'Veuillez fournir une capture d\'écran OU une référence de transaction');
      return;
    }

    setSubmitting(true);

    try {
      let screenshotUrl: string | undefined;

      // Upload screenshot si fourni
      if (screenshotUri) {
        setUploading(true);
        screenshotUrl = await uploadScreenshot(screenshotUri);
        setUploading(false);
      }

      // Soumettre le paiement
      await tournamentPaymentsApi.submitPayment({
        tournamentId,
        teamId,
        amount,
        method,
        screenshotUrl,
        transactionRef: transactionRef.trim() || undefined,
        expectedSenderName: senderName.trim(),
      });

      Alert.alert(
        'Paiement soumis !',
        'Votre paiement a été soumis avec succès. Il sera validé par un administrateur dans les prochaines heures.',
        [{ text: 'OK', onPress: () => {
          onSuccess();
          onClose();
        }}]
      );
    } catch (error) {
      console.error('Submit payment error:', error);
      Alert.alert('Erreur', (error as Error).message || 'Impossible de soumettre le paiement');
    } finally {
      setSubmitting(false);
      setUploading(false);
    }
  };

  const resetForm = () => {
    setScreenshotUri(null);
    setTransactionRef('');
    setSenderName('');
  };

  const handleClose = () => {
    if (!submitting) {
      resetForm();
      onClose();
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          <View style={styles.header}>
            <Text style={styles.title}>Soumettre la preuve de paiement</Text>
            <TouchableOpacity onPress={handleClose} disabled={submitting}>
              <X size={24} color={Colors.text.primary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            <Card style={styles.amountCard}>
              <Text style={styles.amountLabel}>Montant payé</Text>
              <Text style={styles.amountValue}>{amount.toLocaleString()} FCFA</Text>
              <Text style={styles.methodBadge}>
                {method === 'wave' ? 'WAVE' : 'ORANGE MONEY'}
              </Text>
            </Card>

            {/* Nom de l'expéditeur */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>
                Nom de l'expéditeur <Text style={styles.required}>*</Text>
              </Text>
              <View style={styles.inputContainer}>
                <User size={18} color={Colors.text.muted} />
                <TextInput
                  style={styles.input}
                  placeholder="Nom complet de l'expéditeur"
                  placeholderTextColor={Colors.text.muted}
                  value={senderName}
                  onChangeText={setSenderName}
                  editable={!submitting}
                />
              </View>
            </View>

            {/* Screenshot */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Capture d'écran du paiement</Text>
              <TouchableOpacity
                style={styles.uploadButton}
                onPress={pickImage}
                disabled={submitting || uploading}
              >
                <Upload size={20} color={Colors.primary.orange} />
                <Text style={styles.uploadButtonText}>
                  {screenshotUri ? 'Changer l\'image' : 'Choisir une image'}
                </Text>
              </TouchableOpacity>
              {screenshotUri && (
                <View style={styles.imagePreview}>
                  <Image source={{ uri: screenshotUri }} style={styles.previewImage} />
                  <TouchableOpacity
                    style={styles.removeImageButton}
                    onPress={() => setScreenshotUri(null)}
                    disabled={submitting}
                  >
                    <X size={16} color={Colors.text.primary} />
                  </TouchableOpacity>
                </View>
              )}
            </View>

            {/* OU */}
            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>OU</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Référence de transaction */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Référence de transaction</Text>
              <View style={styles.inputContainer}>
                <FileText size={18} color={Colors.text.muted} />
                <TextInput
                  style={styles.input}
                  placeholder="Ex: TRX123456789"
                  placeholderTextColor={Colors.text.muted}
                  value={transactionRef}
                  onChangeText={setTransactionRef}
                  editable={!submitting}
                />
              </View>
            </View>

            <View style={styles.infoBox}>
              <CheckCircle size={16} color={Colors.status.info} />
              <Text style={styles.infoText}>
                Fournissez au moins une capture d'écran OU une référence de transaction. Vous avez 2 heures pour soumettre cette preuve.
              </Text>
            </View>
          </ScrollView>

          <View style={styles.footer}>
            <Button
              title="Annuler"
              onPress={handleClose}
              variant="outline"
              disabled={submitting}
              style={styles.cancelButton}
            />
            <Button
              title={uploading ? 'Upload...' : submitting ? 'Envoi...' : 'Soumettre'}
              onPress={handleSubmit}
              disabled={submitting || uploading}
              loading={submitting || uploading}
              style={styles.submitButton}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: Colors.background.dark,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
    paddingBottom: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.light,
  },
  title: {
    color: Colors.text.primary,
    fontSize: 18,
    fontWeight: '700',
  },
  content: {
    padding: 20,
  },
  amountCard: {
    alignItems: 'center',
    padding: 20,
    backgroundColor: Colors.primary.orange + '10',
    borderColor: Colors.primary.orange + '30',
    marginBottom: 20,
  },
  amountLabel: {
    color: Colors.text.muted,
    fontSize: 13,
    marginBottom: 4,
  },
  amountValue: {
    color: Colors.primary.orange,
    fontSize: 28,
    fontWeight: '800',
    marginBottom: 8,
  },
  methodBadge: {
    color: Colors.primary.orange,
    fontSize: 12,
    fontWeight: '700',
    paddingHorizontal: 12,
    paddingVertical: 4,
    backgroundColor: Colors.primary.orange + '20',
    borderRadius: 6,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    color: Colors.text.primary,
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  required: {
    color: Colors.status.error,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border.light,
    paddingHorizontal: 16,
    gap: 10,
  },
  input: {
    flex: 1,
    color: Colors.text.primary,
    fontSize: 15,
    paddingVertical: 14,
  },
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: Colors.background.card,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: Colors.primary.orange + '40',
    borderStyle: 'dashed',
    paddingVertical: 16,
  },
  uploadButtonText: {
    color: Colors.primary.orange,
    fontSize: 14,
    fontWeight: '600',
  },
  imagePreview: {
    marginTop: 12,
    position: 'relative',
    borderRadius: 12,
    overflow: 'hidden',
  },
  previewImage: {
    width: '100%',
    height: 200,
    borderRadius: 12,
  },
  removeImageButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: Colors.background.dark + 'CC',
    borderRadius: 20,
    padding: 6,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.border.light,
  },
  dividerText: {
    color: Colors.text.muted,
    fontSize: 12,
    fontWeight: '600',
    marginHorizontal: 12,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: Colors.status.info + '15',
    borderWidth: 1,
    borderColor: Colors.status.info + '30',
    borderRadius: 10,
    padding: 12,
    marginTop: 10,
  },
  infoText: {
    color: Colors.text.secondary,
    fontSize: 12,
    flex: 1,
    lineHeight: 17,
  },
  footer: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.border.light,
  },
  cancelButton: {
    flex: 1,
  },
  submitButton: {
    flex: 2,
  },
});
