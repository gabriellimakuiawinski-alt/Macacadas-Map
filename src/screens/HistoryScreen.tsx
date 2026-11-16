import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { addDays, distanceKm, getPoints, groupByUser, startOfDay, theme } from '../lib/data';
import { MapData, MapWeb, toSegments } from '../lib/MapWeb';
import { LocationRow, Profile } from '../lib/supabase';
import { Avatar, Hand, Icon, Sketch, Title } from '../lib/ui';

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
    const trails = members.filter((m) => byUser.has(m.id)).map((m) => ({ id: m.id, color: m.color, segments: toSegments(byUser.get(m.id)!) }));
    const people = members
      .filter((m) => byUser.has(m.id))
      .map((m) => {
        const last = byUser.get(m.id)!.at(-1)!;
        return { id: m.id, name: m.name, color: m.color, lat: last.lat, lng: last.lng, at: last.recorded_at, me: m.id === me };
      });
    return { trails, people };
  }, [byUser, members, me]);

  const label = isToday
    ? 'HOJE'
    : `${DIAS[day.getDay()].toUpperCase()}, ${String(day.getDate()).padStart(2, '0')}/${String(day.getMonth() + 1).padStart(2, '0')}`;

  return (
    <View style={{ flex: 1, backgroundColor: theme.paper }}>
      <View style={styles.header}>
        <View style={styles.dateRow}>
          <Pressable accessibilityLabel="Dia anterior" style={styles.arrow} onPress={() => setDay(addDays(day, -1))}>
            <Icon name="chevL" size={28} />
          </Pressable>
          <Sketch bg={theme.banana} style={{ transform: [{ rotate: '-1.5deg' }] }}>
            <Title size={22} style={{ paddingHorizontal: 16 }}>
              {label}
            </Title>
          </Sketch>
          <Pressable
            accessibilityLabel="Próximo dia"
            style={[styles.arrow, isToday && { opacity: 0.25 }]}
            onPress={() => !isToday && setDay(addDays(day, 1))}
          >
            <Icon name="chevR" size={28} />
          </Pressable>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingHorizontal: 12, paddingBottom: 4 }}>
          <Pressable onPress={() => setSelected('todos')}>
            <Sketch bg={selected === 'todos' ? theme.banana : theme.card} variant="b" shadow={3}>
              <Hand size={18} style={styles.pill}>
                Todos
              </Hand>
            </Sketch>
          </Pressable>
          {members.map((m) => (
            <Pressable key={m.id} onPress={() => setSelected(m.id)}>
              <Sketch bg={selected === m.id ? theme.banana : theme.card} variant="b" shadow={3}>
                <View style={[styles.pillRow]}>
                  <Avatar name={m.name} color={m.color} size={22} />
                  <Hand size={18} style={{ marginLeft: 6 }}>
                    {m.id === me ? 'Você' : m.name}
                  </Hand>
                </View>
              </Sketch>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      <View style={{ flex: 1 }}>
        <MapWeb data={data} resetKey={`${day.getTime()}-${selected}`} />
        {loading && (
          <View style={styles.float}>
            <Sketch>
              <ActivityIndicator color={theme.ink} style={{ padding: 10 }} />
            </Sketch>
          </View>
        )}
        {!loading && points.length === 0 && (
          <View style={styles.float}>
            <Sketch>
              <Hand size={19} style={{ paddingHorizontal: 14, paddingVertical: 6 }}>
                Ninguém se mexeu nesse dia
              </Hand>
            </Sketch>
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
                  <Hand size={19} style={{ flex: 1 }}>
                    {m.id === me ? 'Você' : m.name}
                  </Hand>
                  <Hand size={18} color={theme.muted}>
                    {distanceKm(pts).toFixed(1)} km · {hhmm(first)}–{hhmm(last)}
                  </Hand>
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
  header: { backgroundColor: theme.paper, paddingBottom: 8, borderBottomWidth: 3, borderColor: theme.ink },
  dateRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 8, paddingVertical: 8 },
  arrow: { width: 48, height: 44, alignItems: 'center', justifyContent: 'center' },
  pill: { paddingHorizontal: 14, paddingVertical: 4 },
  pillRow: { flexDirection: 'row', alignItems: 'center', paddingLeft: 5, paddingRight: 12, paddingVertical: 4 },
  float: { position: 'absolute', top: 12, alignSelf: 'center' },
  stats: { backgroundColor: theme.paper, padding: 12, borderTopWidth: 3, borderColor: theme.ink, gap: 4 },
  statRow: { flexDirection: 'row', alignItems: 'center' },
  swatch: { width: 14, height: 14, borderRadius: 7, marginRight: 8, borderWidth: 2, borderColor: theme.ink },
});
