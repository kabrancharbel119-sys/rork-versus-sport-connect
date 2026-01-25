import React, { useState, useMemo } from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity, RefreshControl, Modal, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Plus, Users, Trophy, MapPin, Star, Filter, X } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { useAuth } from '@/contexts/AuthContext';
import { useTeams } from '@/contexts/TeamsContext';

import { Avatar } from '@/components/Avatar';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { sportLabels, levelLabels, ambianceLabels, ALL_SPORTS } from '@/mocks/data';
import { Sport, SkillLevel, PlayStyle } from '@/types';

type TabType = 'my-teams' | 'discover';

export default function TeamsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { getUserTeams, getRecruitingTeams, getPendingRequests } = useTeams();
  const [activeTab, setActiveTab] = useState<TabType>('my-teams');
  const [refreshing, setRefreshing] = useState(false);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [sportFilter, setSportFilter] = useState<Sport | 'all'>('all');
  const [levelFilter, setLevelFilter] = useState<SkillLevel | 'all'>('all');
  const [ambianceFilter, setAmbianceFilter] = useState<PlayStyle | 'all'>('all');

  const myTeams = user ? getUserTeams(user.id) : [];
  const allRecruitingTeams = getRecruitingTeams();
  
  const recruitingTeams = useMemo(() => {
    return allRecruitingTeams.filter(team => {
      if (sportFilter !== 'all' && team.sport !== sportFilter) return false;
      if (levelFilter !== 'all' && team.level !== levelFilter) return false;
      if (ambianceFilter !== 'all' && team.ambiance !== ambianceFilter) return false;
      return true;
    });
  }, [allRecruitingTeams, sportFilter, levelFilter, ambianceFilter]);

  const pendingRequestsCount = myTeams.reduce((acc, team) => {
    if (team.captainId === user?.id || team.coCaptainIds.includes(user?.id || '')) {
      return acc + getPendingRequests(team.id).length;
    }
    return acc;
  }, 0);

  const hasActiveFilters = sportFilter !== 'all' || levelFilter !== 'all' || ambianceFilter !== 'all';

  const clearFilters = () => {
    setSportFilter('all');
    setLevelFilter('all');
    setAmbianceFilter('all');
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await new Promise(resolve => setTimeout(resolve, 1000));
    setRefreshing(false);
  };

  const renderTeamCard = (team: ReturnType<typeof getRecruitingTeams>[0], isMember: boolean = false) => {
    const memberRole = team.members.find(m => m.userId === user?.id)?.role;
    
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
                <View style={[
                  styles.roleBadge,
                  memberRole === 'captain' && styles.captainBadge,
                ]}>
                  <Text style={styles.roleText}>
                    {memberRole === 'captain' ? 'Capitaine' : memberRole === 'co-captain' ? 'Co-Cap' : 'Membre'}
                  </Text>
                </View>
              )}
            </View>
            <Text style={styles.teamSport}>
              {sportLabels[team.sport]} • {team.format}
            </Text>
            <View style={styles.teamLocation}>
              <MapPin size={12} color={Colors.text.muted} />
              <Text style={styles.teamLocationText}>{team.city}</Text>
            </View>
          </View>
        </View>

        <View style={styles.teamStats}>
          <View style={styles.teamStat}>
            <Users size={14} color={Colors.primary.blue} />
            <Text style={styles.teamStatText}>
              {team.members.length}/{team.maxMembers}
            </Text>
          </View>
          <View style={styles.teamStat}>
            <Trophy size={14} color={Colors.primary.orange} />
            <Text style={styles.teamStatText}>
              {team.stats.wins}W - {team.stats.losses}L
            </Text>
          </View>
          <View style={styles.teamStat}>
            <Star size={14} color="#F59E0B" />
            <Text style={styles.teamStatText}>
              {team.reputation.toFixed(1)}
            </Text>
          </View>
        </View>

        <View style={styles.teamTags}>
          <View style={styles.tag}>
            <Text style={styles.tagText}>{levelLabels[team.level]}</Text>
          </View>
          <View style={styles.tag}>
            <Text style={styles.tagText}>{ambianceLabels[team.ambiance]}</Text>
          </View>
          {team.isRecruiting && (
            <View style={[styles.tag, styles.recruitingTag]}>
              <Text style={[styles.tagText, styles.recruitingText]}>Recrute</Text>
            </View>
          )}
        </View>
      </Card>
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
            {pendingRequestsCount > 0 && (
              <TouchableOpacity style={styles.requestsBadgeBtn} onPress={() => Alert.alert('Demandes en attente', `Vous avez ${pendingRequestsCount} demande(s) pour rejoindre vos équipes. Allez sur la page de l'équipe pour les gérer.`)}>
                <Users size={16} color="#FFF" />
                <Text style={styles.requestsBadgeText}>{pendingRequestsCount}</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={[styles.iconButton, hasActiveFilters && styles.iconButtonActive]} onPress={() => setShowFilterModal(true)}>
              <Filter size={20} color={hasActiveFilters ? '#FFF' : Colors.text.primary} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.addButton} onPress={() => router.push('/create-team')}>
              <Plus size={20} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.tabs}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'my-teams' && styles.tabActive]}
            onPress={() => setActiveTab('my-teams')}
          >
            <Text style={[styles.tabText, activeTab === 'my-teams' && styles.tabTextActive]}>
              Mes équipes
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'discover' && styles.tabActive]}
            onPress={() => setActiveTab('discover')}
          >
            <Text style={[styles.tabText, activeTab === 'discover' && styles.tabTextActive]}>
              Découvrir
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={Colors.primary.orange}
            />
          }
        >
          {activeTab === 'my-teams' ? (
            myTeams.length > 0 ? (
              myTeams.map(team => renderTeamCard(team, true))
            ) : (
              <View style={styles.emptyState}>
                <Users size={64} color={Colors.text.muted} />
                <Text style={styles.emptyTitle}>Aucune équipe</Text>
                <Text style={styles.emptyText}>
                  Créez votre équipe ou rejoignez-en une existante
                </Text>
                <Button
                  title="Créer une équipe"
                  onPress={() => router.push('/create-team')}
                  variant="orange"
                  style={styles.emptyButton}
                />
              </View>
            )
          ) : (
            recruitingTeams.length > 0 ? (
              recruitingTeams.map(team => renderTeamCard(team, false))
            ) : (
              <View style={styles.emptyState}>
                <Users size={64} color={Colors.text.muted} />
                <Text style={styles.emptyTitle}>Aucune équipe disponible</Text>
                <Text style={styles.emptyText}>
                  Revenez plus tard ou créez la vôtre
                </Text>
              </View>
            )
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 20,
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
});
