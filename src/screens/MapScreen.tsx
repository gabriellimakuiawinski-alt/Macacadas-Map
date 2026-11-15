import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { getLatestPositions, getPoints, startOfDay, theme } from '../lib/data';
import { MapData, MapHandle, MapWeb, toSegments } from '../lib/MapWeb';
import { LocationRow, Profile, supabase } from '../lib/supabase';
import { Avatar } from '../lib/ui';

export function MapScreen({ me, members }: { me: string; members: Profile[] }) {
  const [latest, setLatest] = useState<Record<string, LocationRow>>({});
  const [today, setToday] = useState<LocationRow[]>([]);
  const [showTrails, setShowTrails] = useState(true);
  const map = useRef<MapHandle>(null);
  const ids = useMemo(() => members.map((m) => m.id), [members]);

  const load = useCallback(async () => {
    const [l, t] = await Promise.all([getLatestPositions(), getPoints(ids, startOfDay(new Date()), new Date(Date.now() + 60000))]);
    setLatest(Object.fromEntries(l.map((r) => [r.user_id, r])));
    setToday(t);
  }, [ids]);

  useEffect(() => {
    load();
    const ch = supabase
      .channel('locations-live')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'locations' }, (payload) => {
        const row = payload.new as LocationRow;
        setLatest((prev) => {
          const cur = prev[row.user_id];
          if (cur && cur.recorded_at > row.recorded_at) return prev;
          return { ...prev, [row.user_id]: row };
        });
        if (new Date(row.recorded_at) >= startOfDay(new Date())) setToday((prev) => [...prev, row]);
      })
      .subscribe();
    // atualiza o "há X min" e pega qualquer coisa perdida
    const timer = setInterval(load, 60000);
    return () => {
      clearInterval(timer);
      supabase.removeChannel(ch);
    };
  }, [load]);

  const data: MapData = useMemo(() => {
    const byId = Object.fromEntries(members.map((m) => [m.id, m]));
    const people = Object.values(latest)
      .filter((r) => byId[r.user_id])
      .map((r) => ({
        id: r.user_id,
        name: byId[r.user_id].name,
        color: byId[r.user_id].color,
        lat: r.lat,
        lng: r.lng,
        at: r.recorded_at,
        me: r.user_id === me,
      }));
    const trails = showTrails
      ? members.map((m) => ({
          id: m.id,
          color: m.color,
          segments: toSegments(
            today.filter((p) => p.user_id === m.id).sort((a, b) => a.recorded_at.localeCompare(b.recorded_at)),
          ),
        }))
      : [];
    return { people, trails };
  }, [latest, today, members, me, showTrails]);

  return (
    <View style={{ flex: 1 }}>
      <MapWeb ref={map} data={data} />

      <View style={styles.topRight}>
        <Pressable style={styles.fab} onPress={() => map.current?.fit()}>
          <Text style={styles.fabText}>⤢</Text>
        </Pressable>
        <Pressable style={[styles.fab, !showTrails && { opacity: 0.5 }]} onPress={() => setShowTrails((v) => !v)}>
          <Text style={styles.fabText}>〰</Text>
        </Pressable>
      </View>

      <View style={styles.bottom}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 12 }}>
          {members.map((m) => {
            const pos = latest[m.id];
            return (
              <Pressable
                key={m.id}
                style={[styles.chip, !m.sharing && { opacity: 0.5 }]}
                onPress={() => pos && map.current?.focus(pos.lat, pos.lng)}
              >
                <Avatar name={m.name} color={m.color} size={30} />
                <View style={{ marginLeft: 8 }}>
                  <Text style={styles.chipName}>{m.id === me ? 'Você' : m.name}</Text>
                  <Text style={styles.chipSub}>{!m.sharing ? 'pausado' : pos ? ago(pos.recorded_at) : 'sem sinal ainda'}</Text>
                </View>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
    </View>
  );
}

function ago(iso: string) {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 90) return 'agora';
  if (s < 3600) return `há ${Math.round(s / 60)} min`;
  if (s < 86400) return `há ${Math.round(s / 3600)} h`;
  return `há ${Math.round(s / 86400)} dias`;
}

const styles = StyleSheet.create({
  topRight: { position: 'absolute', right: 12, top: 12, gap: 10 },
  fab: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: theme.card,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: theme.border,
  },
  fabText: { color: theme.text, fontSize: 20, fontWeight: '700' },
  bottom: { position: 'absolute', left: 0, right: 0, bottom: 12 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(20,20,20,0.92)',
    borderRadius: 24,
    paddingVertical: 6,
    paddingLeft: 6,
    paddingRight: 14,
    marginRight: 8,
    borderWidth: 1,
    borderColor: theme.border,
  },
  chipName: { color: theme.text, fontWeight: '700' },
  chipSub: { color: theme.muted, fontSize: 12 },
});
