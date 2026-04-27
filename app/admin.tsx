import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity, Alert, TextInput, RefreshControl, Switch, Share, Platform, Modal, KeyboardAvoidingView, Linking } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter, Stack } from 'expo-router';
import { safeBack } from '@/lib/navigation';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Users, Swords, Shield, Ban, Search, ChevronRight, TrendingUp, Settings, BarChart3, Calendar, MapPin, Star, CheckCircle, XCircle, Eye, RefreshCw, Globe, Database, DollarSign, Ticket, UserCheck, Activity, Clock, AlertTriangle, Zap, Server, HardDrive, Send, Lock, Trash2, FileText, Download, MessageSquare, Award, Target, PieChart, Bell, X, Plus, Filter, ArrowUpDown, CheckSquare, Square, TrendingDown } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { useAuth } from '@/contexts/AuthContext';
import { useTeams } from '@/contexts/TeamsContext';
import { useMatches } from '@/contexts/MatchesContext';
import { useUsers } from '@/contexts/UsersContext';
import { useNotifications } from '@/contexts/NotificationsContext';
import { useSupport, SupportTicket, VerificationRequest } from '@/contexts/SupportContext';
import { useTournaments } from '@/contexts/TournamentsContext';
import { Card } from '@/components/Card';
import { StatCard } from '@/components/StatCard';
import { Avatar } from '@/components/Avatar';
import { Button } from '@/components/Button';
import { sportLabels } from '@/mocks/data';
import { notificationsApi } from '@/lib/api/notifications';
import { tournamentPayoutRequestsApi, tournamentPaymentsApi } from '@/lib/api/tournament-payments';
import { offlineManager } from '@/lib/offline';
import { testEngine, testLogStore, reportRunner, type QaDomain, type QaRunResult, type QaRuntimeEvent, type ProductionReadinessResult } from '@/qa';

const CACHE_KEYS_TO_PURGE = ['vs_tournaments', 'vs_teams', 'vs_matches', 'vs_all_users', 'vs_follows', 'vs_notifications', 'vs_offline_queue', 'vs_last_sync'];

type AdminTab = 'overview' | 'users' | 'banned' | 'teams' | 'matches' | 'tournaments' | 'tickets' | 'verifications' | 'payments' | 'payouts' | 'analytics' | 'activity' | 'qa' | 'prod_report' | 'settings';

interface ActivityLog {
  id: string;
  type: 'user_joined' | 'team_created' | 'match_created' | 'report' | 'verification' | 'ban' | 'payment';
  title: string;
  description: string;
  timestamp: Date;
  userId?: string;
  severity: 'info' | 'warning' | 'success' | 'error';
}

