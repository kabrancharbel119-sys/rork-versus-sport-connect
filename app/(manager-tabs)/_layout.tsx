import React from 'react';
import { Tabs } from 'expo-router';
import { Home, MapPin, Calendar, User } from 'lucide-react-native';
import { View, Text, StyleSheet } from 'react-native';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { Colors } from '@/constants/colors';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { venuesApi } from '@/lib/api/venues';

function TabBarBadge({ count }: { count: number }) {
  if (count === 0) return null;
  return (
    <View style={styles.badge} accessibilityLabel={`${count} en attente`}>
      <Text style={styles.badgeText}>{count > 9 ? '9+' : count}</Text>
    </View>
  );
}

export default function ManagerTabLayout() {
  const { user } = useAuth();

  console.log('[ManagerLayout] User ID:', user?.id, 'Enabled:', !!user?.id);

  const bookingsQuery = useQuery({
    queryKey: ['ownerBookings', user?.id],
    queryFn: () => {
      console.log('[ManagerLayout] Fetching bookings for badge, owner:', user!.id);
      return venuesApi.getOwnerBookings(user!.id);
    },
    enabled: !!user?.id,
    refetchInterval: 30_000,
  });

  console.log('[ManagerLayout] Bookings query status:', bookingsQuery.status, 'data:', bookingsQuery.data?.length);
  const pendingCount = (bookingsQuery.data || []).filter((b: any) => b.status === 'pending').length;
  console.log('[ManagerLayout] Pending count:', pendingCount);

  return (
    <ErrorBoundary>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarStyle: {
            backgroundColor: Colors.background.card,
            borderTopColor: Colors.primary.orange + '30',
            borderTopWidth: 1,
            height: 85,
            paddingBottom: 25,
            paddingTop: 10,
          },
          tabBarActiveTintColor: Colors.primary.orange,
          tabBarInactiveTintColor: Colors.text.muted,
          tabBarLabelStyle: {
            fontSize: 11,
            fontWeight: '500' as const,
          },
        }}
      >
        <Tabs.Screen
          name="dashboard"
          options={{
            title: 'Dashboard',
            tabBarIcon: ({ color, size }) => <Home size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="my-venues"
          options={{
            title: 'Terrains',
            tabBarIcon: ({ color, size }) => <MapPin size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="bookings"
          options={{
            title: 'Réservations',
            tabBarIcon: ({ color, size }) => (
              <View>
                <Calendar size={size} color={color} />
                <TabBarBadge count={pendingCount} />
              </View>
            ),
          }}
        />
        <Tabs.Screen
          name="manager-profile"
          options={{
            title: 'Profil',
            tabBarIcon: ({ color, size }) => <User size={size} color={color} />,
          }}
        />
      </Tabs>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  badge: {
    position: 'absolute',
    top: -4,
    right: -8,
    backgroundColor: Colors.primary.orange,
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700' as const,
  },
});
