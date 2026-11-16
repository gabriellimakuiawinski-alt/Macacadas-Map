import { useEffect, useState } from 'react';
import { Alert, Linking, Pressable, ScrollView, Share, StyleSheet, Switch, View } from 'react-native';
import { COLORS, theme } from '../lib/data';
import { Group, Profile, supabase } from '../lib/supabase';
import { isTracking, startTracking, stopTracking } from '../lib/tracking';
import { Avatar, Button, Hand, Icon, Input, Sketch, Title } from '../lib/ui';
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

  const on = profile.sharing && !!tracking;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.paper }} contentContainerStyle={{ padding: 20, paddingBottom: 50 }}>
      <View style={{ alignItems: 'center', marginBottom: 12 }}>
        <Avatar name={name} color={profile.color} size={92} />
      </View>

      <Input label="Seu nome" value={name} onChangeText={setName} onEndEditing={() => name.trim() && save({ name: name.trim() })} />

      <Hand size={19} style={{ marginBottom: 8 }}>
        Cor do seu rastro
      </Hand>
      <View style={styles.colors}>
        {COLORS.map((c) => {
          const picked = profile.color === c;
          return (
            <Pressable
              key={c}
              accessibilityLabel={picked ? 'Cor escolhida' : 'Escolher cor'}
              onPress={() => save({ color: c })}
              style={[styles.ring, picked && styles.ringOn]}
            >
              <View style={[styles.color, { backgroundColor: c }]} />
            </Pressable>
          );
        })}
      </View>

      <Sketch style={{ marginBottom: 16 }}>
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Title size={19}>{on ? 'COMPARTILHANDO' : 'PAUSADO'}</Title>
            <Hand size={17} color={theme.muted} style={{ lineHeight: 19 }}>
              {on ? 'A galera te vê e seu rastro fica salvo' : 'Ninguém vê onde você está'}
            </Hand>
          </View>
          <Switch value={on} onValueChange={toggleSharing} trackColor={{ true: theme.jungle, false: '#CFC4AE' }} thumbColor={theme.card} />
        </View>
      </Sketch>

      <Sketch bg={theme.banana} variant="b" style={{ marginBottom: 16, transform: [{ rotate: '-1deg' }] }}>
        <View style={{ alignItems: 'center', padding: 14 }}>
          <Hand size={19}>Código da galera · {group.name}</Hand>
          <Title size={40} style={{ letterSpacing: 6, marginVertical: 4 }}>
            {group.invite_code}
          </Title>
          <Button
            kind="ghost"
            title="Mandar convite"
            icon={<Icon name="share" size={20} />}
            onPress={() => Share.share({ message: `Bora no Macacadas Map! Entra no grupo "${group.name}" com o código ${group.invite_code}` })}
          />
        </View>
      </Sketch>

      <Hand size={16} color={theme.muted} style={{ lineHeight: 19 }}>
        Dica: se o rastro parar quando o celular fica no bolso, vai em Configurações → Apps → Macacadas Map → Bateria e coloca "Sem
        restrições". O app já economiza sozinho: quando você fica parado, ele desliga o GPS forte.
      </Hand>

      <Button kind="link" title="Sair do grupo" onPress={leave} style={{ marginTop: 16 }} />
      <Button
        kind="danger"
        title="Sair da conta"
        onPress={async () => {
          await stopTracking();
          await supabase.auth.signOut();
        }}
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
        style={{ marginTop: 18, minHeight: 44, justifyContent: 'center' }}
      >
        <Hand size={16} color={theme.muted} style={{ textAlign: 'center' }}>
          Macacadas Map v{currentVersion()} · toque pra procurar atualização
        </Hand>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  colors: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
  ring: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  ringOn: { borderWidth: 3, borderColor: theme.ink },
  color: { width: 36, height: 36, borderRadius: 18, borderWidth: 3, borderColor: theme.ink },
  row: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 10 },
});
