import { Group, LocationRow, Profile, supabase } from './supabase';

export const COLORS = ['#F5B700', '#FF5A5F', '#3DDC97', '#4EA8FF', '#B46CFF', '#FF8C42', '#00D1C1', '#FF6FB5'];

export const theme = {
  bg: '#121212',
  card: '#1E1E1E',
  border: '#2C2C2C',
  text: '#F2F2F2',
  muted: '#9A9A9A',
  accent: '#F5B700',
  danger: '#FF5A5F',
};

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
