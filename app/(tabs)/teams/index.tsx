import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity, RefreshControl, Modal, Alert, TextInput, ActivityIndicator, Platform, Dimensions, FlatList } from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { Plus, Users, Trophy, MapPin, Star, Filter, X, Search, ChevronRight, Compass, UserPlus, Heart, Camera, Crown, Megaphone, Flame, Zap, Shield } from 'lucide-react-native';
import { Colors, SPACING, CARD_RADIUS, CARD_INNER_PAD, OUTER_PAD, CARD_GAP, cardGlow, softShadow } from '@/constants/colors';
import { useAuth } from '@/contexts/AuthContext';
import { useTeams } from '@/contexts/TeamsContext';
import { useLocation } from '@/contexts/LocationContext';

import { Avatar } from '@/components/Avatar';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { NetworkError } from '@/components/NetworkError';
import { sportLabels, levelLabels, ambianceLabels, ALL_SPORTS } from '@/mocks/data';
import { Sport, SkillLevel, PlayStyle } from '@/types';

const SCREEN_WIDTH = Dimensions.get('window').width;
const RECRUIT_CARD_W = SCREEN_WIDTH * 0.72;

export default function TeamsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { getUserTeams, getAllTeams, getPendingRequests, getRecruitingTeams, refetchTeams, followTeam, unfollowTeam, isLoading, isError } = useTeams();
  const { location, isWithinRadius } = useLocation();
  const [refreshing, setRefreshing] = useState(false);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [sportFilter, setSportFilter] = useState<Sport | 'all'>('all');
  const [levelFilter, setLevelFilter] = useState<SkillLevel | 'all'>('all');
  const [ambianceFilter, setAmbianceFilter] = useState<PlayStyle | 'all'>('all');
  const [recruitingFilter, setRecruitingFilter] = useState<'all' | 'open' | 'closed'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [followingTeamId, setFollowingTeamId] = useState<string | null>(null);
  const searchInputRef = useRef<TextInput>(null);

  const myTeam = user ? (getUserTeams(user.id) ?? [])[0] : null;
  const allTeamsForDiscover = getAllTeams() ?? [];

  useFocusEffect(useCallback(() => {
    refetchTeams();
  }, [refetchTeams]));

  const teamsInCity = useMemo(() => {
    // Par défaut, on montre TOUTES les équipes
    // Le filtre ville sera appliqué seulement si l'utilisateur l'active via le bouton filtre
    const source = allTeamsForDiscover ?? [];
    let list = source.filter(team => {
      // Filtre ville : seulement si activé manuellement (via locationFilter state)
      // Pour l'instant, on ne filtre PAS automatiquement par ville
      if (sportFilter !== 'all' && team.sport !== sportFilter) return false;
      if (levelFilter !== 'all' && team.level !== levelFilter) return false;
      if (ambianceFilter !== 'all' && team.ambiance !== ambianceFilter) return false;
      if (recruitingFilter === 'open' && (!team.isRecruiting || (team.members ?? []).length >= team.maxMembers)) return false;
      if (recruitingFilter === 'closed' && team.isRecruiting && (team.members ?? []).length < team.maxMembers) return false;
      if (myTeam && team.id === myTeam.id) return false;
      return true;
    });
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      list = list.filter(t =>
        t.name?.toLowerCase().includes(q) ||
        (t.city && t.city.toLowerCase().includes(q)) ||
        (t.description && t.description.toLowerCase().includes(q))
      );
    }
    return list;
  }, [allTeamsForDiscover, sportFilter, levelFilter, ambianceFilter, recruitingFilter, searchQuery, myTeam]);

  useEffect(() => {
    if (__DEV__) {
      console.log('[Teams] allTeamsForDiscover:', allTeamsForDiscover?.length ?? 0, allTeamsForDiscover);
      console.log('[Teams] Teams to render (À découvrir):', teamsInCity?.length ?? 0, teamsInCity);
    }
  }, [allTeamsForDiscover, teamsInCity]);

  const recruitingOnly = useMemo(() => {
    const list = (getRecruitingTeams() ?? []).filter(team => {
      if (myTeam && team.id === myTeam.id) return false;
      if (team.location && location) {
        return isWithinRadius(team.location.latitude, team.location.longitude, 100);
      }
      return true;
    });
    return list;
  }, [getRecruitingTeams, myTeam, location, isWithinRadius]);

  const pendingRequestsCount = myTeam && (myTeam.captainId === user?.id || myTeam.coCaptainIds.includes(user?.id || ''))
    ? getPendingRequests(myTeam.id).length
    : 0;

  const hasActiveFilters = sportFilter !== 'all' || levelFilter !== 'all' || ambianceFilter !== 'all' || recruitingFilter !== 'all';

  const clearFilters = () => {
    setSportFilter('all');
    setLevelFilter('all');
    setAmbianceFilter('all');
    setRecruitingFilter('all');
  };

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await refetchTeams();
    } finally {
      setRefreshing(false);
    }
  };

  const focusSearch = () => searchInputRef.current?.focus();

  const renderRecruitCard = (team: ReturnType<typeof getAllTeams>[0]) => {
    const isFan = (team.fans ?? []).includes(user?.id || '');
    const trulyRecruiting = team.isRecruiting && (team.members ?? []).length < team.maxMembers;
    const slotsLeft = team.maxMembers - (team.members ?? []).length;
    const showFollowButton = !(team.members ?? []).some(m => m.userId === user?.id) && team.captainId !== user?.id && !!user;

    return (
      <TouchableOpacity
        key={team.id}
        style={styles.recruitCard}
        onPress={() => router.push(`/team/${team.id}`)}
        activeOpacity={0.85}
      >
        {/* Background logo image */}
        {team.logo ? (
          <Image
            source={{ uri: team.logo }}
            style={styles.recruitBg}
            contentFit="cover"
            blurRadius={40}
            transition={150}
          />
        ) : null}
        {/* Dark gradient overlay */}
        <LinearGradient
          colors={['rgba(18,24,41,0.6)', 'rgba(18,24,41,0.92)']}
          style={StyleSheet.absoluteFill}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
        />
        {/* Recruiting badge */}
        {trulyRecruiting && (
          <View style={styles.recruitBadge}>
            <Flame size={11} color="#FFF" />
            <Text style={styles.recruitBadgeText}>{slotsLeft} place{slotsLeft > 1 ? 's' : ''}</Text>
          </View>
        )}
        {/* Logo */}
        <View style={styles.recruitLogoWrap}>
          <Avatar uri={team.logo} name={team.name} size="large" />
        </View>
        {/* Team name */}
        <Text style={styles.recruitName} numberOfLines={1}>{team.name}</Text>
        {/* Sport + city */}
        <View style={styles.recruitMetaRow}>
          <Text style={styles.recruitMeta}>{sportLabels[team.sport]}</Text>
          <View style={styles.recruitDot} />
          <MapPin size={10} color="rgba(255,255,255,0.5)" />
          <Text style={styles.recruitMeta}>{team.city}</Text>
        </View>
        {/* Stats pills */}
        <View style={styles.recruitStats}>
          <View style={styles.recruitStatPill}>
            <Users size={11} color={Colors.primary.blue} />
            <Text style={styles.recruitStatPillText}>{(team.members ?? []).length}/{team.maxMembers}</Text>
          </View>
          {team.stats.wins > 0 && (
            <View style={styles.recruitStatPill}>
              <Trophy size={11} color={Colors.primary.orange} />
              <Text style={styles.recruitStatPillText}>{team.stats.wins}V</Text>
            </View>
          )}
          <View style={styles.recruitStatPill}>
            <Star size={11} color="#F59E0B" />
            <Text style={styles.recruitStatPillText}>{team.reputation.toFixed(1)}</Text>
          </View>
        </View>
        {/* Follow button */}
        {showFollowButton && (
          <TouchableOpacity
            style={[styles.recruitFollowBtn, !isFan && styles.recruitFollowBtnPrimary]}
            disabled={followingTeamId === team.id}
            onPress={async () => {
              setFollowingTeamId(team.id);
              try {
                if (isFan) {
                  await unfollowTeam({ teamId: team.id, userId: user!.id });
                } else {
                  await followTeam({ teamId: team.id, userId: user!.id });
                }
              } catch (e: any) {
                Alert.alert('Erreur', e?.message ?? 'Impossible');
              } finally {
                setFollowingTeamId(null);
              }
            }}
          >
            {followingTeamId === team.id ? (
              <ActivityIndicator size="small" color={isFan ? Colors.primary.blue : '#FFF'} />
            ) : isFan ? (
              <Text style={styles.recruitFollowText}>✓ Suivi</Text>
            ) : (
              <>
                <UserPlus size={13} color="#FFF" />
                <Text style={styles.recruitFollowTextPrimary}>Suivre</Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    );
  };

  const renderExploreCard = (team: ReturnType<typeof getAllTeams>[0], index: number) => {
    const isMember = (team.members ?? []).some(m => m.userId === user?.id);
    const isFan = (team.fans ?? []).includes(user?.id || '');
    const trulyRecruiting = team.isRecruiting && (team.members ?? []).length < team.maxMembers;
    const memberRole = (team.members ?? []).find(m => m.userId === user?.id)?.role;

    return (
      <TouchableOpacity
        key={team.id}
        testID={`team-discover-${index}`}
        style={styles.gridCard}
        onPress={() => router.push(`/team/${team.id}`)}
        activeOpacity={0.8}
      >
        {/* Background logo */}
        {team.logo ? (
          <Image
            source={{ uri: team.logo }}
            style={styles.gridBg}
            contentFit="cover"
            blurRadius={30}
            transition={150}
          />
        ) : null}
        {/* Gradient overlay */}
        <LinearGradient
          colors={['rgba(18,24,41,0.4)', 'rgba(18,24,41,0.95)']}
          style={StyleSheet.absoluteFill}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
        />
        {/* Top badges */}
        <View style={styles.gridTopRow}>
          {trulyRecruiting && (
            <View style={styles.gridRecruitPill}>
              <Flame size={9} color="#FFF" />
              <Text style={styles.gridRecruitPillText}>Recrute</Text>
            </View>
          )}
          {isMember && memberRole === 'captain' && (
            <View style={styles.gridCapBadge}><Crown size={10} color="#FFF" /></View>
          )}
          {isMember && memberRole === 'cm' && (
            <View style={styles.gridCMBadge}><Megaphone size={10} color="#FFF" /></View>
          )}
        </View>
        {/* Logo centered */}
        <View style={styles.gridLogoWrap}>
          <Avatar uri={team.logo} name={team.name} size="medium" />
        </View>
        {/* Bottom info */}
        <View style={styles.gridBottom}>
          <Text style={styles.gridName} numberOfLines={1}>{team.name}</Text>
          <View style={styles.gridMetaRow}>
            <Text style={styles.gridSport}>{sportLabels[team.sport]}</Text>
            <View style={styles.gridDot} />
            <MapPin size={9} color="rgba(255,255,255,0.5)" />
            <Text style={styles.gridCity}>{team.city}</Text>
          </View>
          <View style={styles.gridStatsRow}>
            <View style={styles.gridStat}>
              <Users size={10} color={Colors.primary.blue} />
              <Text style={styles.gridStatText}>{(team.members ?? []).length}/{team.maxMembers}</Text>
            </View>
            <View style={styles.gridStat}>
              <Star size={10} color="#F59E0B" />
              <Text style={styles.gridStatText}>{team.reputation.toFixed(1)}</Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" translucent backgroundColor="transparent" />
      <LinearGradient
        colors={['#0d111d', '#0b0f1a', Colors.background.dark, '#0d111d']}
        locations={[0, 0.25, 0.6, 1]}
        style={StyleSheet.absoluteFill}
      />
      
      <View style={styles.safeArea}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Équipes</Text>
          <View style={styles.headerActions}>
            {pendingRequestsCount > 0 && myTeam && (
              <TouchableOpacity style={styles.requestsBadgeBtn} onPress={() => router.push(`/team/${myTeam.id}`)}>
                <Users size={16} color="#FFF" />
                <Text style={styles.requestsBadgeText}>{pendingRequestsCount}</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={[styles.iconButton, hasActiveFilters && styles.iconButtonActive]} onPress={() => setShowFilterModal(true)}>
              <Filter size={20} color={hasActiveFilters ? '#FFF' : Colors.text.primary} />
            </TouchableOpacity>
            <TouchableOpacity style={[styles.iconButton, searchQuery.length > 0 && styles.iconButtonActive]} onPress={focusSearch}>
              <Search size={20} color={searchQuery.length > 0 ? '#FFF' : Colors.text.primary} />
            </TouchableOpacity>
            <TouchableOpacity testID="btn-create-team" style={styles.addButton} onPress={() => router.push('/create-team')}>
              <Plus size={20} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView
          testID="teams-scroll"
          style={styles.scrollView}
          contentContainerStyle={[styles.scrollContent, (isError || isLoading) && !(allTeamsForDiscover ?? []).length && styles.scrollContentGrow]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary.orange} />
          }
        >
          {isError && !(allTeamsForDiscover ?? []).length ? (
            <NetworkError onRetry={onRefresh} isRetrying={refreshing} />
          ) : isLoading && !(allTeamsForDiscover ?? []).length ? (
            <View style={styles.loadingWrap}><ActivityIndicator size="large" color={Colors.primary.orange} /><Text style={styles.loadingText}>Chargement des équipes...</Text></View>
          ) : (
          <>
          <View style={styles.heroWrap}>
            {myTeam ? (
              <TouchableOpacity testID="team-card-0" style={styles.heroCard} onPress={() => router.push(`/team/${myTeam.id}`)} activeOpacity={0.9}>
                {/* Blurred logo as background */}
                {myTeam.logo ? (
                  <Image
                    source={{ uri: myTeam.logo }}
                    style={styles.heroBg}
                    contentFit="cover"
                    blurRadius={50}
                    transition={200}
                  />
                ) : null}
                {/* Gradient overlay */}
                <LinearGradient
                  colors={['rgba(13,17,29,0.5)', 'rgba(13,17,29,0.85)', 'rgba(13,17,29,0.95)']}
                  style={StyleSheet.absoluteFill}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 0, y: 1 }}
                />
                {/* Content */}
                <View style={styles.heroInner}>
                  <View style={styles.heroAvatarWrap}>
                    <Avatar uri={myTeam.logo} name={myTeam.name} size="xlarge" />
                  </View>
                  <View style={styles.heroBody}>
                    <View style={styles.heroLabelRow}>
                      <Text style={styles.heroLabel}>Ta team</Text>
                      <ChevronRight size={16} color="rgba(255,255,255,0.6)" />
                    </View>
                    <Text style={styles.heroName} numberOfLines={1}>{myTeam.name}</Text>
                    <Text style={styles.heroMeta}>{sportLabels[myTeam.sport]} • {myTeam.format}</Text>
                    <View style={styles.heroStatsRow}>
                      <View style={styles.heroStatPill}>
                        <Users size={11} color="rgba(255,255,255,0.9)" />
                        <Text style={styles.heroStatPillText}>{(myTeam.members ?? []).length}/{myTeam.maxMembers}</Text>
                      </View>
                      <View style={styles.heroStatPill}>
                        <Trophy size={11} color="rgba(255,255,255,0.9)" />
                        <Text style={styles.heroStatPillText}>{myTeam.stats.wins}V · {myTeam.stats.losses}D</Text>
                      </View>
                      <View style={styles.heroStatPill}>
                        <Star size={11} color="rgba(255,255,255,0.9)" />
                        <Text style={styles.heroStatPillText}>{myTeam.reputation.toFixed(1)}</Text>
                      </View>
                    </View>
                    {(myTeam.fans ?? []).length > 0 && (
                      <View style={styles.heroFans}>
                        <Heart size={11} color="rgba(255,255,255,0.6)" />
                        <Text style={styles.heroFansText}>{(myTeam.fans ?? []).length} abonnés</Text>
                      </View>
                    )}
                  </View>
                </View>
              </TouchableOpacity>
            ) : (
              <View style={styles.heroCardEmpty}>
                <LinearGradient
                  colors={[Colors.background.cardLight, Colors.background.card]}
                  style={StyleSheet.absoluteFill}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                />
                <View style={styles.heroEmptyIcon}><Users size={36} color={Colors.primary.blue} /></View>
                <Text style={styles.heroEmptyTitle}>Pas encore d&apos;équipe</Text>
                <Text style={styles.heroEmptyText}>Crée la tienne ou rejoins une équipe près de toi</Text>
                <View style={styles.heroEmptyBtns}>
                  <TouchableOpacity style={styles.heroEmptyBtnPrimary} onPress={() => router.push('/create-team')} activeOpacity={0.8}>
                    <Plus size={18} color="#FFF" /><Text style={styles.heroEmptyBtnPrimaryText}>Créer une équipe</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.heroEmptyBtnOutlined} onPress={() => { setSearchQuery(''); focusSearch(); }} activeOpacity={0.8}>
                    <Compass size={18} color={Colors.primary.blue} /><Text style={styles.heroEmptyBtnOutlinedText}>Découvrir</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>

          {(recruitingOnly ?? []).length > 0 && (
            <View style={styles.recruitSection}>
              <View style={styles.sectionHeader}>
                <View style={styles.sectionHeaderLeft}>
                  <Flame size={18} color={Colors.status.success} />
                  <View>
                    <Text style={styles.sectionTitle}>Ça recrute</Text>
                    <Text style={styles.sectionSubtitle}>{(recruitingOnly ?? []).length} équipe{(recruitingOnly ?? []).length > 1 ? 's' : ''} avec places disponibles</Text>
                  </View>
                </View>
              </View>
              <FlatList
                horizontal
                data={recruitingOnly ?? []}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => renderRecruitCard(item)}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.recruitList}
                decelerationRate="fast"
                snapToInterval={RECRUIT_CARD_W + 12}
              />
            </View>
          )}

          <View style={styles.discoverSection}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionHeaderLeft}>
                <Compass size={18} color={Colors.primary.orange} />
                <View>
                  <Text style={styles.sectionTitle}>À découvrir</Text>
                  <Text style={styles.sectionSubtitle}>{(teamsInCity ?? []).length} équipe{(teamsInCity ?? []).length > 1 ? 's' : ''}</Text>
                </View>
              </View>
              {hasActiveFilters && (
                <TouchableOpacity style={styles.clearFiltersBtn} onPress={clearFilters}>
                  <X size={14} color={Colors.text.muted} />
                  <Text style={styles.clearFiltersText}>Effacer</Text>
                </TouchableOpacity>
              )}
            </View>
            <View style={styles.searchRow}>
              <View style={styles.searchInputWrap}>
                <Search size={18} color={Colors.text.muted} />
                <TextInput ref={searchInputRef} style={styles.searchInput} placeholder="Nom, ville..." placeholderTextColor={Colors.text.muted} value={searchQuery} onChangeText={setSearchQuery} />
                {searchQuery.length > 0 && <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={12}><X size={18} color={Colors.text.muted} /></TouchableOpacity>}
              </View>
            </View>
            {(teamsInCity ?? []).length > 0 ? (
              <View style={styles.gridContainer}>
                {(teamsInCity ?? []).map((team, index) => renderExploreCard(team, index))}
              </View>
            ) : (
              <View style={styles.exploreEmpty}>
                <Text style={styles.exploreEmptyText}>
                  {searchQuery.trim() || hasActiveFilters ? 'Aucun résultat' : 'Aucune équipe disponible'}
                </Text>
                {(searchQuery.trim() || hasActiveFilters) && (
                  <TouchableOpacity onPress={() => { setSearchQuery(''); clearFilters(); }}><Text style={styles.exploreEmptyLink}>Réinitialiser</Text></TouchableOpacity>
                )}
              </View>
            )}
          </View>
          </>
          )}
        </ScrollView>

        <Modal visible={showFilterModal} animationType="slide" transparent>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Filtrer les équipes</Text>
                <TouchableOpacity style={styles.modalClose} onPress={() => setShowFilterModal(false)}>
                  <X size={24} color={Colors.text.primary} />
                </TouchableOpacity>
              </View>
              <ScrollView style={styles.modalScroll}>
                <Text style={styles.filterLabel}>Recrutement</Text>
                <View style={styles.filterOptions}>
                  <TouchableOpacity style={[styles.filterChip, recruitingFilter === 'all' && styles.filterChipActive]} onPress={() => setRecruitingFilter('all')}>
                    <Text style={[styles.filterChipText, recruitingFilter === 'all' && styles.filterChipTextActive]}>Toutes</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.filterChip, recruitingFilter === 'open' && styles.filterChipActive]} onPress={() => setRecruitingFilter('open')}>
                    <Text style={[styles.filterChipText, recruitingFilter === 'open' && styles.filterChipTextActive]}>Recrutent</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.filterChip, recruitingFilter === 'closed' && styles.filterChipActive]} onPress={() => setRecruitingFilter('closed')}>
                    <Text style={[styles.filterChipText, recruitingFilter === 'closed' && styles.filterChipTextActive]}>Complet / Fermé</Text>
                  </TouchableOpacity>
                </View>
                <Text style={styles.filterLabel}>Sport</Text>
                <View style={styles.filterOptions}>
                  <TouchableOpacity style={[styles.filterChip, sportFilter === 'all' && styles.filterChipActive]} onPress={() => setSportFilter('all')}>
                    <Text style={[styles.filterChipText, sportFilter === 'all' && styles.filterChipTextActive]}>Tous</Text>
                  </TouchableOpacity>
                  {ALL_SPORTS.slice(0, 10).map(sport => (
                    <TouchableOpacity key={sport} style={[styles.filterChip, sportFilter === sport && styles.filterChipActive]} onPress={() => setSportFilter(sport)}>
                      <Text style={[styles.filterChipText, sportFilter === sport && styles.filterChipTextActive]}>{sportLabels[sport]}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <Text style={styles.filterLabel}>Niveau</Text>
                <View style={styles.filterOptions}>
                  {(['all', 'beginner', 'intermediate', 'advanced', 'expert'] as const).map(level => (
                    <TouchableOpacity key={level} style={[styles.filterChip, levelFilter === level && styles.filterChipActive]} onPress={() => setLevelFilter(level)}>
                      <Text style={[styles.filterChipText, levelFilter === level && styles.filterChipTextActive]}>
                        {level === 'all' ? 'Tous' : levelLabels[level]}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <Text style={styles.filterLabel}>Ambiance</Text>
                <View style={styles.filterOptions}>
                  {(['all', 'competitive', 'casual', 'mixed'] as const).map(ambiance => (
                    <TouchableOpacity key={ambiance} style={[styles.filterChip, ambianceFilter === ambiance && styles.filterChipActive]} onPress={() => setAmbianceFilter(ambiance)}>
                      <Text style={[styles.filterChipText, ambianceFilter === ambiance && styles.filterChipTextActive]}>
                        {ambiance === 'all' ? 'Tous' : ambianceLabels[ambiance]}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <View style={styles.filterActions}>
                  {hasActiveFilters && (
                    <Button title="Réinitialiser" onPress={clearFilters} variant="outline" style={styles.filterBtn} />
                  )}
                  <Button title="Appliquer" onPress={() => setShowFilterModal(false)} variant="primary" style={styles.filterBtn} />
                </View>
              </ScrollView>
            </View>
          </View>
        </Modal>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1, paddingTop: Platform.OS === 'ios' ? 50 : 35 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: OUTER_PAD, paddingVertical: SPACING.md, paddingTop: SPACING.xs },
  headerTitle: { color: Colors.text.primary, fontSize: 28, fontWeight: '800' as const, letterSpacing: -0.8 },
  headerActions: { flexDirection: 'row', gap: 8 },
  iconButton: { width: 42, height: 42, borderRadius: 14, backgroundColor: Colors.background.card, alignItems: 'center', justifyContent: 'center' },
  iconButtonActive: { backgroundColor: Colors.primary.blue },
  addButton: { width: 42, height: 42, borderRadius: 14, backgroundColor: Colors.primary.orange, alignItems: 'center', justifyContent: 'center' },
  requestsBadgeBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Colors.primary.orange, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 22, marginRight: 4 },
  requestsBadgeText: { color: '#FFF', fontSize: 13, fontWeight: '700' as const },

  scrollView: { flex: 1, width: '100%' },
  scrollContent: { paddingHorizontal: OUTER_PAD, paddingBottom: 100 },
  scrollContentGrow: { flexGrow: 1 },
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 60, minHeight: 200 },
  loadingText: { color: Colors.text.muted, fontSize: 14, marginTop: 12 },

  // ════ Search ════
  searchRow: { marginBottom: SPACING.sm, paddingTop: 4 },
  searchInputWrap: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: Colors.background.card, borderRadius: 16, paddingHorizontal: 16, paddingVertical: 4, minHeight: 48 },
  searchInput: { flex: 1, color: Colors.text.primary, fontSize: 16, paddingVertical: 10 },

  // ════ Section headers ════
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  sectionHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  sectionTitle: { color: Colors.text.primary, fontSize: 20, fontWeight: '700' as const, letterSpacing: -0.3 },
  sectionSubtitle: { color: Colors.text.muted, fontSize: 13, marginTop: 2 },
  clearFiltersBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12, backgroundColor: Colors.background.card },
  clearFiltersText: { color: Colors.text.muted, fontSize: 12, fontWeight: '500' as const },

  // ════ Hero card with bg image ════
  heroWrap: { marginBottom: 28 },
  heroCard: { borderRadius: CARD_RADIUS, overflow: 'hidden', minHeight: 140 },
  heroBg: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  heroInner: { flexDirection: 'row', alignItems: 'center', padding: 22, gap: 18 },
  heroAvatarWrap: { borderRadius: 26, overflow: 'hidden' },
  heroBody: { flex: 1, gap: 3 },
  heroLabelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  heroLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 11, fontWeight: '700' as const, textTransform: 'uppercase' as const, letterSpacing: 0.8 },
  heroName: { color: '#FFFFFF', fontSize: 22, fontWeight: '800' as const, letterSpacing: -0.3 },
  heroMeta: { color: 'rgba(255,255,255,0.8)', fontSize: 14, fontWeight: '500' as const },
  heroStatsRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6, flexWrap: 'wrap' as const },
  heroStatPill: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(255,255,255,0.15)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10 },
  heroStatPillText: { color: 'rgba(255,255,255,0.95)', fontSize: 12, fontWeight: '600' as const },
  heroFans: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  heroFansText: { color: 'rgba(255,255,255,0.6)', fontSize: 12, fontWeight: '500' as const },

  // ════ Hero empty ════
  heroCardEmpty: { borderRadius: CARD_RADIUS, overflow: 'hidden', padding: 28, alignItems: 'center' },
  heroEmptyIcon: { width: 60, height: 60, borderRadius: 30, backgroundColor: Colors.primary.blue + '20', alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  heroEmptyTitle: { color: Colors.text.primary, fontSize: 18, fontWeight: '700' as const, marginBottom: 6 },
  heroEmptyText: { color: Colors.text.muted, fontSize: 14, textAlign: 'center', marginBottom: 20, lineHeight: 20 },
  heroEmptyBtns: { flexDirection: 'row', gap: 12 },
  heroEmptyBtnPrimary: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.primary.orange, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 14 },
  heroEmptyBtnPrimaryText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' as const },
  heroEmptyBtnOutlined: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 14 },
  heroEmptyBtnOutlinedText: { color: Colors.primary.blue, fontSize: 14, fontWeight: '700' as const },

  // ════ Recruit carousel — banner cards with bg image ════
  recruitSection: { marginBottom: 28 },
  recruitList: { paddingRight: OUTER_PAD, gap: 12 },
  recruitCard: { width: RECRUIT_CARD_W, borderRadius: 22, padding: 20, overflow: 'hidden', minHeight: 240, ...cardGlow },
  recruitBg: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  recruitBadge: { position: 'absolute', top: 14, right: 14, flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.status.success, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12 },
  recruitBadgeText: { color: '#FFF', fontSize: 11, fontWeight: '700' as const },
  recruitLogoWrap: { alignItems: 'center', marginTop: 8, marginBottom: 14 },
  recruitName: { color: '#FFFFFF', fontSize: 17, fontWeight: '800' as const, letterSpacing: -0.2, marginBottom: 6, textAlign: 'center' },
  recruitMetaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 14 },
  recruitMeta: { color: 'rgba(255,255,255,0.7)', fontSize: 13 },
  recruitDot: { width: 3, height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.3)' },
  recruitStats: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 16 },
  recruitStatPill: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(255,255,255,0.12)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12 },
  recruitStatPillText: { color: 'rgba(255,255,255,0.9)', fontSize: 12, fontWeight: '600' as const },
  recruitFollowBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.1)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  recruitFollowBtnPrimary: { backgroundColor: Colors.primary.orange, borderWidth: 0 },
  recruitFollowText: { color: 'rgba(255,255,255,0.9)', fontSize: 13, fontWeight: '700' as const },
  recruitFollowTextPrimary: { color: '#FFF', fontSize: 13, fontWeight: '700' as const },

  // ════ Discover grid 2 columns ════
  discoverSection: { marginBottom: 16 },
  gridContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  gridCard: { width: (SCREEN_WIDTH - OUTER_PAD * 2 - 12) / 2, borderRadius: 20, overflow: 'hidden', minHeight: 200, ...cardGlow },
  gridBg: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  gridTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 12 },
  gridRecruitPill: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.status.success, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10 },
  gridRecruitPillText: { color: '#FFF', fontSize: 10, fontWeight: '700' as const },
  gridCapBadge: { width: 22, height: 22, borderRadius: 11, backgroundColor: Colors.primary.orange, alignItems: 'center', justifyContent: 'center' },
  gridCMBadge: { width: 22, height: 22, borderRadius: 11, backgroundColor: Colors.primary.blue, alignItems: 'center', justifyContent: 'center' },
  gridLogoWrap: { alignItems: 'center', justifyContent: 'center', flex: 1 },
  gridBottom: { padding: 14 },
  gridName: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' as const, letterSpacing: -0.2, marginBottom: 4 },
  gridMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 8 },
  gridSport: { color: 'rgba(255,255,255,0.7)', fontSize: 12, fontWeight: '500' as const },
  gridDot: { width: 3, height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.3)' },
  gridCity: { color: 'rgba(255,255,255,0.5)', fontSize: 12 },
  gridStatsRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  gridStat: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  gridStatText: { color: 'rgba(255,255,255,0.8)', fontSize: 12, fontWeight: '500' as const },

  // ════ Empty ════
  exploreEmpty: { paddingVertical: 40, alignItems: 'center' },
  exploreEmptyText: { color: Colors.text.muted, fontSize: 14, textAlign: 'center', marginBottom: 12 },
  exploreEmptyLink: { color: Colors.primary.orange, fontSize: 14, fontWeight: '600' as const },

  // ════ Filter modal ════
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: Colors.background.dark, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '80%' },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20 },
  modalTitle: { color: Colors.text.primary, fontSize: 18, fontWeight: '700' as const },
  modalClose: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.background.card, alignItems: 'center', justifyContent: 'center' },
  modalScroll: { padding: 20 },
  filterLabel: { color: Colors.text.secondary, fontSize: 14, fontWeight: '700' as const, marginBottom: 12, marginTop: 16 },
  filterOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  filterChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 16, backgroundColor: Colors.background.card },
  filterChipActive: { backgroundColor: Colors.primary.blue },
  filterChipText: { color: Colors.text.secondary, fontSize: 13 },
  filterChipTextActive: { color: '#FFF' },
  filterActions: { flexDirection: 'row', gap: 12, marginTop: 24, marginBottom: 40 },
  filterBtn: { flex: 1 },
});
