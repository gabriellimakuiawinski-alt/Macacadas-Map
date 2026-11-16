import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { theme } from '../lib/data';
import { supabase } from '../lib/supabase';
import { Button, Hand, Input, Monkey, Title } from '../lib/ui';

export function GroupScreen({ onDone }: { onDone: () => void }) {
  const [code, setCode] = useState('');
  const [name, setName] = useState('Macacadas');
  const [loading, setLoading] = useState<'join' | 'create' | null>(null);

  async function join() {
    if (code.trim().length < 4) return Alert.alert('Ops', 'Coloca o código que te mandaram.');
    setLoading('join');
    const { error } = await supabase.rpc('join_group', { code: code.trim() });
    setLoading(null);
    if (error) return Alert.alert('Não deu', error.message);
    onDone();
  }

  async function create() {
    setLoading('create');
    const { error } = await supabase.rpc('create_group', { group_name: name.trim() });
    setLoading(null);
    if (error) return Alert.alert('Não deu', error.message);
    onDone();
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.wrap} keyboardShouldPersistTaps="handled">
        <View style={{ alignItems: 'center' }}>
          <Monkey size={90} />
        </View>
        <Title size={30} style={{ textAlign: 'center', marginTop: 8 }}>
          ENTRAR NA GALERA
        </Title>
        <Hand style={styles.sub}>Se alguém já criou o grupo, coloca o código de convite.</Hand>
        <Input
          value={code}
          onChangeText={(t) => setCode(t.toUpperCase())}
          placeholder="Ex: A1B2C3"
          autoCapitalize="characters"
          maxLength={6}
        />
        <Button title="Entrar no grupo" onPress={join} loading={loading === 'join'} />

        <View style={styles.sep}>
          <View style={styles.line} />
          <Hand style={{ marginHorizontal: 10 }}>ou</Hand>
          <View style={styles.line} />
        </View>

        <Hand style={styles.sub}>É o primeiro? Cria o grupo e manda o código pros outros.</Hand>
        <Input value={name} onChangeText={setName} placeholder="Nome do grupo" variant="a" />
        <Button kind="ghost" title="Criar grupo novo" onPress={create} loading={loading === 'create'} />

        <Button kind="danger" title="Sair da conta" onPress={() => supabase.auth.signOut()} style={{ marginTop: 30 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.paper },
  wrap: { padding: 24, paddingTop: 28 },
  sub: { color: theme.muted, marginBottom: 12, textAlign: 'center' },
  sep: { flexDirection: 'row', alignItems: 'center', marginVertical: 24 },
  line: { flex: 1, height: 3, backgroundColor: theme.ink, borderRadius: 2 },
});
