import React from 'react';
import { Tabs } from 'expo-router';
import { Home, Users, Swords, MessageCircle, User } from 'lucide-react-native';
import { View, Text, StyleSheet } from 'react-native';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { Colors } from '@/constants/colors';
import { useChat } from '@/contexts/ChatContext';
import { useI18n } from '@/contexts/I18nContext';

function TabBarBadge({ count }: { count: number }) {
  if (count === 0) return null;
  return (
    <View style={styles.badge} accessibilityLabel={`${count} messages non lus`}>
      <Text style={styles.badgeText}>{count > 9 ? '9+' : count}</Text>
    </View>
  );
}

export default function TabLayout() {
  const { getTotalUnread } = useChat();
  const { t } = useI18n();
  const unreadCount = getTotalUnread();

  return (
    <ErrorBoundary>
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: Colors.background.card,
          borderTopColor: Colors.border.light,
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
        name="(home)"
        options={{
          title: t('tabs.home'),
          tabBarIcon: ({ color, size }) => <Home size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="matches"
        options={{
          title: 'Matchs',
          tabBarIcon: ({ color, size }) => <Swords size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="teams"
        options={{
          title: t('tabs.teams'),
          tabBarIcon: ({ color, size }) => <Users size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          title: 'Chat',
          tabBarIcon: ({ color, size }) => (
            <View>
              <MessageCircle size={size} color={color} />
              <TabBarBadge count={unreadCount} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="my-venues"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t('tabs.profile'),
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