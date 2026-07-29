import React, { useEffect, useState } from 'react';
import { Platform, StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Download, X } from 'lucide-react-native';
import { Colors } from '@/constants/colors';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISS_KEY = 'vs_pwa_install_dismissed';

export function PwaInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'web') return;

    // Already installed (standalone mode)
    if (window.matchMedia('(display-mode: standalone)').matches) return;

    // Check if user previously dismissed
    try {
      if (localStorage.getItem(DISMISS_KEY) === '1') return;
    } catch {}

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setVisible(true);
    };

    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    if (choice.outcome === 'accepted') {
      setVisible(false);
    }
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setVisible(false);
    try { localStorage.setItem(DISMISS_KEY, '1'); } catch {}
  };

  if (!visible || Platform.OS !== 'web') return null;

  return (
    <View style={styles.wrapper}>
      <LinearGradient
        colors={[Colors.primary.orange, '#FF8855']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.banner}
      >
        <View style={styles.iconWrap}>
          <Download size={22} color="#FFF" />
        </View>
        <View style={styles.textWrap}>
          <Text style={styles.title}>Installer l'application</Text>
          <Text style={styles.subtitle}>Accès rapide depuis votre écran d'accueil</Text>
        </View>
        <TouchableOpacity style={styles.installBtn} onPress={handleInstall} activeOpacity={0.85}>
          <Text style={styles.installText}>Installer</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.closeBtn} onPress={handleDismiss} activeOpacity={0.7}>
          <X size={18} color="#FFF" />
        </TouchableOpacity>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute' as const,
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 9999,
    paddingHorizontal: 12,
    paddingBottom: 8,
  },
  banner: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  textWrap: {
    flex: 1,
  },
  title: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '700' as const,
  },
  subtitle: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 12,
    marginTop: 2,
  },
  installBtn: {
    backgroundColor: '#FFF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
  },
  installText: {
    color: Colors.primary.orange,
    fontSize: 14,
    fontWeight: '700' as const,
  },
  closeBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
});
