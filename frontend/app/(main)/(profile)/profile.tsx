import { StyleSheet, View, ScrollView, Pressable, Modal, ActivityIndicator } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import ThemedText from '../../../components/ThemedText';
import ThemedButton from '../../../components/ThemedButton';
import ThemedInput from '../../../components/ThemedInput';
import UserAvatar from '../../../components/UserAvatar';
import { useAuth } from '../../../src/auth';
import { useMyProfileQuery, useUpdateProfileMutation, useChangePasswordMutation, useUploadAvatarMutation } from '../../../src/users';
import { AppError, ErrorCode } from '../../../src/AppError';
import { t } from 'i18next';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { Colors } from '../../../constants/Colors';
import { useAppTheme } from '../../../src/theme';
import * as Clipboard from 'expo-clipboard';
import { useEffect, useState } from 'react';

type ToastState = { text: string; kind: 'error' | 'success' } | null;
type EditableField = 'username' | 'email';

const FIELD_LABELS: Record<EditableField, { title: string; placeholder: string; required: string; error: string }> = {
  username: {
    title: 'profile.editUsername',
    placeholder: 'profile.newUsername',
    required: 'profile.usernameRequired',
    error: 'profile.usernameUpdateError',
  },
  email: {
    title: 'profile.editEmail',
    placeholder: 'profile.newEmail',
    required: 'profile.emailRequired',
    error: 'profile.emailUpdateError',
  },
};

