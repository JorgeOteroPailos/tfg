import React, { useCallback, useEffect, useMemo, useReducer, useState } from 'react';
import { StyleSheet, View, FlatList, ActivityIndicator, Pressable, Modal, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useNavigation, router, useLocalSearchParams } from 'expo-router';
import { useAppTheme } from '../../../src/theme';
import { Colors } from '../../../constants/Colors';
import {
  useExpensesQuery,
  useBalancesQuery,
  useExpenseDetailQuery,
  useAddExpenseMutation,
  useDeleteExpenseMutation,
  usePaySettlementMutation,
  type ExpenseSummary,
  type ExpenseDetail,
  type BalancesInfo,
} from '../../../src/expenses';
import { useTrip } from '../../../src/trips';
import { useAuth } from '../../../src/auth';
import { Ionicons } from '@expo/vector-icons';
import ThemedInput from '../../../components/ThemedInput';
import SegmentedControl from '../../../components/SegmentedControl';
import UserAvatar from '../../../components/UserAvatar';
import type { components } from '../../../src/generated/types';

type ExpenseCategory = components['schemas']['ExpenseCategory'];

type CategoryMeta = { icon: React.ComponentProps<typeof Ionicons>['name']; labelKey: string };
const CATEGORIES: Record<NonNullable<ExpenseCategory>, CategoryMeta> = {
  GENERAL:       { icon: 'receipt-outline',          labelKey: 'trip.catGeneral' },
  FOOD:          { icon: 'restaurant-outline',        labelKey: 'trip.catFood' },
  TRANSPORT:     { icon: 'car-outline',               labelKey: 'trip.catTransport' },
  ACCOMMODATION: { icon: 'bed-outline',               labelKey: 'trip.catAccommodation' },
  ENTERTAINMENT: { icon: 'game-controller-outline',   labelKey: 'trip.catEntertainment' },
  SHOPPING:      { icon: 'bag-handle-outline',        labelKey: 'trip.catShopping' },
  HEALTH:        { icon: 'medical-outline',           labelKey: 'trip.catHealth' },
};

type Tab = 'expenses' | 'balances';

interface ExpenseRowProps {
  item: ExpenseSummary;
  payerName: string;
  theme: typeof Colors.light;
  onPress: (item: ExpenseSummary) => void;
}

const ExpenseRow = React.memo(function ExpenseRow({ item, payerName, theme, onPress }: ExpenseRowProps) {
  const cat = CATEGORIES[item.category ?? 'GENERAL'];
  return (
    <Pressable
      style={({ pressed }) => [
        styles.expenseCard,
        { backgroundColor: theme.tabBackground, borderColor: theme.border },
        pressed && { opacity: 0.8, transform: [{ scale: 0.99 }] },
      ]}
      onPress={() => onPress(item)}
    >
      <View style={[styles.expenseIcon, { backgroundColor: `${theme.tint}18` }]}>
        <Ionicons name={cat.icon} size={20} color={theme.tint} />
      </View>
      <View style={styles.expenseLeft}>
        <Text style={[styles.expenseName, { color: theme.title }]} numberOfLines={1}>{item.name}</Text>
        <Text style={[styles.expensePayer, { color: theme.icon }]}>{payerName}</Text>
      </View>
      <View style={styles.expenseRight}>
        <Text style={[styles.expenseAmount, { color: theme.tint }]}>{item.amount?.toFixed(2)}€</Text>
        <Ionicons name="chevron-forward" size={14} color={theme.icon} style={{ opacity: 0.4 }} />
      </View>
    </Pressable>
  );
});

// ── Create modal state ─────────────────────────────────────────────────────
type CreateState = { visible: boolean; error: string | null; name: string; amount: string; payerId: string; beneficiaryIds: string[]; payerDropdownOpen: boolean; category: NonNullable<ExpenseCategory> };
type CreateAction = { type: 'open' } | { type: 'close' } | { type: 'set_name'; value: string } | { type: 'set_amount'; value: string } | { type: 'set_payer'; id: string } | { type: 'toggle_beneficiary'; id: string } | { type: 'toggle_dropdown' } | { type: 'set_error'; error: string | null } | { type: 'set_category'; category: NonNullable<ExpenseCategory> };
const CREATE_INITIAL: CreateState = { visible: false, error: null, name: '', amount: '', payerId: '', beneficiaryIds: [], payerDropdownOpen: false, category: 'GENERAL' };
function createReducer(state: CreateState, action: CreateAction): CreateState {
  switch (action.type) {
    case 'open': return { ...CREATE_INITIAL, visible: true };
    case 'close': return CREATE_INITIAL;
    case 'set_name': return { ...state, name: action.value };
    case 'set_amount': return { ...state, amount: action.value };
    case 'set_payer': return { ...state, payerId: action.id, payerDropdownOpen: false };
    case 'toggle_beneficiary': return { ...state, beneficiaryIds: state.beneficiaryIds.includes(action.id) ? state.beneficiaryIds.filter(id => id !== action.id) : [...state.beneficiaryIds, action.id] };
    case 'toggle_dropdown': return { ...state, payerDropdownOpen: !state.payerDropdownOpen };
    case 'set_category': return { ...state, category: action.category };
    case 'set_error': return { ...state, error: action.error };
    default: return state;
  }
}

