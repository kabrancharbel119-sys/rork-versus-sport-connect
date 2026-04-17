import React, { useRef, useEffect } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Animated, Dimensions, ScrollView, Platform } from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowLeft, Users, Swords, Trophy, MapPin, Calendar, DollarSign, BarChart3, Shield } from 'lucide-react-native';
import { Colors } from '@/constants/colors';

const { width } = Dimensions.get('window');
const CARD_W = width - 48;

export default function ChooseTypeScreen() {
  const router = useRouter();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideLeft = useRef(new Animated.Value(-40)).current;
  const slideRight = useRef(new Animated.Value(40)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.spring(slideLeft, { toValue: 0, friction: 8, tension: 40, useNativeDriver: true }),
      Animated.spring(slideRight, { toValue: 0, friction: 8, tension: 40, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <LinearGradient colors={[Colors.background.dark, '#0D1420']} style={styles.container}>
        <View style={styles.headerRow}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <ArrowLeft size={22} color={Colors.text.primary} />
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={true}
        >
          <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
          <Text style={styles.title}>Quel type de compte souhaitez-vous créer ?</Text>
          <Text style={styles.subtitle}>Ce choix détermine votre expérience sur la plateforme</Text>

          {/* PLAYER CARD */}
          <Animated.View style={{ transform: [{ translateX: slideLeft }] }}>
            <TouchableOpacity
              activeOpacity={0.85}
              style={styles.typeCard}
              onPress={() => router.push('/auth/register')}
            >
              <LinearGradient
                colors={[Colors.primary.blue + '20', Colors.primary.blue + '05']}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                style={styles.typeCardGradient}
              >
                <View style={styles.typeCardHeader}>
                  <View style={[styles.typeIcon, { backgroundColor: Colors.primary.blue + '25' }]}>
                    <Users size={28} color={Colors.primary.blue} />
                  </View>
                  <View style={styles.typeBadge}>
                    <Text style={styles.typeBadgeText}>Joueur</Text>
                  </View>
                </View>

                <Text style={styles.typeTitle}>Je suis un joueur</Text>
                <Text style={styles.typeDesc}>
                  Trouvez des matchs, rejoignez des équipes, participez à des tournois et réservez des terrains.
                </Text>

                <View style={styles.typeFeatures}>
                  {[
                    { icon: Swords, text: 'Matchs & Tournois' },
                    { icon: Users, text: 'Équipes & Chat' },
                    { icon: Trophy, text: 'Classements & Trophées' },
                    { icon: MapPin, text: 'Réserver des terrains' },
                  ].map((f, i) => (
                    <View key={i} style={styles.typeFeatureRow}>
                      <f.icon size={14} color={Colors.primary.blue} />
                      <Text style={styles.typeFeatureText}>{f.text}</Text>
                    </View>
                  ))}
                </View>

                <View style={[styles.typeBtn, { backgroundColor: Colors.primary.blue }]}>
                  <Text style={styles.typeBtnText}>Créer un compte joueur</Text>
                </View>
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>

          {/* VENUE MANAGER CARD */}
          <Animated.View style={{ transform: [{ translateX: slideRight }] }}>
            <TouchableOpacity
              activeOpacity={0.85}
              style={styles.typeCard}
              onPress={() => router.push('/auth/register-manager' as any)}
            >
              <LinearGradient
                colors={[Colors.primary.orange + '20', Colors.primary.orange + '05']}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                style={styles.typeCardGradient}
              >
                <View style={styles.typeCardHeader}>
                  <View style={[styles.typeIcon, { backgroundColor: Colors.primary.orange + '25' }]}>
                    <MapPin size={28} color={Colors.primary.orange} />
                  </View>
                  <View style={[styles.typeBadge, { backgroundColor: Colors.primary.orange + '20' }]}>
                    <Text style={[styles.typeBadgeText, { color: Colors.primary.orange }]}>Gestionnaire</Text>
                  </View>
                </View>

                <Text style={styles.typeTitle}>J'ai un terrain</Text>
                <Text style={styles.typeDesc}>
                  Gérez vos terrains, recevez des réservations, suivez vos revenus et développez votre activité.
                </Text>

                <View style={styles.typeFeatures}>
                  {[
                    { icon: MapPin, text: 'Gérer mes terrains' },
                    { icon: Calendar, text: 'Réservations en temps réel' },
                    { icon: DollarSign, text: 'Suivi des revenus' },
                    { icon: BarChart3, text: 'Statistiques détaillées' },
                  ].map((f, i) => (
                    <View key={i} style={styles.typeFeatureRow}>
                      <f.icon size={14} color={Colors.primary.orange} />
                      <Text style={styles.typeFeatureText}>{f.text}</Text>
                    </View>
                  ))}
                </View>

                <View style={[styles.typeBtn, { backgroundColor: Colors.primary.orange }]}>
                  <Text style={styles.typeBtnText}>Créer un compte gestionnaire</Text>
                </View>
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>
        </Animated.View>
        </ScrollView>
      </LinearGradient>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    ...Platform.select({
      web: {
        height: '100vh' as any,
        overflow: 'hidden' as any,
      },
    }),
  },
  headerRow: { paddingHorizontal: 16, paddingTop: 56, paddingBottom: 8 },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: Colors.background.card, alignItems: 'center', justifyContent: 'center',
  },
  scrollView: {
    flex: 1,
    ...Platform.select({
      web: {
        height: 'calc(100vh - 70px)' as any,
        overflowY: 'scroll' as any,
        scrollbarWidth: 'thin' as any,
      },
    }),
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 30,
    minHeight: '100%',
    ...Platform.select({
      web: {
        minHeight: 'calc(100vh - 100px)' as any,
      },
    }),
  },
  content: { flex: 1 },
  title: {
    color: Colors.text.primary, fontSize: 24, fontWeight: '800',
    textAlign: 'center', marginBottom: 6, letterSpacing: -0.5,
  },
  subtitle: {
    color: Colors.text.muted, fontSize: 14, textAlign: 'center', marginBottom: 24,
  },
  typeCard: { marginBottom: 16, borderRadius: 20, overflow: 'hidden' },
  typeCardGradient: {
    padding: 20, borderRadius: 20,
    borderWidth: 1.5, borderColor: Colors.border.light,
  },
  typeCardHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14,
  },
  typeIcon: {
    width: 52, height: 52, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
  },
  typeBadge: {
    backgroundColor: Colors.primary.blue + '20',
    paddingHorizontal: 12, paddingVertical: 4, borderRadius: 8,
  },
  typeBadgeText: { color: Colors.primary.blue, fontSize: 12, fontWeight: '700' },
  typeTitle: {
    color: Colors.text.primary, fontSize: 20, fontWeight: '800', marginBottom: 6,
  },
  typeDesc: {
    color: Colors.text.secondary, fontSize: 13, lineHeight: 19, marginBottom: 14,
  },
  typeFeatures: { gap: 8, marginBottom: 16 },
  typeFeatureRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  typeFeatureText: { color: Colors.text.secondary, fontSize: 13 },
  typeBtn: {
    alignItems: 'center', justifyContent: 'center',
    paddingVertical: 13, borderRadius: 12,
  },
  typeBtnText: { color: '#FFF', fontSize: 15, fontWeight: '700' },
});
