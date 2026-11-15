import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { addDays, distanceKm, getPoints, groupByUser, startOfDay, theme } from '../lib/data';
import { MapData, MapWeb, toSegments } from '../lib/MapWeb';
import { LocationRow, Profile } from '../lib/supabase';
import { Avatar } from '../lib/ui';

const DIAS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

export function HistoryScreen({ me, members }: { me: string; members: Profile[] }) {
  const [day, setDay] = useState(() => startOfDay(new Date()));
  const [selected, setSelected] = useState<string | 'todos'>('todos');
  const [points, setPoints] = useState<LocationRow[]>([]);
  const [loading, setLoading] = useState(false);

  const isToday = day.getTime() === startOfDay(new Date()).getTime();
  const ids = useMemo(() => (selected === 'todos' ? members.map((m) => m.id) : [selected]), [selected, members]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    getPoints(ids, day, addDays(day, 1)).then((p) => {
      if (!alive) return;
      setPoints(p);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [ids, day]);

  const byUser = useMemo(() => groupByUser(points), [points]);

  const data: MapData = useMemo(() => {
    const trails = members
      .filter((m) => byUser.has(m.id))
      .map((m) => ({ id: m.id, color: m.color, segments: toSegments(byUser.get(m.id)!) }));
    // marca onde cada um terminou o dia
    const people = members
      .filter((m) => byUser.has(m.id))
      .map((m) => {
        const last = byUser.get(m.id)!.at(-1)!;
        return { id: m.id, name: m.name, color: m.color, lat: last.lat, lng: last.lng, at: last.recorded_at, me: m.id === me };
      });
    return { trails, people };
  }, [byUser, members, me]);

  const label = isToday
    ? 'Hoje'
    : `${DIAS[day.getDay()]}, ${String(day.getDate()).padStart(2, '0')}/${String(day.getMonth() + 1).padStart(2, '0')}/${day.getFullYear()}`;

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.header}>
        <View style={styles.dateRow}>
          <Pressable style={styles.arrow} onPress={() => setDay(addDays(day, -1))}>
            <Text style={styles.arrowText}>‹</Text>
          </Pressable>
          <Text style={styles.date}>{label}</Text>
          <Pressable style={[styles.arrow, isToday && { opacity: 0.3 }]} onPress={() => !isToday && setDay(addDays(day, 1))}>
            <Text style={styles.arrowText}>›</Text>
          </Pressable>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 12 }}>
          <Pressable style={[styles.pill, selected === 'todos' && styles.pillOn]} onPress={() => setSelected('todos')}>
            <Text style={[styles.pillText, selected === 'todos' && { color: '#111' }]}>Todos</Text>
          </Pressable>
          {members.map((m) => (
            <Pressable key={m.id} style={[styles.pill, selected === m.id && styles.pillOn]} onPress={() => setSelected(m.id)}>
              <Avatar name={m.name} color={m.color} size={20} />
              <Text style={[styles.pillText, { marginLeft: 6 }, selected === m.id && { color: '#111' }]}>
                {m.id === me ? 'Você' : m.name}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      <View style={{ flex: 1 }}>
        <MapWeb data={data} resetKey={`${day.getTime()}-${selected}`} />
        {loading && (
          <View style={styles.loading}>
            <ActivityIndicator color={theme.accent} />
          </View>
        )}
        {!loading && points.length === 0 && (
          <View style={styles.empty}>
            <Text style={{ color: theme.text }}>Ninguém se mexeu nesse dia 🙈</Text>
          </View>
        )}
      </View>

      {points.length > 0 && (
        <View style={styles.stats}>
          {members
            .filter((m) => byUser.has(m.id))
            .map((m) => {
              const pts = byUser.get(m.id)!;
              const first = new Date(pts[0].recorded_at);
              const last = new Date(pts[pts.length - 1].recorded_at);
              return (
                <View key={m.id} style={styles.statRow}>
                  <View style={[styles.swatch, { backgroundColor: m.color }]} />
                  <Text style={styles.statName}>{m.id === me ? 'Você' : m.name}</Text>
                  <Text style={styles.statVal}>
                    {distanceKm(pts).toFixed(1)} km · {hhmm(first)}–{hhmm(last)}
                  </Text>
                </View>
              );
            })}
        </View>
      )}
    </View>
  );
}

function hhmm(d: Date) {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

const styles = StyleSheet.create({
  header: { backgroundColor: theme.bg, paddingBottom: 10, borderBottomWidth: 1, borderColor: theme.border },
  dateRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 8 },
  arrow: { width: 48, height: 40, alignItems: 'center', justifyContent: 'center' },
  arrowText: { color: theme.accent, fontSize: 32, fontWeight: '700' },
  date: { color: theme.text, fontSize: 18, fontWeight: '800' },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 18,
    paddingHorizontal: 12,
    height: 34,
  },
  pillOn: { backgroundColor: theme.accent, borderColor: theme.accent },
  pillText: { color: theme.text, fontWeight: '600' },
  loading: { position: 'absolute', top: 12, alignSelf: 'center', backgroundColor: theme.card, padding: 10, borderRadius: 20 },
  empty: { position: 'absolute', top: 12, alignSelf: 'center', backgroundColor: theme.card, padding: 10, borderRadius: 12 },
  stats: { backgroundColor: theme.bg, padding: 12, borderTopWidth: 1, borderColor: theme.border, gap: 6 },
  statRow: { flexDirection: 'row', alignItems: 'center' },
  swatch: { width: 12, height: 12, borderRadius: 6, marginRight: 8 },
  statName: { color: theme.text, fontWeight: '700', flex: 1 },
  statVal: { color: theme.muted },
});
