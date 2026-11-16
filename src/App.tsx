import { LuckiestGuy_400Regular } from '@expo-google-fonts/luckiest-guy';
import { PatrickHand_400Regular } from '@expo-google-fonts/patrick-hand';
import { Session } from '@supabase/supabase-js';
import { useFonts } from 'expo-font';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, AppState, Linking, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { getMembers, getMyGroup, getMyProfile, theme } from './lib/data';
import { Hand, Icon } from './lib/ui';
import { Group, Profile, supabase } from './lib/supabase';
import { sendPoints, startTracking } from './lib/tracking';
import { checkForUpdate } from './lib/updates';
import { AuthScreen } from './screens/AuthScreen';
import { GroupScreen } from './screens/GroupScreen';
import { HistoryScreen } from './screens/HistoryScreen';
import { MapScreen } from './screens/MapScreen';
import { ProfileScreen } from './screens/ProfileScreen';

type Tab = 'mapa' | 'historico' | 'perfil';

export default function App() {
  const [fontsLoaded] = useFonts({ LuckiestGuy_400Regular, PatrickHand_400Regular });
  if (!fontsLoaded) return <View style={styles.center} />;
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <UpdateChecker />
      <Root />
    </SafeAreaProvider>
  );
}

/** Ao abrir o app (e ao voltar pra ele), avisa se tem versão nova no GitHub. */
function UpdateChecker() {
  const lastCheck = useRef(0);
  const dismissed = useRef(0);

  useEffect(() => {
    async function check() {
      if (Date.now() - lastCheck.current < 30 * 60 * 1000) return;
      lastCheck.current = Date.now();
      const up = await checkForUpdate();
      if (!up || up.version === dismissed.current) return;
      Alert.alert(
        `Atualização disponível (v${up.version})`,
        `${up.notes ? up.notes + '\n\n' : ''}Toca em Atualizar, espera baixar e abre o arquivo pra instalar por cima. Seu login continua salvo.`,
        [
          { text: 'Depois', style: 'cancel', onPress: () => (dismissed.current = up.version) },
          { text: 'Atualizar', onPress: () => Linking.openURL(up.url) },
        ],
      );
    }
    check();
    const sub = AppState.addEventListener('change', (st) => st === 'active' && check());
    return () => sub.remove();
  }, []);

  return null;
}

function Root() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [group, setGroup] = useState<Group | null | undefined>(undefined);
  const [members, setMembers] = useState<Profile[]>([]);
  const [tab, setTab] = useState<Tab>('mapa');

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  const refresh = useCallback(async () => {
    if (!session) return;
    const uid = session.user.id;
    const [p, g] = await Promise.all([getMyProfile(uid), getMyGroup(uid)]);
    setProfile(p);
    setGroup(g);
    setMembers(g ? await getMembers(g.id) : []);
  }, [session]);

  useEffect(() => {
    if (!session) {
      setProfile(null);
      setGroup(undefined);
      return;
    }
    refresh();
    // manda pontos que ficaram guardados sem internet
    sendPoints([]);
  }, [session, refresh]);

  // Liga o rastreamento automaticamente quando entra no grupo com o compartilhamento ligado
  useEffect(() => {
    if (!profile?.sharing || !group) return;
    startTracking().then((r) => {
      if (r === 'sem-permissao') {
        Alert.alert('Localização bloqueada', 'Sem permissão de localização o app não consegue te mostrar pra galera.', [
          { text: 'Abrir configurações', onPress: () => Linking.openSettings() },
          { text: 'Agora não' },
        ]);
      } else if (r === 'sem-segundo-plano') {
        Alert.alert(
          'Quase lá',
          'Pra o rastro continuar com a tela bloqueada, escolhe "Permitir o tempo todo" na permissão de localização.',
          [{ text: 'Abrir configurações', onPress: () => Linking.openSettings() }, { text: 'Depois' }],
        );
      }
    });
  }, [profile?.sharing, group?.id]);

  // Mudanças de perfil da galera (cor, nome, pausa) em tempo real
  useEffect(() => {
    if (!group) return;
    const ch = supabase
      .channel('profiles-live')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles' }, () => refresh())
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [group?.id, refresh]);

  if (session === undefined || (session && group === undefined)) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={theme.ink} size="large" />
      </View>
    );
  }
  if (!session) return <AuthScreen />;
  if (!group || !profile) return <GroupScreen onDone={refresh} />;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={{ flex: 1 }}>
        {tab === 'mapa' && <MapScreen me={profile.id} members={members} />}
        {tab === 'historico' && <HistoryScreen me={profile.id} members={members} />}
        {tab === 'perfil' && <ProfileScreen profile={profile} group={group} onChanged={refresh} />}
      </View>
      <SafeAreaView edges={['bottom']} style={styles.tabs}>
        <TabBtn label="Mapa" icon="map" on={tab === 'mapa'} onPress={() => setTab('mapa')} />
        <TabBtn label="Histórico" icon="calendar" on={tab === 'historico'} onPress={() => setTab('historico')} />
        <TabBtn label="Perfil" icon="person" on={tab === 'perfil'} onPress={() => setTab('perfil')} />
      </SafeAreaView>
    </SafeAreaView>
  );
}

function TabBtn({ label, icon, on, onPress }: { label: string; icon: 'map' | 'calendar' | 'person'; on: boolean; onPress: () => void }) {
  return (
    <Pressable style={styles.tab} onPress={onPress} accessibilityRole="tab" accessibilityState={{ selected: on }}>
      <View style={[styles.tabIcon, on && styles.tabIconOn]}>
        <Icon name={icon} size={24} />
      </View>
      <Hand size={17} style={{ lineHeight: 18 }}>
        {label}
      </Hand>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.paper },
  safe: { flex: 1, backgroundColor: theme.paper },
  tabs: { flexDirection: 'row', borderTopWidth: 3, borderColor: theme.ink, backgroundColor: theme.banana, paddingTop: 6, paddingBottom: 4 },
  tab: { flex: 1, alignItems: 'center', minHeight: 56, justifyContent: 'center' },
  tabIcon: {
    paddingHorizontal: 14,
    paddingVertical: 3,
    borderWidth: 3,
    borderColor: 'transparent',
    borderTopLeftRadius: 8,
    borderTopRightRadius: 18,
    borderBottomRightRadius: 8,
    borderBottomLeftRadius: 18,
  },
  tabIconOn: { borderColor: theme.ink, backgroundColor: theme.card },
});
