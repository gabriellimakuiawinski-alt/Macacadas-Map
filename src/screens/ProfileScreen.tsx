import { useEffect, useState } from 'react';
import { Alert, Linking, Pressable, ScrollView, Share, StyleSheet, Switch, Text, View } from 'react-native';
import { COLORS, theme } from '../lib/data';
import { Group, Profile, supabase } from '../lib/supabase';
import { isTracking, startTracking, stopTracking } from '../lib/tracking';
import { Avatar, Button, Input } from '../lib/ui';
import { checkForUpdate, currentVersion } from '../lib/updates';

export function ProfileScreen({
  profile,
  group,
  onChanged,
}: {
  profile: Profile;
  group: Group;
  onChanged: () => void;
}) {
  const [name, setName] = useState(profile.name);
  const [tracking, setTracking] = useState<boolean | null>(null);

  useEffect(() => {
    isTracking().then(setTracking);
  }, []);

  async function save(patch: Partial<Profile>) {
    const { error } = await supabase.from('profiles').update(patch).eq('id', profile.id);
    if (error) Alert.alert('Não deu pra salvar', error.message);
    onChanged();
  }

  async function toggleSharing(on: boolean) {
    if (on) {
      await save({ sharing: true });
      const r = await startTracking();
      if (r === 'sem-permissao') {
        Alert.alert('Precisa de permissão', 'Libera a localização pro app nas configurações.', [
          { text: 'Abrir configurações', onPress: () => Linking.openSettings() },
          { text: 'Agora não' },
        ]);
      } else if (r === 'sem-segundo-plano') {
        Alert.alert(
          'Falta um passo',
          'Pra continuar funcionando com a tela bloqueada, vai em Permissões → Localização e escolhe "Permitir o tempo todo".',
          [{ text: 'Abrir configurações', onPress: () => Linking.openSettings() }, { text: 'Depois' }],
        );
      }
    } else {
      await stopTracking();
      await save({ sharing: false });
    }
    setTracking(await isTracking());
  }

  function leave() {
    Alert.alert('Sair do grupo?', 'Você para de ver a galera (e eles param de te ver).', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Sair',
        style: 'destructive',
        onPress: async () => {
          await stopTracking();
          await supabase.from('group_members').delete().eq('group_id', group.id).eq('user_id', profile.id);
          onChanged();
        },
      },
    ]);
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.bg }} contentContainerStyle={{ padding: 20, paddingBottom: 60 }}>
      <View style={{ alignItems: 'center', marginBottom: 24 }}>
        <Avatar name={name} color={profile.color} size={84} />
      </View>

      <Input label="Seu nome" value={name} onChangeText={setName} onEndEditing={() => name.trim() && save({ name: name.trim() })} />

      <Text style={styles.label}>Cor do seu rastro</Text>
      <View style={styles.colors}>
        {COLORS.map((c) => (
          <Pressable
            key={c}
            onPress={() => save({ color: c })}
            style={[styles.color, { backgroundColor: c }, profile.color === c && { borderColor: '#fff', borderWidth: 3 }]}
          />
        ))}
      </View>

      <View style={styles.card}>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardTitle}>Compartilhar localização</Text>
          <Text style={styles.cardSub}>
            {profile.sharing && tracking ? 'Ligado: a galera te vê e seu rastro fica salvo' : 'Pausado: ninguém vê onde você está'}
          </Text>
        </View>
        <Switch
          value={profile.sharing && !!tracking}
          onValueChange={toggleSharing}
          trackColor={{ true: theme.accent, false: theme.border }}
          thumbColor="#fff"
        />
      </View>

      <View style={[styles.card, { flexDirection: 'column', alignItems: 'stretch' }]}>
        <Text style={styles.cardTitle}>{group.name}</Text>
        <Text style={styles.cardSub}>Código de convite</Text>
        <Text style={styles.code}>{group.invite_code}</Text>
        <Button
          kind="ghost"
          title="Mandar convite"
          onPress={() =>
            Share.share({ message: `Bora no Macacadas Map! Entra no grupo "${group.name}" com o código ${group.invite_code}` })
          }
        />
      </View>

      <Text style={styles.tip}>
        Dica: se o rastro some quando o celular fica parado no bolso, vai em Configurações → Apps → Macacadas Map → Bateria e
        coloca "Sem restrições".
      </Text>

      <Button kind="ghost" title="Sair do grupo" onPress={leave} style={{ marginTop: 20 }} />
      <Button
        kind="danger"
        title="Sair da conta"
        onPress={async () => {
          await stopTracking();
          await supabase.auth.signOut();
        }}
        style={{ marginTop: 10, borderWidth: 0 }}
      />

      <Pressable
        onPress={async () => {
          const up = await checkForUpdate();
          if (!up) return Alert.alert('Tudo certo', 'Você já está na versão mais nova.');
          Alert.alert(`Versão nova (v${up.version})`, up.notes || 'Quer baixar agora?', [
            { text: 'Depois', style: 'cancel' },
            { text: 'Atualizar', onPress: () => Linking.openURL(up.url) },
          ]);
        }}
      >
        <Text style={styles.version}>Macacadas Map v{currentVersion()} · toque pra procurar atualização</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  label: { color: theme.muted, marginBottom: 8, fontSize: 13 },
  colors: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 20 },
  color: { width: 40, height: 40, borderRadius: 20, borderWidth: 2, borderColor: 'transparent' },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: theme.border,
  },
  cardTitle: { color: theme.text, fontSize: 16, fontWeight: '700' },
  cardSub: { color: theme.muted, marginTop: 2 },
  code: { color: theme.accent, fontSize: 34, fontWeight: '900', letterSpacing: 6, marginVertical: 10, textAlign: 'center' },
  tip: { color: theme.muted, fontSize: 13, lineHeight: 19 },
  version: { color: theme.muted, fontSize: 12, textAlign: 'center', marginTop: 24 },
});
