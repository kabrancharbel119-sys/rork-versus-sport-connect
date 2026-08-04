import React, { useState, useMemo, useCallback, useEffect, useDeferredValue } from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity, TextInput, Modal, FlatList, ActivityIndicator, RefreshControl, Platform } from 'react-native';
import { useRouter, Stack, useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { safeBack } from '@/lib/navigation';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Search, Users, Shield, Swords, CheckCircle, X, Sliders, Flame, Clock, ChevronRight } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { useAuth } from '@/contexts/AuthContext';
import { useI18n } from '@/contexts/I18nContext';
import { useUsers } from '@/contexts/UsersContext';
import { useTeams } from '@/contexts/TeamsContext';
import { useMatches } from '@/contexts/MatchesContext';
import { useLocation } from '@/contexts/LocationContext';
import { usersApi } from '@/lib/api/users';
import { Avatar } from '@/components/Avatar';
import { Button } from '@/components/Button';
import { sportLabels, levelLabels } from '@/mocks/data';
import { Sport, SkillLevel } from '@/types';

type SearchType = 'users' | 'teams' | 'matches';

const SPORTS: Sport[] = ['football', 'basketball', 'volleyball', 'tennis', 'handball', 'rugby', 'futsal', 'padel'];
const LEVELS: SkillLevel[] = ['beginner', 'intermediate', 'advanced', 'expert'];

const sportEmojis: Record<string, string> = {
  football: '⚽', basketball: '🏀', volleyball: '🏐', tennis: '🎾', padel: '🏓', handball: '🤾', rugby: '🏉', futsal: '⚽',
};

const TABS: { key: SearchType; label: string; icon: typeof Users }[] = [
  { key: 'users', label: 'Joueurs', icon: Users },
  { key: 'teams', label: 'Équipes', icon: Shield },
  { key: 'matches', label: 'Matchs', icon: Swords },
];

