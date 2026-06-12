import { View, Text, StyleSheet, type StyleProp, type ViewStyle, type TextStyle } from 'react-native';
import { Image } from 'expo-image';
import { useAvatarQuery } from '../src/users';

type UserAvatarProps = {
  userId?: string | null;
  initials: string;
  size: number;
  /** When false the avatar request is skipped and initials are shown directly. */
  hasAvatar?: boolean;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
};

const UserAvatar = ({ userId, initials, size, hasAvatar, style, textStyle }: UserAvatarProps) => {
  const { data: avatarUrl } = useAvatarQuery(userId, { enabled: hasAvatar !== false });
  const circle = { width: size, height: size, borderRadius: size / 2 };

  if (avatarUrl) {
    return (
      <View style={[circle, styles.clip, style]}>
        <Image source={{ uri: avatarUrl }} style={StyleSheet.absoluteFill} contentFit="cover" />
      </View>
    );
  }

  return (
    <View style={[circle, styles.center, style]}>
      <Text style={[{ fontSize: size * 0.42, fontWeight: '800' }, textStyle]}>{initials}</Text>
    </View>
  );
};

export default UserAvatar;

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
  clip: { overflow: 'hidden' },
});
