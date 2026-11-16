import { Group, LocationRow, Profile, supabase } from './supabase';

export const COLORS = ['#FF6B5B', '#FFC93C', '#2E9E5B', '#5B7CFA', '#B46CFF', '#FF8C42', '#00B5A5', '#FF6FB5'];

export const theme = {
  paper: '#FFF6E0', // fundo creme
  card: '#FFFDF5',
  ink: '#1F1A17', // contornos e texto
  muted: '#5C5248',
  banana: '#FFC93C',
  jungle: '#2E9E5B',
  coral: '#FF6B5B',
  // nomes antigos, usados em alguns lugares
  bg: '#FFF6E0',
  text: '#1F1A17',
  border: '#1F1A17',
  accent: '#FFC93C',
  danger: '#D93A2B',
};

export const fonts = {
  title: 'LuckiestGuy_400Regular',
  hand: 'PatrickHand_400Regular',
};

/** Cor do texto que fica legível em cima da cor dada. */
export function inkOn(hex: string) {
  const n = parseInt(hex.replace('#', ''), 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return 0.299 * r + 0.587 * g + 0.114 * b > 150 ? '#1F1A17' : '#FFF6E0';
}

export async function getMyProfile(userId: string): Promise<Profile | null> {
  const { data } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
  return data as Profile | null;
}

export async function getMyGroup(userId: string): Promise<Group | null> {
  const { data } = await supabase
    .from('group_members')
    .select('joined_at, groups(*)')
    .eq('user_id', userId)
    .order('joined_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  const g = (data as unknown as { groups: Group | null } | null)?.groups;
  return g ?? null;
}

export async function getMembers(groupId: string): Promise<Profile[]> {
  const { data: rows } = await supabase.from('group_members').select('user_id').eq('group_id', groupId);
  const ids = (rows ?? []).map((r: { user_id: string }) => r.user_id);
  if (!ids.length) return [];
  const { data } = await supabase.from('profiles').select('*').in('id', ids).order('name');
  return (data ?? []) as Profile[];
}

export async function getLatestPositions(): Promise<LocationRow[]> {
  const { data } = await supabase.rpc('latest_positions');
  return (data ?? []) as LocationRow[];
}

/** Busca todos os pontos (paginando de 1000 em 1000) num intervalo de tempo. */
export async function getPoints(userIds: string[], from: Date, to: Date): Promise<LocationRow[]> {
  if (!userIds.length) return [];
  const all: LocationRow[] = [];
  const page = 1000;
  for (let off = 0; ; off += page) {
    const { data, error } = await supabase
      .from('locations')
      .select('id,user_id,lat,lng,accuracy,speed,recorded_at')
      .in('user_id', userIds)
      .gte('recorded_at', from.toISOString())
      .lt('recorded_at', to.toISOString())
      .order('recorded_at', { ascending: true })
      .range(off, off + page - 1);
    if (error || !data) break;
    all.push(...(data as LocationRow[]));
    if (data.length < page) break;
  }
  return all;
}

export function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

export function distanceKm(points: { lat: number; lng: number; recorded_at: string }[]) {
  let km = 0;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    // não soma "pulos" de quando o celular ficou sem sinal por muito tempo
    if (new Date(b.recorded_at).getTime() - new Date(a.recorded_at).getTime() > 15 * 60 * 1000) continue;
    const R = 6371;
    const dLat = ((b.lat - a.lat) * Math.PI) / 180;
    const dLng = ((b.lng - a.lng) * Math.PI) / 180;
    const h =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
    km += 2 * R * Math.asin(Math.sqrt(h));
  }
  return km;
}

export function groupByUser(points: LocationRow[]) {
  const m = new Map<string, LocationRow[]>();
  for (const p of points) {
    const arr = m.get(p.user_id) ?? [];
    arr.push(p);
    m.set(p.user_id, arr);
  }
  return m;
}