export default function SearchScreen() {
  const router = useRouter();
  const { t, locale } = useI18n();
  const { user: currentUser } = useAuth();
  const { users } = useUsers();
  const { teams } = useTeams();
  const { matches } = useMatches();
  const { location } = useLocation();
  const searchParams = useLocalSearchParams<{ type?: string }>();
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [searchType, setSearchType] = useState<SearchType>(
    searchParams.type === 'teams' ? 'teams' : searchParams.type === 'matches' ? 'matches' : 'users'
  );
  const [showFilters, setShowFilters] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [quickSport, setQuickSport] = useState<string>('');
  const [filters, setFilters] = useState({ sport: '' as string, level: '' as string, city: '', verified: false, recruiting: false, needsPlayers: false, maxDistance: 50 });

  useEffect(() => {
    const handle = setTimeout(() => setDebouncedQuery(query.trim()), 300);
    return () => clearTimeout(handle);
  }, [query]);

  const getDistance = useCallback((lat1: number, lng1: number, lat2: number, lng2: number) => {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }, []);

  const hasUserSearch = !!(debouncedQuery || quickSport || filters.sport || filters.level || filters.city || filters.verified);
  const userSearchQuery = useQuery({
    queryKey: ['userSearch', debouncedQuery, quickSport || filters.sport, filters.level, filters.city, filters.verified],
    queryFn: () => usersApi.search({
      query: debouncedQuery || undefined,
      sport: quickSport || filters.sport || undefined,
      level: filters.level || undefined,
      city: filters.city || undefined,
      isVerified: filters.verified || undefined,
      limit: 100,
    }),
    enabled: hasUserSearch,
    staleTime: 30 * 1000,
  });

  const activeFiltersCount = Object.values(filters).filter(v => v && v !== 50).length + (quickSport ? 1 : 0);
  const resetFilters = () => { setFilters({ sport: '', level: '', city: '', verified: false, recruiting: false, needsPlayers: false, maxDistance: 50 }); setQuickSport(''); };

  const formatShortDate = (date: Date | string) => {
    const d = new Date(date);
    return d.toLocaleDateString(locale === 'en' ? 'en-US' : 'fr-FR', { day: 'numeric', month: 'short' });
  };

  // ── Discover data (no query) ──
  const discoverUsers = useMemo(() => {
    let r = [...users].filter(u => u.isProfileVisible !== false);
    if (quickSport) r = r.filter(u => u.sports?.some(s => s.sport === quickSport));
    return r.sort((a, b) => (b.stats?.matchesPlayed || 0) - (a.stats?.matchesPlayed || 0)).slice(0, 5);
  }, [users, quickSport]);
  const discoverTeams = useMemo(() => {
    let r = [...teams];
    if (quickSport) r = r.filter(t => t.sport === quickSport);
    return r.sort((a, b) => b.reputation - a.reputation).slice(0, 5);
  }, [teams, quickSport]);
  const discoverMatches = useMemo(() => {
    let r = matches.filter(m => m.status === 'open' || m.status === 'confirmed');
    if (quickSport) r = r.filter(m => m.sport === quickSport);
    return r.sort((a, b) => new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime()).slice(0, 5);
  }, [matches, quickSport]);

  const hasNoQuery = !query.trim() && !quickSport && !filters.sport && !filters.level && !filters.city && !filters.verified && !filters.recruiting && !filters.needsPlayers;

  // ── Filtered results ──
  const filteredUsersFinal = useDeferredValue(useMemo(() => {
    if (!hasUserSearch) {
      let r = users.filter(u => u.isProfileVisible !== false || u.id === currentUser?.id);
      if (quickSport) r = r.filter(u => u.sports?.some(s => s.sport === quickSport));
      return r;
    }
    let r = userSearchQuery.data ?? [];
    if (location && filters.maxDistance < 100) {
      r = r.filter(u => !u.location || getDistance(location.latitude, location.longitude, u.location.latitude, u.location.longitude) <= filters.maxDistance);
    }
    return r;
  }, [hasUserSearch, userSearchQuery.data, users, currentUser?.id, location, filters.maxDistance, getDistance, quickSport]));

  const filteredTeamsFinal = useDeferredValue(useMemo(() => {
    let r = teams;
    const q = query.toLowerCase();
    if (q) r = r.filter(t => t.name.toLowerCase().includes(q) || t.city?.toLowerCase().includes(q) || sportLabels[t.sport]?.toLowerCase().includes(q));
    const sport = quickSport || filters.sport;
    if (sport) r = r.filter(t => t.sport === sport);
    if (filters.level) r = r.filter(t => t.level === filters.level);
    if (filters.city) r = r.filter(t => t.city?.toLowerCase().includes(filters.city.toLowerCase()));
    if (filters.recruiting) r = r.filter(t => t.isRecruiting && t.members.length < t.maxMembers);
    if (location && filters.maxDistance < 100) r = r.filter(t => !t.location || getDistance(location.latitude, location.longitude, t.location.latitude, t.location.longitude) <= filters.maxDistance);
    return r;
  }, [teams, query, quickSport, filters, location, getDistance]));

  const filteredMatchesFinal = useDeferredValue(useMemo(() => {
    let r = matches.filter(m => m.status === 'open' || m.status === 'confirmed');
    const q = query.toLowerCase();
    if (q) r = r.filter(m => sportLabels[m.sport]?.toLowerCase().includes(q) || m.venue.name.toLowerCase().includes(q) || m.venue.city.toLowerCase().includes(q));
    const sport = quickSport || filters.sport;
    if (sport) r = r.filter(m => m.sport === sport);
    if (filters.level) r = r.filter(m => m.level === filters.level);
    if (filters.city) r = r.filter(m => m.venue.city.toLowerCase().includes(filters.city.toLowerCase()));
    if (filters.needsPlayers) r = r.filter(m => m.needsPlayers && m.registeredPlayers.length < m.maxPlayers);
    if (location && filters.maxDistance < 100) r = r.filter(m => !m.location || getDistance(location.latitude, location.longitude, m.location.latitude, m.location.longitude) <= filters.maxDistance);
    return r.sort((a, b) => new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime());
  }, [matches, query, quickSport, filters, location, getDistance]));

  const tabCounts = { users: filteredUsersFinal.length, teams: filteredTeamsFinal.length, matches: filteredMatchesFinal.length };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      if (hasUserSearch) await userSearchQuery.refetch();
    } finally {
      setRefreshing(false);
    }
  }, [hasUserSearch, userSearchQuery]);

  // ════ Row renderers — flat list items, no cards ════

  const renderUserRow = (user: typeof users[0]) => (
    <TouchableOpacity style={s.row} activeOpacity={0.6} onPress={() => router.push(`/user/${user.id}`)}>
      <Avatar uri={user.avatar} name={user.fullName} size="small" />
      <View style={s.rowInfo}>
        <View style={s.rowTitleRow}>
          <Text style={s.rowTitle} numberOfLines={1}>{user.fullName}</Text>
          {user.isVerified && <CheckCircle size={11} color={Colors.status.info} strokeWidth={2.5} />}
        </View>
        <Text style={s.rowSub} numberOfLines={1}>
          {user.sports?.slice(0, 2).map(sp => `${sportEmojis[sp.sport]}${sportLabels[sp.sport]}`).join(' · ') || `@${user.username}`}
          {user.city ? ` · ${user.city}` : ''}
        </Text>
      </View>
      <View style={s.rowMetaWrap}>
        <Text style={s.rowMetaVal}>{user.stats?.matchesPlayed || 0}</Text>
        <Text style={s.rowMetaLbl}>matchs</Text>
      </View>
    </TouchableOpacity>
  );

  const renderTeamRow = (team: typeof teams[0]) => (
    <TouchableOpacity style={s.row} activeOpacity={0.6} onPress={() => router.push(`/team/${team.id}`)}>
      <Avatar uri={team.logo} name={team.name} size="small" />
      <View style={s.rowInfo}>
        <View style={s.rowTitleRow}>
          <Text style={s.rowTitle} numberOfLines={1}>{team.name}</Text>
          {team.isRecruiting && team.members.length < team.maxMembers && (
            <View style={s.recruitTag}><Flame size={8} color="#FFF" /><Text style={s.recruitTagText}>Recrute</Text></View>
          )}
        </View>
        <Text style={s.rowSub} numberOfLines={1}>
          {sportEmojis[team.sport]} {sportLabels[team.sport]} · {team.format} · {team.members.length}/{team.maxMembers}
          {team.city ? ` · ${team.city}` : ''}
        </Text>
      </View>
      <View style={s.rowMetaWrap}>
        <Text style={s.rowMetaVal}>{team.reputation.toFixed(1)}</Text>
        <Text style={s.rowMetaLbl}>rep</Text>
      </View>
    </TouchableOpacity>
  );

  const renderMatchRow = (match: typeof matches[0]) => {
    const time = new Date(match.dateTime).toLocaleTimeString(locale === 'en' ? 'en-US' : 'fr-FR', { hour: '2-digit', minute: '2-digit' });
    const isOpen = match.needsPlayers && match.registeredPlayers.length < match.maxPlayers;
    return (
      <TouchableOpacity style={s.row} activeOpacity={0.6} onPress={() => router.push(`/match/${match.id}`)}>
        <View style={s.dateBlock}>
          <Text style={s.dateNum}>{new Date(match.dateTime).getDate()}</Text>
          <Text style={s.dateMon}>{formatShortDate(match.dateTime).split(' ')[1]}</Text>
        </View>
        <View style={s.rowInfo}>
          <View style={s.rowTitleRow}>
            <Text style={s.rowTitle} numberOfLines={1}>{sportEmojis[match.sport]} {sportLabels[match.sport]} · {match.format}</Text>
            {isOpen && <View style={s.openDot} />}
          </View>
          <Text style={s.rowSub} numberOfLines={1}>
            <Clock size={9} color={Colors.text.muted} /> {time} · {match.venue.name}
          </Text>
        </View>
        <View style={s.rowMetaWrap}>
          <Text style={s.rowMetaVal}>{match.registeredPlayers.length}/{match.maxPlayers}</Text>
          <Text style={s.rowMetaLbl}>joueurs</Text>
        </View>
      </TouchableOpacity>
    );
  };

  // ════ FlatList data ════
  type FlatItem =
    | { kind: 'section'; title: string; sub: string }
    | { kind: 'user'; id: string }
    | { kind: 'team'; id: string }
    | { kind: 'match'; id: string }
    | { kind: 'empty' }
    | { kind: 'loading' }
    | { kind: 'spacer' };

  const flatData: FlatItem[] = [];
  if (hasNoQuery) {
    // Show all results without section header
    if (searchType === 'users') {
      filteredUsersFinal.slice(0, 20).forEach(u => flatData.push({ kind: 'user', id: u.id }));
    } else if (searchType === 'teams') {
      filteredTeamsFinal.slice(0, 20).forEach(t => flatData.push({ kind: 'team', id: t.id }));
    } else {
      filteredMatchesFinal.slice(0, 20).forEach(m => flatData.push({ kind: 'match', id: m.id }));
    }
    flatData.push({ kind: 'spacer' });
  } else {
    if (searchType === 'users') {
      if (userSearchQuery.isFetching && hasUserSearch) {
        flatData.push({ kind: 'loading' });
      } else {
        filteredUsersFinal.forEach(u => flatData.push({ kind: 'user', id: u.id }));
        if (filteredUsersFinal.length === 0) flatData.push({ kind: 'empty' });
      }
    } else if (searchType === 'teams') {
      filteredTeamsFinal.forEach(t => flatData.push({ kind: 'team', id: t.id }));
      if (filteredTeamsFinal.length === 0) flatData.push({ kind: 'empty' });
    } else {
      filteredMatchesFinal.forEach(m => flatData.push({ kind: 'match', id: m.id }));
      if (filteredMatchesFinal.length === 0) flatData.push({ kind: 'empty' });
    }
    flatData.push({ kind: 'spacer' });
  }

  const usersMap = useMemo(() => new Map(filteredUsersFinal.map(u => [u.id, u])), [filteredUsersFinal]);
  const teamsMap = useMemo(() => new Map(filteredTeamsFinal.map(t => [t.id, t])), [filteredTeamsFinal]);
  const matchesMap = useMemo(() => new Map(filteredMatchesFinal.map(m => [m.id, m])), [filteredMatchesFinal]);

  const renderFlatItem = ({ item, index }: { item: FlatItem; index: number }) => {
    if (item.kind === 'spacer') return <View style={{ height: 60 }} />;
    if (item.kind === 'loading') return (
      <View style={s.loadingWrap}>
        <ActivityIndicator size="large" color={Colors.primary.orange} />
        <Text style={s.loadingText}>Recherche...</Text>
      </View>
    );
    if (item.kind === 'empty') return (
      <View style={s.emptyWrap}>
        <Search size={40} color={Colors.text.muted} strokeWidth={1.5} />
        <Text style={s.emptyTitle}>{t('search.noResultsTitle')}</Text>
        <Text style={s.emptyText}>{t('search.noResultsText')}</Text>
        {(query.trim() || activeFiltersCount > 0) && (
          <TouchableOpacity style={s.resetLink} onPress={() => { setQuery(''); resetFilters(); }}>
            <Text style={s.resetLinkText}>Réinitialiser</Text>
          </TouchableOpacity>
        )}
      </View>
    );
    if (item.kind === 'section') return (
      <View style={s.sectionHeader}>
        <View style={s.sectionAccent} />
        <View style={s.sectionTexts}>
          <Text style={s.sectionTitle}>{item.title}</Text>
          <Text style={s.sectionSub}>{item.sub}</Text>
        </View>
        <ChevronRight size={16} color={Colors.text.muted} />
      </View>
    );
    const showDivider = index > 0;
    if (item.kind === 'user') { const u = usersMap.get(item.id); return u ? <View>{showDivider && <View style={s.divider} />}{renderUserRow(u)}</View> : null; }
    if (item.kind === 'team') { const tm = teamsMap.get(item.id); return tm ? <View>{showDivider && <View style={s.divider} />}{renderTeamRow(tm)}</View> : null; }
    if (item.kind === 'match') { const m = matchesMap.get(item.id); return m ? <View>{showDivider && <View style={s.divider} />}{renderMatchRow(m)}</View> : null; }
    return null;
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={s.container}>
        <StatusBar style="light" translucent backgroundColor="transparent" />
        <SafeAreaView style={s.safeArea}>
          {/* ════ Top bar ════ */}
          <View style={s.topBar}>
            <TouchableOpacity onPress={() => safeBack(router, '/(tabs)/(home)')} accessibilityLabel={t('common.back')} accessibilityRole="button">
              <ArrowLeft size={22} color={Colors.text.primary} />
            </TouchableOpacity>
            <TouchableOpacity style={[s.filterCircle, activeFiltersCount > 0 && s.filterCircleActive]} onPress={() => setShowFilters(true)}>
              <Sliders size={16} color={activeFiltersCount > 0 ? '#FFF' : Colors.text.muted} />
              {activeFiltersCount > 0 && <View style={s.filterDot} />}
            </TouchableOpacity>
          </View>

          {/* ════ Search input — pill style ════ */}
          <View style={s.searchWrap}>
            <Search size={16} color={Colors.text.muted} />
            <TextInput
              style={s.searchInput}
              placeholder={t('search.searchPlaceholder')}
              placeholderTextColor={Colors.text.muted}
              value={query}
              onChangeText={setQuery}
              autoFocus
              returnKeyType="search"
              accessibilityLabel={t('search.searchField')}
            />
            {query.length > 0 && (
              <TouchableOpacity onPress={() => setQuery('')} accessibilityLabel={t('search.clearSearch')} style={s.clearBtn}>
                <X size={14} color={Colors.text.muted} />
              </TouchableOpacity>
            )}
          </View>

          {/* ════ Active filter chips ════ */}
          {activeFiltersCount > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.activeChips}>
              {quickSport && (
                <TouchableOpacity style={s.activeChip} onPress={() => setQuickSport('')}>
                  <Text style={s.activeChipText}>{sportEmojis[quickSport]} {sportLabels[quickSport]}</Text>
                  <X size={10} color="#FFF" />
                </TouchableOpacity>
              )}
              {filters.sport && (
                <TouchableOpacity style={s.activeChip} onPress={() => setFilters(f => ({ ...f, sport: '' }))}>
                  <Text style={s.activeChipText}>{sportLabels[filters.sport as Sport]}</Text>
                  <X size={10} color="#FFF" />
                </TouchableOpacity>
              )}
              {filters.level && (
                <TouchableOpacity style={s.activeChip} onPress={() => setFilters(f => ({ ...f, level: '' }))}>
                  <Text style={s.activeChipText}>{levelLabels[filters.level as SkillLevel]}</Text>
                  <X size={10} color="#FFF" />
                </TouchableOpacity>
              )}
              {filters.city && (
                <TouchableOpacity style={s.activeChip} onPress={() => setFilters(f => ({ ...f, city: '' }))}>
                  <Text style={s.activeChipText}>{filters.city}</Text>
                  <X size={10} color="#FFF" />
                </TouchableOpacity>
              )}
              {filters.verified && (
                <TouchableOpacity style={s.activeChip} onPress={() => setFilters(f => ({ ...f, verified: false }))}>
                  <Text style={s.activeChipText}>Vérifié</Text>
                  <X size={10} color="#FFF" />
                </TouchableOpacity>
              )}
              {filters.recruiting && (
                <TouchableOpacity style={s.activeChip} onPress={() => setFilters(f => ({ ...f, recruiting: false }))}>
                  <Text style={s.activeChipText}>Recrute</Text>
                  <X size={10} color="#FFF" />
                </TouchableOpacity>
              )}
              {filters.needsPlayers && (
                <TouchableOpacity style={s.activeChip} onPress={() => setFilters(f => ({ ...f, needsPlayers: false }))}>
                  <Text style={s.activeChipText}>Places dispo</Text>
                  <X size={10} color="#FFF" />
                </TouchableOpacity>
              )}
              <TouchableOpacity style={s.clearAllChip} onPress={resetFilters}>
                <Text style={s.clearAllText}>Tout effacer</Text>
              </TouchableOpacity>
            </ScrollView>
          )}

          {/* ════ Segmented tabs ════ */}
          <View style={s.tabsContainer}>
            {TABS.map(({ key, label, icon: Icon }) => {
              const active = searchType === key;
              return (
                <TouchableOpacity
                  key={key}
                  style={[s.segTab, active && s.segTabActive]}
                  onPress={() => setSearchType(key)}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: active }}
                >
                  <Icon size={13} color={active ? '#FFF' : Colors.text.muted} strokeWidth={2.5} />
                  <Text style={[s.segTabText, active && s.segTabTextActive]}>{label}</Text>
                  <View style={[s.segTabCount, active && s.segTabCountActive]}>
                    <Text style={[s.segTabCountText, active && s.segTabCountTextActive]}>{tabCounts[key]}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* ════ Results ════ */}
          <FlatList
            style={s.list}
            contentContainerStyle={s.listContent}
            showsVerticalScrollIndicator={false}
            data={flatData}
            keyExtractor={(item, index) => item.kind + (('id' in item && item.id) ? item.id : index)}
            renderItem={renderFlatItem}
            initialNumToRender={8}
            maxToRenderPerBatch={8}
            windowSize={5}
            removeClippedSubviews={true}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary.orange} />}
          />
        </SafeAreaView>

        {/* ════ Filter modal ════ */}
        <Modal visible={showFilters} animationType="slide" transparent>
          <View style={s.modalOverlay}>
            <View style={s.modalContent}>
              <View style={s.modalHeader}>
                <Text style={s.modalTitle}>{t('search.advancedFilters')}</Text>
                <TouchableOpacity onPress={() => setShowFilters(false)} accessibilityLabel={t('common.close')}>
                  <X size={22} color={Colors.text.primary} />
                </TouchableOpacity>
              </View>
              <ScrollView style={s.modalScroll}>
                <Text style={s.filterLabel}>{t('search.sport')}</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {SPORTS.map(sport => (
                    <TouchableOpacity key={sport} style={[s.modalChip, filters.sport === sport && s.modalChipActive]} onPress={() => setFilters(f => ({ ...f, sport: f.sport === sport ? '' : sport }))}>
                      <Text style={[s.modalChipText, filters.sport === sport && s.modalChipTextActive]}>{sportLabels[sport]}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                <Text style={s.filterLabel}>{t('search.level')}</Text>
                <View style={s.modalChipRow}>
                  {LEVELS.map(level => (
                    <TouchableOpacity key={level} style={[s.modalChip, filters.level === level && s.modalChipActive]} onPress={() => setFilters(f => ({ ...f, level: f.level === level ? '' : level }))}>
                      <Text style={[s.modalChipText, filters.level === level && s.modalChipTextActive]}>{levelLabels[level]}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={s.filterLabel}>{t('search.city')}</Text>
                <TextInput style={s.filterInput} placeholder={t('search.cityPlaceholder')} placeholderTextColor={Colors.text.muted} value={filters.city} onChangeText={v => setFilters(f => ({ ...f, city: v }))} />

                <Text style={s.filterLabel}>{t('search.maxDistance', { distance: filters.maxDistance })}</Text>
                <View style={s.modalChipRow}>
                  {[10, 25, 50, 100].map(d => (
                    <TouchableOpacity key={d} style={[s.modalChip, filters.maxDistance === d && s.modalChipActive]} onPress={() => setFilters(f => ({ ...f, maxDistance: d }))}>
                      <Text style={[s.modalChipText, filters.maxDistance === d && s.modalChipTextActive]}>{d === 100 ? t('search.allDistances') : `${d}km`}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {searchType === 'users' && (
                  <TouchableOpacity style={s.toggleRow} onPress={() => setFilters(f => ({ ...f, verified: !f.verified }))}>
                    <Text style={s.toggleLabel}>{t('search.verifiedOnly')}</Text>
                    <View style={[s.toggle, filters.verified && s.toggleActive]}>{filters.verified && <CheckCircle size={16} color="#FFF" />}</View>
                  </TouchableOpacity>
                )}
                {searchType === 'teams' && (
                  <TouchableOpacity style={s.toggleRow} onPress={() => setFilters(f => ({ ...f, recruiting: !f.recruiting }))}>
                    <Text style={s.toggleLabel}>{t('search.recruitingTeams')}</Text>
                    <View style={[s.toggle, filters.recruiting && s.toggleActive]}>{filters.recruiting && <CheckCircle size={16} color="#FFF" />}</View>
                  </TouchableOpacity>
                )}
                {searchType === 'matches' && (
                  <TouchableOpacity style={s.toggleRow} onPress={() => setFilters(f => ({ ...f, needsPlayers: !f.needsPlayers }))}>
                    <Text style={s.toggleLabel}>{t('search.needsPlayers')}</Text>
                    <View style={[s.toggle, filters.needsPlayers && s.toggleActive]}>{filters.needsPlayers && <CheckCircle size={16} color="#FFF" />}</View>
                  </TouchableOpacity>
                )}
              </ScrollView>
              <View style={s.modalFooter}>
                <Button title={t('search.reset')} onPress={resetFilters} variant="outline" style={s.resetButton} />
                <Button title={t('search.apply')} onPress={() => setShowFilters(false)} variant="primary" style={s.applyButton} />
              </View>
            </View>
          </View>
        </Modal>
      </View>
    </>
  );
}

/* ════ Styles ════ */
const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0d111d' },
  safeArea: { flex: 1, paddingTop: Platform.OS === 'ios' ? 40 : 25 },

  // Top bar — minimal, just back + filter
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 4 },
  filterCircle: { width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.background.card, alignItems: 'center', justifyContent: 'center' },
  filterCircleActive: { backgroundColor: Colors.primary.orange },
  filterDot: { position: 'absolute', top: 5, right: 5, width: 6, height: 6, borderRadius: 3, backgroundColor: '#FFF' },

  // Search input — pill style with bg
  searchWrap: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginBottom: 6, gap: 8, backgroundColor: Colors.background.card, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 8 },
  searchInput: { flex: 1, color: Colors.text.primary, fontSize: 14, padding: 0 },
  clearBtn: { width: 20, height: 20, borderRadius: 10, backgroundColor: Colors.background.elevated, alignItems: 'center', justifyContent: 'center' },

  // Active filter chips
  activeChips: { paddingHorizontal: 16, gap: 6, marginBottom: 6 },
  activeChip: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.primary.orange, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  activeChipText: { color: '#FFF', fontSize: 10, fontWeight: '600' as const },
  clearAllChip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, backgroundColor: Colors.background.card },
  clearAllText: { color: Colors.text.muted, fontSize: 10, fontWeight: '600' as const },

  // Segmented tabs
  tabsContainer: { flexDirection: 'row', marginHorizontal: 16, marginBottom: 6, gap: 6, backgroundColor: Colors.background.card, borderRadius: 12, padding: 3 },
  segTab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 7, borderRadius: 10 },
  segTabActive: { backgroundColor: Colors.primary.orange },
  segTabText: { color: Colors.text.muted, fontSize: 12, fontWeight: '500' as const },
  segTabTextActive: { color: '#FFF', fontWeight: '700' as const },
  segTabCount: { backgroundColor: Colors.background.elevated, borderRadius: 6, paddingHorizontal: 5, paddingVertical: 1 },
  segTabCountActive: { backgroundColor: 'rgba(255,255,255,0.25)' },
  segTabCountText: { color: Colors.text.muted, fontSize: 9, fontWeight: '700' as const },
  segTabCountTextActive: { color: '#FFF' },

  // List
  list: { flex: 1 },
  listContent: { paddingHorizontal: 20, paddingBottom: 100 },

  // Flat rows — compact with subtle bg
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6, paddingHorizontal: 10, borderRadius: 10, backgroundColor: Colors.background.card },
  rowInfo: { flex: 1, minWidth: 0 },
  rowTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  rowTitle: { color: Colors.text.primary, fontSize: 13, fontWeight: '600' as const, flexShrink: 1 },
  rowSub: { color: Colors.text.muted, fontSize: 11, marginTop: 1 },
  rowMetaWrap: { alignItems: 'center', backgroundColor: Colors.background.elevated, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  rowMetaVal: { color: Colors.text.primary, fontSize: 12, fontWeight: '700' as const },
  rowMetaLbl: { color: Colors.text.muted, fontSize: 8, fontWeight: '500' as const },

  // Date block for matches — smaller
  dateBlock: { width: 28, height: 32, borderRadius: 8, backgroundColor: Colors.background.card, alignItems: 'center', justifyContent: 'center' },
  dateNum: { color: Colors.text.primary, fontSize: 13, fontWeight: '800' as const },
  dateMon: { color: Colors.text.muted, fontSize: 7, fontWeight: '700' as const, textTransform: 'uppercase' as const, marginTop: 1 },

  // Recruit tag
  recruitTag: { flexDirection: 'row', alignItems: 'center', gap: 2, backgroundColor: Colors.status.success, paddingHorizontal: 5, paddingVertical: 1, borderRadius: 6 },
  recruitTagText: { color: '#FFF', fontSize: 9, fontWeight: '700' as const },

  // Open dot
  openDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.status.success },

  // Divider — gap between rows
  divider: { height: 4 },

  // Section header
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingTop: 10, paddingBottom: 6 },
  sectionAccent: { width: 3, height: 16, borderRadius: 2, backgroundColor: Colors.primary.orange },
  sectionTexts: { flex: 1 },
  sectionTitle: { color: Colors.text.primary, fontSize: 14, fontWeight: '700' as const, letterSpacing: -0.2 },
  sectionSub: { color: Colors.text.muted, fontSize: 10, marginTop: 1 },

  // Loading
  loadingWrap: { paddingVertical: 60, alignItems: 'center' },
  loadingText: { color: Colors.text.muted, fontSize: 14, marginTop: 10 },

  // Empty
  emptyWrap: { alignItems: 'center', paddingVertical: 60, gap: 8, paddingHorizontal: 24 },
  emptyTitle: { color: Colors.text.primary, fontSize: 17, fontWeight: '700' as const },
  emptyText: { color: Colors.text.muted, fontSize: 13, textAlign: 'center' as const },
  resetLink: { marginTop: 8, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 12, backgroundColor: Colors.background.card },
  resetLinkText: { color: Colors.primary.orange, fontSize: 14, fontWeight: '600' as const },

  // Filter modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: Colors.background.dark, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '80%' },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, borderBottomWidth: 1, borderBottomColor: Colors.border.light },
  modalTitle: { color: Colors.text.primary, fontSize: 18, fontWeight: '700' as const },
  modalScroll: { padding: 20 },
  filterLabel: { color: Colors.text.secondary, fontSize: 13, fontWeight: '600' as const, marginBottom: 12, marginTop: 16 },
  modalChipRow: { flexDirection: 'row', flexWrap: 'wrap' as const, gap: 8 },
  modalChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: Colors.background.card, marginRight: 8 },
  modalChipActive: { backgroundColor: Colors.primary.orange },
  modalChipText: { color: Colors.text.secondary, fontSize: 13 },
  modalChipTextActive: { color: '#FFF' },
  filterInput: { backgroundColor: Colors.background.card, borderRadius: 12, padding: 14, color: Colors.text.primary, fontSize: 15 },
  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 16, borderTopWidth: 1, borderTopColor: Colors.border.light, marginTop: 16 },
  toggleLabel: { color: Colors.text.primary, fontSize: 15 },
  toggle: { width: 28, height: 28, borderRadius: 14, backgroundColor: Colors.background.card, alignItems: 'center', justifyContent: 'center' },
  toggleActive: { backgroundColor: Colors.primary.orange },
  modalFooter: { flexDirection: 'row', padding: 20, gap: 12, borderTopWidth: 1, borderTopColor: Colors.border.light },
  resetButton: { flex: 1 },
  applyButton: { flex: 2 },
});
