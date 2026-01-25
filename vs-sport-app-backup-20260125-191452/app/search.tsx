import React, { useState, useMemo, useCallback } from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity, TextInput, Modal } from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Search, Users, Shield, Swords, MapPin, Star, CheckCircle, X, Sliders } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { useUsers } from '@/contexts/UsersContext';
import { useTeams } from '@/contexts/TeamsContext';
import { useMatches } from '@/contexts/MatchesContext';
import { useLocation } from '@/contexts/LocationContext';
import { Avatar } from '@/components/Avatar';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { sportLabels, levelLabels } from '@/mocks/data';
import { Sport, SkillLevel } from '@/types';

type SearchType = 'users' | 'teams' | 'matches';

const SPORTS: Sport[] = ['football', 'basketball', 'volleyball', 'tennis', 'handball', 'rugby', 'futsal', 'padel'];
const LEVELS: SkillLevel[] = ['beginner', 'intermediate', 'advanced', 'expert'];

export default function SearchScreen() {
  const router = useRouter();
  const { users } = useUsers();
  const { teams } = useTeams();
  const { matches } = useMatches();
  const { location } = useLocation();
  const [query, setQuery] = useState('');
  const [searchType, setSearchType] = useState<SearchType>('users');
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({ sport: '' as string, level: '' as string, city: '', verified: false, recruiting: false, needsPlayers: false, maxDistance: 50 });

  const getDistance = useCallback((lat1: number, lng1: number, lat2: number, lng2: number) => {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }, []);

  const filteredUsers = useMemo(() => {
    let result = users;
    const q = query.toLowerCase();
    if (q) result = result.filter(u => u.fullName.toLowerCase().includes(q) || u.username.toLowerCase().includes(q) || u.city?.toLowerCase().includes(q));
    if (filters.sport) result = result.filter(u => u.sports?.some(s => s.sport === filters.sport));
    if (filters.level) result = result.filter(u => u.sports?.some(s => s.level === filters.level));
    if (filters.city) result = result.filter(u => u.city?.toLowerCase().includes(filters.city.toLowerCase()));
    if (filters.verified) result = result.filter(u => u.isVerified);
    if (location && filters.maxDistance < 100) {
      result = result.filter(u => {
        if (!u.location) return true;
        return getDistance(location.latitude, location.longitude, u.location.latitude, u.location.longitude) <= filters.maxDistance;
      });
    }
    return result.slice(0, 50);
  }, [users, query, filters, location, getDistance]);

  const filteredTeams = useMemo(() => {
    let result = teams;
    const q = query.toLowerCase();
    if (q) result = result.filter(t => t.name.toLowerCase().includes(q) || t.city?.toLowerCase().includes(q) || sportLabels[t.sport]?.toLowerCase().includes(q));
    if (filters.sport) result = result.filter(t => t.sport === filters.sport);
    if (filters.level) result = result.filter(t => t.level === filters.level);
    if (filters.city) result = result.filter(t => t.city?.toLowerCase().includes(filters.city.toLowerCase()));
    if (filters.recruiting) result = result.filter(t => t.isRecruiting && t.members.length < t.maxMembers);
    return result.slice(0, 50);
  }, [teams, query, filters]);

  const filteredMatches = useMemo(() => {
    let result = matches.filter(m => m.status === 'open' || m.status === 'confirmed');
    const q = query.toLowerCase();
    if (q) result = result.filter(m => sportLabels[m.sport]?.toLowerCase().includes(q) || m.venue.name.toLowerCase().includes(q) || m.venue.city.toLowerCase().includes(q));
    if (filters.sport) result = result.filter(m => m.sport === filters.sport);
    if (filters.level) result = result.filter(m => m.level === filters.level);
    if (filters.city) result = result.filter(m => m.venue.city.toLowerCase().includes(filters.city.toLowerCase()));
    if (filters.needsPlayers) result = result.filter(m => m.needsPlayers && m.registeredPlayers.length < m.maxPlayers);
    if (location && filters.maxDistance < 100) {
      result = result.filter(m => {
        if (!m.location) return true;
        return getDistance(location.latitude, location.longitude, m.location.latitude, m.location.longitude) <= filters.maxDistance;
      });
    }
    return result.sort((a, b) => new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime()).slice(0, 50);
  }, [matches, query, filters, location, getDistance]);

  const activeFiltersCount = Object.values(filters).filter(v => v && v !== 50).length;
  const resetFilters = () => setFilters({ sport: '', level: '', city: '', verified: false, recruiting: false, needsPlayers: false, maxDistance: 50 });
  const formatDate = (date: Date) => new Date(date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.container}>
        <LinearGradient colors={[Colors.background.dark, '#0D1420']} style={StyleSheet.absoluteFill} />
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.header}>
            <TouchableOpacity style={styles.backButton} onPress={() => router.back()} accessibilityLabel="Retour" accessibilityRole="button"><ArrowLeft size={24} color={Colors.text.primary} /></TouchableOpacity>
            <Text style={styles.headerTitle} accessibilityRole="header">Rechercher</Text>
            <TouchableOpacity style={[styles.filterButton, activeFiltersCount > 0 && styles.filterButtonActive]} onPress={() => setShowFilters(true)} accessibilityLabel={`Filtres${activeFiltersCount > 0 ? `, ${activeFiltersCount} actifs` : ''}`}>
              <Sliders size={20} color={activeFiltersCount > 0 ? '#FFF' : Colors.text.secondary} />
              {activeFiltersCount > 0 && <View style={styles.filterBadge}><Text style={styles.filterBadgeText}>{activeFiltersCount}</Text></View>}
            </TouchableOpacity>
          </View>

          <View style={styles.searchContainer} accessibilityRole="search">
            <Search size={20} color={Colors.text.muted} />
            <TextInput style={styles.searchInput} placeholder="Rechercher joueurs, équipes, matchs..." placeholderTextColor={Colors.text.muted} value={query} onChangeText={setQuery} autoFocus accessibilityLabel="Champ de recherche" />
            {query.length > 0 && <TouchableOpacity onPress={() => setQuery('')} accessibilityLabel="Effacer la recherche"><X size={18} color={Colors.text.muted} /></TouchableOpacity>}
          </View>

          <View style={styles.tabs} accessibilityRole="tablist">
            {(['users', 'teams', 'matches'] as const).map(type => (
              <TouchableOpacity key={type} style={[styles.tab, searchType === type && styles.tabActive]} onPress={() => setSearchType(type)} accessibilityRole="tab" accessibilityState={{ selected: searchType === type }}>
                {type === 'users' && <Users size={16} color={searchType === type ? '#FFF' : Colors.text.secondary} />}
                {type === 'teams' && <Shield size={16} color={searchType === type ? '#FFF' : Colors.text.secondary} />}
                {type === 'matches' && <Swords size={16} color={searchType === type ? '#FFF' : Colors.text.secondary} />}
                <Text style={[styles.tabText, searchType === type && styles.tabTextActive]}>{type === 'users' ? 'Joueurs' : type === 'teams' ? 'Équipes' : 'Matchs'}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            {searchType === 'users' && (
              <>
                <Text style={styles.resultCount} accessibilityLiveRegion="polite">{filteredUsers.length} joueur(s)</Text>
                {filteredUsers.map(user => (
                  <Card key={user.id} style={styles.resultCard} onPress={() => router.push(`/user/${user.id}`)}>
                    <View style={styles.resultRow}>
                      <Avatar uri={user.avatar} name={user.fullName} size="medium" />
                      <View style={styles.resultInfo}>
                        <View style={styles.nameRow}><Text style={styles.resultName}>{user.fullName}</Text>{user.isVerified && <CheckCircle size={14} color={Colors.primary.blue} />}{user.isPremium && <Star size={14} color={Colors.primary.orange} />}</View>
                        <Text style={styles.resultSub}>@{user.username}</Text>
                        <View style={styles.resultMeta}><MapPin size={12} color={Colors.text.muted} /><Text style={styles.metaText}>{user.city}</Text></View>
                      </View>
                      <View style={styles.statBadge}><Text style={styles.statValue}>{user.stats?.matchesPlayed || 0}</Text><Text style={styles.statLabel}>matchs</Text></View>
                    </View>
                  </Card>
                ))}
              </>
            )}

            {searchType === 'teams' && (
              <>
                <Text style={styles.resultCount} accessibilityLiveRegion="polite">{filteredTeams.length} équipe(s)</Text>
                {filteredTeams.map(team => (
                  <Card key={team.id} style={styles.resultCard} onPress={() => router.push(`/team/${team.id}`)}>
                    <View style={styles.resultRow}>
                      <Avatar uri={team.logo} name={team.name} size="medium" />
                      <View style={styles.resultInfo}>
                        <Text style={styles.resultName}>{team.name}</Text>
                        <Text style={styles.resultSub}>{sportLabels[team.sport]} • {team.format}</Text>
                        <View style={styles.resultMeta}><MapPin size={12} color={Colors.text.muted} /><Text style={styles.metaText}>{team.city}</Text><Text style={styles.metaDot}>•</Text><Users size={12} color={Colors.text.muted} /><Text style={styles.metaText}>{team.members.length}/{team.maxMembers}</Text></View>
                      </View>
                      {team.isRecruiting && <View style={styles.recruitBadge}><Text style={styles.recruitText}>Recrute</Text></View>}
                    </View>
                  </Card>
                ))}
              </>
            )}

            {searchType === 'matches' && (
              <>
                <Text style={styles.resultCount} accessibilityLiveRegion="polite">{filteredMatches.length} match(s)</Text>
                {filteredMatches.map(match => (
                  <Card key={match.id} style={styles.resultCard} onPress={() => router.push(`/match/${match.id}`)}>
                    <View style={styles.resultRow}>
                      <View style={styles.matchIcon}><Swords size={24} color={Colors.primary.blue} /></View>
                      <View style={styles.resultInfo}>
                        <Text style={styles.resultName}>{sportLabels[match.sport]} • {match.format}</Text>
                        <Text style={styles.resultSub}>{match.venue.name}</Text>
                        <View style={styles.resultMeta}><Text style={styles.metaText}>{formatDate(match.dateTime)}</Text><Text style={styles.metaDot}>•</Text><Text style={styles.metaText}>{levelLabels[match.level]}</Text><Text style={styles.metaDot}>•</Text><Text style={styles.metaText}>{match.registeredPlayers.length}/{match.maxPlayers}</Text></View>
                      </View>
                      {match.needsPlayers && <View style={styles.openBadge}><Text style={styles.openText}>Ouvert</Text></View>}
                    </View>
                  </Card>
                ))}
              </>
            )}

            {((searchType === 'users' && filteredUsers.length === 0) || (searchType === 'teams' && filteredTeams.length === 0) || (searchType === 'matches' && filteredMatches.length === 0)) && (
              <View style={styles.emptyState} accessibilityRole="alert"><Search size={48} color={Colors.text.muted} /><Text style={styles.emptyTitle}>Aucun résultat</Text><Text style={styles.emptyText}>Essayez avec d&apos;autres mots-clés ou filtres</Text></View>
            )}
            <View style={styles.bottomSpacer} />
          </ScrollView>
        </SafeAreaView>

        <Modal visible={showFilters} animationType="slide" transparent>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Filtres avancés</Text>
                <TouchableOpacity onPress={() => setShowFilters(false)} accessibilityLabel="Fermer"><X size={24} color={Colors.text.primary} /></TouchableOpacity>
              </View>
              <ScrollView style={styles.modalScroll}>
                <Text style={styles.filterLabel}>Sport</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterChips}>
                  {SPORTS.map(sport => (
                    <TouchableOpacity key={sport} style={[styles.chip, filters.sport === sport && styles.chipActive]} onPress={() => setFilters(f => ({ ...f, sport: f.sport === sport ? '' : sport }))} accessibilityRole="button" accessibilityState={{ selected: filters.sport === sport }}>
                      <Text style={[styles.chipText, filters.sport === sport && styles.chipTextActive]}>{sportLabels[sport]}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                <Text style={styles.filterLabel}>Niveau</Text>
                <View style={styles.filterRow}>
                  {LEVELS.map(level => (
                    <TouchableOpacity key={level} style={[styles.chip, filters.level === level && styles.chipActive]} onPress={() => setFilters(f => ({ ...f, level: f.level === level ? '' : level }))}>
                      <Text style={[styles.chipText, filters.level === level && styles.chipTextActive]}>{levelLabels[level]}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={styles.filterLabel}>Ville</Text>
                <TextInput style={styles.filterInput} placeholder="Ex: Abidjan" placeholderTextColor={Colors.text.muted} value={filters.city} onChangeText={v => setFilters(f => ({ ...f, city: v }))} />

                <Text style={styles.filterLabel}>Distance max: {filters.maxDistance} km</Text>
                <View style={styles.distanceRow}>
                  {[10, 25, 50, 100].map(d => (
                    <TouchableOpacity key={d} style={[styles.chip, filters.maxDistance === d && styles.chipActive]} onPress={() => setFilters(f => ({ ...f, maxDistance: d }))}>
                      <Text style={[styles.chipText, filters.maxDistance === d && styles.chipTextActive]}>{d === 100 ? 'Tous' : `${d}km`}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {searchType === 'users' && (
                  <TouchableOpacity style={styles.toggleRow} onPress={() => setFilters(f => ({ ...f, verified: !f.verified }))}>
                    <Text style={styles.toggleLabel}>Uniquement vérifiés</Text>
                    <View style={[styles.toggle, filters.verified && styles.toggleActive]}>{filters.verified && <CheckCircle size={16} color="#FFF" />}</View>
                  </TouchableOpacity>
                )}

                {searchType === 'teams' && (
                  <TouchableOpacity style={styles.toggleRow} onPress={() => setFilters(f => ({ ...f, recruiting: !f.recruiting }))}>
                    <Text style={styles.toggleLabel}>Équipes qui recrutent</Text>
                    <View style={[styles.toggle, filters.recruiting && styles.toggleActive]}>{filters.recruiting && <CheckCircle size={16} color="#FFF" />}</View>
                  </TouchableOpacity>
                )}

                {searchType === 'matches' && (
                  <TouchableOpacity style={styles.toggleRow} onPress={() => setFilters(f => ({ ...f, needsPlayers: !f.needsPlayers }))}>
                    <Text style={styles.toggleLabel}>Matchs cherchant joueurs</Text>
                    <View style={[styles.toggle, filters.needsPlayers && styles.toggleActive]}>{filters.needsPlayers && <CheckCircle size={16} color="#FFF" />}</View>
                  </TouchableOpacity>
                )}
              </ScrollView>
              <View style={styles.modalFooter}>
                <Button title="Réinitialiser" onPress={resetFilters} variant="outline" style={styles.resetButton} />
                <Button title="Appliquer" onPress={() => setShowFilters(false)} variant="primary" style={styles.applyButton} />
              </View>
            </View>
          </View>
        </Modal>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16 },
  backButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.background.card, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { color: Colors.text.primary, fontSize: 18, fontWeight: '600' as const },
  filterButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.background.card, alignItems: 'center', justifyContent: 'center' },
  filterButtonActive: { backgroundColor: Colors.primary.blue },
  filterBadge: { position: 'absolute', top: -4, right: -4, width: 18, height: 18, borderRadius: 9, backgroundColor: Colors.primary.orange, alignItems: 'center', justifyContent: 'center' },
  filterBadgeText: { color: '#FFF', fontSize: 10, fontWeight: '700' as const },
  searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.background.card, marginHorizontal: 20, borderRadius: 12, paddingHorizontal: 16, height: 48, gap: 12, marginBottom: 16 },
  searchInput: { flex: 1, color: Colors.text.primary, fontSize: 15 },
  tabs: { flexDirection: 'row', paddingHorizontal: 20, gap: 8, marginBottom: 16 },
  tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 12, backgroundColor: Colors.background.card },
  tabActive: { backgroundColor: Colors.primary.blue },
  tabText: { color: Colors.text.secondary, fontSize: 13, fontWeight: '500' as const },
  tabTextActive: { color: '#FFFFFF' },
  scrollView: { flex: 1 },
  scrollContent: { paddingHorizontal: 20 },
  resultCount: { color: Colors.text.muted, fontSize: 13, marginBottom: 12 },
  resultCard: { marginBottom: 12 },
  resultRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  resultInfo: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  resultName: { color: Colors.text.primary, fontSize: 15, fontWeight: '600' as const },
  resultSub: { color: Colors.text.secondary, fontSize: 13, marginTop: 2 },
  resultMeta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  metaText: { color: Colors.text.muted, fontSize: 12 },
  metaDot: { color: Colors.text.muted, fontSize: 12 },
  statBadge: { alignItems: 'center', backgroundColor: Colors.background.cardLight, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
  statValue: { color: Colors.text.primary, fontSize: 16, fontWeight: '700' as const },
  statLabel: { color: Colors.text.muted, fontSize: 10 },
  recruitBadge: { backgroundColor: 'rgba(16, 185, 129, 0.2)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  recruitText: { color: Colors.status.success, fontSize: 11, fontWeight: '500' as const },
  matchIcon: { width: 48, height: 48, borderRadius: 12, backgroundColor: `${Colors.primary.blue}20`, alignItems: 'center', justifyContent: 'center' },
  openBadge: { backgroundColor: `${Colors.status.success}20`, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  openText: { color: Colors.status.success, fontSize: 11, fontWeight: '500' as const },
  emptyState: { alignItems: 'center', paddingVertical: 60 },
  emptyTitle: { color: Colors.text.primary, fontSize: 18, fontWeight: '600' as const, marginTop: 16 },
  emptyText: { color: Colors.text.muted, fontSize: 14, marginTop: 8 },
  bottomSpacer: { height: 40 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: Colors.background.dark, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '80%' },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, borderBottomWidth: 1, borderBottomColor: Colors.border.light },
  modalTitle: { color: Colors.text.primary, fontSize: 18, fontWeight: '600' as const },
  modalScroll: { padding: 20 },
  filterLabel: { color: Colors.text.secondary, fontSize: 13, fontWeight: '500' as const, marginBottom: 12, marginTop: 16 },
  filterChips: { flexDirection: 'row' },
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: Colors.background.card, marginRight: 8 },
  chipActive: { backgroundColor: Colors.primary.blue },
  chipText: { color: Colors.text.secondary, fontSize: 13 },
  chipTextActive: { color: '#FFF' },
  filterInput: { backgroundColor: Colors.background.card, borderRadius: 12, padding: 14, color: Colors.text.primary, fontSize: 15 },
  distanceRow: { flexDirection: 'row', gap: 8 },
  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 16, borderTopWidth: 1, borderTopColor: Colors.border.light, marginTop: 16 },
  toggleLabel: { color: Colors.text.primary, fontSize: 15 },
  toggle: { width: 28, height: 28, borderRadius: 14, backgroundColor: Colors.background.card, alignItems: 'center', justifyContent: 'center' },
  toggleActive: { backgroundColor: Colors.primary.blue },
  modalFooter: { flexDirection: 'row', padding: 20, gap: 12, borderTopWidth: 1, borderTopColor: Colors.border.light },
  resetButton: { flex: 1 },
  applyButton: { flex: 2 },
});
