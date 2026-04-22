import React, { useState, useEffect, useCallback } from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity, Alert, RefreshControl, Modal, TextInput } from 'react-native';
import { useRouter, useLocalSearchParams, Stack } from 'expo-router';
import { safeBack } from '@/lib/navigation';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { 
  ArrowLeft, 
  Radio, 
  Square, 
  Circle, 
  Trophy, 
  Users, 
  Clock, 
  Target, 
  Plus, 
  Minus,
  Goal,
  CreditCard,
  RefreshCcw,
  Send
} from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { useAuth } from '@/contexts/AuthContext';
import { useMatches } from '@/contexts/MatchesContext';
import { Avatar } from '@/components/Avatar';
import { Card as CardComponent } from '@/components/Card';
import { Button } from '@/components/Button';
import { liveScoringApi } from '@/lib/api/live-scoring';
import { MatchEvent, LiveMatchStats, MatchEventType, MatchPeriod } from '@/types/live-scoring';
import { sportLabels } from '@/mocks/data';

export default function LiveMatchScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const { getMatchById } = useMatches();
  
  const [match, setMatch] = useState(getMatchById(id || ''));
  const [liveStats, setLiveStats] = useState<LiveMatchStats | null>(null);
  const [events, setEvents] = useState<MatchEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [currentMinute, setCurrentMinute] = useState(0);
  const [currentPeriod, setCurrentPeriod] = useState<MatchPeriod>('first_half');
  
  // États pour les modals
  const [showGoalModal, setShowGoalModal] = useState(false);
  const [showCardModal, setShowCardModal] = useState(false);
  const [showSubstitutionModal, setShowSubstitutionModal] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState<'home' | 'away'>('home');
  const [selectedPlayer, setSelectedPlayer] = useState('');
  const [selectedPlayerName, setSelectedPlayerName] = useState('');
  const [assistPlayer, setAssistPlayer] = useState('');
  const [assistPlayerName, setAssistPlayerName] = useState('');
  const [cardReason, setCardReason] = useState('');
  const [cardType, setCardType] = useState<'yellow' | 'red'>('yellow');

  useEffect(() => {
    loadLiveMatchData();
    const interval = setInterval(() => {
      setCurrentMinute(prev => prev + 1);
    }, 60000); // Chaque minute

    return () => clearInterval(interval);
  }, [id]);

  const loadLiveMatchData = async () => {
    try {
      const stats = await liveScoringApi.getLiveMatchStats(id || '');
      const matchEvents = await liveScoringApi.getMatchEvents(id || '');
      setLiveStats(stats);
      setEvents(matchEvents);
      if (stats) {
        setCurrentMinute(stats.currentMinute);
        setCurrentPeriod(stats.currentPeriod);
      }
    } catch (error) {
      console.error('Error loading live match data:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadLiveMatchData();
    setRefreshing(false);
  };

  const handleAddGoal = async () => {
    if (!selectedPlayer || !selectedPlayerName) {
      Alert.alert('Erreur', 'Veuillez sélectionner un joueur');
      return;
    }

    try {
      const teamId = selectedTeam === 'home' ? liveStats?.homeTeamId : liveStats?.awayTeamId;
      await liveScoringApi.addGoal(
        id || '',
        teamId || '',
        selectedPlayer,
        selectedPlayerName,
        currentMinute,
        currentPeriod,
        assistPlayer || undefined,
        assistPlayerName || undefined
      );
      
      setShowGoalModal(false);
      resetModalStates();
      await loadLiveMatchData();
      Alert.alert('But !', `${selectedPlayerName} a marqué ! ⚽`);
    } catch (error: any) {
      Alert.alert('Erreur', 'Impossible d\'ajouter le but');
    }
  };

  const handleAddCard = async () => {
    if (!selectedPlayer || !selectedPlayerName) {
      Alert.alert('Erreur', 'Veuillez sélectionner un joueur');
      return;
    }

    try {
      const teamId = selectedTeam === 'home' ? liveStats?.homeTeamId : liveStats?.awayTeamId;
      await liveScoringApi.addCard(
        id || '',
        teamId || '',
        selectedPlayer,
        selectedPlayerName,
        currentMinute,
        currentPeriod,
        cardType === 'yellow' ? 'yellow_card' : 'red_card',
        cardReason
      );
      
      setShowCardModal(false);
      resetModalStates();
      await loadLiveMatchData();
      Alert.alert('Carton', `${selectedPlayerName} a reçu un carton ${cardType === 'yellow' ? 'jaune' : 'rouge'} 🟨`);
    } catch (error: any) {
      Alert.alert('Erreur', 'Impossible d\'ajouter le carton');
    }
  };

  const handleSubstitution = async () => {
    Alert.alert('Remplacement', 'Fonctionnalité bientôt disponible');
  };

  const handlePeriodChange = (newPeriod: MatchPeriod) => {
    setCurrentPeriod(newPeriod);
    if (newPeriod === 'second_half') {
      setCurrentMinute(46);
    } else if (newPeriod === 'extra_time_first') {
      setCurrentMinute(91);
    } else if (newPeriod === 'extra_time_second') {
      setCurrentMinute(106);
    }
  };

  const resetModalStates = () => {
    setSelectedTeam('home');
    setSelectedPlayer('');
    setSelectedPlayerName('');
    setAssistPlayer('');
    setAssistPlayerName('');
    setCardReason('');
    setCardType('yellow');
  };

  const getEventIcon = (type: MatchEventType) => {
    switch (type) {
      case 'goal': return <Goal size={16} color="#10B981" />;
      case 'yellow_card': return <CreditCard size={16} color="#FBBF24" />;
      case 'red_card': return <CreditCard size={16} color="#EF4444" />;
      case 'substitution': return <Users size={16} color="#6366F1" />;
      case 'period_start': return <Circle size={16} color="#10B981" />;
      case 'period_end': return <Square size={16} color="#F59E0B" />;
      case 'match_start': return <Circle size={16} color="#10B981" />;
      case 'match_end': return <Square size={16} color="#EF4444" />;
      default: return <Circle size={16} color={Colors.text.muted} />;
    }
  };

  const getEventText = (event: MatchEvent) => {
    switch (event.type) {
      case 'goal':
        return `⚽ But ! ${event.playerName}${event.assistPlayerName ? ` (assist: ${event.assistPlayerName})` : ''}`;
      case 'yellow_card':
        return `🟨 Carton jaune - ${event.playerName}${event.description ? ` (${event.description})` : ''}`;
      case 'red_card':
        return `🟥 Carton rouge - ${event.playerName}${event.description ? ` (${event.description})` : ''}`;
      case 'substitution':
        return `🔄 Remplacement - ${event.playerName} → ${event.metadata?.playerOutName || '?'}`;
      case 'period_start':
        return `🏁 Début de la période`;
      case 'period_end':
        return `⏸️ Fin de la période`;
      case 'match_start':
        return `🏁 Début du match`;
      case 'match_end':
        return `🏁 Fin du match`;
      default:
        return event.description || event.type;
    }
  };

  if (!match) {
    return (
      <View style={styles.container}>
        <LinearGradient colors={[Colors.background.dark, '#0D1420']} style={StyleSheet.absoluteFill} />
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>Match non trouvé</Text>
            <Button title="Retour" onPress={() => safeBack(router, '/(tabs)/matches')} variant="outline" />
          </View>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.container}>
        <LinearGradient colors={[Colors.background.dark, '#0D1420']} style={StyleSheet.absoluteFill} />

        <SafeAreaView style={styles.safeArea}>
          <View style={styles.header}>
            <TouchableOpacity style={styles.backBtn} onPress={() => safeBack(router, '/(tabs)/matches')}>
              <ArrowLeft size={24} color={Colors.text.primary} />
            </TouchableOpacity>
            <View style={styles.headerTitleWrap}>
              <View style={styles.liveIndicator}>
                <Radio size={12} color="#EF4444" />
                <Text style={styles.liveText}>LIVE</Text>
              </View>
              <Text style={styles.headerTitle}>{sportLabels[match.sport]}</Text>
              <Text style={styles.headerSubtitle}>Match en direct</Text>
            </View>
            <TouchableOpacity style={styles.refreshBtn} onPress={onRefresh}>
              <RefreshCcw size={20} color={Colors.text.primary} />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary.orange} />}
          >
            {/* Score en direct */}
            <CardComponent style={styles.scoreCard} variant="gradient">
              <View style={styles.scoreHeader}>
                <View style={styles.teamScore}>
                  <Text style={styles.teamName}>Équipe Domicile</Text>
                  <Text style={styles.score}>{liveStats?.homeScore || 0}</Text>
                </View>
                <View style={styles.matchInfo}>
                  <Text style={styles.minute}>{currentMinute}'</Text>
                  <Text style={styles.period}>{currentPeriod === 'first_half' ? '1ère mi-temps' : currentPeriod === 'second_half' ? '2ème mi-temps' : 'Prolongations'}</Text>
                </View>
                <View style={styles.teamScore}>
                  <Text style={styles.teamName}>Équipe Extérieur</Text>
                  <Text style={styles.score}>{liveStats?.awayScore || 0}</Text>
                </View>
              </View>

              {/* Actions rapides */}
              <View style={styles.quickActions}>
                <TouchableOpacity style={styles.actionBtn} onPress={() => setShowGoalModal(true)}>
                  <Goal size={20} color="#10B981" />
                  <Text style={styles.actionBtnText}>But</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionBtn} onPress={() => setShowCardModal(true)}>
                  <CreditCard size={20} color="#FBBF24" />
                  <Text style={styles.actionBtnText}>Carton</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionBtn} onPress={() => setShowSubstitutionModal(true)}>
                  <Users size={20} color="#6366F1" />
                  <Text style={styles.actionBtnText}>Remplacement</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionBtn} onPress={() => handlePeriodChange('second_half')}>
                  <Clock size={20} color="#F59E0B" />
                  <Text style={styles.actionBtnText}>Période</Text>
                </TouchableOpacity>
              </View>
            </CardComponent>

            {/* Timeline des événements */}
            <CardComponent style={styles.timelineCard}>
              <View style={styles.timelineHeader}>
                <Clock size={20} color={Colors.primary.orange} />
                <Text style={styles.timelineTitle}>Timeline du match</Text>
              </View>
              
              <View style={styles.timeline}>
                {events.length === 0 ? (
                  <View style={styles.emptyTimeline}>
                    <Text style={styles.emptyTimelineText}>Aucun événement pour le moment</Text>
                  </View>
                ) : (
                  events.map((event, index) => (
                    <View key={event.id} style={styles.timelineItem}>
                      <View style={styles.timelineTime}>
                        <Text style={styles.timelineMinute}>{event.minute}'</Text>
                      </View>
                      <View style={styles.timelineContent}>
                        {getEventIcon(event.type)}
                        <Text style={styles.timelineText}>{getEventText(event)}</Text>
                      </View>
                    </View>
                  ))
                )}
              </View>
            </CardComponent>

            {/* Statistiques */}
            {liveStats && (
              <CardComponent style={styles.statsCard}>
                <View style={styles.statsHeader}>
                  <Trophy size={20} color={Colors.primary.orange} />
                  <Text style={styles.statsTitle}>Statistiques</Text>
                </View>
                
                <View style={styles.statsGrid}>
                  <View style={styles.statItem}>
                    <Text style={styles.statLabel}>Tirs</Text>
                    <Text style={styles.statValue}>{liveStats.stats.home.shots} - {liveStats.stats.away.shots}</Text>
                  </View>
                  <View style={styles.statItem}>
                    <Text style={styles.statLabel}>Tirs cadrés</Text>
                    <Text style={styles.statValue}>{liveStats.stats.home.shotsOnTarget} - {liveStats.stats.away.shotsOnTarget}</Text>
                  </View>
                  <View style={styles.statItem}>
                    <Text style={styles.statLabel}>Possession</Text>
                    <Text style={styles.statValue}>{liveStats.stats.home.possession}% - {liveStats.stats.away.possession}%</Text>
                  </View>
                  <View style={styles.statItem}>
                    <Text style={styles.statLabel}>Passes</Text>
                    <Text style={styles.statValue}>{liveStats.stats.home.passes} - {liveStats.stats.away.passes}</Text>
                  </View>
                  <View style={styles.statItem}>
                    <Text style={styles.statLabel}>Fautes</Text>
                    <Text style={styles.statValue}>{liveStats.stats.home.fouls} - {liveStats.stats.away.fouls}</Text>
                  </View>
                  <View style={styles.statItem}>
                    <Text style={styles.statLabel}>Cartons</Text>
                    <Text style={styles.statValue}>{liveStats.stats.home.yellowCards + liveStats.stats.home.redCards} - {liveStats.stats.away.yellowCards + liveStats.stats.away.redCards}</Text>
                  </View>
                </View>
              </CardComponent>
            )}
          </ScrollView>
        </SafeAreaView>

        {/* Modal pour ajouter un but */}
        <Modal visible={showGoalModal} transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Ajouter un but</Text>
              
              <View style={styles.teamSelector}>
                <TouchableOpacity
                  style={[styles.teamOption, selectedTeam === 'home' && styles.teamOptionSelected]}
                  onPress={() => setSelectedTeam('home')}
                >
                  <Text style={styles.teamOptionText}>Équipe Domicile</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.teamOption, selectedTeam === 'away' && styles.teamOptionSelected]}
                  onPress={() => setSelectedTeam('away')}
                >
                  <Text style={styles.teamOptionText}>Équipe Extérieur</Text>
                </TouchableOpacity>
              </View>

              <TextInput
                style={styles.input}
                placeholder="Nom du buteur"
                value={selectedPlayerName}
                onChangeText={setSelectedPlayerName}
              />

              <TextInput
                style={styles.input}
                placeholder="Nom de l'assistant (optionnel)"
                value={assistPlayerName}
                onChangeText={setAssistPlayerName}
              />

              <View style={styles.modalActions}>
                <Button title="Annuler" onPress={() => setShowGoalModal(false)} variant="outline" />
                <Button title="Ajouter le but ⚽" onPress={handleAddGoal} variant="orange" />
              </View>
            </View>
          </View>
        </Modal>

        {/* Modal pour ajouter un carton */}
        <Modal visible={showCardModal} transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Ajouter un carton</Text>
              
              <View style={styles.teamSelector}>
                <TouchableOpacity
                  style={[styles.teamOption, selectedTeam === 'home' && styles.teamOptionSelected]}
                  onPress={() => setSelectedTeam('home')}
                >
                  <Text style={styles.teamOptionText}>Équipe Domicile</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.teamOption, selectedTeam === 'away' && styles.teamOptionSelected]}
                  onPress={() => setSelectedTeam('away')}
                >
                  <Text style={styles.teamOptionText}>Équipe Extérieur</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.cardTypeSelector}>
                <TouchableOpacity
                  style={[styles.cardOption, cardType === 'yellow' && styles.cardOptionSelected]}
                  onPress={() => setCardType('yellow')}
                >
                  <View style={[styles.cardPreview, { backgroundColor: '#FBBF24' }]} />
                  <Text style={styles.cardOptionText}>Jaune</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.cardOption, cardType === 'red' && styles.cardOptionSelected]}
                  onPress={() => setCardType('red')}
                >
                  <View style={[styles.cardPreview, { backgroundColor: '#EF4444' }]} />
                  <Text style={styles.cardOptionText}>Rouge</Text>
                </TouchableOpacity>
              </View>

              <TextInput
                style={styles.input}
                placeholder="Nom du joueur"
                value={selectedPlayerName}
                onChangeText={setSelectedPlayerName}
              />

              <TextInput
                style={styles.input}
                placeholder="Raison du carton (optionnel)"
                value={cardReason}
                onChangeText={setCardReason}
              />

              <View style={styles.modalActions}>
                <Button title="Annuler" onPress={() => setShowCardModal(false)} variant="outline" />
                <Button title="Ajouter le carton 🟨" onPress={handleAddCard} variant="orange" />
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
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16, gap: 12 },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.background.card, alignItems: 'center', justifyContent: 'center' },
  headerTitleWrap: { flex: 1, alignItems: 'center' },
  liveIndicator: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4 },
  liveText: { fontSize: 12, fontWeight: '700', color: '#EF4444' },
  headerTitle: { fontSize: 20, fontWeight: '700', color: Colors.text.primary },
  headerSubtitle: { fontSize: 13, color: Colors.text.muted },
  refreshBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.background.card, alignItems: 'center', justifyContent: 'center' },

  scrollView: { flex: 1 },
  scrollContent: { padding: 20, paddingTop: 12 },

  scoreCard: { marginBottom: 20 },
  scoreHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  teamScore: { flex: 1, alignItems: 'center' },
  teamName: { fontSize: 14, color: Colors.text.secondary, marginBottom: 8 },
  score: { fontSize: 48, fontWeight: '800', color: Colors.text.primary },
  matchInfo: { alignItems: 'center', gap: 4 },
  minute: { fontSize: 24, fontWeight: '700', color: Colors.primary.orange },
  period: { fontSize: 12, color: Colors.text.muted },

  quickActions: { flexDirection: 'row', justifyContent: 'space-around', paddingTop: 16, borderTopWidth: 1, borderTopColor: Colors.border.light },
  actionBtn: { alignItems: 'center', gap: 4 },
  actionBtnText: { fontSize: 12, color: Colors.text.secondary },

  timelineCard: { marginBottom: 20 },
  timelineHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
  timelineTitle: { fontSize: 16, fontWeight: '600', color: Colors.text.primary },
  timeline: { gap: 12 },
  emptyTimeline: { alignItems: 'center', paddingVertical: 40 },
  emptyTimelineText: { fontSize: 14, color: Colors.text.muted },
  timelineItem: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  timelineTime: { width: 40, alignItems: 'center' },
  timelineMinute: { fontSize: 14, fontWeight: '600', color: Colors.primary.orange },
  timelineContent: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  timelineText: { fontSize: 14, color: Colors.text.primary, flex: 1 },

  statsCard: { marginBottom: 20 },
  statsHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
  statsTitle: { fontSize: 16, fontWeight: '600', color: Colors.text.primary },
  statsGrid: { gap: 12 },
  statItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: Colors.border.light },
  statLabel: { fontSize: 14, color: Colors.text.secondary },
  statValue: { fontSize: 14, fontWeight: '600', color: Colors.text.primary },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: Colors.background.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, gap: 16 },
  modalTitle: { fontSize: 20, fontWeight: '700', color: Colors.text.primary, textAlign: 'center' },
  teamSelector: { flexDirection: 'row', gap: 12 },
  teamOption: { flex: 1, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: Colors.border.light, alignItems: 'center' },
  teamOptionSelected: { backgroundColor: Colors.primary.orange, borderColor: Colors.primary.orange },
  teamOptionText: { fontSize: 14, fontWeight: '600', color: Colors.text.primary },
  cardTypeSelector: { flexDirection: 'row', gap: 12 },
  cardOption: { flex: 1, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: Colors.border.light, alignItems: 'center', gap: 8 },
  cardOptionSelected: { backgroundColor: Colors.primary.orange, borderColor: Colors.primary.orange },
  cardPreview: { width: 20, height: 28, borderRadius: 4 },
  cardOptionText: { fontSize: 14, fontWeight: '600', color: Colors.text.primary },
  input: { borderWidth: 1, borderColor: Colors.border.light, borderRadius: 12, padding: 16, fontSize: 16, color: Colors.text.primary },
  modalActions: { flexDirection: 'row', gap: 12 },
  errorContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  errorText: { fontSize: 18, color: Colors.text.primary },
});
