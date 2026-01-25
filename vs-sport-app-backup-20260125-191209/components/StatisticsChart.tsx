import React from 'react';
import { StyleSheet, View, Text } from 'react-native';
import { Colors } from '@/constants/colors';

interface BarChartProps { data: { label: string; value: number; color?: string }[]; maxValue?: number; height?: number; }
interface ProgressRingProps { progress: number; size?: number; strokeWidth?: number; color?: string; label?: string; }
interface StatComparisonProps { label: string; userValue: number; avgValue: number; unit?: string; }

export function BarChart({ data, maxValue, height = 120 }: BarChartProps) {
  const max = maxValue || Math.max(...data.map(d => d.value), 1);
  return (
    <View style={styles.barChartContainer}>
      <View style={[styles.barsWrapper, { height }]}>
        {data.map((item, index) => (
          <View key={index} style={styles.barColumn}>
            <View style={[styles.barBackground, { height }]}>
              <View style={[styles.bar, { height: (item.value / max) * height, backgroundColor: item.color || Colors.primary.blue }]} />
            </View>
            <Text style={styles.barLabel} numberOfLines={1}>{item.label}</Text>
            <Text style={styles.barValue}>{item.value}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

export function ProgressRing({ progress, size = 80, strokeWidth = 8, color = Colors.primary.blue, label }: ProgressRingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const _strokeDashoffset = circumference - (progress / 100) * circumference;
  return (
    <View style={[styles.ringContainer, { width: size, height: size }]}>
      <View style={[styles.ringBackground, { width: size, height: size, borderRadius: size / 2, borderWidth: strokeWidth }]} />
      <View style={[styles.ringProgress, { width: size, height: size, borderRadius: size / 2, borderWidth: strokeWidth, borderColor: color, borderRightColor: 'transparent', borderBottomColor: 'transparent', transform: [{ rotate: `${(progress / 100) * 360 - 90}deg` }] }]} />
      <View style={styles.ringCenter}>
        <Text style={styles.ringValue}>{Math.round(progress)}%</Text>
        {label && <Text style={styles.ringLabel}>{label}</Text>}
      </View>
    </View>
  );
}

export function StatComparison({ label, userValue, avgValue, unit = '' }: StatComparisonProps) {
  const diff = userValue - avgValue;
  const diffPercent = avgValue > 0 ? Math.round((diff / avgValue) * 100) : 0;
  const isPositive = diff >= 0;
  return (
    <View style={styles.comparisonContainer}>
      <Text style={styles.comparisonLabel}>{label}</Text>
      <View style={styles.comparisonValues}>
        <View style={styles.comparisonItem}>
          <Text style={styles.comparisonTitle}>Vous</Text>
          <Text style={styles.comparisonValue}>{userValue}{unit}</Text>
        </View>
        <View style={styles.comparisonDivider} />
        <View style={styles.comparisonItem}>
          <Text style={styles.comparisonTitle}>Moyenne</Text>
          <Text style={styles.comparisonValueMuted}>{avgValue}{unit}</Text>
        </View>
      </View>
      <View style={[styles.diffBadge, isPositive ? styles.diffPositive : styles.diffNegative]}>
        <Text style={[styles.diffText, isPositive ? styles.diffTextPositive : styles.diffTextNegative]}>
          {isPositive ? '+' : ''}{diffPercent}% vs moyenne
        </Text>
      </View>
    </View>
  );
}

export function MatchHistory({ matches }: { matches: { result: 'win' | 'loss' | 'draw'; date: string }[] }) {
  const getColor = (result: string) => {
    switch (result) {
      case 'win': return Colors.status.success;
      case 'loss': return Colors.status.error;
      default: return Colors.text.muted;
    }
  };
  return (
    <View style={styles.historyContainer}>
      <Text style={styles.historyTitle}>Derniers matchs</Text>
      <View style={styles.historyDots}>
        {matches.slice(-10).map((match, index) => (
          <View key={index} style={[styles.historyDot, { backgroundColor: getColor(match.result) }]} accessibilityLabel={`Match ${index + 1}: ${match.result}`} />
        ))}
      </View>
      <View style={styles.historyLegend}>
        <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: Colors.status.success }]} /><Text style={styles.legendText}>Victoire</Text></View>
        <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: Colors.status.error }]} /><Text style={styles.legendText}>Défaite</Text></View>
        <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: Colors.text.muted }]} /><Text style={styles.legendText}>Nul</Text></View>
      </View>
    </View>
  );
}

