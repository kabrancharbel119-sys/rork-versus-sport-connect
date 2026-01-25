import React, { useState, useMemo } from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity, Alert, TextInput, RefreshControl, Switch } from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Users, Swords, Shield, Ban, Search, ChevronRight, TrendingUp, Settings, BarChart3, Calendar, MapPin, Star, CheckCircle, XCircle, Eye, RefreshCw, Globe, Database, DollarSign, Ticket, UserCheck, Activity, Clock, AlertTriangle, Zap, Server, HardDrive, Send, Lock, Trash2, FileText, Download, MessageSquare, Award, Target, PieChart } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { useAuth } from '@/contexts/AuthContext';
import { useTeams } from '@/contexts/TeamsContext';
import { useMatches } from '@/contexts/MatchesContext';
import { useUsers } from '@/contexts/UsersContext';
import { useNotifications } from '@/contexts/NotificationsContext';
import { useSupport, SupportTicket, VerificationRequest } from '@/contexts/SupportContext';
import { Card } from '@/components/Card';
import { StatCard } from '@/components/StatCard';
import { Avatar } from '@/components/Avatar';
import { sportLabels } from '@/mocks/data';

type AdminTab = 'overview' | 'users' | 'teams' | 'matches' | 'tickets' | 'verifications' | 'analytics' | 'activity' | 'settings';

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
  const { user, isAdmin } = useAuth();
  const { teams } = useTeams();
  const { matches } = useMatches();
  const { users, banUser, unbanUser, verifyUser } = useUsers();
  const { addNotification } = useNotifications();
  const { tickets, verificationRequests, updateTicketStatus, handleVerification, getPendingTickets, getPendingVerifications } = useSupport();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'banned' | 'verified'>('all');
  const [refreshing, setRefreshing] = useState(false);
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [notificationMessage, setNotificationMessage] = useState('');

  const onRefresh = async () => { setRefreshing(true); await new Promise(r => setTimeout(r, 1000)); setRefreshing(false); };

  const pendingTickets = getPendingTickets();
  const pendingVerifications = getPendingVerifications();

  const activityLogs: ActivityLog[] = useMemo(() => [
    { id: '1', type: 'user_joined', title: 'Nouvel utilisateur', description: 'Amadou Diallo a rejoint la plateforme', timestamp: new Date(Date.now() - 1000 * 60 * 5), severity: 'success' },
    { id: '2', type: 'team_created', title: 'Équipe créée', description: 'FC Étoile de Dakar a été créée', timestamp: new Date(Date.now() - 1000 * 60 * 15), severity: 'info' },
    { id: '3', type: 'report', title: 'Signalement', description: 'Comportement inapproprié signalé', timestamp: new Date(Date.now() - 1000 * 60 * 30), severity: 'warning' },
    { id: '4', type: 'match_created', title: 'Match organisé', description: 'Nouveau match de football à 11', timestamp: new Date(Date.now() - 1000 * 60 * 45), severity: 'info' },
    { id: '5', type: 'verification', title: 'Vérification approuvée', description: 'Compte de Fatou Sow vérifié', timestamp: new Date(Date.now() - 1000 * 60 * 60), severity: 'success' },
    { id: '6', type: 'payment', title: 'Paiement reçu', description: 'Abonnement Premium - 5000 FCFA', timestamp: new Date(Date.now() - 1000 * 60 * 90), severity: 'success' },
    { id: '7', type: 'ban', title: 'Utilisateur banni', description: 'Compte suspendu pour spam', timestamp: new Date(Date.now() - 1000 * 60 * 120), severity: 'error' },
  ], []);

  const stats = useMemo(() => ({
    totalUsers: users.length,
    totalTeams: teams.length,
    totalMatches: matches.length,
    activeUsers: users.filter(u => !u.isBanned).length,
    bannedUsers: users.filter(u => u.isBanned).length,
    verifiedUsers: users.filter(u => u.isVerified).length,
    premiumUsers: users.filter(u => u.isPremium).length,
    pendingTickets: pendingTickets.length,
    pendingVerifications: pendingVerifications.length,
    totalTournaments: 8,
    openMatches: matches.filter(m => m.status === 'open').length,
    completedMatches: matches.filter(m => m.status === 'completed').length,
    totalRevenue: 2500000,
    monthlyRevenue: 450000,
    weeklyRevenue: 125000,
    monthlyGrowth: 15.5,
    weeklyGrowth: 8.2,
    avgSessionTime: 24,
    dailyActiveUsers: Math.floor(users.length * 0.35),
    weeklyActiveUsers: Math.floor(users.length * 0.65),
    conversionRate: 12.5,
    retentionRate: 78,
    serverUptime: 99.9,
    apiLatency: 45,
    storageUsed: 2.4,
    storageTotal: 10,
  }), [users, teams, matches, pendingTickets, pendingVerifications]);

  const sportStats = useMemo(() => {
    const sportCounts: Record<string, number> = {};
    matches.forEach(m => { 
      if (m.sport) {
        sportCounts[m.sport] = (sportCounts[m.sport] || 0) + 1; 
      }
    });
    const total = matches.length || 1;
    return Object.entries(sportCounts).map(([sport, count]) => ({
      sport: (sportLabels as Record<string, string>)[sport] || sport,
      count,
      percent: Math.round((count / total) * 100),
    })).sort((a, b) => b.count - a.count).slice(0, 5);
  }, [matches]);

  const cityStats = useMemo(() => {
    const cityCounts: Record<string, number> = {};
    users.forEach(u => { 
      if (u.city) {
        cityCounts[u.city] = (cityCounts[u.city] || 0) + 1; 
      }
    });
    const total = users.length || 1;
    return Object.entries(cityCounts).map(([city, count]) => ({
      city,
      count,
      percent: Math.round((count / total) * 100),
    })).sort((a, b) => b.count - a.count).slice(0, 5);
  }, [users]);

  const filteredUsers = useMemo(() => {
    let result = users;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(u => u.fullName.toLowerCase().includes(q) || u.email.toLowerCase().includes(q) || u.username.toLowerCase().includes(q));
    }
    if (filterStatus === 'active') result = result.filter(u => !u.isBanned);
    if (filterStatus === 'banned') result = result.filter(u => u.isBanned);
    if (filterStatus === 'verified') result = result.filter(u => u.isVerified);
    return result;
  }, [users, searchQuery, filterStatus]);

  const filteredTeams = useMemo(() => {
    if (!searchQuery) return teams;
    const q = searchQuery.toLowerCase();
    return teams.filter(t => t.name.toLowerCase().includes(q) || t.city.toLowerCase().includes(q));
  }, [teams, searchQuery]);

  const filteredMatches = useMemo(() => {
    if (!searchQuery) return matches;
    const q = searchQuery.toLowerCase();
    return matches.filter(m => m.sport.toLowerCase().includes(q) || m.venue.name.toLowerCase().includes(q));
  }, [matches, searchQuery]);

  if (!isAdmin) {
    return (
      <View style={styles.container}>
        <LinearGradient colors={[Colors.background.dark, '#0D1420']} style={StyleSheet.absoluteFill} />
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.errorContainer}>
            <Shield size={64} color={Colors.status.error} />
            <Text style={styles.errorTitle}>Accès refusé</Text>
            <Text style={styles.errorText}>Vous n&apos;avez pas les permissions administrateur.</Text>
            <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}><Text style={styles.backBtnText}>Retour</Text></TouchableOpacity>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  const handleBanUser = async (userId: string, userName: string) => {
    Alert.alert('Bannir', `Bannir ${userName} ?`, [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Bannir', style: 'destructive', onPress: async () => {
        await banUser(userId);
        await addNotification({ userId, type: 'system', title: 'Compte suspendu', message: 'Votre compte a été suspendu pour violation des règles.' });
        Alert.alert('Succès', `${userName} a été banni`);
      }},
    ]);
  };

  const handleUnbanUser = async (userId: string, userName: string) => {
    Alert.alert('Débannir', `Débannir ${userName} ?`, [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Débannir', onPress: async () => {
        await unbanUser(userId);
        await addNotification({ userId, type: 'system', title: 'Compte réactivé', message: 'Votre compte a été réactivé.' });
        Alert.alert('Succès', `${userName} a été débanni`);
      }},
    ]);
  };

  const handleVerifyUser = async (userId: string, userName: string) => {
    Alert.alert('Vérifier', `Vérifier le compte de ${userName} ?`, [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Vérifier', onPress: async () => {
        await verifyUser(userId);
        await addNotification({ userId, type: 'system', title: 'Compte vérifié ✓', message: 'Félicitations ! Votre compte est maintenant vérifié.' });
        Alert.alert('Succès', `${userName} est maintenant vérifié`);
      }},
    ]);
  };

  const handleTicketAction = async (ticketId: string, action: 'resolve' | 'close') => {
    const status = action === 'resolve' ? 'resolved' : 'closed';
    await updateTicketStatus({ ticketId, status });
    Alert.alert('Succès', `Ticket ${action === 'resolve' ? 'résolu' : 'fermé'}`);
  };

  const handleVerificationAction = async (requestId: string, action: 'approve' | 'reject', userId: string) => {
    await handleVerification({ requestId, action, adminId: user?.id || '' });
    if (action === 'approve') {
      await verifyUser(userId);
      await addNotification({ userId, type: 'system', title: 'Compte vérifié ✓', message: 'Félicitations ! Votre demande de vérification a été approuvée.' });
    } else {
      await addNotification({ userId, type: 'system', title: 'Vérification refusée', message: 'Votre demande de vérification a été refusée. Vous pouvez soumettre une nouvelle demande.' });
    }
    Alert.alert('Succès', action === 'approve' ? 'Utilisateur vérifié' : 'Demande refusée');
  };

  const handleSendGlobalNotification = () => {
    if (!notificationMessage.trim()) {
      Alert.alert('Erreur', 'Veuillez entrer un message');
      return;
    }
    Alert.alert('Confirmer', `Envoyer cette notification à tous les utilisateurs ?\n\n"${notificationMessage}"`, [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Envoyer', onPress: () => {
        Alert.alert('Succès', 'Notification envoyée à tous les utilisateurs');
        setNotificationMessage('');
      }},
    ]);
  };

  const formatDate = (date: Date) => new Date(date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
  const formatTime = (date: Date) => {
    const diff = Date.now() - new Date(date).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `Il y a ${mins}min`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `Il y a ${hours}h`;
    return formatDate(date);
  };

  const getSeverityColor = (severity: ActivityLog['severity']) => {
    switch (severity) {
      case 'success': return Colors.status.success;
      case 'warning': return '#F59E0B';
      case 'error': return Colors.status.error;
      default: return Colors.primary.blue;
    }
  };

  const tabs: { key: AdminTab; label: string; icon: React.ReactNode; badge?: number }[] = [
    { key: 'overview', label: 'Vue d\'ensemble', icon: <BarChart3 size={16} color={activeTab === 'overview' ? '#FFF' : Colors.text.secondary} /> },
    { key: 'users', label: 'Utilisateurs', icon: <Users size={16} color={activeTab === 'users' ? '#FFF' : Colors.text.secondary} /> },
    { key: 'teams', label: 'Équipes', icon: <Shield size={16} color={activeTab === 'teams' ? '#FFF' : Colors.text.secondary} /> },
    { key: 'matches', label: 'Matchs', icon: <Swords size={16} color={activeTab === 'matches' ? '#FFF' : Colors.text.secondary} /> },
    { key: 'tickets', label: 'Tickets', icon: <Ticket size={16} color={activeTab === 'tickets' ? '#FFF' : Colors.text.secondary} />, badge: pendingTickets.length },
    { key: 'verifications', label: 'Vérifications', icon: <UserCheck size={16} color={activeTab === 'verifications' ? '#FFF' : Colors.text.secondary} />, badge: pendingVerifications.length },
    { key: 'activity', label: 'Activité', icon: <Activity size={16} color={activeTab === 'activity' ? '#FFF' : Colors.text.secondary} /> },
    { key: 'analytics', label: 'Analytiques', icon: <TrendingUp size={16} color={activeTab === 'analytics' ? '#FFF' : Colors.text.secondary} /> },
    { key: 'settings', label: 'Paramètres', icon: <Settings size={16} color={activeTab === 'settings' ? '#FFF' : Colors.text.secondary} /> },
  ];

  const renderOverview = () => (
    <>
      <View style={styles.statsGrid}>
        <StatCard label="Utilisateurs" value={stats.totalUsers} icon={<Users size={20} color={Colors.primary.blue} />} variant="blue" />
        <StatCard label="Équipes" value={stats.totalTeams} icon={<Shield size={20} color={Colors.primary.orange} />} variant="orange" />
        <StatCard label="Matchs" value={stats.totalMatches} icon={<Swords size={20} color={Colors.status.success} />} variant="default" />
      </View>
      <View style={styles.statsGrid}>
        <StatCard label="Actifs/jour" value={stats.dailyActiveUsers} icon={<Activity size={20} color={Colors.status.success} />} variant="default" />
        <StatCard label="Vérifiés" value={stats.verifiedUsers} icon={<CheckCircle size={20} color={Colors.primary.blue} />} variant="blue" />
        <StatCard label="Premium" value={stats.premiumUsers} icon={<Star size={20} color="#F59E0B" />} variant="orange" />
      </View>

      <Card style={styles.revenueCard}>
        <View style={styles.revenueHeader}>
          <View>
            <Text style={styles.revenueTitle}>Revenus du mois</Text>
            <Text style={styles.revenueAmount}>{stats.monthlyRevenue.toLocaleString()} FCFA</Text>
          </View>
          <View style={styles.growthBadge}><TrendingUp size={12} color={Colors.status.success} /><Text style={styles.growthText}>+{stats.monthlyGrowth}%</Text></View>
        </View>
        <View style={styles.revenueBreakdown}>
          <View style={styles.revenueItem}>
            <Text style={styles.revenueItemLabel}>Cette semaine</Text>
            <Text style={styles.revenueItemValue}>{stats.weeklyRevenue.toLocaleString()} FCFA</Text>
          </View>
          <View style={styles.revenueItem}>
            <Text style={styles.revenueItemLabel}>Total annuel</Text>
            <Text style={styles.revenueItemValue}>{stats.totalRevenue.toLocaleString()} FCFA</Text>
          </View>
        </View>
      </Card>

      <Card style={styles.systemCard}>
        <Text style={styles.cardTitle}>État du système</Text>
        <View style={styles.systemStats}>
          <View style={styles.systemStat}>
            <View style={[styles.systemIndicator, { backgroundColor: Colors.status.success }]} />
            <Server size={18} color={Colors.text.secondary} />
            <View style={styles.systemStatInfo}>
              <Text style={styles.systemStatLabel}>Uptime</Text>
              <Text style={styles.systemStatValue}>{stats.serverUptime}%</Text>
            </View>
          </View>
          <View style={styles.systemStat}>
            <View style={[styles.systemIndicator, { backgroundColor: Colors.status.success }]} />
            <Zap size={18} color={Colors.text.secondary} />
            <View style={styles.systemStatInfo}>
              <Text style={styles.systemStatLabel}>Latence API</Text>
              <Text style={styles.systemStatValue}>{stats.apiLatency}ms</Text>
            </View>
          </View>
          <View style={styles.systemStat}>
            <View style={[styles.systemIndicator, { backgroundColor: stats.storageUsed / stats.storageTotal > 0.8 ? '#F59E0B' : Colors.status.success }]} />
            <HardDrive size={18} color={Colors.text.secondary} />
            <View style={styles.systemStatInfo}>
              <Text style={styles.systemStatLabel}>Stockage</Text>
              <Text style={styles.systemStatValue}>{stats.storageUsed}/{stats.storageTotal} GB</Text>
            </View>
          </View>
        </View>
      </Card>

      <Card style={styles.actionsCard}>
        <Text style={styles.cardTitle}>Actions urgentes</Text>
        {pendingTickets.length > 0 && (
          <TouchableOpacity style={styles.urgentRow} onPress={() => setActiveTab('tickets')}>
            <View style={[styles.urgentIcon, { backgroundColor: 'rgba(239,68,68,0.1)' }]}><AlertTriangle size={18} color={Colors.status.error} /></View>
            <View style={styles.urgentInfo}><Text style={styles.urgentTitle}>{pendingTickets.length} tickets en attente</Text><Text style={styles.urgentDesc}>Nécessite votre attention</Text></View>
            <ChevronRight size={20} color={Colors.text.muted} />
          </TouchableOpacity>
        )}
        {pendingVerifications.length > 0 && (
          <TouchableOpacity style={styles.urgentRow} onPress={() => setActiveTab('verifications')}>
            <View style={[styles.urgentIcon, { backgroundColor: 'rgba(21,101,192,0.1)' }]}><UserCheck size={18} color={Colors.primary.blue} /></View>
            <View style={styles.urgentInfo}><Text style={styles.urgentTitle}>{pendingVerifications.length} vérifications</Text><Text style={styles.urgentDesc}>En attente d&apos;approbation</Text></View>
            <ChevronRight size={20} color={Colors.text.muted} />
          </TouchableOpacity>
        )}
        {stats.bannedUsers > 0 && (
          <TouchableOpacity style={styles.urgentRow} onPress={() => { setActiveTab('users'); setFilterStatus('banned'); }}>
            <View style={[styles.urgentIcon, { backgroundColor: 'rgba(239,68,68,0.1)' }]}><Ban size={18} color={Colors.status.error} /></View>
            <View style={styles.urgentInfo}><Text style={styles.urgentTitle}>{stats.bannedUsers} utilisateurs bannis</Text><Text style={styles.urgentDesc}>Réviser les suspensions</Text></View>
            <ChevronRight size={20} color={Colors.text.muted} />
          </TouchableOpacity>
        )}
        {pendingTickets.length === 0 && pendingVerifications.length === 0 && stats.bannedUsers === 0 && (
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
      <Card style={styles.listCard}>
        <View style={styles.listHeader}><Text style={styles.cardTitle}>Utilisateurs ({filteredUsers.length})</Text></View>
        {filteredUsers.map((u) => (
          <TouchableOpacity key={u.id} style={styles.userItem} onPress={() => router.push(`/user/${u.id}`)}>
            <Avatar uri={u.avatar} name={u.fullName} size="medium" />
            <View style={styles.userInfo}>
              <View style={styles.userNameRow}>
                <Text style={styles.userName}>{u.fullName}</Text>
                {u.isVerified && <CheckCircle size={14} color={Colors.primary.blue} />}
                {u.isPremium && <Star size={14} color={Colors.primary.orange} />}
                {u.isBanned && <Ban size={14} color={Colors.status.error} />}
              </View>
              <Text style={styles.userEmail}>{u.email}</Text>
              <Text style={styles.userMeta}>{u.city} • {formatDate(u.createdAt)}</Text>
            </View>
            <View style={styles.userActions}>
              {u.isBanned ? (
                <TouchableOpacity style={styles.actionBtnGreen} onPress={() => handleUnbanUser(u.id, u.fullName)}><CheckCircle size={16} color={Colors.status.success} /></TouchableOpacity>
              ) : (
                <TouchableOpacity style={styles.actionBtnRed} onPress={() => handleBanUser(u.id, u.fullName)}><Ban size={16} color={Colors.status.error} /></TouchableOpacity>
              )}
              {!u.isVerified && <TouchableOpacity style={styles.actionBtnBlue} onPress={() => handleVerifyUser(u.id, u.fullName)}><CheckCircle size={16} color={Colors.primary.blue} /></TouchableOpacity>}
            </View>
          </TouchableOpacity>
        ))}
      </Card>
    </>
  );

  const renderTeams = () => (
    <Card style={styles.listCard}>
      <Text style={styles.cardTitle}>Équipes ({filteredTeams.length})</Text>
      {filteredTeams.map((team) => (
        <TouchableOpacity key={team.id} style={styles.teamItem} onPress={() => router.push(`/team/${team.id}`)}>
          <Avatar uri={team.logo} name={team.name} size="medium" />
          <View style={styles.teamInfo}>
            <Text style={styles.teamName}>{team.name}</Text>
            <Text style={styles.teamMeta}>{sportLabels[team.sport]} • {team.format}</Text>
            <Text style={styles.teamStatText}>{team.members.length}/{team.maxMembers} membres • {team.city}</Text>
          </View>
          <TouchableOpacity style={styles.actionBtnBlue} onPress={() => router.push(`/team/${team.id}`)}><Eye size={16} color={Colors.primary.blue} /></TouchableOpacity>
        </TouchableOpacity>
      ))}
    </Card>
  );

  const renderMatches = () => (
    <Card style={styles.listCard}>
      <Text style={styles.cardTitle}>Matchs ({filteredMatches.length})</Text>
      {filteredMatches.map((match) => (
        <TouchableOpacity key={match.id} style={styles.matchItem} onPress={() => router.push(`/match/${match.id}`)}>
          <View style={[styles.matchStatus, match.status === 'open' ? styles.statusOpen : match.status === 'confirmed' ? styles.statusConfirmed : match.status === 'completed' ? styles.statusCompleted : styles.statusCancelled]} />
          <View style={styles.matchInfo}>
            <Text style={styles.matchTitle}>{sportLabels[match.sport]} - {match.format}</Text>
            <View style={styles.matchDetails}><Calendar size={12} color={Colors.text.muted} /><Text style={styles.matchDetailText}>{formatDate(match.dateTime)}</Text></View>
            <View style={styles.matchDetails}><MapPin size={12} color={Colors.text.muted} /><Text style={styles.matchDetailText}>{match.venue.name}</Text></View>
          </View>
          <TouchableOpacity style={styles.actionBtnBlue} onPress={() => router.push(`/match/${match.id}`)}><Eye size={16} color={Colors.primary.blue} /></TouchableOpacity>
        </TouchableOpacity>
      ))}
    </Card>
  );

  const renderTickets = () => (
    <Card style={styles.listCard}>
      <Text style={styles.cardTitle}>Tickets Support ({tickets.length})</Text>
      {tickets.length === 0 ? (
        <View style={styles.emptyState}><Ticket size={40} color={Colors.text.muted} /><Text style={styles.emptyText}>Aucun ticket</Text></View>
      ) : (
        tickets.map((ticket: SupportTicket) => (
          <View key={ticket.id} style={styles.ticketItem}>
            <View style={styles.ticketInfo}>
              <View style={styles.ticketHeader}>
                <Text style={styles.ticketSubject}>{ticket.subject}</Text>
                <View style={[styles.ticketStatusBadge, ticket.status === 'open' ? styles.statusOpen : ticket.status === 'in_progress' ? styles.statusConfirmed : styles.statusCompleted]}>
                  <Text style={styles.ticketStatusText}>{ticket.status === 'open' ? 'Ouvert' : ticket.status === 'in_progress' ? 'En cours' : ticket.status === 'resolved' ? 'Résolu' : 'Fermé'}</Text>
                </View>
              </View>
              <Text style={styles.ticketUser}>{ticket.userName} • {ticket.userEmail}</Text>
              <Text style={styles.ticketDesc} numberOfLines={2}>{ticket.description}</Text>
              <Text style={styles.ticketMeta}>Catégorie: {ticket.category} • {formatDate(ticket.createdAt)}</Text>
            </View>
            {(ticket.status === 'open' || ticket.status === 'in_progress') && (
              <View style={styles.ticketActions}>
                <TouchableOpacity style={styles.actionBtnGreen} onPress={() => handleTicketAction(ticket.id, 'resolve')}><CheckCircle size={16} color={Colors.status.success} /></TouchableOpacity>
                <TouchableOpacity style={styles.actionBtnRed} onPress={() => handleTicketAction(ticket.id, 'close')}><XCircle size={16} color={Colors.status.error} /></TouchableOpacity>
              </View>
            )}
          </View>
        ))
      )}
    </Card>
  );

  const renderVerifications = () => (
    <Card style={styles.listCard}>
      <Text style={styles.cardTitle}>Demandes de vérification ({verificationRequests.length})</Text>
      {verificationRequests.length === 0 ? (
        <View style={styles.emptyState}><UserCheck size={40} color={Colors.text.muted} /><Text style={styles.emptyText}>Aucune demande</Text></View>
      ) : (
        verificationRequests.map((req: VerificationRequest) => (
          <View key={req.id} style={styles.verificationItem}>
            <Avatar uri={req.userAvatar} name={req.userName} size="medium" />
            <View style={styles.verificationInfo}>
              <View style={styles.verificationHeader}>
                <Text style={styles.verificationName}>{req.userName}</Text>
                <View style={[styles.ticketStatusBadge, req.status === 'pending' ? styles.statusOpen : req.status === 'approved' ? styles.statusCompleted : styles.statusCancelled]}>
                  <Text style={styles.ticketStatusText}>{req.status === 'pending' ? 'En attente' : req.status === 'approved' ? 'Approuvé' : 'Refusé'}</Text>
                </View>
              </View>
              <Text style={styles.verificationEmail}>{req.userEmail}</Text>
              <Text style={styles.verificationReason} numberOfLines={2}>{req.reason}</Text>
              <Text style={styles.ticketMeta}>{formatDate(req.createdAt)}</Text>
            </View>
            {req.status === 'pending' && (
              <View style={styles.verificationActions}>
                <TouchableOpacity style={styles.actionBtnGreen} onPress={() => handleVerificationAction(req.id, 'approve', req.userId || '')}><CheckCircle size={16} color={Colors.status.success} /></TouchableOpacity>
                <TouchableOpacity style={styles.actionBtnRed} onPress={() => handleVerificationAction(req.id, 'reject', req.userId || '')}><XCircle size={16} color={Colors.status.error} /></TouchableOpacity>
              </View>
            )}
          </View>
        ))
      )}
    </Card>
  );

  const renderActivity = () => (
    <>
      <Card style={styles.activityCard}>
        <Text style={styles.cardTitle}>Activité récente</Text>
        {activityLogs.map((log) => (
          <View key={log.id} style={styles.activityItem}>
            <View style={[styles.activityDot, { backgroundColor: getSeverityColor(log.severity) }]} />
            <View style={styles.activityContent}>
              <View style={styles.activityHeader}>
                <Text style={styles.activityTitle}>{log.title}</Text>
                <Text style={styles.activityTime}>{formatTime(log.timestamp)}</Text>
              </View>
              <Text style={styles.activityDesc}>{log.description}</Text>
            </View>
          </View>
        ))}
      </Card>
      <Card style={styles.activityCard}>
        <Text style={styles.cardTitle}>Résumé du jour</Text>
        <View style={styles.summaryGrid}>
          <View style={styles.summaryItem}>
            <Users size={20} color={Colors.primary.blue} />
            <Text style={styles.summaryValue}>+12</Text>
            <Text style={styles.summaryLabel}>Inscriptions</Text>
          </View>
          <View style={styles.summaryItem}>
            <Swords size={20} color={Colors.primary.orange} />
            <Text style={styles.summaryValue}>8</Text>
            <Text style={styles.summaryLabel}>Matchs créés</Text>
          </View>
          <View style={styles.summaryItem}>
            <Shield size={20} color={Colors.status.success} />
            <Text style={styles.summaryValue}>3</Text>
            <Text style={styles.summaryLabel}>Équipes créées</Text>
          </View>
          <View style={styles.summaryItem}>
            <MessageSquare size={20} color={Colors.text.secondary} />
            <Text style={styles.summaryValue}>245</Text>
            <Text style={styles.summaryLabel}>Messages</Text>
          </View>
        </View>
      </Card>
    </>
  );

  const renderAnalytics = () => (
    <>
      <Card style={styles.analyticsCard}>
        <Text style={styles.cardTitle}>Métriques clés</Text>
        <View style={styles.metricsGrid}>
          <View style={styles.metricItem}>
            <View style={styles.metricIcon}><Target size={20} color={Colors.primary.blue} /></View>
            <Text style={styles.metricValue}>{stats.conversionRate}%</Text>
            <Text style={styles.metricLabel}>Taux de conversion</Text>
          </View>
          <View style={styles.metricItem}>
            <View style={styles.metricIcon}><Award size={20} color={Colors.status.success} /></View>
            <Text style={styles.metricValue}>{stats.retentionRate}%</Text>
            <Text style={styles.metricLabel}>Rétention</Text>
          </View>
          <View style={styles.metricItem}>
            <View style={styles.metricIcon}><Clock size={20} color={Colors.primary.orange} /></View>
            <Text style={styles.metricValue}>{stats.avgSessionTime}min</Text>
            <Text style={styles.metricLabel}>Session moy.</Text>
          </View>
        </View>
      </Card>

      <Card style={styles.analyticsCard}>
        <Text style={styles.cardTitle}>Croissance des utilisateurs</Text>
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

      <Card style={styles.analyticsCard}>
        <Text style={styles.cardTitle}>Sports populaires</Text>
        {sportStats.length > 0 ? sportStats.map((item, i) => (
          <View key={i} style={styles.sportStat}>
            <Text style={styles.sportName}>{item.sport}</Text>
            <View style={styles.sportBar}><View style={[styles.sportBarFill, { width: `${item.percent}%`, backgroundColor: i === 0 ? Colors.primary.blue : i === 1 ? Colors.primary.orange : Colors.status.success }]} /></View>
            <Text style={styles.sportPercent}>{item.percent}%</Text>
          </View>
        )) : (
          <Text style={styles.emptyText}>Aucune donnée disponible</Text>
        )}
      </Card>

      <Card style={styles.analyticsCard}>
        <Text style={styles.cardTitle}>Répartition géographique</Text>
        {cityStats.length > 0 ? cityStats.map((item, i) => (
          <View key={i} style={styles.sportStat}>
            <Text style={styles.sportName}>{item.city}</Text>
            <View style={styles.sportBar}><View style={[styles.sportBarFill, { width: `${item.percent}%`, backgroundColor: Colors.primary.blue }]} /></View>
            <Text style={styles.sportPercent}>{item.count}</Text>
          </View>
        )) : (
          <Text style={styles.emptyText}>Aucune donnée disponible</Text>
        )}
      </Card>
    </>
  );

  const renderSettings = () => (
    <>
      <Card style={styles.settingsCard}>
        <Text style={styles.cardTitle}>Notifications globales</Text>
        <TextInput 
          style={styles.notifInput} 
          placeholder="Entrez votre message..." 
          placeholderTextColor={Colors.text.muted}
          value={notificationMessage}
          onChangeText={setNotificationMessage}
          multiline
          numberOfLines={3}
        />
        <TouchableOpacity style={styles.sendNotifBtn} onPress={handleSendGlobalNotification}>
          <Send size={18} color="#FFF" /><Text style={styles.sendNotifText}>Envoyer à tous</Text>
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
        </View>
        <View style={styles.dbActions}>
          <TouchableOpacity style={styles.dbActionBtn} onPress={() => Alert.alert('Export', 'Export des données en cours...')}>
            <Download size={16} color={Colors.primary.blue} /><Text style={styles.dbActionText}>Exporter</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.dbActionBtn, styles.dbBackupBtn]} onPress={() => Alert.alert('Sauvegarde', 'Sauvegarde en cours...')}>
            <RefreshCw size={16} color="#FFF" /><Text style={styles.dbBackupText}>Sauvegarder</Text>
          </TouchableOpacity>
        </View>
      </Card>

      <Card style={[styles.settingsCard, styles.dangerCard]}>
        <Text style={[styles.cardTitle, { color: Colors.status.error }]}>Zone de danger</Text>
        <TouchableOpacity style={styles.dangerItem} onPress={() => Alert.alert('Attention', 'Cette action est irréversible', [{ text: 'Annuler', style: 'cancel' }, { text: 'Confirmer', style: 'destructive' }])}>
          <Trash2 size={20} color={Colors.status.error} />
          <Text style={styles.dangerText}>Purger les données de cache</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.dangerItem} onPress={() => Alert.alert('Attention', 'Action irréversible', [{ text: 'Annuler', style: 'cancel' }, { text: 'Confirmer', style: 'destructive' }])}>
          <Trash2 size={20} color={Colors.status.error} />
          <Text style={styles.dangerText}>Réinitialiser les statistiques</Text>
        </TouchableOpacity>
      </Card>
    </>
  );

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.container}>
        <LinearGradient colors={[Colors.background.dark, '#0D1420']} style={StyleSheet.absoluteFill} />
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.header}>
            <TouchableOpacity style={styles.backButton} onPress={() => router.back()}><ArrowLeft size={24} color={Colors.text.primary} /></TouchableOpacity>
            <Text style={styles.headerTitle}>Administration</Text>
            <View style={styles.adminBadge}><Shield size={14} color="#FFFFFF" /></View>
          </View>
          <View style={styles.searchContainer}>
            <Search size={20} color={Colors.text.muted} />
            <TextInput style={styles.searchInput} placeholder="Rechercher..." placeholderTextColor={Colors.text.muted} value={searchQuery} onChangeText={setSearchQuery} />
            {searchQuery.length > 0 && <TouchableOpacity onPress={() => setSearchQuery('')}><XCircle size={18} color={Colors.text.muted} /></TouchableOpacity>}
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabsScroll} contentContainerStyle={styles.tabs}>
            {tabs.map(tab => (
              <TouchableOpacity key={tab.key} style={[styles.tab, activeTab === tab.key && styles.tabActive]} onPress={() => setActiveTab(tab.key)}>
                {tab.icon}
                <Text style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}>{tab.label}</Text>
                {tab.badge && tab.badge > 0 && <View style={styles.tabBadge}><Text style={styles.tabBadgeText}>{tab.badge}</Text></View>}
              </TouchableOpacity>
            ))}
          </ScrollView>
          <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary.blue} />}>
            {activeTab === 'overview' && renderOverview()}
            {activeTab === 'users' && renderUsers()}
            {activeTab === 'teams' && renderTeams()}
            {activeTab === 'matches' && renderMatches()}
            {activeTab === 'tickets' && renderTickets()}
            {activeTab === 'verifications' && renderVerifications()}
            {activeTab === 'activity' && renderActivity()}
            {activeTab === 'analytics' && renderAnalytics()}
            {activeTab === 'settings' && renderSettings()}
            <View style={styles.bottomSpacer} />
          </ScrollView>
        </SafeAreaView>
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
  revenueCard: { marginTop: 8, marginBottom: 16 },
  revenueHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 },
  revenueTitle: { color: Colors.text.secondary, fontSize: 14, marginBottom: 4 },
  growthBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(16, 185, 129, 0.1)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
  growthText: { color: Colors.status.success, fontSize: 12, fontWeight: '600' as const },
  revenueAmount: { color: Colors.primary.orange, fontSize: 28, fontWeight: '700' as const },
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
  teamInfo: { flex: 1 },
  teamName: { color: Colors.text.primary, fontSize: 15, fontWeight: '500' as const },
  teamMeta: { color: Colors.text.secondary, fontSize: 13, marginTop: 2 },
  teamStatText: { color: Colors.text.muted, fontSize: 12, marginTop: 2 },
  matchItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderTopWidth: 1, borderTopColor: Colors.border.light, gap: 12 },
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
  ticketUser: { color: Colors.text.secondary, fontSize: 13, marginBottom: 4 },
  ticketDesc: { color: Colors.text.muted, fontSize: 13, marginBottom: 4 },
  ticketMeta: { color: Colors.text.muted, fontSize: 11 },
  ticketActions: { flexDirection: 'column', gap: 8 },
  verificationItem: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 12, borderTopWidth: 1, borderTopColor: Colors.border.light, gap: 12 },
  verificationInfo: { flex: 1 },
  verificationHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  verificationName: { color: Colors.text.primary, fontSize: 15, fontWeight: '500' as const },
  verificationEmail: { color: Colors.text.secondary, fontSize: 13, marginBottom: 4 },
  verificationReason: { color: Colors.text.muted, fontSize: 13, marginBottom: 4 },
  verificationActions: { flexDirection: 'column', gap: 8 },
  emptyState: { alignItems: 'center', paddingVertical: 40 },
  emptyText: { color: Colors.text.muted, fontSize: 14, marginTop: 12 },
  activityCard: { marginBottom: 16 },
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
});
