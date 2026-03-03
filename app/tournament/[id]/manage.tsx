import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  StyleSheet, View, Text, ScrollView, TouchableOpacity, Alert,
  ActivityIndicator, ActionSheetIOS, Platform, Modal, TextInput,
  RefreshControl, Dimensions, Keyboard, KeyboardAvoidingView,
} from 'react-native';
import { useRouter, useLocalSearchParams, Stack } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft, Trophy, Pencil, Trash2, Swords, Plus, X, ChevronRight,
  Calendar, MapPin, ListOrdered, Award, Settings, Zap, Users, BarChart3,
  Clock, Target, Shield, TrendingUp, AlertCircle, Check, Play, Hash,
  Search, UserPlus, Phone, User,
} from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { Button } from '@/components/Button';
import { Skeleton } from '@/components/LoadingSkeleton';
import { useAuth } from '@/contexts/AuthContext';
import { useTournaments } from '@/contexts/TournamentsContext';
import { useTeams } from '@/contexts/TeamsContext';
import { useMatches } from '@/contexts/MatchesContext';
import { tournamentsApi } from '@/lib/api/tournaments';
import { matchesApi } from '@/lib/api/matches';
import { notificationsApi } from '@/lib/api/notifications';
import { supabase } from '@/lib/supabase';
import type { Tournament, Match } from '@/types';

const { width: SCREEN_W } = Dimensions.get('window');
const IS_WEB = Platform.OS === 'web';

const ROUND_LABELS = [
  'Poule A', 'Poule B', 'Poule C', 'Poule D',
  'Quart de finale 1', 'Quart de finale 2', 'Quart de finale 3', 'Quart de finale 4',
  'Demi-finale 1', 'Demi-finale 2', 'Finale', 'Petite finale',
  'Tour préliminaire', 'Autre',
];

/* ── Matchmaking helpers ────────────────────────────────────── */

function roundRobinSchedule(teamIds: string[]): { home: string; away: string; journee: number }[] {
  const teams = [...teamIds];
  if (teams.length % 2 !== 0) teams.push('__BYE__');
  const n = teams.length;
  const result: { home: string; away: string; journee: number }[] = [];
  const fixed = teams[0];
  const rotating = teams.slice(1);
  for (let r = 0; r < n - 1; r++) {
    const cur = [fixed, ...rotating];
    for (let i = 0; i < n / 2; i++) {
      const h = cur[i], a = cur[n - 1 - i];
      if (h !== '__BYE__' && a !== '__BYE__') result.push({ home: h, away: a, journee: r + 1 });
    }
    rotating.unshift(rotating.pop()!);
  }
  return result;
}

function knockoutRoundName(matchesInRound: number): string {
  if (matchesInRound === 1) return 'Finale';
  if (matchesInRound === 2) return 'Demi-finale';
  if (matchesInRound === 4) return 'Quart de finale';
  if (matchesInRound === 8) return 'Huitième de finale';
  return `Tour de ${matchesInRound * 2}`;
}

function knockoutLabel(matchesInRound: number, idx: number): string {
  if (matchesInRound === 1) return 'Finale';
  return `${knockoutRoundName(matchesInRound)} ${idx + 1}`;
}

interface BracketSlot { teamId: string | null; bye: boolean }

function bracketSeedOrder(n: number): number[] {
  if (n <= 1) return [0];
  const half = bracketSeedOrder(n / 2);
  const result: number[] = [];
  for (const s of half) { result.push(s); result.push(n - 1 - s); }
  return result;
}

function generateKnockoutBracket(teamIds: string[]) {
  const n = teamIds.length;
  if (n < 2) return [];
  let size = 2;
  while (size < n) size *= 2;

  const order = bracketSeedOrder(size);
  const slots: BracketSlot[] = order.map((seedIdx) =>
    seedIdx < n ? { teamId: teamIds[seedIdx], bye: false } : { teamId: null, bye: true }
  );

  const allMatches: { home: string | null; away: string | null; roundLabel: string }[] = [];
  let cur = slots;
  while (cur.length > 1) {
    const mc = cur.length / 2;
    const next: BracketSlot[] = [];
    for (let i = 0; i < mc; i++) {
      const h = cur[i * 2], a = cur[i * 2 + 1];
      if (h.bye && a.bye) { next.push({ teamId: null, bye: true }); continue; }
      if (a.bye) { next.push({ teamId: h.teamId, bye: false }); continue; }
      if (h.bye) { next.push({ teamId: a.teamId, bye: false }); continue; }
      allMatches.push({ home: h.teamId, away: a.teamId, roundLabel: knockoutLabel(mc, i) });
      next.push({ teamId: null, bye: false });
    }
    cur = next;
  }
  return allMatches;
}

function getKnockoutProgression(label: string): { nextLabel: string; slot: 'home' | 'away' } | null {
  if (label === 'Finale' || label === 'Petite finale') return null;
  const patterns: [RegExp, number][] = [
    [/^Demi-finale (\d+)$/, 2],
    [/^Quart de finale (\d+)$/, 4],
    [/^Huitième de finale (\d+)$/, 8],
    [/^Tour de \d+ (\d+)$/, -1],
  ];
  for (const [re, roundSize] of patterns) {
    const m = label.match(re);
    if (!m) continue;
    const matchNum = parseInt(m[1]);
    const nextRoundSize = roundSize === -1 ? -1 : roundSize / 2;
    const nextMatchNum = Math.ceil(matchNum / 2);
    const slot: 'home' | 'away' = matchNum % 2 === 1 ? 'home' : 'away';
    let nextLabel: string;
    if (nextRoundSize === 1 || (roundSize === 2)) nextLabel = 'Finale';
    else if (nextRoundSize === 2) nextLabel = `Demi-finale ${nextMatchNum}`;
    else if (nextRoundSize === 4) nextLabel = `Quart de finale ${nextMatchNum}`;
    else if (nextRoundSize === 8) nextLabel = `Huitième de finale ${nextMatchNum}`;
    else nextLabel = `${knockoutRoundName(nextRoundSize)} ${nextMatchNum}`;
    return { nextLabel, slot };
  }
  return null;
}

function generateGroupKnockout(teamIds: string[]): { home: string | null; away: string | null; roundLabel: string }[] {
  const n = teamIds.length;
  if (n < 4) return [];

  const numGroups = n <= 6 ? 2 : n <= 8 ? 2 : 4;
  const groups: string[][] = Array.from({ length: numGroups }, () => []);
  const shuffled = [...teamIds].sort(() => Math.random() - 0.5);
  shuffled.forEach((t, i) => groups[i % numGroups].push(t));

  const groupLabels = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
  const all: { home: string | null; away: string | null; roundLabel: string }[] = [];

  groups.forEach((g, gi) => {
    const rr = roundRobinSchedule(g);
    rr.forEach((m) => all.push({ home: m.home, away: m.away, roundLabel: `Poule ${groupLabels[gi]} - J${m.journee}` }));
  });

  const minGroupSize = Math.min(...groups.map((g) => g.length));
  const advancingPerGroup = minGroupSize <= 2 ? 1 : 2;
  const totalAdvancing = numGroups * advancingPerGroup;

  let bracketRoundSize = 1;
  while (bracketRoundSize < totalAdvancing) bracketRoundSize *= 2;
  let mc = bracketRoundSize / 2;
  while (mc >= 1) {
    for (let i = 0; i < mc; i++) all.push({ home: null, away: null, roundLabel: knockoutLabel(mc, i) });
    mc = Math.floor(mc / 2);
  }

  return all;
}

type Tab = 'overview' | 'matches' | 'standings' | 'teams' | 'stats' | 'admin';

const TABS: { key: Tab; label: string; icon: typeof Trophy; adminOnly?: boolean }[] = [
  { key: 'overview', label: 'Vue d\'ensemble', icon: BarChart3 },
  { key: 'matches', label: 'Matchs', icon: Swords },
  { key: 'standings', label: 'Classement', icon: ListOrdered },
  { key: 'teams', label: 'Équipes', icon: Users },
  { key: 'stats', label: 'Statistiques', icon: TrendingUp },
  { key: 'admin', label: 'Gestion', icon: Settings, adminOnly: true },
];

