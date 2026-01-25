import React, { useEffect, useRef } from 'react';
import { StyleSheet, View, Text, Animated, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { Colors } from '@/constants/colors';
import { useAuth } from '@/contexts/AuthContext';

const { width, height } = Dimensions.get('window');

export default function SplashScreen() {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuth();
  
  const logoScale = useRef(new Animated.Value(0.5)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.spring(logoScale, {
          toValue: 1,
          friction: 4,
          tension: 40,
          useNativeDriver: true,
        }),
        Animated.timing(logoOpacity, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
      ]),
      Animated.timing(textOpacity, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  useEffect(() => {
    if (!isLoading) {
      const timer = setTimeout(() => {
        if (isAuthenticated) {
          router.replace('/(tabs)/(home)');
        } else {
          router.replace('/auth/welcome');
        }
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [isLoading, isAuthenticated]);

  return (
    <LinearGradient
      colors={[Colors.background.dark, '#0D1420', '#0A0E1A']}
      style={styles.container}
    >
      <View style={styles.particles}>
        {[...Array(20)].map((_, i) => (
          <View
            key={i}
            style={[
              styles.particle,
              {
                left: Math.random() * width,
                top: Math.random() * height,
                width: Math.random() * 4 + 2,
                height: Math.random() * 4 + 2,
                backgroundColor: i % 2 === 0 ? Colors.primary.blue : Colors.primary.orange,
                opacity: Math.random() * 0.5 + 0.2,
              },
            ]}
          />
        ))}
      </View>

      <Animated.View
        style={[
          styles.logoContainer,
          {
            transform: [{ scale: logoScale }],
            opacity: logoOpacity,
          },
        ]}
      >
        <Image
          source={{ uri: 'https://pub-e001eb4506b145aa938b5d3badbff6a5.r2.dev/attachments/bb74j32pntaehgnts84r7' }}
          style={styles.logo}
          contentFit="contain"
        />
      </Animated.View>

      <Animated.View style={[styles.textContainer, { opacity: textOpacity }]}>
        <Text style={styles.tagline}>Le sport amateur, structuré.</Text>
        <View style={styles.loaderContainer}>
          <View style={styles.loaderTrack}>
            <Animated.View style={[styles.loaderBar]} />
          </View>
        </View>
      </Animated.View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  particles: {
    ...StyleSheet.absoluteFillObject,
  },
  particle: {
    position: 'absolute',
    borderRadius: 10,
  },
  logoContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    width: 200,
    height: 200,
  },
  textContainer: {
    marginTop: 24,
    alignItems: 'center',
  },
  tagline: {
    color: Colors.text.secondary,
    fontSize: 18,
    fontWeight: '500' as const,
    letterSpacing: 1,
  },
  loaderContainer: {
    marginTop: 32,
    width: 120,
  },
  loaderTrack: {
    height: 4,
    backgroundColor: Colors.background.cardLight,
    borderRadius: 2,
    overflow: 'hidden',
  },
  loaderBar: {
    height: '100%',
    width: '100%',
    backgroundColor: Colors.primary.orange,
    borderRadius: 2,
  },
});