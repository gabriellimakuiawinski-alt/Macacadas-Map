import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, TextInputProps, View, ViewStyle } from 'react-native';
import { theme } from './data';

export function Button({
  title,
  onPress,
  kind = 'primary',
  loading,
  style,
}: {
  title: string;
  onPress: () => void;
  kind?: 'primary' | 'ghost' | 'danger';
  loading?: boolean;
  style?: ViewStyle;
}) {
  const bg = kind === 'primary' ? theme.accent : 'transparent';
  const color = kind === 'primary' ? '#111' : kind === 'danger' ? theme.danger : theme.text;
  return (
    <Pressable
      onPress={loading ? undefined : onPress}
      style={({ pressed }) => [
        styles.btn,
        { backgroundColor: bg, borderColor: kind === 'primary' ? bg : theme.border, opacity: pressed ? 0.7 : 1 },
        style,
      ]}
    >
      {loading ? <ActivityIndicator color={color} /> : <Text style={[styles.btnText, { color }]}>{title}</Text>}
    </Pressable>
  );
}

export function Input(props: TextInputProps & { label?: string }) {
  return (
    <View style={{ marginBottom: 12 }}>
      {props.label ? <Text style={styles.label}>{props.label}</Text> : null}
      <TextInput placeholderTextColor={theme.muted} {...props} style={[styles.input, props.style]} />
    </View>
  );
}

export function Avatar({ name, color, size = 36 }: { name: string; color: string; size?: number }) {
  return (
    <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2, backgroundColor: color }]}>
      <Text style={{ color: '#111', fontWeight: '800', fontSize: size * 0.42 }}>{(name || '?').charAt(0).toUpperCase()}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  btn: { height: 50, borderRadius: 14, alignItems: 'center', justifyContent: 'center', borderWidth: 1, paddingHorizontal: 16 },
  btnText: { fontSize: 16, fontWeight: '700' },
  label: { color: theme.muted, marginBottom: 6, fontSize: 13 },
  input: {
    backgroundColor: theme.card,
    borderColor: theme.border,
    borderWidth: 1,
    borderRadius: 12,
    color: theme.text,
    paddingHorizontal: 14,
    height: 50,
    fontSize: 16,
  },
  avatar: { alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#fff' },
});