function CreateTournamentMatchForm({
  tournament, getTeamById, onCreate, onCancel, styles: s,
}: {
  tournament: Tournament;
  getTeamById: (id: string) => { name: string } | undefined;
  onCreate: (h: string, a: string, dt: Date, rl?: string) => void;
  onCancel: () => void;
  styles: any;
}) {
  const [homeTeamId, setHomeTeamId] = useState('');
  const [awayTeamId, setAwayTeamId] = useState('');
  const [dateStr, setDateStr] = useState('');
  const [timeStr, setTimeStr] = useState('15:00');
  const [roundLabel, setRoundLabel] = useState('');
  const registered = tournament.registeredTeams ?? [];
  const handleCreate = () => {
    if (!homeTeamId || !awayTeamId || homeTeamId === awayTeamId) {
      Alert.alert('Choisir deux équipes différentes.');
      return;
    }
    const [y, mo, d] = dateStr.split('-').map(Number);
    const [hh, mm] = timeStr.split(':').map(Number);
    const date = new Date(y, (mo ?? 1) - 1, d ?? 1, hh ?? 15, mm ?? 0, 0);
    if (isNaN(date.getTime())) { Alert.alert('Date invalide. Format : AAAA-MM-JJ'); return; }
    onCreate(homeTeamId, awayTeamId, date, roundLabel.trim() || undefined);
  };
  return (
    <View style={s.formWrap}>
      <Text style={s.fieldLabel}>Phase / Groupe</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.chipRow}>
        {ROUND_LABELS.map((l) => (
          <TouchableOpacity key={l} style={[s.chip, roundLabel === l && s.chipActive]} onPress={() => setRoundLabel(l)}>
            <Text style={[s.chipText, roundLabel === l && s.chipTextActive]}>{l}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
      <Text style={[s.fieldLabel, { marginTop: 14 }]}>Équipe domicile</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.chipRow}>
        {registered.map((tid) => (
          <TouchableOpacity key={tid} style={[s.chip, homeTeamId === tid && s.chipActive]} onPress={() => setHomeTeamId(tid)}>
            <Text style={[s.chipText, homeTeamId === tid && s.chipTextActive]}>{getTeamById(tid)?.name ?? tid.slice(0, 8)}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
      <Text style={[s.fieldLabel, { marginTop: 14 }]}>Équipe extérieur</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.chipRow}>
        {registered.filter((t) => t !== homeTeamId).map((tid) => (
          <TouchableOpacity key={tid} style={[s.chip, awayTeamId === tid && s.chipActive]} onPress={() => setAwayTeamId(tid)}>
            <Text style={[s.chipText, awayTeamId === tid && s.chipTextActive]}>{getTeamById(tid)?.name ?? tid.slice(0, 8)}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
      <Text style={[s.fieldLabel, { marginTop: 14 }]}>Date (AAAA-MM-JJ)</Text>
      <TextInput style={s.input} value={dateStr} onChangeText={setDateStr} placeholder="2026-03-15" placeholderTextColor={Colors.text.muted} />
      <Text style={[s.fieldLabel, { marginTop: 10 }]}>Heure</Text>
      <TextInput style={s.input} value={timeStr} onChangeText={setTimeStr} placeholder="15:00" placeholderTextColor={Colors.text.muted} />
      <View style={s.formBtns}>
        <Button title="Annuler" onPress={onCancel} variant="secondary" />
        <Button title="Créer le match" onPress={handleCreate} variant="orange" />
      </View>
    </View>
  );
}

function EditMatchForm({
  match, tournament, getTeamById, venues, onSave, onCancel, saving, styles: s,
}: {
  match: Match; tournament: Tournament;
  getTeamById: (id: string) => { name: string } | undefined;
  venues: { id: string; name: string; city?: string }[];
  onSave: (u: { dateTime: string; venueId?: string; homeTeamId?: string; awayTeamId?: string; roundLabel?: string | null }) => Promise<void>;
  onCancel: () => void; saving?: boolean; styles: any;
}) {
  const d = new Date(match.dateTime);
  const [roundLabel, setRoundLabel] = useState(match.roundLabel ?? '');
  const [dateStr, setDateStr] = useState(d.toISOString().split('T')[0]);
  const [timeStr, setTimeStr] = useState(`${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`);
  const [venueId, setVenueId] = useState(match.venue?.id ?? venues[0]?.id ?? '');
  const [homeTeamId, setHomeTeamId] = useState(match.homeTeamId ?? '');
  const [awayTeamId, setAwayTeamId] = useState(match.awayTeamId ?? '');
  const registered = tournament.registeredTeams ?? [];
  const handleSave = async () => {
    const [y, mo, day] = dateStr.split('-').map(Number);
    const [hh, mm] = timeStr.split(':').map(Number);
    const dt = new Date(y, (mo ?? 1) - 1, day ?? 1, hh ?? 15, mm ?? 0, 0);
    if (isNaN(dt.getTime())) { Alert.alert('Date ou heure invalide.'); return; }
    await onSave({ dateTime: dt.toISOString(), venueId: venueId || undefined, homeTeamId: homeTeamId || undefined, awayTeamId: awayTeamId || undefined, roundLabel: roundLabel.trim() || null });
  };
  return (
    <ScrollView style={s.formWrap} keyboardShouldPersistTaps="handled">
      <Text style={s.fieldLabel}>Phase / Groupe</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.chipRow}>
        {ROUND_LABELS.map((l) => (
          <TouchableOpacity key={l} style={[s.chip, roundLabel === l && s.chipActive]} onPress={() => setRoundLabel(l)}>
            <Text style={[s.chipText, roundLabel === l && s.chipTextActive]}>{l}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
      <Text style={[s.fieldLabel, { marginTop: 14 }]}>Lieu</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.chipRow}>
        {venues.map((v) => (
          <TouchableOpacity key={v.id} style={[s.chip, venueId === v.id && s.chipActive]} onPress={() => setVenueId(v.id)}>
            <Text style={[s.chipText, venueId === v.id && s.chipTextActive]}>{v.name}{v.city ? ` (${v.city})` : ''}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
      <Text style={[s.fieldLabel, { marginTop: 14 }]}>Équipe domicile</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.chipRow}>
        {registered.map((tid) => (
          <TouchableOpacity key={tid} style={[s.chip, homeTeamId === tid && s.chipActive]} onPress={() => setHomeTeamId(tid)}>
            <Text style={[s.chipText, homeTeamId === tid && s.chipTextActive]}>{getTeamById(tid)?.name ?? tid.slice(0, 8)}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
      <Text style={[s.fieldLabel, { marginTop: 14 }]}>Équipe extérieur</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.chipRow}>
        {registered.filter((t) => t !== homeTeamId).map((tid) => (
          <TouchableOpacity key={tid} style={[s.chip, awayTeamId === tid && s.chipActive]} onPress={() => setAwayTeamId(tid)}>
            <Text style={[s.chipText, awayTeamId === tid && s.chipTextActive]}>{getTeamById(tid)?.name ?? tid.slice(0, 8)}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
      <Text style={[s.fieldLabel, { marginTop: 14 }]}>Date (AAAA-MM-JJ)</Text>
      <TextInput style={s.input} value={dateStr} onChangeText={setDateStr} placeholder="2026-03-15" placeholderTextColor={Colors.text.muted} />
      <Text style={[s.fieldLabel, { marginTop: 10 }]}>Heure</Text>
      <TextInput style={s.input} value={timeStr} onChangeText={setTimeStr} placeholder="15:00" placeholderTextColor={Colors.text.muted} />
      <View style={s.formBtns}>
        <Button title="Annuler" onPress={onCancel} variant="secondary" disabled={saving} />
        <Button title={saving ? 'Enregistrement…' : 'Enregistrer'} onPress={handleSave} variant="orange" disabled={saving} />
      </View>
    </ScrollView>
  );
}

function ScoreModal({
  match, teamName, onSave, onClose,
}: {
  match: Match | null;
  teamName: (tid?: string) => string;
  onSave: (matchId: string, home: number, away: number) => Promise<void>;
  onClose: () => void;
}) {
  const [home, setHome] = useState('');
  const [away, setAway] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (match) { setHome(''); setAway(''); } }, [match?.id]);

  const handleSave = async () => {
    if (!match || saving) return;
    const h = parseInt(home, 10);
    const a = parseInt(away, 10);
    if (isNaN(h) || isNaN(a) || h < 0 || a < 0) { Alert.alert('Saisie invalide', 'Entrez des scores ≥ 0.'); return; }
    setSaving(true);
    try { await onSave(match.id, h, a); } finally { setSaving(false); }
  };

  if (!match) return null;
  return (
    <>
      {match.roundLabel && <View style={smSt.roundBadge}><Text style={smSt.roundText}>{match.roundLabel}</Text></View>}
      <ScrollView keyboardShouldPersistTaps="always" bounces={false} showsVerticalScrollIndicator={false}>
        <View style={smSt.wrap}>
          <View style={smSt.team}>
            <View style={smSt.iconWrap}><Shield size={18} color={Colors.primary.orange} /></View>
            <Text style={smSt.label}>Domicile</Text>
            <Text style={smSt.name} numberOfLines={1}>{teamName(match.homeTeamId)}</Text>
            <TextInput style={smSt.input} keyboardType="number-pad" value={home} onChangeText={setHome} placeholder="0" placeholderTextColor={Colors.text.muted} maxLength={2} />
          </View>
          <View style={smSt.center}><Text style={smSt.vs}>–</Text></View>
          <View style={smSt.team}>
            <View style={smSt.iconWrap}><Shield size={18} color={Colors.primary.blue} /></View>
            <Text style={smSt.label}>Extérieur</Text>
            <Text style={smSt.name} numberOfLines={1}>{teamName(match.awayTeamId)}</Text>
            <TextInput style={smSt.input} keyboardType="number-pad" value={away} onChangeText={setAway} placeholder="0" placeholderTextColor={Colors.text.muted} maxLength={2} />
          </View>
        </View>
        <View style={smSt.btns}>
          <TouchableOpacity style={smSt.cancelBtn} onPress={onClose} disabled={saving}><Text style={smSt.cancelText}>Annuler</Text></TouchableOpacity>
          <TouchableOpacity style={[smSt.confirmBtn, saving && { opacity: 0.6 }]} onPress={handleSave} disabled={saving}>
            <Check size={16} color="#fff" /><Text style={smSt.confirmText}>{saving ? 'Enregistrement…' : 'Valider le score'}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </>
  );
}
const smSt = StyleSheet.create({
  roundBadge: { alignSelf: 'center', backgroundColor: Colors.primary.orange + '18', paddingHorizontal: 14, paddingVertical: 4, borderRadius: 10, marginBottom: 12 },
  roundText: { color: Colors.primary.orange, fontSize: 12, fontWeight: '700' },
  wrap: { flexDirection: 'row', alignItems: 'stretch', gap: 10, marginVertical: 8 },
  team: { flex: 1, backgroundColor: Colors.background.card, borderRadius: 16, padding: 16, alignItems: 'center', borderWidth: 1, borderColor: Colors.border.light },
  iconWrap: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.background.cardLight, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  label: { color: Colors.text.muted, fontSize: 10, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  name: { color: '#fff', fontSize: 13, fontWeight: '600', marginBottom: 10, textAlign: 'center' },
  input: { backgroundColor: Colors.background.cardLight, borderRadius: 14, padding: 14, width: 68, textAlign: 'center', color: '#fff', fontSize: 28, fontWeight: '700' },
  center: { justifyContent: 'center', paddingTop: 30 },
  vs: { color: Colors.text.muted, fontSize: 22, fontWeight: '700' },
  btns: { flexDirection: 'row', gap: 12, marginTop: 20 },
  cancelBtn: { flex: 1, backgroundColor: Colors.background.card, borderRadius: 12, paddingVertical: 14, alignItems: 'center', borderWidth: 1, borderColor: Colors.border.light },
  cancelText: { color: Colors.text.secondary, fontSize: 14, fontWeight: '600' },
  confirmBtn: { flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: Colors.primary.orange, borderRadius: 12, paddingVertical: 14 },
  confirmText: { color: '#fff', fontSize: 14, fontWeight: '700' },
});

function ManagerSearchModal({
  visible, tournament, onClose, onAdded, senderName,
}: {
  visible: boolean;
  tournament: Tournament | null;
  onClose: () => void;
  onAdded: () => void;
  senderName: string;
}) {
  const [search, setSearch] = useState('');
  const [searching, setSearching] = useState(false);
  const [adding, setAdding] = useState(false);
  const [suggestions, setSuggestions] = useState<{ id: string; username: string; phone: string }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const { updateTournament, refetchTournaments } = useTournaments();

  useEffect(() => { if (visible) { setSearch(''); setSuggestions([]); setError(null); } }, [visible]);

  // Recherche en temps réel pendant la saisie
  useEffect(() => {
    const searchUsers = async () => {
      if (!tournament || search.trim().length < 2) {
        setSuggestions([]);
        setError(null);
        return;
      }
      
      setSearching(true);
      setError(null);
      const query = search.trim();
      
      try {
        const isPhone = /^[\d+\s()-]{6,}$/.test(query);
        let results: any[] = [];
        
        if (isPhone) {
          const normalized = query.replace(/[\s()-]/g, '');
          const variants = [normalized];
          if (!normalized.startsWith('+') && normalized.length <= 10) variants.push(`+225${normalized}`);
          if (normalized.startsWith('0') && normalized.length <= 10) variants.push(`+225${normalized.slice(1)}`);
          
          for (const v of variants) {
            const { data } = await (supabase.from('users').select('id, username, phone').ilike('phone', `%${v}%`).limit(5) as any);
            if (data && data.length > 0) results.push(...data);
          }
        } else {
          const { data } = await (supabase.from('users').select('id, username, phone').ilike('username', `%${query}%`).limit(5) as any);
          if (data && data.length > 0) results = data;
        }
        
        // Filtrer les résultats pour exclure le créateur et les gestionnaires existants
        const mgrs = tournament.managers ?? [];
        const filtered = results.filter(u => u.id !== tournament.createdBy && !mgrs.includes(u.id));
        
        setSuggestions(filtered);
        if (filtered.length === 0 && results.length > 0) {
          setError('Tous les utilisateurs trouvés sont déjà gestionnaires.');
        }
      } catch (e: unknown) {
        setError((e as Error).message || 'Erreur lors de la recherche.');
      } finally {
        setSearching(false);
      }
    };

    const timer = setTimeout(searchUsers, 300); // Debounce de 300ms
    return () => clearTimeout(timer);
  }, [search, tournament]);

  const doAdd = useCallback(async (userId: string, username: string) => {
    if (!tournament || adding) return;
    setAdding(true);
    try {
      const mgrs = tournament.managers ?? [];
      await updateTournament({ tournamentId: tournament.id, updates: { managers: [...mgrs, userId] } as any });
      await refetchTournaments();
      try {
        await notificationsApi.send(userId, {
          type: 'tournament',
          title: 'Nouveau rôle de gestionnaire',
          message: `${senderName} vous a donné la permission de gérer le tournoi "${tournament.name}".`,
          data: { route: `/tournament/${tournament.id}/manage` },
        });
      } catch (_) {}
      Alert.alert('Gestionnaire ajouté', `${username} peut maintenant gérer ce tournoi.`);
      onAdded();
      onClose();
    } catch (e: unknown) { Alert.alert('Erreur', (e as Error).message); }
    finally { setAdding(false); }
  }, [tournament, adding, updateTournament, refetchTournaments, onAdded, onClose, senderName]);

  return (
    <Modal visible={visible} animationType="slide" transparent statusBarTranslucent>
      <View style={mgrSt.overlay}>
        {!IS_WEB && <TouchableOpacity style={mgrSt.dismiss} activeOpacity={1} onPress={() => { Keyboard.dismiss(); }} />}
        <ScrollView 
          style={mgrSt.content}
          contentContainerStyle={{ flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={mgrSt.header}>
            <Text style={mgrSt.title}>Ajouter un gestionnaire</Text>
            <TouchableOpacity onPress={onClose} style={mgrSt.closeBtn}><X size={22} color="#fff" /></TouchableOpacity>
          </View>
          <Text style={mgrSt.hint}>Tapez au moins 2 caractères pour voir les suggestions.</Text>
          <View style={mgrSt.searchRow}>
            <View style={mgrSt.searchInputWrap}>
              <Search size={16} color={Colors.text.muted} />
              <TextInput
                style={mgrSt.searchInput}
                placeholder="Nom ou téléphone…"
                placeholderTextColor={Colors.text.muted}
                value={search}
                onChangeText={setSearch}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="done"
                blurOnSubmit={false}
              />
            </View>
            {searching && <ActivityIndicator size="small" color={Colors.primary.orange} />}
          </View>
          {error && (
            <View style={mgrSt.errorCard}>
              <AlertCircle size={16} color={Colors.status.error} />
              <Text style={mgrSt.errorText}>{error}</Text>
            </View>
          )}
          {suggestions.length > 0 && (
            <View style={{ gap: 8 }}>
              {suggestions.map((user) => (
                <View key={user.id} style={mgrSt.resultCard}>
                  <View style={mgrSt.resultIcon}><User size={20} color={Colors.primary.blue} /></View>
                  <View style={{ flex: 1 }}>
                    <Text style={mgrSt.resultName}>{user.username}</Text>
                    <View style={mgrSt.resultPhoneRow}><Phone size={11} color={Colors.text.muted} /><Text style={mgrSt.resultPhone}>{user.phone}</Text></View>
                  </View>
                  <TouchableOpacity style={[mgrSt.addBtn, adding && { opacity: 0.6 }]} onPress={() => doAdd(user.id, user.username)} disabled={adding}>
                    {adding ? <ActivityIndicator size="small" color="#fff" /> : <><UserPlus size={14} color="#fff" /><Text style={mgrSt.addText}>Ajouter</Text></>}
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}
          {!searching && suggestions.length === 0 && search.trim().length >= 2 && !error && (
            <View style={mgrSt.empty}><Users size={36} color={Colors.text.muted} /><Text style={mgrSt.emptyText}>Aucun utilisateur trouvé</Text></View>
          )}
          {search.trim().length < 2 && (
            <View style={mgrSt.empty}><Users size={36} color={Colors.text.muted} /><Text style={mgrSt.emptyText}>Entrez au moins 2 caractères pour rechercher</Text></View>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}
const mgrSt = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'flex-start', paddingTop: 20, paddingHorizontal: 20 },
  dismiss: { flex: 1 },
  content: { position: 'absolute', top: 20, left: 20, right: 20, backgroundColor: Colors.background.dark, borderRadius: 24, padding: 20, maxHeight: '80%' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: Colors.border.light },
  title: { color: '#fff', fontSize: 18, fontWeight: '700' },
  closeBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.background.card, alignItems: 'center', justifyContent: 'center' },
  hint: { color: Colors.text.muted, fontSize: 13, marginBottom: 16 },
  searchRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  searchInputWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.background.card, borderRadius: 12, paddingHorizontal: 14, borderWidth: 1, borderColor: Colors.border.light },
  searchInput: { flex: 1, color: '#fff', fontSize: 14, paddingVertical: 12 },
  searchBtn: { width: 48, height: 48, borderRadius: 12, backgroundColor: Colors.primary.blue, alignItems: 'center', justifyContent: 'center' },
  errorCard: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: Colors.status.error + '15', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: Colors.status.error + '30' },
  errorText: { color: Colors.status.error, fontSize: 13, flex: 1 },
  resultCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: Colors.status.success + '10', borderRadius: 14, padding: 14, borderWidth: 1.5, borderColor: Colors.status.success + '30' },
  resultIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.primary.blue + '20', alignItems: 'center', justifyContent: 'center' },
  resultName: { color: '#fff', fontSize: 15, fontWeight: '700' },
  resultPhoneRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
  resultPhone: { color: Colors.text.muted, fontSize: 12 },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: Colors.status.success, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10 },
  addText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  empty: { alignItems: 'center', paddingVertical: 30, gap: 10 },
  emptyText: { color: Colors.text.muted, fontSize: 13, textAlign: 'center', paddingHorizontal: 20 },
});

function ManagersList({ managers, creatorId, onRemove }: { managers: string[]; creatorId: string; onRemove: (uid: string, name: string) => void }) {
  const managersQuery = useQuery({
    queryKey: ['managers', managers.join(',')],
    queryFn: async () => {
      if (managers.length === 0) return [];
      const { data, error } = await (supabase
        .from('users')
        .select('id, username, phone')
        .in('id', managers) as any);
      if (error) return [];
      return (data as { id: string; username: string; phone: string }[]) || [];
    },
    enabled: managers.length > 0,
  });
  const list = managersQuery.data ?? [];

  if (managers.length === 0) {
    return <Text style={{ color: Colors.text.muted, fontSize: 13, fontStyle: 'italic' }}>Aucun gestionnaire ajouté.</Text>;
  }

  return (
    <View>
      {list.map((m) => (
        <View key={m.id} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.border.light }}>
          <View>
            <Text style={{ color: Colors.text.primary, fontSize: 14, fontWeight: '600' }}>{m.username}</Text>
            <Text style={{ color: Colors.text.muted, fontSize: 12 }}>{m.phone}</Text>
          </View>
          <TouchableOpacity onPress={() => onRemove(m.id, m.username)} style={{ padding: 6 }}>
            <X size={16} color={Colors.status.error} />
          </TouchableOpacity>
        </View>
      ))}
    </View>
  );
}

export default function ManageTournamentScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user, isAdmin } = useAuth();
  const { getTournamentById, updateTournament, deleteTournament, refetchTournaments, addMatchToTournament, setTournamentWinner, removeMatchFromTournament } = useTournaments();
  const { getTeamById } = useTeams();
  const { createMatch, updateMatchScore, venues } = useMatches();

  const fromContext = getTournamentById(id || '');
  const [fetchedTournament, setFetchedTournament] = useState<Tournament | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [refreshing, setRefreshing] = useState(false);

  const [showCreateMatchModal, setShowCreateMatchModal] = useState(false);
  const [showScoreModal, setShowScoreModal] = useState<Match | null>(null);
  const [showWinnerModal, setShowWinnerModal] = useState(false);
  const [editMatchModal, setEditMatchModal] = useState<Match | null>(null);
  const [showAdvanceRoundModal, setShowAdvanceRoundModal] = useState(false);
  const [confirmedRounds, setConfirmedRounds] = useState<Set<string>>(new Set());

  const [isMatchmaking, setIsMatchmaking] = useState(false);
  const [isRemovingMatch, setIsRemovingMatch] = useState(false);
  const [isSettingWinner, setIsSettingWinner] = useState(false);
  const [isSavingMatch, setIsSavingMatch] = useState(false);
  const [matchRoundFilter, setMatchRoundFilter] = useState<string | null>(null);
  const [showManagerModal, setShowManagerModal] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  // Auto-refresh pour garder le tracking à jour en temps réel
  useEffect(() => {
    if (!id) return;
    const interval = setInterval(() => {
      refetchTournaments();
      setLastUpdate(new Date());
    }, 30000); // Refresh toutes les 30 secondes
    return () => clearInterval(interval);
  }, [id, refetchTournaments]);

  useEffect(() => {
    if (id && !fromContext) {
      setLoading(true);
      tournamentsApi.getById(id).then(setFetchedTournament).catch(() => setFetchedTournament(null)).finally(() => setLoading(false));
    } else { setFetchedTournament(null); }
  }, [id, fromContext]);

  const tournament = fromContext ?? fetchedTournament;
  const canManage = !!(user && tournament && (
    tournament.createdBy === user.id
    || isAdmin
    || (tournament.managers ?? []).includes(user.id)
  ));
  const canView = !!tournament;

  const goBack = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/tournaments' as any);
    }
  }, [router]);

  const tournamentMatchesQuery = useQuery({
    queryKey: ['tournament-matches', id],
    queryFn: () => tournamentsApi.getMatches(id || ''),
    enabled: !!id && !!tournament,
  });
  const tournamentMatches: Match[] = tournamentMatchesQuery.data ?? [];

  const safeDate = useCallback((d: any): Date => {
    if (d instanceof Date && !isNaN(d.getTime())) return d;
    if (typeof d === 'string' || typeof d === 'number') { const p = new Date(d); if (!isNaN(p.getTime())) return p; }
    return new Date();
  }, []);

  const teamName = useCallback((tid?: string) => {
    if (!tid) return 'TBD';
    return getTeamById(tid)?.name ?? tid.slice(0, 8);
  }, [getTeamById]);

  const matchesSorted = useMemo(() =>
    [...tournamentMatches].sort((a, b) => safeDate(a.dateTime).getTime() - safeDate(b.dateTime).getTime()),
    [tournamentMatches, safeDate]);

  const completedMatches = useMemo(() =>
    matchesSorted.filter((m) => m.status === 'completed' && m.score != null),
    [matchesSorted]);

  const pendingMatches = useMemo(() =>
    matchesSorted.filter((m) => m.status !== 'completed' || m.score == null),
    [matchesSorted]);

  const nextMatch = useMemo(() => {
    const now = Date.now();
    return pendingMatches.find((m) => safeDate(m.dateTime).getTime() >= now) ?? pendingMatches[0];
  }, [pendingMatches, safeDate]);

  const matchProgress = useMemo(() => ({
    completed: completedMatches.length,
    total: tournamentMatches.length,
    pending: pendingMatches.length,
    pct: tournamentMatches.length > 0 ? Math.round((completedMatches.length / tournamentMatches.length) * 100) : 0,
  }), [completedMatches, pendingMatches, tournamentMatches]);

  const roundLabels = useMemo(() => {
    const set = new Set<string>();
    tournamentMatches.forEach((m) => { if (m.roundLabel) set.add(m.roundLabel); });
    return Array.from(set);
  }, [tournamentMatches]);

  const currentPhase = useMemo(() => {
    if (tournamentMatches.length === 0) return null;
    for (const rl of roundLabels) {
      const rm = tournamentMatches.filter((m) => m.roundLabel === rl);
      const done = rm.filter((m) => m.status === 'completed' && m.score).length;
      if (done < rm.length) return { label: rl, done, total: rm.length, pct: Math.round((done / rm.length) * 100) };
    }
    return { label: roundLabels[roundLabels.length - 1] ?? '', done: 0, total: 0, pct: 100 };
  }, [roundLabels, tournamentMatches]);

  const bracketRounds = useMemo(() => {
    if (tournament?.type !== 'knockout' && tournament?.type !== 'group_knockout') return [];
    const knockoutLabels = ['Huitième de finale', 'Quart de finale', 'Demi-finale', 'Finale'];
    const rounds: { name: string; matches: Match[] }[] = [];
    for (const prefix of knockoutLabels) {
      const rm = tournamentMatches.filter((m) => m.roundLabel === prefix || m.roundLabel?.startsWith(prefix + ' '));
      if (rm.length > 0) rounds.push({ name: prefix, matches: rm });
    }
    return rounds;
  }, [tournament?.type, tournamentMatches]);

  const groupStandings = useMemo(() => {
    if (tournament?.type !== 'group_knockout') return {};
    const groups: Record<string, typeof standings> = {};
    const groupMatches = completedMatches.filter((m) => m.roundLabel?.startsWith('Poule '));
    const groupMap: Record<string, Set<string>> = {};
    groupMatches.forEach((m) => {
      const gName = m.roundLabel?.replace(/ - J\d+$/, '') ?? '';
      if (!groupMap[gName]) groupMap[gName] = new Set();
      if (m.homeTeamId) groupMap[gName].add(m.homeTeamId);
      if (m.awayTeamId) groupMap[gName].add(m.awayTeamId);
    });
    tournamentMatches.filter((m) => m.roundLabel?.startsWith('Poule ')).forEach((m) => {
      const gName = m.roundLabel?.replace(/ - J\d+$/, '') ?? '';
      if (!groupMap[gName]) groupMap[gName] = new Set();
      if (m.homeTeamId) groupMap[gName].add(m.homeTeamId);
      if (m.awayTeamId) groupMap[gName].add(m.awayTeamId);
    });
    for (const [gName, teamSet] of Object.entries(groupMap)) {
      const gm = groupMatches.filter((m) => m.roundLabel?.startsWith(gName));
      const map: Record<string, { teamId: string; played: number; wins: number; draws: number; losses: number; gf: number; ga: number }> = {};
      teamSet.forEach((tid) => { map[tid] = { teamId: tid, played: 0, wins: 0, draws: 0, losses: 0, gf: 0, ga: 0 }; });
      gm.forEach((m) => {
        const h = m.homeTeamId ?? '', a = m.awayTeamId ?? '';
        if (!m.score) return;
        const sh = m.score.home, sa = m.score.away;
        if (h && map[h]) { map[h].played++; map[h].gf += sh; map[h].ga += sa; if (sh > sa) map[h].wins++; else if (sh < sa) map[h].losses++; else map[h].draws++; }
        if (a && map[a]) { map[a].played++; map[a].gf += sa; map[a].ga += sh; if (sa > sh) map[a].wins++; else if (sa < sh) map[a].losses++; else map[a].draws++; }
      });
      groups[gName] = Object.values(map)
        .map((s) => ({ ...s, pts: s.wins * 3 + s.draws, diff: s.gf - s.ga, form: [] as string[] }))
        .sort((a, b) => b.pts - a.pts || b.diff - a.diff || b.gf - a.gf);
    }
    return groups;
  }, [tournament?.type, tournamentMatches, completedMatches]);

  const teamScoringRanking = useMemo(() => {
    const map: Record<string, { teamId: string; scored: number; conceded: number }> = {};
    completedMatches.forEach((m) => {
      const sh = m.score!.home, sa = m.score!.away;
      if (m.homeTeamId) { if (!map[m.homeTeamId]) map[m.homeTeamId] = { teamId: m.homeTeamId, scored: 0, conceded: 0 }; map[m.homeTeamId].scored += sh; map[m.homeTeamId].conceded += sa; }
      if (m.awayTeamId) { if (!map[m.awayTeamId]) map[m.awayTeamId] = { teamId: m.awayTeamId, scored: 0, conceded: 0 }; map[m.awayTeamId].scored += sa; map[m.awayTeamId].conceded += sh; }
    });
    return Object.values(map).sort((a, b) => b.scored - a.scored);
  }, [completedMatches]);

  const recentActivity = useMemo(() => {
    return completedMatches.slice(-5).reverse().map((m) => {
      const h = teamName(m.homeTeamId), a = teamName(m.awayTeamId);
      const sh = m.score!.home, sa = m.score!.away;
      const winnerId = sh > sa ? m.homeTeamId : sh < sa ? m.awayTeamId : null;
      return { matchId: m.id, home: h, away: a, scoreHome: sh, scoreAway: sa, winnerId, winnerName: winnerId ? teamName(winnerId) : null, roundLabel: m.roundLabel, date: safeDate(m.dateTime) };
    });
  }, [completedMatches, teamName, safeDate]);

  const filteredMatches = useMemo(() => {
    if (!matchRoundFilter) return matchesSorted;
    // Filter by round prefix to show all matches of the same round type
    // e.g., if filter is "Tour de 64 1", show all "Tour de 64 X" matches
    const filterPrefix = matchRoundFilter.replace(/ \d+$/, ''); // Remove trailing number
    return matchesSorted.filter((m) => m.roundLabel?.startsWith(filterPrefix));
  }, [matchesSorted, matchRoundFilter]);

  const registeredTeamIds = tournament?.registeredTeams ?? [];

  const standings = useMemo(() => {
    const map: Record<string, { teamId: string; played: number; wins: number; draws: number; losses: number; gf: number; ga: number; form: string[] }> = {};
    registeredTeamIds.forEach((tid) => {
      if (tid) map[tid] = { teamId: tid, played: 0, wins: 0, draws: 0, losses: 0, gf: 0, ga: 0, form: [] };
    });
    completedMatches.forEach((m) => {
      const home = m.homeTeamId ?? '';
      const away = m.awayTeamId ?? '';
      const sh = m.score!.home;
      const sa = m.score!.away;
      if (home && !map[home]) map[home] = { teamId: home, played: 0, wins: 0, draws: 0, losses: 0, gf: 0, ga: 0, form: [] };
      if (away && !map[away]) map[away] = { teamId: away, played: 0, wins: 0, draws: 0, losses: 0, gf: 0, ga: 0, form: [] };
      if (home) {
        map[home].played++; map[home].gf += sh; map[home].ga += sa;
        if (sh > sa) { map[home].wins++; map[home].form.push('W'); }
        else if (sh < sa) { map[home].losses++; map[home].form.push('L'); }
        else { map[home].draws++; map[home].form.push('D'); }
      }
      if (away) {
        map[away].played++; map[away].gf += sa; map[away].ga += sh;
        if (sa > sh) { map[away].wins++; map[away].form.push('W'); }
        else if (sa < sh) { map[away].losses++; map[away].form.push('L'); }
        else { map[away].draws++; map[away].form.push('D'); }
      }
    });
    return Object.values(map)
      .map((s) => ({ ...s, pts: s.wins * 3 + s.draws, diff: s.gf - s.ga, form: s.form.slice(-5) }))
      .sort((a, b) => b.pts - a.pts || b.diff - a.diff || b.gf - a.gf);
  }, [registeredTeamIds, completedMatches]);

  const tournamentStats = useMemo(() => {
    let totalGoals = 0;
    let biggestWinMargin = 0;
    let biggestWinMatch: Match | null = null;
    let highestScoringMatch: Match | null = null;
    let highestScoringTotal = 0;
    let cleanSheets = 0;
    const scorerMap: Record<string, number> = {};

    completedMatches.forEach((m) => {
      const sh = m.score!.home;
      const sa = m.score!.away;
      totalGoals += sh + sa;
      
      // Clean sheets
      if (sh === 0 || sa === 0) cleanSheets++;
      
      // Buts par équipe
      if (m.homeTeamId) scorerMap[m.homeTeamId] = (scorerMap[m.homeTeamId] || 0) + sh;
      if (m.awayTeamId) scorerMap[m.awayTeamId] = (scorerMap[m.awayTeamId] || 0) + sa;
      
      // Plus large victoire
      const margin = Math.abs(sh - sa);
      if (margin > biggestWinMargin) {
        biggestWinMargin = margin;
        biggestWinMatch = m;
      }
      
      // Match le plus prolifique
      const total = sh + sa;
      if (total > highestScoringTotal) {
        highestScoringTotal = total;
        highestScoringMatch = m;
      }
    });

    const drawCount = completedMatches.filter(m => m.score!.home === m.score!.away).length;
    const decisiveCount = completedMatches.length - drawCount;
    
    let topScoringTeamId: string | null = null;
    let topScoringTeamGoals = 0;
    Object.entries(scorerMap).forEach(([tid, g]) => {
      if (g > topScoringTeamGoals) {
        topScoringTeamGoals = g;
        topScoringTeamId = tid;
      }
    });

    const avgGoals = completedMatches.length > 0 ? (totalGoals / completedMatches.length).toFixed(1) : '0.0';
    
    // Tendance de progression (matchs complétés dans les dernières 24h)
    const now = Date.now();
    const recentActivity = completedMatches.filter(m => {
      const matchDate = new Date(m.dateTime).getTime();
      return now - matchDate < 24 * 60 * 60 * 1000;
    }).length;

    return {
      totalGoals,
      avgGoals,
      biggestWinMargin,
      biggestWinMatch,
      highestScoringMatch,
      highestScoringTotal,
      cleanSheets,
      drawCount,
      decisiveCount,
      topScoringTeamId,
      topScoringTeamGoals,
      recentActivity,
      completionRate: matchProgress.total > 0 ? ((matchProgress.completed / matchProgress.total) * 100).toFixed(1) : '0'
    };
  }, [completedMatches, matchProgress]);

  const teamStats = useMemo(() => {
    return registeredTeamIds.map((tid) => {
      const row = standings.find((s) => s.teamId === tid);
      const rank = standings.findIndex((s) => s.teamId === tid) + 1;
      return { rank, ...(row ?? { teamId: tid, played: 0, wins: 0, draws: 0, losses: 0, gf: 0, ga: 0, pts: 0, diff: 0, form: [] }) };
    }).sort((a, b) => a.rank - b.rank);
  }, [registeredTeamIds, standings]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refetchTournaments();
      await tournamentMatchesQuery.refetch();
      if (id) tournamentsApi.getById(id).then(setFetchedTournament).catch(() => {});
    } finally { setRefreshing(false); }
  }, [id, refetchTournaments, tournamentMatchesQuery]);

  useFocusEffect(useCallback(() => {
    if (tournament) {
      refetchTournaments();
      tournamentMatchesQuery.refetch();
      if (id) tournamentsApi.getById(id).then(setFetchedTournament).catch(() => {});
    }
  }, [id, tournament?.id]));

  const getVenueId = useCallback(() => {
    const vid = tournament?.venue?.id;
    if (vid && /^[0-9a-f-]{36}$/i.test(vid)) return vid;
    return venues?.[0]?.id ?? '';
  }, [tournament?.venue?.id, venues]);

  const refetchAll = useCallback(async () => {
    await tournamentMatchesQuery.refetch();
    await refetchTournaments();
    if (id) tournamentsApi.getById(id).then(setFetchedTournament).catch(() => {});
  }, [tournamentMatchesQuery, refetchTournaments, id]);

  const handleAutoMatchmaking = useCallback(async () => {
    if (!user || !tournament) return;
    const teams = [...(tournament.registeredTeams ?? [])];
    if (teams.length < 2) { Alert.alert('Pas assez d\'équipes', 'Inscrivez au moins 2 équipes.'); return; }
    if (tournamentMatches.length > 0) { Alert.alert('Matchs existants', 'Supprimez d\'abord les matchs existants avant de régénérer.'); return; }
    const venueId = getVenueId();
    const venue = venues?.find((v) => v.id === venueId) ?? venues?.[0];
    if (!venue?.id) { Alert.alert('Lieu manquant'); return; }

    const tType = tournament.type;
    const typeLabel = tType === 'league' ? 'Championnat (tous contre tous)' : tType === 'knockout' ? 'Élimination directe (bracket)' : 'Poules + Élimination directe';
    const shuffled = [...teams].sort(() => Math.random() - 0.5);

    let planned: { home: string | null; away: string | null; roundLabel: string }[] = [];
    if (tType === 'league') {
      const rr = roundRobinSchedule(shuffled);
      planned = rr.map((m) => ({ home: m.home, away: m.away, roundLabel: `Journée ${m.journee}` }));
    } else if (tType === 'knockout') {
      planned = generateKnockoutBracket(shuffled);
    } else {
      planned = generateGroupKnockout(shuffled);
    }

    if (planned.length === 0) { Alert.alert('Pas assez d\'équipes pour ce format.'); return; }

    const realMatches = planned.filter((m) => m.home && m.away);
    const placeholderMatches = planned.filter((m) => !m.home || !m.away);
    const totalCount = planned.length;

    Alert.alert(
      'Matchmaking automatique',
      `${typeLabel}\n\n${teams.length} équipes → ${totalCount} match(s)\n${realMatches.length} match(s) programmés immédiatement${placeholderMatches.length > 0 ? `\n${placeholderMatches.length} match(s) en attente (phases suivantes)` : ''}`,
      [{ text: 'Annuler', style: 'cancel' }, { text: 'Générer', onPress: async () => {
        setIsMatchmaking(true);
        try {
          const baseDate = tournament.startDate ? new Date(tournament.startDate) : new Date();
          baseDate.setDate(baseDate.getDate() + 1);
          baseDate.setHours(10, 0, 0, 0);

          let dayOffset = 0;
          let slotInDay = 0;
          let lastRoundLabel = '';

          for (let i = 0; i < planned.length; i++) {
            const p = planned[i];
            if (p.roundLabel !== lastRoundLabel) {
              if (lastRoundLabel) { dayOffset++; slotInDay = 0; }
              lastRoundLabel = p.roundLabel;
            }
            const matchDate = new Date(baseDate);
            matchDate.setDate(matchDate.getDate() + dayOffset + Math.floor(slotInDay / 4));
            matchDate.setHours(10 + (slotInDay % 4) * 2, 0, 0, 0);
            slotInDay++;

            const m = await createMatch({
              sport: tournament.sport, format: tournament.format, type: 'tournament', venue,
              dateTime: matchDate, duration: 90, level: tournament.level, ambiance: 'competitive',
              maxPlayers: 22, createdBy: user.id,
              homeTeamId: p.home ?? undefined, awayTeamId: p.away ?? undefined,
              tournamentId: tournament.id, roundLabel: p.roundLabel, needsPlayers: false,
            });
            await addMatchToTournament({ tournamentId: tournament.id, matchId: m.id });
          }
          await refetchAll();
          Alert.alert('Succès', `${totalCount} match(s) créé(s) pour le ${typeLabel.toLowerCase()}.`);
          setActiveTab('matches');
        } catch (e: unknown) { Alert.alert('Erreur', (e as Error).message); }
        finally { setIsMatchmaking(false); }
      }}],
    );
  }, [user, tournament, tournamentMatches.length, getVenueId, venues, createMatch, addMatchToTournament, refetchAll]);

  const doCreateMatch = useCallback(async (homeTeamId: string, awayTeamId: string, dateTime: Date, roundLabel?: string) => {
    if (!user || !tournament) return;
    const venue = venues?.find((v) => v.id === getVenueId()) ?? venues?.[0];
    if (!venue?.id) return;
    setIsSavingMatch(true);
    try {
      const m = await createMatch({ sport: tournament.sport, format: tournament.format, type: 'tournament', venue, dateTime, duration: 90, level: tournament.level, ambiance: 'competitive', maxPlayers: 22, createdBy: user.id, homeTeamId, awayTeamId, tournamentId: tournament.id, roundLabel: roundLabel || undefined, needsPlayers: false });
      await addMatchToTournament({ tournamentId: tournament.id, matchId: m.id });
      await refetchAll();
      setShowCreateMatchModal(false);
      Alert.alert('Succès', 'Match ajouté.');
    } catch (e: unknown) { Alert.alert('Erreur', (e as Error).message); }
    finally { setIsSavingMatch(false); }
  }, [user, tournament, getVenueId, venues, createMatch, addMatchToTournament, refetchAll]);

  const handleCreateMatch = useCallback(async (h: string, a: string, dt: Date, rl?: string) => {
    if (!user || !tournament) return;
    if (dt.getTime() < Date.now() - 60000) {
      Alert.alert('Date passée', 'La date du match est dans le passé. Créer quand même ?', [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Créer', onPress: () => doCreateMatch(h, a, dt, rl) },
      ]);
      return;
    }
    await doCreateMatch(h, a, dt, rl);
  }, [user, tournament, doCreateMatch]);

  const handleSaveScore = useCallback(async (matchId: string, homeScore: number, awayScore: number) => {
    const match = tournamentMatches.find((m) => m.id === matchId);
    
    // Check if the round is already confirmed
    if (match?.roundLabel && confirmedRounds.has(match.roundLabel)) {
      Alert.alert(
        'Scores confirmés',
        'Les scores de ce tour ont déjà été confirmés. Voulez-vous vraiment modifier ce score ?',
        [
          { text: 'Annuler', style: 'cancel' },
          { text: 'Modifier quand même', onPress: async () => {
            // Remove confirmation for this round
            setConfirmedRounds(prev => {
              const newSet = new Set(prev);
              newSet.delete(match.roundLabel!);
              return newSet;
            });
            await performScoreSave(matchId, homeScore, awayScore);
          }}
        ]
      );
      return;
    }
    
    await performScoreSave(matchId, homeScore, awayScore);
  }, [tournamentMatches, confirmedRounds]);

  const performScoreSave = useCallback(async (matchId: string, homeScore: number, awayScore: number) => {
    await updateMatchScore({ matchId, homeScore, awayScore });

    if (tournament?.type === 'knockout' || tournament?.type === 'group_knockout') {
      const match = tournamentMatches.find((m) => m.id === matchId);
      if (match?.roundLabel && homeScore !== awayScore) {
        const progression = getKnockoutProgression(match.roundLabel);
        if (progression) {
          const winnerId = homeScore > awayScore ? match.homeTeamId : match.awayTeamId;
          if (winnerId) {
            const nextMatch = tournamentMatches.find((m) => m.roundLabel === progression.nextLabel);
            if (nextMatch) {
              const update: Record<string, string | null> = {};
              if (progression.slot === 'home') update.homeTeamId = winnerId;
              else update.awayTeamId = winnerId;
              try {
                await matchesApi.updateMatch(nextMatch.id, update as any);
              } catch (_) {}
            }
          }
        }
        
        // Check if this is the final match - if so, complete the tournament
        if (match.roundLabel === 'Finale' && homeScore !== awayScore) {
          const winnerId = homeScore > awayScore ? match.homeTeamId : match.awayTeamId;
          if (winnerId && tournament) {
            try {
              await updateTournament({
                tournamentId: tournament.id,
                updates: {
                  status: 'completed',
                  winnerId: winnerId
                }
              });
              Alert.alert(
                'Tournoi terminé ! 🏆',
                `Félicitations à ${teamName(winnerId)} pour leur victoire !`,
                [{ text: 'OK' }]
              );
            } catch (err) {
              console.error('Error completing tournament:', err);
            }
          }
        }
      }
    }

    await refetchAll();
    setShowScoreModal(null);
    const winnerLabel = homeScore > awayScore ? 'Domicile' : homeScore < awayScore ? 'Extérieur' : 'Match nul';
    Alert.alert('Score enregistré', `${homeScore} - ${awayScore} (${winnerLabel})`);
  }, [updateMatchScore, refetchAll, tournament, tournamentMatches, updateTournament, teamName]);

  // Check if all matches in a round have scores
  const getRoundMatches = useCallback((roundLabel: string) => {
    return tournamentMatches.filter(m => m.roundLabel === roundLabel);
  }, [tournamentMatches]);

  const isRoundComplete = useCallback((roundLabel: string) => {
    const roundMatches = getRoundMatches(roundLabel);
    return roundMatches.length > 0 && roundMatches.every(m => 
      m.status === 'completed' && m.score != null
    );
  }, [getRoundMatches]);

  // Check if all scores are entered for a round (but not necessarily confirmed)
  const areAllScoresEntered = useCallback((roundLabel: string) => {
    const roundMatches = getRoundMatches(roundLabel);
    return roundMatches.length > 0 && roundMatches.every(m => 
      m.status === 'completed' && m.score != null
    );
  }, [getRoundMatches]);

  // Check if a round is confirmed
  const isRoundConfirmed = useCallback((roundLabel: string) => {
    return confirmedRounds.has(roundLabel);
  }, [confirmedRounds]);

  const getCurrentRound = useCallback(() => {
    if (!tournament) return null;
    
    // Get all unique round prefixes (without numbers)
    const roundLabels = [...new Set(tournamentMatches.map(m => m.roundLabel).filter((label): label is string => Boolean(label)))];
    
    if (roundLabels.length === 0) return null;
    
    // Group by round prefix
    const roundPrefixes = [
      'Tour de 64', 'Tour de 32', 'Huitième', 'Quart', 'Demi', 'Finale',
      'Journée', 'Poule'
    ];
    
    // Find unique round types
    const uniqueRounds: string[] = [];
    roundPrefixes.forEach(prefix => {
      const hasRound = roundLabels.some(label => label.startsWith(prefix));
      if (hasRound) {
        // Get the first label with this prefix
        const firstLabel = roundLabels.find(label => label.startsWith(prefix));
        if (firstLabel) uniqueRounds.push(firstLabel);
      }
    });
    
    // Find the first incomplete round (check all matches with same prefix)
    for (const roundLabel of uniqueRounds) {
      const prefix = roundLabel.replace(/ \d+$/, ''); // Remove trailing number
      const roundMatches = tournamentMatches.filter(m => m.roundLabel?.startsWith(prefix));
      const allComplete = roundMatches.every(m => m.status === 'completed' && m.score);
      
      if (!allComplete) {
        return roundLabel; // Return first label of this round type
      }
    }
    
    // If all rounds are complete, return the last one
    return uniqueRounds[uniqueRounds.length - 1] || null;
  }, [tournament, tournamentMatches]);

  const getNextRound = useCallback(() => {
    const currentRound = getCurrentRound();
    if (!currentRound) return null;
    
    // Determine current round prefix
    let currentPrefix = '';
    const roundOrder = [
      { prefix: 'Tour de 64', next: 'Tour de 32' },
      { prefix: 'Tour de 32', next: 'Huitième de finale' },
      { prefix: 'Huitième', next: 'Quart de finale' },
      { prefix: 'Quart', next: 'Demi-finale' },
      { prefix: 'Demi', next: 'Finale' },
      { prefix: 'Finale', next: null }
    ];
    
    for (const { prefix, next } of roundOrder) {
      if (currentRound.startsWith(prefix)) {
        return next;
      }
    }
    
    return null;
  }, [getCurrentRound]);

  // Confirm scores for a round
  const handleConfirmScores = useCallback((roundLabel: string) => {
    if (!areAllScoresEntered(roundLabel)) {
      Alert.alert('Scores incomplets', 'Tous les scores du tour doivent être saisis avant de confirmer.');
      return;
    }
    
    Alert.alert(
      'Confirmer les scores',
      `Voulez-vous confirmer tous les scores du tour "${roundLabel}" ? Cette action verrouillera les scores et permettra de passer au tour suivant.`,
      [
        { text: 'Annuler', style: 'cancel' },
        { 
          text: 'Confirmer', 
          onPress: () => {
            setConfirmedRounds(prev => new Set(prev).add(roundLabel));
            Alert.alert('Scores confirmés', `Les scores du tour "${roundLabel}" sont maintenant confirmés.`);
          }
        }
      ]
    );
  }, [areAllScoresEntered, confirmedRounds]);

  const canAdvanceToNextRound = useCallback(() => {
    const currentRound = getCurrentRound();
    return currentRound && isRoundComplete(currentRound) && isRoundConfirmed(currentRound) && getNextRound();
  }, [getCurrentRound, isRoundComplete, isRoundConfirmed, getNextRound]);

  const canConfirmScores = useCallback(() => {
    const currentRound = getCurrentRound();
    return currentRound && areAllScoresEntered(currentRound) && !isRoundConfirmed(currentRound);
  }, [getCurrentRound, areAllScoresEntered, isRoundConfirmed]);

  // Advance to next round - generate matches with winners
  const handleAdvanceToNextRound = useCallback(async () => {
    if (!tournament || !user) return;
    const currentRound = getCurrentRound();
    const nextRound = getNextRound();
    
    if (!currentRound || !nextRound) {
      Alert.alert('Erreur', 'Impossible de déterminer le tour suivant.');
      return;
    }

    // Get all matches from current round (using prefix to match all "Tour de 32 1", "Tour de 32 2", etc.)
    const currentRoundPrefix = currentRound.replace(/ \d+$/, ''); // Remove trailing number
    const currentRoundMatches = tournamentMatches.filter(m => m.roundLabel?.startsWith(currentRoundPrefix));
    
    // Extract winners
    const winners: string[] = [];
    for (const match of currentRoundMatches) {
      if (!match.score || !match.homeTeamId || !match.awayTeamId) continue;
      
      const winnerId = match.score.home > match.score.away 
        ? match.homeTeamId 
        : match.score.away > match.score.home 
        ? match.awayTeamId 
        : null;
      
      if (winnerId) {
        winners.push(winnerId);
      }
    }

    if (winners.length === 0) {
      Alert.alert('Erreur', 'Aucun vainqueur trouvé dans le tour actuel.');
      return;
    }

    // Check if there are draws
    const hasDraws = currentRoundMatches.some(m => m.score && m.score.home === m.score.away);
    if (hasDraws) {
      Alert.alert(
        'Matchs nuls détectés',
        'Certains matchs se sont terminés par un match nul. Les matchs nuls ne peuvent pas progresser en élimination directe. Veuillez modifier les scores.',
        [{ text: 'OK' }]
      );
      return;
    }

    Alert.alert(
      'Passer au tour suivant',
      `Générer ${Math.floor(winners.length / 2)} match(s) pour le tour "${nextRound}" avec les ${winners.length} vainqueurs du "${currentRound}" ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Générer',
          onPress: async () => {
            setIsMatchmaking(true);
            try {
              // Get venue from tournament or find a valid one
              let venue = tournament.venue;
              
              // If tournament venue is not valid, try to find one from the venues list
              if (!venue?.id || !/^[0-9a-f-]{36}$/i.test(venue.id)) {
                const venueId = getVenueId();
                venue = venues?.find((v) => v.id === venueId) ?? venues?.[0];
              }
              
              // Final validation
              if (!venue?.id || !/^[0-9a-f-]{36}$/i.test(venue.id)) {
                Alert.alert('Erreur', 'Aucun lieu valide disponible. Veuillez configurer un lieu pour le tournoi.');
                setIsMatchmaking(false);
                return;
              }

              // Create matches for next round - all on the same day
              const baseDate = new Date();
              baseDate.setDate(baseDate.getDate() + 3); // 3 days from now
              baseDate.setHours(10, 0, 0, 0);

              const matchesToCreate = Math.floor(winners.length / 2);
              let createdCount = 0;

              for (let i = 0; i < matchesToCreate; i++) {
                const homeTeamId = winners[i * 2];
                const awayTeamId = winners[i * 2 + 1];

                if (!homeTeamId || !awayTeamId) continue;

                // All matches on the same day, with 2-hour intervals
                const matchDate = new Date(baseDate);
                matchDate.setHours(10 + i * 2, 0, 0, 0);

                const roundLabel = knockoutLabel(matchesToCreate, i);

                const m = await createMatch({
                  sport: tournament.sport,
                  format: tournament.format,
                  type: 'tournament',
                  venue,
                  dateTime: matchDate,
                  duration: 90,
                  level: tournament.level,
                  ambiance: 'competitive',
                  maxPlayers: 22,
                  createdBy: user.id,
                  homeTeamId,
                  awayTeamId,
                  tournamentId: tournament.id,
                  roundLabel,
                  needsPlayers: false,
                });

                await addMatchToTournament({ tournamentId: tournament.id, matchId: m.id });
                createdCount++;
              }

              await refetchAll();
              setShowAdvanceRoundModal(false);
              Alert.alert(
                'Tour suivant généré !',
                `${createdCount} match(s) créé(s) pour le tour "${nextRound}".`
              );
            } catch (e: unknown) {
              Alert.alert('Erreur', (e as Error).message);
            } finally {
              setIsMatchmaking(false);
            }
          },
        },
      ]
    );
  }, [tournament, user, getCurrentRound, getNextRound, tournamentMatches, venues, getVenueId, createMatch, addMatchToTournament, refetchAll]);

  const showAdvanceToNextRoundButton = canManage && canAdvanceToNextRound() && tournament?.status !== 'completed';
  const showConfirmScoresButton = canManage && canConfirmScores() && tournament?.status !== 'completed';

  const handleRemoveMatch = useCallback((matchId: string) => {
    if (isRemovingMatch) return;
    Alert.alert('Retirer le match', 'Ce match sera retiré du tournoi.', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Retirer', onPress: async () => {
        setIsRemovingMatch(true);
        try { await removeMatchFromTournament({ tournamentId: tournament!.id, matchId }); await refetchAll(); Alert.alert('Succès', 'Match retiré.'); }
        catch (e: unknown) { Alert.alert('Erreur', (e as Error).message); }
        finally { setIsRemovingMatch(false); }
      }},
    ]);
  }, [tournament, isRemovingMatch, removeMatchFromTournament, refetchAll]);

  const confirmSetWinner = useCallback(async (winnerTeamId: string) => {
    if (!tournament) return;
    setIsSettingWinner(true);
    try {
      await setTournamentWinner({ tournamentId: tournament.id, winnerTeamId });
      await refetchAll();
      setShowWinnerModal(false);
      Alert.alert('Tournoi clôturé', 'Le vainqueur a été enregistré.');
    } catch (e: unknown) { Alert.alert('Erreur', (e as Error).message); }
    finally { setIsSettingWinner(false); }
  }, [tournament, setTournamentWinner, refetchAll]);

  const handleCancelWinner = useCallback(async () => {
    if (!tournament || !tournament.winnerId || isSettingWinner) return;
    Alert.alert(
      'Annuler le vainqueur',
      'Êtes-vous sûr de vouloir annuler la déclaration du vainqueur ? Le tournoi reviendra à l\'état "En cours".',
      [
        { text: 'Non', style: 'cancel' },
        {
          text: 'Oui, annuler',
          style: 'destructive',
          onPress: async () => {
            setIsSettingWinner(true);
            try {
              await updateTournament({
                tournamentId: tournament.id,
                updates: { winnerId: null, status: 'in_progress' } as any,
              });
              await refetchAll();
              Alert.alert('Vainqueur annulé', 'Le tournoi est de nouveau en cours.');
            } catch (e: unknown) {
              Alert.alert('Erreur', (e as Error).message);
            } finally {
              setIsSettingWinner(false);
            }
          },
        },
      ]
    );
  }, [tournament, isSettingWinner, updateTournament, refetchAll]);

  const handleSetWinner = useCallback(async (winnerTeamId: string) => {
    if (!tournament || isSettingWinner) return;
    if (matchProgress.pending > 0) {
      Alert.alert('Matchs non terminés', `Il reste ${matchProgress.pending} match(s) sans score. Déclarer le vainqueur quand même ?`, [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Oui, déclarer', onPress: () => confirmSetWinner(winnerTeamId) },
      ]);
      return;
    }
    await confirmSetWinner(winnerTeamId);
  }, [tournament, isSettingWinner, matchProgress.pending, confirmSetWinner]);

  const handleEditSave = useCallback(async (updates: { dateTime: string; venueId?: string; homeTeamId?: string; awayTeamId?: string; roundLabel?: string | null }) => {
    if (!editMatchModal || isSavingMatch) return;
    setIsSavingMatch(true);
    try {
      await matchesApi.updateMatch(editMatchModal.id, { dateTime: updates.dateTime, venueId: updates.venueId, homeTeamId: updates.homeTeamId ?? undefined, awayTeamId: updates.awayTeamId ?? undefined, roundLabel: updates.roundLabel ?? undefined });
      await refetchAll();
      setEditMatchModal(null);
      Alert.alert('Succès', 'Match mis à jour.');
    } catch (e: unknown) { Alert.alert('Erreur', (e as Error).message); }
    finally { setIsSavingMatch(false); }
  }, [editMatchModal, isSavingMatch, refetchAll]);

  const handleChangeStatus = useCallback(() => {
    const opts: Array<{ label: string; status: Tournament['status'] }> = [
      { label: 'Inscriptions ouvertes', status: 'registration' },
      { label: 'En cours', status: 'in_progress' },
      { label: 'Terminé', status: 'completed' },
    ];
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options: ['Annuler', ...opts.map((o) => o.label)], cancelButtonIndex: 0 },
        (idx) => { if (idx > 0 && opts[idx - 1]) updateTournament({ tournamentId: tournament!.id, updates: { status: opts[idx - 1].status } }).then(() => refetchAll()); },
      );
    } else {
      Alert.alert('Changer le statut', undefined, [
        { text: 'Annuler', style: 'cancel' },
        ...opts.map((o) => ({ text: o.label, onPress: () => updateTournament({ tournamentId: tournament!.id, updates: { status: o.status } }).then(() => refetchAll()) })),
      ]);
    }
  }, [tournament, updateTournament, refetchAll]);

  const handleDelete = useCallback(() => {
    Alert.alert('Supprimer le tournoi', 'Cette action est irréversible.', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Supprimer', style: 'destructive', onPress: async () => {
        try { await deleteTournament({ tournamentId: tournament!.id, userId: user!.id, isAdmin }); Alert.alert('Supprimé', '', [{ text: 'OK', onPress: () => router.replace(`/tournament/${id}` as any) }]); }
        catch (e: unknown) { Alert.alert('Erreur', (e as Error).message); }
      }},
    ]);
  }, [tournament, user, isAdmin, deleteTournament, router, id]);

  const handleManagerAdded = useCallback(async () => {
    await refetchAll();
  }, [refetchAll]);

  const handleRemoveManager = useCallback(async (uid: string, name: string) => {
    if (!tournament) return;
    Alert.alert('Retirer l\'accès', `Retirer ${name} de la gestion ?`, [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Retirer', style: 'destructive', onPress: async () => {
        try {
          const updated = (tournament.managers ?? []).filter(id => id !== uid);
          await updateTournament({ tournamentId: tournament.id, updates: { managers: updated } as any });
          await refetchAll();
        } catch (e: unknown) { Alert.alert('Erreur', (e as Error).message); }
      }},
    ]);
  }, [tournament, updateTournament, refetchAll]);

  const fmtDate = useCallback((d: any) =>
    safeDate(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }),
    [safeDate]);

  const statusLabel = tournament?.status === 'registration' ? 'Inscriptions' : tournament?.status === 'in_progress' ? 'En cours' : 'Terminé';

  if (loading && !tournament) {
    return (
      <><Stack.Screen options={{ headerShown: false }} />
      <View style={st.root}><LinearGradient colors={[Colors.background.dark, '#0D1420']} style={StyleSheet.absoluteFill} />
        <SafeAreaView style={st.safe}>
          <View style={st.fallbackHeader}><TouchableOpacity style={st.backBtn} onPress={goBack}><ArrowLeft size={20} color="#fff" /></TouchableOpacity><Text style={st.headerTitle}>Déroulé du tournoi</Text><View style={{ width: 36 }} /></View>
          <View style={st.center}><ActivityIndicator size="large" color={Colors.primary.orange} /><Text style={st.centerText}>Chargement…</Text></View>
        </SafeAreaView></View></>
    );
  }
  if (!tournament) {
    return (
      <><Stack.Screen options={{ headerShown: false }} />
      <View style={st.root}><LinearGradient colors={[Colors.background.dark, '#0D1420']} style={StyleSheet.absoluteFill} />
        <SafeAreaView style={st.safe}>
          <View style={st.fallbackHeader}><TouchableOpacity style={st.backBtn} onPress={goBack}><ArrowLeft size={20} color="#fff" /></TouchableOpacity><Text style={st.headerTitle}>Déroulé du tournoi</Text><View style={{ width: 36 }} /></View>
          <View style={st.center}><Trophy size={56} color={Colors.text.muted} /><Text style={st.centerText}>Tournoi introuvable</Text><Button title="Retour" onPress={goBack} variant="primary" /></View>
        </SafeAreaView></View></>
    );
  }

  const visibleTabs = TABS.filter((t) => !t.adminOnly || canManage);

  const renderMatchCard = (m: Match, showActions = true) => {
    const done = m.status === 'completed' && m.score != null;
    const isNext = nextMatch?.id === m.id;
    const past = safeDate(m.dateTime) < new Date() && !done;
    const isTBD = !m.homeTeamId || !m.awayTeamId;
    const label = done ? 'Terminé' : isTBD ? 'En attente' : past ? 'À saisir' : 'À venir';
    const statusColor = done ? Colors.status.success : isTBD ? Colors.text.muted : past ? Colors.status.warning : Colors.primary.blue;

    const progression = m.roundLabel ? getKnockoutProgression(m.roundLabel) : null;
    const isKnockout = tournament.type === 'knockout' || tournament.type === 'group_knockout';

    return (
      <TouchableOpacity key={m.id} style={[st.matchCard, isNext && st.matchCardNext, past && !done && !isTBD && st.matchCardAlert, isTBD && st.matchCardTBD]} onPress={() => !isTBD ? router.push(`/match/${m.id}` as any) : undefined} activeOpacity={isTBD ? 1 : 0.8}>
        <View style={st.matchCardTop}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            {m.roundLabel ? <View style={[st.roundBadge, m.roundLabel === 'Finale' && { backgroundColor: '#FFD70030' }]}><Text style={[st.roundBadgeText, m.roundLabel === 'Finale' && { color: '#FFD700' }]}>{m.roundLabel}</Text></View> : null}
          </View>
          <View style={[st.statusBadge, { backgroundColor: statusColor + '18' }]}>
            <View style={[st.statusDotSmall, { backgroundColor: statusColor }]} />
            <Text style={[st.statusBadgeText, { color: statusColor }]}>{label}</Text>
          </View>
        </View>
        <View style={st.matchTeams}>
          <View style={st.matchTeamCol}>
            <Text style={[st.matchTeamName, done && m.score!.home > m.score!.away && st.matchWinnerName, !m.homeTeamId && st.matchTeamTBD]} numberOfLines={1}>{m.homeTeamId ? teamName(m.homeTeamId) : '?'}</Text>
            {done && <Text style={st.matchTeamSub}>Dom.</Text>}
          </View>
          <View style={st.matchScoreCol}>
            {done ? (
              canManage ? (
                <TouchableOpacity style={st.scorePill} onPress={(e) => { e.stopPropagation(); setShowScoreModal(m); }}>
                  <Text style={st.matchScoreText}>{m.score!.home} - {m.score!.away}</Text>
                  <Text style={st.editScoreHint}>Modifier</Text>
                </TouchableOpacity>
              ) : (
                <View style={st.scorePill}><Text style={st.matchScoreText}>{m.score!.home} - {m.score!.away}</Text></View>
              )
            ) : isTBD ? (
              <View style={st.tbdBadge}><Clock size={12} color={Colors.text.muted} /><Text style={st.tbdBadgeText}>TBD</Text></View>
            ) : past ? (
              canManage ? (
                <TouchableOpacity style={st.scoreInputBtn} onPress={(e) => { e.stopPropagation(); setShowScoreModal(m); }}>
                  <Target size={14} color="#fff" /><Text style={st.scoreInputBtnText}>Saisir</Text>
                </TouchableOpacity>
              ) : (
                <View style={st.tbdBadge}>
                  <Clock size={12} color={Colors.status.warning} />
                  <Text style={st.tbdBadgeText}>En attente</Text>
                </View>
              )
            ) : (
              <Text style={st.matchVsText}>VS</Text>
            )}
          </View>
          <View style={[st.matchTeamCol, { alignItems: 'flex-end' }]}>
            <Text style={[st.matchTeamName, done && m.score!.away > m.score!.home && st.matchWinnerName, !m.awayTeamId && st.matchTeamTBD]} numberOfLines={1}>{m.awayTeamId ? teamName(m.awayTeamId) : '?'}</Text>
            {done && <Text style={st.matchTeamSub}>Ext.</Text>}
          </View>
        </View>
        {isKnockout && done && progression && (
          <View style={st.progressionRow}>
            <ChevronRight size={12} color={Colors.primary.orange} />
            <Text style={st.progressionText}>
              Qualifié → {progression.nextLabel}
            </Text>
          </View>
        )}
        <View style={st.matchCardFooter}>
          <View style={st.matchMeta}>
            <View style={st.matchMetaItem}><Calendar size={10} color={Colors.text.muted} /><Text style={st.matchMetaText}>{fmtDate(m.dateTime)}</Text></View>
            {m.venue?.name ? <View style={st.matchMetaItem}><MapPin size={10} color={Colors.text.muted} /><Text style={st.matchMetaText} numberOfLines={1}>{m.venue.name}</Text></View> : null}
          </View>
          {showActions && canManage && tournament.status === 'in_progress' && !isTBD && (
            <View style={st.matchActions}>
              <TouchableOpacity style={st.matchActionIcon} onPress={(e) => { e.stopPropagation(); setEditMatchModal(m); }}><Pencil size={13} color={Colors.primary.blue} /></TouchableOpacity>
              <TouchableOpacity style={st.matchActionIcon} onPress={(e) => { e.stopPropagation(); handleRemoveMatch(m.id); }} disabled={isRemovingMatch}><Trash2 size={13} color={isRemovingMatch ? Colors.text.muted : Colors.status.error} /></TouchableOpacity>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const renderFormDots = (form: string[]) => (
    <View style={st.formRow}>
      {form.map((f, i) => (
        <View key={i} style={[st.formDot, f === 'W' && st.formDotW, f === 'D' && st.formDotD, f === 'L' && st.formDotL]}>
          <Text style={st.formDotText}>{f === 'W' ? 'V' : f === 'D' ? 'N' : 'D'}</Text>
        </View>
      ))}
    </View>
  );

  const MetricCard = ({ icon: Icon, label, value, color }: { icon: any; label: string; value: string | number; color: string }) => (
    <View style={st.metricCard}>
      <View style={[st.metricIcon, { backgroundColor: color + '20' }]}><Icon size={18} color={color} /></View>
      <Text style={st.metricValue}>{value}</Text>
      <Text style={st.metricLabel}>{label}</Text>
    </View>
  );

  return (
    <><Stack.Screen options={{ headerShown: false }} />
    <View style={st.root}>
      <LinearGradient colors={[Colors.background.dark, '#0D1420']} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={st.safe}>
        <LinearGradient
          colors={tournament.status === 'completed' ? ['#4A5688', '#364270'] : tournament.status === 'in_progress' ? ['#22A85A', '#1A8C48'] : ['#E8740C', '#C85F0A']}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
          style={st.headerBanner}
        >
          <View style={st.headerRow}>
            <TouchableOpacity style={st.backBtn} onPress={goBack}><ArrowLeft size={20} color="#fff" /></TouchableOpacity>
            <View style={st.headerCenter}>
              <Text style={st.headerTitle} numberOfLines={1}>{canManage ? 'Gestion' : 'Détails'} - {tournament.name}</Text>
              <View style={st.headerMeta}>
                <View style={st.pillDotWrap}><View style={st.pillDot} /></View>
                <Text style={st.headerStatusText}>{statusLabel}</Text>
                <Text style={st.headerSep}>•</Text>
                <Text style={st.headerTeamCount}>{registeredTeamIds.length}/{tournament.maxTeams} équipes</Text>
                {matchProgress.total > 0 && <><Text style={st.headerSep}>•</Text><Text style={st.headerTeamCount}>{matchProgress.pct}%</Text></>}
              </View>
            </View>
            <View style={{ width: 36 }} />
          </View>
        </LinearGradient>

        <View style={st.tabBarWrap}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={st.tabBarContent}>
            {visibleTabs.map((tab) => {
              const active = activeTab === tab.key;
              const Icon = tab.icon;
              const badge = tab.key === 'matches' ? matchProgress.pending : tab.key === 'teams' ? registeredTeamIds.length : 0;
              return (
                <TouchableOpacity key={tab.key} style={[st.tab, active && st.tabActive]} onPress={() => setActiveTab(tab.key)}>
                  <Icon size={14} color={active ? '#fff' : Colors.text.muted} />
                  <Text style={[st.tabText, active && st.tabTextActive]}>{tab.label}</Text>
                  {badge > 0 && <View style={[st.tabBadge, active && st.tabBadgeActive]}><Text style={[st.tabBadgeText, active && st.tabBadgeTextActive]}>{badge}</Text></View>}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
        >
          <ScrollView style={st.body} contentContainerStyle={st.bodyContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary.orange} />}>

          {activeTab === 'overview' && (<>
            {tournament.winnerId && (
              <View style={st.championCard}>
                <LinearGradient 
                  colors={['rgba(255,215,0,0.25)', 'rgba(255,215,0,0.08)', 'rgba(255,140,0,0.05)']} 
                  style={st.championGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  <View style={st.championHeader}>
                    <View style={st.championTrophyWrap}>
                      <Trophy size={32} color="#FFD700" strokeWidth={2.5} />
                    </View>
                    <View style={st.championSparkles}>
                      <Award size={16} color="rgba(255,215,0,0.6)" />
                      <Award size={12} color="rgba(255,215,0,0.4)" style={{ position: 'absolute', top: -8, right: -8 }} />
                    </View>
                  </View>
                  
                  <View style={st.championContent}>
                    <Text style={st.championLabel}>🏆 CHAMPION DU TOURNOI</Text>
                    <Text style={st.championName}>{teamName(tournament.winnerId)}</Text>
                    <View style={st.championStats}>
                      <View style={st.championStatItem}>
                        <Text style={st.championStatValue}>{completedMatches.filter(m => 
                          (m.homeTeamId === tournament.winnerId && m.score && m.score.home > m.score.away) ||
                          (m.awayTeamId === tournament.winnerId && m.score && m.score.away > m.score.home)
                        ).length}</Text>
                        <Text style={st.championStatLabel}>Victoires</Text>
                      </View>
                      <View style={st.championStatDivider} />
                      <View style={st.championStatItem}>
                        <Text style={st.championStatValue}>{tournamentMatches.length}</Text>
                        <Text style={st.championStatLabel}>Matchs joués</Text>
                      </View>
                      <View style={st.championStatDivider} />
                      <View style={st.championStatItem}>
                        <Text style={st.championStatValue}>{registeredTeamIds.length}</Text>
                        <Text style={st.championStatLabel}>Équipes</Text>
                      </View>
                    </View>
                  </View>
                  
                  <View style={st.championFooter}>
                    <View style={st.championBadge}>
                      <Award size={14} color="#FFD700" />
                      <Text style={st.championBadgeText}>Vainqueur</Text>
                    </View>
                    <Text style={st.championDate}>{new Date(tournament.startDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}</Text>
                  </View>
                </LinearGradient>
              </View>
            )}

            {/* Phase tracker */}
            {roundLabels.length > 1 && (
              <View style={st.phaseTracker}>
                <Text style={st.phaseTrackerTitle}>Phases du tournoi</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 0, alignItems: 'center' }}>
                  {roundLabels.map((rl, i) => {
                    const rm = tournamentMatches.filter((m) => m.roundLabel === rl);
                    const done = rm.filter((m) => m.status === 'completed' && m.score).length;
                    const allDone = done === rm.length && rm.length > 0;
                    const isCurrent = currentPhase?.label === rl;
                    return (
                      <React.Fragment key={rl}>
                        {i > 0 && <View style={[st.phaseConnector, allDone && { backgroundColor: Colors.status.success }]} />}
                        <View style={{ alignItems: 'center' }}>
                          <TouchableOpacity style={[st.phaseNode, isCurrent && st.phaseNodeCurrent, allDone && st.phaseNodeDone]} onPress={() => { setMatchRoundFilter(rl); setActiveTab('matches'); }}>
                            {allDone ? <Check size={10} color="#fff" /> : <Text style={[st.phaseNodeText, isCurrent && { color: '#fff' }]}>{done}/{rm.length}</Text>}
                          </TouchableOpacity>
                          {isCurrent && <View style={st.phaseCurrentLabel}><Text style={st.phaseCurrentLabelText} numberOfLines={1}>{rl.length > 14 ? rl.slice(0, 12) + '…' : rl}</Text></View>}
                        </View>
                      </React.Fragment>
                    );
                  })}
                </ScrollView>
              </View>
            )}

            <View style={st.progressCard}>
              <View style={st.progressHeader}>
                <View>
                  <Text style={st.progressTitle}>Progression du tournoi</Text>
                  <Text style={st.progressSub}>{matchProgress.completed} terminé{matchProgress.completed > 1 ? 's' : ''} sur {matchProgress.total} matchs</Text>
                </View>
                <View style={st.progressPctWrap}>
                  <Text style={st.progressPct}>{matchProgress.pct}%</Text>
                </View>
              </View>
              <View style={st.progressBar}><View style={[st.progressFill, { width: `${matchProgress.pct}%` }]} /></View>
              <View style={st.progressLegend}>
                <View style={st.progressLegendItem}><View style={[st.progressLegendDot, { backgroundColor: Colors.status.success }]} /><Text style={st.progressLegendText}>{matchProgress.completed} terminés</Text></View>
                <View style={st.progressLegendItem}><View style={[st.progressLegendDot, { backgroundColor: Colors.status.warning }]} /><Text style={st.progressLegendText}>{matchProgress.pending} en attente</Text></View>
              </View>
              {currentPhase && currentPhase.total > 0 && (
                <View style={st.currentPhaseRow}>
                  <View style={st.currentPhaseDot} />
                  <Text style={st.currentPhaseText}>Phase active : <Text style={{ color: '#fff', fontWeight: '700' }}>{currentPhase.label}</Text> ({currentPhase.done}/{currentPhase.total})</Text>
                </View>
              )}
            </View>

            <View style={st.metricsGrid}>
              <MetricCard icon={Users} label="Équipes" value={registeredTeamIds.length} color={Colors.primary.blue} />
              <MetricCard icon={Swords} label="Matchs" value={matchProgress.total} color={Colors.primary.orange} />
              <MetricCard icon={Target} label="Buts" value={tournamentStats.totalGoals} color={Colors.status.success} />
              <MetricCard icon={TrendingUp} label="Moy/match" value={tournamentStats.avgGoals} color="#9333EA" />
            </View>

            {/* Quick actions - Only for managers */}
            {canManage && (
              <View style={st.quickActionsCard}>
                <Text style={st.quickActionsTitle}>Actions rapides</Text>
                <View style={st.quickActionsRow}>
                  <TouchableOpacity style={st.quickActionBtn} onPress={() => setShowCreateMatchModal(true)} disabled={tournament.status === 'completed'}>
                    <View style={[st.quickActionIcon, tournament.status === 'completed' && { opacity: 0.4 }]}><Plus size={18} color="#fff" /></View>
                    <Text style={[st.quickActionLabel, tournament.status === 'completed' && { opacity: 0.4 }]}>Créer match</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={st.quickActionBtn} onPress={handleAutoMatchmaking} disabled={isMatchmaking || tournament.status === 'completed' || registeredTeamIds.length < 2}>
                    <View style={[st.quickActionIcon, (isMatchmaking || tournament.status === 'completed' || registeredTeamIds.length < 2) && { opacity: 0.4 }]}>{isMatchmaking ? <ActivityIndicator size="small" color="#fff" /> : <Zap size={18} color="#fff" />}</View>
                    <Text style={[st.quickActionLabel, (isMatchmaking || tournament.status === 'completed' || registeredTeamIds.length < 2) && { opacity: 0.4 }]}>{isMatchmaking ? 'Génération...' : 'Auto-matchs'}</Text>
                  </TouchableOpacity>
                  {user?.id === tournament.createdBy && (
                    <TouchableOpacity style={st.quickActionBtn} onPress={() => setShowWinnerModal(true)} disabled={tournament.status === 'completed'}>
                      <View style={[st.quickActionIcon, tournament.status === 'completed' && { opacity: 0.4 }]}><Trophy size={18} color="#fff" /></View>
                      <Text style={[st.quickActionLabel, tournament.status === 'completed' && { opacity: 0.4 }]}>Vainqueur</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            )}
            
            {nextMatch && !tournament.winnerId && (
              <TouchableOpacity style={st.nextMatchCard} onPress={() => { setActiveTab('matches'); }} activeOpacity={0.85}>
                <View style={st.nextMatchHeader}>
                  <View style={st.nextMatchIconWrap}><Play size={12} color="#fff" /></View>
                  <Text style={st.nextMatchLabel}>Prochain match</Text>
                  {nextMatch.roundLabel && <View style={st.nextMatchRoundBadge}><Text style={st.nextMatchRoundText}>{nextMatch.roundLabel}</Text></View>}
                </View>
                <View style={st.nextMatchBody}>
                  <Text style={st.nextMatchHome} numberOfLines={1}>{teamName(nextMatch.homeTeamId)}</Text>
                  <View style={st.nextMatchVsBadge}><Text style={st.nextMatchVsText}>VS</Text></View>
                  <Text style={st.nextMatchAway} numberOfLines={1}>{teamName(nextMatch.awayTeamId)}</Text>
                </View>
                <View style={st.nextMatchFooter}>
                  <Calendar size={11} color={Colors.text.muted} />
                  <Text style={st.nextMatchDate}>{safeDate(nextMatch.dateTime).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</Text>
                </View>
              </TouchableOpacity>
            )}

            {/* Activity timeline */}
            {recentActivity.length > 0 && (
              <View style={st.activityCard}>
                <View style={st.sectionHeader}><Text style={st.sectionTitle}>Fil d'activité</Text><TouchableOpacity onPress={() => setActiveTab('matches')}><Text style={st.sectionLink}>Tout voir</Text></TouchableOpacity></View>
                {recentActivity.map((a, i) => (
                  <View key={a.matchId} style={[st.activityRow, i < recentActivity.length - 1 && st.activityRowBorder]}>
                    <View style={[st.activityDot, a.winnerId ? { backgroundColor: Colors.status.success } : { backgroundColor: Colors.status.warning }]} />
                    <View style={{ flex: 1 }}>
                      <Text style={st.activityText}>
                        <Text style={{ fontWeight: '700', color: '#fff' }}>{a.home}</Text>
                        <Text style={{ color: Colors.primary.orange, fontWeight: '800' }}> {a.scoreHome} - {a.scoreAway} </Text>
                        <Text style={{ fontWeight: '700', color: '#fff' }}>{a.away}</Text>
                      </Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
                        {a.roundLabel && <Text style={st.activityRound}>{a.roundLabel}</Text>}
                        <Text style={st.activityDate}>{a.date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}</Text>
                      </View>
                    </View>
                    {a.winnerName && <View style={st.activityWinner}><Trophy size={10} color={Colors.primary.orange} /><Text style={st.activityWinnerText}>{a.winnerName}</Text></View>}
                  </View>
                ))}
              </View>
            )}

            {standings.length > 0 && (<>
              <View style={st.sectionHeader}>
                <Text style={st.sectionTitle}>Classement</Text>
                <TouchableOpacity onPress={() => setActiveTab('standings')}><Text style={st.sectionLink}>Complet</Text></TouchableOpacity>
              </View>
              {standings.slice(0, 3).map((s, idx) => (
                <View key={s.teamId} style={st.topRow}>
                  <View style={[st.topRank, idx === 0 && st.topRankGold, idx === 1 && st.topRankSilver, idx === 2 && st.topRankBronze]}><Text style={st.topRankText}>{idx + 1}</Text></View>
                  <Text style={st.topName} numberOfLines={1}>{teamName(s.teamId)}</Text>
                  <Text style={st.topPts}>{s.pts} pts</Text>
                  {renderFormDots(s.form)}
                </View>
              ))}
            </>)}

            {canManage && tournament.status === 'in_progress' && tournamentMatches.length === 0 && registeredTeamIds.length >= 2 && (
              <TouchableOpacity style={[st.bigActionBtn, isMatchmaking && { opacity: 0.6 }]} onPress={handleAutoMatchmaking} disabled={isMatchmaking}>
                <Zap size={20} color="#fff" /><Text style={st.bigActionText}>{isMatchmaking ? 'Génération…' : 'Matchmaking automatique'}</Text>
              </TouchableOpacity>
            )}
          </>)}

          {activeTab === 'matches' && (<>
            {/* Type badge + action buttons */}
            <View style={st.matchesHeader}>
              <View style={st.typeBadge}>
                <Text style={st.typeBadgeText}>
                  {tournament.type === 'league' ? 'Championnat' : tournament.type === 'knockout' ? 'Élimination directe' : 'Poules + Élim.'}
                </Text>
              </View>
              {canManage && tournament.status === 'in_progress' && (
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <TouchableOpacity style={st.addMatchBtnSmall} onPress={() => setShowCreateMatchModal(true)}>
                    <Plus size={14} color="#fff" /><Text style={st.addMatchBtnSmallText}>Match</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>

            {/* Confirm scores and advance round buttons */}
            {showConfirmScoresButton && (
              <View style={st.advanceRoundSection}>
                <View style={st.advanceRoundContent}>
                  <View style={st.advanceRoundHeader}>
                    <Check size={16} color={Colors.primary.orange} />
                    <Text style={st.advanceRoundTitle}>Scores complets !</Text>
                  </View>
                  <Text style={st.advanceRoundDescription}>
                    Tous les scores du {getCurrentRound()} ont été saisis. Confirmez les scores pour débloquer le passage au tour suivant.
                  </Text>
                  <TouchableOpacity 
                    style={[st.advanceRoundBtn, canConfirmScores() ? {} : st.advanceRoundBtnDisabled]} 
                    onPress={() => {
                      const currentRound = getCurrentRound();
                      if (currentRound) handleConfirmScores(currentRound);
                    }}
                    disabled={!canConfirmScores()}
                  >
                    <Check size={16} color="#fff" />
                    <Text style={st.advanceRoundBtnText}>Confirmer les scores</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {showAdvanceToNextRoundButton && (
              <View style={st.advanceRoundSection}>
                <View style={[st.advanceRoundContent, { borderLeftColor: Colors.status.success }]}>
                  <View style={st.advanceRoundHeader}>
                    <Trophy size={16} color={Colors.status.success} />
                    <Text style={[st.advanceRoundTitle, { color: Colors.status.success }]}>Scores confirmés !</Text>
                  </View>
                  <Text style={st.advanceRoundDescription}>
                    Les scores du {getCurrentRound()} sont confirmés. Vous pouvez maintenant passer au tour suivant : {getNextRound()}.
                  </Text>
                  <TouchableOpacity style={[st.advanceRoundBtn, { backgroundColor: Colors.status.success }]} onPress={handleAdvanceToNextRound} disabled={isMatchmaking}>
                    {isMatchmaking ? <ActivityIndicator size="small" color="#fff" /> : <Play size={16} color="#fff" />}
                    <Text style={st.advanceRoundBtnText}>{isMatchmaking ? 'Génération...' : 'Passer au tour suivant'}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {roundLabels.length > 1 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={st.filterRow}>
                <TouchableOpacity style={[st.filterChip, !matchRoundFilter && st.filterChipActive]} onPress={() => setMatchRoundFilter(null)}>
                  <Text style={[st.filterChipText, !matchRoundFilter && st.filterChipTextActive]}>Tous ({tournamentMatches.length})</Text>
                </TouchableOpacity>
                {(() => {
                  // Group rounds to avoid duplicates
                  const roundPrefixes = [
                    { prefix: 'Tour de 64', display: 'Tour 1 (64)' },
                    { prefix: 'Tour de 32', display: 'Tour 2 (32)' },
                    { prefix: 'Huitième', display: 'Tour 3 (16)' },
                    { prefix: 'Quart', display: 'Tour 4 (8)' },
                    { prefix: 'Demi', display: 'Tour 5 (4)' },
                    { prefix: 'Finale', display: 'Finale (2)' },
                  ];
                  
                  const uniqueRounds: { prefix: string; display: string; firstLabel: string; count: number; doneCount: number }[] = [];
                  
                  roundPrefixes.forEach(({ prefix, display }) => {
                    const matches = tournamentMatches.filter((m) => 
                      m.roundLabel?.startsWith(prefix) && 
                      (prefix !== 'Finale' || !m.roundLabel.includes('Petite'))
                    );
                    if (matches.length > 0) {
                      const doneCount = matches.filter((m) => m.status === 'completed' && m.score).length;
                      uniqueRounds.push({
                        prefix,
                        display,
                        firstLabel: matches[0].roundLabel || '',
                        count: matches.length,
                        doneCount
                      });
                    }
                  });
                  
                  return uniqueRounds.map((round) => (
                    <TouchableOpacity 
                      key={round.prefix} 
                      style={[st.filterChip, matchRoundFilter === round.firstLabel && st.filterChipActive]} 
                      onPress={() => setMatchRoundFilter(round.firstLabel)}
                    >
                      <Text style={[st.filterChipText, matchRoundFilter === round.firstLabel && st.filterChipTextActive]}>
                        {round.display}
                      </Text>
                      <View style={st.filterChipCount}>
                        <Text style={st.filterChipCountText}>{round.doneCount}/{round.count}</Text>
                      </View>
                    </TouchableOpacity>
                  ));
                })()}
              </ScrollView>
            )}

            {tournamentMatchesQuery.isLoading ? (
              <View style={{ gap: 12 }}>{[1, 2, 3].map((i) => <View key={i} style={st.skeletonCard}><Skeleton width="60%" height={14} borderRadius={6} /><Skeleton width="100%" height={20} borderRadius={6} /><Skeleton width="40%" height={12} borderRadius={6} /></View>)}</View>
            ) : filteredMatches.length === 0 ? (
              <View style={st.emptyState}>
                <Swords size={48} color={Colors.text.muted} />
                <Text style={st.emptyTitle}>{tournamentMatches.length === 0 ? 'Aucun match créé' : 'Aucun match pour ce filtre'}</Text>
                <Text style={st.emptyText}>
                  {tournamentMatches.length === 0
                    ? `Générez le calendrier ${tournament.type === 'league' ? 'round-robin' : tournament.type === 'knockout' ? 'à élimination directe' : 'par poules'} automatiquement.`
                    : 'Aucun match pour ce filtre.'}
                </Text>
                {canManage && registeredTeamIds.length >= 2 && tournamentMatches.length === 0 && (
                  <TouchableOpacity style={[st.bigActionBtn, { marginTop: 16 }, isMatchmaking && { opacity: 0.6 }]} onPress={handleAutoMatchmaking} disabled={isMatchmaking}>
                    <Zap size={18} color="#fff" /><Text style={st.bigActionText}>{isMatchmaking ? 'Génération…' : 'Matchmaking automatique'}</Text>
                  </TouchableOpacity>
                )}
              </View>
            ) : matchRoundFilter ? (
              <View style={{ gap: 10 }}>{filteredMatches.map((m) => renderMatchCard(m))}</View>
            ) : (<>
              {/* Mini bracket for knockout */}
              {bracketRounds.length > 0 && (
                <View style={st.bracketCard}>
                  <View style={st.bracketHeader}>
                    <View style={st.bracketTitleRow}>
                      <Trophy size={16} color={Colors.primary.orange} />
                      <Text style={st.bracketTitle}>Arbre du tournoi</Text>
                    </View>
                    <Text style={st.bracketSubtitle}>{bracketRounds.reduce((acc, r) => acc + r.matches.length, 0)} matchs • {tournament.type === 'knockout' ? 'Élimination directe' : 'Knockout'}</Text>
                  </View>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={st.bracketScroll}>
                    {bracketRounds.map((round, ri) => (
                      <React.Fragment key={round.name}>
                        <View style={st.bracketRound}>
                          <Text style={st.bracketRoundName}>{round.name}</Text>
                          {round.matches.map((m) => {
                            const done = m.status === 'completed' && m.score;
                            const isTBD = !m.homeTeamId || !m.awayTeamId;
                            const homeWins = done && m.score!.home > m.score!.away;
                            const awayWins = done && m.score!.away > m.score!.home;
                            return (
                              <TouchableOpacity 
                                key={m.id} 
                                style={[st.bracketMatch, done && st.bracketMatchDone, isTBD && st.bracketMatchTBD]}
                                onPress={() => !isTBD && setShowScoreModal(m)}
                                activeOpacity={isTBD ? 1 : 0.7}
                              >
                                <View style={[st.bracketTeamRow, homeWins && st.bracketTeamRowWinner]}>
                                  <View style={[st.bracketTeamDot, homeWins && st.bracketTeamDotWinner]} />
                                  <Text style={[st.bracketTeamName, homeWins && st.bracketTeamNameWinner]} numberOfLines={1}>
                                    {m.homeTeamId ? teamName(m.homeTeamId) : '?'}
                                  </Text>
                                  {done && <Text style={[st.bracketScore, homeWins && st.bracketScoreWinner]}>{m.score!.home}</Text>}
                                </View>
                                <View style={st.bracketSep} />
                                <View style={[st.bracketTeamRow, awayWins && st.bracketTeamRowWinner]}>
                                  <View style={[st.bracketTeamDot, awayWins && st.bracketTeamDotWinner]} />
                                  <Text style={[st.bracketTeamName, awayWins && st.bracketTeamNameWinner]} numberOfLines={1}>
                                    {m.awayTeamId ? teamName(m.awayTeamId) : '?'}
                                  </Text>
                                  {done && <Text style={[st.bracketScore, awayWins && st.bracketScoreWinner]}>{m.score!.away}</Text>}
                                </View>
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                        {ri < bracketRounds.length - 1 && (
                          <View style={st.bracketConnectorCol}>
                            {round.matches.map((_, mi) => mi % 2 === 0 ? <View key={mi} style={st.bracketConnectorLine} /> : null)}
                          </View>
                        )}
                      </React.Fragment>
                    ))}
                  </ScrollView>
                </View>
              )}

              {/* Tour cards - one button per round */}
              <View style={{ gap: 12 }}>
                {(() => {
                  // Group matches by round type (Tour de 64, Tour de 32, etc.)
                  const roundGroups: { prefix: string; displayLabel: string; matches: Match[]; firstLabel: string }[] = [];
                  
                  // Define round prefixes in order
                  const roundPrefixes = [
                    { prefix: 'Tour de 64', display: 'Tour 1 (64 équipes)' },
                    { prefix: 'Tour de 32', display: 'Tour 2 (32 équipes)' },
                    { prefix: 'Huitième', display: 'Tour 3 (16 équipes)' },
                    { prefix: 'Quart', display: 'Tour 4 (8 équipes)' },
                    { prefix: 'Demi', display: 'Tour 5 (4 équipes)' },
                    { prefix: 'Finale', display: 'Finale (2 équipes)' },
                  ];
                  
                  roundPrefixes.forEach(({ prefix, display }) => {
                    const matches = matchesSorted.filter((m) => 
                      m.roundLabel?.startsWith(prefix) && 
                      (prefix !== 'Finale' || !m.roundLabel.includes('Petite'))
                    );
                    if (matches.length > 0) {
                      roundGroups.push({
                        prefix,
                        displayLabel: display,
                        matches,
                        firstLabel: matches[0].roundLabel || ''
                      });
                    }
                  });
                  
                  return roundGroups.map((group) => {
                    const doneCount = group.matches.filter((m) => m.status === 'completed' && m.score).length;
                    const allDone = doneCount === group.matches.length;
                    
                    return (
                      <TouchableOpacity 
                        key={group.prefix} 
                        style={[st.roundCard, allDone && st.roundCardComplete]}
                        onPress={() => setMatchRoundFilter(group.firstLabel)}
                        activeOpacity={0.7}
                      >
                        <View style={st.roundCardHeader}>
                          <View style={[st.roundCardDot, allDone && { backgroundColor: Colors.status.success }]} />
                          <Text style={st.roundCardTitle}>{group.displayLabel}</Text>
                        </View>
                        <View style={st.roundCardStats}>
                          <Text style={st.roundCardCount}>{group.matches.length} matchs</Text>
                          <Text style={[st.roundCardProgress, allDone && { color: Colors.status.success }]}>
                            {doneCount}/{group.matches.length} scores
                          </Text>
                        </View>
                        <View style={st.roundCardFooter}>
                          <Text style={st.roundCardAction}>Voir les matchs →</Text>
                        </View>
                      </TouchableOpacity>
                    );
                  });
                })()}
                {matchesSorted.filter((m) => !m.roundLabel).length > 0 && (
                  <View>
                    <View style={st.roundSectionHeader}><View style={st.roundSectionDot} /><Text style={st.roundSectionTitle}>Sans phase</Text></View>
                    <View style={{ gap: 8 }}>{matchesSorted.filter((m) => !m.roundLabel).map((m) => renderMatchCard(m))}</View>
                  </View>
                )}
              </View>
            </>)}
          </>)}

          {activeTab === 'standings' && (<>
            {standings.length === 0 ? (
              <View style={st.emptyState}><ListOrdered size={48} color={Colors.text.muted} /><Text style={st.emptyTitle}>Classement indisponible</Text><Text style={st.emptyText}>{registeredTeamIds.length === 0 ? 'Inscrivez des équipes.' : 'Jouez au moins un match.'}</Text></View>
            ) : (<>
              {/* Group standings for group_knockout */}
              {Object.keys(groupStandings).length > 0 && (
                <View style={{ marginBottom: 16 }}>
                  <Text style={[st.sectionTitle, { marginBottom: 12 }]}>Classements par poule</Text>
                  {Object.entries(groupStandings).map(([gName, gStandings]) => (
                    <View key={gName} style={st.groupStandingsCard}>
                      <View style={st.groupStandingsHeader}>
                        <View style={st.groupBadge}><Text style={st.groupBadgeText}>{gName}</Text></View>
                        <Text style={st.groupStandingsCount}>{gStandings.length} équipes</Text>
                      </View>
                      <View style={st.groupTableHeader}>
                        <Text style={[st.groupTableHeaderText, { flex: 1 }]}>Équipe</Text>
                        <Text style={st.groupTableHeaderText}>MJ</Text>
                        <Text style={st.groupTableHeaderText}>V</Text>
                        <Text style={st.groupTableHeaderText}>N</Text>
                        <Text style={st.groupTableHeaderText}>D</Text>
                        <Text style={st.groupTableHeaderText}>Diff</Text>
                        <Text style={[st.groupTableHeaderText, { color: Colors.primary.orange }]}>Pts</Text>
                      </View>
                      {gStandings.map((s, si) => (
                        <View key={s.teamId} style={[st.groupTableRow, si < 2 && st.groupTableRowQualified]}>
                          <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <Text style={st.groupTableRank}>{si + 1}</Text>
                            <Text style={st.groupTableName} numberOfLines={1}>{teamName(s.teamId)}</Text>
                          </View>
                          <Text style={st.groupTableCell}>{s.played}</Text>
                          <Text style={[st.groupTableCell, { color: Colors.status.success }]}>{s.wins}</Text>
                          <Text style={st.groupTableCell}>{s.draws}</Text>
                          <Text style={[st.groupTableCell, { color: Colors.status.error }]}>{s.losses}</Text>
                          <Text style={[st.groupTableCell, { color: s.diff >= 0 ? Colors.status.success : Colors.status.error }]}>{s.diff >= 0 ? '+' : ''}{s.diff}</Text>
                          <Text style={[st.groupTableCell, { color: Colors.primary.orange, fontWeight: '800' }]}>{s.pts}</Text>
                        </View>
                      ))}
                    </View>
                  ))}
                </View>
              )}

              {/* Podium top 3 */}
              {standings.length >= 2 && (
                <View style={st.podiumCard}>
                  <View style={st.podiumRow}>
                    {standings.length >= 2 && (
                      <View style={st.podiumCol}>
                        <View style={[st.podiumMedal, st.podiumSilver]}><Text style={st.podiumMedalText}>2</Text></View>
                        <Text style={st.podiumName} numberOfLines={2}>{teamName(standings[1].teamId)}</Text>
                        <Text style={st.podiumPts}>{standings[1].pts} pts</Text>
                        <View style={[st.podiumBar, st.podiumBarSilver, { height: 50 }]} />
                      </View>
                    )}
                    <View style={st.podiumCol}>
                      <View style={st.podiumCrown}><Trophy size={16} color="#FFD700" /></View>
                      <View style={[st.podiumMedal, st.podiumGold]}><Text style={st.podiumMedalText}>1</Text></View>
                      <Text style={[st.podiumName, { fontWeight: '800' }]} numberOfLines={2}>{teamName(standings[0].teamId)}</Text>
                      <Text style={[st.podiumPts, { color: '#FFD700' }]}>{standings[0].pts} pts</Text>
                      <View style={[st.podiumBar, st.podiumBarGold, { height: 70 }]} />
                    </View>
                    {standings.length >= 3 && (
                      <View style={st.podiumCol}>
                        <View style={[st.podiumMedal, st.podiumBronze]}><Text style={st.podiumMedalText}>3</Text></View>
                        <Text style={st.podiumName} numberOfLines={2}>{teamName(standings[2].teamId)}</Text>
                        <Text style={st.podiumPts}>{standings[2].pts} pts</Text>
                        <View style={[st.podiumBar, st.podiumBarBronze, { height: 36 }]} />
                      </View>
                    )}
                  </View>
                </View>
              )}

              {/* Full standings list */}
              {standings.map((s, idx) => {
                const maxPts = standings[0]?.pts || 1;
                const ptsWidth = maxPts > 0 ? Math.max((s.pts / maxPts) * 100, 4) : 4;
                const winRate = s.played > 0 ? Math.round((s.wins / s.played) * 100) : 0;
                const medalColors: Record<number, string> = { 0: '#FFD700', 1: '#C0C0C0', 2: '#CD7F32' };
                const medalColor = medalColors[idx];
                return (
                  <TouchableOpacity key={s.teamId} style={[st.standingCard, idx === 0 && st.standingCardLeader]} onPress={() => router.push(`/team/${s.teamId}` as any)} activeOpacity={0.7}>
                    <View style={st.standingCardTop}>
                      <View style={[st.standingRank, medalColor ? { backgroundColor: medalColor + '25', borderColor: medalColor + '40', borderWidth: 1.5 } : {}]}>
                        <Text style={[st.standingRankText, medalColor ? { color: medalColor } : {}]}>{idx + 1}</Text>
                      </View>
                      <View style={st.standingInfo}>
                        <Text style={[st.standingName, idx === 0 && { color: '#FFD700' }]} numberOfLines={1}>{teamName(s.teamId)}</Text>
                        <View style={st.standingSubRow}>
                          <Text style={st.standingSub}>{s.played} match{s.played > 1 ? 's' : ''}</Text>
                          <Text style={st.standingSubSep}>•</Text>
                          <Text style={[st.standingSub, { color: Colors.status.success }]}>{s.wins}V</Text>
                          <Text style={st.standingSub}>{s.draws}N</Text>
                          <Text style={[st.standingSub, { color: Colors.status.error }]}>{s.losses}D</Text>
                        </View>
                      </View>
                      <View style={st.standingPtsWrap}>
                        <Text style={[st.standingPtsValue, medalColor ? { color: medalColor } : {}]}>{s.pts}</Text>
                        <Text style={st.standingPtsLabel}>pts</Text>
                      </View>
                    </View>

                    {/* Points progress bar */}
                    <View style={st.standingBarBg}>
                      <View style={[st.standingBarFill, { width: `${ptsWidth}%` }, medalColor ? { backgroundColor: medalColor } : {}]} />
                    </View>

                    <View style={st.standingCardBottom}>
                      <View style={st.standingStatGroup}>
                        <View style={st.standingStatItem}>
                          <Text style={st.standingStatNum}>{s.gf}</Text>
                          <Text style={st.standingStatSub}>BP</Text>
                        </View>
                        <View style={st.standingStatDivider} />
                        <View style={st.standingStatItem}>
                          <Text style={st.standingStatNum}>{s.ga}</Text>
                          <Text style={st.standingStatSub}>BC</Text>
                        </View>
                        <View style={st.standingStatDivider} />
                        <View style={st.standingStatItem}>
                          <Text style={[st.standingStatNum, { color: s.diff >= 0 ? Colors.status.success : Colors.status.error }]}>{s.diff >= 0 ? `+${s.diff}` : s.diff}</Text>
                          <Text style={st.standingStatSub}>Diff</Text>
                        </View>
                        <View style={st.standingStatDivider} />
                        <View style={st.standingStatItem}>
                          <Text style={st.standingStatNum}>{winRate}%</Text>
                          <Text style={st.standingStatSub}>Vict.</Text>
                        </View>
                      </View>
                      <View style={st.standingForm}>
                        {s.form.length > 0 ? renderFormDots(s.form) : <Text style={{ color: Colors.text.muted, fontSize: 10 }}>—</Text>}
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })}

              {/* Summary stats */}
              {completedMatches.length > 0 && (
                <View style={st.standingSummary}>
                  <View style={st.standingSummaryItem}>
                    <Text style={st.standingSummaryValue}>{completedMatches.length}</Text>
                    <Text style={st.standingSummaryLabel}>Matchs joués</Text>
                  </View>
                  <View style={st.standingSummaryDivider} />
                  <View style={st.standingSummaryItem}>
                    <Text style={st.standingSummaryValue}>{tournamentStats.totalGoals}</Text>
                    <Text style={st.standingSummaryLabel}>Buts total</Text>
                  </View>
                  <View style={st.standingSummaryDivider} />
                  <View style={st.standingSummaryItem}>
                    <Text style={st.standingSummaryValue}>{tournamentStats.avgGoals}</Text>
                    <Text style={st.standingSummaryLabel}>Moy/match</Text>
                  </View>
                </View>
              )}
            </>)}
          </>)}

          {activeTab === 'teams' && (<>
            {teamStats.length === 0 ? (
              <View style={st.emptyState}><Users size={48} color={Colors.text.muted} /><Text style={st.emptyTitle}>Aucune équipe inscrite</Text></View>
            ) : (<>
              {/* Summary bar */}
              <View style={st.teamsSummaryBar}>
                <View style={st.teamsSumItem}><Text style={st.teamsSumValue}>{registeredTeamIds.length}</Text><Text style={st.teamsSumLabel}>Équipes</Text></View>
                <View style={st.teamsSumDivider} />
                <View style={st.teamsSumItem}><Text style={st.teamsSumValue}>{completedMatches.length}</Text><Text style={st.teamsSumLabel}>Matchs joués</Text></View>
                <View style={st.teamsSumDivider} />
                <View style={st.teamsSumItem}><Text style={st.teamsSumValue}>{tournamentStats.totalGoals}</Text><Text style={st.teamsSumLabel}>Buts</Text></View>
              </View>

              <View style={{ gap: 12 }}>
                {teamStats.map((t, idx) => {
                  const winRate = t.played > 0 ? Math.round((t.wins / t.played) * 100) : 0;
                  const streak = (() => {
                    if (t.form.length === 0) return { type: 'none' as const, count: 0 };
                    const last = t.form[t.form.length - 1];
                    let count = 0;
                    for (let i = t.form.length - 1; i >= 0; i--) { if (t.form[i] === last) count++; else break; }
                    return { type: last as 'W' | 'D' | 'L', count };
                  })();
                  const isEliminated = tournament.type === 'knockout' && t.played > 0 && completedMatches.some(
                    (m) => m.score && ((m.homeTeamId === t.teamId && m.score.home < m.score.away) || (m.awayTeamId === t.teamId && m.score.away < m.score.home))
                  );
                  const group = Object.entries(groupStandings).find(([, gs]) => gs.some((s) => s.teamId === t.teamId));
                  const medalColors: Record<number, string> = { 1: '#FFD700', 2: '#C0C0C0', 3: '#CD7F32' };
                  const medalColor = (t.rank && t.rank <= 3) ? medalColors[t.rank] : undefined;
                  const maxPts = teamStats[0]?.pts || 1;
                  const ptsBarWidth = maxPts > 0 ? Math.max((t.pts / maxPts) * 100, 3) : 3;
                  const totalMatchesPlayed = t.wins + t.draws + t.losses;
                  const wPct = totalMatchesPlayed > 0 ? (t.wins / totalMatchesPlayed) * 100 : 0;
                  const dPct = totalMatchesPlayed > 0 ? (t.draws / totalMatchesPlayed) * 100 : 0;
                  const lPct = totalMatchesPlayed > 0 ? (t.losses / totalMatchesPlayed) * 100 : 0;

                  return (
                    <TouchableOpacity key={t.teamId} style={[st.teamCard2, isEliminated && st.teamCard2Elim, idx === 0 && !isEliminated && st.teamCard2Leader]} onPress={() => router.push(`/team/${t.teamId}` as any)} activeOpacity={0.7}>
                      {/* Left accent */}
                      <View style={[st.teamCard2Accent, medalColor ? { backgroundColor: medalColor } : {}]} />

                      {/* Rank circle */}
                      <View style={[st.teamRank2, medalColor ? { backgroundColor: medalColor + '20', borderColor: medalColor } : {}]}>
                        <Text style={[st.teamRank2Text, medalColor ? { color: medalColor } : {}]}>{t.rank || '-'}</Text>
                      </View>

                      <View style={st.teamCard2Body}>
                        {/* Header row */}
                        <View style={st.teamCard2Header}>
                          <View style={{ flex: 1 }}>
                            <Text style={[st.teamCard2Name, isEliminated && { opacity: 0.45 }]} numberOfLines={1}>{teamName(t.teamId)}</Text>
                            <View style={st.teamCard2Tags}>
                              {group && <View style={st.teamTag}><Text style={st.teamTagText}>{group[0]}</Text></View>}
                              {streak.count >= 2 && streak.type === 'W' && (
                                <View style={[st.teamTag, { backgroundColor: Colors.status.success + '18' }]}><TrendingUp size={8} color={Colors.status.success} /><Text style={[st.teamTagText, { color: Colors.status.success }]}>{streak.count} vict.</Text></View>
                              )}
                              {streak.count >= 3 && streak.type === 'L' && (
                                <View style={[st.teamTag, { backgroundColor: Colors.status.error + '18' }]}><Text style={[st.teamTagText, { color: Colors.status.error }]}>{streak.count} déf.</Text></View>
                              )}
                              {isEliminated && <View style={[st.teamTag, { backgroundColor: Colors.status.error + '15' }]}><X size={8} color={Colors.status.error} /><Text style={[st.teamTagText, { color: Colors.status.error }]}>Éliminé</Text></View>}
                            </View>
                          </View>
                          <View style={[st.teamPtsBox, medalColor ? { backgroundColor: medalColor + '18' } : {}]}>
                            <Text style={[st.teamPtsNum, medalColor ? { color: medalColor } : {}]}>{t.pts}</Text>
                            <Text style={st.teamPtsUnit}>pts</Text>
                          </View>
                        </View>

                        {/* Points bar */}
                        <View style={st.teamPtsBarBg}>
                          <View style={[st.teamPtsBarFill, { width: `${ptsBarWidth}%` }, medalColor ? { backgroundColor: medalColor } : {}]} />
                        </View>

                        {/* Stats grid */}
                        <View style={st.teamStatsGrid}>
                          <View style={st.teamStatCell}>
                            <Text style={st.teamStatCellVal}>{t.played}</Text>
                            <Text style={st.teamStatCellLbl}>MJ</Text>
                          </View>
                          <View style={st.teamStatCellDivider} />
                          <View style={st.teamStatCell}>
                            <Text style={[st.teamStatCellVal, { color: Colors.status.success }]}>{t.wins}</Text>
                            <Text style={st.teamStatCellLbl}>V</Text>
                          </View>
                          <View style={st.teamStatCellDivider} />
                          <View style={st.teamStatCell}>
                            <Text style={[st.teamStatCellVal, { color: Colors.status.warning }]}>{t.draws}</Text>
                            <Text style={st.teamStatCellLbl}>N</Text>
                          </View>
                          <View style={st.teamStatCellDivider} />
                          <View style={st.teamStatCell}>
                            <Text style={[st.teamStatCellVal, { color: Colors.status.error }]}>{t.losses}</Text>
                            <Text style={st.teamStatCellLbl}>D</Text>
                          </View>
                          <View style={st.teamStatCellDivider} />
                          <View style={st.teamStatCell}>
                            <Text style={st.teamStatCellVal}>{t.gf}<Text style={{ color: Colors.text.muted, fontSize: 10 }}>/{t.ga}</Text></Text>
                            <Text style={st.teamStatCellLbl}>BP/BC</Text>
                          </View>
                          <View style={st.teamStatCellDivider} />
                          <View style={st.teamStatCell}>
                            <Text style={[st.teamStatCellVal, { color: t.diff >= 0 ? Colors.status.success : Colors.status.error }]}>{t.diff >= 0 ? '+' : ''}{t.diff}</Text>
                            <Text style={st.teamStatCellLbl}>Diff</Text>
                          </View>
                        </View>

                        {/* Win rate bar + form */}
                        <View style={st.teamBottomRow}>
                          <View style={st.teamWinRateWrap}>
                            <Text style={st.teamWinRateLabel}>{winRate}%</Text>
                            {totalMatchesPlayed > 0 ? (
                              <View style={st.teamWinRateBar}>
                                {wPct > 0 && <View style={[st.teamWinRateSeg, { flex: wPct, backgroundColor: Colors.status.success }]} />}
                                {dPct > 0 && <View style={[st.teamWinRateSeg, { flex: dPct, backgroundColor: Colors.status.warning }]} />}
                                {lPct > 0 && <View style={[st.teamWinRateSeg, { flex: lPct, backgroundColor: Colors.status.error }]} />}
                              </View>
                            ) : (
                              <View style={st.teamWinRateBar}><View style={[st.teamWinRateSeg, { flex: 1, backgroundColor: Colors.background.cardLight }]} /></View>
                            )}
                          </View>
                          <View style={st.teamFormWrap}>
                            {t.form.length > 0 ? renderFormDots(t.form) : <Text style={{ color: Colors.text.muted, fontSize: 9 }}>—</Text>}
                          </View>
                        </View>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </>)}
          </>)}

          {activeTab === 'stats' && (<>
            {completedMatches.length === 0 ? (
              <View style={st.emptyState}><BarChart3 size={48} color={Colors.text.muted} /><Text style={st.emptyTitle}>Pas encore de statistiques</Text><Text style={st.emptyText}>Les statistiques apparaîtront après le premier match joué.</Text></View>
            ) : (<>
              <View style={st.metricsGrid}>
                <MetricCard icon={Target} label="Buts totaux" value={tournamentStats.totalGoals} color={Colors.primary.orange} />
                <MetricCard icon={TrendingUp} label="Moy / match" value={tournamentStats.avgGoals} color={Colors.primary.blue} />
                <MetricCard icon={Shield} label="Clean sheets" value={tournamentStats.cleanSheets} color={Colors.status.success} />
                <MetricCard icon={Hash} label="Matchs nuls" value={tournamentStats.drawCount} color={Colors.status.warning} />
              </View>

              <View style={st.statCard}>
                <Text style={st.statCardTitle}>Meilleure attaque</Text>
                {tournamentStats.topScoringTeamId ? (
                  <View style={st.statCardRow}><Text style={st.statCardValue}>{teamName(tournamentStats.topScoringTeamId)}</Text><Text style={st.statCardBig}>{tournamentStats.topScoringTeamGoals} buts</Text></View>
                ) : <Text style={st.statCardSub}>—</Text>}
              </View>

              {tournamentStats.biggestWinMatch && (
                <View style={st.statCard}>
                  <Text style={st.statCardTitle}>Plus large victoire</Text>
                  <View style={st.statCardRow}>
                    <Text style={st.statCardValue}>{teamName(tournamentStats.biggestWinMatch.homeTeamId)} {tournamentStats.biggestWinMatch.score!.home} - {tournamentStats.biggestWinMatch.score!.away} {teamName(tournamentStats.biggestWinMatch.awayTeamId)}</Text>
                    <Text style={st.statCardBig}>+{tournamentStats.biggestWinMargin}</Text>
                  </View>
                </View>
              )}

              {tournamentStats.highestScoringMatch && (
                <View style={st.statCard}>
                  <Text style={st.statCardTitle}>Match le plus prolifique</Text>
                  <View style={st.statCardRow}>
                    <Text style={st.statCardValue}>{teamName(tournamentStats.highestScoringMatch.homeTeamId)} {tournamentStats.highestScoringMatch.score!.home} - {tournamentStats.highestScoringMatch.score!.away} {teamName(tournamentStats.highestScoringMatch.awayTeamId)}</Text>
                    <Text style={st.statCardBig}>{tournamentStats.highestScoringTotal} buts</Text>
                  </View>
                </View>
              )}

              <View style={st.statCard}>
                <Text style={st.statCardTitle}>Répartition des résultats</Text>
                <View style={st.distBar}>
                  {tournamentStats.decisiveCount > 0 && <View style={[st.distSeg, st.distWin, { flex: tournamentStats.decisiveCount }]} />}
                  {tournamentStats.drawCount > 0 && <View style={[st.distSeg, st.distDraw, { flex: tournamentStats.drawCount }]} />}
                </View>
                <View style={st.distLegend}>
                  <View style={st.distLegendItem}><View style={[st.distLegendDot, { backgroundColor: Colors.status.success }]} /><Text style={st.distLegendText}>Décisifs ({tournamentStats.decisiveCount})</Text></View>
                  <View style={st.distLegendItem}><View style={[st.distLegendDot, { backgroundColor: Colors.status.warning }]} /><Text style={st.distLegendText}>Nuls ({tournamentStats.drawCount})</Text></View>
                </View>
              </View>

              {/* Team scoring ranking */}
              {teamScoringRanking.length > 0 && (
                <View style={st.statCard}>
                  <Text style={st.statCardTitle}>Classement buteurs (par équipe)</Text>
                  {teamScoringRanking.slice(0, 6).map((t, i) => {
                    const maxScored = teamScoringRanking[0]?.scored || 1;
                    return (
                      <View key={t.teamId} style={st.scoringRow}>
                        <Text style={st.scoringRank}>{i + 1}</Text>
                        <View style={{ flex: 1 }}>
                          <Text style={st.scoringName} numberOfLines={1}>{teamName(t.teamId)}</Text>
                          <View style={st.scoringBarBg}>
                            <View style={[st.scoringBarFill, { width: `${Math.max((t.scored / maxScored) * 100, 6)}%` }]}>
                              <Text style={st.scoringBarText}>{t.scored}</Text>
                            </View>
                          </View>
                        </View>
                        <View style={st.scoringStats}>
                          <Text style={st.scoringBP}>{t.scored} BP</Text>
                          <Text style={st.scoringBC}>{t.conceded} BC</Text>
                        </View>
                      </View>
                    );
                  })}
                </View>
              )}

              {/* Scoring per round */}
              {roundLabels.length > 1 && (
                <View style={st.statCard}>
                  <Text style={st.statCardTitle}>Buts par phase</Text>
                  {roundLabels.map((rl) => {
                    const rm = completedMatches.filter((m) => m.roundLabel === rl);
                    if (rm.length === 0) return null;
                    const goals = rm.reduce((sum, m) => sum + m.score!.home + m.score!.away, 0);
                    const avg = (goals / rm.length).toFixed(1);
                    const maxGoals = Math.max(...roundLabels.map((r) => completedMatches.filter((m) => m.roundLabel === r).reduce((s, m) => s + (m.score ? m.score.home + m.score.away : 0), 0)), 1);
                    return (
                      <View key={rl} style={st.phaseGoalRow}>
                        <Text style={st.phaseGoalLabel} numberOfLines={1}>{rl}</Text>
                        <View style={st.phaseGoalBarBg}>
                          <View style={[st.phaseGoalBarFill, { width: `${Math.max((goals / maxGoals) * 100, 8)}%` }]} />
                        </View>
                        <Text style={st.phaseGoalValue}>{goals}</Text>
                        <Text style={st.phaseGoalAvg}>(~{avg}/m)</Text>
                      </View>
                    );
                  })}
                </View>
              )}
            </>)}
          </>)}

          {activeTab === 'admin' && canManage && (<>
            <View style={st.adminSectionCard}>
              <Text style={st.adminSectionLabel}>Actions de gestion</Text>

              {tournament.status === 'in_progress' && tournamentMatches.length === 0 && registeredTeamIds.length >= 2 && (
                <TouchableOpacity style={[st.adminAction, st.adminActionHighlight]} onPress={handleAutoMatchmaking} disabled={isMatchmaking}>
                  <View style={[st.adminIconWrap, { backgroundColor: Colors.primary.orange + '20' }]}><Zap size={18} color={Colors.primary.orange} /></View>
                  <View style={{ flex: 1 }}><Text style={st.adminActionTitle}>Matchmaking automatique</Text><Text style={st.adminActionSub}>Apparier les équipes et créer les matchs</Text></View>
                  {isMatchmaking ? <ActivityIndicator size="small" color={Colors.primary.orange} /> : <ChevronRight size={16} color={Colors.text.muted} />}
                </TouchableOpacity>
              )}

              <TouchableOpacity style={st.adminAction} onPress={handleChangeStatus}>
                <View style={[st.adminIconWrap, { backgroundColor: Colors.primary.blue + '20' }]}><Settings size={18} color={Colors.primary.blue} /></View>
                <View style={{ flex: 1 }}><Text style={st.adminActionTitle}>Changer le statut</Text><Text style={st.adminActionSub}>Actuel : {statusLabel}</Text></View>
                <ChevronRight size={16} color={Colors.text.muted} />
              </TouchableOpacity>

              <TouchableOpacity style={st.adminAction} onPress={() => setShowCreateMatchModal(true)}>
                <View style={[st.adminIconWrap, { backgroundColor: Colors.status.success + '20' }]}><Plus size={18} color={Colors.status.success} /></View>
                <View style={{ flex: 1 }}><Text style={st.adminActionTitle}>Créer un match</Text><Text style={st.adminActionSub}>Ajouter un match manuellement</Text></View>
                <ChevronRight size={16} color={Colors.text.muted} />
              </TouchableOpacity>

              {user?.id === tournament.createdBy && (
                <>
                  {!tournament.winnerId ? (
                    <TouchableOpacity style={st.adminAction} onPress={() => setShowWinnerModal(true)} disabled={registeredTeamIds.length === 0}>
                      <View style={[st.adminIconWrap, { backgroundColor: 'rgba(255,215,0,0.2)' }]}><Trophy size={18} color="#FFD700" /></View>
                      <View style={{ flex: 1 }}>
                        <Text style={st.adminActionTitle}>Déclarer le vainqueur</Text>
                        <Text style={st.adminActionSub}>Clôturer le tournoi</Text>
                      </View>
                      <ChevronRight size={16} color={Colors.text.muted} />
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity style={st.adminAction} onPress={handleCancelWinner}>
                      <View style={[st.adminIconWrap, { backgroundColor: Colors.status.error + '20' }]}><X size={18} color={Colors.status.error} /></View>
                      <View style={{ flex: 1 }}>
                        <Text style={st.adminActionTitle}>Annuler le vainqueur</Text>
                        <Text style={st.adminActionSub}>Remettre le tournoi en cours</Text>
                      </View>
                      <ChevronRight size={16} color={Colors.text.muted} />
                    </TouchableOpacity>
                  )}
                </>
              )}

              <TouchableOpacity style={st.adminAction} onPress={() => router.push(`/edit-tournament/${tournament.id}`)}>
                <View style={[st.adminIconWrap, { backgroundColor: Colors.primary.blue + '20' }]}><Pencil size={18} color={Colors.primary.blue} /></View>
                <View style={{ flex: 1 }}><Text style={st.adminActionTitle}>Modifier le tournoi</Text><Text style={st.adminActionSub}>Nom, dates, description…</Text></View>
                <ChevronRight size={16} color={Colors.text.muted} />
              </TouchableOpacity>
            </View>

            <View style={st.adminSectionCard}>
              <Text style={st.adminSectionLabel}>Informations du tournoi</Text>
              <View style={st.infoGrid}>
                <View style={st.infoGridItem}><Text style={st.infoGridLabel}>Sport</Text><Text style={st.infoGridValue}>{tournament.sport}</Text></View>
                <View style={st.infoGridItem}><Text style={st.infoGridLabel}>Format</Text><Text style={st.infoGridValue}>{tournament.format}</Text></View>
                <View style={st.infoGridItem}><Text style={st.infoGridLabel}>Type</Text><Text style={st.infoGridValue}>{tournament.type}</Text></View>
                <View style={st.infoGridItem}><Text style={st.infoGridLabel}>Niveau</Text><Text style={st.infoGridValue}>{tournament.level}</Text></View>
                <View style={st.infoGridItem}><Text style={st.infoGridLabel}>Équipes</Text><Text style={st.infoGridValue}>{registeredTeamIds.length} / {tournament.maxTeams}</Text></View>
                <View style={st.infoGridItem}><Text style={st.infoGridLabel}>Début</Text><Text style={st.infoGridValue}>{safeDate(tournament.startDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}</Text></View>
                <View style={st.infoGridItem}><Text style={st.infoGridLabel}>Fin</Text><Text style={st.infoGridValue}>{safeDate(tournament.endDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}</Text></View>
                {tournament.prizePool > 0 && <View style={st.infoGridItem}><Text style={st.infoGridLabel}>Prize pool</Text><Text style={[st.infoGridValue, { color: Colors.primary.orange }]}>{tournament.prizePool.toLocaleString('fr-FR')} FCFA</Text></View>}
                {tournament.venue?.name ? <View style={[st.infoGridItem, { width: '100%' }]}><Text style={st.infoGridLabel}>Lieu</Text><Text style={st.infoGridValue}>{tournament.venue.name}{tournament.venue.city ? ` – ${tournament.venue.city}` : ''}</Text></View> : null}
              </View>
            </View>

            {user?.id === tournament.createdBy && (
              <View style={st.adminSectionCard}>
                <View style={st.managerHeaderRow}>
                  <View>
                    <Text style={st.adminSectionLabel}>Gestionnaires autorisés</Text>
                    <Text style={st.adminSectionHint}>Peuvent gérer scores, matchs et vainqueur.</Text>
                  </View>
                  <TouchableOpacity style={st.managerAddFloatBtn} onPress={() => setShowManagerModal(true)}>
                    <UserPlus size={16} color="#fff" />
                  </TouchableOpacity>
                </View>

                <ManagersList managers={tournament.managers ?? []} creatorId={tournament.createdBy} onRemove={handleRemoveManager} />
              </View>
            )}

            <View style={st.dangerZone}>
              <Text style={st.dangerZoneTitle}>Zone de danger</Text>
              <TouchableOpacity style={st.dangerAction} onPress={handleDelete}>
                <Trash2 size={18} color={Colors.status.error} />
                <View style={{ flex: 1 }}><Text style={st.dangerActionTitle}>Supprimer le tournoi</Text><Text style={st.dangerActionSub}>Cette action est irréversible</Text></View>
              </TouchableOpacity>
            </View>
          </>)}

          <View style={{ height: 80 }} />
        </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>

    <Modal visible={showCreateMatchModal} animationType="slide" transparent statusBarTranslucent>
      <View style={st.modalOverlay}>
        {!IS_WEB && <TouchableOpacity style={st.modalDismiss} activeOpacity={1} onPress={() => { Keyboard.dismiss(); }} />}
        <View style={st.modalContent}>
          <View style={st.modalHeader}><Text style={st.modalTitle}>Créer un match</Text><TouchableOpacity onPress={() => setShowCreateMatchModal(false)} style={st.modalClose}><X size={22} color="#fff" /></TouchableOpacity></View>
          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="always" bounces={false}>
            <CreateTournamentMatchForm tournament={tournament} getTeamById={getTeamById} onCreate={(h, a, dt, rl) => handleCreateMatch(h, a, dt, rl)} onCancel={() => setShowCreateMatchModal(false)} styles={st} />
          </ScrollView>
        </View>
      </View>
    </Modal>

    <Modal visible={!!showScoreModal} animationType="slide" transparent statusBarTranslucent>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <View style={st.modalOverlay}>
          {!IS_WEB && <TouchableOpacity style={st.modalDismiss} activeOpacity={1} onPress={() => { Keyboard.dismiss(); }} />}
          <View style={st.modalContent}>
            <View style={st.modalHeader}><Text style={st.modalTitle}>Saisir le score</Text><TouchableOpacity onPress={() => setShowScoreModal(null)} style={st.modalClose}><X size={22} color="#fff" /></TouchableOpacity></View>
            <ScoreModal match={showScoreModal} teamName={teamName} onSave={handleSaveScore} onClose={() => setShowScoreModal(null)} />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>

    <Modal visible={!!editMatchModal} animationType="slide" transparent statusBarTranslucent>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <View style={st.modalOverlay}>
          {!IS_WEB && <TouchableOpacity style={st.modalDismiss} activeOpacity={1} onPress={() => { Keyboard.dismiss(); }} />}
          <View style={st.modalContent}>
            <View style={st.modalHeader}><Text style={st.modalTitle}>Modifier le match</Text><TouchableOpacity onPress={() => setEditMatchModal(null)} style={st.modalClose}><X size={22} color="#fff" /></TouchableOpacity></View>
            {editMatchModal && <EditMatchForm match={editMatchModal} tournament={tournament} getTeamById={getTeamById} venues={venues ?? []} onSave={handleEditSave} onCancel={() => setEditMatchModal(null)} saving={isSavingMatch} styles={st} />}
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>

    <Modal visible={showWinnerModal} animationType="slide" transparent statusBarTranslucent>
      <View style={st.modalOverlay}>
        <TouchableOpacity style={st.modalDismiss} activeOpacity={1} onPress={() => setShowWinnerModal(false)} />
        <View style={st.modalContent}>
          <View style={st.modalHeader}><Text style={st.modalTitle}>Déclarer le vainqueur</Text><TouchableOpacity onPress={() => setShowWinnerModal(false)} style={st.modalClose}><X size={22} color="#fff" /></TouchableOpacity></View>
          {isSettingWinner ? (
            <View style={{ padding: 28, alignItems: 'center' }}><ActivityIndicator size="large" color={Colors.primary.orange} /><Text style={st.emptyText}>Enregistrement…</Text></View>
          ) : (
            <ScrollView style={{ maxHeight: 380 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="always">
              {registeredTeamIds.map((tid) => (
                <TouchableOpacity key={tid} style={st.winnerRow} onPress={() => handleSetWinner(tid)} activeOpacity={0.7}>
                  <View style={st.winnerIcon}><Trophy size={20} color={Colors.primary.orange} /></View>
                  <Text style={st.winnerName}>{teamName(tid)}</Text>
                  {tournament.winnerId === tid && <View style={st.winnerCurrentBadge}><Text style={st.winnerCurrentText}>Actuel</Text></View>}
                  <ChevronRight size={18} color={Colors.text.muted} />
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>

    <ManagerSearchModal visible={showManagerModal} tournament={tournament} onClose={() => setShowManagerModal(false)} onAdded={handleManagerAdded} senderName={user?.username ?? 'Un administrateur'} />
    </>
  );
}

const st = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  centerText: { color: Colors.text.secondary, fontSize: 16, marginTop: 8 },

  fallbackHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, gap: 10 },
  headerBanner: { paddingTop: 6, paddingBottom: 10, paddingHorizontal: 16 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(0,0,0,0.2)', alignItems: 'center', justifyContent: 'center' },
  headerCenter: { flex: 1 },
  headerTitle: { color: '#fff', fontSize: 16, fontWeight: '700' },
  headerMeta: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 },
  pillDotWrap: { width: 8, height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.3)', alignItems: 'center', justifyContent: 'center' },
  pillDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: '#fff' },
  headerStatusText: { color: 'rgba(255,255,255,0.9)', fontSize: 11, fontWeight: '600' },
  headerSep: { color: 'rgba(255,255,255,0.4)', fontSize: 11 },
  headerTeamCount: { color: 'rgba(255,255,255,0.8)', fontSize: 11, fontWeight: '500' },
  headerIconBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(0,0,0,0.2)', alignItems: 'center', justifyContent: 'center' },

  tabBarWrap: { backgroundColor: Colors.background.dark, borderBottomWidth: 1, borderBottomColor: Colors.border.light },
  tabBarContent: { paddingHorizontal: 12, gap: 2 },
  tab: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: Colors.primary.orange, backgroundColor: Colors.primary.orange + '10' },
  tabText: { color: Colors.text.muted, fontSize: 12, fontWeight: '600' },
  tabTextActive: { color: '#fff' },
  tabBadge: { backgroundColor: Colors.background.cardLight, paddingHorizontal: 6, paddingVertical: 1, borderRadius: 10, marginLeft: 2 },
  tabBadgeActive: { backgroundColor: 'rgba(255,255,255,0.2)' },
  tabBadgeText: { color: Colors.text.muted, fontSize: 9, fontWeight: '700' },
  tabBadgeTextActive: { color: '#fff' },

  body: { flex: 1 },
  bodyContent: { padding: 16 },

  progressCard: { backgroundColor: Colors.background.card, borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: Colors.border.light },
  progressHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 },
  progressTitle: { color: '#fff', fontSize: 15, fontWeight: '700' },
  progressSub: { color: Colors.text.muted, fontSize: 12, marginTop: 3 },
  progressPctWrap: { backgroundColor: Colors.primary.orange + '18', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  progressPct: { color: Colors.primary.orange, fontSize: 18, fontWeight: '800' },
  progressBar: { height: 6, backgroundColor: Colors.background.cardLight, borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: Colors.primary.orange, borderRadius: 3 },
  progressLegend: { flexDirection: 'row', gap: 16, marginTop: 10 },
  progressLegendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  progressLegendDot: { width: 7, height: 7, borderRadius: 4 },
  progressLegendText: { color: Colors.text.muted, fontSize: 11 },

  quickActionsCard: { backgroundColor: Colors.background.card, borderRadius: 16, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: Colors.border.light },
  quickActionsTitle: { color: Colors.text.muted, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 },
  quickActionsRow: { flexDirection: 'row', gap: 8 },
  quickActionBtn: { flex: 1, alignItems: 'center', gap: 6, paddingVertical: 10 },
  quickActionIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  quickActionLabel: { color: Colors.text.secondary, fontSize: 10, fontWeight: '600', textAlign: 'center' },

  metricsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 },
  metricCard: { width: (SCREEN_W - 42) / 2 - 5, backgroundColor: Colors.background.card, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: Colors.border.light, alignItems: 'center' },
  metricIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  metricValue: { color: '#fff', fontSize: 22, fontWeight: '800' },
  metricLabel: { color: Colors.text.muted, fontSize: 11, marginTop: 2 },

  championCard: { marginBottom: 20, borderRadius: 20, overflow: 'hidden', borderWidth: 2, borderColor: 'rgba(255,215,0,0.4)' },
  championGradient: { padding: 20 },
  championHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  championTrophyWrap: { width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(255,215,0,0.2)', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'rgba(255,215,0,0.5)' },
  championSparkles: { position: 'relative' },
  championContent: { alignItems: 'center', marginBottom: 20 },
  championLabel: { color: '#FFD700', fontSize: 12, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 8 },
  championName: { color: '#fff', fontSize: 28, fontWeight: '900', textAlign: 'center', marginBottom: 16, textShadowColor: 'rgba(255,215,0,0.3)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 4 },
  championStats: { flexDirection: 'row', alignItems: 'center', gap: 16, backgroundColor: 'rgba(0,0,0,0.3)', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12 },
  championStatItem: { alignItems: 'center' },
  championStatValue: { color: '#FFD700', fontSize: 20, fontWeight: '900' },
  championStatLabel: { color: Colors.text.muted, fontSize: 10, fontWeight: '600', marginTop: 2 },
  championStatDivider: { width: 1, height: 30, backgroundColor: 'rgba(255,215,0,0.2)' },
  championFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 16, borderTopWidth: 1, borderTopColor: 'rgba(255,215,0,0.2)' },
  championBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,215,0,0.15)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,215,0,0.3)' },
  championBadgeText: { color: '#FFD700', fontSize: 11, fontWeight: '800' },
  championDate: { color: Colors.text.muted, fontSize: 11, fontWeight: '600' },

  nextMatchCard: { backgroundColor: Colors.background.card, borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1.5, borderColor: Colors.primary.orange + '40', borderLeftWidth: 4, borderLeftColor: Colors.primary.orange },
  nextMatchHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  nextMatchIconWrap: { width: 24, height: 24, borderRadius: 12, backgroundColor: Colors.primary.orange, alignItems: 'center', justifyContent: 'center' },
  nextMatchLabel: { color: Colors.primary.orange, fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
  nextMatchBody: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  nextMatchHome: { flex: 1, color: '#fff', fontSize: 15, fontWeight: '700' },
  nextMatchVsBadge: { backgroundColor: Colors.background.cardLight, paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10 },
  nextMatchVsText: { color: Colors.text.muted, fontSize: 11, fontWeight: '700' },
  nextMatchAway: { flex: 1, color: '#fff', fontSize: 15, fontWeight: '700', textAlign: 'right' },
  nextMatchFooter: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  nextMatchDate: { color: Colors.text.muted, fontSize: 12 },

  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, marginTop: 8 },
  sectionTitle: { color: '#fff', fontSize: 15, fontWeight: '700' },
  sectionLink: { color: Colors.primary.orange, fontSize: 12, fontWeight: '600' },

  topRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.border.light },
  topRank: { width: 28, height: 28, borderRadius: 14, backgroundColor: Colors.background.cardLight, alignItems: 'center', justifyContent: 'center' },
  topRankGold: { backgroundColor: 'rgba(255,215,0,0.25)' },
  topRankSilver: { backgroundColor: 'rgba(192,192,192,0.25)' },
  topRankBronze: { backgroundColor: 'rgba(205,127,50,0.25)' },
  topRankText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  topName: { flex: 1, color: '#fff', fontSize: 14, fontWeight: '600' },
  topPts: { color: Colors.primary.orange, fontSize: 14, fontWeight: '700', marginRight: 8 },

  matchCard: { backgroundColor: Colors.background.card, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: Colors.border.light },
  matchCardNext: { borderColor: Colors.primary.orange, borderWidth: 2 },
  matchCardAlert: { borderColor: Colors.status.warning + '50' },
  matchCardTBD: { opacity: 0.55, borderStyle: 'dashed' as any },
  matchCardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  roundBadge: { backgroundColor: Colors.primary.orange + '18', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 8 },
  roundBadgeText: { color: Colors.primary.orange, fontSize: 10, fontWeight: '700' },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  statusDotSmall: { width: 5, height: 5, borderRadius: 3 },
  statusDone: { backgroundColor: Colors.status.success + '20' },
  statusPending: { backgroundColor: Colors.status.warning + '20' },
  statusBadgeText: { fontSize: 10, fontWeight: '700' },
  statusDoneText: { color: Colors.status.success },
  statusPendingText: { color: Colors.status.warning },
  matchTeams: { flexDirection: 'row', alignItems: 'center', paddingVertical: 4 },
  matchTeamCol: { flex: 1 },
  matchTeamName: { color: '#fff', fontSize: 14, fontWeight: '600' },
  matchTeamSub: { color: Colors.text.muted, fontSize: 9, marginTop: 2 },
  matchWinnerName: { color: Colors.primary.orange },
  matchScoreCol: { width: 90, alignItems: 'center' },
  scorePill: { backgroundColor: Colors.primary.orange + '18', paddingHorizontal: 14, paddingVertical: 5, borderRadius: 12 },
  matchScoreText: { color: Colors.primary.orange, fontSize: 18, fontWeight: '800' },
  matchVsText: { color: Colors.text.muted, fontSize: 13, fontWeight: '700' },
  scoreInputBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.primary.orange, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 },
  scoreInputBtnText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  matchCardFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: Colors.border.light },
  matchMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, flex: 1 },
  matchMetaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  matchMetaText: { color: Colors.text.muted, fontSize: 11 },
  matchActions: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  matchActionIcon: { width: 32, height: 32, borderRadius: 8, backgroundColor: Colors.background.cardLight, alignItems: 'center', justifyContent: 'center' },

  matchTeamTBD: { color: Colors.text.muted, fontStyle: 'italic' },
  tbdBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.background.cardLight, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10 },
  tbdBadgeText: { color: Colors.text.muted, fontSize: 11, fontWeight: '700' },
  progressionRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 6, paddingTop: 6, borderTopWidth: 1, borderTopColor: Colors.border.light },
  progressionText: { color: Colors.primary.orange, fontSize: 10, fontWeight: '700' },

  matchesHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  typeBadge: { backgroundColor: Colors.primary.blue + '18', paddingHorizontal: 12, paddingVertical: 5, borderRadius: 10 },
  typeBadgeText: { color: Colors.primary.blue, fontSize: 11, fontWeight: '700' },
  addMatchBtnSmall: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: Colors.primary.orange, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 },
  addMatchBtnSmallText: { color: '#fff', fontSize: 12, fontWeight: '700' },

  addMatchBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: Colors.primary.orange, paddingVertical: 12, borderRadius: 12, marginBottom: 14 },
  addMatchBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },

  filterRow: { marginBottom: 14 },
  filterChip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: Colors.background.card, marginRight: 8, borderWidth: 1, borderColor: Colors.border.light },
  filterChipActive: { backgroundColor: Colors.primary.orange, borderColor: Colors.primary.orange },
  filterChipText: { color: Colors.text.muted, fontSize: 12, fontWeight: '600' },
  filterChipTextActive: { color: '#fff' },
  filterChipCount: { backgroundColor: 'rgba(255,255,255,0.15)', paddingHorizontal: 6, paddingVertical: 1, borderRadius: 8 },
  filterChipCountText: { color: 'rgba(255,255,255,0.7)', fontSize: 9, fontWeight: '700' },

  roundSectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: Colors.border.light },
  roundSectionDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.primary.orange },
  roundSectionTitle: { color: '#fff', fontSize: 14, fontWeight: '700', flex: 1 },
  roundSectionCount: { color: Colors.text.muted, fontSize: 11, fontWeight: '600' },

  roundCard: { backgroundColor: Colors.background.card, borderRadius: 16, padding: 16, borderWidth: 1.5, borderColor: Colors.border.light, borderLeftWidth: 4, borderLeftColor: Colors.primary.orange },
  roundCardComplete: { borderLeftColor: Colors.status.success },
  roundCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  roundCardDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.primary.orange },
  roundCardTitle: { color: '#fff', fontSize: 16, fontWeight: '800', flex: 1 },
  roundCardStats: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  roundCardCount: { color: Colors.text.secondary, fontSize: 13, fontWeight: '600' },
  roundCardProgress: { color: Colors.primary.orange, fontSize: 13, fontWeight: '700' },
  roundCardFooter: { paddingTop: 12, borderTopWidth: 1, borderTopColor: Colors.border.light },
  roundCardAction: { color: Colors.primary.orange, fontSize: 13, fontWeight: '700', textAlign: 'center' },

  bigActionBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: Colors.primary.orange, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 20, marginTop: 12 },
  bigActionText: { color: '#fff', fontSize: 15, fontWeight: '700' },

  emptyState: { alignItems: 'center', paddingVertical: 40 },
  emptyTitle: { color: '#fff', fontSize: 16, fontWeight: '700', marginTop: 12 },
  emptyText: { color: Colors.text.muted, fontSize: 13, marginTop: 6, textAlign: 'center' },

  skeletonCard: { backgroundColor: Colors.background.card, borderRadius: 14, padding: 16, gap: 10, borderWidth: 1, borderColor: Colors.border.light },

  podiumCard: { backgroundColor: Colors.background.card, borderRadius: 16, padding: 16, paddingTop: 20, marginBottom: 16, borderWidth: 1, borderColor: Colors.border.light },
  podiumRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', gap: 8 },
  podiumCol: { flex: 1, alignItems: 'center', maxWidth: (SCREEN_W - 80) / 3 },
  podiumCrown: { marginBottom: 4 },
  podiumMedal: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  podiumGold: { backgroundColor: 'rgba(255,215,0,0.25)', borderWidth: 2, borderColor: '#FFD700' },
  podiumSilver: { backgroundColor: 'rgba(192,192,192,0.2)', borderWidth: 2, borderColor: '#C0C0C0' },
  podiumBronze: { backgroundColor: 'rgba(205,127,50,0.2)', borderWidth: 2, borderColor: '#CD7F32' },
  podiumMedalText: { color: '#fff', fontSize: 14, fontWeight: '800' },
  podiumName: { color: '#fff', fontSize: 11, fontWeight: '600', textAlign: 'center', marginBottom: 2 },
  podiumPts: { color: Colors.primary.orange, fontSize: 12, fontWeight: '700', marginBottom: 6 },
  podiumBar: { width: '80%', borderRadius: 6, minHeight: 20 },
  podiumBarGold: { backgroundColor: 'rgba(255,215,0,0.3)' },
  podiumBarSilver: { backgroundColor: 'rgba(192,192,192,0.2)' },
  podiumBarBronze: { backgroundColor: 'rgba(205,127,50,0.2)' },

  standingCard: { backgroundColor: Colors.background.card, borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: Colors.border.light },
  standingCardLeader: { borderColor: 'rgba(255,215,0,0.3)', borderWidth: 1.5 },
  standingCardTop: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  standingRank: { width: 32, height: 32, borderRadius: 10, backgroundColor: Colors.background.cardLight, alignItems: 'center', justifyContent: 'center' },
  standingRankText: { color: '#fff', fontSize: 14, fontWeight: '800' },
  standingInfo: { flex: 1 },
  standingName: { color: '#fff', fontSize: 15, fontWeight: '700' },
  standingSubRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  standingSub: { color: Colors.text.muted, fontSize: 11 },
  standingSubSep: { color: Colors.text.muted, fontSize: 11 },
  standingPtsWrap: { alignItems: 'center', backgroundColor: Colors.primary.orange + '15', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 },
  standingPtsValue: { color: Colors.primary.orange, fontSize: 18, fontWeight: '800', lineHeight: 22 },
  standingPtsLabel: { color: Colors.text.muted, fontSize: 9, fontWeight: '600' },
  standingBarBg: { height: 4, backgroundColor: Colors.background.cardLight, borderRadius: 2, overflow: 'hidden', marginBottom: 10 },
  standingBarFill: { height: '100%', backgroundColor: Colors.primary.orange, borderRadius: 2 },
  standingCardBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  standingStatGroup: { flexDirection: 'row', alignItems: 'center', gap: 0 },
  standingStatItem: { alignItems: 'center', paddingHorizontal: 8 },
  standingStatNum: { color: '#fff', fontSize: 13, fontWeight: '700' },
  standingStatSub: { color: Colors.text.muted, fontSize: 9, marginTop: 1 },
  standingStatDivider: { width: 1, height: 20, backgroundColor: Colors.border.light },
  standingForm: { marginLeft: 'auto' },

  standingSummary: { flexDirection: 'row', backgroundColor: Colors.background.card, borderRadius: 14, padding: 14, marginTop: 6, borderWidth: 1, borderColor: Colors.border.light },
  standingSummaryItem: { flex: 1, alignItems: 'center' },
  standingSummaryValue: { color: '#fff', fontSize: 18, fontWeight: '800' },
  standingSummaryLabel: { color: Colors.text.muted, fontSize: 10, marginTop: 2 },
  standingSummaryDivider: { width: 1, backgroundColor: Colors.border.light },

  formRow: { flexDirection: 'row', gap: 3 },
  formDot: { width: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.background.cardLight },
  formDotW: { backgroundColor: Colors.status.success + '30' },
  formDotD: { backgroundColor: Colors.status.warning + '30' },
  formDotL: { backgroundColor: Colors.status.error + '30' },
  formDotText: { color: '#fff', fontSize: 9, fontWeight: '700' },

  teamsSummaryBar: { flexDirection: 'row', backgroundColor: Colors.background.card, borderRadius: 14, padding: 14, marginBottom: 14, borderWidth: 1, borderColor: Colors.border.light },
  teamsSumItem: { flex: 1, alignItems: 'center' },
  teamsSumValue: { color: '#fff', fontSize: 20, fontWeight: '800' },
  teamsSumLabel: { color: Colors.text.muted, fontSize: 10, marginTop: 2 },
  teamsSumDivider: { width: 1, backgroundColor: Colors.border.light },

  teamCard2: { flexDirection: 'row', backgroundColor: Colors.background.card, borderRadius: 14, overflow: 'hidden', borderWidth: 1, borderColor: Colors.border.light },
  teamCard2Elim: { opacity: 0.55, borderColor: Colors.status.error + '30' },
  teamCard2Leader: { borderColor: '#FFD70040', borderWidth: 1.5 },
  teamCard2Accent: { width: 4, backgroundColor: Colors.primary.orange },
  teamRank2: { width: 40, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.background.cardLight, borderRightWidth: 1, borderRightColor: Colors.border.light },
  teamRank2Text: { color: Colors.text.secondary, fontSize: 16, fontWeight: '800' },
  teamCard2Body: { flex: 1, padding: 12, gap: 8 },
  teamCard2Header: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  teamCard2Name: { color: '#fff', fontSize: 14, fontWeight: '700' },
  teamCard2Tags: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4, flexWrap: 'wrap' },
  teamTag: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: Colors.primary.blue + '15', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  teamTagText: { color: Colors.primary.blue, fontSize: 8, fontWeight: '700' },
  teamPtsBox: { alignItems: 'center', backgroundColor: Colors.primary.orange + '12', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, minWidth: 48 },
  teamPtsNum: { color: Colors.primary.orange, fontSize: 18, fontWeight: '800', lineHeight: 22 },
  teamPtsUnit: { color: Colors.text.muted, fontSize: 8, fontWeight: '600' },
  teamPtsBarBg: { height: 3, backgroundColor: Colors.background.cardLight, borderRadius: 2, overflow: 'hidden' },
  teamPtsBarFill: { height: '100%', backgroundColor: Colors.primary.orange, borderRadius: 2 },
  teamStatsGrid: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.background.cardLight, borderRadius: 8, paddingVertical: 6 },
  teamStatCell: { flex: 1, alignItems: 'center' },
  teamStatCellVal: { color: '#fff', fontSize: 13, fontWeight: '700' },
  teamStatCellLbl: { color: Colors.text.muted, fontSize: 8, fontWeight: '600', marginTop: 1 },
  teamStatCellDivider: { width: 1, height: 18, backgroundColor: Colors.border.light },
  teamBottomRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  teamWinRateWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 },
  teamWinRateLabel: { color: Colors.text.secondary, fontSize: 10, fontWeight: '700', width: 28 },
  teamWinRateBar: { flex: 1, flexDirection: 'row', height: 6, borderRadius: 3, overflow: 'hidden' },
  teamWinRateSeg: { height: '100%' },
  teamFormWrap: { flexDirection: 'row', alignItems: 'center', gap: 3 },

  statCard: { backgroundColor: Colors.background.card, borderRadius: 14, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: Colors.border.light },
  statCardTitle: { color: Colors.text.muted, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 },
  statCardRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  statCardValue: { color: '#fff', fontSize: 14, fontWeight: '600', flex: 1 },
  statCardBig: { color: Colors.primary.orange, fontSize: 18, fontWeight: '800' },
  statCardSub: { color: Colors.text.muted, fontSize: 13 },
  distBar: { flexDirection: 'row', height: 10, borderRadius: 5, overflow: 'hidden', marginBottom: 10 },
  distSeg: { height: '100%' },
  distWin: { backgroundColor: Colors.status.success },
  distDraw: { backgroundColor: Colors.status.warning },
  distLegend: { flexDirection: 'row', gap: 16 },
  distLegendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  distLegendDot: { width: 8, height: 8, borderRadius: 4 },
  distLegendText: { color: Colors.text.muted, fontSize: 11 },

  adminSectionCard: { backgroundColor: Colors.background.card, borderRadius: 16, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: Colors.border.light },
  adminSectionLabel: { color: '#fff', fontSize: 14, fontWeight: '700', marginBottom: 12 },
  adminSectionHint: { color: Colors.text.muted, fontSize: 12, marginBottom: 12 },
  adminAction: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.border.light },
  adminActionHighlight: { backgroundColor: Colors.primary.orange + '08', borderRadius: 12, paddingHorizontal: 10, marginHorizontal: -6, borderBottomWidth: 0, marginBottom: 4 },
  adminIconWrap: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  adminActionTitle: { color: '#fff', fontSize: 14, fontWeight: '600' },
  adminActionSub: { color: Colors.text.muted, fontSize: 12, marginTop: 1 },

  infoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 0 },
  infoGridItem: { width: '50%', paddingVertical: 10, paddingHorizontal: 4 },
  infoGridLabel: { color: Colors.text.muted, fontSize: 11, marginBottom: 3 },
  infoGridValue: { color: '#fff', fontSize: 13, fontWeight: '600' },

  managerHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  managerAddFloatBtn: { width: 38, height: 38, borderRadius: 12, backgroundColor: Colors.primary.orange, alignItems: 'center', justifyContent: 'center' },

  dangerZone: { backgroundColor: Colors.status.error + '08', borderRadius: 16, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: Colors.status.error + '25' },
  dangerZoneTitle: { color: Colors.status.error, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 },
  dangerAction: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  dangerActionTitle: { color: Colors.status.error, fontSize: 14, fontWeight: '600' },
  dangerActionSub: { color: Colors.text.muted, fontSize: 12, marginTop: 1 },

  phaseTracker: { backgroundColor: Colors.background.card, borderRadius: 16, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: Colors.border.light },
  phaseTrackerTitle: { color: Colors.text.muted, fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 },
  phaseNode: { width: 28, height: 28, borderRadius: 14, backgroundColor: Colors.background.cardLight, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: Colors.border.light },
  phaseNodeCurrent: { borderColor: Colors.primary.orange, backgroundColor: Colors.primary.orange + '25' },
  phaseNodeDone: { backgroundColor: Colors.status.success, borderColor: Colors.status.success },
  phaseNodeText: { color: Colors.text.muted, fontSize: 8, fontWeight: '700' },
  phaseConnector: { width: 18, height: 2, backgroundColor: Colors.border.light },
  phaseCurrentLabel: { marginTop: 2 },
  phaseCurrentLabelText: { color: Colors.primary.orange, fontSize: 8, fontWeight: '700', textAlign: 'center' },
  currentPhaseRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: Colors.border.light },
  currentPhaseDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.primary.orange },
  currentPhaseText: { color: Colors.text.muted, fontSize: 11 },

  activityCard: { backgroundColor: Colors.background.card, borderRadius: 16, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: Colors.border.light },
  activityRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  activityRowBorder: { borderBottomWidth: 1, borderBottomColor: Colors.border.light },
  activityDot: { width: 8, height: 8, borderRadius: 4 },
  activityText: { color: Colors.text.secondary, fontSize: 12 },
  activityRound: { color: Colors.text.muted, fontSize: 9, backgroundColor: Colors.background.cardLight, paddingHorizontal: 6, paddingVertical: 1, borderRadius: 6 },
  activityDate: { color: Colors.text.muted, fontSize: 9 },
  activityWinner: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: Colors.primary.orange + '12', paddingHorizontal: 6, paddingVertical: 3, borderRadius: 8 },
  activityWinnerText: { color: Colors.primary.orange, fontSize: 9, fontWeight: '700' },

  nextMatchRoundBadge: { backgroundColor: Colors.background.cardLight, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, marginLeft: 'auto' },
  nextMatchRoundText: { color: Colors.text.muted, fontSize: 9, fontWeight: '700' },

  bracketCard: { backgroundColor: Colors.background.card, borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: Colors.border.light },
  bracketHeader: { marginBottom: 16 },
  bracketTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  bracketTitle: { color: '#fff', fontSize: 16, fontWeight: '800' },
  bracketSubtitle: { color: Colors.text.muted, fontSize: 12, fontWeight: '600' },

  editScoreHint: { color: Colors.text.muted, fontSize: 9, fontWeight: '600', marginTop: 2, textAlign: 'center' },

  advanceRoundSection: { marginBottom: 16 },
  advanceRoundContent: { backgroundColor: Colors.background.card, borderRadius: 16, padding: 16, borderWidth: 1.5, borderColor: Colors.primary.orange + '40', borderLeftWidth: 4, borderLeftColor: Colors.primary.orange },
  advanceRoundHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  advanceRoundTitle: { color: Colors.primary.orange, fontSize: 16, fontWeight: '800' },
  advanceRoundDescription: { color: Colors.text.secondary, fontSize: 13, lineHeight: 18, marginBottom: 12 },
  advanceRoundBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: Colors.primary.orange, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 16 },
  advanceRoundBtnDisabled: { backgroundColor: Colors.background.cardLight, opacity: 0.5 },
  advanceRoundBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  bracketScroll: { alignItems: 'center', gap: 0, paddingRight: 16 },
  bracketRound: { gap: 10, minWidth: 130 },
  bracketRoundName: { color: Colors.text.muted, fontSize: 10, fontWeight: '700', textAlign: 'center', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  bracketMatch: { backgroundColor: Colors.background.cardLight, borderRadius: 10, padding: 8, borderWidth: 1.5, borderColor: Colors.border.light },
  bracketMatchDone: { borderColor: Colors.status.success + '60', backgroundColor: Colors.status.success + '08' },
  bracketMatchTBD: { opacity: 0.4, borderStyle: 'dashed' as any },
  bracketTeamRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 3, paddingHorizontal: 2 },
  bracketTeamRowWinner: { backgroundColor: Colors.primary.orange + '10', borderRadius: 6, marginHorizontal: -2, paddingHorizontal: 4 },
  bracketTeamDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.text.muted + '40' },
  bracketTeamDotWinner: { backgroundColor: Colors.primary.orange },
  bracketTeamName: { color: Colors.text.secondary, fontSize: 11, fontWeight: '600', flex: 1 },
  bracketTeamNameWinner: { color: '#fff', fontWeight: '800' },
  bracketScore: { color: Colors.text.muted, fontSize: 11, fontWeight: '700', minWidth: 18, textAlign: 'right' },
  bracketScoreWinner: { color: Colors.primary.orange, fontWeight: '900' },
  bracketSep: { height: 1, backgroundColor: Colors.border.light, marginVertical: 1 },
  bracketConnectorCol: { justifyContent: 'space-around', paddingVertical: 10, width: 16 },
  bracketConnectorLine: { width: 16, height: 2, backgroundColor: Colors.border.light },

  groupStandingsCard: { backgroundColor: Colors.background.card, borderRadius: 14, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: Colors.border.light },
  groupStandingsHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  groupBadge: { backgroundColor: Colors.primary.blue + '20', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  groupBadgeText: { color: Colors.primary.blue, fontSize: 12, fontWeight: '800' },
  groupStandingsCount: { color: Colors.text.muted, fontSize: 10 },
  groupTableHeader: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: Colors.border.light },
  groupTableHeaderText: { color: Colors.text.muted, fontSize: 9, fontWeight: '700', textAlign: 'center', width: 28 },
  groupTableRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: Colors.border.light },
  groupTableRowQualified: { backgroundColor: Colors.status.success + '08' },
  groupTableRank: { color: Colors.text.muted, fontSize: 11, fontWeight: '700', width: 16 },
  groupTableName: { color: '#fff', fontSize: 11, fontWeight: '600', flex: 1 },
  groupTableCell: { color: Colors.text.secondary, fontSize: 11, fontWeight: '600', textAlign: 'center', width: 28 },

  scoringRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: Colors.border.light },
  scoringRank: { color: Colors.text.muted, fontSize: 12, fontWeight: '700', width: 18 },
  scoringName: { color: '#fff', fontSize: 12, fontWeight: '600', marginBottom: 4 },
  scoringBarBg: { height: 16, backgroundColor: Colors.background.dark, borderRadius: 4, overflow: 'hidden' },
  scoringBarFill: { height: '100%', backgroundColor: Colors.primary.orange, borderRadius: 4, justifyContent: 'center', paddingHorizontal: 4 },
  scoringBarText: { color: '#fff', fontSize: 8, fontWeight: '800' },
  scoringStats: { alignItems: 'flex-end' },
  scoringBP: { color: Colors.status.success, fontSize: 10, fontWeight: '700' },
  scoringBC: { color: Colors.status.error, fontSize: 10, fontWeight: '600' },

  phaseGoalRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6 },
  phaseGoalLabel: { color: Colors.text.secondary, fontSize: 10, fontWeight: '600', width: 70 },
  phaseGoalBarBg: { flex: 1, height: 10, backgroundColor: Colors.background.dark, borderRadius: 5, overflow: 'hidden' },
  phaseGoalBarFill: { height: '100%', backgroundColor: Colors.primary.blue, borderRadius: 5 },
  phaseGoalValue: { color: '#fff', fontSize: 11, fontWeight: '800', width: 24, textAlign: 'right' },
  phaseGoalAvg: { color: Colors.text.muted, fontSize: 9, width: 46, textAlign: 'right' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'flex-end' },
  modalDismiss: { flex: 1 },
  modalContent: { backgroundColor: Colors.background.dark, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: '85%' },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: Colors.border.light },
  modalTitle: { color: '#fff', fontSize: 18, fontWeight: '700' },
  modalClose: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.background.card, alignItems: 'center', justifyContent: 'center' },

  winnerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: Colors.border.light },
  winnerIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: Colors.primary.orange + '20', alignItems: 'center', justifyContent: 'center' },
  winnerName: { flex: 1, color: '#fff', fontSize: 15, fontWeight: '600' },
  winnerCurrentBadge: { backgroundColor: Colors.status.success + '20', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, marginRight: 4 },
  winnerCurrentText: { color: Colors.status.success, fontSize: 10, fontWeight: '700' },

  formWrap: { paddingBottom: 20 },
  fieldLabel: { color: Colors.text.secondary, fontSize: 13, fontWeight: '600', marginBottom: 8 },
  chipRow: { marginBottom: 4 },
  chip: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20, backgroundColor: Colors.background.card, marginRight: 8, borderWidth: 1, borderColor: Colors.border.light },
  chipActive: { backgroundColor: Colors.primary.orange, borderColor: Colors.primary.orange },
  chipText: { color: Colors.text.secondary, fontSize: 13 },
  chipTextActive: { color: '#fff', fontWeight: '600' },
  input: { backgroundColor: Colors.background.card, borderRadius: 12, padding: 14, color: '#fff', fontSize: 15, borderWidth: 1, borderColor: Colors.border.light },
  formBtns: { flexDirection: 'row', gap: 12, marginTop: 20 },
});
