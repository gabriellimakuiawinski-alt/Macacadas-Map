import { useState } from 'react';
import { Alert, KeyboardAvoidingView, ScrollView, StyleSheet, View } from 'react-native';
import Svg, { Ellipse, Path } from 'react-native-svg';
import { SafeAreaView } from 'react-native-safe-area-context';
import { fonts, theme } from '../lib/data';
import { supabase } from '../lib/supabase';
import { Button, Hand, Input, Monkey, Title } from '../lib/ui';

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
    <View style={styles.safe}>
      <JungleTop />
      <SafeAreaView style={{ flex: 1 }}>
        <KeyboardAvoidingView behavior="height" style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={styles.wrap} keyboardShouldPersistTaps="handled">
            <View style={{ alignItems: 'center', marginTop: 30 }}>
              <Monkey size={140} />
            </View>
            <Title
              size={44}
              color={theme.banana}
              style={styles.title}
            >
              MACACADAS{'\n'}MAP
            </Title>
            <Hand size={21} style={{ textAlign: 'center', marginBottom: 26 }}>
              Onde a galera tá e por onde passou
            </Hand>

            {mode === 'cadastrar' && <Input label="Seu nome" value={name} onChangeText={setName} placeholder="Como a galera te chama" variant="a" />}
            <Input
              label="E-mail"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              placeholder="voce@email.com"
            />
            <Input label="Senha" value={password} onChangeText={setPassword} secureTextEntry placeholder="mínimo 6 caracteres" variant="a" />

            <Button title={mode === 'entrar' ? 'Bora!' : 'Criar conta'} onPress={submit} loading={loading} style={{ marginTop: 10 }} />
            <Button
              kind="link"
              title={mode === 'entrar' ? 'Não tenho conta ainda' : 'Já tenho conta'}
              onPress={() => setMode(mode === 'entrar' ? 'cadastrar' : 'entrar')}
              style={{ marginTop: 10 }}
            />
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

/** Folhagem da selva no topo da tela. */
function JungleTop() {
  return (
    <Svg width="100%" height={210} viewBox="0 0 390 210" preserveAspectRatio="none" style={StyleSheet.absoluteFill}>
      <Path d="M-10 -10 H 400 V 130 C 330 170, 270 120, 200 150 S 70 180, -10 140 Z" fill={theme.jungle} stroke={theme.ink} strokeWidth="3" />
      <Path d="M30 -10 C 40 40, 20 70, 40 100" stroke={theme.ink} strokeWidth="3" fill="none" />
      <Path d="M360 -10 C 350 50, 372 90, 352 128" stroke={theme.ink} strokeWidth="3" fill="none" />
      <Ellipse cx="40" cy="106" rx="14" ry="8" fill="#7CCB7E" stroke={theme.ink} strokeWidth="2.5" transform="rotate(-30 40 106)" />
      <Ellipse cx="352" cy="134" rx="14" ry="8" fill="#7CCB7E" stroke={theme.ink} strokeWidth="2.5" transform="rotate(25 352 134)" />
    </Svg>
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
  safe: { flex: 1, backgroundColor: theme.paper },
  wrap: { padding: 26, paddingBottom: 40 },
  title: {
    textAlign: 'center',
    lineHeight: 46,
    marginTop: 6,
    marginBottom: 6,
    fontFamily: fonts.title,
    textShadowColor: theme.ink,
    textShadowOffset: { width: 3, height: 3 },
    textShadowRadius: 1,
    transform: [{ rotate: '-2deg' }],
  },
});
