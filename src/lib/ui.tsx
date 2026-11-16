import { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  TextProps,
  View,
  ViewStyle,
} from 'react-native';
import Svg, { Circle, Ellipse, Path, Rect } from 'react-native-svg';
import { fonts, inkOn, theme } from './data';

/** Cantos "tortos" pra parecer desenhado à mão (duas variações). */
const WOBBLE_A = { borderTopLeftRadius: 22, borderTopRightRadius: 8, borderBottomRightRadius: 20, borderBottomLeftRadius: 10 };
const WOBBLE_B = { borderTopLeftRadius: 9, borderTopRightRadius: 20, borderBottomRightRadius: 8, borderBottomLeftRadius: 22 };

/** Caixa com contorno grosso e sombra preta "chapada" de quadrinho. */
export function Sketch({
  children,
  style,
  bg = theme.card,
  variant = 'a',
  shadow = 4,
}: {
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  bg?: string;
  variant?: 'a' | 'b';
  shadow?: number;
}) {
  const wob = variant === 'a' ? WOBBLE_A : WOBBLE_B;
  return (
    <View style={[{ marginRight: shadow, marginBottom: shadow }, style]}>
      <View style={[StyleSheet.absoluteFill, wob, { backgroundColor: theme.ink, transform: [{ translateX: shadow }, { translateY: shadow }] }]} />
      <View style={[wob, { flex: 1, backgroundColor: bg, borderWidth: 3, borderColor: theme.ink, overflow: 'hidden' }]}>{children}</View>
    </View>
  );
}

export function Title(props: TextProps & { size?: number; color?: string }) {
  const { size = 24, color = theme.ink, style, ...rest } = props;
  return <Text {...rest} style={[{ fontFamily: fonts.title, fontSize: size, color, paddingTop: size * 0.12 }, style]} />;
}

export function Hand(props: TextProps & { size?: number; color?: string }) {
  const { size = 19, color = theme.ink, style, ...rest } = props;
  return <Text {...rest} style={[{ fontFamily: fonts.hand, fontSize: size, color }, style]} />;
}

export function Button({
  title,
  onPress,
  kind = 'primary',
  loading,
  style,
  icon,
}: {
  title: string;
  onPress: () => void;
  kind?: 'primary' | 'ghost' | 'danger' | 'link';
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
  icon?: ReactNode;
}) {
  if (kind === 'link' || kind === 'danger') {
    return (
      <Pressable onPress={loading ? undefined : onPress} style={({ pressed }) => [styles.link, { opacity: pressed ? 0.6 : 1 }, style]}>
        <Hand size={20} color={kind === 'danger' ? theme.danger : theme.ink} style={{ textDecorationLine: 'underline' }}>
          {title}
        </Hand>
      </Pressable>
    );
  }
  const bg = kind === 'primary' ? theme.banana : theme.card;
  return (
    <Pressable onPress={loading ? undefined : onPress} style={style}>
      {({ pressed }) => (
        <Sketch bg={bg} variant={kind === 'primary' ? 'a' : 'b'} shadow={pressed ? 1 : 4} style={{ transform: [{ translateX: pressed ? 3 : 0 }, { translateY: pressed ? 3 : 0 }] }}>
          <View style={styles.btnInner}>
            {loading ? (
              <ActivityIndicator color={theme.ink} />
            ) : (
              <>
                {icon}
                {kind === 'primary' ? <Title size={24}>{title.toUpperCase()}</Title> : <Hand size={21}>{title}</Hand>}
              </>
            )}
          </View>
        </Sketch>
      )}
    </Pressable>
  );
}

export function Input(props: TextInputProps & { label?: string; variant?: 'a' | 'b' }) {
  const { label, variant = 'b', style, ...rest } = props;
  return (
    <View style={{ marginBottom: 14 }}>
      {label ? <Hand size={19} style={{ marginBottom: 4 }}>{label}</Hand> : null}
      <Sketch variant={variant} shadow={3}>
        <TextInput placeholderTextColor="#8A7F72" {...rest} style={[styles.input, style]} />
      </Sketch>
    </View>
  );
}

export function Avatar({ name, color, size = 36 }: { name: string; color: string; size?: number }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: color,
        borderWidth: size > 50 ? 3.5 : 2.5,
        borderColor: theme.ink,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Title size={size * 0.46} color={inkOn(color)}>
        {(name || '?').charAt(0).toUpperCase()}
      </Title>
    </View>
  );
}

