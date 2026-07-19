import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type AlertButton,
  type AlertOptions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { CheckCircle, AlertTriangle, XCircle, Info } from 'lucide-react-native';

import { Colors } from '@/constants/colors';

type AlertPayload = {
  title: string;
  message?: string;
  buttons?: AlertButton[];
  options?: AlertOptions;
};

const DEFAULT_BUTTON: AlertButton = { text: 'OK' };
type AlertListener = (payload: AlertPayload) => void;

const alertListeners = new Set<AlertListener>();
let isAlertPatched = false;

function emitAlert(payload: AlertPayload) {
  for (const listener of alertListeners) {
    listener(payload);
  }
}

function patchAlertOnce() {
  if (isAlertPatched) return;

  const patchedAlert: typeof Alert.alert = (title, message, buttons, options) => {
    emitAlert({ title, message, buttons, options });
  };

  try {
    Object.defineProperty(Alert, 'alert', {
      value: patchedAlert,
      writable: true,
      configurable: true,
    });
  } catch {
    try {
      (Alert as any).alert = patchedAlert;
    } catch {
      // Ignore: fallback is native Alert if environment forbids patching.
    }
  }

  isAlertPatched = Alert.alert === patchedAlert;
}

patchAlertOnce();

export function AppAlertProvider({ children }: { children: React.ReactNode }) {
  const [activeAlert, setActiveAlert] = useState<AlertPayload | null>(null);
  const activeAlertRef = useRef<AlertPayload | null>(null);
  const queueRef = useRef<AlertPayload[]>([]);

  const closeAlert = useCallback(() => {
    activeAlertRef.current = null;
    setActiveAlert(null);
    const next = queueRef.current.shift();
    if (next) {
      setTimeout(() => {
        activeAlertRef.current = next;
        setActiveAlert(next);
      }, 10);
    }
  }, []);

  useEffect(() => {
    activeAlertRef.current = activeAlert;
  }, [activeAlert]);

  useEffect(() => {
    const listener: AlertListener = (payload) => {
      if (!activeAlertRef.current) {
        activeAlertRef.current = payload;
        setActiveAlert(payload);
        return;
      }
      queueRef.current.push(payload);
    };

    alertListeners.add(listener);

    return () => {
      alertListeners.delete(listener);
    };
  }, []);

  const buttons = useMemo(() => {
    if (!activeAlert) return [];
    return (activeAlert.buttons && activeAlert.buttons.length > 0)
      ? activeAlert.buttons
      : [DEFAULT_BUTTON];
  }, [activeAlert]);

  const handleBackdropPress = useCallback(() => {
    if (!activeAlert?.options?.cancelable) return;
    activeAlert.options?.onDismiss?.();
    closeAlert();
  }, [activeAlert, closeAlert]);

  const handleButtonPress = useCallback((button?: AlertButton) => {
    closeAlert();
    button?.onPress?.();
  }, [closeAlert]);

  const hasDestructive = buttons.some(b => b.style === 'destructive');
  const alertIcon = hasDestructive ? AlertTriangle : Info;
  const alertColor = hasDestructive ? Colors.status.warning : Colors.primary.orange;
  const isTwoButtons = buttons.length === 2;

  return (
    <>
      {children}
      <Modal
        visible={!!activeAlert}
        transparent
        animationType="fade"
        onRequestClose={handleBackdropPress}
      >
        <View style={styles.overlay}>
          <Pressable style={styles.overlayTouchable} onPress={handleBackdropPress} />
          <View style={styles.card}>
            <LinearGradient
              colors={[Colors.background.elevated, Colors.background.card]}
              style={styles.cardGradient}
            >
              {/* Icon circle */}
              <View style={styles.iconWrap}>
                <View style={[styles.iconCircle, { backgroundColor: alertColor + '18' }]}>
                  {React.createElement(alertIcon, { size: 24, color: alertColor })}
                </View>
              </View>

              <View style={styles.cardContent}>
                {!!activeAlert?.title && <Text style={styles.title}>{activeAlert.title}</Text>}
                {!!activeAlert?.message && <Text style={styles.message}>{activeAlert.message}</Text>}

                <View style={[styles.buttonsContainer, isTwoButtons && styles.buttonsRow]}>
                  {buttons.map((button, idx) => {
                    const style = button.style;
                    const isDestructive = style === 'destructive';
                    const isCancel = style === 'cancel';

                    if (isCancel) {
                      return (
                        <TouchableOpacity
                          key={`${button.text || 'button'}-${idx}`}
                          activeOpacity={0.7}
                          style={[styles.buttonCancel, isTwoButtons && styles.buttonHalf]}
                          onPress={() => handleButtonPress(button)}
                        >
                          <Text style={styles.buttonTextCancel}>{button.text || 'Annuler'}</Text>
                        </TouchableOpacity>
                      );
                    }

                    if (isDestructive) {
                      return (
                        <TouchableOpacity
                          key={`${button.text || 'button'}-${idx}`}
                          activeOpacity={0.85}
                          style={[styles.buttonDestructive, isTwoButtons && styles.buttonHalf]}
                          onPress={() => handleButtonPress(button)}
                        >
                          <LinearGradient
                            colors={[Colors.status.error, '#DC2626']}
                            style={styles.buttonGradient}
                          >
                            <Text style={styles.buttonTextDestructive}>{button.text || 'OK'}</Text>
                          </LinearGradient>
                        </TouchableOpacity>
                      );
                    }

                    return (
                      <TouchableOpacity
                        key={`${button.text || 'button'}-${idx}`}
                        activeOpacity={0.85}
                        style={[styles.buttonPrimary, isTwoButtons && styles.buttonHalf]}
                        onPress={() => handleButtonPress(button)}
                      >
                        <LinearGradient
                          colors={[Colors.primary.orange, Colors.primary.orangeDark]}
                          style={styles.buttonGradient}
                        >
                          <Text style={styles.buttonText}>{button.text || 'OK'}</Text>
                        </LinearGradient>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            </LinearGradient>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(2, 6, 23, 0.78)',
    paddingHorizontal: 28,
  },
  overlayTouchable: {
    ...StyleSheet.absoluteFillObject,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border.light,
  },
  cardGradient: {
    width: '100%',
    paddingBottom: 4,
  },
  iconWrap: {
    alignItems: 'center',
    paddingTop: 24,
    paddingBottom: 4,
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardContent: {
    paddingHorizontal: 24,
    paddingBottom: 24,
    paddingTop: 12,
    alignItems: 'center',
  },
  title: {
    color: Colors.text.primary,
    fontSize: 18,
    fontWeight: '700' as const,
    lineHeight: 24,
    textAlign: 'center',
    marginBottom: 6,
  },
  message: {
    color: Colors.text.secondary,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 4,
  },
  buttonsContainer: {
    gap: 10,
    marginTop: 20,
    width: '100%',
  },
  buttonsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  buttonHalf: {
    flex: 1,
  },
  buttonPrimary: {
    borderRadius: 14,
    overflow: 'hidden',
  },
  buttonCancel: {
    minHeight: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: Colors.border.light,
  },
  buttonDestructive: {
    borderRadius: 14,
    overflow: 'hidden',
  },
  buttonGradient: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700' as const,
  },
  buttonTextCancel: {
    color: Colors.text.secondary,
    fontSize: 15,
    fontWeight: '600' as const,
  },
  buttonTextDestructive: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700' as const,
  },
});