const EditFieldModal = ({ field, initialValue, onClose }: {
  field: EditableField;
  initialValue: string;
  onClose: (saved: boolean) => void;
}) => {
  const { themeName } = useAppTheme();
  const theme = Colors[themeName] ?? Colors.light;
  const updateProfile = useUpdateProfileMutation();
  const [value, setValue] = useState(initialValue);
  const [currentPassword, setCurrentPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const labels = FIELD_LABELS[field];

  const handleSave = async () => {
    const trimmed = value.trim();
    if (!trimmed) {
      setError(t(labels.required));
      return;
    }
    // Changing the email is sensitive: the backend requires the current password.
    if (field === 'email' && !currentPassword.trim()) {
      setError(t('profile.currentPasswordRequired'));
      return;
    }
    try {
      await updateProfile.mutateAsync(
        field === 'email' ? { email: trimmed, currentPassword } : { [field]: trimmed }
      );
      onClose(true);
    } catch (err) {
      if (field === 'email' && err instanceof AppError && err.code === ErrorCode.UNAUTHORIZED) {
        setError(t('profile.wrongCurrentPassword'));
      } else if (field === 'email' && err instanceof AppError && err.code === ErrorCode.CONFLICT) {
        setError(t('auth.register.errors.emailAlreadyInUse'));
      } else if (field === 'email' && err instanceof AppError && err.code === ErrorCode.BAD_REQUEST) {
        setError(t('profile.emailInvalid'));
      } else {
        setError(t(labels.error));
      }
    }
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={() => onClose(false)}>
      <Pressable style={styles.overlay} onPress={() => onClose(false)}>
        <Pressable onPress={() => {}} style={[styles.modalBox, { backgroundColor: theme.tabBackground }]}>
          <ThemedText style={styles.modalTitle}>{t(labels.title)}</ThemedText>
          <ThemedInput
            placeholder={t(labels.placeholder)}
            value={value}
            onChangeText={setValue}
            autoFocus
            keyboardType={field === 'email' ? 'email-address' : 'default'}
            autoCapitalize={field === 'email' ? 'none' : 'sentences'}
          />
          {field === 'email' && (
            <View style={styles.emailPasswordField}>
              <ThemedInput
                placeholder={t('profile.currentPassword')}
                value={currentPassword}
                onChangeText={setCurrentPassword}
                secureTextEntry
                autoCapitalize="none"
              />
            </View>
          )}
          {error && <ThemedText style={styles.errorText}>{error}</ThemedText>}
          <View style={styles.modalButtons}>
            <Pressable
              style={[styles.modalBtn, { borderColor: theme.icon + '55', borderWidth: 1 }]}
              onPress={() => onClose(false)}
              disabled={updateProfile.isPending}
            >
              <ThemedText style={{ fontWeight: '600' }}>{t('common.cancel')}</ThemedText>
            </Pressable>
            <Pressable
              style={[styles.modalBtn, { backgroundColor: theme.tint }]}
              onPress={handleSave}
              disabled={updateProfile.isPending}
            >
              {updateProfile.isPending
                ? <ActivityIndicator color="white" />
                : <ThemedText style={{ color: 'white', fontWeight: '600' }}>{t('common.save')}</ThemedText>}
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const PasswordModal = ({ onClose }: {
  onClose: (saved: boolean) => void;
}) => {
  const { themeName } = useAppTheme();
  const theme = Colors[themeName] ?? Colors.light;
  const changePassword = useChangePasswordMutation();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    if (!currentPassword.trim() || !newPassword.trim() || !confirmPassword.trim()) {
      setError(t('auth.register.errors.allFieldsRequired'));
      return;
    }
    if (newPassword !== confirmPassword) {
      setError(t('auth.register.errors.passwordsDoNotMatch'));
      return;
    }
    try {
      await changePassword.mutateAsync({ currentPassword, newPassword });
      onClose(true);
    } catch (err) {
      if (err instanceof AppError && err.code === ErrorCode.UNAUTHORIZED) {
        setError(t('profile.wrongCurrentPassword'));
      } else {
        setError(t('profile.passwordChangeError'));
      }
    }
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={() => onClose(false)}>
      <Pressable style={styles.overlay} onPress={() => onClose(false)}>
        <Pressable onPress={() => {}} style={[styles.modalBox, { backgroundColor: theme.tabBackground }]}>
          <ThemedText style={styles.modalTitle}>{t('profile.changePassword')}</ThemedText>
          <View style={styles.passwordFields}>
            <ThemedInput
              placeholder={t('profile.currentPassword')}
              value={currentPassword}
              onChangeText={setCurrentPassword}
              secureTextEntry
            />
            <ThemedInput
              placeholder={t('profile.newPassword')}
              value={newPassword}
              onChangeText={setNewPassword}
              secureTextEntry
            />
            <ThemedInput
              placeholder={t('profile.confirmNewPassword')}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
            />
          </View>
          <View style={styles.warningBox}>
            <Ionicons name="warning-outline" size={18} color={Colors.warning} />
            <ThemedText style={styles.warningText}>{t('profile.passwordChangeWarning')}</ThemedText>
          </View>
          {error && <ThemedText style={styles.errorText}>{error}</ThemedText>}
          <View style={styles.modalButtons}>
            <Pressable
              style={[styles.modalBtn, { borderColor: theme.icon + '55', borderWidth: 1 }]}
              onPress={() => onClose(false)}
              disabled={changePassword.isPending}
            >
              <ThemedText style={{ fontWeight: '600' }}>{t('common.cancel')}</ThemedText>
            </Pressable>
            <Pressable
              style={[styles.modalBtn, { backgroundColor: theme.tint }]}
              onPress={handleSave}
              disabled={changePassword.isPending}
            >
              {changePassword.isPending
                ? <ActivityIndicator color="white" />
                : <ThemedText style={{ color: 'white', fontWeight: '600' }}>{t('common.save')}</ThemedText>}
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const Profile = () => {
  const { userEmail, username: storedUsername, logout, userId } = useAuth();
  const { themeName } = useAppTheme();
  const theme = Colors[themeName] ?? Colors.light;
  const myProfile = useMyProfileQuery();
  const uploadAvatar = useUploadAvatarMutation(userId);

  const username = myProfile.data?.username ?? storedUsername;
  const email = myProfile.data?.email ?? userEmail;

  const handleLogout = async () => {
    await logout();
    router.replace('/login');
  };

  const [copied, setCopied] = useState(false);
  const [activeModal, setActiveModal] = useState<EditableField | 'password' | null>(null);
  const [toast, setToast] = useState<ToastState>(null);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(timer);
  }, [toast]);

  const initials = username
    ? username.slice(0, 2).toUpperCase()
    : (userEmail ? userEmail.slice(0, 2).toUpperCase() : '??');

  const handleCopyUserId = async () => {
    if (!userId) return;
    await Clipboard.setStringAsync(userId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleChangePhoto = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (result.canceled || !result.assets?.length) return;

    const asset = result.assets[0];
    try {
      await uploadAvatar.mutateAsync({
        fileUri: asset.uri,
        contentType: asset.mimeType ?? 'image/jpeg',
      });
    } catch {
      setToast({ text: t('profile.changePhotoError'), kind: 'error' });
    }
  };

  const handlePasswordModalClose = (saved: boolean) => {
    setActiveModal(null);
    if (saved) setToast({ text: t('profile.passwordChanged'), kind: 'success' });
  };

  const handleFieldModalClose = (field: EditableField) => (saved: boolean) => {
    setActiveModal(null);
    if (saved) {
      setToast({
        text: t(field === 'username' ? 'profile.usernameChanged' : 'profile.emailChanged'),
        kind: 'success',
      });
    }
  };

  return (
    <View style={[styles.screen, { backgroundColor: theme.background }]}>
    <ScrollView
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}
    >
      <LinearGradient
        colors={['#7c3aed', '#9d44f0', '#b873f8']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.header}
      >
        <View>
          <UserAvatar
            userId={userId}
            initials={initials}
            size={80}
            hasAvatar={myProfile.data ? myProfile.data.hasAvatar : undefined}
            forceShow
            style={styles.avatarCircle}
            textStyle={styles.avatarText}
          />
          {uploadAvatar.isPending && (
            <View style={styles.avatarLoading}>
              <ActivityIndicator color="white" />
            </View>
          )}
          <Pressable
            style={({ pressed }) => [styles.cameraBadge, { opacity: pressed ? 0.7 : 1 }]}
            onPress={handleChangePhoto}
            disabled={uploadAvatar.isPending}
            accessibilityLabel={t('profile.changePhoto')}
          >
            <Ionicons name="camera" size={16} color={Colors.primary} />
          </Pressable>
        </View>
        <ThemedText style={styles.headerName}>{username ?? t('common.notAvailable')}</ThemedText>
      </LinearGradient>

      <View style={[styles.infoCard, { backgroundColor: theme.uiBackground, borderColor: theme.border }]}>
        <View style={styles.infoRow}>
          <View style={[styles.iconBadge, { backgroundColor: theme.background }]}>
            <Ionicons name="person-outline" size={18} color={Colors.primary} />
          </View>
          <View style={styles.infoText}>
            <ThemedText style={styles.infoLabel}>{t('profile.username')}</ThemedText>
            <ThemedText style={styles.infoValue}>{username ?? t('common.notAvailable')}</ThemedText>
          </View>
          <Pressable
            onPress={() => setActiveModal('username')}
            style={({ pressed }) => [styles.copyButton, { backgroundColor: theme.background, opacity: pressed ? 0.7 : 1 }]}
            accessibilityLabel={t('profile.editUsername')}
          >
            <Ionicons name="pencil-outline" size={16} color={Colors.primary} />
          </Pressable>
        </View>

        <View style={[styles.divider, { backgroundColor: theme.border }]} />

        <View style={styles.infoRow}>
          <View style={[styles.iconBadge, { backgroundColor: theme.background }]}>
            <Ionicons name="mail-outline" size={18} color={Colors.primary} />
          </View>
          <View style={styles.infoText}>
            <ThemedText style={styles.infoLabel}>{t('profile.email')}</ThemedText>
            <ThemedText style={styles.infoValue}>{email ?? t('common.notAvailable')}</ThemedText>
          </View>
          <Pressable
            onPress={() => setActiveModal('email')}
            style={({ pressed }) => [styles.copyButton, { backgroundColor: theme.background, opacity: pressed ? 0.7 : 1 }]}
            accessibilityLabel={t('profile.editEmail')}
          >
            <Ionicons name="pencil-outline" size={16} color={Colors.primary} />
          </Pressable>
        </View>

        <View style={[styles.divider, { backgroundColor: theme.border }]} />

        <View style={styles.infoRow}>
          <View style={[styles.iconBadge, { backgroundColor: theme.background }]}>
            <Ionicons name="finger-print-outline" size={18} color={Colors.primary} />
          </View>
          <View style={styles.infoText}>
            <ThemedText style={styles.infoLabel}>{t('profile.userId')}</ThemedText>
            <ThemedText style={styles.infoValue} numberOfLines={1} ellipsizeMode="middle">
              {userId ?? t('common.notAvailable')}
            </ThemedText>
          </View>
          {userId && (
            <Pressable
              onPress={handleCopyUserId}
              accessibilityRole="button"
              accessibilityLabel={t('a11y.copyUserId')}
              accessibilityHint={t('a11y.hintCopyId')}
              hitSlop={10}
              style={({ pressed }) => [
                styles.copyButton,
                { backgroundColor: copied ? Colors.primary : theme.background, opacity: pressed ? 0.7 : 1 },
              ]}
            >
              <Ionicons
                name={copied ? 'checkmark-outline' : 'copy-outline'}
                size={16}
                color={copied ? '#ffffff' : Colors.primary}
              />
            </Pressable>
          )}
        </View>

        <View style={[styles.divider, { backgroundColor: theme.border }]} />

        <Pressable
          style={({ pressed }) => [styles.infoRow, { opacity: pressed ? 0.7 : 1 }]}
          onPress={() => setActiveModal('password')}
          accessibilityRole="button"
        >
          <View style={[styles.iconBadge, { backgroundColor: theme.background }]}>
            <Ionicons name="lock-closed-outline" size={18} color={Colors.primary} />
          </View>
          <View style={styles.infoText}>
            <ThemedText style={styles.infoValue}>{t('profile.changePassword')}</ThemedText>
          </View>
          <Ionicons name="chevron-forward" size={18} color={Colors.primary} />
        </Pressable>
      </View>

      {userId && (
        <View style={[styles.qrCard, { backgroundColor: theme.uiBackground, borderColor: theme.border }]}>
          <ThemedText title style={styles.qrTitle}>{t('profile.qrTitle')}</ThemedText>
          <View style={styles.qrBox}>
            <QRCode value={userId} size={180} backgroundColor="white" color="black" />
          </View>
          <ThemedText style={[styles.qrHint, { color: theme.text }]}>{t('profile.qrHint')}</ThemedText>
        </View>
      )}

      <ThemedButton onPress={handleLogout} style={styles.logoutButton}>
        <View style={styles.logoutContent}>
          <Ionicons name="log-out-outline" size={18} color="white" />
          <ThemedText style={styles.logoutText}>{t('profile.logout')}</ThemedText>
        </View>
      </ThemedButton>

      {activeModal === 'username' && (
        <EditFieldModal
          field="username"
          initialValue={username ?? ''}
          onClose={handleFieldModalClose('username')}
        />
      )}
      {activeModal === 'email' && (
        <EditFieldModal
          field="email"
          initialValue={email ?? ''}
          onClose={handleFieldModalClose('email')}
        />
      )}
      {activeModal === 'password' && (
        <PasswordModal onClose={handlePasswordModalClose} />
      )}
    </ScrollView>

    {toast && (
      <View style={[styles.toast, { backgroundColor: toast.kind === 'error' ? Colors.warning : '#4caf50' }]}>
        <ThemedText style={styles.toastText}>{toast.text}</ThemedText>
      </View>
    )}
    </View>
  );
};

export default Profile;

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  container: {
    flexGrow: 1,
    paddingBottom: 32,
  },
  header: {
    alignItems: 'center',
    paddingTop: 40,
    paddingBottom: 32,
    paddingHorizontal: 20,
    gap: 12,
  },
  avatarCircle: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.5)',
  },
  avatarText: {
    fontSize: 28,
    fontWeight: '700',
    color: '#ffffff',
  },
  avatarLoading: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 40,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0px 1px 4px rgba(0, 0, 0, 0.25)',
  },
  headerName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#ffffff',
  },
  infoCard: {
    marginHorizontal: 20,
    marginTop: 20,
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 14,
  },
  iconBadge: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoText: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  copyButton: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  infoLabel: {
    fontSize: 11,
    fontWeight: '600',
    opacity: 0.6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  infoValue: {
    fontSize: 15,
    fontWeight: '600',
  },
  divider: {
    height: 1,
    marginHorizontal: 16,
  },
  qrCard: {
    marginHorizontal: 20,
    marginTop: 20,
    borderRadius: 16,
    borderWidth: 1,
    padding: 20,
    alignItems: 'center',
    gap: 16,
  },
  qrTitle: {
    fontSize: 16,
  },
  qrBox: {
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#ffffff',
    boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.08)',
  },
  qrHint: {
    textAlign: 'center',
    fontSize: 13,
    opacity: 0.6,
  },
  logoutButton: {
    marginHorizontal: 20,
    marginTop: 24,
  },
  logoutContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  logoutText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 15,
  },

  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', padding: 24 },
  modalBox: { borderRadius: 16, padding: 20 },
  modalTitle: { fontSize: 20, fontWeight: '700', marginBottom: 16 },
  modalButtons: { flexDirection: 'row', gap: 8, marginTop: 16 },
  modalBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  passwordFields: { gap: 10 },
  emailPasswordField: { marginTop: 10 },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 14,
    padding: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(255,165,0,0.12)',
  },
  warningText: { flex: 1, fontSize: 13, opacity: 0.8 },
  errorText: { color: Colors.warning, marginTop: 10, textAlign: 'center' },

  toast: {
    position: 'absolute', bottom: 40, left: 24, right: 24,
    padding: 12, borderRadius: 8, alignItems: 'center',
  },
  toastText: { color: 'white', fontWeight: '600' },
});
