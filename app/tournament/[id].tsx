import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity, Alert, ActivityIndicator, Platform, RefreshControl, Dimensions, Share, Animated, TextInput } from 'react-native';
import { useRouter, useLocalSearchParams, Stack } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Trophy, Calendar, MapPin, Users, Award, DollarSign, UserMinus, CheckCircle, ChevronRight, Settings, Clock, Shield, Zap, Target, Share2, Info, Flame, TrendingUp, Search, Star, CreditCard, FileText } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { Avatar } from '@/components/Avatar';
import { PaymentInstructions } from '@/components/PaymentInstructions';
import { PaymentSubmissionModal } from '@/components/PaymentSubmissionModal';
import { TeamStatusBadge } from '@/components/TeamStatusBadge';
import { useAuth } from '@/contexts/AuthContext';
import { useTournaments } from '@/contexts/TournamentsContext';
import { useTeams } from '@/contexts/TeamsContext';
import { tournamentsApi } from '@/lib/api/tournaments';
import { tournamentTeamsApi, tournamentPaymentsApi } from '@/lib/api/tournament-payments';
import { sportLabels, levelLabels } from '@/mocks/data';
import type { Tournament, Match, TournamentTeam, PaymentMethod } from '@/types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function TournamentDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user, isAdmin } = useAuth();
  const { getTournamentById, registerTeam, unregisterTeam, refetchTournaments, isRegistering } = useTournaments();
  const { getUserTeams, getTeamById } = useTeams();
  const fromContext = getTournamentById(id || '');
  const [fetchedTournament, setFetchedTournament] = useState<Tournament | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [showPaymentInstructions, setShowPaymentInstructions] = useState(false);
  const [showPaymentSubmission, setShowPaymentSubmission] = useState(false);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<PaymentMethod>('wave');
  useEffect(() => {
    if (!successMessage) return;
    const t = setTimeout(() => setSuccessMessage(null), 2500);
    return () => clearTimeout(t);
  }, [successMessage]);
  const tournamentMatchesQuery = useQuery({
    queryKey: ['tournament-matches', id],
    queryFn: () => tournamentsApi.getMatches(id || ''),
    enabled: !!id && (!!fromContext || !!fetchedTournament),
  });
  const tournamentMatches: Match[] = tournamentMatchesQuery.data ?? [];

  // Récupérer les équipes inscrites avec leurs statuts
  const tournamentTeamsQuery = useQuery({
    queryKey: ['tournament-teams', id],
    queryFn: () => tournamentTeamsApi.getTournamentTeams(id!),
    enabled: !!id,
  });
  const tournamentTeams: TournamentTeam[] = tournamentTeamsQuery.data ?? [];

  // Récupérer le statut de paiement de l'équipe de l'utilisateur
  const myTeamInTournament = useMemo(() => {
    if (!user) return null;
    const myTeams = getUserTeams(user.id).filter(t => t.captainId === user.id);
    return tournamentTeams.find(tt => myTeams.some(mt => mt.id === tt.teamId));
  }, [user, tournamentTeams, getUserTeams]);

  const myPaymentQuery = useQuery({
    queryKey: ['my-payment', id, myTeamInTournament?.teamId],
    queryFn: () => tournamentPaymentsApi.getPayment(id!, myTeamInTournament!.teamId),
    enabled: !!id && !!myTeamInTournament,
  });
  const myPayment = myPaymentQuery.data;

  const onRefreshDetail = useCallback(async () => {
    setRefreshing(true);
    try {
      await refetchTournaments();
      if (id) {
        const t = await tournamentsApi.getById(id);
        setFetchedTournament(t);
      }
      await tournamentMatchesQuery?.refetch?.();
      await tournamentTeamsQuery?.refetch?.();
      if (myTeamInTournament) {
        await myPaymentQuery?.refetch?.();
      }
    } finally {
      setRefreshing(false);
    }
  }, [id, refetchTournaments, tournamentMatchesQuery, tournamentTeamsQuery, myTeamInTournament, myPaymentQuery]);

  useFocusEffect(
    useCallback(() => {
      if (!id) return;
      refetchTournaments();
      if (!fromContext) tournamentsApi.getById(id).then(setFetchedTournament).catch(() => setFetchedTournament(null));
    }, [id, fromContext, refetchTournaments])
  );

  const getErrorMessage = useCallback((e: unknown) => {
    const msg = (e as Error)?.message ?? '';
    if (!msg || msg.includes('fetch') || msg.includes('network') || msg.includes('Failed')) return 'Problème de connexion. Réessayez.';
    return msg;
  }, []);

  const standings = React.useMemo(() => {
    const map: Record<string, { teamId: string; played: number; wins: number; draws: number; losses: number; goalsFor: number; goalsAgainst: number }> = {};
    tournamentMatches.filter(m => m.status === 'completed' && m.score != null).forEach((m) => {
      const home = m.homeTeamId ?? '';
      const away = m.awayTeamId ?? '';
      const sh = m.score!.home;
      const sa = m.score!.away;
      if (home && !map[home]) map[home] = { teamId: home, played: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0 };
      if (away && !map[away]) map[away] = { teamId: away, played: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0 };
      if (home) {
        map[home].played++;
        map[home].goalsFor += sh;
        map[home].goalsAgainst += sa;
        if (sh > sa) map[home].wins++; else if (sh < sa) map[home].losses++; else map[home].draws++;
      }
      if (away) {
        map[away].played++;
        map[away].goalsFor += sa;
        map[away].goalsAgainst += sh;
        if (sa > sh) map[away].wins++; else if (sa < sh) map[away].losses++; else map[away].draws++;
      }
    });
    return Object.values(map)
      .map((s) => ({ ...s, points: s.wins * 3 + s.draws, diff: s.goalsFor - s.goalsAgainst }))
      .sort((a, b) => b.points - a.points || b.diff - a.diff);
  }, [tournamentMatches]);

  useEffect(() => {
    if (id && !fromContext) {
      setLoading(true);
      tournamentsApi.getById(id)
        .then(t => setFetchedTournament(t))
        .catch(() => setFetchedTournament(null))
        .finally(() => setLoading(false));
    } else {
      setFetchedTournament(null);
    }
  }, [id, fromContext]);

  const tournament = fromContext ?? fetchedTournament;
  const registeredTeamIds = useMemo(
    () => (tournamentTeamsQuery.isSuccess ? tournamentTeams.map((tt) => tt.teamId) : (tournament?.registeredTeams ?? [])),
    [tournamentTeamsQuery.isSuccess, tournamentTeams, tournament?.registeredTeams]
  );
  const teamStatusById = useMemo(
    () => new Map(tournamentTeams.map((tt) => [tt.teamId, tt.status] as const)),
    [tournamentTeams]
  );
  const activeRegisteredTeamIds = useMemo(
    () => (
      tournamentTeamsQuery.isSuccess
        ? tournamentTeams
            .filter((tt) => tt.status !== 'rejected' && tt.status !== 'cancelled')
            .map((tt) => tt.teamId)
        : registeredTeamIds
    ),
    [tournamentTeamsQuery.isSuccess, tournamentTeams, registeredTeamIds]
  );
  const reservedSpots = useMemo(
    () => (
      tournamentTeamsQuery.isSuccess
        ? tournamentTeams.filter((tt) => tt.status === 'confirmed' || tt.status === 'payment_submitted').length
        : registeredTeamIds.length
    ),
    [tournamentTeamsQuery.isSuccess, tournamentTeams, registeredTeamIds.length]
  );
  const teamsWhereCaptain = user ? getUserTeams(user.id).filter((t) => t.captainId === user.id) : [];
  const canRegisterTeam = tournament?.status === 'registration' && teamsWhereCaptain.length > 0;
  const teamAlreadyRegistered = (tid: string) => activeRegisteredTeamIds.includes(tid);
  const teamsEligibleToRegister = teamsWhereCaptain.filter((t) => !teamAlreadyRegistered(t.id));
  const isCreatorOrAdmin = user && tournament && (
    tournament.createdBy === user.id
    || isAdmin
    || (tournament.managers ?? []).includes(user.id)
  );
  const canManage = isCreatorOrAdmin && !!tournament;

  const goBack = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/tournaments' as any);
    }
  }, [router]);
  const isFull = tournament ? reservedSpots >= tournament.maxTeams : false;
  const userIsRegistered = !!(user && (myTeamInTournament || activeRegisteredTeamIds.some((tid) => getTeamById(tid)?.captainId === user.id)));
  const joinLabel = teamsEligibleToRegister.length === 1
    ? `Inscrire ${teamsEligibleToRegister[0].name}`
    : teamsEligibleToRegister.length > 1
      ? 'Choisir une équipe à inscrire'
      : 'Rejoindre le tournoi';

  if (loading && !tournament) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.container}>
          <LinearGradient colors={[Colors.background.dark, '#0D1420']} style={StyleSheet.absoluteFill} />
          <SafeAreaView style={styles.safeArea}>
            <View style={styles.header}>
              <TouchableOpacity style={styles.backButton} onPress={goBack}>
                <ArrowLeft size={24} color={Colors.text.primary} />
              </TouchableOpacity>
              <Text style={styles.headerTitle}>Tournoi</Text>
              <View style={styles.placeholder} />
            </View>
            <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
              <View style={styles.skeletonHero}>
                <View style={styles.skeletonBadge} />
                <View style={styles.skeletonTitleLg} />
                <View style={styles.skeletonTitleSm} />
                <View style={styles.skeletonStatsRow}>
                  <View style={styles.skeletonStat} />
                  <View style={styles.skeletonStat} />
                  <View style={styles.skeletonStat} />
                </View>
              </View>
              <View style={styles.skeletonTabBar}>
                <View style={styles.skeletonTab} /><View style={styles.skeletonTab} /><View style={styles.skeletonTab} /><View style={styles.skeletonTab} />
              </View>
              {[1, 2, 3].map(i => (
                <View key={i} style={styles.skeletonCard}>
                  <View style={styles.skeletonLine} />
                  <View style={[styles.skeletonLine, { width: '60%' }]} />
                </View>
              ))}
            </ScrollView>
          </SafeAreaView>
        </View>
      </>
    );
  }

  if (!tournament) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.container}>
          <LinearGradient colors={[Colors.background.dark, '#0D1420']} style={StyleSheet.absoluteFill} />
          <SafeAreaView style={styles.safeArea}>
            <View style={styles.header}>
              <TouchableOpacity style={styles.backButton} onPress={goBack}>
                <ArrowLeft size={24} color={Colors.text.primary} />
              </TouchableOpacity>
              <Text style={styles.headerTitle}>Tournoi</Text>
              <View style={styles.placeholder} />
            </View>
            <View style={styles.notFoundContainer}>
              <Trophy size={64} color={Colors.text.muted} />
              <Text style={styles.notFoundTitle}>Tournoi introuvable</Text>
              <Button title="Retour" onPress={goBack} variant="primary" />
            </View>
          </SafeAreaView>
        </View>
      </>
    );
  }

  const formatDate = (date: Date | string | null | undefined) => {
    if (date == null) return '–';
    const d = new Date(date);
    if (Number.isNaN(d.getTime())) return '–';
    return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  };

  const getStatusLabel = (status: string | undefined) => {
    switch (status) {
      case 'registration': return 'Inscriptions ouvertes';
      case 'in_progress':
      case 'ongoing': return 'En cours';
      case 'completed': return 'Terminé';
      default: return status ?? '–';
    }
  };

  const getStatusColor = (status: string | undefined) => {
    switch (status) {
      case 'registration': return Colors.status.success;
      case 'in_progress':
      case 'ongoing': return Colors.primary.orange;
      case 'completed': return Colors.text.muted;
      default: return Colors.text.muted;
    }
  };

  const handleRegister = () => {
    if (tournament.status !== 'registration') {
      Alert.alert('Inscriptions fermées', 'Les inscriptions pour ce tournoi sont terminées.');
      return;
    }
    if (teamsEligibleToRegister.length === 0) {
      if (teamsWhereCaptain.length > 0) {
        Alert.alert('Déjà inscrites', 'Toutes vos équipes dont vous êtes capitaine sont déjà inscrites à ce tournoi.');
      } else {
        Alert.alert('Réservé au capitaine', 'Seul le capitaine d\'une équipe peut l\'inscrire à un tournoi. Vous n\'êtes actuellement capitaine d\'aucune équipe.');
      }
      return;
    }
    const teamToRegister = teamsEligibleToRegister.length === 1
      ? teamsEligibleToRegister[0]
      : null;
    if (teamToRegister) {
      Alert.alert(
        'Inscription au tournoi',
        `Inscrire ${teamToRegister.name} au tournoi "${tournament.name}" ?\n\nFrais d'inscription : ${(tournament.entryFee ?? 0).toLocaleString()} FCFA`,
        [
          { text: 'Annuler', style: 'cancel' },
          {
            text: 'Confirmer',
            onPress: async () => {
              try {
                await registerTeam({ tournamentId: tournament.id, teamId: teamToRegister.id });
                await refetchTournaments();
                if (id) {
                  const updated = await tournamentsApi.getById(id).catch(() => null);
                  if (updated) setFetchedTournament(updated);
                }
                setSuccessMessage(`${teamToRegister.name} inscrite au tournoi !`);
              } catch (e: unknown) {
                Alert.alert('Erreur', getErrorMessage(e));
              }
            },
          },
        ]
      );
      return;
    }
    const buttons = teamsEligibleToRegister.slice(0, 4).map((t) => ({
      text: t.name,
      onPress: async () => {
        try {
          await registerTeam({ tournamentId: tournament.id, teamId: t.id });
          await refetchTournaments();
          if (id) {
            const updated = await tournamentsApi.getById(id).catch(() => null);
            if (updated) setFetchedTournament(updated);
          }
          setSuccessMessage(`${t.name} inscrite au tournoi !`);
        } catch (e: unknown) {
          Alert.alert('Erreur', getErrorMessage(e));
        }
      },
    }));
    Alert.alert(
      'Choisir l\'équipe à inscrire',
      `Frais d'inscription : ${tournament.entryFee.toLocaleString()} FCFA par équipe`,
      [{ text: 'Annuler', style: 'cancel' }, ...buttons]
    );
  };

  const handleUnregister = (teamId: string) => {
    const team = getTeamById(teamId);
    const name = team?.name ?? 'Cette équipe';
    Alert.alert('Se désinscrire', `Retirer ${name} du tournoi ?`, [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Oui',
        onPress: async () => {
          try {
            await unregisterTeam({ tournamentId: tournament.id, teamId });
            await tournamentTeamsQuery.refetch();
            await refetchTournaments();
            if (id) {
              const updated = await tournamentsApi.getById(id).catch(() => null);
              if (updated) setFetchedTournament(updated);
            }
            setSuccessMessage('Équipe retirée du tournoi.');
          } catch (e: unknown) {
            Alert.alert('Erreur', getErrorMessage(e));
          }
        },
      },
    ]);
  };

  const handleShare = async () => {
    try {
      await Share.share({
        message: `${tournament.name} — ${(sportLabels?.[tournament.sport]) ?? tournament.sport}\n${(tournament.prizePool ?? 0).toLocaleString()} FCFA à gagner\nRejoins le tournoi sur VersUS !`,
      });
    } catch (_) {}
  };

  const getDaysUntil = (date: Date | string | null | undefined) => {
    if (!date) return null;
    const now = new Date();
    const target = new Date(date);
    const diff = Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return diff;
  };
  const daysUntilStart = getDaysUntil(tournament.startDate);
  const daysUntilEnd = getDaysUntil(tournament.endDate);
  const countdownText = tournament.status === 'registration'
    ? daysUntilStart != null && daysUntilStart >= 0
      ? daysUntilStart === 0 ? "Commence aujourd'hui" : daysUntilStart === 1 ? 'Commence demain' : `Commence dans ${daysUntilStart} jours`
      : null
    : tournament.status === 'in_progress'
      ? daysUntilEnd != null && daysUntilEnd >= 0
        ? daysUntilEnd === 0 ? 'Dernier jour' : `${daysUntilEnd}j restants`
        : null
      : null;

  type TabKey = 'overview' | 'matches' | 'standings' | 'teams';
  const [activeTab, setActiveTab] = useState<TabKey>('overview');
  const hasMatches = tournamentMatches.length > 0;
  const hasStandings = standings.length > 0;

  const tabFade = React.useRef(new Animated.Value(1)).current;
  const switchTab = useCallback((tab: TabKey) => {
    Animated.timing(tabFade, { toValue: 0, duration: 100, useNativeDriver: true }).start(() => {
      setActiveTab(tab);
      Animated.timing(tabFade, { toValue: 1, duration: 200, useNativeDriver: true }).start();
    });
  }, [tabFade]);

  const [descExpanded, setDescExpanded] = useState(false);
  const descIsLong = (tournament.description?.length ?? 0) > 150;

  const heroGradient: [string, string] = tournament.status === 'completed'
    ? ['#7C3AED', '#6366F1']
    : tournament.status === 'in_progress'
      ? ['#059669', '#10B981']
      : ['#EA580C', '#FB923C'];

  const completedCount = tournamentMatches.filter(m => m.status === 'completed').length;
  const liveCount = tournamentMatches.filter(m => m.status === 'in_progress').length;
  const upcomingCount = tournamentMatches.filter(m => m.status !== 'completed' && m.status !== 'in_progress').length;

  const pulseAnim = React.useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (liveCount > 0) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 0.3, duration: 800, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
        ])
      ).start();
    }
  }, [liveCount, pulseAnim]);

  const registrationPct = tournament.maxTeams > 0
    ? Math.round((reservedSpots / tournament.maxTeams) * 100)
    : 0;

  const sortedMatches = [...tournamentMatches].sort((a, b) => new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime());

  type MatchFilter = 'all' | 'live' | 'completed' | 'upcoming';
  const [matchFilter, setMatchFilter] = useState<MatchFilter>('all');
  const filteredMatches = React.useMemo(() => {
    if (matchFilter === 'all') return sortedMatches;
    if (matchFilter === 'live') return sortedMatches.filter(m => m.status === 'in_progress');
    if (matchFilter === 'completed') return sortedMatches.filter(m => m.status === 'completed');
    return sortedMatches.filter(m => m.status !== 'completed' && m.status !== 'in_progress');
  }, [sortedMatches, matchFilter]);
  const filteredByRound: Record<string, Match[]> = {};
  filteredMatches.forEach(m => {
    const key = m.roundLabel || 'Matchs';
    if (!filteredByRound[key]) filteredByRound[key] = [];
    filteredByRound[key].push(m);
  });

  const nextMatch = React.useMemo(() => {
    const now = Date.now();
    return sortedMatches.find(m => m.status !== 'completed' && m.status !== 'in_progress' && new Date(m.dateTime).getTime() > now) ?? null;
  }, [sortedMatches]);

  const lastResult = React.useMemo(() => {
    return [...tournamentMatches]
      .filter(m => m.status === 'completed' && m.score != null)
      .sort((a, b) => new Date(b.dateTime).getTime() - new Date(a.dateTime).getTime())[0] ?? null;
  }, [tournamentMatches]);
  const matchesByRound: Record<string, Match[]> = {};
  sortedMatches.forEach(m => {
    const key = m.roundLabel || 'Matchs';
    if (!matchesByRound[key]) matchesByRound[key] = [];
    matchesByRound[key].push(m);
  });

  // Tournament statistics dashboard
  type TournamentStats = {
    totalGoals: number;
    avgGoals: string;
    biggestWin: { match: Match; diff: number } | null;
    progressPct: number;
    completedMatches: number;
  };

  const tournamentStats = useMemo<TournamentStats>(() => {
    const completedMatches = tournamentMatches.filter(m => m.status === 'completed' && m.score != null);
    const totalGoals = completedMatches.reduce((sum, m) => sum + (m.score?.home ?? 0) + (m.score?.away ?? 0), 0);
    const avgGoals = completedMatches.length > 0 ? (totalGoals / completedMatches.length).toFixed(1) : '0';
    let biggestWin: { match: Match; diff: number } | null = null;
    completedMatches.forEach(m => {
      const diff = Math.abs((m.score?.home ?? 0) - (m.score?.away ?? 0));
      if (!biggestWin || diff > biggestWin.diff) biggestWin = { match: m, diff };
    });
    const progressPct = tournamentMatches.length > 0
      ? Math.round((completedMatches.length / tournamentMatches.length) * 100)
      : 0;
    return { totalGoals, avgGoals, biggestWin, progressPct, completedMatches: completedMatches.length };
  }, [tournamentMatches]);

  // Hero entrance animation
  const heroScale = useRef(new Animated.Value(0.95)).current;
  const heroOpacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.spring(heroScale, { toValue: 1, friction: 8, tension: 40, useNativeDriver: true }),
      Animated.timing(heroOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
    ]).start();
  }, [heroScale, heroOpacity]);

  // Team search in teams tab
  const [teamSearch, setTeamSearch] = useState('');
  const filteredTeams = useMemo(() => {
    const teams = registeredTeamIds;
    if (!teamSearch.trim()) return teams;
    const q = teamSearch.toLowerCase();
    return teams.filter((tid: string) => {
      const t = getTeamById(tid);
      return t?.name?.toLowerCase().includes(q);
    });
  }, [registeredTeamIds, teamSearch, getTeamById]);

  const handlePaymentSuccess = useCallback(async () => {
    await Promise.all([
      tournamentTeamsQuery.refetch(),
      myPaymentQuery.refetch(),
      refetchTournaments(),
    ]);
    setShowPaymentSubmission(false);
    setShowPaymentInstructions(false);
    setSuccessMessage('Paiement soumis. En attente de validation admin.');
  }, [tournamentTeamsQuery, myPaymentQuery, refetchTournaments]);

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.container}>
        <LinearGradient colors={['#0F1523', '#121A2B']} style={StyleSheet.absoluteFill} />

        <SafeAreaView style={styles.safeArea}>
          <View style={styles.header}>
            <TouchableOpacity style={styles.backButton} onPress={goBack}>
              <ArrowLeft size={22} color={Colors.text.primary} />
            </TouchableOpacity>
            <Text style={styles.headerTitle} numberOfLines={1}>{tournament?.name ?? 'Tournoi'}</Text>
            <View style={styles.headerActions}>
              <TouchableOpacity style={styles.headerIconBtn} onPress={handleShare}>
                <Share2 size={18} color={Colors.text.primary} />
              </TouchableOpacity>
              {canManage && (
                <TouchableOpacity style={styles.headerIconBtn} onPress={() => router.push(`/edit-tournament/${tournament.id}`)}>
                  <Settings size={18} color={Colors.text.primary} />
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* ── TAB BAR ── */}
          <View style={styles.tabBar}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabBarInner}>
              {([
                { key: 'overview' as TabKey, label: 'Aperçu', icon: <Info size={14} color={activeTab === 'overview' ? Colors.primary.orange : Colors.text.muted} /> },
                ...(hasMatches ? [{ key: 'matches' as TabKey, label: 'Matchs', icon: <Target size={14} color={activeTab === 'matches' ? Colors.primary.orange : Colors.text.muted} />, badge: liveCount > 0 ? liveCount : undefined }] : []),
                ...(hasStandings ? [{ key: 'standings' as TabKey, label: 'Classement', icon: <Trophy size={14} color={activeTab === 'standings' ? Colors.primary.orange : Colors.text.muted} /> }] : []),
                { key: 'teams' as TabKey, label: 'Équipes', icon: <Users size={14} color={activeTab === 'teams' ? Colors.primary.orange : Colors.text.muted} /> },
              ] as { key: TabKey; label: string; icon: React.ReactNode; badge?: number }[]).map((tab) => (
                <TouchableOpacity key={tab.key} style={[styles.tabItem, activeTab === tab.key && styles.tabItemActive]} onPress={() => switchTab(tab.key)}>
                  {tab.icon}
                  <Text style={[styles.tabLabel, activeTab === tab.key && styles.tabLabelActive]}>{tab.label}</Text>
                  {tab.badge != null && tab.badge > 0 && (
                    <View style={styles.tabBadge}>
                      <Animated.View style={[styles.tabBadgePulse, { opacity: pulseAnim }]} />
                      <Text style={styles.tabBadgeText}>{tab.badge}</Text>
                    </View>
                  )}
                  {activeTab === tab.key && <View style={styles.tabUnderline} />}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefreshDetail} tintColor={Colors.primary.orange} />}
          >
            {/* ── HERO (always visible) ── */}
            <Animated.View style={{ transform: [{ scale: heroScale }], opacity: heroOpacity }}>
              <LinearGradient colors={heroGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.heroCard}>
                <View style={styles.heroTopRow}>
                  <View style={[styles.statusBadge, { backgroundColor: 'rgba(0,0,0,0.3)' }]}>
                    <View style={[styles.statusDot, { backgroundColor: getStatusColor(tournament.status) }]} />
                    <Text style={styles.statusText}>{getStatusLabel(tournament.status)}</Text>
                  </View>
                  <Text style={styles.heroSport}>{(sportLabels?.[tournament.sport]) ?? tournament.sport ?? '–'}</Text>
                </View>
                <Text style={styles.tournamentName}>{tournament?.name ?? 'Tournoi'}</Text>
                <View style={styles.heroQuickInfo}>
                  <Text style={styles.heroQuickText}>{tournament.format ?? '–'} • {(levelLabels?.[tournament.level]) ?? tournament.level ?? '–'}</Text>
                </View>
                {(tournament.prizePool ?? 0) > 0 && (
                  <View style={styles.prizeSection}>
                    <Trophy size={20} color="#FFD700" />
                    <Text style={styles.prizeAmount}>{(tournament.prizePool ?? 0).toLocaleString()} FCFA</Text>
                  </View>
                )}
                <View style={styles.heroStatsRow}>
                  <View style={styles.heroStat}><Text style={styles.heroStatValue}>{reservedSpots}/{tournament.maxTeams}</Text><Text style={styles.heroStatLabel}>équipes</Text></View>
                  {hasMatches && <View style={styles.heroStat}><Text style={styles.heroStatValue}>{tournamentMatches.length}</Text><Text style={styles.heroStatLabel}>matchs</Text></View>}
                  {completedCount > 0 && <View style={styles.heroStat}><Text style={styles.heroStatValue}>{completedCount}</Text><Text style={styles.heroStatLabel}>joués</Text></View>}
                  {tournamentStats.totalGoals > 0 && <View style={styles.heroStat}><Text style={styles.heroStatValue}>{tournamentStats.totalGoals}</Text><Text style={styles.heroStatLabel}>buts</Text></View>}
                </View>
                {tournament.status === 'registration' && (
                  <View style={styles.progressBarContainer}>
                    <View style={styles.progressBarBg}><View style={[styles.progressBarFill, { width: `${Math.min(registrationPct, 100)}%` }]} /></View>
                    <View style={styles.progressBarRow}>
                      <Text style={styles.progressBarText}>{registrationPct >= 100 ? 'Complet' : `${registrationPct}% rempli`}</Text>
                      {registrationPct >= 80 && registrationPct < 100 && (
                        <Text style={styles.urgencyText}>Plus que {Math.max(tournament.maxTeams - reservedSpots, 0)} place{Math.max(tournament.maxTeams - reservedSpots, 0) > 1 ? 's' : ''} !</Text>
                      )}
                    </View>
                  </View>
                )}
                {tournament.status === 'in_progress' && hasMatches && (
                  <View style={styles.progressBarContainer}>
                    <View style={styles.progressBarBg}><View style={[styles.progressBarFill, { width: `${tournamentStats.progressPct}%`, backgroundColor: Colors.status.success }]} /></View>
                    <Text style={styles.progressBarText}>{tournamentStats.progressPct}% du tournoi terminé</Text>
                  </View>
                )}
                {countdownText && <View style={styles.countdownBadge}><Clock size={13} color="#FFFFFF" /><Text style={styles.countdownText}>{countdownText}</Text></View>}
              </LinearGradient>
            </Animated.View>

            {/* Winner banner */}
            {tournament.status === 'completed' && tournament.winnerId && (
              <LinearGradient colors={['#FFD700', '#FFA000']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.winnerBanner}>
                <View style={styles.winnerBannerDecor}>
                  <Star size={14} color="#1A1A2E" fill="#1A1A2E" />
                </View>
                <Trophy size={26} color="#1A1A2E" />
                <View style={styles.winnerBannerContent}>
                  <Text style={styles.winnerBannerLabel}>CHAMPION</Text>
                  <Text style={styles.winnerBannerName}>{getTeamById(tournament.winnerId)?.name ?? 'Équipe gagnante'}</Text>
                </View>
                <Trophy size={26} color="#1A1A2E" />
                <View style={styles.winnerBannerDecor}>
                  <Star size={14} color="#1A1A2E" fill="#1A1A2E" />
                </View>
              </LinearGradient>
            )}

            {successMessage && <View style={styles.successBanner}><CheckCircle size={18} color="#FFF" /><Text style={styles.successBannerText}>{successMessage}</Text></View>}

            {/* Live matches - always visible when active */}
            {liveCount > 0 && (
              <LinearGradient colors={[Colors.status.error + '12', Colors.status.error + '05']} style={styles.liveCardGradient}>
                <View style={styles.liveHeader}>
                  <Animated.View style={[styles.livePulse, { opacity: pulseAnim }]} />
                  <Text style={styles.liveHeaderText}>EN DIRECT</Text>
                  <View style={styles.liveCountBox}><Text style={styles.liveCountBadge}>{liveCount}</Text></View>
                </View>
                {sortedMatches.filter(m => m.status === 'in_progress').map((m) => {
                  const hN = getTeamById(m.homeTeamId ?? '')?.name ?? 'TBD';
                  const aN = getTeamById(m.awayTeamId ?? '')?.name ?? 'TBD';
                  return (
                    <View key={m.id} style={styles.liveMatchRow}>
                      {m.roundLabel ? <Text style={styles.liveRoundLabel}>{m.roundLabel}</Text> : null}
                      <View style={styles.liveMatchTeams}>
                        <View style={styles.liveTeamCol}>
                          <Avatar uri={getTeamById(m.homeTeamId ?? '')?.logo} name={hN} size="small" />
                          <Text style={styles.liveTeamName} numberOfLines={1}>{hN}</Text>
                        </View>
                        <View style={styles.liveScoreBox}>
                          <Text style={styles.liveScore}>{m.score?.home ?? 0}</Text>
                          <Text style={styles.liveScoreSep}>:</Text>
                          <Text style={styles.liveScore}>{m.score?.away ?? 0}</Text>
                        </View>
                        <View style={[styles.liveTeamCol, { alignItems: 'flex-end' }]}>
                          <Avatar uri={getTeamById(m.awayTeamId ?? '')?.logo} name={aN} size="small" />
                          <Text style={[styles.liveTeamName, { textAlign: 'right' }]} numberOfLines={1}>{aN}</Text>
                        </View>
                      </View>
                    </View>
                  );
                })}
              </LinearGradient>
            )}

            {/* ═══════ TAB: OVERVIEW ═══════ */}
            {activeTab === 'overview' && (
              <Animated.View style={{ opacity: tabFade }}>
                {/* Last result prominent card */}
                {lastResult && (
                  <TouchableOpacity style={styles.lastResultCard} onPress={() => switchTab('matches')} activeOpacity={0.8}>
                    <View style={styles.lastResultHeader}>
                      <View style={styles.lastResultDot} />
                      <Text style={styles.lastResultLabel}>DERNIER RÉSULTAT</Text>
                      {lastResult.roundLabel && <Text style={styles.lastResultRound}>{lastResult.roundLabel}</Text>}
                    </View>
                    <View style={styles.lastResultBody}>
                      <View style={styles.lastResultTeam}>
                        <Avatar uri={getTeamById(lastResult.homeTeamId ?? '')?.logo} name={getTeamById(lastResult.homeTeamId ?? '')?.name ?? '?'} size="small" />
                        <Text style={[styles.lastResultTeamName, lastResult.score && lastResult.score.home > lastResult.score.away && styles.lastResultWinnerName]} numberOfLines={1}>{getTeamById(lastResult.homeTeamId ?? '')?.name ?? '?'}</Text>
                      </View>
                      <View style={styles.lastResultScoreBox}>
                        <Text style={styles.lastResultScore}>{lastResult.score?.home ?? 0} - {lastResult.score?.away ?? 0}</Text>
                      </View>
                      <View style={[styles.lastResultTeam, { alignItems: 'flex-end' }]}>
                        <Avatar uri={getTeamById(lastResult.awayTeamId ?? '')?.logo} name={getTeamById(lastResult.awayTeamId ?? '')?.name ?? '?'} size="small" />
                        <Text style={[styles.lastResultTeamName, { textAlign: 'right' }, lastResult.score && lastResult.score.away > lastResult.score.home && styles.lastResultWinnerName]} numberOfLines={1}>{getTeamById(lastResult.awayTeamId ?? '')?.name ?? '?'}</Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                )}

                {/* Next match card */}
                {nextMatch && (
                  <TouchableOpacity style={styles.nextMatchCard} onPress={() => switchTab('matches')} activeOpacity={0.8}>
                    <LinearGradient colors={[Colors.primary.blue + '12', Colors.primary.blue + '04']} style={styles.nextMatchGradient}>
                      <View style={styles.nextMatchHeader}>
                        <Clock size={12} color={Colors.primary.blue} />
                        <Text style={styles.nextMatchLabel}>PROCHAIN MATCH</Text>
                        {nextMatch.roundLabel && <Text style={styles.nextMatchRound}>{nextMatch.roundLabel}</Text>}
                      </View>
                      <View style={styles.nextMatchBody}>
                        <Text style={styles.nextMatchTeams} numberOfLines={1}>{getTeamById(nextMatch.homeTeamId ?? '')?.name ?? 'TBD'} vs {getTeamById(nextMatch.awayTeamId ?? '')?.name ?? 'TBD'}</Text>
                        <Text style={styles.nextMatchTime}>{new Date(nextMatch.dateTime).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</Text>
                      </View>
                    </LinearGradient>
                  </TouchableOpacity>
                )}

                {/* Stats dashboard */}
                {tournamentStats.completedMatches > 0 && (
                  <View style={styles.statsSection}>
                    <View style={styles.statsSectionHeader}>
                      <TrendingUp size={15} color={Colors.primary.orange} />
                      <Text style={styles.sectionTitle}>Statistiques</Text>
                    </View>
                    <View style={styles.statsRow}>
                      <View style={styles.statTile}>
                        <LinearGradient colors={[Colors.primary.orange + '18', Colors.primary.orange + '06']} style={styles.statTileGradient}>
                          <View style={[styles.statTileIconWrap, { backgroundColor: Colors.primary.orange + '20' }]}>
                            <Target size={16} color={Colors.primary.orange} />
                          </View>
                          <Text style={styles.statTileValue}>{tournamentStats.totalGoals}</Text>
                          <Text style={styles.statTileLabel}>Buts marqués</Text>
                        </LinearGradient>
                      </View>
                      <View style={styles.statTile}>
                        <LinearGradient colors={[Colors.primary.blue + '18', Colors.primary.blue + '06']} style={styles.statTileGradient}>
                          <View style={[styles.statTileIconWrap, { backgroundColor: Colors.primary.blue + '20' }]}>
                            <TrendingUp size={16} color={Colors.primary.blue} />
                          </View>
                          <Text style={styles.statTileValue}>{tournamentStats.avgGoals}</Text>
                          <Text style={styles.statTileLabel}>Buts/match</Text>
                        </LinearGradient>
                      </View>
                    </View>
                    <View style={styles.statsRow}>
                      <View style={styles.statTile}>
                        <LinearGradient colors={[Colors.status.success + '18', Colors.status.success + '06']} style={styles.statTileGradient}>
                          <View style={[styles.statTileIconWrap, { backgroundColor: Colors.status.success + '20' }]}>
                            <CheckCircle size={16} color={Colors.status.success} />
                          </View>
                          <Text style={styles.statTileValue}>{tournamentStats.completedMatches}</Text>
                          <Text style={styles.statTileLabel}>Matchs joués</Text>
                        </LinearGradient>
                      </View>
                      <View style={styles.statTile}>
                        <LinearGradient colors={['#A855F7' + '18', '#A855F7' + '06']} style={styles.statTileGradient}>
                          <View style={[styles.statTileIconWrap, { backgroundColor: '#A855F7' + '20' }]}>
                            <Zap size={16} color="#A855F7" />
                          </View>
                          <Text style={styles.statTileValue}>{tournamentStats.biggestWin?.diff ?? 0}</Text>
                          <Text style={styles.statTileLabel}>Plus gros écart</Text>
                        </LinearGradient>
                      </View>
                    </View>
                    {tournamentStats.biggestWin && (
                      <View style={styles.biggestWinCard}>
                        <Flame size={14} color={Colors.primary.orange} />
                        <Text style={styles.biggestWinText}>
                          Plus gros score : {getTeamById(tournamentStats.biggestWin.match.homeTeamId ?? '')?.name ?? '?'} {tournamentStats.biggestWin.match.score?.home} - {tournamentStats.biggestWin.match.score?.away} {getTeamById(tournamentStats.biggestWin.match.awayTeamId ?? '')?.name ?? '?'}
                        </Text>
                      </View>
                    )}
                  </View>
                )}

                {/* Inscription */}
                {tournament.status === 'registration' && (
                  <Card style={styles.actionsCard}>
                    <View style={styles.actionsTitleRow}><Zap size={16} color={Colors.primary.orange} /><Text style={styles.sectionTitle}>Inscription</Text></View>
                    {userIsRegistered ? (
                      <View style={styles.dejaInscritBadge}><CheckCircle size={18} color={Colors.status.success} /><Text style={styles.dejaInscritText}>Votre équipe est inscrite</Text></View>
                    ) : isFull ? (
                      <View style={styles.fullBadge}><Text style={styles.fullBadgeText}>Complet ({reservedSpots}/{tournament.maxTeams})</Text></View>
                    ) : !user ? (
                      <Text style={styles.actionsMutedText}>Connectez-vous pour rejoindre.</Text>
                    ) : (
                      <>
                        <Button title={isRegistering ? 'Inscription...' : joinLabel} onPress={handleRegister} variant="orange" disabled={isFull || isRegistering} style={isFull ? styles.joinBtnDisabled : undefined} />
                        <Text style={styles.joinHint}>En tant que capitaine, inscrivez une de vos équipes.</Text>
                      </>
                    )}
                  </Card>
                )}
                {tournament.status === 'completed' && !tournament.winnerId && <Card style={styles.actionsCard}><Text style={styles.tournamentEndedText}>Ce tournoi est terminé.</Text></Card>}

                {/* Description */}
                {tournament.description && (
                  <View style={styles.descCard}>
                    <View style={styles.descHeader}>
                      <View style={styles.descAccent} />
                      <View>
                        <Text style={styles.descTitle}>À propos</Text>
                        <Text style={styles.descSubtitle}>{tournament.name}</Text>
                      </View>
                    </View>
                    <Text style={styles.descText} numberOfLines={descExpanded || !descIsLong ? undefined : 3}>{tournament.description}</Text>
                    {descIsLong && (
                      <TouchableOpacity onPress={() => setDescExpanded(!descExpanded)} style={styles.readMoreBtn}>
                        <Text style={styles.readMoreText}>{descExpanded ? 'Voir moins' : 'Lire la suite'}</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}

                {/* Phase progress */}
                {(tournament.status === 'in_progress' || tournament.status === 'completed') && hasMatches && Object.keys(matchesByRound).length > 1 && (
                  <View style={styles.progressCard}>
                    <View style={styles.progressHeader}>
                      <Target size={15} color={Colors.primary.orange} />
                      <Text style={styles.sectionTitle}>Progression</Text>
                      <View style={styles.progressPctBadge}><Text style={styles.progressPctText}>{tournamentStats.progressPct}%</Text></View>
                    </View>
                    <View style={styles.progressTimeline}>
                      {Object.keys(matchesByRound).map((round, i) => {
                        const rounds = Object.keys(matchesByRound);
                        const roundDone = matchesByRound[round].every(m => m.status === 'completed');
                        const roundLive = matchesByRound[round].some(m => m.status === 'in_progress');
                        const roundCount = matchesByRound[round].length;
                        const roundCompleted = matchesByRound[round].filter(m => m.status === 'completed').length;
                        const pct = roundCount > 0 ? Math.round((roundCompleted / roundCount) * 100) : 0;
                        return (
                          <View key={round} style={styles.progressStep}>
                            <View style={styles.progressStepLeft}>
                              <View style={[styles.progressDot, roundDone && styles.progressDotDone, roundLive && styles.progressDotLive]}>
                                {roundDone ? <CheckCircle size={12} color="#FFF" /> : roundLive ? <Flame size={10} color="#FFF" /> : <Text style={styles.progressDotNum}>{i + 1}</Text>}
                              </View>
                              {i < rounds.length - 1 && <View style={[styles.progressLine, roundDone && styles.progressLineDone]} />}
                            </View>
                            <View style={[styles.progressStepContent, roundLive && styles.progressStepActive]}>
                              <View style={styles.progressStepRow}>
                                <Text style={[styles.progressStepTitle, roundDone && styles.progressStepTitleDone, roundLive && styles.progressStepTitleLive]}>{round}</Text>
                                <Text style={[styles.progressStepCount, roundDone && { color: Colors.status.success }]}>{roundCompleted}/{roundCount}</Text>
                              </View>
                              <View style={styles.progressStepBarBg}>
                                <View style={[styles.progressStepBarFill, { width: `${pct}%` }, roundDone && { backgroundColor: Colors.status.success }, roundLive && { backgroundColor: Colors.primary.orange }]} />
                              </View>
                            </View>
                          </View>
                        );
                      })}
                    </View>
                  </View>
                )}

                {/* Info strip */}
                <View style={styles.infoStrip}>
                  <View style={styles.infoStripItem}>
                    <Calendar size={14} color={Colors.primary.blue} />
                    <View>
                      <Text style={styles.infoStripLabel}>Début</Text>
                      <Text style={styles.infoStripValue}>{tournament.startDate ? new Date(tournament.startDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }) : '–'}</Text>
                    </View>
                  </View>
                  <View style={styles.infoStripDivider} />
                  <View style={styles.infoStripItem}>
                    <Calendar size={14} color={Colors.primary.orange} />
                    <View>
                      <Text style={styles.infoStripLabel}>Fin</Text>
                      <Text style={styles.infoStripValue}>{tournament.endDate ? new Date(tournament.endDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }) : '–'}</Text>
                    </View>
                  </View>
                  <View style={styles.infoStripDivider} />
                  <View style={styles.infoStripItem}>
                    <DollarSign size={14} color={Colors.status.success} />
                    <View>
                      <Text style={styles.infoStripLabel}>Frais</Text>
                      <Text style={styles.infoStripValue}>{(tournament.entryFee ?? 0).toLocaleString()} F</Text>
                    </View>
                  </View>
                </View>

                {tournament.venue?.name && (
                  <View style={styles.venueCardNew}>
                    <LinearGradient colors={[Colors.primary.orange + '12', Colors.primary.orange + '04']} style={styles.venueGradient}>
                      <MapPin size={18} color={Colors.primary.orange} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.venueTitle}>{tournament.venue.name}</Text>
                        {tournament.venue.city ? <Text style={styles.venueCity}>{tournament.venue.city}</Text> : null}
                      </View>
                      <ChevronRight size={14} color={Colors.text.muted} />
                    </LinearGradient>
                  </View>
                )}

                {/* Format & details */}
                <View style={styles.detailsCard}>
                  <View style={styles.detailsHeader}>
                    <Info size={14} color={Colors.primary.blue} />
                    <Text style={styles.sectionTitle}>Détails du tournoi</Text>
                  </View>
                  <View style={styles.detailsGrid}>
                    <View style={styles.detailsItem}>
                      <Text style={styles.detailsLabel}>Sport</Text>
                      <Text style={styles.detailsValue}>{(sportLabels?.[tournament.sport]) ?? '–'}</Text>
                    </View>
                    <View style={styles.detailsItem}>
                      <Text style={styles.detailsLabel}>Format</Text>
                      <Text style={styles.detailsValue}>{tournament.format ?? '–'}</Text>
                    </View>
                    <View style={styles.detailsItem}>
                      <Text style={styles.detailsLabel}>Niveau</Text>
                      <Text style={styles.detailsValue}>{(levelLabels?.[tournament.level]) ?? '–'}</Text>
                    </View>
                    <View style={styles.detailsItem}>
                      <Text style={styles.detailsLabel}>Max équipes</Text>
                      <Text style={styles.detailsValue}>{tournament.maxTeams ?? '–'}</Text>
                    </View>
                  </View>
                </View>

                {/* Prizes */}
                {(tournament.prizes ?? []).length > 0 && (
                  <Card style={styles.prizesCard}>
                    <View style={styles.prizesTitleRow}><Award size={16} color="#FFD700" /><Text style={styles.sectionTitle}>Récompenses</Text></View>
                    {(tournament.prizes ?? []).map((prize, idx) => {
                      const medalColors = ['#FFD700', '#C0C0C0', '#CD7F32'];
                      const medalColor = medalColors[idx] ?? Colors.text.muted;
                      return (
                        <View key={idx} style={styles.prizeRow}>
                          <View style={[styles.positionBadge, { backgroundColor: medalColor + '18', borderWidth: 1, borderColor: medalColor + '30' }]}>
                            <Trophy size={12} color={medalColor} />
                            <Text style={[styles.positionText, { color: medalColor }]}>{prize?.label ?? `${idx + 1}e`}</Text>
                          </View>
                          <Text style={[styles.prizeRowAmount, idx === 0 && { color: '#FFD700', fontSize: 16 }]}>{(prize?.amount ?? 0).toLocaleString()} FCFA</Text>
                        </View>
                      );
                    })}
                  </Card>
                )}

                {tournament.sponsorName && <Card style={styles.sponsorCard}><Shield size={16} color={Colors.text.muted} /><View><Text style={styles.sponsorLabel}>Sponsorisé par</Text><Text style={styles.sponsorName}>{tournament.sponsorName}</Text></View></Card>}
              </Animated.View>
            )}

            {/* ═══════ TAB: MATCHES ═══════ */}
            {activeTab === 'matches' && hasMatches && (
              <Animated.View style={{ opacity: tabFade }}>
                <View style={styles.matchStatsRow}>
                  <View style={styles.matchStatChip}><Text style={styles.matchStatNum}>{tournamentMatches.length}</Text><Text style={styles.matchStatLabel}>total</Text></View>
                  {completedCount > 0 && <View style={[styles.matchStatChip, { backgroundColor: Colors.status.success + '18' }]}><Text style={[styles.matchStatNum, { color: Colors.status.success }]}>{completedCount}</Text><Text style={styles.matchStatLabel}>joués</Text></View>}
                  {liveCount > 0 && <View style={[styles.matchStatChip, { backgroundColor: Colors.status.error + '18' }]}><Text style={[styles.matchStatNum, { color: Colors.status.error }]}>{liveCount}</Text><Text style={styles.matchStatLabel}>live</Text></View>}
                  {upcomingCount > 0 && <View style={[styles.matchStatChip, { backgroundColor: Colors.primary.blue + '18' }]}><Text style={[styles.matchStatNum, { color: Colors.primary.blue }]}>{upcomingCount}</Text><Text style={styles.matchStatLabel}>à venir</Text></View>}
                </View>

                {/* Match filter chips */}
                <View style={styles.matchFilterRow}>
                  {([
                    { key: 'all' as MatchFilter, label: 'Tous', count: tournamentMatches.length },
                    ...(liveCount > 0 ? [{ key: 'live' as MatchFilter, label: 'Live', count: liveCount }] : []),
                    { key: 'completed' as MatchFilter, label: 'Terminés', count: completedCount },
                    { key: 'upcoming' as MatchFilter, label: 'À venir', count: upcomingCount },
                  ]).map(f => (
                    <TouchableOpacity key={f.key} style={[styles.matchFilterChip, matchFilter === f.key && styles.matchFilterChipActive]} onPress={() => setMatchFilter(f.key)}>
                      <Text style={[styles.matchFilterChipText, matchFilter === f.key && styles.matchFilterChipTextActive]}>{f.label}</Text>
                      <Text style={[styles.matchFilterChipCount, matchFilter === f.key && styles.matchFilterChipCountActive]}>{f.count}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {filteredMatches.length === 0 && (
                  <View style={styles.emptyTabState}>
                    <Target size={32} color={Colors.text.muted} />
                    <Text style={styles.emptyTabTitle}>Aucun match trouvé</Text>
                    <Text style={styles.emptyTabSub}>Changez le filtre pour voir d'autres matchs.</Text>
                  </View>
                )}

                {Object.entries(filteredByRound).map(([roundLabel, roundMatches]) => (
                  <View key={roundLabel} style={styles.roundBlock}>
                    <View style={styles.roundTitleRow}>
                      <View style={styles.roundTitleDot} />
                      <Text style={styles.roundTitle}>{roundLabel}</Text>
                      <Text style={styles.roundTitleCount}>{roundMatches.length} match{roundMatches.length > 1 ? 's' : ''}</Text>
                    </View>
                    {roundMatches.map((m) => {
                      const done = m.status === 'completed' && m.score != null;
                      const live = m.status === 'in_progress';
                      const hN = getTeamById(m.homeTeamId ?? '')?.name ?? 'TBD';
                      const aN = getTeamById(m.awayTeamId ?? '')?.name ?? 'TBD';
                      const matchDate = new Date(m.dateTime);
                      const now = new Date();
                      const diffH = Math.round((matchDate.getTime() - now.getTime()) / 3600000);
                      const relTime = live ? '' : done ? '' : diffH > 24 ? `Dans ${Math.round(diffH / 24)}j` : diffH > 0 ? `Dans ${diffH}h` : '';
                      return (
                        <View key={m.id} style={[styles.matchCard, live && styles.matchCardLive, done && styles.matchCardDone]}>
                          {live && <View style={styles.matchCardLiveBanner}><Animated.View style={[styles.matchCardLiveDot, { opacity: pulseAnim }]} /><Text style={styles.matchCardLiveText}>EN DIRECT</Text></View>}
                          <View style={styles.matchCardTeams}>
                            <View style={styles.matchCardTeamRow}>
                              <Avatar uri={getTeamById(m.homeTeamId ?? '')?.logo} name={hN} size="small" />
                              <Text style={[styles.matchCardTeamName, done && m.score!.home > m.score!.away && styles.matchCardWinner]} numberOfLines={1}>{hN}</Text>
                              <Text style={[styles.matchCardScoreNum, done && m.score!.home > m.score!.away && styles.matchCardWinnerScore]}>{done ? m.score!.home : live ? (m.score?.home ?? 0) : '-'}</Text>
                            </View>
                            <View style={styles.matchCardDivider} />
                            <View style={styles.matchCardTeamRow}>
                              <Avatar uri={getTeamById(m.awayTeamId ?? '')?.logo} name={aN} size="small" />
                              <Text style={[styles.matchCardTeamName, done && m.score!.away > m.score!.home && styles.matchCardWinner]} numberOfLines={1}>{aN}</Text>
                              <Text style={[styles.matchCardScoreNum, done && m.score!.away > m.score!.home && styles.matchCardWinnerScore]}>{done ? m.score!.away : live ? (m.score?.away ?? 0) : '-'}</Text>
                            </View>
                          </View>
                          <View style={styles.matchCardFooter}>
                            <View style={styles.matchCardFooterLeft}>
                              {live && <View style={styles.liveDot} />}
                              <Text style={[styles.matchCardStatus, live && { color: Colors.status.error }]}>
                                {live ? 'En cours' : done ? 'Terminé' : matchDate.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                              </Text>
                            </View>
                            {done && m.score!.home !== m.score!.away && (
                              <View style={styles.matchWinnerChip}>
                                <Trophy size={10} color={Colors.primary.orange} />
                                <Text style={styles.matchWinnerText} numberOfLines={1}>{m.score!.home > m.score!.away ? hN : aN}</Text>
                              </View>
                            )}
                            {relTime !== '' && <Text style={styles.matchCardRelTime}>{relTime}</Text>}
                          </View>
                        </View>
                      );
                    })}
                  </View>
                ))}
              </Animated.View>
            )}

            {/* ═══════ TAB: STANDINGS ═══════ */}
            {activeTab === 'standings' && hasStandings && (
              <Animated.View style={{ opacity: tabFade }}>
                {standings.length >= 2 && (
                  <View style={styles.podiumContainer}>
                    <Text style={styles.podiumTitle}>Podium</Text>
                    <View style={styles.podiumRow}>
                      {[1, 0, 2].map((pos) => {
                        const s = standings[pos];
                        if (!s) return <View key={pos} style={styles.podiumSlot} />;
                        const teamName = getTeamById(s.teamId)?.name ?? '?';
                        const medals = ['#FFD700', '#C0C0C0', '#CD7F32'];
                        const heights = [100, 80, 60];
                        return (
                          <TouchableOpacity key={s.teamId} style={styles.podiumSlot} onPress={() => router.push(`/team/${s.teamId}` as any)} activeOpacity={0.7}>
                            <Avatar uri={getTeamById(s.teamId)?.logo} name={teamName} size="small" />
                            <Text style={styles.podiumName} numberOfLines={2}>{teamName}</Text>
                            <Text style={[styles.podiumPts, { color: medals[pos] }]}>{s.points} pts</Text>
                            <View style={[styles.podiumBar, { height: heights[pos], backgroundColor: medals[pos] + '30', borderColor: medals[pos] + '50' }]}>
                              <Text style={[styles.podiumRank, { color: medals[pos] }]}>{pos + 1}</Text>
                            </View>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                )}
                <View style={styles.standingsTableHeader}>
                  <Text style={styles.standingsHeaderText}>Classement complet</Text>
                  <Text style={styles.standingsHeaderSub}>{standings.length} équipe{standings.length > 1 ? 's' : ''}</Text>
                </View>
                <Card style={styles.standingsCard}>
                  {standings.map((s, i) => {
                    const team = getTeamById(s.teamId);
                    const teamName = team?.name ?? '?';
                    const winPct = s.played > 0 ? Math.round((s.wins / s.played) * 100) : 0;
                    const maxPts = standings[0]?.points ?? 1;
                    const ptsPct = maxPts > 0 ? Math.round((s.points / maxPts) * 100) : 0;
                    const medals = ['#FFD700', '#C0C0C0', '#CD7F32'];
                    return (
                      <TouchableOpacity key={s.teamId} style={[styles.standingsRow, i === 0 && styles.standingsRowFirst]} onPress={() => router.push(`/team/${s.teamId}` as any)} activeOpacity={0.7}>
                        <View style={styles.standingsTeamRow}>
                          <View style={[styles.standingsRankBadge, i < 3 && { backgroundColor: (medals[i] ?? '') + '20' }]}>
                            <Text style={[styles.standingsRankNum, i < 3 && { color: medals[i] }]}>{i + 1}</Text>
                          </View>
                          <Avatar uri={team?.logo} name={teamName} size="small" />
                          <View style={{ flex: 1 }}>
                            <Text style={styles.standingsTeamName}>{teamName}</Text>
                            <View style={styles.winRateBarBg}>
                              <View style={[styles.winRateBarFill, { width: `${ptsPct}%`, backgroundColor: i === 0 ? Colors.primary.orange : i < 3 ? Colors.primary.blue : Colors.text.muted + '60' }]} />
                            </View>
                          </View>
                          <View style={styles.standingsPointsCol}>
                            <Text style={[styles.standingsPointsBig, i < 3 && { color: medals[i] }]}>{s.points}</Text>
                            <Text style={styles.standingsPointsLabel}>pts</Text>
                          </View>
                        </View>
                        <View style={styles.standingsStatsRow}>
                          <Text style={styles.standingsStatItem}>{s.played} MJ</Text>
                          <Text style={[styles.standingsStatItem, { color: Colors.status.success }]}>{s.wins} V</Text>
                          <Text style={styles.standingsStatItem}>{s.draws} N</Text>
                          <Text style={[styles.standingsStatItem, { color: Colors.status.error }]}>{s.losses} D</Text>
                          <Text style={styles.standingsStatItem}>{s.goalsFor}:{s.goalsAgainst}</Text>
                          <Text style={[styles.standingsStatItem, { color: s.diff > 0 ? Colors.status.success : s.diff < 0 ? Colors.status.error : Colors.text.muted }]}>{s.diff > 0 ? '+' : ''}{s.diff}</Text>
                          <Text style={[styles.standingsStatItem, { color: winPct >= 50 ? Colors.status.success : Colors.text.muted }]}>{winPct}%</Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </Card>
              </Animated.View>
            )}

            {/* ═══════ TAB: TEAMS ═══════ */}
            {activeTab === 'teams' && (
              <Animated.View style={{ opacity: tabFade }}>
                {/* Team count summary */}
                <View style={styles.teamsSummaryRow}>
                  <View style={styles.teamsSummaryChip}>
                    <Users size={14} color={Colors.primary.blue} />
                    <Text style={styles.teamsSummaryText}>{reservedSpots}/{tournament.maxTeams} places réservées</Text>
                  </View>
                  {registrationPct >= 100 && <View style={[styles.teamsSummaryChip, { backgroundColor: Colors.status.error + '15' }]}><Text style={[styles.teamsSummaryText, { color: Colors.status.error }]}>Complet</Text></View>}
                  {registrationPct < 100 && tournament.status === 'registration' && (
                    <View style={[styles.teamsSummaryChip, { backgroundColor: Colors.status.success + '15' }]}>
                      <Text style={[styles.teamsSummaryText, { color: Colors.status.success }]}>{Math.max(tournament.maxTeams - reservedSpots, 0)} place{Math.max(tournament.maxTeams - reservedSpots, 0) > 1 ? 's' : ''} restante{Math.max(tournament.maxTeams - reservedSpots, 0) > 1 ? 's' : ''}</Text>
                    </View>
                  )}
                </View>

                {!!myTeamInTournament && (
                  <Card style={styles.paymentPanelCard}>
                    <View style={styles.paymentPanelHeader}>
                      <View style={styles.paymentPanelTitleRow}>
                        <CreditCard size={16} color={Colors.primary.orange} />
                        <Text style={styles.sectionTitle}>Paiement d'inscription</Text>
                      </View>
                      <TeamStatusBadge status={myTeamInTournament.status} size="small" />
                    </View>

                    {myTeamInTournament.status === 'pending_payment' && (
                      <>
                        {!showPaymentInstructions ? (
                          <Button
                            title="Voir les instructions de paiement"
                            onPress={() => setShowPaymentInstructions(true)}
                            variant="outline"
                          />
                        ) : (
                          <View style={styles.paymentInstructionsWrap}>
                            <PaymentInstructions
                              amount={tournament.entryFee}
                              tournamentName={tournament.name}
                              teamName={getTeamById(myTeamInTournament.teamId)?.name || 'Mon équipe'}
                              onMethodSelect={setSelectedPaymentMethod}
                            />
                            <Button
                              title="J'ai payé"
                              onPress={() => setShowPaymentSubmission(true)}
                              variant="orange"
                              style={styles.paymentSubmitBtn}
                            />
                          </View>
                        )}
                      </>
                    )}

                    {myTeamInTournament.status === 'payment_submitted' && (
                      <Text style={styles.paymentInfoText}>
                        Paiement soumis{myPayment?.createdAt ? ` le ${new Date(myPayment.createdAt).toLocaleDateString('fr-FR')}` : ''}. En attente de validation par un administrateur.
                      </Text>
                    )}

                    {myTeamInTournament.status === 'confirmed' && (
                      <Text style={[styles.paymentInfoText, { color: Colors.status.success }]}>Paiement validé. Votre équipe est confirmée pour le tournoi.</Text>
                    )}

                    {(myTeamInTournament.status === 'rejected' || myTeamInTournament.status === 'cancelled') && (
                      <View style={styles.paymentRejectedWrap}>
                        <Text style={[styles.paymentInfoText, { color: Colors.status.error }]}>Votre paiement a été refusé ou expiré. Vous pouvez soumettre une nouvelle preuve.</Text>
                        <Button
                          title="Soumettre une nouvelle preuve"
                          onPress={() => {
                            setShowPaymentInstructions(true);
                            setShowPaymentSubmission(true);
                          }}
                          variant="outline"
                        />
                      </View>
                    )}
                  </Card>
                )}

                {/* Search */}
                {registeredTeamIds.length > 4 && (
                  <View style={styles.teamSearchWrap}>
                    <Search size={14} color={Colors.text.muted} />
                    <TextInput
                      style={styles.teamSearchInput}
                      placeholder="Rechercher une équipe..."
                      placeholderTextColor={Colors.text.muted}
                      value={teamSearch}
                      onChangeText={setTeamSearch}
                    />
                  </View>
                )}

                {(() => {
                  const myTeamIn = user && registeredTeamIds.some((tid: string) => getTeamById(tid)?.captainId === user.id);
                  return myTeamIn ? <View style={styles.inscritBadge}><CheckCircle size={14} color={Colors.status.success} /><Text style={styles.inscritBadgeText}>Vous êtes inscrit</Text></View> : null;
                })()}

                {filteredTeams.length > 0 ? (
                  filteredTeams.map((teamId: string) => {
                    const team = getTeamById(teamId);
                    const isMyTeam = !!(user && team?.captainId === user.id);
                    const canUnregister = tournament.status === 'registration' && (isMyTeam || canManage);
                    const teamStatus = teamStatusById.get(teamId);
                    const standing = standings.find(s => s.teamId === teamId);
                    const rank = standings.findIndex(s => s.teamId === teamId);
                    return (
                      <Card key={teamId} style={[styles.teamCard, isMyTeam && styles.teamCardMine]}>
                        <View style={styles.registeredTeamRow}>
                          <TouchableOpacity style={styles.registeredTeamMain} onPress={() => router.push(`/team/${teamId}` as any)} activeOpacity={0.7}>
                            <Avatar uri={team?.logo} name={team?.name} size="small" />
                            <View style={styles.registeredTeamInfo}>
                              <View style={styles.teamNameRow}>
                                <Text style={styles.registeredTeamName}>{team?.name ?? `Équipe ${teamId.slice(0, 8)}`}</Text>
                                {isMyTeam && <View style={styles.myTeamBadge}><Text style={styles.myTeamBadgeText}>Mon équipe</Text></View>}
                                {rank === 0 && standings.length > 0 && <Trophy size={12} color="#FFD700" />}
                              </View>
                              {teamStatus && <TeamStatusBadge status={teamStatus} size="small" />}
                              {standing != null ? (
                                <View style={styles.teamStatsLine}>
                                  <Text style={styles.teamRankBadge}>{rank + 1}e</Text>
                                  <Text style={styles.registeredTeamMeta}>{standing.points} pts</Text>
                                  <View style={styles.teamMiniBar}>
                                    <View style={[styles.teamMiniBarWin, { flex: standing.wins || 0.01 }]} />
                                    <View style={[styles.teamMiniBarDraw, { flex: standing.draws || 0.01 }]} />
                                    <View style={[styles.teamMiniBarLoss, { flex: standing.losses || 0.01 }]} />
                                  </View>
                                  <Text style={styles.teamWDL}>{standing.wins}V {standing.draws}N {standing.losses}D</Text>
                                </View>
                              ) : (
                                <Text style={styles.registeredTeamMeta}>{team?.members?.length ?? 0} joueurs</Text>
                              )}
                            </View>
                          </TouchableOpacity>
                          {canUnregister && (
                            <TouchableOpacity style={styles.unregisterBtn} onPress={() => handleUnregister(teamId)}>
                              <UserMinus size={14} color={Colors.status.error} />
                            </TouchableOpacity>
                          )}
                          <ChevronRight size={14} color={Colors.text.muted} />
                        </View>
                      </Card>
                    );
                  })
                ) : teamSearch.trim() ? (
                  <View style={styles.emptyTabState}>
                    <Search size={32} color={Colors.text.muted} />
                    <Text style={styles.emptyTabTitle}>Aucun résultat</Text>
                    <Text style={styles.emptyTabSub}>Aucune équipe ne correspond à "{teamSearch}"</Text>
                  </View>
                ) : (
                  <View style={styles.emptyTabState}>
                    <Users size={32} color={Colors.text.muted} />
                    <Text style={styles.emptyTabTitle}>Aucun participant</Text>
                    <Text style={styles.emptyTabSub}>Les équipes n'ont pas encore rejoint ce tournoi.</Text>
                  </View>
                )}
              </Animated.View>
            )}

            {/* View/Manage button - Visible to everyone */}
            <TouchableOpacity style={styles.manageTournamentBtn} onPress={() => router.push(`/tournament/${tournament.id}/manage` as any)} activeOpacity={0.8}>
              <LinearGradient colors={canManage ? [Colors.primary.orange + '20', Colors.primary.orange + '08'] : [Colors.primary.blue + '20', Colors.primary.blue + '08']} style={styles.manageBtnGradient}>
                <Settings size={20} color={canManage ? Colors.primary.orange : Colors.primary.blue} />
                <View style={styles.manageTournamentBtnContent}>
                  <Text style={styles.manageTournamentBtnText}>{canManage ? 'Gérer le tournoi' : 'Voir les détails'}</Text>
                  <Text style={styles.manageTournamentBtnSubtext}>{canManage ? 'Scores, matchs, administration' : 'Matchs, classement, statistiques'}</Text>
                </View>
                <ChevronRight size={20} color={Colors.text.muted} />
              </LinearGradient>
            </TouchableOpacity>

            {canManage && (tournament.entryFee ?? 0) > 0 && (
              <TouchableOpacity
                style={styles.manageTournamentBtn}
                onPress={() => router.push(`/tournament/${tournament.id}/advance-payout-request` as any)}
                activeOpacity={0.8}
              >
                <LinearGradient colors={[Colors.status.warning + '22', Colors.status.warning + '10']} style={styles.manageBtnGradient}>
                  <FileText size={20} color={Colors.status.warning} />
                  <View style={styles.manageTournamentBtnContent}>
                    <Text style={styles.manageTournamentBtnText}>Demander une avance</Text>
                    <Text style={styles.manageTournamentBtnSubtext}>Soumettre une demande de reversement anticipé</Text>
                  </View>
                  <ChevronRight size={20} color={Colors.text.muted} />
                </LinearGradient>
              </TouchableOpacity>
            )}

            <View style={styles.bottomSpacer} />
          </ScrollView>

          {/* Footer CTA */}
          {tournament.status === 'registration' && !userIsRegistered && (
            <View style={styles.footer}>
              {canRegisterTeam && !isFull ? (
                <Button
                  title={isRegistering ? 'Inscription...' : joinLabel}
                  onPress={handleRegister}
                  variant="orange"
                  size="large"
                  style={styles.registerButton}
                  disabled={isRegistering}
                />
              ) : isFull ? (
                <Text style={styles.footerMutedText}>Ce tournoi est complet.</Text>
              ) : (
                <Text style={styles.footerMutedText}>Seul le capitaine d&apos;une équipe peut l&apos;inscrire.</Text>
              )}
            </View>
          )}

          {myTeamInTournament && (
            <PaymentSubmissionModal
              visible={showPaymentSubmission}
              onClose={() => setShowPaymentSubmission(false)}
              tournamentId={tournament.id}
              teamId={myTeamInTournament.teamId}
              amount={tournament.entryFee}
              method={selectedPaymentMethod}
              onSuccess={handlePaymentSuccess}
            />
          )}
        </SafeAreaView>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 10 },
  backButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.background.card, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, color: Colors.text.primary, fontSize: 15, fontWeight: '600' as const, textAlign: 'center', marginHorizontal: 6 },
  placeholder: { width: 40 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  headerIconBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: Colors.background.card, alignItems: 'center', justifyContent: 'center' },
  scrollView: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingBottom: 20 },
  notFoundContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  notFoundTitle: { color: Colors.text.primary, fontSize: 18, fontWeight: '600' as const },

  /* Skeleton loading */
  skeletonHero: { borderRadius: 20, padding: 20, marginBottom: 14, backgroundColor: Colors.background.card, alignItems: 'center', gap: 12 },
  skeletonBadge: { width: 100, height: 22, borderRadius: 11, backgroundColor: Colors.background.cardLight },
  skeletonTitleLg: { width: '70%', height: 20, borderRadius: 10, backgroundColor: Colors.background.cardLight },
  skeletonTitleSm: { width: '45%', height: 14, borderRadius: 7, backgroundColor: Colors.background.cardLight },
  skeletonStatsRow: { flexDirection: 'row', gap: 20, marginTop: 8 },
  skeletonStat: { width: 50, height: 32, borderRadius: 8, backgroundColor: Colors.background.cardLight },
  skeletonTabBar: { flexDirection: 'row', gap: 8, paddingHorizontal: 4, marginBottom: 14 },
  skeletonTab: { flex: 1, height: 36, borderRadius: 10, backgroundColor: Colors.background.card },
  skeletonCard: { borderRadius: 14, padding: 16, marginBottom: 10, backgroundColor: Colors.background.card, gap: 10 },
  skeletonLine: { width: '100%', height: 12, borderRadius: 6, backgroundColor: Colors.background.cardLight },

  /* Tab bar */
  tabBar: { paddingBottom: 6, borderBottomWidth: 1, borderBottomColor: Colors.border.light },
  tabBarInner: { paddingHorizontal: 12, gap: 2 },
  tabItem: { position: 'relative' as const, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 0, backgroundColor: 'transparent' },
  tabItemActive: { },
  tabLabel: { color: Colors.text.muted, fontSize: 12, fontWeight: '600' as const },
  tabLabelActive: { color: Colors.primary.orange },
  tabBadge: { position: 'relative' as const, backgroundColor: Colors.status.error, minWidth: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4, overflow: 'visible' as const },
  tabBadgePulse: { position: 'absolute' as const, top: -2, left: -2, right: -2, bottom: -2, borderRadius: 12, backgroundColor: Colors.status.error + '40' },
  tabBadgeText: { color: '#FFF', fontSize: 9, fontWeight: '700' as const },
  tabUnderline: { position: 'absolute' as const, bottom: -6, left: 8, right: 8, height: 3, borderRadius: 2, backgroundColor: Colors.primary.orange },

  /* Hero */
  heroCard: { borderRadius: 20, padding: 18, marginBottom: 14, alignItems: 'center' },
  heroTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%', marginBottom: 10 },
  heroSport: { color: 'rgba(255,255,255,0.9)', fontSize: 10, fontWeight: '700' as const, textTransform: 'uppercase' as const, letterSpacing: 1, backgroundColor: 'rgba(255,255,255,0.15)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  statusText: { color: '#FFFFFF', fontSize: 11, fontWeight: '600' as const },
  tournamentName: { color: '#FFFFFF', fontSize: 20, fontWeight: '800' as const, textAlign: 'center' as const, marginBottom: 4, letterSpacing: -0.3 },
  tournamentSport: { color: '#FFFFFF', fontSize: 12, textAlign: 'center' as const, marginBottom: 8 },
  prizeSection: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(0,0,0,0.25)', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 14, marginTop: 4 },
  prizeAmount: { color: '#FFFFFF', fontSize: 17, fontWeight: '800' as const },
  heroStatsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 24, marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.2)', width: '100%' },
  heroStat: { alignItems: 'center', gap: 2 },
  heroStatValue: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' as const },
  heroStatLabel: { color: 'rgba(255,255,255,0.75)', fontSize: 9, fontWeight: '500' as const },
  progressBarContainer: { marginTop: 10, width: '100%', alignItems: 'center' },
  progressBarBg: { width: '100%', height: 6, borderRadius: 3, backgroundColor: 'rgba(0,0,0,0.25)', overflow: 'hidden' },
  progressBarFill: { height: '100%', borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.9)' },
  progressBarText: { color: 'rgba(255,255,255,0.85)', fontSize: 10, marginTop: 4 },
  progressBarRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%' },
  urgencyText: { color: '#FFF', fontSize: 10, fontWeight: '700' as const, marginTop: 4 },
  countdownBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10, backgroundColor: 'rgba(0,0,0,0.25)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
  countdownText: { color: '#FFFFFF', fontSize: 11, fontWeight: '600' as const },

  /* Progress timeline */
  progressCard: { backgroundColor: Colors.background.card, borderRadius: 14, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: Colors.border.light },
  progressHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  progressPctBadge: { marginLeft: 'auto', backgroundColor: Colors.primary.orange + '15', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  progressPctText: { color: Colors.primary.orange, fontSize: 11, fontWeight: '700' as const },
  progressTimeline: { gap: 0 },
  progressStep: { flexDirection: 'row', minHeight: 50 },
  progressStepLeft: { width: 28, alignItems: 'center' },
  progressDot: { width: 24, height: 24, borderRadius: 12, backgroundColor: Colors.background.cardLight, borderWidth: 2, borderColor: Colors.border.light, alignItems: 'center', justifyContent: 'center', zIndex: 1 },
  progressDotDone: { backgroundColor: Colors.status.success, borderColor: Colors.status.success },
  progressDotLive: { backgroundColor: Colors.primary.orange, borderColor: Colors.primary.orange },
  progressDotNum: { color: Colors.text.muted, fontSize: 10, fontWeight: '700' as const },
  progressLine: { flex: 1, width: 2, backgroundColor: Colors.border.light, marginVertical: -2 },
  progressLineDone: { backgroundColor: Colors.status.success },
  progressStepContent: { flex: 1, marginLeft: 12, paddingBottom: 16, gap: 6 },
  progressStepActive: { backgroundColor: Colors.primary.orange + '08', marginRight: -16, paddingRight: 16, paddingLeft: 12, marginLeft: 4, borderRadius: 10, paddingTop: 4, paddingBottom: 12 },
  progressStepRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  progressStepTitle: { color: Colors.text.secondary, fontSize: 13, fontWeight: '600' as const },
  progressStepTitleDone: { color: Colors.status.success },
  progressStepTitleLive: { color: Colors.primary.orange, fontWeight: '700' as const },
  progressStepCount: { color: Colors.text.muted, fontSize: 11 },
  progressStepBarBg: { height: 4, borderRadius: 2, backgroundColor: Colors.background.cardLight, overflow: 'hidden' },
  progressStepBarFill: { height: '100%', borderRadius: 2, backgroundColor: Colors.text.muted + '50' },

  /* Winner banner */
  winnerBanner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, borderRadius: 16, paddingVertical: 16, paddingHorizontal: 18, marginBottom: 12 },
  winnerBannerDecor: { opacity: 0.6 },
  winnerBannerContent: { alignItems: 'center', flex: 1 },
  winnerBannerLabel: { color: '#1A1A2E', fontSize: 11, fontWeight: '800' as const, textTransform: 'uppercase' as const, letterSpacing: 1.5 },
  winnerBannerName: { color: '#1A1A2E', fontSize: 18, fontWeight: '800' as const, marginTop: 2 },

  /* Live section */
  liveCardGradient: { marginBottom: 12, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: Colors.status.error + '30' },
  liveHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  livePulse: { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.status.error },
  liveHeaderText: { color: Colors.status.error, fontSize: 12, fontWeight: '800' as const, letterSpacing: 1, flex: 1 },
  liveCountBox: { backgroundColor: Colors.status.error, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10 },
  liveCountBadge: { color: '#FFF', fontSize: 11, fontWeight: '700' as const },
  liveMatchRow: { paddingVertical: 12, borderTopWidth: 1, borderTopColor: Colors.border.light },
  liveRoundLabel: { color: Colors.text.muted, fontSize: 10, marginBottom: 8, textTransform: 'uppercase' as const, letterSpacing: 0.3 },
  liveMatchTeams: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  liveTeamCol: { flex: 1, alignItems: 'center', gap: 6 },
  liveTeamName: { color: Colors.text.primary, fontSize: 13, fontWeight: '600' as const, textAlign: 'center' as const },
  liveScoreBox: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Colors.status.error + '18', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 14 },
  liveScore: { color: Colors.status.error, fontSize: 24, fontWeight: '800' as const },
  liveScoreSep: { color: Colors.status.error + '60', fontSize: 18, fontWeight: '400' as const },

  /* Last result card */
  lastResultCard: { backgroundColor: Colors.background.card, borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: Colors.border.light },
  lastResultHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  lastResultDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.status.success },
  lastResultLabel: { color: Colors.status.success, fontSize: 10, fontWeight: '700' as const, letterSpacing: 0.8, flex: 1 },
  lastResultRound: { color: Colors.text.muted, fontSize: 10, backgroundColor: Colors.background.cardLight, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  lastResultBody: { flexDirection: 'row', alignItems: 'center' },
  lastResultTeam: { flex: 1, alignItems: 'flex-start', gap: 6 },
  lastResultTeamName: { color: Colors.text.secondary, fontSize: 12, fontWeight: '600' as const },
  lastResultWinnerName: { color: Colors.primary.orange, fontWeight: '700' as const },
  lastResultScoreBox: { backgroundColor: Colors.background.cardLight, paddingHorizontal: 18, paddingVertical: 10, borderRadius: 12, marginHorizontal: 10 },
  lastResultScore: { color: '#fff', fontSize: 20, fontWeight: '800' as const, letterSpacing: 1 },

  /* Next match card */
  nextMatchCard: { marginBottom: 12, borderRadius: 14, overflow: 'hidden' },
  nextMatchGradient: { padding: 14, borderRadius: 14, borderWidth: 1, borderColor: Colors.primary.blue + '25' },
  nextMatchHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  nextMatchLabel: { color: Colors.primary.blue, fontSize: 10, fontWeight: '700' as const, letterSpacing: 0.5, flex: 1 },
  nextMatchRound: { color: Colors.text.muted, fontSize: 10, backgroundColor: Colors.background.cardLight, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  nextMatchBody: { gap: 3 },
  nextMatchTeams: { color: Colors.text.primary, fontSize: 13, fontWeight: '600' as const },
  nextMatchTime: { color: Colors.primary.blue, fontSize: 11 },

  /* Quick nav */
  quickNavRow: { gap: 8, marginBottom: 14 },
  quickNavBtn: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: Colors.background.card, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 14, borderWidth: 1, borderColor: Colors.border.light },
  quickNavIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  quickNavText: { color: Colors.text.primary, fontSize: 13, fontWeight: '600' as const },
  quickNavSub: { color: Colors.text.muted, fontSize: 10, marginTop: 1 },

  heroQuickInfo: { marginBottom: 8, backgroundColor: 'rgba(255,255,255,0.15)', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 8 },
  heroQuickText: { color: '#FFFFFF', fontSize: 11, fontWeight: '500' as const, textAlign: 'center' as const },

  /* Actions */
  actionsCard: { marginBottom: 12 },
  actionsTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  tournamentEndedText: { color: Colors.text.muted, fontSize: 14, textAlign: 'center' as const, paddingVertical: 10 },
  dejaInscritBadge: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 10 },
  dejaInscritText: { color: Colors.status.success, fontSize: 14, fontWeight: '600' as const },
  fullBadge: { paddingVertical: 10, alignItems: 'center' as const },
  fullBadgeText: { color: Colors.text.muted, fontSize: 13 },
  actionsMutedText: { color: Colors.text.muted, fontSize: 13, textAlign: 'center' as const, paddingVertical: 10 },
  joinBtnDisabled: { opacity: 0.6 },
  joinHint: { color: Colors.text.muted, fontSize: 11, textAlign: 'center' as const, marginTop: 8 },

  /* Description */
  descCard: { backgroundColor: Colors.background.card, borderRadius: 14, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: Colors.border.light },
  descHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  descAccent: { width: 4, height: 36, borderRadius: 2, backgroundColor: Colors.primary.orange },
  descTitle: { color: Colors.text.primary, fontSize: 15, fontWeight: '700' as const },
  descSubtitle: { color: Colors.text.muted, fontSize: 11, marginTop: 1 },
  sectionTitle: { color: Colors.text.primary, fontSize: 15, fontWeight: '600' as const, marginBottom: 0 },
  bigSectionTitle: { color: Colors.text.primary, fontSize: 17, fontWeight: '700' as const, marginBottom: 10, letterSpacing: -0.2 },
  descText: { color: Colors.text.secondary, fontSize: 14, lineHeight: 22 },
  readMoreBtn: { marginTop: 8 },
  readMoreText: { color: Colors.primary.orange, fontSize: 13, fontWeight: '600' as const },

  /* Stats dashboard */
  statsSection: { marginBottom: 14 },
  statsSectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  statsRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  statTile: { flex: 1, borderRadius: 14, overflow: 'hidden' },
  statTileGradient: { padding: 14, borderRadius: 14, alignItems: 'center', gap: 6, borderWidth: 1, borderColor: Colors.border.light },
  statTileIconWrap: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  statTileValue: { color: '#fff', fontSize: 24, fontWeight: '800' as const, letterSpacing: -0.5 },
  statTileLabel: { color: Colors.text.muted, fontSize: 10, fontWeight: '500' as const },
  biggestWinCard: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: Colors.background.card, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 14, borderWidth: 1, borderColor: Colors.border.light },
  biggestWinText: { color: Colors.text.secondary, fontSize: 12, flex: 1 },

  /* Info strip */
  infoStrip: { flexDirection: 'row', backgroundColor: Colors.background.card, borderRadius: 14, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: Colors.border.light },
  infoStripItem: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  infoStripDivider: { width: 1, height: 28, backgroundColor: Colors.border.light, marginHorizontal: 4 },
  infoStripLabel: { color: Colors.text.muted, fontSize: 9, fontWeight: '600' as const, textTransform: 'uppercase' as const, letterSpacing: 0.3 },
  infoStripValue: { color: Colors.text.primary, fontSize: 12, fontWeight: '600' as const, marginTop: 1 },

  /* Details card */
  detailsCard: { backgroundColor: Colors.background.card, borderRadius: 14, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: Colors.border.light },
  detailsHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  detailsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  detailsItem: { width: '47%', backgroundColor: Colors.background.cardLight, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 12 },
  detailsLabel: { color: Colors.text.muted, fontSize: 9, fontWeight: '600' as const, textTransform: 'uppercase' as const, letterSpacing: 0.3, marginBottom: 3 },
  detailsValue: { color: Colors.text.primary, fontSize: 13, fontWeight: '600' as const },

  /* Venue */
  venueCardNew: { marginBottom: 12, borderRadius: 14, overflow: 'hidden' },
  venueGradient: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 14, borderWidth: 1, borderColor: Colors.primary.orange + '20' },
  venueTitle: { color: Colors.text.primary, fontSize: 14, fontWeight: '600' as const },
  venueCity: { color: Colors.text.muted, fontSize: 12, marginTop: 2 },

  /* Prizes */
  prizesCard: { marginBottom: 12 },
  prizesTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  prizeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: Colors.border.light },
  positionBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, backgroundColor: Colors.background.cardLight },
  firstPlace: { backgroundColor: 'rgba(255,215,0,0.2)' },
  secondPlace: { backgroundColor: 'rgba(192,192,192,0.2)' },
  thirdPlace: { backgroundColor: 'rgba(205,127,50,0.2)' },
  positionText: { color: Colors.text.primary, fontSize: 12, fontWeight: '600' as const },
  prizeRowAmount: { color: Colors.text.primary, fontSize: 14, fontWeight: '600' as const },

  /* Sponsor */
  sponsorCard: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  sponsorLabel: { color: Colors.text.muted, fontSize: 10 },
  sponsorName: { color: Colors.text.primary, fontSize: 14, fontWeight: '600' as const },

  /* Matches section */
  matchesSectionWrap: { marginBottom: 12 },
  matchStatsRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  matchStatChip: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.background.card, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10 },
  matchStatNum: { color: Colors.text.primary, fontSize: 13, fontWeight: '700' as const },
  matchStatLabel: { color: Colors.text.muted, fontSize: 11 },

  /* Match filter */
  matchFilterRow: { flexDirection: 'row', gap: 6, marginBottom: 14, flexWrap: 'wrap' },
  matchFilterChip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, backgroundColor: Colors.background.card, borderWidth: 1, borderColor: Colors.border.light },
  matchFilterChipActive: { backgroundColor: Colors.primary.orange + '18', borderColor: Colors.primary.orange + '50' },
  matchFilterChipText: { color: Colors.text.muted, fontSize: 12, fontWeight: '600' as const },
  matchFilterChipTextActive: { color: Colors.primary.orange },
  matchFilterChipCount: { color: Colors.text.muted, fontSize: 10, fontWeight: '700' as const, backgroundColor: Colors.background.cardLight, paddingHorizontal: 5, paddingVertical: 1, borderRadius: 8, overflow: 'hidden' },
  matchFilterChipCountActive: { backgroundColor: Colors.primary.orange + '25', color: Colors.primary.orange },

  /* Empty tab state */
  emptyTabState: { alignItems: 'center', justifyContent: 'center', paddingVertical: 40, gap: 10 },
  emptyTabTitle: { color: Colors.text.primary, fontSize: 16, fontWeight: '600' as const },
  emptyTabSub: { color: Colors.text.muted, fontSize: 13, textAlign: 'center' as const },

  roundBlock: { marginTop: 12 },
  roundTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  roundTitleDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.primary.orange },
  roundTitle: { color: Colors.primary.orange, fontSize: 13, fontWeight: '700' as const, textTransform: 'uppercase' as const, letterSpacing: 0.5, flex: 1 },
  roundTitleCount: { color: Colors.text.muted, fontSize: 11 },
  matchCard: { backgroundColor: Colors.background.card, borderRadius: 14, padding: 14, marginBottom: 10, overflow: 'hidden' as const },
  matchCardLive: { borderWidth: 1, borderColor: Colors.status.error + '40' },
  matchCardDone: { opacity: 0.85 },
  matchCardLiveBanner: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: Colors.status.error + '20' },
  matchCardLiveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.status.error },
  matchCardLiveText: { color: Colors.status.error, fontSize: 10, fontWeight: '800' as const, letterSpacing: 1 },
  matchCardTeams: { gap: 8 },
  matchCardTeamRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  matchCardTeamName: { flex: 1, color: Colors.text.primary, fontSize: 14 },
  matchCardDivider: { height: 1, backgroundColor: Colors.border.light, marginHorizontal: 36 },
  matchCardScoreNum: { color: Colors.text.secondary, fontSize: 18, fontWeight: '700' as const, minWidth: 22, textAlign: 'right' as const },
  matchCardWinner: { fontWeight: '700' as const, color: Colors.primary.orange },
  matchCardWinnerScore: { color: Colors.primary.orange },
  matchCardFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: Colors.border.light },
  matchCardFooterLeft: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  matchCardStatus: { color: Colors.text.muted, fontSize: 11 },
  matchCardRelTime: { color: Colors.primary.blue, fontSize: 11, fontWeight: '600' as const },
  matchCardVenue: { color: Colors.text.muted, fontSize: 10, maxWidth: 100 },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.status.error },
  matchWinnerChip: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.primary.orange + '15', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  matchWinnerText: { color: Colors.primary.orange, fontSize: 10, fontWeight: '600' as const, maxWidth: 80 },

  /* Standings */
  standingsTableHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  standingsHeaderText: { color: Colors.text.primary, fontSize: 15, fontWeight: '700' as const },
  standingsHeaderSub: { color: Colors.text.muted, fontSize: 12 },
  standingsCard: { marginBottom: 12 },
  standingsRow: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.border.light },
  standingsRowFirst: { backgroundColor: Colors.primary.orange + '08', borderRadius: 12, paddingHorizontal: 10, marginHorizontal: -10, borderWidth: 1, borderColor: Colors.primary.orange + '15' },
  standingsTeamRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  standingsRankBadge: { width: 28, height: 28, borderRadius: 14, backgroundColor: Colors.background.cardLight, alignItems: 'center', justifyContent: 'center' },
  standingsRankBadgeFirst: { backgroundColor: Colors.primary.orange + '20' },
  standingsRankNum: { color: Colors.text.muted, fontSize: 12, fontWeight: '700' as const },
  standingsTeamName: { color: Colors.text.primary, fontSize: 14, fontWeight: '600' as const },
  standingsPointsCol: { alignItems: 'center', minWidth: 36 },
  standingsPointsBig: { color: Colors.primary.orange, fontSize: 16, fontWeight: '800' as const },
  standingsPointsLabel: { color: Colors.text.muted, fontSize: 9 },
  winRateBarBg: { height: 4, borderRadius: 2, backgroundColor: Colors.background.cardLight, marginTop: 5, width: '100%', overflow: 'hidden' },
  winRateBarFill: { height: '100%', borderRadius: 2 },
  standingsStatsRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 6, marginLeft: 38, flexWrap: 'wrap' },
  standingsStatItem: { color: Colors.text.muted, fontSize: 11 },

  /* Podium */
  podiumContainer: { marginBottom: 14 },
  podiumTitle: { color: Colors.text.primary, fontSize: 15, fontWeight: '700' as const, textAlign: 'center' as const, marginBottom: 14 },
  podiumRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', gap: 8 },
  podiumSlot: { flex: 1, alignItems: 'center', gap: 5 },
  podiumName: { color: Colors.text.primary, fontSize: 11, fontWeight: '600' as const, textAlign: 'center' as const },
  podiumPts: { fontSize: 13, fontWeight: '800' as const },
  podiumBar: { width: '100%', borderRadius: 10, borderWidth: 1, alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 10 },
  podiumRank: { fontSize: 22, fontWeight: '900' as const },

  /* Teams */
  teamsSummaryRow: { flexDirection: 'row', gap: 8, marginBottom: 12, flexWrap: 'wrap' },
  teamsSummaryChip: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Colors.background.card, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 12 },
  teamsSummaryText: { color: Colors.text.primary, fontSize: 12, fontWeight: '600' as const },
  paymentPanelCard: { marginBottom: 12, padding: 12, gap: 12 },
  paymentPanelHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  paymentPanelTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  paymentInstructionsWrap: { gap: 12 },
  paymentSubmitBtn: { marginTop: 4 },
  paymentInfoText: { color: Colors.text.secondary, fontSize: 13, lineHeight: 18 },
  paymentRejectedWrap: { gap: 10 },
  teamSearchWrap: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: Colors.background.card, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 12, borderWidth: 1, borderColor: Colors.border.light },
  teamSearchInput: { flex: 1, color: Colors.text.primary, fontSize: 14, padding: 0 },
  teamsCard: { marginBottom: 12 },
  teamCard: { marginBottom: 8 },
  teamCardMine: { borderWidth: 1, borderColor: Colors.primary.orange + '30' },
  teamsTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  inscritBadge: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10, paddingVertical: 6, paddingHorizontal: 12, backgroundColor: Colors.status.success + '15', borderRadius: 10 },
  inscritBadgeText: { color: Colors.status.success, fontSize: 12, fontWeight: '600' as const },
  teamAvatar: { marginRight: 10 },
  registeredTeamRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  registeredTeamMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  registeredTeamInfo: { flex: 1 },
  teamNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  registeredTeamName: { color: Colors.text.primary, fontSize: 14, fontWeight: '600' as const },
  registeredTeamMeta: { color: Colors.text.muted, fontSize: 11 },
  myTeamBadge: { backgroundColor: Colors.primary.orange + '18', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  myTeamBadgeText: { color: Colors.primary.orange, fontSize: 9, fontWeight: '700' as const },
  teamStatsLine: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  teamRankBadge: { color: Colors.primary.orange, fontSize: 11, fontWeight: '700' as const },
  teamMiniBar: { flexDirection: 'row', height: 4, borderRadius: 2, overflow: 'hidden', width: 40 },
  teamMiniBarWin: { backgroundColor: Colors.status.success, height: '100%' },
  teamMiniBarDraw: { backgroundColor: Colors.text.muted, height: '100%' },
  teamMiniBarLoss: { backgroundColor: Colors.status.error, height: '100%' },
  teamWDL: { color: Colors.text.muted, fontSize: 10 },
  unregisterBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: Colors.status.error + '15', alignItems: 'center', justifyContent: 'center' },
  noParticipantsText: { color: Colors.text.muted, fontSize: 13, paddingVertical: 16, textAlign: 'center' as const },

  /* Manage */
  manageTournamentBtn: { marginBottom: 12, borderRadius: 16, overflow: 'hidden' },
  manageBtnGradient: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderRadius: 16, borderWidth: 1, borderColor: Colors.primary.orange + '30' },
  manageTournamentBtnContent: { flex: 1 },
  manageTournamentBtnText: { color: Colors.primary.orange, fontSize: 14, fontWeight: '700' as const },
  manageTournamentBtnSubtext: { color: Colors.text.muted, fontSize: 11, marginTop: 2 },

  /* Footer */
  bottomSpacer: { height: 80 },
  footer: { padding: 16, borderTopWidth: 1, borderTopColor: Colors.border.light },
  footerMutedText: { color: Colors.text.muted, fontSize: 13, textAlign: 'center' as const },
  registerButton: { width: '100%' },

  /* Success */
  successBanner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: Colors.status.success, paddingVertical: 12, paddingHorizontal: 16, marginBottom: 12, borderRadius: 12 },
  successBannerText: { color: '#FFF', fontSize: 14, fontWeight: '700' as const },
});
