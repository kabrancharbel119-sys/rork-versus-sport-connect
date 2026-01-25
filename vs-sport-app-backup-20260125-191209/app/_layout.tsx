import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { TeamsProvider } from "@/contexts/TeamsContext";
import { MatchesProvider } from "@/contexts/MatchesContext";
import { ChatProvider } from "@/contexts/ChatContext";
import { LocationProvider } from "@/contexts/LocationContext";
import { UsersProvider } from "@/contexts/UsersContext";
import { NotificationsProvider } from "@/contexts/NotificationsContext";
import { SupportProvider } from "@/contexts/SupportContext";
import { TrophiesProvider } from "@/contexts/TrophiesContext";
import { I18nProvider } from "@/contexts/I18nContext";
import { OfflineProvider } from "@/contexts/OfflineContext";
import { ReferralProvider } from "@/contexts/ReferralContext";
import { Colors } from "@/constants/colors";
import { trpc, trpcClient } from "@/lib/trpc";

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      gcTime: 1000 * 60 * 30,
      retry: 2,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
    },
    mutations: {
      retry: 1,
    },
  },
});

function AuthGateInner({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const segments = useSegments();
  const { isAuthenticated, isLoading } = useAuth();

  useEffect(() => {
    if (isLoading) return;

    const inAuthGroup = segments[0] === 'auth';
    const inSplash = segments[0] === 'splash';
    const inVerifyEmail = segments[0] === 'verify-email';

    console.log('[AuthGate] Segments:', segments, 'isAuth:', isAuthenticated);

    if (!isAuthenticated && !inAuthGroup && !inSplash && !inVerifyEmail) {
      console.log('[AuthGate] Redirecting to welcome...');
      router.replace('/auth/welcome');
    }
  }, [isLoading, isAuthenticated, segments, router]);

  if (isLoading) {
    return (
      <View style={authStyles.loadingContainer}>
        <LinearGradient colors={[Colors.background.dark, '#0D1420']} style={StyleSheet.absoluteFill} />
        <ActivityIndicator size="large" color={Colors.primary.orange} />
      </View>
    );
  }

  return <>{children}</>;
}

const authStyles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

function RootLayoutNav() {
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: Colors.background.dark }, animation: 'fade' }}>
      <Stack.Screen name="splash" />
      <Stack.Screen name="auth" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="create-team" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
      <Stack.Screen name="create-match" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
      <Stack.Screen name="edit-profile" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
      <Stack.Screen name="settings" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
      <Stack.Screen name="admin" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
      <Stack.Screen name="team/[id]" />
      <Stack.Screen name="match/[id]" />
      <Stack.Screen name="chat/[roomId]" />
      <Stack.Screen name="forgot-password" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
      <Stack.Screen name="notifications" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
      <Stack.Screen name="user/[id]" />
      <Stack.Screen name="terms" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
      <Stack.Screen name="privacy" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
      <Stack.Screen name="contact" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
      <Stack.Screen name="trophies" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
      <Stack.Screen name="verification" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
      <Stack.Screen name="search" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
      <Stack.Screen name="referral" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
      <Stack.Screen name="statistics" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
    </Stack>
  );
}

export default function RootLayout() {
  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);

  return (
    <ErrorBoundary>
      <trpc.Provider client={trpcClient} queryClient={queryClient}>
        <QueryClientProvider client={queryClient}>
        <GestureHandlerRootView style={{ flex: 1 }}>
          <I18nProvider>
            <OfflineProvider>
              <AuthProvider>
                <AuthGateInner>
                  <UsersProvider>
                    <NotificationsProvider>
                      <SupportProvider>
                        <TrophiesProvider>
                          <ReferralProvider>
                            <LocationProvider>
                              <TeamsProvider>
                                <MatchesProvider>
                                  <ChatProvider>
                                    <RootLayoutNav />
                                  </ChatProvider>
                                </MatchesProvider>
                              </TeamsProvider>
                            </LocationProvider>
                          </ReferralProvider>
                        </TrophiesProvider>
                      </SupportProvider>
                    </NotificationsProvider>
                  </UsersProvider>
                </AuthGateInner>
              </AuthProvider>
            </OfflineProvider>
          </I18nProvider>
        </GestureHandlerRootView>
      </QueryClientProvider>
      </trpc.Provider>
    </ErrorBoundary>
  );
}