export function TrendLine({ data, color = Colors.primary.blue }: { data: number[]; color?: string }) {
  const max = Math.max(...data, 1);
  const points = data.map((val, i) => ({ x: (i / (data.length - 1)) * 100, y: 100 - (val / max) * 100 }));
  return (
    <View style={styles.trendContainer} accessibilityLabel={`Tendance: ${data.join(', ')}`}>
      {points.map((point, i) => (
        <React.Fragment key={i}>
          <View style={[styles.trendDot, { left: `${point.x}%`, top: `${point.y}%`, backgroundColor: color }]} />
          {i > 0 && <View style={[styles.trendLine, { left: `${points[i-1].x}%`, top: `${Math.min(points[i-1].y, point.y)}%`, width: `${point.x - points[i-1].x}%`, height: Math.abs(point.y - points[i-1].y) + 2, backgroundColor: `${color}30` }]} />}
        </React.Fragment>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  barChartContainer: { paddingVertical: 16 },
  barsWrapper: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-around' },
  barColumn: { alignItems: 'center', flex: 1 },
  barBackground: { width: 24, backgroundColor: Colors.background.cardLight, borderRadius: 12, justifyContent: 'flex-end', overflow: 'hidden' },
  bar: { width: '100%', borderRadius: 12 },
  barLabel: { color: Colors.text.muted, fontSize: 10, marginTop: 8, textAlign: 'center' },
  barValue: { color: Colors.text.primary, fontSize: 12, fontWeight: '600' as const, marginTop: 4 },
  ringContainer: { alignItems: 'center', justifyContent: 'center' },
  ringBackground: { position: 'absolute', borderColor: Colors.background.cardLight },
  ringProgress: { position: 'absolute' },
  ringCenter: { alignItems: 'center' },
  ringValue: { color: Colors.text.primary, fontSize: 18, fontWeight: '700' as const },
  ringLabel: { color: Colors.text.muted, fontSize: 10, marginTop: 2 },
  comparisonContainer: { backgroundColor: Colors.background.card, borderRadius: 16, padding: 16 },
  comparisonLabel: { color: Colors.text.primary, fontSize: 15, fontWeight: '600' as const, marginBottom: 12 },
  comparisonValues: { flexDirection: 'row', alignItems: 'center' },
  comparisonItem: { flex: 1, alignItems: 'center' },
  comparisonTitle: { color: Colors.text.muted, fontSize: 12 },
  comparisonValue: { color: Colors.text.primary, fontSize: 24, fontWeight: '700' as const, marginTop: 4 },
  comparisonValueMuted: { color: Colors.text.secondary, fontSize: 24, fontWeight: '700' as const, marginTop: 4 },
  comparisonDivider: { width: 1, height: 40, backgroundColor: Colors.border.light },
  diffBadge: { alignSelf: 'center', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, marginTop: 12 },
  diffPositive: { backgroundColor: 'rgba(16, 185, 129, 0.15)' },
  diffNegative: { backgroundColor: 'rgba(239, 68, 68, 0.15)' },
  diffText: { fontSize: 12, fontWeight: '600' as const },
  diffTextPositive: { color: Colors.status.success },
  diffTextNegative: { color: Colors.status.error },
  historyContainer: { backgroundColor: Colors.background.card, borderRadius: 16, padding: 16 },
  historyTitle: { color: Colors.text.primary, fontSize: 15, fontWeight: '600' as const, marginBottom: 12 },
  historyDots: { flexDirection: 'row', justifyContent: 'center', gap: 8 },
  historyDot: { width: 12, height: 12, borderRadius: 6 },
  historyLegend: { flexDirection: 'row', justifyContent: 'center', gap: 16, marginTop: 12 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { color: Colors.text.muted, fontSize: 11 },
  trendContainer: { height: 60, position: 'relative' },
  trendDot: { position: 'absolute', width: 8, height: 8, borderRadius: 4, marginLeft: -4, marginTop: -4 },
  trendLine: { position: 'absolute', borderRadius: 2 },
});
