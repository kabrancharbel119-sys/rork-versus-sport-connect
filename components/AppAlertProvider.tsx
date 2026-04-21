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
              colors={['#1A2035', '#0F1623']}
              style={styles.cardGradient}
            >
              {/* Top accent bar based on button type */}
              <View style={[
                styles.accentBar,
                buttons.some(b => b.style === 'destructive') ? styles.accentBarDestructive : styles.accentBarPrimary,
              ]} />

              <View style={styles.cardContent}>
                {!!activeAlert?.title && <Text style={styles.title}>{activeAlert.title}</Text>}
                {!!activeAlert?.message && <Text style={styles.message}>{activeAlert.message}</Text>}

                <View style={styles.buttonsContainer}>
                  {buttons.map((button, idx) => {
                    const style = button.style;
                    const isDestructive = style === 'destructive';
                    const isCancel = style === 'cancel';

                    if (isCancel) {
                      return (
                        <TouchableOpacity
                          key={`${button.text || 'button'}-${idx}`}
                          activeOpacity={0.7}
                          style={styles.buttonCancel}
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
                          style={styles.buttonDestructive}
                          onPress={() => handleButtonPress(button)}
                        >
                          <LinearGradient
                            colors={['#EF4444', '#DC2626']}
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
                        style={styles.buttonPrimary}
                        onPress={() => handleButtonPress(button)}
                      >
                        <LinearGradient
                          colors={[Colors.primary.blue, Colors.primary.blueDark ?? Colors.primary.blue]}
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
    backgroundColor: 'rgba(2, 6, 23, 0.80)',
    paddingHorizontal: 24,
  },
  overlayTouchable: {
    ...StyleSheet.absoluteFillObject,
  },
  card: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  cardGradient: {
    width: '100%',
  },
  accentBar: {
    height: 3,
    width: '100%',
  },
  accentBarDestructive: {
    backgroundColor: Colors.status.error,
  },
  accentBarPrimary: {
    backgroundColor: Colors.primary.blue,
  },
  cardContent: {
    padding: 24,
    gap: 8,
  },
  title: {
    color: Colors.text.primary,
    fontSize: 20,
    fontWeight: '700' as const,
    lineHeight: 26,
    marginBottom: 2,
  },
  message: {
    color: Colors.text.secondary,
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 8,
  },
  buttonsContainer: {
    gap: 10,
    marginTop: 8,
  },
  buttonPrimary: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  buttonCancel: {
    minHeight: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  buttonDestructive: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  buttonGradient: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700' as const,
  },
  buttonTextCancel: {
    color: Colors.text.secondary,
    fontSize: 16,
    fontWeight: '600' as const,
  },
  buttonTextDestructive: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700' as const,
  },
});
