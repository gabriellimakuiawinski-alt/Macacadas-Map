import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { supabase } from './supabase';

export const TASK_NAME = 'macacadas-location';
const QUEUE_KEY = 'macacadas:pending-points';

type Pending = {
  lat: number;
  lng: number;
  accuracy: number | null;
  speed: number | null;
  recorded_at: string;
};

async function readQueue(): Promise<Pending[]> {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    return raw ? (JSON.parse(raw) as Pending[]) : [];
  } catch {
    return [];
  }
}

async function writeQueue(items: Pending[]) {
  // Guarda no máximo ~5000 pontos sem internet
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(items.slice(-5000)));
}

/** Envia os pontos novos + os que ficaram presos sem internet. */
export async function sendPoints(points: Pending[]) {
  const queue = [...(await readQueue()), ...points];
  if (queue.length === 0) return;
  const { data } = await supabase.auth.getSession();
  if (!data.session) {
    await writeQueue(queue);
    return;
  }
  const { error } = await supabase.from('locations').insert(queue);
  if (error) {
    // 42501 = bloqueado pela regra (compartilhamento pausado): descarta
    if (error.code === '42501') await writeQueue([]);
    else await writeQueue(queue);
  } else {
    await writeQueue([]);
  }
}

TaskManager.defineTask<{ locations: Location.LocationObject[] }>(TASK_NAME, async ({ data, error }) => {
  if (error || !data) return;
  const points: Pending[] = data.locations
    .filter((l) => (l.coords.accuracy ?? 0) < 100) // ignora leituras muito imprecisas
    .map((l) => ({
      lat: l.coords.latitude,
      lng: l.coords.longitude,
      accuracy: l.coords.accuracy,
      speed: l.coords.speed,
      recorded_at: new Date(l.timestamp).toISOString(),
    }));
  await sendPoints(points);
});

export type StartResult = 'ok' | 'sem-permissao' | 'sem-segundo-plano';

export async function startTracking(): Promise<StartResult> {
  const fg = await Location.requestForegroundPermissionsAsync();
  if (fg.status !== 'granted') return 'sem-permissao';
  const bg = await Location.requestBackgroundPermissionsAsync();

  if (await Location.hasStartedLocationUpdatesAsync(TASK_NAME)) return bg.status === 'granted' ? 'ok' : 'sem-segundo-plano';

  await Location.startLocationUpdatesAsync(TASK_NAME, {
    accuracy: Location.Accuracy.High,
    distanceInterval: 25, // só manda quando andar ~25 m (economiza bateria e espaço)
    timeInterval: 15000,
    deferredUpdatesInterval: 30000,
    foregroundService: {
      notificationTitle: 'Macacadas Map',
      notificationBody: 'Compartilhando sua localização com a galera',
      notificationColor: '#F5B700',
      killServiceOnDestroy: false,
    },
  });
  return bg.status === 'granted' ? 'ok' : 'sem-segundo-plano';
}

export async function stopTracking() {
  if (await Location.hasStartedLocationUpdatesAsync(TASK_NAME)) {
    await Location.stopLocationUpdatesAsync(TASK_NAME);
  }
}

export async function isTracking() {
  return Location.hasStartedLocationUpdatesAsync(TASK_NAME);
}
