import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { AppState } from 'react-native';

// Chave pública (publishable): pode ficar no app, quem protege os dados são as regras RLS do banco
export const SUPABASE_URL = 'https://vbanqxzqdqopbrtybduv.supabase.co';
export const SUPABASE_KEY = 'sb_publishable_k1UcbBkFK1JcYRngrjJWRA_QjUqTT1d';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

AppState.addEventListener('change', (state) => {
  if (state === 'active') supabase.auth.startAutoRefresh();
  else supabase.auth.stopAutoRefresh();
});

export type Profile = {
  id: string;
  name: string;
  color: string;
  avatar_url: string | null;
  sharing: boolean;
};

export type Group = {
  id: string;
  name: string;
  invite_code: string;
  created_by: string;
};

export type LocationRow = {
  id: number;
  user_id: string;
  lat: number;
  lng: number;
  accuracy: number | null;
  speed: number | null;
  recorded_at: string;
};
