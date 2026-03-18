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
            {!!activeAlert?.title && <Text style={styles.title}>{activeAlert.title}</Text>}
            {!!activeAlert?.message && <Text style={styles.message}>{activeAlert.message}</Text>}

            <View style={styles.buttonsContainer}>
              {buttons.map((button, idx) => {
                const style = button.style;
                const isDestructive = style === 'destructive';
                const isCancel = style === 'cancel';

                return (
                  <TouchableOpacity
                    key={`${button.text || 'button'}-${idx}`}
                    activeOpacity={0.85}
                    style={[
                      styles.button,
                      isCancel && styles.buttonCancel,
                      isDestructive && styles.buttonDestructive,
                      !isCancel && !isDestructive && styles.buttonPrimary,
                    ]}
                    onPress={() => handleButtonPress(button)}
                  >
                    <Text
                      style={[
                        styles.buttonText,
                        isCancel && styles.buttonTextCancel,
                        isDestructive && styles.buttonTextDestructive,
                      ]}
                    >
                      {button.text || 'OK'}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
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
    backgroundColor: 'rgba(2, 6, 23, 0.72)',
    paddingHorizontal: 20,
  },
  overlayTouchable: {
    ...StyleSheet.absoluteFillObject,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 18,
    padding: 16,
    gap: 10,
    backgroundColor: Colors.background.card,
    borderWidth: 1,
    borderColor: Colors.border.light,
  },
  title: {
    color: Colors.text.primary,
    fontSize: 22,
    fontWeight: '700',
    lineHeight: 27,
  },
  message: {
    color: Colors.text.secondary,
    fontSize: 16,
    lineHeight: 22,
    marginBottom: 4,
  },
  buttonsContainer: {
    gap: 10,
    marginTop: 8,
  },
  button: {
    minHeight: 46,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
    borderWidth: 1,
  },
  buttonPrimary: {
    backgroundColor: Colors.primary.orange,
    borderColor: Colors.primary.orange,
  },
  buttonCancel: {
    backgroundColor: Colors.background.cardLight,
    borderColor: Colors.border.light,
  },
  buttonDestructive: {
    backgroundColor: Colors.status.error,
    borderColor: Colors.status.error,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  buttonTextCancel: {
    color: Colors.text.primary,
  },
  buttonTextDestructive: {
    color: '#FFFFFF',
  },
});
