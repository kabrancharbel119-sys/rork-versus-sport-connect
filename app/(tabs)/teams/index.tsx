import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity, RefreshControl, Modal, Alert, TextInput, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Plus, Users, Trophy, MapPin, Star, Filter, X, Search, ChevronRight, Compass, UserPlus } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { useAuth } from '@/contexts/AuthContext';
import { useTeams } from '@/contexts/TeamsContext';

import { Avatar } from '@/components/Avatar';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { NetworkError } from '@/components/NetworkError';
import { sportLabels, levelLabels, ambianceLabels, ALL_SPORTS } from '@/mocks/data';
import { Sport, SkillLevel, PlayStyle } from '@/types';

export default function TeamsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { getUserTeams, getAllTeams, getPendingRequests, getRecruitingTeams, refetchTeams, followTeam, unfollowTeam, isLoading, isError } = useTeams();
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
    const city = user?.city?.trim()?.toLowerCase();
    const source = allTeamsForDiscover ?? [];
    let list = source.filter(team => {
      if (city && team.city?.toLowerCase() !== city) return false;
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
  }, [allTeamsForDiscover, user?.city, sportFilter, levelFilter, ambianceFilter, recruitingFilter, searchQuery, myTeam]);

  const recruitingOnly = useMemo(() => {
    const list = (getRecruitingTeams() ?? []).filter(team => {
      if (myTeam && team.id === myTeam.id) return false;
      return true;
    });
    const city = user?.city?.trim()?.toLowerCase();
    if (city) return list.filter(t => t.city?.toLowerCase() === city);
    return list;
  }, [getRecruitingTeams, myTeam, user?.city]);

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

  const renderTeamCard = (team: ReturnType<typeof getAllTeams>[0], isMember: boolean = false) => {
    const memberRole = (team.members ?? []).find(m => m.userId === user?.id)?.role;
    
    return (
      <Card 
        key={team.id}
        style={styles.teamCard}
        onPress={() => router.push(`/team/${team.id}`)}
        variant="gradient"
      >
        <View style={styles.teamHeader}>
          <Avatar uri={team.logo} name={team.name} size="large" />
          <View style={styles.teamInfo}>
            <View style={styles.teamNameRow}>
              <Text style={styles.teamName}>{team.name}</Text>
              {isMember && memberRole && (
                <View style={[styles.roleBadge, memberRole === 'captain' && styles.captainBadge]}>
                  <Text style={styles.roleText}>{memberRole === 'captain' ? 'Capitaine' : memberRole === 'co-captain' ? 'Co-Cap' : 'Membre'}</Text>
                </View>
              )}
            </View>
            <Text style={styles.teamSport}>{sportLabels[team.sport]} • {team.format}</Text>
            <View style={styles.teamLocation}>
              <MapPin size={12} color={Colors.text.muted} />
              <Text style={styles.teamLocationText}>{team.city}</Text>
            </View>
          </View>
        </View>
        <View style={styles.teamStats}>
          <View style={styles.teamStat}><Users size={14} color={Colors.primary.blue} /><Text style={styles.teamStatText}>{(team.members ?? []).length}/{team.maxMembers}</Text></View>
          <View style={styles.teamStat}><Trophy size={14} color={Colors.primary.orange} /><Text style={styles.teamStatText}>{team.stats.wins}W - {team.stats.losses}L</Text></View>
          <View style={styles.teamStat}><Star size={14} color="#F59E0B" /><Text style={styles.teamStatText}>{team.reputation.toFixed(1)}</Text></View>
        </View>
        <View style={styles.teamTags}>
          <View style={styles.tag}><Text style={styles.tagText}>{levelLabels[team.level]}</Text></View>
          <View style={styles.tag}><Text style={styles.tagText}>{ambianceLabels[team.ambiance]}</Text></View>
          {team.isRecruiting && (team.members ?? []).length < team.maxMembers ? (
            <View style={[styles.tag, styles.recruitingTag]}><Text style={[styles.tagText, styles.recruitingText]}>Recrute</Text></View>
          ) : (
            <View style={[styles.tag, styles.closedTag]}><Text style={[styles.tagText, styles.closedTagText]}>Complet</Text></View>
          )}
        </View>
      </Card>
    );
  };

  const renderExploreRow = (team: ReturnType<typeof getAllTeams>[0], index: number) => {
    const isMember = (team.members ?? []).some(m => m.userId === user?.id);
    const isCaptain = team.captainId === user?.id;
    const isFan = (team.fans ?? []).includes(user?.id || '');
    const trulyRecruiting = team.isRecruiting && (team.members ?? []).length < team.maxMembers;
    if (__DEV__) console.log('Team:', team.id, 'isMember:', isMember, 'isFan:', isFan);
    const showFollowButton = !isMember && !isCaptain && !!user;
    return (
      <View key={team.id} style={styles.exploreRow}>
        <TouchableOpacity testID={`team-discover-${index}`} style={styles.exploreRowTouch} onPress={() => router.push(`/team/${team.id}`)} activeOpacity={0.7}>
          <Avatar uri={team.logo} name={team.name} size="small" />
          <View style={styles.exploreRowCenter}>
            <Text style={styles.exploreRowName} numberOfLines={1}>{team.name}</Text>
            <Text style={styles.exploreRowMeta}>{sportLabels[team.sport]} • {team.city}</Text>
          </View>
          <View style={styles.exploreRowRight}>
            {trulyRecruiting ? (
              <View style={styles.recrutePill}><Text style={styles.recrutePillText}>Recrute</Text></View>
            ) : null}
            <ChevronRight size={18} color={Colors.text.muted} />
          </View>
        </TouchableOpacity>
        {showFollowButton && (
          isFan ? (
            <TouchableOpacity
              testID={`btn-follow-team-${team.id}`}
              style={styles.followPill}
              disabled={followingTeamId === team.id}
              onPress={async () => {
                setFollowingTeamId(team.id);
                try {
                  await unfollowTeam({ teamId: team.id, userId: user.id });
                  Alert.alert('Succès', 'Vous ne suivez plus cette équipe');
                } catch (e: any) {
                  Alert.alert('Erreur', e?.message ?? 'Impossible');
                } finally {
                  setFollowingTeamId(null);
                }
              }}
            >
              {followingTeamId === team.id ? (
                <ActivityIndicator testID={`loading-follow-${team.id}`} size="small" color={Colors.primary.blue} />
              ) : (
                <Text style={styles.followPillText}>Suivi</Text>
              )}
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              testID={`btn-follow-team-${team.id}`}
              style={[styles.followPill, styles.followPillPrimary]}
              disabled={followingTeamId === team.id}
              onPress={async () => {
                setFollowingTeamId(team.id);
                try {
                  await followTeam({ teamId: team.id, userId: user.id });
                  Alert.alert('Succès', 'Vous suivez cette équipe');
                } catch (e: any) {
                  Alert.alert('Erreur', e?.message ?? 'Impossible');
                } finally {
                  setFollowingTeamId(null);
                }
              }}
            >
              {followingTeamId === team.id ? (
                <ActivityIndicator testID={`loading-follow-${team.id}`} size="small" color="#FFF" />
              ) : (
                <>
                  <UserPlus size={14} color="#FFF" />
                  <Text style={[styles.followPillText, { color: '#FFF' }]}>Suivre</Text>
                </>
              )}
            </TouchableOpacity>
          )
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[Colors.background.dark, '#0D1420']}
        style={StyleSheet.absoluteFill}
      />
      
      <SafeAreaView style={styles.safeArea} edges={['top']}>
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
                <LinearGradient colors={[Colors.primary.blue, '#1a4d7a']} style={StyleSheet.absoluteFill} />
                <View style={styles.heroInner}>
                  <Avatar uri={myTeam.logo} name={myTeam.name} size="xlarge" />
                  <View style={styles.heroBody}>
                    <Text style={styles.heroLabel}>Ta team</Text>
                    <Text style={styles.heroName} numberOfLines={1}>{myTeam.name}</Text>
                    <Text style={styles.heroMeta}>{sportLabels[myTeam.sport]} • {(myTeam.members ?? []).length}/{myTeam.maxMembers} joueurs</Text>
                    <View style={styles.heroStats}>
                      <Text style={styles.heroStat}>{myTeam.stats.wins}V</Text>
                      <Text style={styles.heroStatDot}>•</Text>
                      <Text style={styles.heroStat}>{myTeam.stats.losses}D</Text>
                    </View>
                    <View style={styles.heroCta}>
                      <Text style={styles.heroCtaText}>Voir ma team</Text>
                      <ChevronRight size={18} color="rgba(255,255,255,0.9)" />
                    </View>
                  </View>
                </View>
              </TouchableOpacity>
            ) : (
              <View style={styles.heroCardEmpty}>
                <View style={styles.heroEmptyIcon}><Users size={40} color={Colors.primary.blue} /></View>
                <Text style={styles.heroEmptyTitle}>Pas encore d&apos;équipe</Text>
                <Text style={styles.heroEmptyText}>Crée la tienne ou rejoins une équipe près de toi</Text>
                <View style={styles.heroEmptyBtns}>
                  <TouchableOpacity style={styles.heroEmptyBtnPrimary} onPress={() => router.push('/create-team')}>
                    <Plus size={18} color="#FFF" /><Text style={styles.heroEmptyBtnPrimaryText}>Créer</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.heroEmptyBtnOutlined} onPress={() => { setSearchQuery(''); focusSearch(); }}>
                    <Compass size={18} color={Colors.primary.blue} /><Text style={styles.heroEmptyBtnOutlinedText}>Découvrir</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>

          {(recruitingOnly ?? []).length > 0 && (
            <View style={styles.exploreSection}>
              <View style={styles.exploreHeader}>
                <Users size={20} color={Colors.status.success} />
                <View style={styles.exploreHeaderText}>
                  <Text style={styles.exploreTitle}>Équipes qui recrutent</Text>
                  <Text style={styles.exploreSubtitle}>Uniquement les équipes avec places disponibles</Text>
                </View>
              </View>
              <View style={styles.exploreList}>{(recruitingOnly ?? []).map((team, index) => renderExploreRow(team, index))}</View>
            </View>
          )}

          <View style={styles.exploreSection}>
            <View style={styles.exploreHeader}>
              <Compass size={20} color={Colors.primary.orange} />
              <View style={styles.exploreHeaderText}>
                <Text style={styles.exploreTitle}>À découvrir</Text>
                <Text style={styles.exploreSubtitle}>{user?.city ? `Autres équipes à ${user.city}` : 'Autres équipes'}</Text>
              </View>
            </View>
            <View style={styles.searchRow}>
              <View style={styles.searchInputWrap}>
                <Search size={18} color={Colors.text.muted} />
                <TextInput ref={searchInputRef} style={styles.searchInput} placeholder="Nom, ville..." placeholderTextColor={Colors.text.muted} value={searchQuery} onChangeText={setSearchQuery} />
                {searchQuery.length > 0 && <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={12}><X size={18} color={Colors.text.muted} /></TouchableOpacity>}
              </View>
            </View>
            {(teamsInCity ?? []).length > 0 ? (
              <View style={styles.exploreList}>{(teamsInCity ?? []).map((team, index) => renderExploreRow(team, index))}</View>
            ) : (
              <View style={styles.exploreEmpty}>
                <Text style={styles.exploreEmptyText}>
                  {searchQuery.trim() || hasActiveFilters ? 'Aucun résultat' : user?.city ? `Aucune autre équipe à ${user.city}` : 'Aucune équipe'}
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
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  headerTitle: {
    color: Colors.text.primary,
    fontSize: 28,
    fontWeight: '700' as const,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.background.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primary.orange,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabs: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 12,
    marginBottom: 16,
  },
  tab: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 20,
    backgroundColor: Colors.background.card,
  },
  tabActive: {
    backgroundColor: Colors.primary.blue,
  },
  tabText: {
    color: Colors.text.secondary,
    fontSize: 14,
    fontWeight: '500' as const,
  },
  tabTextActive: {
    color: '#FFFFFF',
  },
  searchRow: {
    paddingHorizontal: 20,
    marginBottom: 12,
    paddingTop: 4,
  },
  searchInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.background.card,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: Colors.primary.orange + '40',
    minHeight: 48,
  },
  searchInput: {
    flex: 1,
    color: Colors.text.primary,
    fontSize: 16,
    paddingVertical: 10,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  scrollContentGrow: { flexGrow: 1 },
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 60, minHeight: 200 },
  loadingText: { color: Colors.text.muted, fontSize: 14, marginTop: 12 },
  sectionTitle: {
    color: Colors.text.primary,
    fontSize: 18,
    fontWeight: '600' as const,
    marginBottom: 12,
  },
  teamCard: {
    marginBottom: 16,
  },
  teamHeader: {
    flexDirection: 'row',
    gap: 14,
    marginBottom: 16,
  },
  teamInfo: {
    flex: 1,
    gap: 4,
  },
  teamNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  teamName: {
    color: Colors.text.primary,
    fontSize: 18,
    fontWeight: '600' as const,
  },
  roleBadge: {
    backgroundColor: Colors.background.cardLight,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  captainBadge: {
    backgroundColor: Colors.primary.orange,
  },
  roleText: {
    color: Colors.text.primary,
    fontSize: 10,
    fontWeight: '600' as const,
  },
  teamSport: {
    color: Colors.text.secondary,
    fontSize: 14,
  },
  teamLocation: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  teamLocationText: {
    color: Colors.text.muted,
    fontSize: 12,
  },
  teamStats: {
    flexDirection: 'row',
    gap: 20,
    marginBottom: 12,
  },
  teamStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  teamStatText: {
    color: Colors.text.secondary,
    fontSize: 13,
  },
  teamTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tag: {
    backgroundColor: Colors.background.cardLight,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  tagText: {
    color: Colors.text.secondary,
    fontSize: 12,
  },
  recruitingTag: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
  },
  recruitingText: {
    color: Colors.status.success,
  },
  closedTag: {
    backgroundColor: 'rgba(107, 114, 128, 0.2)',
  },
  closedTagText: {
    color: Colors.text.muted,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    color: Colors.text.primary,
    fontSize: 20,
    fontWeight: '600' as const,
    marginTop: 20,
  },
  emptyText: {
    color: Colors.text.muted,
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
    paddingHorizontal: 40,
  },
  emptyButton: {
    marginTop: 24,
  },
  requestsBadgeBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Colors.primary.orange, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 22, marginRight: 4 },
  requestsBadgeText: { color: '#FFF', fontSize: 13, fontWeight: '600' as const },
  iconButtonActive: { backgroundColor: Colors.primary.blue },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: Colors.background.dark, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '80%' },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, borderBottomWidth: 1, borderBottomColor: Colors.border.light },
  modalTitle: { color: Colors.text.primary, fontSize: 18, fontWeight: '600' as const },
  modalClose: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.background.card, alignItems: 'center', justifyContent: 'center' },
  modalScroll: { padding: 20 },
  filterLabel: { color: Colors.text.secondary, fontSize: 14, fontWeight: '600' as const, marginBottom: 12, marginTop: 16 },
  filterOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  filterChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 16, backgroundColor: Colors.background.card },
  filterChipActive: { backgroundColor: Colors.primary.blue },
  filterChipText: { color: Colors.text.secondary, fontSize: 13 },
  filterChipTextActive: { color: '#FFF' },
  filterActions: { flexDirection: 'row', gap: 12, marginTop: 24, marginBottom: 40 },
  filterBtn: { flex: 1 },

  // Hero « Ma team »
  heroWrap: {
    marginBottom: 24,
  },
  heroCard: {
    borderRadius: 20,
    overflow: 'hidden',
    minHeight: 120,
  },
  heroInner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    gap: 16,
  },
  heroBody: {
    flex: 1,
    gap: 4,
  },
  heroLabel: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 12,
    fontWeight: '600' as const,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  heroName: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700' as const,
  },
  heroMeta: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 14,
  },
  heroStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  heroStat: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 13,
    fontWeight: '600' as const,
  },
  heroStatDot: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 12,
  },
  heroCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
  },
  heroCtaText: {
    color: 'rgba(255,255,255,0.95)',
    fontSize: 14,
    fontWeight: '600' as const,
  },
  heroCardEmpty: {
    borderRadius: 20,
    backgroundColor: Colors.background.card,
    borderWidth: 1,
    borderColor: Colors.border.light,
    padding: 24,
    alignItems: 'center',
  },
  heroEmptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.primary.blue + '25',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  heroEmptyTitle: {
    color: Colors.text.primary,
    fontSize: 18,
    fontWeight: '700' as const,
    marginBottom: 6,
  },
  heroEmptyText: {
    color: Colors.text.muted,
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 20,
  },
  heroEmptyBtns: {
    flexDirection: 'row',
    gap: 12,
  },
  heroEmptyBtnPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.primary.orange,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 14,
  },
  heroEmptyBtnPrimaryText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600' as const,
  },
  heroEmptyBtnOutlined: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: Colors.primary.blue,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 14,
  },
  heroEmptyBtnOutlinedText: {
    color: Colors.primary.blue,
    fontSize: 14,
    fontWeight: '600' as const,
  },

  // À découvrir
  exploreSection: {
    marginBottom: 16,
  },
  exploreHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  exploreHeaderText: {
    flex: 1,
  },
  exploreTitle: {
    color: Colors.text.primary,
    fontSize: 18,
    fontWeight: '700' as const,
  },
  exploreSubtitle: {
    color: Colors.text.muted,
    fontSize: 13,
    marginTop: 2,
  },
  exploreList: {
    gap: 2,
  },
  exploreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background.card,
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
    gap: 12,
  },
  exploreRowTouch: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  exploreRowCenter: {
    flex: 1,
    minWidth: 0,
  },
  exploreRowName: {
    color: Colors.text.primary,
    fontSize: 16,
    fontWeight: '600' as const,
  },
  exploreRowMeta: {
    color: Colors.text.muted,
    fontSize: 13,
    marginTop: 2,
  },
  exploreRowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  recrutePill: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  recrutePillText: {
    color: Colors.status.success,
    fontSize: 12,
    fontWeight: '600' as const,
  },
  followPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.primary.blue,
  },
  followPillPrimary: {
    backgroundColor: Colors.primary.blue,
    borderColor: Colors.primary.blue,
  },
  followPillText: {
    color: Colors.primary.blue,
    fontSize: 12,
    fontWeight: '600' as const,
  },
  exploreEmpty: {
    paddingVertical: 32,
    alignItems: 'center',
  },
  exploreEmptyText: {
    color: Colors.text.muted,
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 12,
  },
  exploreEmptyLink: {
    color: Colors.primary.orange,
    fontSize: 14,
    fontWeight: '600' as const,
  },
});
