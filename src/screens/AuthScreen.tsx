import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { theme } from '../lib/data';
import { supabase } from '../lib/supabase';
import { Button, Input } from '../lib/ui';

export function AuthScreen() {
  const [mode, setMode] = useState<'entrar' | 'cadastrar'>('entrar');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit() {
    if (!email.trim() || password.length < 6) {
      Alert.alert('Ops', 'Coloca um e-mail e uma senha de pelo menos 6 caracteres.');
      return;
    }
    setLoading(true);
    try {
      if (mode === 'entrar') {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
      } else {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { data: { name: name.trim() } },
        });
        if (error) throw error;
        if (!data.session) {
          Alert.alert(
            'Confirme o e-mail',
            'Mandamos um link pro seu e-mail. Clica nele (pode abrir uma página que não carrega, tudo bem) e depois volta aqui e entra.',
          );
          setMode('entrar');
        }
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      Alert.alert('Não deu certo', traduz(msg));
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.wrap} keyboardShouldPersistTaps="handled">
          <Text style={styles.logo}>🐒</Text>
          <Text style={styles.title}>Macacadas Map</Text>
          <Text style={styles.sub}>Onde a galera tá e por onde passou</Text>

          {mode === 'cadastrar' && <Input label="Seu nome" value={name} onChangeText={setName} placeholder="Como a galera te chama" />}
          <Input
            label="E-mail"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            placeholder="voce@email.com"
          />
          <Input label="Senha" value={password} onChangeText={setPassword} secureTextEntry placeholder="mínimo 6 caracteres" />

          <Button title={mode === 'entrar' ? 'Entrar' : 'Criar conta'} onPress={submit} loading={loading} style={{ marginTop: 8 }} />
          <Button
            kind="ghost"
            title={mode === 'entrar' ? 'Não tenho conta' : 'Já tenho conta'}
            onPress={() => setMode(mode === 'entrar' ? 'cadastrar' : 'entrar')}
            style={{ marginTop: 10 }}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function traduz(msg: string) {
  if (/Invalid login credentials/i.test(msg)) return 'E-mail ou senha errados.';
  if (/Email not confirmed/i.test(msg)) return 'Você ainda não confirmou o e-mail. Olha sua caixa de entrada (e o spam).';
  if (/already registered/i.test(msg)) return 'Esse e-mail já tem conta. Tenta entrar.';
  if (/rate limit/i.test(msg)) return 'Muitas tentativas. Espera alguns minutos e tenta de novo.';
  return msg;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.bg },
  wrap: { padding: 24, paddingTop: 60 },
  logo: { fontSize: 64, textAlign: 'center' },
  title: { color: theme.accent, fontSize: 32, fontWeight: '900', textAlign: 'center' },
  sub: { color: theme.muted, textAlign: 'center', marginBottom: 32, marginTop: 4 },
});
