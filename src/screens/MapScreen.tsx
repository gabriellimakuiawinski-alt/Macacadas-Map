import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { getLatestPositions, getPoints, startOfDay, theme } from '../lib/data';
import { MapData, MapHandle, MapWeb, toSegments } from '../lib/MapWeb';
import { LocationRow, Profile, supabase } from '../lib/supabase';
import { Avatar, Hand, Icon, Sketch, Title } from '../lib/ui';

export function MapScreen({ me, members }: { me: string; members: Profile[] }) {
  const [latest, setLatest] = useState<Record<string, LocationRow>>({});
  const [today, setToday] = useState<LocationRow[]>([]);
  const [showTrails, setShowTrails] = useState(true);
  const [tick, setTick] = useState(0);
  const map = useRef<MapHandle>(null);
  const ids = useMemo(() => members.map((m) => m.id), [members]);

  const load = useCallback(async () => {
    const [l, t] = await Promise.all([getLatestPositions(), getPoints(ids, startOfDay(new Date()), new Date(Date.now() + 60000))]);
    setLatest(Object.fromEntries(l.map((r) => [r.user_id, r])));
    setToday(t);
  }, [ids]);

  // Economia de bateria: a conexão ao vivo só fica aberta com o app na tela.
  // Quando o app vai pro fundo, desliga; quando volta, recarrega uma vez e religa.
  useEffect(() => {
    let ch: ReturnType<typeof supabase.channel> | null = null;
    let timer: ReturnType<typeof setInterval> | null = null;

    const goLive = () => {
      if (ch) return;
      load();
      ch = supabase
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
      // só atualiza o texto "há X min" (sem internet)
      timer = setInterval(() => setTick((t) => t + 1), 60000);
    };
    const sleep = () => {
      if (ch) supabase.removeChannel(ch);
      ch = null;
      if (timer) clearInterval(timer);
      timer = null;
    };

    if (AppState.currentState === 'active') goLive();
    const sub = AppState.addEventListener('change', (st) => (st === 'active' ? goLive() : sleep()));
    return () => {
      sub.remove();
      sleep();
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
          segments: toSegments(today.filter((p) => p.user_id === m.id).sort((a, b) => a.recorded_at.localeCompare(b.recorded_at))),
        }))
      : [];
    return { people, trails };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [latest, today, members, me, showTrails, tick]);

  return (
    <View style={{ flex: 1, backgroundColor: theme.paper }}>
      <MapWeb ref={map} data={data} />

      <View style={styles.top} pointerEvents="box-none">
        <Sketch bg={theme.banana} style={{ transform: [{ rotate: '-2deg' }] }}>
          <Title size={22} style={{ paddingHorizontal: 14, paddingBottom: 2 }}>
            MACACADAS MAP
          </Title>
        </Sketch>
        <View style={{ flexDirection: 'row', gap: 6 }}>
          <Pressable accessibilityLabel="Ver todo mundo" onPress={() => map.current?.fit()}>
            <Sketch variant="b" shadow={3} style={styles.fab}>
              <View style={styles.fabIn}>
                <Icon name="expand" size={22} />
              </View>
            </Sketch>
          </Pressable>
          <Pressable accessibilityLabel="Mostrar ou esconder rastros" onPress={() => setShowTrails((v) => !v)}>
            <Sketch variant="b" shadow={3} bg={showTrails ? theme.card : '#E6DCC4'} style={styles.fab}>
              <View style={styles.fabIn}>
                <Icon name="trail" size={24} color={showTrails ? theme.ink : theme.muted} />
              </View>
            </Sketch>
          </Pressable>
        </View>
      </View>

      <View style={styles.bottom}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 12, gap: 8 }}>
          {members.map((m) => {
            const pos = latest[m.id];
            return (
              <Pressable key={m.id} onPress={() => pos && map.current?.focus(pos.lat, pos.lng)} style={{ opacity: m.sharing ? 1 : 0.6 }}>
                <Sketch>
                  <View style={styles.chip}>
                    <Avatar name={m.name} color={m.color} size={32} />
                    <View style={{ marginLeft: 8 }}>
                      <Hand size={18} style={{ lineHeight: 19 }}>
                        {m.id === me ? 'Você' : m.name}
                      </Hand>
                      <Hand size={15} color={theme.muted} style={{ lineHeight: 16 }}>
                        {!m.sharing ? 'pausado' : pos ? ago(pos.recorded_at) : 'sem sinal ainda'}
                      </Hand>
                    </View>
                  </View>
                </Sketch>
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
  top: { position: 'absolute', left: 12, right: 12, top: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  fab: { width: 49, height: 49 },
  fabIn: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  bottom: { position: 'absolute', left: 0, right: 0, bottom: 14 },
  chip: { flexDirection: 'row', alignItems: 'center', paddingVertical: 5, paddingLeft: 5, paddingRight: 14 },
});
