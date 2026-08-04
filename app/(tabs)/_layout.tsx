import React from 'react';
import { Tabs } from 'expo-router';
import { Home, Users, Swords, Trophy, MapPin, Newspaper } from 'lucide-react-native';
import { View, Text, StyleSheet, Platform, Pressable } from 'react-native';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { Colors } from '@/constants/colors';
import { useChat } from '@/contexts/ChatContext';
import { useI18n } from '@/contexts/I18nContext';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';

function TabBarBadge({ count, label }: { count: number; label: string }) {
  if (count === 0) return null;
  return (
    <View style={styles.badge} accessibilityLabel={`${count} ${label}`}>
      <Text style={styles.badgeText}>{count > 9 ? '9+' : count}</Text>
    </View>
  );
}

function CustomTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const bottomInset = Math.max(insets.bottom, 16);
  return (
    <View style={[styles.tabBarContainer, { bottom: bottomInset }]}>
      <BlurView
        intensity={80}
        tint="dark"
        style={styles.blurView}
      >
        <View style={styles.tabBarInner}>
          {state.routes.map((route, index) => {
            const { options } = descriptors[route.key];
            const isFocused = state.index === index;

            const hiddenRoutes = ['chat', 'my-venues', 'profile'];
            if (hiddenRoutes.includes(route.name)) return null;

            const onPress = () => {
              const event = navigation.emit({
                type: 'tabPress',
                target: route.key,
                canPreventDefault: true,
              });

              if (!isFocused && !event.defaultPrevented) {
                navigation.navigate(route.name as never);
              }
            };

            const label =
              typeof options.title === 'string'
                ? options.title
                : route.name;

            const Icon = options.tabBarIcon;

            return (
              <Pressable
                key={route.key}
                accessibilityRole="button"
                accessibilityState={isFocused ? { selected: true } : {}}
                accessibilityLabel={label}
                onPress={onPress}
                style={styles.tabItem}
              >
                {Icon ? (
                  <Icon
                    color={isFocused ? Colors.primary.orange : Colors.text.muted}
                    size={22}
                    focused={isFocused}
                  />
                ) : null}
                <Text
                  style={[
                    styles.tabLabel,
                    { color: isFocused ? Colors.primary.orange : Colors.text.muted },
                  ]}
                >
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </BlurView>
    </View>
  );
}

export default function TabLayout() {
  const { getTotalUnread } = useChat();
  const { t, locale } = useI18n();
  const unreadCount = getTotalUnread();

  return (
    <ErrorBoundary>
      <Tabs
        key={locale}
        tabBar={(props) => <CustomTabBar {...props} />}
        screenOptions={{
          headerShown: false,
        }}
      >
        <Tabs.Screen
          name="(home)"
          options={{
            title: t('tabs.home'),
            tabBarIcon: ({ color, size }) => <Home size={size} color={color} strokeWidth={2} />,
          }}
        />
        <Tabs.Screen
          name="feed"
          options={{
            title: 'Feed',
            tabBarIcon: ({ color, size }) => <Newspaper size={size} color={color} strokeWidth={2} />,
          }}
        />
        <Tabs.Screen
          name="matches"
          options={{
            title: t('tabs.matches'),
            tabBarIcon: ({ color, size }) => <Swords size={size} color={color} strokeWidth={2} />,
          }}
        />
        <Tabs.Screen
          name="teams"
          options={{
            title: t('tabs.teams'),
            tabBarIcon: ({ color, size }) => <Users size={size} color={color} strokeWidth={2} />,
          }}
        />
        <Tabs.Screen
          name="tournaments"
          options={{
            title: 'Tournois',
            tabBarIcon: ({ color, size }) => <Trophy size={size} color={color} strokeWidth={2} />,
          }}
        />
        <Tabs.Screen
          name="venues"
          options={{
            title: 'Terrains',
            tabBarIcon: ({ color, size }) => <MapPin size={size} color={color} strokeWidth={2} />,
          }}
        />
        <Tabs.Screen
          name="chat"
          options={{
            href: null,
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
            href: null,
          }}
        />
      </Tabs>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  tabBarContainer: {
    position: 'absolute',
    bottom: 12,
    left: 70,
    right: 70,
    borderRadius: 24,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.35,
        shadowRadius: 16,
      },
      android: { elevation: 10 },
    }) as any,
  },
  blurView: {
    borderRadius: 24,
    overflow: 'hidden',
  },
  tabBarInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: 6,
    paddingHorizontal: 4,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    minHeight: 50,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  tabLabel: {
    fontSize: 9,
    fontWeight: '600' as const,
    marginTop: 2,
  },
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