/** Mascote: macaquinho desenhado. */
export function Monkey({ size = 140 }: { size?: number }) {
  return (
    <Svg width={size} height={size * 0.93} viewBox="0 0 150 140" accessibilityLabel="Macaquinho do Macacadas Map">
      <Circle cx="22" cy="70" r="20" fill="#B5763C" stroke={theme.ink} strokeWidth="4" />
      <Circle cx="22" cy="70" r="10" fill="#F2C99A" stroke={theme.ink} strokeWidth="3" />
      <Circle cx="128" cy="70" r="20" fill="#B5763C" stroke={theme.ink} strokeWidth="4" />
      <Circle cx="128" cy="70" r="10" fill="#F2C99A" stroke={theme.ink} strokeWidth="3" />
      <Path d="M75 10 C 120 10, 130 50, 128 80 C 126 120, 100 134, 75 134 C 50 134, 24 120, 22 80 C 20 50, 30 10, 75 10 Z" fill="#B5763C" stroke={theme.ink} strokeWidth="4" />
      <Path d="M75 40 C 95 30, 112 44, 108 66 C 118 80, 112 116, 75 118 C 38 116, 32 80, 42 66 C 38 44, 55 30, 75 40 Z" fill="#F2C99A" stroke={theme.ink} strokeWidth="3.5" />
      <Ellipse cx="60" cy="64" rx="7" ry="9" fill={theme.ink} />
      <Ellipse cx="90" cy="64" rx="7" ry="9" fill={theme.ink} />
      <Circle cx="62" cy="61" r="2.5" fill="#FFF" />
      <Circle cx="92" cy="61" r="2.5" fill="#FFF" />
      <Path d="M68 84 q 7 5 14 0" stroke={theme.ink} strokeWidth="3" fill="none" strokeLinecap="round" />
      <Path d="M56 96 C 66 112, 86 112, 96 96" stroke={theme.ink} strokeWidth="4" fill={theme.coral} strokeLinejoin="round" />
      <Path d="M58 20 C 64 6, 80 6, 84 18" stroke={theme.ink} strokeWidth="3.5" fill="none" strokeLinecap="round" />
    </Svg>
  );
}

type IconName = 'map' | 'calendar' | 'person' | 'expand' | 'trail' | 'share' | 'chevL' | 'chevR';

export function Icon({ name, size = 24, color = theme.ink }: { name: IconName; size?: number; color?: string }) {
  const common = { fill: 'none', stroke: color, strokeWidth: 2.4, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {name === 'map' && (
        <>
          <Path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2z" {...common} />
          <Path d="M9 4v14M15 6v14" {...common} />
        </>
      )}
      {name === 'calendar' && (
        <>
          <Rect x="3" y="5" width="18" height="16" rx="3" {...common} />
          <Path d="M3 10h18M8 3v4M16 3v4" {...common} />
        </>
      )}
      {name === 'person' && (
        <>
          <Circle cx="12" cy="9" r="4" {...common} />
          <Path d="M4 21c1-5 5-7 8-7s7 2 8 7" {...common} />
        </>
      )}
      {name === 'expand' && <Path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" {...common} strokeWidth={2.6} />}
      {name === 'trail' && <Path d="M3 15c3-6 5-6 7 0s4 6 7 0 3-4 4-3" {...common} strokeWidth={2.6} strokeDasharray="1 4" />}
      {name === 'share' && (
        <>
          <Circle cx="18" cy="5" r="3" {...common} />
          <Circle cx="6" cy="12" r="3" {...common} />
          <Circle cx="18" cy="19" r="3" {...common} />
          <Path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4" {...common} />
        </>
      )}
      {name === 'chevL' && <Path d="M15 5l-7 7 7 7" {...common} strokeWidth={3.2} />}
      {name === 'chevR' && <Path d="M9 5l7 7-7 7" {...common} strokeWidth={3.2} />}
    </Svg>
  );
}

const styles = StyleSheet.create({
  btnInner: { minHeight: 52, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18, flexDirection: 'row', gap: 8 },
  link: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  input: { height: 48, paddingHorizontal: 14, fontSize: 21, color: theme.ink, fontFamily: fonts.hand },
});