export default function AdminScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user, isAdmin } = useAuth();
  const { teams = [], refetchTeams, deleteTeam } = useTeams();
  const { matches = [], refetchMatches, deleteMatch } = useMatches();
  const { users = [], banUser, unbanUser, verifyUser, unverifyUser } = useUsers();
  const { addNotification } = useNotifications();
  const { tickets = [], verificationRequests = [], updateTicketStatus, handleVerification, getPendingTickets, getPendingVerifications, respondToTicket } = useSupport();
  const { tournaments = [], refetchTournaments } = useTournaments();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'banned' | 'verified'>('all');
  const [refreshing, setRefreshing] = useState(false);
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [notificationMessage, setNotificationMessage] = useState('');
  const [sendingNotif, setSendingNotif] = useState(false);
  const [selectedTicketForResponse, setSelectedTicketForResponse] = useState<SupportTicket | null>(null);
  const [ticketResponseText, setTicketResponseText] = useState('');
  const [selectedTicketDetail, setSelectedTicketDetail] = useState<SupportTicket | null>(null);
  const [selectedVerificationDetail, setSelectedVerificationDetail] = useState<VerificationRequest | null>(null);
  const [qaRunning, setQaRunning] = useState(false);
  const [qaResult, setQaResult] = useState<QaRunResult | null>(null);
  const [prodReportRunning, setProdReportRunning] = useState(false);
  const [prodReportResult, setProdReportResult] = useState<ProductionReadinessResult | null>(null);
  const [qaLogs, setQaLogs] = useState<any[]>([]);
  const [qaSelectedDomain, setQaSelectedDomain] = useState<QaDomain>('cross_domain');
  const [qaLiveEvents, setQaLiveEvents] = useState<QaRuntimeEvent[]>([]);

  const qaDomains: QaDomain[] = [
    'auth',
    'teams',
    'matches',
    'tournaments',
    'payments',
    'chat',
    'venues',
    'notifications',
    'permissions',
    'cross_domain',
    'stress',
    'integrity',
    'recovery',
  ];

  // Helper to get user name from users array
  const getUserName = useCallback((userId: string) => {
    const foundUser = users.find(u => u.id === userId);
    return foundUser?.fullName || `Utilisateur ${userId?.slice(0, 8)}...`;
  }, [users]);

  // Helper to get user username from users array
  const getUserUsername = useCallback((userId: string) => {
    const foundUser = users.find(u => u.id === userId);
    return foundUser?.username || 'N/A';
  }, [users]);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<'name' | 'date' | 'city'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [selectedUserForBan, setSelectedUserForBan] = useState<{ id: string; name: string } | null>(null);
  const [banDuration, setBanDuration] = useState<'24h' | '7d' | '30d' | 'permanent'>('7d');
  const [banReason, setBanReason] = useState('');
  const [isApplyingBan, setIsApplyingBan] = useState(false);
  const [unbanningUserId, setUnbanningUserId] = useState<string | null>(null);
  const [deletingTeamId, setDeletingTeamId] = useState<string | null>(null);
  const [deletingMatchId, setDeletingMatchId] = useState<string | null>(null);
  const [rejectTarget, setRejectTarget] = useState<{ id: string; userId: string } | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const pendingPayoutRequestsQuery = useQuery({
    queryKey: ['pending-payout-requests'],
    queryFn: () => tournamentPayoutRequestsApi.getPendingRequests(),
    enabled: !!isAdmin,
  });
  const pendingPayoutRequests = pendingPayoutRequestsQuery.data ?? [];

  const pendingPaymentsQuery = useQuery({
    queryKey: ['pendingPayments'],
    queryFn: () => tournamentPaymentsApi.getPendingPayments(),
    enabled: !!isAdmin,
  });
  const pendingPayments = pendingPaymentsQuery.data ?? [];

  const doRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        refetchTeams(),
        refetchMatches(),
        refetchTournaments(),
        queryClient.invalidateQueries({ queryKey: ['allUsers'] }),
        queryClient.invalidateQueries({ queryKey: ['support'] }),
        queryClient.invalidateQueries({ queryKey: ['notifications'] }),
        queryClient.invalidateQueries({ queryKey: ['pending-payout-requests'] }),
        queryClient.invalidateQueries({ queryKey: ['pendingPayments'] }),
      ]);
      setLastRefresh(new Date());
    } catch (e) {
      if (__DEV__) console.warn('[Admin] Refresh failed:', (e as Error)?.message ?? e);
    } finally {
      setRefreshing(false);
    }
  }, [refetchTeams, refetchMatches, refetchTournaments, queryClient]);

  useEffect(() => {
    if (autoRefresh) {
      const interval = setInterval(() => {
        doRefresh();
      }, 30000);
      return () => clearInterval(interval);
    }
  }, [autoRefresh, doRefresh]);

  useFocusEffect(
    useCallback(() => {
      doRefresh();
    }, [doRefresh])
  );

  const renderBannedUsers = () => (
    <Card style={styles.listCard}>
      <View style={styles.listHeader}>
        <Text style={styles.cardTitle}>Utilisateurs bannis ({bannedUsers.length})</Text>
      </View>

      {bannedUsers.length === 0 ? (
        <View style={styles.emptyState}>
          <Ban size={40} color={Colors.text.muted} />
          <Text style={styles.emptyText}>Aucun utilisateur banni</Text>
        </View>
      ) : (
        bannedUsers.map((u) => (
          <View key={u.id} style={styles.userItem}>
            <TouchableOpacity style={styles.userItemContent} onPress={() => router.push(`/user/${u.id}`)}>
              <Avatar uri={u.avatar} name={u.fullName} size="medium" />
              <View style={styles.userInfo}>
                <View style={styles.userNameRow}>
                  <Text style={styles.userName}>{u.fullName}</Text>
                  <Ban size={14} color={Colors.status.error} />
                </View>
                <Text style={styles.userEmail}>{u.email ?? u.phone ?? '-'}</Text>
                <Text style={styles.userMeta}>{u.city || '-'} • {formatDate(u.createdAt)}</Text>
              </View>
            </TouchableOpacity>
            <View style={styles.userActions}>
              <TouchableOpacity
                style={[styles.actionBtnGreen, { width: 'auto', paddingHorizontal: 10, borderRadius: 10, flexDirection: 'row', gap: 6 }]}
                onPress={() => handleUnbanUser(u.id, u.fullName)}
                disabled={unbanningUserId === u.id}
                accessibilityLabel={`Débannir ${u.fullName}`}
              >
                <CheckCircle size={16} color={Colors.status.success} />
                <Text style={{ color: Colors.status.success, fontSize: 12, fontWeight: '600' as const }}>
                  {unbanningUserId === u.id ? 'Débannissement...' : 'Débannir'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        ))
      )}
    </Card>
  );

  const onRefresh = doRefresh;

  const pendingTickets = getPendingTickets() ?? [];
  const pendingVerifications = getPendingVerifications() ?? [];

  // Early return if not admin to prevent crashes
  if (!user || !isAdmin) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background.dark }}>
        <LinearGradient colors={[Colors.background.dark, '#0D1420']} style={StyleSheet.absoluteFill} />
        <SafeAreaView style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 }}>
          <View style={{ alignItems: 'center' }}>
            <Shield size={64} color={Colors.status.error} />
            <Text style={{ color: Colors.text.primary, fontSize: 24, fontWeight: '700' as const, marginTop: 20 }}>Accès refusé</Text>
            <Text style={{ color: Colors.text.muted, fontSize: 15, textAlign: 'center' as const, marginTop: 8 }}>Vous n&apos;avez pas les permissions administrateur.</Text>
            <TouchableOpacity style={{ marginTop: 24, backgroundColor: Colors.primary.blue, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 }} onPress={() => safeBack(router, '/(tabs)/(home)')}>
              <Text style={{ color: '#FFFFFF', fontSize: 15, fontWeight: '600' as const }}>Retour</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  const activityLogs = useMemo(() => {
    const now = Date.now();
    return [
      { id: '1', title: 'Nouvel utilisateur premium', description: 'Marie Kouassi a souscrit à l\'abonnement Premium', timestamp: new Date(now - 2 * 60 * 1000), severity: 'success' as const, icon: 'star' },
      { id: '2', title: 'Match confirmé', description: 'Football 5v5 à Abidjan - Plateau • 12 participants', timestamp: new Date(now - 8 * 60 * 1000), severity: 'success' as const, icon: 'match' },
      { id: '3', title: 'Vérification approuvée', description: 'Yao Kouadio - Document d\'identité validé', timestamp: new Date(now - 15 * 60 * 1000), severity: 'info' as const, icon: 'verify' },
      { id: '4', title: 'Nouveau ticket support', description: 'Problème de connexion signalé par Aya Traoré', timestamp: new Date(now - 22 * 60 * 1000), severity: 'warning' as const, icon: 'ticket' },
      { id: '5', title: 'Équipe créée', description: 'Les Lions de Cocody - Basketball 5v5', timestamp: new Date(now - 35 * 60 * 1000), severity: 'info' as const, icon: 'team' },
      { id: '6', title: 'Utilisateur banni', description: 'Koffi Mensah - Comportement inapproprié', timestamp: new Date(now - 45 * 60 * 1000), severity: 'error' as const, icon: 'ban' },
      { id: '7', title: 'Tournoi lancé', description: 'Coupe de Volleyball - 16 équipes inscrites', timestamp: new Date(now - 58 * 60 * 1000), severity: 'success' as const, icon: 'tournament' },
      { id: '8', title: 'Match annulé', description: 'Tennis double à Marcory - Pluie', timestamp: new Date(now - 72 * 60 * 1000), severity: 'warning' as const, icon: 'cancel' },
      { id: '9', title: 'Paiement reçu', description: '15,000 FCFA - Abonnement Premium (Adjoua N\'Guessan)', timestamp: new Date(now - 90 * 60 * 1000), severity: 'success' as const, icon: 'payment' },
      { id: '10', title: 'Nouvelle équipe vérifiée', description: 'FC Yopougon - Football 11v11', timestamp: new Date(now - 105 * 60 * 1000), severity: 'info' as const, icon: 'verify' },
      { id: '11', title: 'Match terminé', description: 'Basketball 3v3 à Treichville - Score: 21-18', timestamp: new Date(now - 125 * 60 * 1000), severity: 'info' as const, icon: 'complete' },
      { id: '12', title: 'Signalement traité', description: 'Profil suspect vérifié et approuvé', timestamp: new Date(now - 145 * 60 * 1000), severity: 'success' as const, icon: 'check' },
    ];
  }, []);

  const stats = useMemo(() => {
    const activeUsers = (users ?? []).filter(u => !u.isBanned).length;
    return {
      totalUsers: (users ?? []).length,
      totalTeams: (teams ?? []).length,
      totalMatches: (matches ?? []).length,
      totalTournaments: (tournaments ?? []).length,
      activeUsers,
      bannedUsers: (users ?? []).filter(u => u.isBanned).length,
      verifiedUsers: (users ?? []).filter(u => u.isVerified).length,
      premiumUsers: (users ?? []).filter(u => u.isPremium).length,
      pendingTickets: (pendingTickets ?? []).length,
      pendingVerifications: (pendingVerifications ?? []).length,
      openMatches: (matches ?? []).filter(m => m.status === 'open').length,
      completedMatches: (matches ?? []).filter(m => m.status === 'completed').length,
      matchesInProgress: (matches ?? []).filter(m => m.status === 'in_progress').length,
      confirmedMatches: (matches ?? []).filter(m => m.status === 'confirmed').length,
      registrationTournaments: (tournaments ?? []).filter(t => t.status === 'registration').length,
      dailyActiveUsers: activeUsers,
      weeklyActiveUsers: activeUsers,
    };
  }, [users, teams, matches, tournaments, pendingTickets, pendingVerifications]);

  const loadQaLogs = useCallback(async () => {
    try {
      const logs = await testLogStore.getRecent(50);
      setQaLogs(logs);
    } catch (e) {
      if (__DEV__) {
        console.warn('[Admin][QA] Failed to load logs:', (e as Error).message);
      }
    }
  }, []);

  const runProdReportSilent = useCallback(async () => {
    try {
      const result = await reportRunner.run();
      setProdReportResult(result);
      return result;
    } catch (e) {
      console.warn('[QA] Prod report after run failed:', (e as Error).message);
      return null;
    }
  }, []);

  const runQaAll = useCallback(async () => {
    setQaRunning(true);
    setQaLiveEvents([]);
    try {
      const result = await testEngine.runAll({
        onEvent: (event) => {
          setQaLiveEvents((prev) => [event, ...prev].slice(0, 300));
        },
      });
      setQaResult(result);
      await loadQaLogs();
      const prodReport = await runProdReportSilent();
      const prodLine = prodReport ? `\nRapport prod: ${prodReport.readyForProduction ? '✅ PRÊT' : '🚫 NON PRÊT'} (${prodReport.overallScore}/100, ${prodReport.blockers.length} bloqueur(s))` : '';
      Alert.alert('QA + Rapport Prod', `QA: ${result.summary.passed} passés, ${result.summary.failed} échecs, ${result.summary.warnings} warnings.${prodLine}`);
    } catch (e) {
      Alert.alert('QA', (e as Error).message);
    } finally {
      setQaRunning(false);
    }
  }, [loadQaLogs, runProdReportSilent]);

  const runQaByDomain = useCallback(async () => {
    setQaRunning(true);
    setQaLiveEvents([]);
    try {
      const result = await testEngine.runByDomain(qaSelectedDomain, {
        onEvent: (event) => {
          setQaLiveEvents((prev) => [event, ...prev].slice(0, 300));
        },
      });
      setQaResult(result);
      await loadQaLogs();
      const prodReport = await runProdReportSilent();
      const prodLine = prodReport ? `\nRapport prod: ${prodReport.readyForProduction ? '✅ PRÊT' : '🚫 NON PRÊT'} (${prodReport.overallScore}/100, ${prodReport.blockers.length} bloqueur(s))` : '';
      Alert.alert('QA + Rapport Prod', `Domaine ${qaSelectedDomain}: ${result.summary.passed} passés, ${result.summary.failed} échecs.${prodLine}`);
    } catch (e) {
      Alert.alert('QA', (e as Error).message);
    } finally {
      setQaRunning(false);
    }
  }, [qaSelectedDomain, loadQaLogs, runProdReportSilent]);

  useEffect(() => {
    if (activeTab === 'qa') {
      loadQaLogs();
    }
  }, [activeTab, loadQaLogs]);

  const sportStats = useMemo(() => {
    const sportCounts: Record<string, number> = {};
    (matches ?? []).forEach(m => { 
      if (m.sport) {
        sportCounts[m.sport] = (sportCounts[m.sport] || 0) + 1; 
      }
    });
    const total = (matches ?? []).length || 1;
    return Object.entries(sportCounts).map(([sport, count]) => ({
      sport: (sportLabels as Record<string, string>)[sport] || sport,
      count,
      percent: Math.round((count / total) * 100),
    })).sort((a, b) => b.count - a.count).slice(0, 5);
  }, [matches]);

  const cityStats = useMemo(() => {
    const cityCounts: Record<string, number> = {};
    (users ?? []).forEach(u => {
      if (u.city) {
        cityCounts[u.city] = (cityCounts[u.city] || 0) + 1;
      }
    });
    const total = (users ?? []).length || 1;
    return Object.entries(cityCounts).map(([city, count]) => ({
      city,
      count,
      percent: Math.round((count / total) * 100),
    })).sort((a, b) => b.count - a.count).slice(0, 5);
  }, [users]);

  const summaryToday = useMemo(() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const end = start + 24 * 60 * 60 * 1000;
    const inRange = (d: Date | string) => {
      const t = typeof d === 'string' ? new Date(d).getTime() : (d as Date).getTime();
      return t >= start && t < end;
    };
    return {
      inscriptions: (users ?? []).filter(u => u.createdAt && inRange(u.createdAt)).length,
      matchs: (matches ?? []).filter(m => m.createdAt && inRange(m.createdAt)).length,
      equipes: (teams ?? []).filter(t => t.createdAt && inRange(t.createdAt)).length,
    };
  }, [users, matches, teams]);

  const summaryYesterday = useMemo(() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1).getTime();
    const end = start + 24 * 60 * 60 * 1000;
    const inRange = (d: Date | string) => {
      const t = typeof d === 'string' ? new Date(d).getTime() : (d as Date).getTime();
      return t >= start && t < end;
    };
    return {
      inscriptions: (users ?? []).filter(u => u.createdAt && inRange(u.createdAt)).length,
      matchs: (matches ?? []).filter(m => m.createdAt && inRange(m.createdAt)).length,
      equipes: (teams ?? []).filter(t => t.createdAt && inRange(t.createdAt)).length,
    };
  }, [users, matches, teams]);

  const getGrowthPercent = (today: number, yesterday: number) => {
    if (yesterday === 0) return today > 0 ? 100 : 0;
    return Math.round(((today - yesterday) / yesterday) * 100);
  };

  const filteredUsers = useMemo(() => {
    let result = (users ?? []).filter(u => u != null);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const contact = (u: typeof result[0]) => (u?.email ?? u?.phone ?? '').toLowerCase();
      result = result.filter(u => u?.fullName?.toLowerCase().includes(q) || contact(u).includes(q) || (u?.username ?? '').toLowerCase().includes(q));
    }
    if (filterStatus === 'active') result = result.filter(u => !u?.isBanned);
    if (filterStatus === 'banned') result = result.filter(u => u?.isBanned);
    if (filterStatus === 'verified') result = result.filter(u => u?.isVerified);
    
    result.sort((a, b) => {
      let comparison = 0;
      if (sortBy === 'name') {
        comparison = (a.fullName || '').localeCompare(b.fullName || '');
      } else if (sortBy === 'date') {
        const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        comparison = dateB - dateA;
      } else if (sortBy === 'city') {
        comparison = (a.city || '').localeCompare(b.city || '');
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });
    
    return result;
  }, [users, searchQuery, filterStatus, sortBy, sortOrder]);

  const bannedUsers = useMemo(() => {
    let result = (users ?? []).filter(u => u?.isBanned);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(u =>
        u?.fullName?.toLowerCase().includes(q)
        || (u?.email ?? u?.phone ?? '').toLowerCase().includes(q)
        || (u?.username ?? '').toLowerCase().includes(q)
      );
    }
    return result;
  }, [users, searchQuery]);

  const filteredTeams = useMemo(() => {
    const safeTeams = teams ?? [];
    if (!searchQuery) return safeTeams;
    const q = searchQuery.toLowerCase();
    return safeTeams.filter(t => t?.name?.toLowerCase().includes(q) || t?.city?.toLowerCase().includes(q));
  }, [teams, searchQuery]);

  const filteredMatches = useMemo(() => {
    const safeMatches = matches ?? [];
    if (!searchQuery) return safeMatches;
    const q = searchQuery.toLowerCase();
    return safeMatches.filter(m => m?.sport?.toLowerCase().includes(q) || (m?.venue?.name ?? '').toLowerCase().includes(q));
  }, [matches, searchQuery]);

  const filteredTournaments = useMemo(() => {
    const safeTournaments = tournaments ?? [];
    if (!searchQuery) return safeTournaments;
    const q = searchQuery.toLowerCase();
    return safeTournaments.filter(t => t?.name?.toLowerCase().includes(q) || (t?.sport ?? '').toLowerCase().includes(q) || (t?.venue?.name ?? '').toLowerCase().includes(q));
  }, [tournaments, searchQuery]);

  const getBanEndDate = (duration: '24h' | '7d' | '30d' | 'permanent'): Date | null => {
    const now = new Date();
    if (duration === 'permanent') return null;
    if (duration === '24h') return new Date(now.getTime() + 24 * 60 * 60 * 1000);
    if (duration === '7d') return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    return new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  };

  const handleBanUser = async (userId: string, userName: string) => {
    console.log('[Admin] handleBanUser called:', userId, userName);
    if (!userId?.trim()) {
      Alert.alert('Erreur', 'Utilisateur invalide.');
      return;
    }
    setBanDuration('7d');
    setBanReason('');
    setSelectedUserForBan({ id: userId, name: userName });
    console.log('[Admin] Ban modal should now be visible');
  };

  const handleConfirmBan = async () => {
    console.log('[Admin] handleConfirmBan called, selectedUser:', selectedUserForBan);
    if (!selectedUserForBan?.id) return;

    setIsApplyingBan(true);
    try {
      const bannedUntil = getBanEndDate(banDuration);
      console.log('[Admin] Calling banUser with:', { userId: selectedUserForBan.id, banDuration, bannedUntil, banReason });
      await banUser({
        userId: selectedUserForBan.id,
        bannedUntil,
        banReason: banReason.trim() || null,
      } as any);

      const suspensionText = bannedUntil
        ? `jusqu'au ${bannedUntil.toLocaleString('fr-FR')}`
        : 'de manière permanente';

      try {
        await addNotification({
          userId: selectedUserForBan.id,
          type: 'system',
          title: 'Compte suspendu',
          message: `Votre compte a été suspendu ${suspensionText}.${banReason.trim() ? ` Motif : ${banReason.trim()}` : ''}`,
        });
      } catch (_) {
        // Notification échouée mais le ban a réussi
      }
      setSelectedUserForBan(null);
      Alert.alert('Succès', `${selectedUserForBan.name} a été banni ${suspensionText}.`);
    } catch (e) {
      Alert.alert('Erreur', (e as Error)?.message ?? 'Impossible de bannir l\'utilisateur.');
    } finally {
      setIsApplyingBan(false);
    }
  };

  const performUnbanUser = async (userId: string, userName: string) => {
    setUnbanningUserId(userId);
    try {
      await unbanUser(userId);
      try {
        await addNotification({ userId, type: 'system', title: 'Compte réactivé', message: 'Votre compte a été réactivé.' });
      } catch (_) {
        // Notification échouée mais le débannissement a réussi
      }
      Alert.alert('Succès', `${userName} a été débanni`);
    } catch (e) {
      Alert.alert('Erreur', (e as Error)?.message ?? 'Impossible de débannir l\'utilisateur.');
    } finally {
      setUnbanningUserId(null);
    }
  };

  const handleUnbanUser = async (userId: string, userName: string) => {
    if (!userId?.trim()) {
      Alert.alert('Erreur', 'Utilisateur invalide.');
      return;
    }

    // On mobile, execute directly to avoid Alert callback issues
    if (Platform.OS !== 'web') {
      await performUnbanUser(userId, userName);
      return;
    }

    Alert.alert('Débannir', `Débannir ${userName} ?`, [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Débannir',
        onPress: () => {
          void performUnbanUser(userId, userName);
        },
      },
    ]);
  };

  const handleVerifyUser = async (userId: string, userName: string) => {
    if (!userId?.trim()) {
      Alert.alert('Erreur', 'Utilisateur invalide.');
      return;
    }
    Alert.alert('Vérifier', `Vérifier le compte de ${userName} ?`, [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Vérifier',
        onPress: async () => {
          try {
            await verifyUser(userId);
            try {
              await addNotification({ userId, type: 'system', title: 'Compte vérifié ✓', message: 'Félicitations ! Votre compte est maintenant vérifié.' });
            } catch (_) {}
            await queryClient.invalidateQueries({ queryKey: ['allUsers'] });
            Alert.alert('Succès', `${userName} est maintenant vérifié`);
          } catch (e) {
            Alert.alert('Erreur', (e as Error)?.message ?? 'Impossible de vérifier l\'utilisateur.');
          }
        },
      },
    ]);
  };

  const handleUnverifyUser = async (userId: string, userName: string) => {
    if (!userId?.trim()) return;
    Alert.alert(
      'Retirer la vérification',
      `Retirer le badge vérifié de ${userName} ? Cette action est réversible.`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Retirer',
          style: 'destructive',
          onPress: async () => {
            try {
              await unverifyUser(userId);
              try {
                await addNotification({ userId, type: 'system', title: 'Vérification retirée', message: 'Votre badge de vérification a été retiré par un administrateur. Vous pouvez soumettre une nouvelle demande.' });
              } catch (_) {}
              await queryClient.invalidateQueries({ queryKey: ['allUsers'] });
              Alert.alert('Succès', `Badge vérifié retiré pour ${userName}`);
            } catch (e) {
              Alert.alert('Erreur', (e as Error)?.message ?? 'Impossible de retirer la vérification.');
            }
          },
        },
      ]
    );
  };

  const handleTicketAction = async (ticketId: string, action: 'in_progress' | 'resolve' | 'close') => {
    if (!ticketId?.trim()) {
      Alert.alert('Erreur', 'Ticket invalide.');
      return;
    }
    const status = action === 'in_progress' ? 'in_progress' : action === 'resolve' ? 'closed' : 'closed';
    const actionText = action === 'in_progress' ? 'en cours' : 'fermé';
    try {
      await updateTicketStatus({ ticketId, status });
      await queryClient.invalidateQueries({ queryKey: ['support'] });
      Alert.alert('Succès', `Ticket marqué ${actionText}`);
    } catch (e) {
      Alert.alert('Erreur', (e as Error)?.message ?? 'Impossible de mettre à jour le ticket.');
    }
  };

  const handleRespondToTicket = async () => {
    if (!selectedTicketForResponse || !ticketResponseText.trim()) {
      Alert.alert('Erreur', 'Veuillez entrer une réponse');
      return;
    }
    try {
      await respondToTicket({
        ticketId: selectedTicketForResponse.id,
        oderId: user?.id || '',
        userName: user?.fullName || user?.username || 'Admin',
        isAdmin: true,
        message: ticketResponseText.trim(),
      });
      setTicketResponseText('');
      setSelectedTicketForResponse(null);
      await queryClient.invalidateQueries({ queryKey: ['support'] });
      Alert.alert('Succès', 'Réponse envoyée');
    } catch (e) {
      Alert.alert('Erreur', (e as Error)?.message ?? 'Impossible d\'envoyer la réponse.');
    }
  };

  const handleVerificationAction = async (requestId: string, action: 'approve' | 'reject', userId: string, reason?: string) => {
    if (!requestId?.trim()) {
      Alert.alert('Erreur', 'Demande invalide.');
      return;
    }
    try {
      await handleVerification({ requestId, action, reason, adminId: user?.id ?? '' });
      if (action === 'approve' && userId?.trim()) {
        try {
          await verifyUser(userId);
        } catch (e) {
          await queryClient.invalidateQueries({ queryKey: ['allUsers'] });
          await queryClient.invalidateQueries({ queryKey: ['support'] });
          Alert.alert('Attention', 'Demande approuvée mais le compte n\'a pas pu être mis à jour : ' + ((e as Error)?.message ?? 'erreur'));
          return;
        }
        try {
          await addNotification({ userId, type: 'system', title: 'Compte vérifié ✓', message: 'Félicitations ! Votre demande de vérification a été approuvée.' });
        } catch (_) {}
      } else if (action === 'reject' && userId?.trim()) {
        try {
          await addNotification({ userId, type: 'system', title: 'Vérification refusée', message: 'Votre demande de vérification a été refusée. Vous pouvez soumettre une nouvelle demande.' });
        } catch (_) {}
      }
      await queryClient.invalidateQueries({ queryKey: ['allUsers'] });
      await queryClient.invalidateQueries({ queryKey: ['support'] });
      if (action === 'approve' && !userId?.trim()) {
        Alert.alert('Succès', 'Demande approuvée (compte utilisateur non mis à jour : id manquant).');
      } else {
        Alert.alert('Succès', action === 'approve' ? 'Utilisateur vérifié' : 'Demande refusée');
      }
    } catch (e) {
      Alert.alert('Erreur', (e as Error)?.message ?? 'Impossible de traiter la demande de vérification.');
    }
  };

  const performDeleteTeam = async (teamId: string) => {
    setDeletingTeamId(teamId);
    try {
      await deleteTeam({ teamId, userId: user?.id ?? '', asAdmin: true });
      try {
        await queryClient.invalidateQueries({ queryKey: ['teams'] });
        await refetchTeams();
      } catch (_) {}
      Alert.alert('Succès', 'Équipe supprimée');
    } catch (e) {
      Alert.alert('Erreur', (e as Error)?.message ?? 'Impossible de supprimer l\'équipe.');
    } finally {
      setDeletingTeamId(null);
    }
  };

  const handleDeleteTeam = async (teamId: string, teamName: string) => {
    if (!teamId?.trim()) {
      Alert.alert('Erreur', 'Équipe invalide.');
      return;
    }

    if (Platform.OS !== 'web') {
      await performDeleteTeam(teamId);
      return;
    }

    Alert.alert('Supprimer l\'équipe', `Dissoudre « ${teamName} » ? Cette action est irréversible.`, [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer',
        style: 'destructive',
        onPress: () => {
          void performDeleteTeam(teamId);
        },
      },
    ]);
  };

  const performDeleteMatch = async (matchId: string) => {
    setDeletingMatchId(matchId);
    try {
      await deleteMatch({ matchId, userId: user?.id ?? '', asAdmin: true });
      try {
        await queryClient.invalidateQueries({ queryKey: ['matches'] });
        await refetchMatches();
      } catch (_) {}
      Alert.alert('Succès', 'Match supprimé');
    } catch (e) {
      Alert.alert('Erreur', (e as Error)?.message ?? 'Impossible de supprimer le match.');
    } finally {
      setDeletingMatchId(null);
    }
  };

  const handleDeleteMatch = async (matchId: string, sportLabel: string) => {
    if (!matchId?.trim()) {
      Alert.alert('Erreur', 'Match invalide.');
      return;
    }

    if (Platform.OS !== 'web') {
      await performDeleteMatch(matchId);
      return;
    }

    Alert.alert('Supprimer le match', `Supprimer ce match (${sportLabel}) ? Cette action est irréversible.`, [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer',
        style: 'destructive',
        onPress: () => {
          void performDeleteMatch(matchId);
        },
      },
    ]);
  };

  const handleBulkBan = async () => {
    if (selectedUsers.length === 0) {
      Alert.alert('Erreur', 'Aucun utilisateur sélectionné');
      return;
    }
    Alert.alert('Bannir en masse', `Bannir ${selectedUsers.length} utilisateur(s) ?`, [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Bannir',
        style: 'destructive',
        onPress: async () => {
          let success = 0;
          for (const userId of selectedUsers) {
            try {
              await banUser(userId);
              success++;
            } catch (e) {
              if (__DEV__) console.warn('[Admin] Bulk ban failed for:', userId, e);
            }
          }
          setSelectedUsers([]);
          Alert.alert('Succès', `${success}/${selectedUsers.length} utilisateur(s) banni(s)`);
        },
      },
    ]);
  };

  const handleBulkUnban = async () => {
    if (selectedUsers.length === 0) {
      Alert.alert('Erreur', 'Aucun utilisateur sélectionné');
      return;
    }
    Alert.alert('Débannir en masse', `Débannir ${selectedUsers.length} utilisateur(s) ?`, [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Débannir',
        onPress: async () => {
          let success = 0;
          for (const userId of selectedUsers) {
            try {
              await unbanUser(userId);
              success++;
            } catch (e) {
              if (__DEV__) console.warn('[Admin] Bulk unban failed for:', userId, e);
            }
          }
          setSelectedUsers([]);
          Alert.alert('Succès', `${success}/${selectedUsers.length} utilisateur(s) débanni(s)`);
        },
      },
    ]);
  };

  const toggleUserSelection = (userId: string) => {
    setSelectedUsers(prev => 
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    );
  };

  const toggleSelectAll = () => {
    if (selectedUsers.length === filteredUsers.length) {
      setSelectedUsers([]);
    } else {
      setSelectedUsers(filteredUsers.map(u => u.id));
    }
  };

  const handleExportData = async (format: 'json' | 'csv') => {
    try {
      const data = {
        exportDate: new Date().toISOString(),
        stats: {
          totalUsers: stats.totalUsers,
          activeUsers: stats.activeUsers,
          bannedUsers: stats.bannedUsers,
          verifiedUsers: stats.verifiedUsers,
          premiumUsers: stats.premiumUsers,
          totalTeams: stats.totalTeams,
          totalMatches: stats.totalMatches,
          totalTournaments: stats.totalTournaments,
        },
        users: filteredUsers.map(u => ({
          id: u.id,
          fullName: u.fullName,
          email: u.email,
          phone: u.phone,
          city: u.city,
          country: u.country,
          isVerified: u.isVerified,
          isPremium: u.isPremium,
          isBanned: u.isBanned,
          createdAt: u.createdAt,
        })),
      };

      let exportContent = '';
      if (format === 'json') {
        exportContent = JSON.stringify(data, null, 2);
      } else {
        const headers = 'ID,Nom,Email,Téléphone,Ville,Pays,Vérifié,Premium,Banni,Date création\n';
        const rows = data.users.map(u => 
          `${u.id},${u.fullName},${u.email || ''},${u.phone || ''},${u.city || ''},${u.country || ''},${u.isVerified},${u.isPremium},${u.isBanned},${u.createdAt}`
        ).join('\n');
        exportContent = headers + rows;
      }

      await Share.share({
        message: exportContent,
        title: `Export Admin VSport - ${new Date().toLocaleDateString()}`,
      });
    } catch (e) {
      Alert.alert('Erreur', (e as Error)?.message ?? 'Impossible d\'exporter les données');
    }
  };

  const handleSendGlobalNotification = () => {
    if (!notificationMessage.trim()) {
      Alert.alert('Erreur', 'Veuillez entrer un message');
      return;
    }
    const message = notificationMessage.trim();
    const userIds = (users ?? []).filter(u => !u.isBanned).map(u => u.id);
    if (userIds.length === 0) {
      Alert.alert('Info', 'Aucun utilisateur actif à notifier.');
      return;
    }
    Alert.alert('Confirmer', `Envoyer cette annonce à ${userIds.length} utilisateur(s) ?\n\n"${message}"\n\nElle apparaîtra dans la cloche (Notifications) en haut à droite de l\'écran d\'accueil pour chaque utilisateur.`, [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Envoyer',
        onPress: async () => {
          setSendingNotif(true);
          let sent = 0;
          let lastError: string | null = null;
          const payload = { type: 'system' as const, title: 'Annonce', message, data: { route: '/notifications' } };
          try {
            try {
              await notificationsApi.sendToMany(userIds, payload);
              sent = userIds.length;
            } catch (err) {
              lastError = (err as Error)?.message ?? String(err);
              for (const uid of userIds) {
                try {
                  await notificationsApi.send(uid, payload);
                  sent += 1;
                } catch (e) {
                  if (!lastError) lastError = (e as Error)?.message ?? String(e);
                }
              }
            }
            setNotificationMessage('');
            queryClient.invalidateQueries({ queryKey: ['notifications'] });
            if (sent > 0) {
              Alert.alert('Succès', `Annonce envoyée à ${sent}/${userIds.length} utilisateur(s). Elle apparaît dans la cloche (écran d\'accueil) de chacun.`);
            } else {
              Alert.alert('Échec', `Aucune notification envoyée.${lastError ? ` Erreur : ${lastError}` : ''}\nVérifiez que Supabase est configuré et que la table notifications existe.`);
            }
          } catch (err) {
            Alert.alert('Erreur', (err as Error)?.message ?? 'Impossible d\'envoyer l\'annonce. Vérifiez la connexion.');
          } finally {
            setSendingNotif(false);
          }
        },
      },
    ]);
  };

  const formatDate = (date: Date | string | undefined) => {
    if (!date) return '-';
    try {
      return new Date(date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
    } catch {
      return '-';
    }
  };
  const formatTime = (date: Date | string | undefined) => {
    if (!date) return '-';
    try {
      const diff = Date.now() - new Date(date).getTime();
      const mins = Math.floor(diff / 60000);
      if (mins < 60) return `Il y a ${mins}min`;
      const hours = Math.floor(mins / 60);
      if (hours < 24) return `Il y a ${hours}h`;
      return formatDate(date);
    } catch {
      return '-';
    }
  };

  const getSeverityColor = (severity: ActivityLog['severity']) => {
    switch (severity) {
      case 'success': return Colors.status.success;
      case 'warning': return '#F59E0B';
      case 'error': return Colors.status.error;
      default: return Colors.primary.blue;
    }
  };

  const tabs: { key: AdminTab; label: string; icon: React.ReactNode; badge?: number }[] = useMemo(() => [
    { key: 'overview', label: 'Vue d\'ensemble', icon: <BarChart3 size={16} color={activeTab === 'overview' ? '#FFF' : Colors.text.secondary} /> },
    { key: 'users', label: 'Utilisateurs', icon: <Users size={16} color={activeTab === 'users' ? '#FFF' : Colors.text.secondary} /> },
    { key: 'banned', label: 'Bannis', icon: <Ban size={16} color={activeTab === 'banned' ? '#FFF' : Colors.text.secondary} />, badge: stats.bannedUsers },
    { key: 'teams', label: 'Équipes', icon: <Shield size={16} color={activeTab === 'teams' ? '#FFF' : Colors.text.secondary} /> },
    { key: 'matches', label: 'Matchs', icon: <Swords size={16} color={activeTab === 'matches' ? '#FFF' : Colors.text.secondary} /> },
    { key: 'tournaments', label: 'Tournois', icon: <Award size={16} color={activeTab === 'tournaments' ? '#FFF' : Colors.text.secondary} /> },
    { key: 'tickets', label: 'Tickets', icon: <Ticket size={16} color={activeTab === 'tickets' ? '#FFF' : Colors.text.secondary} />, badge: (pendingTickets ?? []).length },
    { key: 'verifications', label: 'Vérifications', icon: <UserCheck size={16} color={activeTab === 'verifications' ? '#FFF' : Colors.text.secondary} />, badge: (pendingVerifications ?? []).length },
    { key: 'payments', label: 'Paiements', icon: <DollarSign size={16} color={activeTab === 'payments' ? '#FFF' : Colors.text.secondary} />, badge: pendingPayments.length },
    { key: 'payouts', label: 'Avances', icon: <FileText size={16} color={activeTab === 'payouts' ? '#FFF' : Colors.text.secondary} />, badge: pendingPayoutRequests.length },
    { key: 'activity', label: 'Activité', icon: <Activity size={16} color={activeTab === 'activity' ? '#FFF' : Colors.text.secondary} /> },
    { key: 'qa', label: 'QA', icon: <Server size={16} color={activeTab === 'qa' ? '#FFF' : Colors.text.secondary} /> },
    { key: 'prod_report', label: 'Rapport Prod', icon: <CheckCircle size={16} color={activeTab === 'prod_report' ? '#FFF' : Colors.text.secondary} /> },
    { key: 'analytics', label: 'Analytiques', icon: <TrendingUp size={16} color={activeTab === 'analytics' ? '#FFF' : Colors.text.secondary} /> },
    { key: 'settings', label: 'Paramètres', icon: <Settings size={16} color={activeTab === 'settings' ? '#FFF' : Colors.text.secondary} /> },
  ], [activeTab, pendingTickets, pendingVerifications, pendingPayments.length, pendingPayoutRequests.length]);

  const renderQa = () => (
    <>
      <Card style={styles.settingsCard}>
        <Text style={styles.cardTitle}>Système QA interne</Text>
        <Text style={styles.cardDesc}>Exécute des scénarios multi-domaines, stress, sécurité, intégrité, et journalise les résultats dans `qa_test_logs`.</Text>
        <View style={styles.qaButtonRow}>
          <Button title={qaRunning ? 'Exécution…' : '▶ Run All'} onPress={runQaAll} variant="primary" style={styles.qaBtn} disabled={qaRunning} />
          <Button title="⟳ Reload Logs" onPress={loadQaLogs} variant="outline" style={styles.qaBtn} disabled={qaRunning} />
        </View>
        <Text style={[styles.cardDesc, { marginTop: 8 }]}>Mode requis: `EXPO_PUBLIC_QA_TEST_MODE=true`</Text>
      </Card>

      <Card style={styles.settingsCard}>
        <View style={styles.cardTitleRow}>
          <Text style={styles.cardTitle}>Exécution en temps réel</Text>
          {qaRunning && (
            <View style={styles.liveBadge}>
              <View style={styles.liveDot} />
              <Text style={styles.liveText}>LIVE</Text>
            </View>
          )}
        </View>
        {qaLiveEvents.length === 0 ? (
          <Text style={styles.emptyText}>Aucun événement live pour le moment.</Text>
        ) : (
          qaLiveEvents.slice(0, 60).map((event, index) => {
            const label =
              event.type === 'run_started'
                ? `Run started (${event.mode})`
                : event.type === 'scenario_started'
                  ? `[${event.domain}] ${event.scenarioName} started`
                  : event.type === 'step_started'
                    ? `Step started: ${event.stepName}`
                    : event.type === 'step_finished'
                      ? `${event.status.toUpperCase()} ${event.stepName} (${event.durationMs}ms)`
                      : event.type === 'scenario_finished'
                        ? `[${event.domain}] ${event.scenarioName} ${event.status.toUpperCase()} (${event.durationMs}ms)`
                        : `Run finished - pass:${event.summary.passed} fail:${event.summary.failed} warn:${event.summary.warnings}`;

            return (
              <View key={`${event.type}-${event.at}-${index}`} style={styles.qaEventItem}>
                <Text style={styles.qaEventText}>{label}</Text>
                {'error' in event && event.error ? <Text style={styles.qaEventError}>Erreur: {event.error}</Text> : null}
                {'details' in event && event.details ? <Text style={styles.qaMetaText}>{event.details}</Text> : null}
                <Text style={styles.qaMetaText}>{formatDate(event.at)}</Text>
              </View>
            );
          })
        )}
      </Card>

      <Card style={styles.settingsCard}>
        <Text style={styles.cardTitle}>Run par domaine</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.qaDomainRow}>
          {qaDomains.map((domain) => (
            <TouchableOpacity
              key={domain}
              style={[styles.qaDomainChip, qaSelectedDomain === domain && styles.qaDomainChipActive]}
              onPress={() => setQaSelectedDomain(domain)}
              disabled={qaRunning}
            >
              <Text style={[styles.qaDomainChipText, qaSelectedDomain === domain && styles.qaDomainChipTextActive]}>{domain}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        <Button title={qaRunning ? 'Exécution…' : `▶ Run ${qaSelectedDomain}`} onPress={runQaByDomain} variant="outline" disabled={qaRunning} />
      </Card>

      {qaResult && (
        <Card style={styles.settingsCard}>
          <Text style={styles.cardTitle}>Dernier résultat ({qaResult.mode})</Text>
          <View style={styles.qaSummaryRow}>
            <View style={styles.qaSummaryItem}><Text style={styles.qaSummaryLabel}>Scénarios</Text><Text style={styles.qaSummaryValue}>{qaResult.summary.totalScenarios}</Text></View>
            <View style={styles.qaSummaryItem}><Text style={styles.qaSummaryLabel}>Passés</Text><Text style={[styles.qaSummaryValue, { color: Colors.status.success }]}>{qaResult.summary.passed}</Text></View>
            <View style={styles.qaSummaryItem}><Text style={styles.qaSummaryLabel}>Échecs</Text><Text style={[styles.qaSummaryValue, { color: Colors.status.error }]}>{qaResult.summary.failed}</Text></View>
            <View style={styles.qaSummaryItem}><Text style={styles.qaSummaryLabel}>Warnings</Text><Text style={[styles.qaSummaryValue, { color: '#F59E0B' }]}>{qaResult.summary.warnings}</Text></View>
          </View>
          <Text style={styles.qaMetaText}>Run ID: {qaResult.runId}</Text>
          <Text style={styles.qaMetaText}>Durée: {qaResult.summary.durationMs} ms</Text>

          {qaResult.scenarios.map((scenario) => (
            <View key={scenario.id} style={styles.qaScenarioItem}>
              <View style={styles.qaScenarioHeader}>
                <Text style={styles.qaScenarioTitle}>{scenario.name}</Text>
                <Text style={[
                  styles.qaScenarioStatus,
                  scenario.status === 'passed'
                    ? { color: Colors.status.success }
                    : scenario.status === 'failed'
                      ? { color: Colors.status.error }
                      : scenario.status === 'warning'
                        ? { color: '#F59E0B' }
                        : { color: Colors.text.muted },
                ]}>
                  {scenario.status.toUpperCase()}
                </Text>
              </View>
              <Text style={styles.qaMetaText}>{scenario.domain} • {scenario.durationMs} ms</Text>
              {scenario.steps.map((step) => (
                <Text key={step.id} style={styles.qaStepText}>• {step.status.toUpperCase()} {step.name}</Text>
              ))}
            </View>
          ))}
        </Card>
      )}

      {prodReportResult && qaResult && (
        <Card style={[styles.settingsCard, { borderWidth: 1, borderColor: prodReportResult.readyForProduction ? Colors.status.success : Colors.status.error }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <Text style={styles.cardTitle}>Rapport Pré-Production</Text>
            <View style={{ backgroundColor: prodReportResult.readyForProduction ? Colors.status.success : Colors.status.error, paddingHorizontal: 10, paddingVertical: 3, borderRadius: 16 }}>
              <Text style={{ color: '#FFF', fontWeight: '700', fontSize: 11 }}>{prodReportResult.readyForProduction ? '✅ PRÊT' : '🚫 NON PRÊT'}</Text>
            </View>
          </View>
          <Text style={{ color: Colors.text.muted, fontSize: 13, marginBottom: 8 }}>
            Score : <Text style={{ color: prodReportResult.overallScore >= 95 ? Colors.status.success : prodReportResult.overallScore >= 80 ? '#F59E0B' : Colors.status.error, fontWeight: '700' }}>{prodReportResult.overallScore}/100</Text>
            {'  ·  '}{prodReportResult.durationMs}ms
          </Text>
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 10 }}>
            <View style={{ flex: 1, backgroundColor: '#FF4D4D22', borderRadius: 8, padding: 8, alignItems: 'center' }}>
              <Text style={{ color: Colors.status.error, fontWeight: '700', fontSize: 20 }}>{prodReportResult.blockers.length}</Text>
              <Text style={{ color: Colors.status.error, fontSize: 11 }}>Bloqueurs</Text>
            </View>
            <View style={{ flex: 1, backgroundColor: '#F59E0B22', borderRadius: 8, padding: 8, alignItems: 'center' }}>
              <Text style={{ color: '#F59E0B', fontWeight: '700', fontSize: 20 }}>{prodReportResult.warnings.length}</Text>
              <Text style={{ color: '#F59E0B', fontSize: 11 }}>Warnings</Text>
            </View>
            <View style={{ flex: 1, backgroundColor: '#22C55E22', borderRadius: 8, padding: 8, alignItems: 'center' }}>
              <Text style={{ color: Colors.status.success, fontWeight: '700', fontSize: 20 }}>{prodReportResult.passed.length}</Text>
              <Text style={{ color: Colors.status.success, fontSize: 11 }}>Passés</Text>
            </View>
          </View>
          {prodReportResult.blockers.length > 0 && (
            <>
              <Text style={{ color: Colors.status.error, fontWeight: '700', fontSize: 12, marginBottom: 6 }}>🚫 BLOQUEURS</Text>
              {prodReportResult.blockers.map((c) => (
                <View key={c.id} style={{ marginBottom: 6, paddingLeft: 8, borderLeftWidth: 2, borderLeftColor: Colors.status.error }}>
                  <Text style={{ color: Colors.status.error, fontWeight: '600', fontSize: 12 }}>{c.name}</Text>
                  <Text style={{ color: Colors.text.muted, fontSize: 11, marginTop: 1 }}>{c.details}</Text>
                  {c.suggestion && <Text style={{ color: '#F59E0B', fontSize: 10, marginTop: 1 }}>💡 {c.suggestion}</Text>}
                </View>
              ))}
            </>
          )}
          {prodReportResult.warnings.length > 0 && (
            <>
              <Text style={{ color: '#F59E0B', fontWeight: '700', fontSize: 12, marginBottom: 6, marginTop: prodReportResult.blockers.length > 0 ? 8 : 0 }}>⚠️ WARNINGS</Text>
              {prodReportResult.warnings.map((c) => (
                <View key={c.id} style={{ marginBottom: 6, paddingLeft: 8, borderLeftWidth: 2, borderLeftColor: '#F59E0B' }}>
                  <Text style={{ color: '#F59E0B', fontWeight: '600', fontSize: 12 }}>{c.name}</Text>
                  <Text style={{ color: Colors.text.muted, fontSize: 11, marginTop: 1 }}>{c.details}</Text>
                </View>
              ))}
            </>
          )}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 8 }}>
            {prodReportResult.categories.map((cat) => (
              <View key={cat.category} style={{ backgroundColor: cat.score >= 80 ? '#22C55E22' : cat.score >= 50 ? '#F59E0B22' : '#FF4D4D22', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 }}>
                <Text style={{ color: cat.score >= 80 ? Colors.status.success : cat.score >= 50 ? '#F59E0B' : Colors.status.error, fontSize: 11, fontWeight: '600' }}>
                  {cat.category.replace('_', ' ')} {cat.score}%
                </Text>
              </View>
            ))}
          </View>
        </Card>
      )}

      <Card style={styles.settingsCard}>
        <Text style={styles.cardTitle}>Logs persistés (`qa_test_logs`)</Text>
        {qaLogs.length === 0 ? (
          <Text style={styles.emptyText}>Aucun log QA pour le moment.</Text>
        ) : (
          qaLogs.slice(0, 20).map((log) => (
            <View key={log.id} style={styles.qaLogItem}>
              <Text style={styles.qaLogTitle}>{log.scenario_name}</Text>
              <Text style={styles.qaMetaText}>{log.domain} • {log.status} • {log.duration_ms ?? 0} ms</Text>
              <Text style={styles.qaMetaText}>{formatDate(log.created_at)}</Text>
            </View>
          ))
        )}
      </Card>
    </>
  );

  const renderPaymentsTab = () => (
    <Card style={styles.listCard}>
      <Text style={styles.cardTitle}>Gestion des paiements tournois</Text>
      <Text style={styles.cardDesc}>Valider ou rejeter les preuves de paiement soumises par les équipes.</Text>
      <View style={[styles.summaryGrid, { marginTop: 12 }]}>
        <View style={styles.summaryItem}>
          <DollarSign size={20} color={Colors.primary.orange} />
          <Text style={styles.summaryValue}>{pendingPayments.length}</Text>
          <Text style={styles.summaryLabel}>En attente</Text>
        </View>
      </View>
      <Button
        title="Ouvrir le gestionnaire des paiements"
        onPress={() => router.push('/admin/payments' as any)}
        variant="orange"
        size="large"
        style={{ marginTop: 12 }}
      />
    </Card>
  );

  const renderPayoutsTab = () => (
    <Card style={styles.listCard}>
      <Text style={styles.cardTitle}>Demandes d’avance organisateurs</Text>
      <Text style={styles.cardDesc}>Approuver ou rejeter les demandes de reversement anticipé des organisateurs.</Text>
      <View style={[styles.summaryGrid, { marginTop: 12 }]}>
        <View style={styles.summaryItem}>
          <FileText size={20} color={Colors.status.warning} />
          <Text style={styles.summaryValue}>{pendingPayoutRequests.length}</Text>
          <Text style={styles.summaryLabel}>En attente</Text>
        </View>
      </View>
      <Button
        title="Ouvrir le gestionnaire des avances"
        onPress={() => router.push('/admin/payout-requests' as any)}
        variant="primary"
        size="large"
        style={{ marginTop: 12 }}
      />
    </Card>
  );

  const renderOverview = () => (
    <>
      <Card style={styles.autoRefreshCard}>
        <View style={styles.autoRefreshRow}>
          <View style={styles.autoRefreshInfo}>
            <RefreshCw size={16} color={autoRefresh ? Colors.status.success : Colors.text.muted} />
            <Text style={styles.autoRefreshText}>Actualisation auto (30s)</Text>
          </View>
          <Switch 
            value={autoRefresh} 
            onValueChange={setAutoRefresh}
            trackColor={{ false: Colors.background.cardLight, true: Colors.status.success }}
            thumbColor="#FFF"
          />
        </View>
        <Text style={styles.lastRefreshText}>Dernière mise à jour : {formatTime(lastRefresh)}</Text>
      </Card>

      <View style={styles.statsGrid}>
        <TouchableOpacity onPress={() => setActiveTab('users')} activeOpacity={0.7}>
          <StatCard label="Utilisateurs" value={stats.totalUsers} icon={<Users size={20} color={Colors.primary.blue} />} variant="blue" />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setActiveTab('teams')} activeOpacity={0.7}>
          <StatCard label="Équipes" value={stats.totalTeams} icon={<Shield size={20} color={Colors.primary.orange} />} variant="orange" />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setActiveTab('matches')} activeOpacity={0.7}>
          <StatCard label="Matchs" value={stats.totalMatches} icon={<Swords size={20} color={Colors.status.success} />} variant="default" />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setActiveTab('tournaments')} activeOpacity={0.7}>
          <StatCard label="Tournois" value={stats.totalTournaments} icon={<Award size={20} color="#A855F7" />} variant="default" />
        </TouchableOpacity>
      </View>
      <View style={styles.statsGrid}>
        <TouchableOpacity onPress={() => setActiveTab('activity')} activeOpacity={0.7}>
          <StatCard label="Actifs/jour" value={stats.dailyActiveUsers} icon={<Activity size={20} color={Colors.status.success} />} variant="default" />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => { setActiveTab('users'); setFilterStatus('verified'); }} activeOpacity={0.7}>
          <StatCard label="Vérifiés" value={stats.verifiedUsers} icon={<CheckCircle size={20} color={Colors.primary.blue} />} variant="blue" />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setActiveTab('users')} activeOpacity={0.7}>
          <StatCard label="Premium" value={stats.premiumUsers} icon={<Star size={20} color="#F59E0B" />} variant="orange" />
        </TouchableOpacity>
      </View>

      <Card style={styles.growthCard}>
        <Text style={styles.cardTitle}>Croissance aujourd'hui vs hier</Text>
        <View style={styles.growthGrid}>
          <TouchableOpacity style={styles.growthItem} onPress={() => setActiveTab('users')} activeOpacity={0.7}>
            <Users size={18} color={Colors.primary.blue} />
            <Text style={styles.growthLabel}>Inscriptions</Text>
            <Text style={styles.growthValue}>{summaryToday.inscriptions}</Text>
            <View style={[styles.growthBadge, getGrowthPercent(summaryToday.inscriptions, summaryYesterday.inscriptions) >= 0 ? styles.growthBadgePositive : styles.growthBadgeNegative]}>
              {getGrowthPercent(summaryToday.inscriptions, summaryYesterday.inscriptions) >= 0 ? <TrendingUp size={12} color={Colors.status.success} /> : <TrendingDown size={12} color={Colors.status.error} />}
              <Text style={[styles.growthPercent, getGrowthPercent(summaryToday.inscriptions, summaryYesterday.inscriptions) >= 0 ? styles.growthPercentPositive : styles.growthPercentNegative]}>
                {getGrowthPercent(summaryToday.inscriptions, summaryYesterday.inscriptions) >= 0 ? '+' : ''}{getGrowthPercent(summaryToday.inscriptions, summaryYesterday.inscriptions)}%
              </Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity style={styles.growthItem} onPress={() => setActiveTab('matches')} activeOpacity={0.7}>
            <Swords size={18} color={Colors.primary.orange} />
            <Text style={styles.growthLabel}>Matchs</Text>
            <Text style={styles.growthValue}>{summaryToday.matchs}</Text>
            <View style={[styles.growthBadge, getGrowthPercent(summaryToday.matchs, summaryYesterday.matchs) >= 0 ? styles.growthBadgePositive : styles.growthBadgeNegative]}>
              {getGrowthPercent(summaryToday.matchs, summaryYesterday.matchs) >= 0 ? <TrendingUp size={12} color={Colors.status.success} /> : <TrendingDown size={12} color={Colors.status.error} />}
              <Text style={[styles.growthPercent, getGrowthPercent(summaryToday.matchs, summaryYesterday.matchs) >= 0 ? styles.growthPercentPositive : styles.growthPercentNegative]}>
                {getGrowthPercent(summaryToday.matchs, summaryYesterday.matchs) >= 0 ? '+' : ''}{getGrowthPercent(summaryToday.matchs, summaryYesterday.matchs)}%
              </Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity style={styles.growthItem} onPress={() => setActiveTab('teams')} activeOpacity={0.7}>
            <Shield size={18} color={Colors.status.success} />
            <Text style={styles.growthLabel}>Équipes</Text>
            <Text style={styles.growthValue}>{summaryToday.equipes}</Text>
            <View style={[styles.growthBadge, getGrowthPercent(summaryToday.equipes, summaryYesterday.equipes) >= 0 ? styles.growthBadgePositive : styles.growthBadgeNegative]}>
              {getGrowthPercent(summaryToday.equipes, summaryYesterday.equipes) >= 0 ? <TrendingUp size={12} color={Colors.status.success} /> : <TrendingDown size={12} color={Colors.status.error} />}
              <Text style={[styles.growthPercent, getGrowthPercent(summaryToday.equipes, summaryYesterday.equipes) >= 0 ? styles.growthPercentPositive : styles.growthPercentNegative]}>
                {getGrowthPercent(summaryToday.equipes, summaryYesterday.equipes) >= 0 ? '+' : ''}{getGrowthPercent(summaryToday.equipes, summaryYesterday.equipes)}%
              </Text>
            </View>
          </TouchableOpacity>
        </View>
      </Card>

      <Card style={styles.revenueCard}>
        <View style={styles.revenueHeader}>
          <View>
            <Text style={styles.revenueTitle}>Revenus</Text>
            <Text style={styles.revenueAmount}>—</Text>
          </View>
          <Text style={styles.revenueSub}>Non disponibles (aucune donnée de paiement)</Text>
        </View>
      </Card>

      <TouchableOpacity onPress={() => setActiveTab('matches')} activeOpacity={0.9}>
        <Card style={styles.systemCard}>
          <Text style={styles.cardTitle}>Matchs par statut</Text>
          <View style={styles.systemStats}>
            <View style={styles.systemStat}>
              <View style={[styles.systemIndicator, { backgroundColor: Colors.status.success }]} />
              <Swords size={18} color={Colors.text.secondary} />
              <View style={styles.systemStatInfo}>
                <Text style={styles.systemStatLabel}>Ouverts</Text>
                <Text style={styles.systemStatValue}>{stats.openMatches}</Text>
              </View>
            </View>
            <View style={styles.systemStat}>
              <View style={[styles.systemIndicator, { backgroundColor: Colors.primary.blue }]} />
              <Calendar size={18} color={Colors.text.secondary} />
              <View style={styles.systemStatInfo}>
                <Text style={styles.systemStatLabel}>Confirmés</Text>
                <Text style={styles.systemStatValue}>{stats.confirmedMatches}</Text>
              </View>
            </View>
            <View style={styles.systemStat}>
              <View style={[styles.systemIndicator, { backgroundColor: Colors.text.muted }]} />
              <CheckCircle size={18} color={Colors.text.secondary} />
              <View style={styles.systemStatInfo}>
                <Text style={styles.systemStatLabel}>Terminés</Text>
                <Text style={styles.systemStatValue}>{stats.completedMatches}</Text>
              </View>
            </View>
          </View>
        </Card>
      </TouchableOpacity>

      <Card style={styles.actionsCard}>
        <Text style={styles.cardTitle}>Actions urgentes</Text>
        {(pendingTickets ?? []).length > 0 && (
          <TouchableOpacity style={styles.urgentRow} onPress={() => setActiveTab('tickets')}>
            <View style={[styles.urgentIcon, { backgroundColor: 'rgba(239,68,68,0.1)' }]}><AlertTriangle size={18} color={Colors.status.error} /></View>
            <View style={styles.urgentInfo}><Text style={styles.urgentTitle}>{(pendingTickets ?? []).length} tickets en attente</Text><Text style={styles.urgentDesc}>Nécessite votre attention</Text></View>
            <ChevronRight size={20} color={Colors.text.muted} />
          </TouchableOpacity>
        )}
        {(pendingVerifications ?? []).length > 0 && (
          <TouchableOpacity style={styles.urgentRow} onPress={() => setActiveTab('verifications')}>
            <View style={[styles.urgentIcon, { backgroundColor: 'rgba(21,101,192,0.1)' }]}><UserCheck size={18} color={Colors.primary.blue} /></View>
            <View style={styles.urgentInfo}><Text style={styles.urgentTitle}>{(pendingVerifications ?? []).length} vérifications</Text><Text style={styles.urgentDesc}>En attente d&apos;approbation</Text></View>
            <ChevronRight size={20} color={Colors.text.muted} />
          </TouchableOpacity>
        )}
        {(stats?.bannedUsers ?? 0) > 0 && (
          <TouchableOpacity style={styles.urgentRow} onPress={() => { setActiveTab('users'); setFilterStatus('banned'); }}>
            <View style={[styles.urgentIcon, { backgroundColor: 'rgba(239,68,68,0.1)' }]}><Ban size={18} color={Colors.status.error} /></View>
            <View style={styles.urgentInfo}><Text style={styles.urgentTitle}>{stats.bannedUsers} utilisateurs bannis</Text><Text style={styles.urgentDesc}>Réviser les suspensions</Text></View>
            <ChevronRight size={20} color={Colors.text.muted} />
          </TouchableOpacity>
        )}
        {(pendingTickets ?? []).length === 0 && (pendingVerifications ?? []).length === 0 && (stats?.bannedUsers ?? 0) === 0 && (
          <View style={styles.noUrgent}><CheckCircle size={32} color={Colors.status.success} /><Text style={styles.noUrgentText}>Aucune action urgente</Text></View>
        )}
      </Card>

      <Card style={styles.actionsCard}>
        <Text style={styles.cardTitle}>Accès rapide</Text>
        {[
          { title: 'Activité récente', icon: <Activity size={20} color={Colors.text.secondary} />, tab: 'activity' as AdminTab },
          { title: 'Analytiques détaillées', icon: <PieChart size={20} color={Colors.text.secondary} />, tab: 'analytics' as AdminTab },
          { title: 'Configuration', icon: <Settings size={20} color={Colors.text.secondary} />, tab: 'settings' as AdminTab },
        ].map((item, i) => (
          <TouchableOpacity key={i} style={styles.actionRow} onPress={() => setActiveTab(item.tab)}>
            {item.icon}<Text style={styles.actionText}>{item.title}</Text>
            <ChevronRight size={20} color={Colors.text.muted} />
          </TouchableOpacity>
        ))}
      </Card>
    </>
  );

  const renderUsers = () => (
    <>
      <View style={styles.filterRow}>
        {(['all', 'active', 'banned', 'verified'] as const).map(status => (
          <TouchableOpacity key={status} style={[styles.filterChip, filterStatus === status && styles.filterChipActive]} onPress={() => setFilterStatus(status)}>
            <Text style={[styles.filterChipText, filterStatus === status && styles.filterChipTextActive]}>
              {status === 'all' ? 'Tous' : status === 'active' ? 'Actifs' : status === 'banned' ? 'Bannis' : 'Vérifiés'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      <Card style={styles.toolbarCard}>
        <View style={styles.toolbarRow}>
          <TouchableOpacity style={styles.toolbarBtn} onPress={toggleSelectAll}>
            {selectedUsers.length === filteredUsers.length ? <CheckSquare size={18} color={Colors.primary.blue} /> : <Square size={18} color={Colors.text.secondary} />}
            <Text style={styles.toolbarBtnText}>{selectedUsers.length > 0 ? `${selectedUsers.length} sélectionné(s)` : 'Tout sélectionner'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.toolbarBtn} onPress={() => {
            const newOrder = sortOrder === 'asc' ? 'desc' : 'asc';
            setSortOrder(newOrder);
          }}>
            <ArrowUpDown size={18} color={Colors.text.secondary} />
            <Text style={styles.toolbarBtnText}>{sortBy === 'name' ? 'Nom' : sortBy === 'date' ? 'Date' : 'Ville'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.toolbarBtn} onPress={() => {
            Alert.alert('Trier par', 'Choisir le critère de tri', [
              { text: 'Nom', onPress: () => setSortBy('name') },
              { text: 'Date', onPress: () => setSortBy('date') },
              { text: 'Ville', onPress: () => setSortBy('city') },
              { text: 'Annuler', style: 'cancel' },
            ]);
          }}>
            <Filter size={18} color={Colors.text.secondary} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.toolbarBtn} onPress={() => {
            Alert.alert('Exporter', 'Choisir le format', [
              { text: 'JSON', onPress: () => handleExportData('json') },
              { text: 'CSV', onPress: () => handleExportData('csv') },
              { text: 'Annuler', style: 'cancel' },
            ]);
          }}>
            <Download size={18} color={Colors.text.secondary} />
          </TouchableOpacity>
        </View>
        {selectedUsers.length > 0 && (
          <View style={styles.bulkActionsRow}>
            <TouchableOpacity style={styles.bulkActionBtn} onPress={handleBulkBan}>
              <Ban size={16} color={Colors.status.error} />
              <Text style={styles.bulkActionText}>Bannir</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.bulkActionBtn} onPress={handleBulkUnban}>
              <CheckCircle size={16} color={Colors.status.success} />
              <Text style={styles.bulkActionText}>Débannir</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.bulkActionBtn} onPress={() => setSelectedUsers([])}>
              <X size={16} color={Colors.text.muted} />
              <Text style={styles.bulkActionText}>Annuler</Text>
            </TouchableOpacity>
          </View>
        )}
      </Card>
      <Card style={styles.listCard}>
        <View style={styles.listHeader}><Text style={styles.cardTitle}>Utilisateurs ({filteredUsers.length})</Text></View>
        {filteredUsers.map((u) => (
          <View key={u.id} style={styles.userItem}>
            <TouchableOpacity 
              style={styles.userCheckbox} 
              onPress={() => toggleUserSelection(u.id)}
            >
              {selectedUsers.includes(u.id) ? 
                <CheckSquare size={20} color={Colors.primary.blue} /> : 
                <Square size={20} color={Colors.text.muted} />
              }
            </TouchableOpacity>
            <TouchableOpacity style={styles.userItemContent} onPress={() => router.push(`/user/${u.id}`)}>
              <Avatar uri={u.avatar} name={u.fullName} size="medium" />
              <View style={styles.userInfo}>
              <View style={styles.userNameRow}>
                <Text style={styles.userName}>{u.fullName}</Text>
                {u.isVerified && <CheckCircle size={14} color={Colors.primary.blue} />}
                {u.isPremium && <Star size={14} color={Colors.primary.orange} />}
                {u.isBanned && <Ban size={14} color={Colors.status.error} />}
              </View>
              <Text style={styles.userEmail}>{u.email ?? u.phone ?? '-'}</Text>
              <Text style={styles.userMeta}>{u.city || '-'} • {formatDate(u.createdAt)}</Text>
            </View>
            </TouchableOpacity>
            <View style={styles.userActions}>
              {u.isBanned ? (
                <TouchableOpacity style={styles.actionBtnGreen} onPress={() => handleUnbanUser(u.id, u.fullName)}><CheckCircle size={16} color={Colors.status.success} /></TouchableOpacity>
              ) : (
                <TouchableOpacity style={styles.actionBtnRed} onPress={() => handleBanUser(u.id, u.fullName)}><Ban size={16} color={Colors.status.error} /></TouchableOpacity>
              )}
              {u.isVerified
                ? <TouchableOpacity style={styles.actionBtnRed} onPress={() => handleUnverifyUser(u.id, u.fullName)} accessibilityLabel={`Retirer vérification de ${u.fullName}`}><UserCheck size={16} color={Colors.status.error} /></TouchableOpacity>
                : <TouchableOpacity style={styles.actionBtnBlue} onPress={() => handleVerifyUser(u.id, u.fullName)} accessibilityLabel={`Vérifier ${u.fullName}`}><CheckCircle size={16} color={Colors.primary.blue} /></TouchableOpacity>
              }
            </View>
          </View>
        ))}
      </Card>
    </>
  );

  const renderTeams = () => (
    <Card style={styles.listCard}>
      <Text style={styles.cardTitle}>Équipes ({filteredTeams.length})</Text>
      {filteredTeams.map((team) => (
        <View key={team.id} style={styles.teamItem}>
          <TouchableOpacity style={styles.teamItemTouch} onPress={() => router.push(`/team/${team.id}`)}>
            <Avatar uri={team.logo} name={team.name} size="medium" />
            <View style={styles.teamInfo}>
              <Text style={styles.teamName}>{team.name}</Text>
              <Text style={styles.teamMeta}>{(sportLabels as Record<string, string>)[team.sport] ?? team.sport} • {team.format}</Text>
              <Text style={styles.teamStatText}>{(team.members ?? []).length}/{team.maxMembers} membres • {team.city || '-'}</Text>
            </View>
          </TouchableOpacity>
          <View style={styles.userActions}>
            <TouchableOpacity style={styles.actionBtnBlue} onPress={() => router.push(`/team/${team.id}`)} accessibilityLabel="Voir l'équipe"><Eye size={16} color={Colors.primary.blue} /></TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtnRed, deletingTeamId === team.id && { opacity: 0.5 }]}
              onPress={() => handleDeleteTeam(team.id, team.name)}
              disabled={deletingTeamId === team.id}
              accessibilityLabel="Supprimer l'équipe"
            >
              <Trash2 size={16} color={Colors.status.error} />
            </TouchableOpacity>
          </View>
        </View>
      ))}
    </Card>
  );

  const renderMatches = () => (
    <Card style={styles.listCard}>
      <Text style={styles.cardTitle}>Matchs ({filteredMatches.length})</Text>
      {filteredMatches.map((match) => (
        <View key={match.id} style={styles.matchItem}>
          <TouchableOpacity style={styles.matchItemTouch} onPress={() => router.push(`/match/${match.id}`)}>
            <View style={[styles.matchStatus, match.status === 'open' ? styles.statusOpen : match.status === 'confirmed' ? styles.statusConfirmed : match.status === 'completed' ? styles.statusCompleted : styles.statusCancelled]} />
            <View style={styles.matchInfo}>
              <Text style={styles.matchTitle}>{(sportLabels as Record<string, string>)[match.sport] ?? match.sport} - {match.format}</Text>
              <View style={styles.matchDetails}><Calendar size={12} color={Colors.text.muted} /><Text style={styles.matchDetailText}>{formatDate(match.dateTime)}</Text></View>
              <View style={styles.matchDetails}><MapPin size={12} color={Colors.text.muted} /><Text style={styles.matchDetailText}>{match.venue?.name ?? '-'}</Text></View>
            </View>
          </TouchableOpacity>
          <View style={styles.userActions}>
            <TouchableOpacity style={styles.actionBtnBlue} onPress={() => router.push(`/match/${match.id}`)} accessibilityLabel="Voir le match"><Eye size={16} color={Colors.primary.blue} /></TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtnRed, deletingMatchId === match.id && { opacity: 0.5 }]}
              onPress={() => handleDeleteMatch(match.id, (sportLabels as Record<string, string>)[match.sport] ?? match.sport)}
              disabled={deletingMatchId === match.id}
              accessibilityLabel="Supprimer le match"
            >
              <Trash2 size={16} color={Colors.status.error} />
            </TouchableOpacity>
          </View>
        </View>
      ))}
    </Card>
  );

  const renderTournaments = () => (
    <Card style={styles.listCard}>
      <View style={styles.cardTitleRow}>
        <Text style={styles.cardTitle}>Tournois ({filteredTournaments.length})</Text>
        <TouchableOpacity style={styles.adminCreateBtn} onPress={() => router.navigate('/create-tournament' as any)}>
          <Plus size={18} color="#FFFFFF" />
          <Text style={styles.adminCreateBtnText}>Créer</Text>
        </TouchableOpacity>
      </View>
      {filteredTournaments.length === 0 ? (
        <View style={styles.emptyState}>
          <Award size={40} color={Colors.text.muted} />
          <Text style={styles.emptyText}>Aucun tournoi</Text>
          <Button title="Créer un tournoi" onPress={() => router.navigate('/create-tournament' as any)} variant="orange" size="medium" style={{ marginTop: 12 }} />
        </View>
      ) : (
        filteredTournaments.map((t) => (
          <TouchableOpacity key={t.id} style={styles.teamItem} onPress={() => router.push(`/tournament/${t.id}`)}>
            <View style={[styles.matchStatus, t.status === 'registration' ? styles.statusOpen : t.status === 'in_progress' ? styles.statusConfirmed : styles.statusCompleted]} />
            <View style={styles.teamInfo}>
              <Text style={styles.teamName}>{t.name}</Text>
              <Text style={styles.teamMeta}>{(sportLabels as Record<string, string>)[t.sport] ?? t.sport} • {t.format} • {(t.registeredTeams?.length ?? 0)}/{t.maxTeams} équipes</Text>
              <Text style={styles.teamStatText}>{t.venue?.name ?? '-'} • {formatDate(t.startDate)}</Text>
            </View>
            <TouchableOpacity style={styles.actionBtnBlue} onPress={(e) => { e.stopPropagation(); router.push(`/tournament/${t.id}`); }}><Eye size={16} color={Colors.primary.blue} /></TouchableOpacity>
          </TouchableOpacity>
        ))
      )}
    </Card>
  );

  const demoTickets = useMemo(() => [
    {
      id: 'ticket-1',
      userId: 'user-1',
      userName: 'Kouadio Yao',
      userEmail: 'kouadio.yao@email.ci',
      subject: 'Problème de paiement Premium',
      description: 'Je n\'arrive pas à finaliser mon paiement pour l\'abonnement Premium. Le système me renvoie une erreur après validation.',
      message: 'Je n\'arrive pas à finaliser mon paiement pour l\'abonnement Premium. Le système me renvoie une erreur après validation.',
      category: 'payment' as const,
      status: 'open' as const,
      priority: 'high' as const,
      createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
      updatedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
      responses: [],
    },
    {
      id: 'ticket-2',
      userId: 'user-2',
      userName: 'Aya Traoré',
      userEmail: 'aya.traore@email.ci',
      subject: 'Match annulé sans notification',
      description: 'Mon match de basketball prévu hier a été annulé mais je n\'ai reçu aucune notification. Pouvez-vous vérifier ?',
      message: 'Mon match de basketball prévu hier a été annulé mais je n\'ai reçu aucune notification. Pouvez-vous vérifier ?',
      category: 'technical' as const,
      status: 'in_progress' as const,
      priority: 'medium' as const,
      createdAt: new Date(Date.now() - 5 * 60 * 60 * 1000),
      updatedAt: new Date(Date.now() - 3 * 60 * 60 * 1000),
      responses: [
        {
          id: 'resp-1',
          userId: 'admin-1',
          userName: 'Admin Support',
          isAdmin: true,
          message: 'Bonjour Aya, nous vérifions votre dossier. Le match a été annulé par l\'organisateur pour cause de pluie.',
          createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000),
        },
      ],
    },
    {
      id: 'ticket-3',
      userId: 'user-3',
      userName: 'Koffi Mensah',
      userEmail: 'koffi.mensah@email.ci',
      subject: 'Impossible de rejoindre une équipe',
      description: 'Quand je clique sur "Rejoindre" pour une équipe, rien ne se passe. J\'ai essayé plusieurs fois.',
      message: 'Quand je clique sur "Rejoindre" pour une équipe, rien ne se passe. J\'ai essayé plusieurs fois.',
      category: 'technical' as const,
      status: 'open' as const,
      priority: 'medium' as const,
      createdAt: new Date(Date.now() - 8 * 60 * 60 * 1000),
      updatedAt: new Date(Date.now() - 8 * 60 * 60 * 1000),
      responses: [],
    },
    {
      id: 'ticket-4',
      userId: 'user-4',
      userName: 'Marie Kouassi',
      userEmail: 'marie.kouassi@email.ci',
      subject: 'Demande de remboursement',
      description: 'J\'ai été facturée deux fois pour mon abonnement Premium. Je souhaite un remboursement pour le double paiement.',
      message: 'J\'ai été facturée deux fois pour mon abonnement Premium. Je souhaite un remboursement pour le double paiement.',
      category: 'payment' as const,
      status: 'resolved' as const,
      priority: 'high' as const,
      createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
      updatedAt: new Date(Date.now() - 20 * 60 * 60 * 1000),
      responses: [
        {
          id: 'resp-2',
          userId: 'admin-1',
          userName: 'Admin Support',
          isAdmin: true,
          message: 'Bonjour Marie, nous avons traité votre remboursement. Vous recevrez les fonds sous 3-5 jours ouvrables.',
          createdAt: new Date(Date.now() - 20 * 60 * 60 * 1000),
        },
      ],
    },
  ] as SupportTicket[], []);

  const demoVerifications = useMemo(() => [
    {
      id: 'verif-1',
      userId: 'user-5',
      userName: 'Adjoua N\'Guessan',
      userEmail: 'adjoua.nguessan@email.ci',
      userAvatar: undefined,
      reason: 'Vérification d\'identité pour participer aux tournois officiels',
      documentType: 'ID Card',
      documentUrl: 'https://example.com/doc1.jpg',
      status: 'pending' as const,
      createdAt: new Date(Date.now() - 1 * 60 * 60 * 1000),
    },
    {
      id: 'verif-2',
      userId: 'user-6',
      userName: 'Yao Kouadio',
      userEmail: 'yao.kouadio@email.ci',
      userAvatar: undefined,
      reason: 'Compte professionnel - Organisateur d\'événements sportifs',
      documentType: 'Business License',
      documentUrl: 'https://example.com/doc2.jpg',
      status: 'pending' as const,
      createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000),
    },
    {
      id: 'verif-3',
      userId: 'user-7',
      userName: 'Fatou Diallo',
      userEmail: 'fatou.diallo@email.ci',
      userAvatar: undefined,
      reason: 'Vérification pour badge vérifié',
      documentType: 'Passport',
      documentUrl: 'https://example.com/doc3.jpg',
      status: 'approved' as const,
      createdAt: new Date(Date.now() - 48 * 60 * 60 * 1000),
    },
  ] as VerificationRequest[], []);

  const renderTickets = () => {
    const hasRealTickets = tickets && tickets.length > 0;
    const displayTickets = hasRealTickets ? tickets : demoTickets;
    const isDemo = !hasRealTickets;

    return (
    <Card style={styles.listCard}>
      <View style={styles.cardTitleRow}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text style={styles.cardTitle}>Tickets support ({displayTickets.length})</Text>
          {isDemo && (
            <View style={[styles.demoBadge, { marginLeft: 8 }]}>
              <Text style={styles.demoText}>DÉMO</Text>
            </View>
          )}
        </View>
        <TouchableOpacity 
          style={styles.refreshBtn} 
          onPress={() => {
            queryClient.invalidateQueries({ queryKey: ['support', 'tickets'] });
            Alert.alert('Rafraîchissement', 'Tickets en cours de rafraîchissement...');
          }}
        >
          <RefreshCw size={16} color={Colors.primary.blue} />
        </TouchableOpacity>
      </View>
      {isDemo && (
        <View style={styles.infoBanner}>
          <AlertTriangle size={16} color={Colors.primary.orange} />
          <Text style={styles.infoText}>Aucun ticket réel trouvé. Créez un ticket depuis l'écran "Nous contacter" pour tester.</Text>
        </View>
      )}
      {displayTickets.length === 0 ? (
        <View style={styles.emptyState}><Ticket size={40} color={Colors.text.muted} /><Text style={styles.emptyText}>Aucun ticket</Text></View>
      ) : (
        displayTickets.map((ticket: SupportTicket) => (
          <TouchableOpacity key={ticket.id} style={styles.ticketItem} onPress={() => setSelectedTicketDetail(ticket)}>
            <View style={styles.ticketInfo}>
              <View style={styles.ticketHeader}>
                <Text style={styles.ticketSubject}>{ticket.subject}</Text>
                <View style={[styles.ticketStatusBadge, ticket.status === 'open' ? styles.statusOpen : ticket.status === 'in_progress' ? styles.statusConfirmed : styles.statusCompleted]}>
                  <Text style={styles.ticketStatusText}>{ticket.status === 'open' ? 'Ouvert' : ticket.status === 'in_progress' ? 'En cours' : ticket.status === 'resolved' ? 'Résolu' : 'Fermé'}</Text>
                </View>
              </View>
              <Text style={styles.ticketUser}>👤 {getUserName(ticket.userId)} (@{getUserUsername(ticket.userId)})</Text>
              <Text style={styles.ticketUserId}>🆔 {ticket.userId}</Text>
              <Text style={styles.ticketDesc} numberOfLines={2}>{ticket.description}</Text>
              <Text style={styles.ticketMeta}>📁 {ticket.category} • 📅 {formatDate(ticket.createdAt)}</Text>
            </View>
            {(ticket.status === 'open' || ticket.status === 'in_progress') && (
              <View style={styles.ticketActions}>
                <TouchableOpacity style={styles.actionBtnBlue} onPress={() => { setSelectedTicketForResponse(ticket); setTicketResponseText(''); }}>
                  <MessageSquare size={16} color={Colors.primary.blue} />
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionBtnGreen} onPress={() => handleTicketAction(ticket.id, 'resolve')}><CheckCircle size={16} color={Colors.status.success} /></TouchableOpacity>
                <TouchableOpacity style={styles.actionBtnRed} onPress={() => handleTicketAction(ticket.id, 'close')}><XCircle size={16} color={Colors.status.error} /></TouchableOpacity>
              </View>
            )}
          </TouchableOpacity>
        ))
      )}
    </Card>
    );
  };

  const renderVerifications = () => {
    const displayVerifications = verificationRequests && verificationRequests.length > 0 ? verificationRequests : demoVerifications;
    return (
    <Card style={styles.listCard}>
      <View style={styles.cardTitleRow}>
        <Text style={styles.cardTitle}>Demandes de vérification ({displayVerifications.length})</Text>
        {verificationRequests && verificationRequests.length === 0 && (
          <View style={styles.demoBadge}>
            <Text style={styles.demoText}>DÉMO</Text>
          </View>
        )}
      </View>
      {displayVerifications.length === 0 ? (
        <View style={styles.emptyState}><UserCheck size={40} color={Colors.text.muted} /><Text style={styles.emptyText}>Aucune demande</Text></View>
      ) : (
        displayVerifications.map((req: VerificationRequest) => (
          <TouchableOpacity key={req.id} style={styles.verificationItem} onPress={() => setSelectedVerificationDetail(req)}>
            <Avatar uri={req.userAvatar} name={req.userName} size="medium" />
            <View style={styles.verificationInfo}>
              <View style={styles.verificationHeader}>
                <Text style={styles.verificationName}>{req.userName} (@{getUserUsername(req.userId)})</Text>
                <View style={[styles.ticketStatusBadge, req.status === 'pending' ? styles.statusOpen : req.status === 'approved' ? styles.statusCompleted : styles.statusCancelled]}>
                  <Text style={styles.ticketStatusText}>{req.status === 'pending' ? 'En attente' : req.status === 'approved' ? 'Approuvé' : 'Refusé'}</Text>
                </View>
              </View>
              <Text style={styles.verificationUserId}>🆔 {req.userId}</Text>
              <Text style={styles.verificationReason} numberOfLines={2}>{req.reason}</Text>
              <Text style={styles.ticketMeta}>📅 {formatDate(req.createdAt)}</Text>
            </View>
            {req.status === 'pending' && (
              <View style={styles.verificationActions}>
                <TouchableOpacity style={styles.actionBtnGreen} onPress={(e) => { e.stopPropagation(); handleVerificationAction(req.id, 'approve', req.userId || ''); }}><CheckCircle size={16} color={Colors.status.success} /></TouchableOpacity>
                <TouchableOpacity style={styles.actionBtnRed} onPress={(e) => { e.stopPropagation(); handleVerificationAction(req.id, 'reject', req.userId || ''); }}><XCircle size={16} color={Colors.status.error} /></TouchableOpacity>
              </View>
            )}
          </TouchableOpacity>
        ))
      )}
    </Card>
    );
  };

  const getActivityIcon = (iconType: string) => {
    const iconProps = { size: 16, color: Colors.text.primary };
    switch (iconType) {
      case 'star': return <Star {...iconProps} />;
      case 'match': return <Swords {...iconProps} />;
      case 'verify': return <CheckCircle {...iconProps} />;
      case 'ticket': return <Ticket {...iconProps} />;
      case 'team': return <Shield {...iconProps} />;
      case 'ban': return <Ban {...iconProps} />;
      case 'tournament': return <Award {...iconProps} />;
      case 'cancel': return <XCircle {...iconProps} />;
      case 'payment': return <DollarSign {...iconProps} />;
      case 'complete': return <CheckCircle {...iconProps} />;
      case 'check': return <CheckCircle {...iconProps} />;
      default: return <Activity {...iconProps} />;
    }
  };

  const renderActivity = () => (
    <>
      <Card style={styles.activityCard}>
        <View style={styles.cardTitleRow}>
          <Text style={styles.cardTitle}>Activité en temps réel</Text>
          <View style={styles.liveBadge}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>LIVE</Text>
          </View>
        </View>
        <View style={styles.activityTimeline}>
          {activityLogs.map((log, index) => {
            const getTabForActivity = (icon: string) => {
              switch (icon) {
                case 'star': case 'payment': return 'users';
                case 'match': case 'complete': case 'cancel': return 'matches';
                case 'verify': return 'verifications';
                case 'ticket': return 'tickets';
                case 'team': return 'teams';
                case 'ban': return 'users';
                case 'tournament': return 'tournaments';
                default: return 'activity';
              }
            };
            return (
              <TouchableOpacity key={log.id} style={styles.activityItem} onPress={() => setActiveTab(getTabForActivity(log.icon) as AdminTab)} activeOpacity={0.7}>
                <View style={styles.activityLeft}>
                  <View style={[styles.activityIconContainer, { backgroundColor: getSeverityColor(log.severity) + '20' }]}>
                    {getActivityIcon(log.icon)}
                  </View>
                  {index < activityLogs.length - 1 && <View style={styles.activityLine} />}
                </View>
                <View style={styles.activityContent}>
                  <View style={styles.activityHeader}>
                    <Text style={styles.activityTitle}>{log.title}</Text>
                    <Text style={styles.activityTime}>{formatTime(log.timestamp)}</Text>
                  </View>
                  <Text style={styles.activityDesc}>{log.description}</Text>
                  <View style={[styles.activitySeverityBadge, { backgroundColor: getSeverityColor(log.severity) + '20' }]}>
                    <Text style={[styles.activitySeverityText, { color: getSeverityColor(log.severity) }]}>
                      {log.severity === 'success' ? 'Succès' : log.severity === 'error' ? 'Erreur' : log.severity === 'warning' ? 'Attention' : 'Info'}
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </Card>
      <Card style={styles.activityCard}>
        <Text style={styles.cardTitle}>Résumé du jour</Text>
        <View style={styles.summaryGrid}>
          <View style={styles.summaryItem}>
            <Users size={20} color={Colors.primary.blue} />
            <Text style={styles.summaryValue}>{summaryToday.inscriptions}</Text>
            <Text style={styles.summaryLabel}>Inscriptions</Text>
          </View>
          <View style={styles.summaryItem}>
            <Swords size={20} color={Colors.primary.orange} />
            <Text style={styles.summaryValue}>{summaryToday.matchs}</Text>
            <Text style={styles.summaryLabel}>Matchs créés</Text>
          </View>
          <View style={styles.summaryItem}>
            <Shield size={20} color={Colors.status.success} />
            <Text style={styles.summaryValue}>{summaryToday.equipes}</Text>
            <Text style={styles.summaryLabel}>Équipes créées</Text>
          </View>
          <View style={styles.summaryItem}>
            <Ticket size={20} color={Colors.text.secondary} />
            <Text style={styles.summaryValue}>{(pendingTickets ?? []).length}</Text>
            <Text style={styles.summaryLabel}>Tickets</Text>
          </View>
        </View>
      </Card>

      <Card style={styles.activityCard}>
        <Text style={styles.cardTitle}>Actions rapides</Text>
        <View style={styles.quickActionsGrid}>
          <TouchableOpacity style={styles.quickActionBtn} onPress={() => router.push('/admin/payments' as any)}>
            <DollarSign size={24} color={Colors.primary.orange} />
            <Text style={styles.quickActionText}>Paiements tournois</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickActionBtn} onPress={() => router.push('/admin/payout-requests' as any)}>
            <FileText size={24} color={Colors.status.warning} />
            <Text style={styles.quickActionText}>Demandes d'avance</Text>
            {pendingPayoutRequests.length > 0 && (
              <View style={styles.quickBadge}>
                <Text style={styles.quickBadgeText}>{pendingPayoutRequests.length}</Text>
              </View>
            )}
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickActionBtn} onPress={() => setActiveTab('users')}>
            <Users size={24} color={Colors.primary.blue} />
            <Text style={styles.quickActionText}>Gérer utilisateurs</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickActionBtn} onPress={() => setActiveTab('tickets')}>
            <Ticket size={24} color={Colors.primary.orange} />
            <Text style={styles.quickActionText}>Tickets support</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickActionBtn} onPress={() => setActiveTab('verifications')}>
            <UserCheck size={24} color={Colors.status.success} />
            <Text style={styles.quickActionText}>Vérifications</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickActionBtn} onPress={() => setActiveTab('analytics')}>
            <BarChart3 size={24} color="#A855F7" />
            <Text style={styles.quickActionText}>Analytiques</Text>
          </TouchableOpacity>
        </View>
      </Card>
    </>
  );

  const renderAnalytics = () => (
    <>
      <Card style={styles.analyticsCard}>
        <Text style={styles.cardTitle}>Métriques clés (temps réel)</Text>
        <View style={styles.metricsGrid}>
          <View style={styles.metricItem}>
            <View style={styles.metricIcon}><Users size={20} color={Colors.primary.blue} /></View>
            <Text style={styles.metricValue}>{stats.activeUsers}</Text>
            <Text style={styles.metricLabel}>Utilisateurs actifs</Text>
          </View>
          <View style={styles.metricItem}>
            <View style={styles.metricIcon}><CheckCircle size={20} color={Colors.status.success} /></View>
            <Text style={styles.metricValue}>{stats.verifiedUsers}</Text>
            <Text style={styles.metricLabel}>Vérifiés</Text>
          </View>
          <View style={styles.metricItem}>
            <View style={styles.metricIcon}><Swords size={20} color={Colors.primary.orange} /></View>
            <Text style={styles.metricValue}>{stats.openMatches}</Text>
            <Text style={styles.metricLabel}>Matchs ouverts</Text>
          </View>
        </View>
      </Card>

      <Card style={styles.analyticsCard}>
        <Text style={styles.cardTitle}>Croissance des utilisateurs (7 derniers jours)</Text>
        <View style={styles.chartPlaceholder}>
          <View style={styles.chartBars}>
            {[65, 78, 85, 92, 88, 95, 100].map((h, i) => (
              <View key={i} style={styles.chartBarContainer}>
                <View style={[styles.chartBar, { height: h }]} />
                <Text style={styles.chartBarLabel}>{['L', 'M', 'M', 'J', 'V', 'S', 'D'][i]}</Text>
              </View>
            ))}
          </View>
        </View>
        <View style={styles.analyticsStats}>
          <View style={styles.analyticsStat}><Text style={styles.analyticsLabel}>Cette semaine</Text><Text style={styles.analyticsValue}>+{Math.floor(stats.totalUsers * 0.08)}</Text></View>
          <View style={styles.analyticsStat}><Text style={styles.analyticsLabel}>Ce mois</Text><Text style={styles.analyticsValue}>+{Math.floor(stats.totalUsers * 0.25)}</Text></View>
          <View style={styles.analyticsStat}><Text style={styles.analyticsLabel}>Total</Text><Text style={styles.analyticsValue}>{stats.totalUsers}</Text></View>
        </View>
      </Card>

      <TouchableOpacity onPress={() => setActiveTab('users')} activeOpacity={0.9}>
        <Card style={styles.analyticsCard}>
          <Text style={styles.cardTitle}>Répartition géographique</Text>
          {cityStats.length > 0 ? cityStats.map((item, i) => (
            <View key={i} style={styles.sportStat}>
              <View style={styles.cityIconContainer}>
                <MapPin size={14} color={Colors.primary.blue} />
              </View>
              <Text style={styles.sportName}>{item.city}</Text>
              <View style={styles.sportBar}><View style={[styles.sportBarFill, { width: `${item.percent}%`, backgroundColor: i === 0 ? Colors.primary.blue : i === 1 ? Colors.primary.orange : Colors.status.success }]} /></View>
              <Text style={styles.sportPercent}>{item.count}</Text>
            </View>
          )) : (
            <View style={styles.emptyState}><MapPin size={40} color={Colors.text.muted} /><Text style={styles.emptyText}>Aucune donnée</Text></View>
          )}
        </Card>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => setActiveTab('matches')} activeOpacity={0.9}>
        <Card style={styles.analyticsCard}>
          <Text style={styles.cardTitle}>Sports les plus populaires</Text>
          {sportStats.length > 0 ? sportStats.map((item, i) => (
            <View key={i} style={styles.sportStat}>
              <View style={styles.sportRank}>
                <Text style={styles.sportRankText}>#{i + 1}</Text>
              </View>
              <Text style={styles.sportName}>{item.sport}</Text>
              <View style={styles.sportBar}><View style={[styles.sportBarFill, { width: `${item.percent}%`, backgroundColor: i === 0 ? Colors.primary.blue : i === 1 ? Colors.primary.orange : Colors.status.success }]} /></View>
              <Text style={styles.sportPercent}>{item.percent}%</Text>
            </View>
          )) : (
            <Text style={styles.emptyText}>Aucune donnée disponible</Text>
          )}
        </Card>
      </TouchableOpacity>
    </>
  );

  const runProdReport = async () => {
    setProdReportRunning(true);
    try {
      const result = await reportRunner.run();
      setProdReportResult(result);
    } catch (e) {
      Alert.alert('Rapport Prod', (e as Error).message);
    } finally {
      setProdReportRunning(false);
    }
  };

  const renderProdReport = () => {
    const r = prodReportResult;
    const severityColor = (s: string) => {
      if (s === 'critical') return Colors.status.error;
      if (s === 'warning') return '#F59E0B';
      if (s === 'passed' || s === 'info') return Colors.status.success;
      return Colors.text.muted;
    };
    return (
      <>
        <Card style={styles.settingsCard}>
          <Text style={styles.cardTitle}>Rapport Pré-Production</Text>
          <Text style={styles.cardDesc}>Analyse complète de l&apos;app : config, sécurité, schéma DB, intégrité des données, performances et règles métier.</Text>
          <Button
            title={prodReportRunning ? 'Analyse en cours…' : '▶ Générer le rapport'}
            onPress={runProdReport}
            variant="primary"
            style={{ marginTop: 12 }}
            disabled={prodReportRunning}
          />
        </Card>

        {r && (
          <>
            <Card style={styles.settingsCard}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <Text style={styles.cardTitle}>Résultat global</Text>
                <View style={{ backgroundColor: r.readyForProduction ? Colors.status.success : Colors.status.error, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20 }}>
                  <Text style={{ color: '#FFF', fontWeight: '700', fontSize: 12 }}>{r.readyForProduction ? '✅ PRÊT' : '🚫 NON PRÊT'}</Text>
                </View>
              </View>
              <Text style={{ color: Colors.text.muted, fontSize: 13, marginBottom: 4 }}>Score global : <Text style={{ color: r.overallScore >= 80 ? Colors.status.success : Colors.status.error, fontWeight: '700' }}>{r.overallScore}/100</Text></Text>
              <Text style={{ color: Colors.text.muted, fontSize: 12 }}>Durée : {r.durationMs}ms · {new Date(r.generatedAt).toLocaleString('fr-FR')}</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
                <View style={{ backgroundColor: '#FF4D4D22', borderRadius: 8, padding: 8, minWidth: 80, alignItems: 'center' }}>
                  <Text style={{ color: Colors.status.error, fontWeight: '700', fontSize: 18 }}>{r.blockers.length}</Text>
                  <Text style={{ color: Colors.status.error, fontSize: 11 }}>Bloqueurs</Text>
                </View>
                <View style={{ backgroundColor: '#F59E0B22', borderRadius: 8, padding: 8, minWidth: 80, alignItems: 'center' }}>
                  <Text style={{ color: '#F59E0B', fontWeight: '700', fontSize: 18 }}>{r.warnings.length}</Text>
                  <Text style={{ color: '#F59E0B', fontSize: 11 }}>Avertissements</Text>
                </View>
                <View style={{ backgroundColor: '#22C55E22', borderRadius: 8, padding: 8, minWidth: 80, alignItems: 'center' }}>
                  <Text style={{ color: Colors.status.success, fontWeight: '700', fontSize: 18 }}>{r.passed.length}</Text>
                  <Text style={{ color: Colors.status.success, fontSize: 11 }}>Passés</Text>
                </View>
              </View>
            </Card>

            {r.categories.map((cat) => (
              <Card key={cat.category} style={{ ...styles.settingsCard, paddingVertical: 10 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ color: Colors.text.primary, fontWeight: '600', fontSize: 13, textTransform: 'uppercase' }}>{cat.category.replace('_', ' ')}</Text>
                  <Text style={{ color: cat.score >= 80 ? Colors.status.success : cat.score >= 50 ? '#F59E0B' : Colors.status.error, fontWeight: '700' }}>{cat.score}%</Text>
                </View>
                <View style={{ height: 4, backgroundColor: '#ffffff15', borderRadius: 2, marginTop: 6 }}>
                  <View style={{ height: 4, width: `${cat.score}%` as any, backgroundColor: cat.score >= 80 ? Colors.status.success : cat.score >= 50 ? '#F59E0B' : Colors.status.error, borderRadius: 2 }} />
                </View>
                <Text style={{ color: Colors.text.muted, fontSize: 11, marginTop: 4 }}>✓{cat.passed} ⚠{cat.warnings} ✗{cat.critical} / {cat.total}</Text>
              </Card>
            ))}

            {r.blockers.length > 0 && (
              <Card style={{ ...styles.settingsCard, borderColor: Colors.status.error, borderWidth: 1 }}>
                <Text style={{ color: Colors.status.error, fontWeight: '700', fontSize: 14, marginBottom: 10 }}>🚫 BLOQUEURS ({r.blockers.length})</Text>
                {r.blockers.map((c) => (
                  <View key={c.id} style={{ marginBottom: 10 }}>
                    <Text style={{ color: Colors.status.error, fontWeight: '600', fontSize: 13 }}>{c.name}</Text>
                    <Text style={{ color: Colors.text.muted, fontSize: 12, marginTop: 2 }}>{c.details}</Text>
                    {c.suggestion && <Text style={{ color: '#F59E0B', fontSize: 11, marginTop: 2 }}>💡 {c.suggestion}</Text>}
                  </View>
                ))}
              </Card>
            )}

            {r.warnings.length > 0 && (
              <Card style={{ ...styles.settingsCard, borderColor: '#F59E0B', borderWidth: 1 }}>
                <Text style={{ color: '#F59E0B', fontWeight: '700', fontSize: 14, marginBottom: 10 }}>⚠️ AVERTISSEMENTS ({r.warnings.length})</Text>
                {r.warnings.map((c) => (
                  <View key={c.id} style={{ marginBottom: 8 }}>
                    <Text style={{ color: '#F59E0B', fontWeight: '600', fontSize: 13 }}>{c.name}</Text>
                    <Text style={{ color: Colors.text.muted, fontSize: 12, marginTop: 2 }}>{c.details}</Text>
                    {c.suggestion && <Text style={{ color: Colors.text.muted, fontSize: 11, marginTop: 2 }}>💡 {c.suggestion}</Text>}
                  </View>
                ))}
              </Card>
            )}

            <Card style={styles.settingsCard}>
              <Text style={{ color: Colors.status.success, fontWeight: '700', fontSize: 14, marginBottom: 10 }}>✅ CHECKS PASSÉS ({r.passed.length})</Text>
              {r.passed.map((c) => (
                <View key={c.id} style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 6 }}>
                  <Text style={{ color: Colors.status.success, fontSize: 12, marginRight: 6, marginTop: 1 }}>✓</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: Colors.text.secondary, fontSize: 12 }}>{c.name}</Text>
                    <Text style={{ color: Colors.text.muted, fontSize: 11 }}>{c.details}</Text>
                  </View>
                  <View style={{ backgroundColor: severityColor(c.severity) + '33', borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1 }}>
                    <Text style={{ color: severityColor(c.severity), fontSize: 10 }}>{c.category}</Text>
                  </View>
                </View>
              ))}
            </Card>
          </>
        )}
      </>
    );
  };

  const renderSettings = () => (
    <>
      <Card style={styles.settingsCard}>
        <Text style={styles.cardTitle}>Notifications globales (annonces)</Text>
        <Text style={styles.cardDesc}>Chaque utilisateur verra l’annonce dans la cloche en haut à droite de l’écran d’accueil.</Text>
        <TextInput 
          style={styles.notifInput} 
          placeholder="Entrez votre message..." 
          placeholderTextColor={Colors.text.muted}
          value={notificationMessage}
          onChangeText={setNotificationMessage}
          multiline
          numberOfLines={3}
        />
        <TouchableOpacity style={styles.sendNotifBtn} onPress={handleSendGlobalNotification} disabled={sendingNotif}>
          <Send size={18} color="#FFF" /><Text style={styles.sendNotifText}>{sendingNotif ? 'Envoi…' : 'Envoyer à tous'}</Text>
        </TouchableOpacity>
      </Card>

      <Card style={styles.settingsCard}>
        <Text style={styles.cardTitle}>Configuration système</Text>
        <View style={styles.settingItem}>
          <View style={styles.settingIcon}><Globe size={20} color={Colors.text.secondary} /></View>
          <View style={styles.settingInfo}><Text style={styles.settingTitle}>Mode maintenance</Text><Text style={styles.settingDesc}>Désactiver temporairement l&apos;app</Text></View>
          <Switch value={maintenanceMode} onValueChange={setMaintenanceMode} trackColor={{ false: Colors.background.cardLight, true: Colors.primary.blue }} thumbColor="#FFF" />
        </View>
        {[
          { icon: <DollarSign size={20} color={Colors.text.secondary} />, title: 'Commission', desc: '5% sur transactions' },
          { icon: <Lock size={20} color={Colors.text.secondary} />, title: 'Sécurité', desc: '2FA activé' },
          { icon: <FileText size={20} color={Colors.text.secondary} />, title: 'CGU & Politique', desc: 'Dernière mise à jour: 15 Jan' },
        ].map((item, i) => (
          <TouchableOpacity key={i} style={styles.settingItem} onPress={() => Alert.alert(item.title, 'Configuration disponible bientôt')}>
            <View style={styles.settingIcon}>{item.icon}</View>
            <View style={styles.settingInfo}><Text style={styles.settingTitle}>{item.title}</Text><Text style={styles.settingDesc}>{item.desc}</Text></View>
            <ChevronRight size={20} color={Colors.text.muted} />
          </TouchableOpacity>
        ))}
      </Card>

      <Card style={styles.settingsCard}>
        <Text style={styles.cardTitle}>Base de données</Text>
        <View style={styles.dbStats}>
          <View style={styles.dbStat}><Database size={20} color={Colors.primary.blue} /><Text style={styles.dbLabel}>Utilisateurs</Text><Text style={styles.dbValue}>{stats.totalUsers}</Text></View>
          <View style={styles.dbStat}><Shield size={20} color={Colors.primary.orange} /><Text style={styles.dbLabel}>Équipes</Text><Text style={styles.dbValue}>{stats.totalTeams}</Text></View>
          <View style={styles.dbStat}><Swords size={20} color={Colors.status.success} /><Text style={styles.dbLabel}>Matchs</Text><Text style={styles.dbValue}>{stats.totalMatches}</Text></View>
          <View style={styles.dbStat}><Award size={20} color="#A855F7" /><Text style={styles.dbLabel}>Tournois</Text><Text style={styles.dbValue}>{stats.totalTournaments}</Text></View>
        </View>
        <View style={styles.dbActions}>
          <TouchableOpacity style={styles.dbActionBtn} onPress={async () => {
            try {
              const report = JSON.stringify({ users: stats.totalUsers, teams: stats.totalTeams, matchs: stats.totalMatches, tournois: stats.totalTournaments, exportéLe: new Date().toISOString() }, null, 2);
              await Share.share(Platform.OS === 'web' ? { title: 'Export Admin VS Sport', message: report } : { message: report, title: 'Export Admin VS Sport' });
            } catch (e) {
              Alert.alert('Export', (e as Error)?.message ? `Erreur : ${(e as Error).message}` : `Utilisateurs: ${stats.totalUsers}, Équipes: ${stats.totalTeams}, Matchs: ${stats.totalMatches}`);
            }
          }}>
            <Download size={16} color={Colors.primary.blue} /><Text style={styles.dbActionText}>Exporter</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.dbActionBtn, styles.dbBackupBtn]} onPress={async () => {
            try {
              await onRefresh();
              Alert.alert('Sauvegarde', 'Synchronisation effectuée.');
            } catch (e) {
              Alert.alert('Erreur', (e as Error)?.message ?? 'Synchronisation échouée.');
            }
          }}>
            <RefreshCw size={16} color="#FFF" /><Text style={styles.dbBackupText}>Sauvegarder</Text>
          </TouchableOpacity>
        </View>
      </Card>

      <Card style={[styles.settingsCard, styles.dangerCard]}>
        <Text style={[styles.cardTitle, { color: Colors.status.error }]}>Zone de danger</Text>
        <TouchableOpacity style={styles.dangerItem} onPress={() => Alert.alert('Purger le cache', 'Supprimer toutes les données en cache local (tournois, équipes, matchs, utilisateurs, notifications) ? Les données seront rechargées au prochain rafraîchissement.', [{ text: 'Annuler', style: 'cancel' }, { text: 'Purger', style: 'destructive', onPress: async () => {
          try {
            const keys = await AsyncStorage.getAllKeys();
            const toRemove = [
              ...CACHE_KEYS_TO_PURGE.filter(k => keys.includes(k)),
              ...keys.filter(k => k.startsWith('vs_notifications')),
            ];
            if (toRemove.length > 0) await AsyncStorage.multiRemove(toRemove);
            await offlineManager.clearCache();
            await onRefresh();
            Alert.alert('Succès', 'Cache purgé. Données rechargées.');
          } catch (e) {
            Alert.alert('Erreur', (e as Error)?.message ?? 'Impossible de purger le cache.');
          }
        }}])}>
          <Trash2 size={20} color={Colors.status.error} />
          <Text style={styles.dangerText}>Purger les données de cache</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.dangerItem} onPress={() => Alert.alert('Réinitialiser les stats', 'Vider les caches technique (offline, last sync) et forcer un rechargement complet des données ?', [{ text: 'Annuler', style: 'cancel' }, { text: 'Réinitialiser', style: 'destructive', onPress: async () => {
          try {
            await AsyncStorage.multiRemove(['vs_last_sync']);
            await offlineManager.clearCache();
            await onRefresh();
            Alert.alert('Succès', 'Statistiques réinitialisées et données rechargées.');
          } catch (e) {
            Alert.alert('Erreur', (e as Error)?.message ?? 'Impossible de réinitialiser.');
          }
        }}])}>
          <Trash2 size={20} color={Colors.status.error} />
          <Text style={styles.dangerText}>Réinitialiser les statistiques</Text>
        </TouchableOpacity>
      </Card>
    </>
  );

  return (
    <>
      <View style={styles.container}>
        <LinearGradient colors={[Colors.background.dark, '#0D1420']} style={StyleSheet.absoluteFill} />
        <SafeAreaView style={styles.safeArea} edges={['top']}>
          <View style={styles.header}>
            <TouchableOpacity style={styles.backButton} onPress={() => safeBack(router, '/(tabs)/(home)')}>
              <ArrowLeft size={20} color={Colors.text.primary} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Administration</Text>
            <View style={styles.headerRight}>
              <TouchableOpacity style={styles.headerIconBtn} onPress={onRefresh}>
                <RefreshCw size={18} color={Colors.text.primary} />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.searchContainer}>
            <Search size={18} color={Colors.text.muted} />
            <TextInput
              style={styles.searchInput}
              placeholder="Rechercher utilisateur, équipe, match..."
              placeholderTextColor={Colors.text.muted}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>

          <ScrollView horizontal style={styles.tabsScroll} contentContainerStyle={styles.tabs} showsHorizontalScrollIndicator={false}>
            {tabs.map((tab) => (
              <TouchableOpacity key={tab.key} style={[styles.tab, activeTab === tab.key && styles.tabActive]} onPress={() => setActiveTab(tab.key)}>
                {tab.icon}
                <Text style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}>{tab.label}</Text>
                {!!tab.badge && tab.badge > 0 && (
                  <View style={styles.tabBadge}>
                    <Text style={styles.tabBadgeText}>{tab.badge > 99 ? '99+' : tab.badge}</Text>
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>

          <ScrollView
            testID="admin-scroll"
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary.blue} />}
          >
            {activeTab === 'overview' && renderOverview()}
            {activeTab === 'users' && renderUsers()}
            {activeTab === 'banned' && renderBannedUsers()}
            {activeTab === 'teams' && renderTeams()}
            {activeTab === 'matches' && renderMatches()}
            {activeTab === 'tournaments' && renderTournaments()}
            {activeTab === 'tickets' && renderTickets()}
            {activeTab === 'verifications' && renderVerifications()}
            {activeTab === 'payments' && renderPaymentsTab()}
            {activeTab === 'payouts' && renderPayoutsTab()}
            {activeTab === 'activity' && renderActivity()}
            {activeTab === 'qa' && renderQa()}
            {activeTab === 'prod_report' && renderProdReport()}
            {activeTab === 'analytics' && renderAnalytics()}
            {activeTab === 'settings' && renderSettings()}
            <View style={styles.bottomSpacer} />
          </ScrollView>
        </SafeAreaView>

        <Modal visible={selectedUserForBan !== null} animationType="slide" transparent>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.modalOverlay}
          >
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Bannir un utilisateur</Text>
                <TouchableOpacity onPress={() => { if (!isApplyingBan) setSelectedUserForBan(null); }}>
                  <X size={24} color={Colors.text.primary} />
                </TouchableOpacity>
              </View>

              {selectedUserForBan && (
                <>
                  <Text style={styles.modalLabel}>Utilisateur: {selectedUserForBan.name}</Text>
                  <Text style={styles.modalLabel}>Durée du bannissement</Text>
                  <View style={styles.banDurationRow}>
                    {([
                      { key: '24h', label: '24h' },
                      { key: '7d', label: '7 jours' },
                      { key: '30d', label: '30 jours' },
                      { key: 'permanent', label: 'Permanent' },
                    ] as const).map((option) => (
                      <TouchableOpacity
                        key={option.key}
                        style={[styles.banDurationChip, banDuration === option.key && styles.banDurationChipActive]}
                        onPress={() => setBanDuration(option.key)}
                        disabled={isApplyingBan}
                      >
                        <Text style={[styles.banDurationChipText, banDuration === option.key && styles.banDurationChipTextActive]}>
                          {option.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <Text style={styles.modalLabel}>Motif (optionnel)</Text>
                  <TextInput
                    style={styles.modalTextInput}
                    value={banReason}
                    onChangeText={setBanReason}
                    placeholder="Ex: propos inappropriés, spam, harcèlement..."
                    placeholderTextColor={Colors.text.muted}
                    editable={!isApplyingBan}
                    multiline
                    numberOfLines={4}
                  />

                  <View style={styles.modalActions}>
                    <Button title="Annuler" onPress={() => setSelectedUserForBan(null)} variant="outline" style={styles.modalButton} disabled={isApplyingBan} />
                    <Button title="Confirmer le ban" onPress={handleConfirmBan} variant="orange" style={styles.modalButton} loading={isApplyingBan} />
                  </View>
                </>
              )}
            </View>
          </KeyboardAvoidingView>
        </Modal>

        <Modal visible={selectedTicketForResponse !== null} animationType="slide" transparent>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Répondre au ticket</Text>
                <TouchableOpacity onPress={() => { setSelectedTicketForResponse(null); setTicketResponseText(''); }}>
                  <X size={24} color={Colors.text.primary} />
                </TouchableOpacity>
              </View>
              {selectedTicketForResponse && (
                <>
                  <Text style={styles.modalLabel}>Sujet: {selectedTicketForResponse?.subject || ''}</Text>
                  <Text style={styles.modalLabel}>Message:</Text>
                  <Text style={styles.modalText}>{selectedTicketForResponse?.description || selectedTicketForResponse?.message || ''}</Text>
                  <Text style={styles.modalLabel}>Votre réponse:</Text>
                  <TextInput
                    style={styles.modalTextInput}
                    value={ticketResponseText}
                    onChangeText={setTicketResponseText}
                    placeholder="Tapez votre réponse..."
                    multiline
                    numberOfLines={6}
                    placeholderTextColor={Colors.text.muted}
                  />
                  <View style={styles.modalActions}>
                    <Button title="Annuler" onPress={() => { setSelectedTicketForResponse(null); setTicketResponseText(''); }} variant="outline" style={styles.modalButton} />
                    <Button title="Envoyer" onPress={() => selectedTicketForResponse && handleRespondToTicket()} variant="primary" style={styles.modalButton} disabled={!selectedTicketForResponse || !ticketResponseText.trim()} />
                  </View>
                </>
              )}
            </View>
          </View>
        </Modal>

        <Modal visible={selectedTicketDetail !== null} animationType="slide" transparent>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>📋 Détails du Ticket</Text>
                <TouchableOpacity onPress={() => setSelectedTicketDetail(null)}>
                  <X size={24} color={Colors.text.primary} />
                </TouchableOpacity>
              </View>
              {selectedTicketDetail && (
                <ScrollView showsVerticalScrollIndicator={false}>
                  <View style={styles.detailSection}>
                    <Text style={styles.detailLabel}>Sujet</Text>
                    <Text style={styles.detailValue}>{selectedTicketDetail.subject}</Text>
                  </View>
                  
                  <View style={styles.detailSection}>
                    <Text style={styles.detailLabel}>Utilisateur</Text>
                    <Text style={styles.detailValue}>👤 {getUserName(selectedTicketDetail.userId)} (@{getUserUsername(selectedTicketDetail.userId)})</Text>
                    <Text style={styles.detailSubValue}>🆔 ID: {selectedTicketDetail.userId}</Text>
                  </View>
                  
                  <View style={styles.detailSection}>
                    <Text style={styles.detailLabel}>Statut</Text>
                    <View style={[styles.statusBadge, selectedTicketDetail.status === 'open' ? styles.statusOpen : selectedTicketDetail.status === 'in_progress' ? styles.statusConfirmed : styles.statusCompleted]}>
                      <Text style={styles.statusBadgeText}>
                        {selectedTicketDetail.status === 'open' ? '🔓 Ouvert' : 
                         selectedTicketDetail.status === 'in_progress' ? '🔄 En cours' : 
                         selectedTicketDetail.status === 'resolved' ? '✅ Résolu' : '📁 Fermé'}
                      </Text>
                    </View>
                  </View>
                  
                  <View style={styles.detailSection}>
                    <Text style={styles.detailLabel}>Catégorie</Text>
                    <Text style={styles.detailValue}>📁 {selectedTicketDetail.category}</Text>
                  </View>
                  
                  <View style={styles.detailSection}>
                    <Text style={styles.detailLabel}>Date de création</Text>
                    <Text style={styles.detailValue}>📅 {formatDate(selectedTicketDetail.createdAt)}</Text>
                  </View>
                  
                  <View style={styles.detailSection}>
                    <Text style={styles.detailLabel}>Description</Text>
                    <Text style={styles.detailDescription}>{selectedTicketDetail.description}</Text>
                  </View>
                  
                  <View style={styles.detailActions}>
                    {(selectedTicketDetail.status === 'open' || selectedTicketDetail.status === 'in_progress') && (
                      <Button 
                        title="✉️ Répondre" 
                        onPress={() => {
                          setSelectedTicketForResponse(selectedTicketDetail);
                          setSelectedTicketDetail(null);
                        }} 
                        variant="primary" 
                        style={styles.detailActionBtn}
                      />
                    )}
                    {selectedTicketDetail.status === 'open' && (
                      <Button 
                        title="🔄 Marquer en cours" 
                        onPress={() => handleTicketAction(selectedTicketDetail.id, 'in_progress')} 
                        variant="outline" 
                        style={styles.detailActionBtn}
                      />
                    )}
                    {(selectedTicketDetail.status === 'open' || selectedTicketDetail.status === 'in_progress') && (
                      <Button 
                        title="✅ Résoudre" 
                        onPress={() => handleTicketAction(selectedTicketDetail.id, 'resolve')} 
                        variant="outline" 
                        style={styles.detailActionBtn}
                      />
                    )}
                    <Button 
                      title="❌ Fermer" 
                      onPress={() => handleTicketAction(selectedTicketDetail.id, 'close')} 
                      variant="outline" 
                      style={[styles.detailActionBtn, { borderColor: Colors.status.error }]}
                      textStyle={{ color: Colors.status.error }}
                    />
                  </View>
                </ScrollView>
              )}
            </View>
          </View>
        </Modal>

        <Modal visible={selectedVerificationDetail !== null} animationType="slide" transparent>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>📋 Détails Vérification</Text>
                <TouchableOpacity onPress={() => setSelectedVerificationDetail(null)}>
                  <X size={24} color={Colors.text.primary} />
                </TouchableOpacity>
              </View>
              {selectedVerificationDetail && (
                <ScrollView showsVerticalScrollIndicator={false}>
                  <View style={styles.detailSection}>
                    <Text style={styles.detailLabel}>Utilisateur</Text>
                    <Text style={styles.detailValue}>👤 {selectedVerificationDetail.userName} (@{getUserUsername(selectedVerificationDetail.userId)})</Text>
                    <Text style={styles.detailSubValue}>🆔 ID: {selectedVerificationDetail.userId}</Text>
                  </View>
                  
                  <View style={styles.detailSection}>
                    <Text style={styles.detailLabel}>Statut</Text>
                    <View style={[styles.statusBadge, selectedVerificationDetail.status === 'pending' ? styles.statusOpen : selectedVerificationDetail.status === 'approved' ? styles.statusCompleted : styles.statusCancelled]}>
                      <Text style={styles.statusBadgeText}>
                        {selectedVerificationDetail.status === 'pending' ? '⏳ En attente' : 
                         selectedVerificationDetail.status === 'approved' ? '✅ Approuvé' : '❌ Refusé'}
                      </Text>
                    </View>
                  </View>
                  
                  {selectedVerificationDetail.userEmail && (
                    <View style={styles.detailSection}>
                      <Text style={styles.detailLabel}>Email</Text>
                      <Text style={styles.detailValue}>📧 {selectedVerificationDetail.userEmail}</Text>
                    </View>
                  )}
                  
                  <View style={styles.detailSection}>
                    <Text style={styles.detailLabel}>Date de demande</Text>
                    <Text style={styles.detailValue}>📅 {formatDate(selectedVerificationDetail.createdAt)}</Text>
                  </View>
                  
                  {selectedVerificationDetail.reviewedAt && (
                    <View style={styles.detailSection}>
                      <Text style={styles.detailLabel}>Date de révision</Text>
                      <Text style={styles.detailValue}>📅 {formatDate(selectedVerificationDetail.reviewedAt)}</Text>
                    </View>
                  )}
                  
                  <View style={styles.detailSection}>
                    <Text style={styles.detailLabel}>Raison / Justification</Text>
                    <Text style={styles.detailDescription}>{selectedVerificationDetail.reason || 'Aucune raison fournie'}</Text>
                  </View>

                  {selectedVerificationDetail.documentUrl ? (
                    <View style={styles.detailSection}>
                      <Text style={styles.detailLabel}>Document soumis</Text>
                      <TouchableOpacity
                        onPress={() => Linking.openURL(selectedVerificationDetail.documentUrl!)}
                        style={{ paddingVertical: 8, paddingHorizontal: 12, backgroundColor: Colors.primary.blue + '20', borderRadius: 8, marginTop: 4 }}
                      >
                        <Text style={{ color: Colors.primary.blue, fontSize: 13, fontWeight: '600' as const }}>📎 Ouvrir le document</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <View style={styles.detailSection}>
                      <Text style={styles.detailLabel}>Document soumis</Text>
                      <Text style={{ color: Colors.text.muted, fontSize: 13 }}>Aucun document joint</Text>
                    </View>
                  )}
                  
                  {selectedVerificationDetail.rejectionReason && (
                    <View style={styles.detailSection}>
                      <Text style={styles.detailLabel}>Motif du refus</Text>
                      <Text style={[styles.detailDescription, { backgroundColor: 'rgba(239,68,68,0.1)' }]}>{selectedVerificationDetail.rejectionReason}</Text>
                    </View>
                  )}
                  
                  <View style={styles.detailActions}>
                    {selectedVerificationDetail.status === 'approved' && (
                      <Button
                        title="🔕 Retirer la vérification"
                        onPress={() => {
                          const uid = selectedVerificationDetail.userId || '';
                          const uname = selectedVerificationDetail.userName || 'cet utilisateur';
                          setSelectedVerificationDetail(null);
                          handleUnverifyUser(uid, uname);
                        }}
                        variant="outline"
                        style={[styles.detailActionBtn, { borderColor: Colors.status.error }]}
                        textStyle={{ color: Colors.status.error }}
                      />
                    )}
                    {selectedVerificationDetail.status === 'pending' && (
                      <>
                        <Button 
                          title="✅ Approuver" 
                          onPress={() => {
                            handleVerificationAction(selectedVerificationDetail.id, 'approve', selectedVerificationDetail.userId || '');
                            setSelectedVerificationDetail(null);
                          }} 
                          variant="primary" 
                          style={styles.detailActionBtn}
                        />
                        <Button 
                          title="❌ Refuser" 
                          onPress={() => {
                            setRejectTarget({ id: selectedVerificationDetail.id, userId: selectedVerificationDetail.userId || '' });
                            setRejectReason('');
                            setSelectedVerificationDetail(null);
                          }} 
                          variant="outline" 
                          style={[styles.detailActionBtn, { borderColor: Colors.status.error }]}
                          textStyle={{ color: Colors.status.error }}
                        />
                      </>
                    )}
                    <Button 
                      title="Fermer" 
                      onPress={() => setSelectedVerificationDetail(null)} 
                      variant="outline" 
                      style={styles.detailActionBtn}
                    />
                  </View>
                </ScrollView>
              )}
            </View>
          </View>
        </Modal>

        {/* Modale refus vérification avec motif obligatoire */}
        <Modal visible={rejectTarget !== null} animationType="slide" transparent>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Refuser la vérification</Text>
                <TouchableOpacity onPress={() => setRejectTarget(null)}>
                  <X size={24} color={Colors.text.primary} />
                </TouchableOpacity>
              </View>
              <Text style={styles.modalLabel}>Motif du refus (obligatoire)</Text>
              <TextInput
                style={styles.modalTextInput}
                value={rejectReason}
                onChangeText={setRejectReason}
                placeholder="Ex: document illisible, identité non vérifiable..."
                placeholderTextColor={Colors.text.muted}
                multiline
                numberOfLines={4}
                autoFocus
              />
              <View style={styles.modalActions}>
                <Button title="Annuler" onPress={() => setRejectTarget(null)} variant="outline" style={styles.modalButton} />
                <Button
                  title="Confirmer le refus"
                  onPress={() => {
                    if (!rejectReason.trim()) {
                      Alert.alert('Motif requis', 'Veuillez indiquer un motif de refus.');
                      return;
                    }
                    if (rejectTarget) {
                      handleVerificationAction(rejectTarget.id, 'reject', rejectTarget.userId, rejectReason.trim());
                      setRejectTarget(null);
                      setRejectReason('');
                    }
                  }}
                  variant="orange"
                  style={styles.modalButton}
                  disabled={!rejectReason.trim()}
                />
              </View>
            </View>
          </KeyboardAvoidingView>
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
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerIconBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.background.card, alignItems: 'center', justifyContent: 'center' },
  adminBadge: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.primary.orange, alignItems: 'center', justifyContent: 'center' },
  searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.background.card, marginHorizontal: 20, borderRadius: 12, paddingHorizontal: 16, height: 48, gap: 12 },
  searchInput: { flex: 1, color: Colors.text.primary, fontSize: 15 },
  tabsScroll: { maxHeight: 50, marginTop: 16 },
  tabs: { paddingHorizontal: 20, gap: 8 },
  tab: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 20, backgroundColor: Colors.background.card },
  tabActive: { backgroundColor: Colors.primary.blue },
  tabText: { color: Colors.text.secondary, fontSize: 13, fontWeight: '500' as const },
  tabTextActive: { color: '#FFFFFF' },
  tabBadge: { backgroundColor: Colors.status.error, minWidth: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center', marginLeft: 4 },
  tabBadgeText: { color: '#FFFFFF', fontSize: 10, fontWeight: '700' as const },
  scrollView: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingTop: 20 },
  statsGrid: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  liveStatsRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 16 },
  liveStatsText: { color: Colors.text.muted, fontSize: 12 },
  revenueCard: { marginTop: 8, marginBottom: 16 },
  revenueHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 },
  revenueTitle: { color: Colors.text.secondary, fontSize: 14, marginBottom: 4 },
  growthBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(16, 185, 129, 0.1)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
  growthText: { color: Colors.status.success, fontSize: 12, fontWeight: '600' as const },
  revenueAmount: { color: Colors.primary.orange, fontSize: 28, fontWeight: '700' as const },
  revenueSub: { color: Colors.text.muted, fontSize: 12, marginTop: 4 },
  revenueBreakdown: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 16, borderTopWidth: 1, borderTopColor: Colors.border.light },
  revenueItem: {},
  revenueItemLabel: { color: Colors.text.muted, fontSize: 12 },
  revenueItemValue: { color: Colors.text.primary, fontSize: 16, fontWeight: '600' as const, marginTop: 2 },
  systemCard: { marginBottom: 16 },
  systemStats: { gap: 12 },
  systemStat: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  systemIndicator: { width: 8, height: 8, borderRadius: 4 },
  systemStatInfo: { flex: 1, flexDirection: 'row', justifyContent: 'space-between' },
  systemStatLabel: { color: Colors.text.secondary, fontSize: 14 },
  systemStatValue: { color: Colors.text.primary, fontSize: 14, fontWeight: '600' as const },
  actionsCard: { marginBottom: 16 },
  cardTitle: { color: Colors.text.primary, fontSize: 16, fontWeight: '600' as const, marginBottom: 16 },
  cardDesc: { color: Colors.text.muted, fontSize: 12, marginBottom: 12 },
  urgentRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderTopWidth: 1, borderTopColor: Colors.border.light, gap: 12 },
  urgentIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  urgentInfo: { flex: 1 },
  urgentTitle: { color: Colors.text.primary, fontSize: 14, fontWeight: '500' as const },
  urgentDesc: { color: Colors.text.muted, fontSize: 12, marginTop: 2 },
  noUrgent: { alignItems: 'center', paddingVertical: 24 },
  noUrgentText: { color: Colors.text.muted, fontSize: 14, marginTop: 8 },
  actionRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderTopWidth: 1, borderTopColor: Colors.border.light, gap: 12 },
  actionText: { flex: 1, color: Colors.text.primary, fontSize: 15 },
  actionBadge: { backgroundColor: Colors.status.error, minWidth: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  actionBadgeText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' as const },
  filterRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  filterChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 16, backgroundColor: Colors.background.card },
  filterChipActive: { backgroundColor: Colors.primary.blue },
  filterChipText: { color: Colors.text.secondary, fontSize: 13 },
  filterChipTextActive: { color: '#FFFFFF' },
  listCard: { marginBottom: 16 },
  listHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 8 },
  adminCreateBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Colors.primary.orange, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 },
  adminCreateBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' as const },
  userItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderTopWidth: 1, borderTopColor: Colors.border.light, gap: 12 },
  userInfo: { flex: 1 },
  userNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  userName: { color: Colors.text.primary, fontSize: 15, fontWeight: '500' as const },
  userEmail: { color: Colors.text.secondary, fontSize: 13, marginTop: 2 },
  userMeta: { color: Colors.text.muted, fontSize: 12, marginTop: 2 },
  userActions: { flexDirection: 'row', gap: 8 },
  actionBtnRed: { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(239,68,68,0.1)', alignItems: 'center', justifyContent: 'center' },
  actionBtnGreen: { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(16,185,129,0.1)', alignItems: 'center', justifyContent: 'center' },
  actionBtnBlue: { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(21,101,192,0.1)', alignItems: 'center', justifyContent: 'center' },
  teamItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderTopWidth: 1, borderTopColor: Colors.border.light, gap: 12 },
  teamItemTouch: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  teamInfo: { flex: 1 },
  teamName: { color: Colors.text.primary, fontSize: 15, fontWeight: '500' as const },
  teamMeta: { color: Colors.text.secondary, fontSize: 13, marginTop: 2 },
  teamStatText: { color: Colors.text.muted, fontSize: 12, marginTop: 2 },
  matchItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderTopWidth: 1, borderTopColor: Colors.border.light, gap: 12 },
  matchItemTouch: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  matchStatus: { width: 4, height: 48, borderRadius: 2 },
  statusOpen: { backgroundColor: Colors.status.success },
  statusConfirmed: { backgroundColor: Colors.primary.blue },
  statusCompleted: { backgroundColor: Colors.text.muted },
  statusCancelled: { backgroundColor: Colors.status.error },
  matchInfo: { flex: 1 },
  matchTitle: { color: Colors.text.primary, fontSize: 15, fontWeight: '500' as const },
  matchDetails: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  matchDetailText: { color: Colors.text.muted, fontSize: 12 },
  ticketItem: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 12, borderTopWidth: 1, borderTopColor: Colors.border.light, gap: 12 },
  ticketInfo: { flex: 1 },
  ticketHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  ticketSubject: { color: Colors.text.primary, fontSize: 15, fontWeight: '500' as const, flex: 1 },
  ticketStatusBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  ticketStatusText: { color: '#FFFFFF', fontSize: 10, fontWeight: '600' as const },
  ticketUser: { color: Colors.text.secondary, fontSize: 13, marginBottom: 2 },
  ticketUserId: { color: Colors.text.muted, fontSize: 11, marginBottom: 4 },
  ticketDesc: { color: Colors.text.muted, fontSize: 13, marginBottom: 4 },
  ticketMeta: { color: Colors.text.muted, fontSize: 11 },
  ticketActions: { flexDirection: 'column', gap: 8 },
  verificationItem: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 12, borderTopWidth: 1, borderTopColor: Colors.border.light, gap: 12 },
  verificationInfo: { flex: 1 },
  verificationHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  verificationName: { color: Colors.text.primary, fontSize: 15, fontWeight: '500' as const },
  verificationEmail: { color: Colors.text.secondary, fontSize: 13, marginBottom: 4 },
  verificationUserId: { color: Colors.text.muted, fontSize: 11, marginBottom: 4 },
  verificationReason: { color: Colors.text.muted, fontSize: 13, marginBottom: 4 },
  verificationActions: { flexDirection: 'column', gap: 8 },
  emptyState: { alignItems: 'center', paddingVertical: 40 },
  emptyText: { color: Colors.text.muted, fontSize: 14, marginTop: 12 },
  activityCard: { marginBottom: 16 },
  activityDemoHint: { color: Colors.text.muted, fontSize: 12, marginBottom: 12 },
  activityItem: { flexDirection: 'row', paddingVertical: 12, borderTopWidth: 1, borderTopColor: Colors.border.light, gap: 12 },
  activityDot: { width: 10, height: 10, borderRadius: 5, marginTop: 4 },
  activityContent: { flex: 1 },
  activityHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  activityTitle: { color: Colors.text.primary, fontSize: 14, fontWeight: '500' as const },
  activityTime: { color: Colors.text.muted, fontSize: 12 },
  activityDesc: { color: Colors.text.secondary, fontSize: 13 },
  summaryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  summaryItem: { width: '47%', backgroundColor: Colors.background.cardLight, borderRadius: 12, padding: 16, alignItems: 'center' },
  summaryValue: { color: Colors.text.primary, fontSize: 24, fontWeight: '700' as const, marginTop: 8 },
  summaryLabel: { color: Colors.text.muted, fontSize: 12, marginTop: 4 },
  analyticsCard: { marginBottom: 16 },
  metricsGrid: { flexDirection: 'row', justifyContent: 'space-between' },
  metricItem: { alignItems: 'center', flex: 1 },
  metricIcon: { width: 48, height: 48, borderRadius: 24, backgroundColor: Colors.background.cardLight, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  metricValue: { color: Colors.text.primary, fontSize: 20, fontWeight: '700' as const },
  metricLabel: { color: Colors.text.muted, fontSize: 11, marginTop: 4, textAlign: 'center' as const },
  chartPlaceholder: { backgroundColor: Colors.background.cardLight, borderRadius: 12, padding: 16, marginBottom: 16, height: 140 },
  chartBars: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'flex-end', height: 100 },
  chartBarContainer: { alignItems: 'center' },
  chartBar: { width: 24, backgroundColor: Colors.primary.blue, borderRadius: 4, marginBottom: 8 },
  chartBarLabel: { color: Colors.text.muted, fontSize: 11 },
  chartPlaceholderText: { color: Colors.text.muted, fontSize: 13, marginTop: 8 },
  analyticsStats: { flexDirection: 'row', justifyContent: 'space-around' },
  analyticsStat: { alignItems: 'center' },
  analyticsLabel: { color: Colors.text.muted, fontSize: 12 },
  analyticsValue: { color: Colors.text.primary, fontSize: 20, fontWeight: '700' as const, marginTop: 4 },
  sportStat: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  sportName: { color: Colors.text.secondary, fontSize: 13, width: 80 },
  sportBar: { flex: 1, height: 8, backgroundColor: Colors.background.cardLight, borderRadius: 4, marginHorizontal: 12, overflow: 'hidden' },
  sportBarFill: { height: '100%', borderRadius: 4 },
  sportPercent: { color: Colors.text.primary, fontSize: 13, width: 40, textAlign: 'right' as const },
  settingsCard: { marginBottom: 16 },
  notifInput: { backgroundColor: Colors.background.cardLight, borderRadius: 12, padding: 16, color: Colors.text.primary, fontSize: 14, minHeight: 80, textAlignVertical: 'top' as const, marginBottom: 12 },
  sendNotifBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: Colors.primary.blue, paddingVertical: 14, borderRadius: 12 },
  sendNotifText: { color: '#FFF', fontSize: 15, fontWeight: '600' as const },
  settingItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderTopWidth: 1, borderTopColor: Colors.border.light, gap: 12 },
  settingIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: Colors.background.cardLight, alignItems: 'center', justifyContent: 'center' },
  settingInfo: { flex: 1 },
  settingTitle: { color: Colors.text.primary, fontSize: 15 },
  settingDesc: { color: Colors.text.muted, fontSize: 12, marginTop: 2 },
  dbStats: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 16 },
  dbStat: { alignItems: 'center', gap: 8 },
  dbLabel: { color: Colors.text.muted, fontSize: 12 },
  dbValue: { color: Colors.text.primary, fontSize: 18, fontWeight: '600' as const },
  dbActions: { flexDirection: 'row', gap: 12 },
  dbActionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: Colors.primary.blue },
  dbActionText: { color: Colors.primary.blue, fontSize: 14, fontWeight: '500' as const },
  dbBackupBtn: { backgroundColor: Colors.primary.blue, borderColor: Colors.primary.blue },
  dbBackupText: { color: '#FFFFFF', fontSize: 14, fontWeight: '500' as const },
  dangerCard: { borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)' },
  dangerItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, borderTopWidth: 1, borderTopColor: Colors.border.light },
  dangerText: { color: Colors.status.error, fontSize: 14 },
  errorContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 },
  errorTitle: { color: Colors.text.primary, fontSize: 24, fontWeight: '700' as const, marginTop: 20 },
  errorText: { color: Colors.text.muted, fontSize: 15, textAlign: 'center' as const, marginTop: 8 },
  backBtn: { marginTop: 24, backgroundColor: Colors.primary.blue, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 },
  backBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' as const },
  bottomSpacer: { height: 40 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: Colors.background.dark, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: '85%' },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  modalTitle: { color: Colors.text.primary, fontSize: 20, fontWeight: '700' as const },
  modalLabel: { color: Colors.text.secondary, fontSize: 14, fontWeight: '500' as const, marginTop: 12, marginBottom: 8 },
  modalText: { color: Colors.text.primary, fontSize: 14, marginBottom: 12, padding: 12, backgroundColor: Colors.background.card, borderRadius: 8 },
  modalTextInput: { backgroundColor: Colors.background.cardLight, borderRadius: 12, padding: 16, color: Colors.text.primary, fontSize: 14, minHeight: 120, textAlignVertical: 'top' as const, marginBottom: 16 },
  modalActions: { flexDirection: 'row', gap: 12 },
  modalButton: { flex: 1 },
  banDurationRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  banDurationChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: Colors.border.light, backgroundColor: Colors.background.card },
  banDurationChipActive: { backgroundColor: Colors.status.error, borderColor: Colors.status.error },
  banDurationChipText: { color: Colors.text.secondary, fontSize: 13, fontWeight: '600' as const },
  banDurationChipTextActive: { color: '#FFFFFF' },
  ticketResponses: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: Colors.border.light },
  ticketResponsesTitle: { color: Colors.text.secondary, fontSize: 13, fontWeight: '600' as const, marginBottom: 8 },
  ticketResponseItem: { backgroundColor: Colors.background.cardLight, padding: 12, borderRadius: 8, marginBottom: 8 },
  ticketResponseAuthor: { color: Colors.text.primary, fontSize: 13, fontWeight: '600' as const, marginBottom: 4 },
  ticketResponseText: { color: Colors.text.secondary, fontSize: 14, marginBottom: 4 },
  ticketResponseDate: { color: Colors.text.muted, fontSize: 11 },
  autoRefreshCard: { marginBottom: 16 },
  autoRefreshRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  autoRefreshInfo: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  autoRefreshText: { color: Colors.text.secondary, fontSize: 14, fontWeight: '500' as const },
  lastRefreshText: { color: Colors.text.muted, fontSize: 12 },
  growthCard: { marginBottom: 16 },
  growthGrid: { flexDirection: 'row', gap: 12 },
  growthItem: { flex: 1, backgroundColor: Colors.background.cardLight, borderRadius: 12, padding: 12, alignItems: 'center' },
  growthLabel: { color: Colors.text.muted, fontSize: 11, marginTop: 4 },
  growthValue: { color: Colors.text.primary, fontSize: 20, fontWeight: '700' as const, marginTop: 4 },
  growthBadgePositive: { backgroundColor: 'rgba(16,185,129,0.1)' },
  growthBadgeNegative: { backgroundColor: 'rgba(239,68,68,0.1)' },
  growthPercent: { fontSize: 11, fontWeight: '600' as const },
  growthPercentPositive: { color: Colors.status.success },
  growthPercentNegative: { color: Colors.status.error },
  toolbarCard: { marginBottom: 16 },
  toolbarRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  toolbarBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, backgroundColor: Colors.background.cardLight },
  toolbarBtnText: { color: Colors.text.secondary, fontSize: 13 },
  bulkActionsRow: { flexDirection: 'row', gap: 8, paddingTop: 12, borderTopWidth: 1, borderTopColor: Colors.border.light },
  bulkActionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 8, backgroundColor: Colors.background.cardLight },
  bulkActionText: { color: Colors.text.secondary, fontSize: 13, fontWeight: '500' as const },
  userCheckbox: { paddingRight: 8 },
  userItemContent: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  liveBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(239,68,68,0.1)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.status.error },
  liveText: { color: Colors.status.error, fontSize: 11, fontWeight: '700' as const },
  activityTimeline: { marginTop: 8 },
  activityLeft: { alignItems: 'center', marginRight: 12 },
  activityIconContainer: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  activityLine: { width: 2, flex: 1, backgroundColor: Colors.border.light, marginTop: 4 },
  activitySeverityBadge: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, marginTop: 6 },
  activitySeverityText: { fontSize: 10, fontWeight: '600' as const },
  quickActionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  quickActionBtn: { flex: 1, minWidth: '45%', backgroundColor: Colors.background.cardLight, borderRadius: 12, padding: 16, alignItems: 'center', gap: 8, position: 'relative' as const },
  quickActionText: { color: Colors.text.secondary, fontSize: 13, fontWeight: '500' as const, textAlign: 'center' as const },
  quickBadge: { position: 'absolute' as const, top: 8, right: 8, backgroundColor: Colors.status.error, borderRadius: 10, minWidth: 20, height: 20, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  quickBadgeText: { color: '#fff', fontSize: 11, fontWeight: '700' as const },
  demoBadge: { backgroundColor: 'rgba(251,191,36,0.1)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  demoText: { color: '#F59E0B', fontSize: 10, fontWeight: '700' as const },
  cityIconContainer: { width: 24, height: 24, borderRadius: 12, backgroundColor: 'rgba(21,101,192,0.1)', alignItems: 'center', justifyContent: 'center', marginRight: 8 },
  sportRank: { width: 28, height: 28, borderRadius: 14, backgroundColor: Colors.background.cardLight, alignItems: 'center', justifyContent: 'center', marginRight: 8 },
  sportRankText: { color: Colors.text.primary, fontSize: 12, fontWeight: '700' as const },
  refreshBtn: { padding: 8, borderRadius: 8, backgroundColor: Colors.background.cardLight },
  infoBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(245,158,11,0.1)', padding: 12, borderRadius: 8, marginBottom: 12 },
  infoText: { color: '#F59E0B', fontSize: 13, flex: 1 },
  detailSection: { marginBottom: 16 },
  detailLabel: { color: Colors.text.secondary, fontSize: 13, fontWeight: '600' as const, marginBottom: 6 },
  detailValue: { color: Colors.text.primary, fontSize: 15 },
  detailSubValue: { color: Colors.text.muted, fontSize: 12, marginTop: 2 },
  detailDescription: { color: Colors.text.primary, fontSize: 14, lineHeight: 20, backgroundColor: Colors.background.card, padding: 12, borderRadius: 8 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, alignSelf: 'flex-start' },
  statusBadgeText: { color: '#FFFFFF', fontSize: 12, fontWeight: '600' as const },
  detailActions: { gap: 8, marginTop: 20 },
  detailActionBtn: { marginBottom: 8 },
  qaButtonRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  qaBtn: { flex: 1 },
  qaDomainRow: { gap: 8, paddingBottom: 8 },
  qaDomainChip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12, borderWidth: 1, borderColor: Colors.border.light, backgroundColor: Colors.background.card },
  qaDomainChipActive: { backgroundColor: Colors.primary.blue, borderColor: Colors.primary.blue },
  qaDomainChipText: { color: Colors.text.secondary, fontSize: 12 },
  qaDomainChipTextActive: { color: '#FFFFFF' },
  qaSummaryRow: { flexDirection: 'row', gap: 8, marginTop: 12, marginBottom: 8 },
  qaSummaryItem: { flex: 1, backgroundColor: Colors.background.cardLight, borderRadius: 10, padding: 10, alignItems: 'center' },
  qaSummaryLabel: { color: Colors.text.muted, fontSize: 11 },
  qaSummaryValue: { color: Colors.text.primary, fontSize: 16, fontWeight: '700' as const, marginTop: 2 },
  qaScenarioItem: { borderTopWidth: 1, borderTopColor: Colors.border.light, paddingTop: 10, marginTop: 10 },
  qaScenarioHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  qaScenarioTitle: { color: Colors.text.primary, fontSize: 13, fontWeight: '600' as const, flex: 1 },
  qaScenarioStatus: { fontSize: 11, fontWeight: '700' as const },
  qaStepText: { color: Colors.text.secondary, fontSize: 12, marginTop: 4 },
  qaMetaText: { color: Colors.text.muted, fontSize: 11, marginTop: 2 },
  qaEventItem: { borderTopWidth: 1, borderTopColor: Colors.border.light, paddingTop: 10, marginTop: 10 },
  qaEventText: { color: Colors.text.primary, fontSize: 12, fontWeight: '600' as const },
  qaEventError: { color: Colors.status.error, fontSize: 12, marginTop: 2 },
  qaLogItem: { borderTopWidth: 1, borderTopColor: Colors.border.light, paddingTop: 10, marginTop: 10 },
  qaLogTitle: { color: Colors.text.primary, fontSize: 13, fontWeight: '600' as const },
});
