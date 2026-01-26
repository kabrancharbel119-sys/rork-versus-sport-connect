import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { Link, Stack } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Home, Search } from 'lucide-react-native';
import { Colors } from '@/constants/colors';

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: '', headerShown: false }} />
      <View style={styles.container}>
        <LinearGradient colors={[Colors.background.dark, '#0D1420']} style={StyleSheet.absoluteFill} />
        <View style={styles.content}>
          <View style={styles.iconWrap}>
            <Search size={48} color={Colors.text.muted} />
          </View>
          <Text style={styles.title}>Page introuvable</Text>
          <Text style={styles.message}>Cette page n&apos;existe pas ou a été déplacée.</Text>
          <Link href="/" asChild>
            <TouchableOpacity style={styles.button} activeOpacity={0.8}>
              <Home size={20} color={Colors.primary.blue} />
              <Text style={styles.buttonText}>Retour à l&apos;accueil</Text>
            </TouchableOpacity>
          </Link>
        </View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  content: {
    alignItems: 'center',
    maxWidth: 320,
  },
  iconWrap: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: Colors.background.card,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 22,
    fontWeight: '700' as const,
    color: Colors.text.primary,
    marginBottom: 12,
    textAlign: 'center',
  },
  message: {
    fontSize: 15,
    color: Colors.text.muted,
    textAlign: 'center',
    marginBottom: 28,
    lineHeight: 22,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Colors.primary.orange,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 14,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#FFFFFF',
  },
});
