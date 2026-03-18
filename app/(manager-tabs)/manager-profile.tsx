import React, { useMemo } from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  MapPin, LogOut, Settings, Shield, FileText, HelpCircle,
  User, DollarSign, Calendar, TrendingUp, ChevronRight,
} from 'lucide-react-native';
import { useQuery } from '@tanstack/react-query';
import { Colors } from '@/constants/colors';
import { useAuth } from '@/contexts/AuthContext';
import { venuesApi } from '@/lib/api/venues';
import { Card } from '@/components/Card';
import type { Venue, Booking } from '@/types';

export default function ManagerProfileTab() {
  const router = useRouter();
  const { user, logout } = useAuth();

  const venuesQuery = useQuery({
    queryKey: ['myVenues', user?.id],
    queryFn: () => venuesApi.getByOwner(user!.id),
    enabled: !!user?.id,
  });

  const bookingsQuery = useQuery({
    queryKey: ['ownerBookings', user?.id],
    queryFn: () => venuesApi.getOwnerBookings(user!.id),
    enabled: !!user?.id,
  });

  const venues: Venue[] = venuesQuery.data || [];
  const bookings: Booking[] = bookingsQuery.data || [];

  const totalRevenue = useMemo(() =>
    bookings.filter(b => b.status === 'confirmed' || b.status === 'completed').reduce((sum, b) => sum + b.totalPrice, 0),
    [bookings]
  );

  const handleLogout = () => {
    Alert.alert('Déconnexion', 'Voulez-vous vous déconnecter ?', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Déconnexion', style: 'destructive', onPress: () => logout() },
    ]);
  };

  const menuItems = [
    { icon: User, label: 'Modifier mon profil', onPress: () => router.push('/edit-profile' as any) },
    { icon: Settings, label: 'Paramètres', onPress: () => router.push('/settings' as any) },
    { icon: FileText, label: 'Conditions d\'utilisation', onPress: () => router.push('/terms' as any) },
    { icon: Shield, label: 'Politique de confidentialité', onPress: () => router.push('/privacy' as any) },
    { icon: HelpCircle, label: 'Nous contacter', onPress: () => router.push('/contact' as any) },
  ];

  return (
    <View style={styles.container}>
      <LinearGradient colors={[Colors.background.dark, '#0D1420']} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Mon Profil</Text>
        </View>

        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* Profile card */}
          <Card style={styles.profileCard}>
            <View style={styles.avatarWrap}>
              <LinearGradient colors={[Colors.primary.orange, Colors.primary.orangeDark]} style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {(user?.fullName || user?.username || 'G')[0].toUpperCase()}
                </Text>
              </LinearGradient>
              <View style={styles.managerBadge}>
                <MapPin size={10} color="#FFF" />
              </View>
            </View>
            <Text style={styles.profileName}>{user?.fullName || user?.username || 'Gestionnaire'}</Text>
            <Text style={styles.profileEmail}>{user?.email}</Text>
            <View style={styles.profileRoleBadge}>
              <MapPin size={12} color={Colors.primary.orange} />
              <Text style={styles.profileRoleText}>Gestionnaire de terrain</Text>
            </View>
          </Card>

          {/* Stats summary */}
          <View style={styles.statsRow}>
            <Card style={styles.statCard}>
              <MapPin size={18} color={Colors.primary.orange} />
              <Text style={styles.statValue}>{venues.length}</Text>
              <Text style={styles.statLabel}>Terrains</Text>
            </Card>
            <Card style={styles.statCard}>
              <Calendar size={18} color={Colors.primary.blue} />
              <Text style={styles.statValue}>{bookings.length}</Text>
              <Text style={styles.statLabel}>Réservations</Text>
            </Card>
            <Card style={styles.statCard}>
              <DollarSign size={18} color={Colors.status.success} />
              <Text style={styles.statValue}>{totalRevenue > 1000 ? `${(totalRevenue / 1000).toFixed(0)}k` : totalRevenue.toString()}</Text>
              <Text style={styles.statLabel}>FCFA</Text>
            </Card>
          </View>

          {/* Menu */}
          <View style={styles.menuSection}>
            {menuItems.map((item, i) => (
              <TouchableOpacity key={i} style={styles.menuItem} onPress={item.onPress} activeOpacity={0.7}>
                <View style={styles.menuItemLeft}>
                  <View style={styles.menuIconWrap}>
                    <item.icon size={18} color={Colors.text.secondary} />
                  </View>
                  <Text style={styles.menuItemText}>{item.label}</Text>
                </View>
                <ChevronRight size={18} color={Colors.text.muted} />
              </TouchableOpacity>
            ))}
          </View>

          {/* Logout */}
          <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.7}>
            <LogOut size={18} color={Colors.status.error} />
            <Text style={styles.logoutText}>Se déconnecter</Text>
          </TouchableOpacity>

          <Text style={styles.version}>Versus Sport Connect • Gestionnaire</Text>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 16, paddingVertical: 10,
  },
  headerTitle: { color: Colors.text.primary, fontSize: 20, fontWeight: '800' },
  scrollView: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 60 },

  profileCard: { alignItems: 'center', padding: 24, marginBottom: 16 },
  avatarWrap: { position: 'relative', marginBottom: 12 },
  avatar: {
    width: 72, height: 72, borderRadius: 36,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { color: '#FFF', fontSize: 28, fontWeight: '800' },
  managerBadge: {
    position: 'absolute', bottom: 0, right: -2,
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: Colors.primary.orange, alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: Colors.background.card,
  },
  profileName: { color: Colors.text.primary, fontSize: 18, fontWeight: '700' },
  profileEmail: { color: Colors.text.muted, fontSize: 13, marginTop: 2 },
  profileRoleBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10,
    backgroundColor: Colors.primary.orange + '15', paddingHorizontal: 12, paddingVertical: 5, borderRadius: 8,
  },
  profileRoleText: { color: Colors.primary.orange, fontSize: 12, fontWeight: '700' },

  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  statCard: { flex: 1, alignItems: 'center', padding: 14, gap: 4 },
  statValue: { color: Colors.text.primary, fontSize: 18, fontWeight: '800' },
  statLabel: { color: Colors.text.muted, fontSize: 11 },

  menuSection: {
    backgroundColor: Colors.background.card, borderRadius: 14,
    borderWidth: 1, borderColor: Colors.border.light, overflow: 'hidden', marginBottom: 20,
  },
  menuItem: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: Colors.border.light,
  },
  menuItemLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  menuIconWrap: {
    width: 34, height: 34, borderRadius: 10,
    backgroundColor: Colors.background.cardLight, alignItems: 'center', justifyContent: 'center',
  },
  menuItemText: { color: Colors.text.primary, fontSize: 14, fontWeight: '500' },

  logoutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: Colors.status.error + '10', borderRadius: 12,
    paddingVertical: 14, borderWidth: 1, borderColor: Colors.status.error + '20',
  },
  logoutText: { color: Colors.status.error, fontSize: 15, fontWeight: '600' },

  version: { color: Colors.text.muted, fontSize: 11, textAlign: 'center', marginTop: 20 },
});
