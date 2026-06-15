import { View, Text, StyleSheet, type StyleProp, type ViewStyle, type TextStyle } from 'react-native';
import { Image } from 'expo-image';
import { useAvatarQuery } from '../src/users';
import { useDataSaver } from '../src/dataSaver';

type UserAvatarProps = {
  userId?: string | null;
  initials: string;
  size: number;
  /** When false the avatar request is skipped and initials are shown directly. */
  hasAvatar?: boolean;
  /** When true the avatar loads even in data-saver mode (e.g. when viewing a profile). */
  forceShow?: boolean;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
};

const UserAvatar = ({ userId, initials, size, hasAvatar, forceShow, style, textStyle }: UserAvatarProps) => {
  const { dataSaver } = useDataSaver();
  const { data: avatarUrl } = useAvatarQuery(userId, {
    enabled: hasAvatar !== false && (!dataSaver || forceShow === true),
  });
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
