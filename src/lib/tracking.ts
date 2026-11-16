import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { supabase } from './supabase';

export const TASK_NAME = 'macacadas-location';
const QUEUE_KEY = 'macacadas:pending-points';
const STATE_KEY = 'macacadas:tracker-state';

/*
 * ECONOMIA DE BATERIA
 *
 * O rastreamento tem dois modos e troca sozinho entre eles:
 *
 *  - ANDANDO: GPS preciso, uma leitura a cada ~15 s, entregues em lotes de ~1 min
 *    (o celular acorda e usa a internet uma vez por minuto, não a cada leitura).
 *  - PARADO: depois de ~4 min sem sair do lugar, desliga o GPS forte e usa só
 *    Wi-Fi/rede de celular, com uma leitura a cada ~2 min. Gasta bem menos.
 *    Se a pessoa se afastar ~120 m, volta pro modo ANDANDO.
 *
 * Além disso:
 *  - Só salva um ponto se a pessoa andou pelo menos 25 m (ou a cada 10 min
 *    parada, pra o "há X min" continuar certo no mapa dos amigos).
 *  - Leituras imprecisas (> 60 m) são descartadas.
 *  - Sem internet, os pontos ficam numa fila e vão todos de uma vez depois.
 */

type Mode = 'andando' | 'parado';

type TrackerState = {
  mode: Mode;
  saved?: { lat: number; lng: number; t: number }; // último ponto salvo
  anchor?: { lat: number; lng: number; t: number }; // onde a pessoa "parou"
};

type Pending = {
  lat: number;
  lng: number;
  accuracy: number | null;
  speed: number | null;
  recorded_at: string;
};

const MIN_MOVE_M = 25;
const HEARTBEAT_MS = 10 * 60 * 1000;
const STILL_AFTER_MS = 4 * 60 * 1000;
const STILL_RADIUS_M = 50;
const WAKE_RADIUS_M = 120;
const MAX_ACCURACY_M = 60;

const NOTIFICATION = {
  notificationTitle: 'Macacadas Map',
  notificationBody: 'Compartilhando sua localização com a galera',
  notificationColor: '#FFC93C',
  killServiceOnDestroy: false,
};

function optionsFor(mode: Mode): Location.LocationTaskOptions {
  if (mode === 'parado') {
    return {
      accuracy: Location.Accuracy.Balanced, // Wi-Fi/antenas, sem GPS ligado direto
      timeInterval: 120_000,
      distanceInterval: 0,
      deferredUpdatesInterval: 120_000,
      foregroundService: { ...NOTIFICATION, notificationBody: 'Compartilhando (modo econômico, você está parado)' },
    };
  }
  return {
    accuracy: Location.Accuracy.High,
    timeInterval: 15_000,
    distanceInterval: 0, // precisamos das leituras pra perceber quando a pessoa parou
    deferredUpdatesInterval: 60_000, // entrega em lotes: menos vezes acordando o celular
    foregroundService: NOTIFICATION,
  };
}

function metersBetween(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

async function readState(): Promise<TrackerState> {
  try {
    const raw = await AsyncStorage.getItem(STATE_KEY);
    return raw ? (JSON.parse(raw) as TrackerState) : { mode: 'andando' };
  } catch {
    return { mode: 'andando' };
  }
}

async function writeState(s: TrackerState) {
  await AsyncStorage.setItem(STATE_KEY, JSON.stringify(s));
}

async function readQueue(): Promise<Pending[]> {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    return raw ? (JSON.parse(raw) as Pending[]) : [];
  } catch {
    return [];
  }
}

async function writeQueue(items: Pending[]) {
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(items.slice(-5000)));
}

/** Envia os pontos novos + os que ficaram presos sem internet, numa única requisição. */
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
    await writeQueue(error.code === '42501' ? [] : queue);
  } else {
    await writeQueue([]);
  }
}

function point(p: { lat: number; lng: number; t: number }, accuracy: number | null, speed: number | null): Pending {
  return { lat: p.lat, lng: p.lng, accuracy, speed, recorded_at: new Date(p.t).toISOString() };
}

async function switchMode(state: TrackerState, mode: Mode) {
  if (state.mode === mode) return;
  state.mode = mode;
  try {
    // chamar de novo com a mesma tarefa só troca as opções
    await Location.startLocationUpdatesAsync(TASK_NAME, optionsFor(mode));
  } catch {
    // se não der pra trocar agora, tenta de novo na próxima leitura
    state.mode = mode === 'parado' ? 'andando' : 'parado';
  }
}

TaskManager.defineTask<{ locations: Location.LocationObject[] }>(TASK_NAME, async ({ data, error }) => {
  if (error || !data?.locations?.length) return;
  const state = await readState();
  const toSave: Pending[] = [];

  const readings = [...data.locations].sort((a, b) => a.timestamp - b.timestamp);
  for (const l of readings) {
    const acc = l.coords.accuracy ?? 999;
    const p = { lat: l.coords.latitude, lng: l.coords.longitude, t: l.timestamp };

    if (state.mode === 'parado') {
      // Modo econômico: a leitura é mais grosseira. Só serve pra saber se a pessoa saiu do lugar
      // (descontando a margem de erro) ou pra confirmar que continua lá.
      if (acc > 200) continue;
      const ref = state.anchor ?? state.saved;
      if (ref && metersBetween(ref, p) - acc > WAKE_RADIUS_M) {
        state.anchor = p;
        await switchMode(state, 'andando');
        continue;
      }
      if (state.saved && p.t - state.saved.t >= HEARTBEAT_MS) {
        // continua no mesmo lugar: repete o último ponto bom com o horário novo
        state.saved = { ...state.saved, t: p.t };
        toSave.push(point(state.saved, null, 0));
      }
      continue;
    }

    if (acc > MAX_ACCURACY_M) continue;
    if (!state.anchor || metersBetween(state.anchor, p) > STILL_RADIUS_M) {
      state.anchor = p; // saiu do lugar: novo ponto de referência
    }
    const moved = !state.saved || metersBetween(state.saved, p) >= MIN_MOVE_M;
    const heartbeat = !!state.saved && p.t - state.saved.t >= HEARTBEAT_MS;
    if (moved || heartbeat) {
      state.saved = p;
      toSave.push(point(p, l.coords.accuracy, l.coords.speed));
    }
    if (p.t - state.anchor.t >= STILL_AFTER_MS) {
      await switchMode(state, 'parado');
    }
  }

  await writeState(state);
  if (toSave.length) await sendPoints(toSave);
});

export type StartResult = 'ok' | 'sem-permissao' | 'sem-segundo-plano';

export async function startTracking(): Promise<StartResult> {
  const fg = await Location.requestForegroundPermissionsAsync();
  if (fg.status !== 'granted') return 'sem-permissao';
  const bg = await Location.requestBackgroundPermissionsAsync();

  if (!(await Location.hasStartedLocationUpdatesAsync(TASK_NAME))) {
    const state = await readState();
    state.mode = 'andando';
    state.anchor = undefined;
    await writeState(state);
    await Location.startLocationUpdatesAsync(TASK_NAME, optionsFor('andando'));
  }
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