type ExpenseFlatRow = { _kind: 'date'; label: string; total: number } | { _kind: 'expense'; item: ExpenseSummary };
type BalanceFlatRow = { _kind: 'header'; title: string; mt?: number } | { _kind: 'balance'; userId: string; amount: number } | { _kind: 'settlement'; fromId: string; toId: string; amount: number } | { _kind: 'separator' } | { _kind: 'empty'; text: string } | { _kind: 'pastBtn' };

// ── Modals ─────────────────────────────────────────────────────────────────

type ExpenseDetailModalProps = {
  visible: boolean;
  expense: ExpenseDetail | null | undefined;
  isLoading: boolean;
  error: string | null;
  confirmingDelete: boolean;
  deleting: boolean;
  deleteError: string | null;
  currentUserId: string | null | undefined;
  usernameFor: (id: string) => string;
  onClose: () => void;
  onDelete: () => void;
  setConfirmingDelete: (v: boolean) => void;
};

const ExpenseDetailModal = React.memo(function ExpenseDetailModal({
  visible, expense, isLoading, error, confirmingDelete, deleting, deleteError, currentUserId, usernameFor, onClose, onDelete, setConfirmingDelete,
}: ExpenseDetailModalProps) {
  const { t } = useTranslation();
  const { themeName } = useAppTheme();
  const theme = Colors[themeName] ?? Colors.light;

  const impactMsg = useMemo(() => {
    if (!expense || !currentUserId) return null;
    const isIAmPayer = expense.payerId === currentUserId;
    const isIAmBeneficiary = expense.beneficiaryIds.includes(currentUserId);
    const n = expense.beneficiaryIds.length;
    const total = expense.amount ?? 0;
    const myShare = n > 0 ? total / n : 0;
    if (isIAmPayer && isIAmBeneficiary)
      return t('trip.impactPayerBeneficiary', { total: total.toFixed(2), net: (total - myShare).toFixed(2) });
    if (isIAmPayer)
      return t('trip.impactPayerOnly', { total: total.toFixed(2) });
    if (isIAmBeneficiary)
      return t('trip.impactBeneficiaryOnly', { share: myShare.toFixed(2), payer: usernameFor(expense.payerId) });
    return t('trip.impactNotInvolved');
  }, [expense, currentUserId, usernameFor, t]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable onPress={() => {}} style={[styles.modalBox, { backgroundColor: theme.tabBackground, borderColor: theme.border }]}>
          <Text style={[styles.modalTitle, { color: theme.title }]}>{t('trip.expenseDetail')}</Text>

          {isLoading && <ActivityIndicator color={theme.tint} style={{ marginVertical: 20 }} />}
          {error && <Text style={styles.errText}>{error}</Text>}

          {expense && !isLoading && (
            <>
              <Text style={[styles.detailName, { color: theme.title }]}>{expense.name}</Text>
              <View style={[styles.amountHero, { backgroundColor: `${theme.tint}12`, borderColor: `${theme.tint}28` }]}>
                <Text style={[styles.amountHeroText, { color: theme.tint }, themeName !== 'light' && { textShadowColor: `${theme.tint}70`, textShadowRadius: 16 }]}>
                  {expense.amount?.toFixed(2)}€
                </Text>
              </View>
              <View style={styles.detailPairRow}>
                {[
                  { label: t('trip.date'), val: new Date(expense.datetime).toLocaleDateString() },
                  { label: t('trip.createdBy'), val: usernameFor(expense.creatorId) },
                  { label: t('trip.category'), val: t(CATEGORIES[expense.category ?? 'GENERAL'].labelKey) },
                ].map(cell => (
                  <View key={cell.label} style={[styles.detailCell, { backgroundColor: theme.uiBackground, borderColor: theme.border }]}>
                    <Text style={[styles.detailLabel, { color: theme.icon }]}>{cell.label.toUpperCase()}</Text>
                    <Text style={[styles.detailVal, { color: theme.title }]} numberOfLines={1}>{cell.val}</Text>
                  </View>
                ))}
              </View>
              <View style={[styles.detailGroup, { borderColor: theme.border }]}>
                <View style={[styles.detailGroupSection, { borderBottomColor: theme.border }]}>
                  <Text style={[styles.detailLabel, { color: theme.icon }]}>{t('trip.payer').toUpperCase()}</Text>
                  <Text style={[styles.detailVal, { color: theme.title }]}>{usernameFor(expense.payerId)}</Text>
                </View>
                <View style={styles.detailGroupSection}>
                  <Text style={[styles.detailLabel, { color: theme.icon }]}>{t('trip.beneficiaries').toUpperCase()}</Text>
                  <View style={styles.chips}>
                    {expense.beneficiaryIds.map(id => (
                      <View key={id} style={[styles.chip, { backgroundColor: `${theme.tint}18`, borderColor: `${theme.tint}30` }]}>
                        <Text style={[styles.chipText, { color: theme.tint }]}>{usernameFor(id)}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              </View>
              {impactMsg && (
                <View style={[styles.impactRow, { backgroundColor: `${theme.tint}10`, borderColor: `${theme.tint}25` }]}>
                  <Ionicons name="information-circle-outline" size={15} color={theme.icon} />
                  <Text style={[styles.impactText, { color: theme.icon }]}>{impactMsg}</Text>
                </View>
              )}
            </>
          )}

          {confirmingDelete ? (
            <>
              <Text style={[styles.detailLabel, { color: Colors.warning, textAlign: 'center', marginTop: 4 }]}>
                {t('trip.deleteExpenseConfirm').toUpperCase()}
              </Text>
              {deleteError && (
                <Text style={[styles.detailLabel, { color: Colors.warning, textAlign: 'center', marginTop: 4 }]}>
                  {deleteError}
                </Text>
              )}
              <View style={styles.modalBtns}>
                <Pressable style={[styles.modalBtn, { borderColor: theme.border, borderWidth: 1 }]} onPress={() => setConfirmingDelete(false)} disabled={deleting}>
                  <Text style={{ color: theme.text, fontWeight: '700' }}>{t('common.cancel')}</Text>
                </Pressable>
                <Pressable style={[styles.modalBtn, { backgroundColor: Colors.warning, boxShadow: `0 0 20px ${Colors.warning}55` }]} onPress={onDelete} disabled={deleting}>
                  {deleting
                    ? <ActivityIndicator color="#fff" size="small" />
                    : <Text style={{ color: '#fff', fontWeight: '800', letterSpacing: 1 }}>{t('common.delete').toUpperCase()}</Text>}
                </Pressable>
              </View>
            </>
          ) : (
            <View style={styles.modalBtns}>
              <Pressable
                style={[styles.modalBtn, { backgroundColor: Colors.warning, boxShadow: `0 0 20px ${Colors.warning}55`, flexDirection: 'row', gap: 6, justifyContent: 'center' }]}
                onPress={() => setConfirmingDelete(true)}
                disabled={isLoading || !expense}
              >
                <Ionicons name="trash-outline" size={15} color="#fff" />
                <Text style={{ color: '#fff', fontWeight: '800', letterSpacing: 1 }}>{t('common.delete').toUpperCase()}</Text>
              </Pressable>
              <Pressable style={[styles.modalBtn, { backgroundColor: theme.tint, boxShadow: `0 0 20px ${theme.tint}55` }]} onPress={onClose}>
                <Text style={styles.closeBtnText}>{t('common.close').toUpperCase()}</Text>
              </Pressable>
            </View>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
});

const CategoryChip = React.memo(function CategoryChip({ categoryKey, selected, onSelect }: {
  categoryKey: NonNullable<ExpenseCategory>;
  selected: boolean;
  onSelect: (key: NonNullable<ExpenseCategory>) => void;
}) {
  const { t } = useTranslation();
  const { themeName } = useAppTheme();
  const theme = Colors[themeName] ?? Colors.light;
  const meta = CATEGORIES[categoryKey];
  const handlePress = useCallback(() => onSelect(categoryKey), [onSelect, categoryKey]);
  return (
    <Pressable
      style={[styles.categoryChip, { borderColor: selected ? theme.tint : theme.border, backgroundColor: selected ? `${theme.tint}18` : theme.uiBackground }]}
      onPress={handlePress}
    >
      <Ionicons name={meta.icon} size={20} color={selected ? theme.tint : theme.icon} />
      <Text style={[styles.categoryChipLabel, { color: selected ? theme.tint : theme.icon }]}>{t(meta.labelKey)}</Text>
    </Pressable>
  );
});

type CreateExpenseModalProps = {
  createModal: CreateState;
  createDispatch: React.Dispatch<CreateAction>;
  isPending: boolean;
  members?: Array<{ id?: string | null; username?: string | null }>;
  onConfirm: () => void;
};

const CreateExpenseModal = React.memo(function CreateExpenseModal({
  createModal, createDispatch, isPending, members, onConfirm,
}: CreateExpenseModalProps) {
  const { t } = useTranslation();
  const { themeName } = useAppTheme();
  const theme = Colors[themeName] ?? Colors.light;

  const handleSelectCategory = useCallback((key: NonNullable<ExpenseCategory>) => {
    createDispatch({ type: 'set_category', category: key });
  }, [createDispatch]);

  const renderCategoryItem = useCallback(({ item: key }: { item: NonNullable<ExpenseCategory> }) => (
    <CategoryChip
      categoryKey={key}
      selected={createModal.category === key}
      onSelect={handleSelectCategory}
    />
  ), [createModal.category, handleSelectCategory]);

  return (
    <Modal visible={createModal.visible} transparent animationType="fade" onRequestClose={() => createDispatch({ type: 'close' })}>
      <Pressable style={styles.overlay} onPress={() => createDispatch({ type: 'close' })}>
        <Pressable onPress={() => {}} style={[styles.modalBox, { backgroundColor: theme.tabBackground, borderColor: theme.border }]}>
          <Text style={[styles.modalTitle, { color: theme.title }]}>{t('trip.newExpense')}</Text>

          <ThemedInput placeholder={t('trip.description')} value={createModal.name} onChangeText={v => createDispatch({ type: 'set_name', value: v })} autoFocus />
          <ThemedInput placeholder={t('trip.amount')} value={createModal.amount} onChangeText={v => createDispatch({ type: 'set_amount', value: v })} keyboardType="numeric" />

          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categoryRow}
            data={Object.keys(CATEGORIES) as NonNullable<ExpenseCategory>[]}
            keyExtractor={key => key}
            renderItem={renderCategoryItem}
          />

          <Pressable style={[styles.dropdown, { backgroundColor: theme.uiBackground, borderColor: theme.border }]} onPress={() => createDispatch({ type: 'toggle_dropdown' })}>
            <Text style={{ color: createModal.payerId ? theme.title : theme.icon, fontWeight: '600' }}>
              {createModal.payerId ? members?.find(m => m.id === createModal.payerId)?.username : t('trip.selectPayer')}
            </Text>
            <Ionicons name={createModal.payerDropdownOpen ? 'chevron-up' : 'chevron-down'} size={16} color={theme.icon} />
          </Pressable>

          {createModal.payerDropdownOpen && (
            <View style={[styles.dropList, { backgroundColor: theme.uiBackground, borderColor: theme.border }]}>
              {members?.map(m => (
                <Pressable key={m.id} style={[styles.dropItem, { borderBottomColor: theme.border }]} onPress={() => createDispatch({ type: 'set_payer', id: m.id ?? '' })}>
                  <Text style={{ color: theme.title, fontWeight: '600' }}>{m.username}</Text>
                </Pressable>
              ))}
            </View>
          )}

          <Text style={[styles.detailLabel, { color: theme.icon, marginBottom: 6 }]}>{t('trip.beneficiaries').toUpperCase()}</Text>
          <View style={[styles.dropList, { backgroundColor: theme.uiBackground, borderColor: theme.border }]}>
            {members?.map(m => {
              const sel = createModal.beneficiaryIds.includes(m.id ?? '');
              return (
                <Pressable key={m.id} style={[styles.dropItem, { borderBottomColor: theme.border }]} onPress={() => createDispatch({ type: 'toggle_beneficiary', id: m.id ?? '' })}>
                  <Text style={{ color: theme.title, fontWeight: '600' }}>{m.username}</Text>
                  <Ionicons name={sel ? 'checkbox' : 'square-outline'} size={20} color={sel ? theme.tint : theme.icon} />
                </Pressable>
              );
            })}
          </View>

          {createModal.error && <Text style={styles.errText}>{createModal.error}</Text>}

          <View style={styles.modalBtns}>
            <Pressable style={[styles.modalBtn, { borderColor: theme.border, borderWidth: 1 }]} onPress={() => createDispatch({ type: 'close' })}>
              <Text style={{ color: theme.text, fontWeight: '700' }}>{t('common.cancel')}</Text>
            </Pressable>
            <Pressable style={[styles.modalBtn, { backgroundColor: theme.tint, boxShadow: `0 0 20px ${theme.tint}55` }]} onPress={onConfirm} disabled={isPending}>
              {isPending ? <ActivityIndicator color="#fff" size="small" /> : <Text style={{ color: '#fff', fontWeight: '800', letterSpacing: 1 }}>{t('common.create').toUpperCase()}</Text>}
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
});

// ── Balances section ───────────────────────────────────────────────────────

type BalancesSectionProps = {
  info: BalancesInfo | undefined;
  isLoading: boolean;
  error: string | null;
  currentUserId: string | null | undefined;
  usernameFor: (id: string) => string;
  payingKey: string | null;
  handlePaySettlement: (fromId: string, toId: string, amount: number) => void;
  tripId: string;
};

const BalancesSection = React.memo(function BalancesSection({
  info, isLoading, error, currentUserId, usernameFor, payingKey, handlePaySettlement, tripId,
}: BalancesSectionProps) {
  const { t } = useTranslation();
  const { themeName } = useAppTheme();
  const theme = Colors[themeName] ?? Colors.light;
  const [confirmingPayKey, setConfirmingPayKey] = useState<string | null>(null);

  const balanceRows = useMemo((): BalanceFlatRow[] => {
    const rows: BalanceFlatRow[] = [];
    const bl = info?.balances ?? [];
    const sl = info?.settlements ?? [];
    rows.push({ _kind: 'header', title: t('trip.balancePerMember') });
    if (!bl.length) rows.push({ _kind: 'empty', text: t('trip.noBalances') });
    else bl.forEach(b => rows.push({ _kind: 'balance', userId: b.userId, amount: b.amount }));
    rows.push({ _kind: 'header', title: t('trip.settlements'), mt: 20 });
    rows.push({ _kind: 'pastBtn' } as BalanceFlatRow);
    if (!sl.length) {
      rows.push({ _kind: 'empty', text: t('trip.noSettlements') });
    } else {
      const mine = sl.filter(s => s.fromId === currentUserId);
      const others = sl.filter(s => s.fromId !== currentUserId);
      mine.forEach(s => rows.push({ _kind: 'settlement', fromId: s.fromId, toId: s.toId, amount: s.amount }));
      if (mine.length && others.length) rows.push({ _kind: 'separator' });
      others.forEach(s => rows.push({ _kind: 'settlement', fromId: s.fromId, toId: s.toId, amount: s.amount }));
    }
    return rows;
  }, [info, currentUserId, t]);

  const renderRow = useCallback(({ item }: { item: BalanceFlatRow }) => {
    switch (item._kind) {
      case 'header':
        return <Text style={[styles.sectionHeader, { color: theme.icon }, item.mt ? { marginTop: item.mt } : undefined]}>{item.title.toUpperCase()}</Text>;
      case 'balance': {
        const pos = item.amount >= 0;
        const isMe = item.userId === currentUserId;
        return (
          <View style={[styles.balanceCard, { backgroundColor: theme.tabBackground, borderColor: theme.border }]}>
            <UserAvatar
              userId={item.userId}
              initials={usernameFor(item.userId).charAt(0).toUpperCase()}
              size={40}
              style={{ backgroundColor: `${theme.tint}18` }}
              textStyle={[styles.balanceInitial, { color: theme.tint }]}
            />
            <View style={styles.nameRow}>
              <Text style={[styles.balanceName, { color: theme.title }, isMe && styles.meText]} numberOfLines={1}>{usernameFor(item.userId)}</Text>
              {isMe && (
                <View style={[styles.meTag, { backgroundColor: `${theme.tint}20`, borderColor: `${theme.tint}40` }]}>
                  <Text style={[styles.meTagText, { color: theme.tint }]}>{t('common.you').toUpperCase()}</Text>
                </View>
              )}
            </View>
            <View style={[styles.balancePill, { backgroundColor: pos ? 'rgba(76,175,80,0.15)' : 'rgba(220,38,38,0.15)', boxShadow: pos ? '0 0 10px rgba(76,175,80,0.3)' : '0 0 10px rgba(220,38,38,0.3)' }]}>
              <Text style={[styles.balanceAmt, { color: pos ? '#4caf50' : Colors.warning }]}>{pos ? '+' : ''}{item.amount.toFixed(2)}€</Text>
            </View>
          </View>
        );
      }
      case 'settlement': {
        const fromMe = item.fromId === currentUserId;
        const toMe = item.toId === currentUserId;
        const key = `${item.fromId}-${item.toId}`;
        const isPaying = payingKey === key;
        return (
          <View style={[styles.settlementCard, { backgroundColor: theme.tabBackground, borderColor: theme.border }]}>
            <View style={styles.settlementTop}>
              <View style={[styles.nameRow, { flex: 0 }]}>
                <Text style={[styles.settlementName, { color: theme.title }, fromMe && styles.meText]} numberOfLines={1}>{usernameFor(item.fromId)}</Text>
                {fromMe && (
                  <View style={[styles.meTag, { backgroundColor: `${theme.tint}20`, borderColor: `${theme.tint}40` }]}>
                    <Text style={[styles.meTagText, { color: theme.tint }]}>{t('common.you').toUpperCase()}</Text>
                  </View>
                )}
              </View>
              <View style={[styles.settlementArrow, { backgroundColor: `${theme.tint}20` }]}>
                <Ionicons name="arrow-forward" size={13} color={theme.tint} />
              </View>
              <View style={[styles.nameRow, { flex: 1 }]}>
                <Text style={[styles.settlementName, { color: theme.title }, toMe && styles.meText]} numberOfLines={1}>{usernameFor(item.toId)}</Text>
                {toMe && (
                  <View style={[styles.meTag, { backgroundColor: `${theme.tint}20`, borderColor: `${theme.tint}40` }]}>
                    <Text style={[styles.meTagText, { color: theme.tint }]}>{t('common.you').toUpperCase()}</Text>
                  </View>
                )}
              </View>
              <Text style={[styles.settlementAmt, { color: theme.tint }]}>{item.amount.toFixed(2)}€</Text>
            </View>
            {fromMe && (
              isPaying ? (
                <View style={[styles.payBtn, { borderColor: theme.tint }]}>
                  <ActivityIndicator size="small" color={theme.tint} />
                </View>
              ) : confirmingPayKey === key ? (
                <View style={[styles.payConfirmRow, { borderTopColor: theme.border }]}>
                  <Pressable
                    style={[styles.payConfirmBtn, { borderColor: theme.border, borderWidth: 1 }]}
                    onPress={() => setConfirmingPayKey(null)}
                  >
                    <Text style={{ color: theme.text, fontWeight: '700', fontSize: 12 }}>{t('common.cancel')}</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.payConfirmBtn, { backgroundColor: theme.tint }]}
                    onPress={() => { setConfirmingPayKey(null); handlePaySettlement(item.fromId, item.toId, item.amount); }}
                  >
                    <Ionicons name="checkmark-circle-outline" size={14} color="#fff" />
                    <Text style={{ color: '#fff', fontWeight: '800', fontSize: 12, letterSpacing: 0.5 }}>{t('trip.markAsPaid').toUpperCase()}</Text>
                  </Pressable>
                </View>
              ) : (
                <Pressable
                  style={({ pressed }) => [styles.payBtn, { borderColor: theme.tint }, pressed && { opacity: 0.7 }]}
                  onPress={() => setConfirmingPayKey(key)}
                >
                  <Ionicons name="checkmark-circle-outline" size={15} color={theme.tint} />
                  <Text style={[styles.payBtnText, { color: theme.tint }]}>{t('trip.markAsPaid')}</Text>
                </Pressable>
              )
            )}
          </View>
        );
      }
      case 'separator':
        return <View style={[styles.separator, { borderBottomColor: theme.border }]} />;
      case 'empty':
        return <Text style={[styles.emptyText, { color: theme.icon }]}>{item.text}</Text>;
      case 'pastBtn':
        return (
          <Pressable
            style={({ pressed }) => [styles.pastSettlementsBtn, { borderColor: theme.border }, pressed && { opacity: 0.7 }]}
            onPress={() => router.push({ pathname: '/past-settlements', params: { tripId } })}
          >
            <Ionicons name="time-outline" size={15} color={theme.icon} />
            <Text style={[styles.pastSettlementsBtnText, { color: theme.icon }]}>{t('trip.viewPastSettlements')}</Text>
            <Ionicons name="chevron-forward" size={14} color={theme.icon} style={{ opacity: 0.4, marginLeft: 'auto' }} />
          </Pressable>
        );
      default:
        return null;
    }
  }, [theme, usernameFor, currentUserId, payingKey, confirmingPayKey, setConfirmingPayKey, handlePaySettlement, tripId, t]);

  if (isLoading) return <ActivityIndicator size="large" color={theme.tint} style={styles.centered} />;
  if (error) return <Text style={[styles.emptyText, { color: theme.icon }]}>{error}</Text>;

  return (
    <FlatList
      data={balanceRows}
      keyExtractor={(item, i) => item._kind === 'balance' ? item.userId : item._kind === 'settlement' ? `${item.fromId}-${item.toId}` : item._kind === 'separator' ? `sep-${i}` : `${item._kind}-${i}`}
      contentContainerStyle={styles.list}
      showsVerticalScrollIndicator={false}
      renderItem={renderRow}
    />
  );
});

// ── Screen ─────────────────────────────────────────────────────────────────
const ExpensesScreen = () => {
  const { t } = useTranslation();
  const { themeName } = useAppTheme();
  const theme = Colors[themeName] ?? Colors.light;
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const { trip } = useTrip();
  const { userId: currentUserId } = useAuth();
  const navigation = useNavigation();

  const [activeTab, setActiveTab] = useState<Tab>('expenses');
  const [selectedExpenseId, setSelectedExpenseId] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [createModal, createDispatch] = useReducer(createReducer, CREATE_INITIAL);
  const [payingKey, setPayingKey] = useState<string | null>(null);

  const expensesQuery = useExpensesQuery(trip?.id ?? '');
  const balancesQuery = useBalancesQuery(trip?.id ?? '', { enabled: activeTab === 'balances' });
  const detailQuery = useExpenseDetailQuery(trip?.id ?? '', selectedExpenseId ?? '', { enabled: !!selectedExpenseId });
  const addExpenseMutation = useAddExpenseMutation(trip?.id ?? '');
  const deleteExpenseMutation = useDeleteExpenseMutation(trip?.id ?? '');
  const paySettlementMutation = usePaySettlementMutation(trip?.id ?? '');

  useEffect(() => {
    if (trip?.name) navigation.setOptions({ title: trip.name });
  }, [trip?.name, navigation]);

  const handleTabChange = (tab: Tab) => setActiveTab(tab);

  const handleCreate = async () => {
    if (!trip?.id) return;
    if (!createModal.name.trim() || !createModal.payerId || createModal.beneficiaryIds.length === 0) {
      createDispatch({ type: 'set_error', error: t('trip.fillAllRequiredFields') }); return;
    }
    const amountValue = Number(createModal.amount.replace(',', '.'));
    if (!Number.isFinite(amountValue) || amountValue <= 0) {
      createDispatch({ type: 'set_error', error: t('trip.invalidAmount') }); return;
    }
    try {
      await addExpenseMutation.mutateAsync({
        name: createModal.name.trim(),
        amount: amountValue,
        payerId: createModal.payerId,
        beneficiaryIds: createModal.beneficiaryIds,
        category: createModal.category,
      });
      createDispatch({ type: 'close' });
    } catch {
      createDispatch({ type: 'set_error', error: t('trip.createExpenseError') });
    }
  };

  const handleOpenDetail = useCallback((item: ExpenseSummary) => {
    setDeleteError(null);
    setSelectedExpenseId(item.id);
  }, []);

  const handleDetailClose = useCallback(() => {
    setConfirmingDelete(false);
    setDeleteError(null);
    setSelectedExpenseId(null);
  }, []);

  const handleDelete = useCallback(async () => {
    if (!selectedExpenseId) return;
    setDeleteError(null);
    try {
      await deleteExpenseMutation.mutateAsync(selectedExpenseId);
      setConfirmingDelete(false);
      setSelectedExpenseId(null);
    } catch {
      setDeleteError(t('trip.deleteExpenseError'));
    }
  }, [selectedExpenseId, deleteExpenseMutation, t]);

  const handlePaySettlement = useCallback((fromId: string, toId: string, amount: number) => {
    const key = `${fromId}-${toId}`;
    setPayingKey(key);
    paySettlementMutation.mutate({ toId, amount }, {
      onSettled: () => setPayingKey(null),
    });
  }, [paySettlementMutation]);

  const members = trip?.members;

  const expenseRows = useMemo((): ExpenseFlatRow[] => {
    const sorted = [...(expensesQuery.data ?? [])].sort(
      (a, b) => new Date(b.datetime).getTime() - new Date(a.datetime).getTime()
    );
    const todayStr = new Date().toDateString();
    const yesterdayStr = new Date(Date.now() - 86_400_000).toDateString();
    const totalsPerDay = new Map<string, number>();
    for (const item of sorted) {
      const dateKey = new Date(item.datetime).toDateString();
      totalsPerDay.set(dateKey, (totalsPerDay.get(dateKey) ?? 0) + (item.amount ?? 0));
    }
    const rows: ExpenseFlatRow[] = [];
    let lastDateKey: string | null = null;
    for (const item of sorted) {
      const d = new Date(item.datetime);
      const dateKey = d.toDateString();
      if (dateKey !== lastDateKey) {
        let label: string;
        if (dateKey === todayStr) label = t('trip.today');
        else if (dateKey === yesterdayStr) label = t('trip.yesterday');
        else label = d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
        rows.push({ _kind: 'date', label, total: totalsPerDay.get(dateKey) ?? 0 });
        lastDateKey = dateKey;
      }
      rows.push({ _kind: 'expense', item });
    }
    return rows;
  }, [expensesQuery.data, t]);

  const renderExpenseRow = useCallback(({ item: row }: { item: ExpenseFlatRow }) => {
    if (row._kind === 'date') {
      return (
        <View style={styles.dateSeparator}>
          <View style={[styles.dateLine, { backgroundColor: theme.border }]} />
          <View style={styles.dateLabelGroup}>
            <Text style={[styles.dateLabel, { color: theme.icon }]}>{row.label}</Text>
            <Text style={[styles.dateLabel, { color: theme.icon }]}>·</Text>
            <Text style={[styles.dateTotalInline, { color: theme.icon }]}>{row.total.toFixed(2)}€</Text>
          </View>
          <View style={[styles.dateLine, { backgroundColor: theme.border }]} />
        </View>
      );
    }
    const payerName = members?.find(m => m.id === row.item.payerId)?.username ?? '?';
    return <ExpenseRow item={row.item} payerName={payerName} theme={theme} onPress={handleOpenDetail} />;
  }, [members, theme, handleOpenDetail]);

  const usernameFor = useCallback((id: string) => trip?.members?.find(m => m.id === id)?.username ?? '?', [trip?.members]);

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>

      {/* Segmented control */}
      <View style={styles.segmentRow}>
        <SegmentedControl
          options={[
            { value: 'expenses', label: t('trip.expenses').toUpperCase() },
            { value: 'balances', label: t('trip.balances').toUpperCase() },
          ]}
          value={activeTab}
          onChange={(v) => handleTabChange(v as Tab)}
          containerBackground={theme.uiBackground}
          thumbBackground={theme.tabBackground}
          activeColor={theme.tint}
          inactiveColor={theme.icon}
          glowColor={`${theme.tint}35`}
        />
      </View>

      {activeTab === 'expenses' && (
        expensesQuery.isLoading ? <ActivityIndicator size="large" color={theme.tint} style={styles.centered} /> :
        expensesQuery.isError ? <Text style={[styles.emptyText, { color: theme.icon }]}>{t('trip.unableLoadExpenses')}</Text> : (
          <FlatList
            data={expenseRows}
            keyExtractor={(row, i) => row._kind === 'expense' ? (row.item.id ?? `e-${i}`) : `d-${row.label}-${i}`}
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={<Text style={[styles.emptyText, { color: theme.icon }]}>{t('trip.noExpenses')}</Text>}
            renderItem={renderExpenseRow}
            ListHeaderComponent={
              <Pressable
                style={({ pressed }) => [styles.addBtn, { backgroundColor: theme.tint, boxShadow: `0 0 28px ${theme.tint}55` }, pressed && { opacity: 0.8 }]}
                onPress={() => createDispatch({ type: 'open' })}
              >
                <Ionicons name="add-circle-outline" size={22} color="#fff" />
                <Text style={styles.addBtnText}>{t('trip.addExpense').toUpperCase()}</Text>
              </Pressable>
            }
          />
        )
      )}

      {activeTab === 'balances' && (
        <BalancesSection
          info={balancesQuery.data}
          isLoading={balancesQuery.isLoading}
          error={balancesQuery.isError ? t('trip.unableLoadBalances') : null}
          currentUserId={currentUserId}
          usernameFor={usernameFor}
          payingKey={payingKey}
          handlePaySettlement={handlePaySettlement}
          tripId={tripId ?? ''}
        />
      )}

      <ExpenseDetailModal
        visible={!!selectedExpenseId}
        expense={detailQuery.data}
        isLoading={detailQuery.isLoading}
        error={detailQuery.isError ? t('trip.loadExpenseDetailError') : null}
        confirmingDelete={confirmingDelete}
        deleting={deleteExpenseMutation.isPending}
        deleteError={deleteError}
        currentUserId={currentUserId}
        usernameFor={usernameFor}
        onClose={handleDetailClose}
        onDelete={handleDelete}
        setConfirmingDelete={setConfirmingDelete}
      />

      <CreateExpenseModal
        createModal={createModal}
        createDispatch={createDispatch}
        isPending={addExpenseMutation.isPending}
        members={trip?.members}
        onConfirm={handleCreate}
      />
    </View>
  );
};

export default ExpensesScreen;

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1 },

  segmentRow: { margin: 16 },

  list: { padding: 16, gap: 10, paddingBottom: 28 },
  emptyText: { textAlign: 'center', marginTop: 28, fontSize: 14, fontWeight: '600', opacity: 0.6 },
  sectionHeader: { fontSize: 10, fontWeight: '800', letterSpacing: 2, marginBottom: 10 },

  expenseCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 18,
    borderWidth: 1,
    gap: 12,
    boxShadow: '0 2px 10px rgba(0,0,0,0.2)',
  },
  expenseIcon: { width: 42, height: 42, borderRadius: 13, justifyContent: 'center', alignItems: 'center' },
  expenseLeft: { flex: 1, gap: 3 },
  expenseName: { fontSize: 15, fontWeight: '700' },
  expensePayer: { fontSize: 12, fontWeight: '500' },
  expenseAmount: { fontSize: 16, fontWeight: '800' },
  expenseRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },

  addBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 17, borderRadius: 18, marginBottom: 8 },
  addBtnText: { color: '#fff', fontWeight: '900', fontSize: 13, letterSpacing: 2 },

  balanceCard: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 18, borderWidth: 1, gap: 12 },
  balanceInitial: { fontSize: 16, fontWeight: '800' },
  balanceName: { fontSize: 15, fontWeight: '700' },
  nameRow: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 },
  balancePill: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20 },
  balanceAmt: { fontSize: 15, fontWeight: '800' },

  settlementCard: { borderRadius: 18, borderWidth: 1, overflow: 'hidden' },
  settlementTop: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 10 },
  settlementName: { fontSize: 14, fontWeight: '700', flexShrink: 1 },
  settlementArrow: { width: 28, height: 28, borderRadius: 9, justifyContent: 'center', alignItems: 'center' },
  settlementAmt: { fontSize: 14, fontWeight: '800' },
  payBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderTopWidth: 0.5, minHeight: 38 },
  pastSettlementsBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 11, borderRadius: 14, borderWidth: 0.5, marginBottom: 4 },
  pastSettlementsBtnText: { fontSize: 13, fontWeight: '600' },
  payBtnText: { fontSize: 12, fontWeight: '800', letterSpacing: 0.5 },
  payConfirmRow: { flexDirection: 'row', borderTopWidth: 0.5 },
  payConfirmBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 10 },
  separator: { borderBottomWidth: 0.5, marginVertical: 4 },
  meText: { fontWeight: '900' },
  meTag: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, borderWidth: 1 },
  meTagText: { fontSize: 9, fontWeight: '900', letterSpacing: 1.5 },

  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', padding: 16 },
  modalBox: {
    width: '100%',
    borderRadius: 24,
    padding: 24,
    gap: 12,
    borderWidth: 1,
    boxShadow: '0 0 60px rgba(168,85,247,0.2), 0 16px 40px rgba(0,0,0,0.5)',
  },
  modalTitle: { fontSize: 20, fontWeight: '800', letterSpacing: 0.3, marginBottom: 4 },

  amountHero: {
    alignSelf: 'stretch',
    alignItems: 'center',
    paddingVertical: 20,
    borderRadius: 18,
    borderWidth: 1,
    marginVertical: 6,
  },
  amountHeroText: { fontSize: 42, fontWeight: '900', letterSpacing: -1 },

  detailName: { fontSize: 18, fontWeight: '800', marginBottom: 4 },
  detailPairRow: { flexDirection: 'row', gap: 10 },
  detailCell: { flex: 1, borderRadius: 12, borderWidth: 1, padding: 12, gap: 4 },
  detailGroup: { borderRadius: 12, borderWidth: 1, overflow: 'hidden' },
  detailGroupSection: { padding: 12, gap: 4, borderBottomWidth: 0.5 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 0.5 },
  detailLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 1.5 },
  detailVal: { fontSize: 14, fontWeight: '700' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1 },
  chipText: { fontSize: 13, fontWeight: '700' },

  impactRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, padding: 12, borderRadius: 12, borderWidth: 1 },
  impactText: { flex: 1, fontSize: 12, fontWeight: '600', lineHeight: 17 },

  closeBtn: { paddingVertical: 15, borderRadius: 14, alignItems: 'center', marginTop: 10 },
  closeBtnText: { color: '#fff', fontWeight: '900', fontSize: 13, letterSpacing: 2 },
  errText: { color: Colors.warning, fontSize: 13, fontWeight: '600', textAlign: 'center' },

  dateSeparator: { flexDirection: 'row', alignItems: 'center', gap: 8, marginVertical: 4 },
  dateLine: { flex: 1, height: StyleSheet.hairlineWidth },
  dateLabelGroup: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dateLabel: { fontSize: 11, fontWeight: '500', letterSpacing: 0.3 },
  dateTotalInline: { fontSize: 11, fontWeight: '700' },

  categoryRow: { flexDirection: 'row', gap: 8, paddingBottom: 4 },
  categoryChip: { alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 14, borderWidth: 1.5, minWidth: 68 },
  categoryChipLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 0.3 },

  dropdown: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 14, borderWidth: 1, borderRadius: 12 },
  dropList: { borderRadius: 12, overflow: 'hidden', borderWidth: 0.5 },
  dropItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 0.5 },
  modalBtns: { flexDirection: 'row', gap: 10, marginTop: 4 },
  modalBtn: { flex: 1, paddingVertical: 15, borderRadius: 14, alignItems: 'center' },
});
