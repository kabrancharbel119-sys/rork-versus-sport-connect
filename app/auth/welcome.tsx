import React, { useRef, useEffect } from 'react';
import { StyleSheet, View, Text, Animated, Dimensions } from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { Users, Trophy, Zap, Shield } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { Button } from '@/components/Button';

const { width } = Dimensions.get('window');

const features = [
  { icon: Users, title: 'Équipes', desc: 'Créez ou rejoignez des équipes' },
  { icon: Trophy, title: 'Tournois', desc: 'Participez et gagnez des cash prizes' },
  { icon: Zap, title: 'Matchs', desc: 'Trouvez des adversaires facilement' },
  { icon: Shield, title: 'Réputation', desc: 'Progressez et soyez reconnu' },
];

export default function WelcomeScreen() {
  const router = useRouter();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        friction: 8,
        tension: 40,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <LinearGradient
        colors={[Colors.background.dark, '#0D1420']}
        style={styles.container}
      >
        <Animated.View
          style={[
            styles.content,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          <View style={styles.logoSection}>
            <Image
              source={{ uri: 'https://pub-e001eb4506b145aa938b5d3badbff6a5.r2.dev/attachments/bb74j32pntaehgnts84r7' }}
              style={styles.logo}
              contentFit="contain"
            />
            <Text style={styles.subtitle}>
              Structurez votre passion sportive
            </Text>
          </View>

          <View style={styles.featuresGrid}>
            {features.map((feature, index) => (
              <View key={index} style={styles.featureCard}>
                <LinearGradient
                  colors={[
                    index % 2 === 0 ? 'rgba(21, 101, 192, 0.2)' : 'rgba(255, 107, 0, 0.2)',
                    'rgba(20, 27, 45, 0.8)',
                  ]}
                  style={styles.featureGradient}
                >
                  <feature.icon
                    size={28}
                    color={index % 2 === 0 ? Colors.primary.blueLight : Colors.primary.orangeLight}
                  />
                  <Text style={styles.featureTitle}>{feature.title}</Text>
                  <Text style={styles.featureDesc}>{feature.desc}</Text>
                </LinearGradient>
              </View>
            ))}
          </View>

          <View style={styles.actions}>
            <Button
              title="Créer un compte"
              onPress={() => router.push('/auth/choose-type' as any)}
              variant="orange"
              size="large"
              style={styles.button}
            />
            <Button
              title="Se connecter"
              onPress={() => router.push('/auth/login')}
              variant="outline"
              size="large"
              style={styles.button}
            />

          </View>

          <Text style={styles.terms}>
            En continuant, vous acceptez nos{' '}
            <Text style={styles.link}>Conditions d{"'"}utilisation</Text>
          </Text>
        </Animated.View>
      </LinearGradient>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 40,
  },
  logoSection: {
    alignItems: 'center',
    marginBottom: 32,
  },
  logo: {
    width: 140,
    height: 140,
  },
  subtitle: {
    color: Colors.text.secondary,
    fontSize: 16,
    marginTop: 12,
    textAlign: 'center',
  },
  featuresGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 32,
  },
  featureCard: {
    width: (width - 60) / 2,
    borderRadius: 16,
    overflow: 'hidden',
  },
  featureGradient: {
    padding: 16,
    alignItems: 'center',
    minHeight: 120,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border.light,
    borderRadius: 16,
  },
  featureTitle: {
    color: Colors.text.primary,
    fontSize: 16,
    fontWeight: '600' as const,
    marginTop: 12,
  },
  featureDesc: {
    color: Colors.text.muted,
    fontSize: 12,
    textAlign: 'center',
    marginTop: 4,
  },
  actions: {
    gap: 12,
    marginTop: 'auto',
  },
  button: {
    width: '100%',
  },
  terms: {
    color: Colors.text.muted,
    fontSize: 12,
    textAlign: 'center',
    marginTop: 20,
  },
  link: {
    color: Colors.primary.blue,
  },

});