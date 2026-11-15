import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { theme } from '../lib/data';
import { supabase } from '../lib/supabase';
import { Button, Input } from '../lib/ui';

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
        <Text style={styles.title}>Entrar na galera</Text>
        <Text style={styles.sub}>Se alguém já criou o grupo, coloca o código de convite dele.</Text>
        <Input value={code} onChangeText={(t) => setCode(t.toUpperCase())} placeholder="Ex: A1B2C3" autoCapitalize="characters" maxLength={6} />
        <Button title="Entrar no grupo" onPress={join} loading={loading === 'join'} />

        <View style={styles.sep}>
          <View style={styles.line} />
          <Text style={{ color: theme.muted, marginHorizontal: 10 }}>ou</Text>
          <View style={styles.line} />
        </View>

        <Text style={styles.sub}>É o primeiro? Cria o grupo e manda o código pros outros.</Text>
        <Input value={name} onChangeText={setName} placeholder="Nome do grupo" />
        <Button kind="ghost" title="Criar grupo novo" onPress={create} loading={loading === 'create'} />

        <Button kind="danger" title="Sair da conta" onPress={() => supabase.auth.signOut()} style={{ marginTop: 40, borderWidth: 0 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.bg },
  wrap: { padding: 24, paddingTop: 48 },
  title: { color: theme.text, fontSize: 26, fontWeight: '800', marginBottom: 6 },
  sub: { color: theme.muted, marginBottom: 14 },
  sep: { flexDirection: 'row', alignItems: 'center', marginVertical: 28 },
  line: { flex: 1, height: 1, backgroundColor: theme.border },
});
