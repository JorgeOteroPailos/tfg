import React, { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { StyleSheet, View, FlatList, ActivityIndicator, Pressable, Modal, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useNavigation } from 'expo-router';
import { useAppTheme } from '../../../src/theme';
import { Colors } from '../../../constants/Colors';
import { useExpenses, type ExpenseSummary, type ExpenseDetail, type BalancesInfo } from '../../../src/expenses';
import { useTrip } from '../../../src/trips';
import { useAuth } from '../../../src/auth';
import { Ionicons } from '@expo/vector-icons';
import ThemedInput from '../../../components/ThemedInput';

type Tab = 'expenses' | 'balances';

interface ExpenseRowProps {
  item: ExpenseSummary;
  payerName: string;
  theme: typeof Colors.light;
  onPress: (item: ExpenseSummary) => void;
}

const ExpenseRow = React.memo(function ExpenseRow({ item, payerName, theme, onPress }: ExpenseRowProps) {
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
        <Ionicons name="receipt-outline" size={20} color={theme.tint} />
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

// ── Reducers (logic unchanged) ─────────────────────────────────────────────
type ListState = { expenses: ExpenseSummary[] | null; loading: boolean; error: string | null };
type ListAction = { type: 'loading' } | { type: 'loaded'; expenses: ExpenseSummary[] } | { type: 'error'; error: string } | { type: 'add'; expense: ExpenseSummary };
function listReducer(state: ListState, action: ListAction): ListState {
  switch (action.type) {
    case 'loading': return { ...state, loading: true, error: null };
    case 'loaded': return { expenses: action.expenses, loading: false, error: null };
    case 'error': return { ...state, loading: false, error: action.error };
    case 'add': return { ...state, expenses: state.expenses ? [action.expense, ...state.expenses] : [action.expense] };
    default: return state;
  }
}

type BalsState = { info: BalancesInfo | null; loading: boolean; error: string | null };
type BalsAction = { type: 'loading' } | { type: 'loaded'; info: BalancesInfo } | { type: 'error'; error: string } | { type: 'invalidate' };
function balsReducer(state: BalsState, action: BalsAction): BalsState {
  switch (action.type) {
    case 'loading': return { ...state, loading: true, error: null };
    case 'loaded': return { info: action.info, loading: false, error: null };
    case 'error': return { ...state, loading: false, error: action.error };
    case 'invalidate': return { ...state, info: null };
    default: return state;
  }
}

type DetailState = { visible: boolean; expense: ExpenseDetail | null; loading: boolean; error: string | null };
type DetailAction = { type: 'open' } | { type: 'close' } | { type: 'loaded'; expense: ExpenseDetail } | { type: 'error'; error: string };
function detailReducer(state: DetailState, action: DetailAction): DetailState {
  switch (action.type) {
    case 'open': return { visible: true, expense: null, loading: true, error: null };
    case 'close': return { visible: false, expense: null, loading: false, error: null };
    case 'loaded': return { ...state, expense: action.expense, loading: false };
    case 'error': return { ...state, loading: false, error: action.error };
    default: return state;
  }
}

type CreateState = { visible: boolean; creating: boolean; error: string | null; name: string; amount: string; payerId: string; beneficiaryIds: string[]; payerDropdownOpen: boolean };
type CreateAction = { type: 'open' } | { type: 'close' } | { type: 'set_name'; value: string } | { type: 'set_amount'; value: string } | { type: 'set_payer'; id: string } | { type: 'toggle_beneficiary'; id: string } | { type: 'toggle_dropdown' } | { type: 'start_creating' } | { type: 'done_creating' } | { type: 'set_error'; error: string | null };
const CREATE_INITIAL: CreateState = { visible: false, creating: false, error: null, name: '', amount: '', payerId: '', beneficiaryIds: [], payerDropdownOpen: false };
function createReducer(state: CreateState, action: CreateAction): CreateState {
  switch (action.type) {
    case 'open': return { ...CREATE_INITIAL, visible: true };
    case 'close': return CREATE_INITIAL;
    case 'set_name': return { ...state, name: action.value };
    case 'set_amount': return { ...state, amount: action.value };
    case 'set_payer': return { ...state, payerId: action.id, payerDropdownOpen: false };
    case 'toggle_beneficiary': return { ...state, beneficiaryIds: state.beneficiaryIds.includes(action.id) ? state.beneficiaryIds.filter(id => id !== action.id) : [...state.beneficiaryIds, action.id] };
    case 'toggle_dropdown': return { ...state, payerDropdownOpen: !state.payerDropdownOpen };
    case 'start_creating': return { ...state, creating: true, error: null };
    case 'done_creating': return { ...state, creating: false };
    case 'set_error': return { ...state, error: action.error };
    default: return state;
  }
}

type BalanceFlatRow = { _kind: 'header'; title: string; mt?: number } | { _kind: 'balance'; userId: string; amount: number } | { _kind: 'settlement'; fromId: string; toId: string; amount: number } | { _kind: 'separator' } | { _kind: 'empty'; text: string };

// ── Modals ─────────────────────────────────────────────────────────────────

type ExpenseDetailModalProps = {
  detail: DetailState;
  confirmingDelete: boolean;
  deleting: boolean;
  usernameFor: (id: string) => string;
  onClose: () => void;
  onDelete: () => void;
  setConfirmingDelete: (v: boolean) => void;
};

const ExpenseDetailModal = React.memo(function ExpenseDetailModal({
  detail, confirmingDelete, deleting, usernameFor, onClose, onDelete, setConfirmingDelete,
}: ExpenseDetailModalProps) {
  const { t } = useTranslation();
  const { themeName } = useAppTheme();
  const theme = Colors[themeName] ?? Colors.light;

  return (
    <Modal visible={detail.visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable onPress={() => {}} style={[styles.modalBox, { backgroundColor: theme.tabBackground, borderColor: theme.border }]}>
          <Text style={[styles.modalTitle, { color: theme.title }]}>{t('trip.expenseDetail')}</Text>

          {detail.loading && <ActivityIndicator color={theme.tint} style={{ marginVertical: 20 }} />}
          {detail.error && <Text style={styles.errText}>{detail.error}</Text>}

          {detail.expense && !detail.loading && (
            <>
              <Text style={[styles.detailName, { color: theme.title }]}>{detail.expense.name}</Text>
              <View style={[styles.amountHero, { backgroundColor: `${theme.tint}12`, borderColor: `${theme.tint}28` }]}>
                <Text style={[styles.amountHeroText, { color: theme.tint, textShadowColor: `${theme.tint}70`, textShadowRadius: 16 }]}>
                  {detail.expense.amount?.toFixed(2)}€
                </Text>
              </View>
              <View style={styles.detailPairRow}>
                {[
                  { label: t('trip.date'), val: new Date(detail.expense.datetime).toLocaleDateString() },
                  { label: t('trip.createdBy'), val: usernameFor(detail.expense.creatorId) },
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
                  <Text style={[styles.detailVal, { color: theme.title }]}>{usernameFor(detail.expense.payerId)}</Text>
                </View>
                <View style={styles.detailGroupSection}>
                  <Text style={[styles.detailLabel, { color: theme.icon }]}>{t('trip.beneficiaries').toUpperCase()}</Text>
                  <View style={styles.chips}>
                    {detail.expense.beneficiaryIds.map(id => (
                      <View key={id} style={[styles.chip, { backgroundColor: `${theme.tint}18`, borderColor: `${theme.tint}30` }]}>
                        <Text style={[styles.chipText, { color: theme.tint }]}>{usernameFor(id)}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              </View>
            </>
          )}

          {confirmingDelete ? (
            <>
              <Text style={[styles.detailLabel, { color: Colors.warning, textAlign: 'center', marginTop: 4 }]}>
                {t('trip.deleteExpenseConfirm').toUpperCase()}
              </Text>
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
                disabled={detail.loading || !detail.expense}
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

type CreateExpenseModalProps = {
  createModal: CreateState;
  createDispatch: React.Dispatch<CreateAction>;
  members?: Array<{ id?: string | null; username?: string | null }>;
  onConfirm: () => void;
};

const CreateExpenseModal = React.memo(function CreateExpenseModal({
  createModal, createDispatch, members, onConfirm,
}: CreateExpenseModalProps) {
  const { t } = useTranslation();
  const { themeName } = useAppTheme();
  const theme = Colors[themeName] ?? Colors.light;

  return (
    <Modal visible={createModal.visible} transparent animationType="fade" onRequestClose={() => createDispatch({ type: 'close' })}>
      <Pressable style={styles.overlay} onPress={() => createDispatch({ type: 'close' })}>
        <Pressable onPress={() => {}} style={[styles.modalBox, { backgroundColor: theme.tabBackground, borderColor: theme.border }]}>
          <Text style={[styles.modalTitle, { color: theme.title }]}>{t('trip.newExpense')}</Text>

          <ThemedInput placeholder={t('trip.description')} value={createModal.name} onChangeText={v => createDispatch({ type: 'set_name', value: v })} autoFocus />
          <ThemedInput placeholder={t('trip.amount')} value={createModal.amount} onChangeText={v => createDispatch({ type: 'set_amount', value: v })} keyboardType="numeric" />

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
            <Pressable style={[styles.modalBtn, { backgroundColor: theme.tint, boxShadow: `0 0 20px ${theme.tint}55` }]} onPress={onConfirm} disabled={createModal.creating}>
              {createModal.creating ? <ActivityIndicator color="#fff" size="small" /> : <Text style={{ color: '#fff', fontWeight: '800', letterSpacing: 1 }}>{t('common.create').toUpperCase()}</Text>}
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
});

// ── Screen ─────────────────────────────────────────────────────────────────
const ExpensesScreen = () => {
  const { t } = useTranslation();
  const { themeName } = useAppTheme();
  const theme = Colors[themeName] ?? Colors.light;
  const { trip } = useTrip();
  const { getExpenses, addExpense, getExpenseDetail, getBalances, paySettlement, deleteExpense } = useExpenses();
  const { userId: currentUserId } = useAuth();
  const navigation = useNavigation();

  const [activeTab, setActiveTab] = useState<Tab>('expenses');
  const [list, listDispatch] = useReducer(listReducer, { expenses: null, loading: false, error: null });
  const [bals, balsDispatch] = useReducer(balsReducer, { info: null, loading: false, error: null });
  const [detailModal, detailDispatch] = useReducer(detailReducer, { visible: false, expense: null, loading: false, error: null });
  const [createModal, createDispatch] = useReducer(createReducer, CREATE_INITIAL);
  const [payingKey, setPayingKey] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!detailModal.visible) setConfirmingDelete(false);
  }, [detailModal.visible]);
  const expensesLoadedRef = useRef<string | null>(null);

  useEffect(() => {
    if (trip?.name) navigation.setOptions({ title: trip.name });
  }, [trip?.name, navigation]);

  useEffect(() => {
    if (!trip?.id || expensesLoadedRef.current === trip.id) return;
    expensesLoadedRef.current = trip.id;
    const load = async () => {
      listDispatch({ type: 'loading' });
      try { listDispatch({ type: 'loaded', expenses: await getExpenses(trip.id!) }); }
      catch { listDispatch({ type: 'error', error: t('trip.unableLoadExpenses') }); }
    };
    load();
  }, [trip?.id, getExpenses, t]);

  const loadBalances = async () => {
    if (!trip?.id || bals.info !== null) return;
    balsDispatch({ type: 'loading' });
    try { balsDispatch({ type: 'loaded', info: await getBalances(trip.id!) }); }
    catch { balsDispatch({ type: 'error', error: t('trip.unableLoadBalances') }); }
  };

  const handleTabChange = (tab: Tab) => { setActiveTab(tab); if (tab === 'balances') loadBalances(); };

  const handleCreate = async () => {
    if (!trip?.id) return;
    const amountValue = Number(createModal.amount);
    if (!createModal.name.trim() || !amountValue || !createModal.payerId || createModal.beneficiaryIds.length === 0) {
      createDispatch({ type: 'set_error', error: t('trip.fillAllRequiredFields') }); return;
    }
    createDispatch({ type: 'start_creating' });
    try {
      const newExpense = await addExpense(trip.id, { name: createModal.name.trim(), amount: amountValue, payerId: createModal.payerId, beneficiaryIds: createModal.beneficiaryIds });
      listDispatch({ type: 'add', expense: newExpense });
      balsDispatch({ type: 'invalidate' });
      createDispatch({ type: 'close' });
    } catch {
      createDispatch({ type: 'set_error', error: t('trip.createExpenseError') });
    } finally {
      createDispatch({ type: 'done_creating' });
    }
  };

  const handleOpenDetail = useCallback(async (item: ExpenseSummary) => {
    if (!trip?.id) return;
    detailDispatch({ type: 'open' });
    try { detailDispatch({ type: 'loaded', expense: await getExpenseDetail(trip.id, item.id) }); }
    catch { detailDispatch({ type: 'error', error: t('trip.loadExpenseDetailError') }); }
  }, [trip?.id, getExpenseDetail, t]);

  const members = trip?.members;
  const renderExpenseItem = useCallback(({ item }: { item: ExpenseSummary }) => {
    const payerName = members?.find(m => m.id === item.payerId)?.username ?? '?';
    return <ExpenseRow item={item} payerName={payerName} theme={theme} onPress={handleOpenDetail} />;
  }, [members, theme, handleOpenDetail]);

  const usernameFor = useCallback((id: string) => trip?.members?.find(m => m.id === id)?.username ?? '?', [trip?.members]);

  const handleDelete = useCallback(async () => {
    if (!trip?.id || !detailModal.expense) return;
    setDeleting(true);
    try {
      await deleteExpense(trip.id, detailModal.expense.id);
      listDispatch({ type: 'loaded', expenses: (list.expenses ?? []).filter(e => e.id !== detailModal.expense!.id) });
      balsDispatch({ type: 'invalidate' });
      detailDispatch({ type: 'close' });
    } catch {
      detailDispatch({ type: 'error', error: t('trip.deleteExpenseError') });
    } finally {
      setDeleting(false);
      setConfirmingDelete(false);
    }
  }, [trip?.id, detailModal.expense, deleteExpense, list.expenses, t]);

  const handleDetailClose = useCallback(() => {
    setConfirmingDelete(false);
    detailDispatch({ type: 'close' });
  }, []);

  const handlePaySettlement = useCallback(async (fromId: string, toId: string, amount: number) => {
    if (!trip?.id) return;
    const key = `${fromId}-${toId}`;
    setPayingKey(key);
    try {
      await paySettlement(trip.id, fromId, toId, amount);
      balsDispatch({ type: 'invalidate' });
      await (async () => {
        balsDispatch({ type: 'loading' });
        try { balsDispatch({ type: 'loaded', info: await getBalances(trip.id!) }); }
        catch { balsDispatch({ type: 'error', error: t('trip.unableLoadBalances') }); }
      })();
    } catch {
      /* ignore — could add a toast here */
    } finally {
      setPayingKey(null);
    }
  }, [trip?.id, paySettlement, getBalances, t]);

  const balanceRows: BalanceFlatRow[] = (() => {
    const rows: BalanceFlatRow[] = [];
    const bl = bals.info?.balances ?? [];
    const sl = bals.info?.settlements ?? [];
    rows.push({ _kind: 'header', title: t('trip.balancePerMember') });
    if (!bl.length) rows.push({ _kind: 'empty', text: t('trip.noBalances') });
    else bl.forEach(b => rows.push({ _kind: 'balance', userId: b.userId, amount: b.amount }));
    rows.push({ _kind: 'header', title: t('trip.settlements'), mt: 20 });
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
  })();

  const renderBalanceRow = useCallback(({ item }: { item: BalanceFlatRow }) => {
    switch (item._kind) {
      case 'header':
        return <Text style={[styles.sectionHeader, { color: theme.icon }, item.mt ? { marginTop: item.mt } : undefined]}>{item.title.toUpperCase()}</Text>;
      case 'balance': {
        const pos = item.amount >= 0;
        const isMe = item.userId === currentUserId;
        return (
          <View style={[styles.balanceCard, { backgroundColor: theme.tabBackground, borderColor: theme.border }]}>
            <View style={[styles.balanceAvatar, { backgroundColor: `${theme.tint}18` }]}>
              <Text style={[styles.balanceInitial, { color: theme.tint }]}>{usernameFor(item.userId).charAt(0).toUpperCase()}</Text>
            </View>
            <View style={styles.nameRow}>
              <Text style={[styles.balanceName, { color: theme.title }, isMe && styles.meText]} numberOfLines={1}>{usernameFor(item.userId)}</Text>
              {isMe && (
                <View style={[styles.meTag, { backgroundColor: `${theme.tint}20`, borderColor: `${theme.tint}40` }]}>
                  <Text style={[styles.meTagText, { color: theme.tint }]}>{t('common.you').toUpperCase()}</Text>
                </View>
              )}
            </View>
            <View style={[styles.balancePill, { backgroundColor: pos ? 'rgba(76,175,80,0.15)' : 'rgba(239,68,68,0.15)', boxShadow: pos ? '0 0 10px rgba(76,175,80,0.3)' : '0 0 10px rgba(239,68,68,0.3)' }]}>
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
              <Pressable
                style={({ pressed }) => [styles.payBtn, { borderColor: theme.tint }, pressed && { opacity: 0.7 }]}
                onPress={() => handlePaySettlement(item.fromId, item.toId, item.amount)}
                disabled={isPaying}
              >
                {isPaying
                  ? <ActivityIndicator size="small" color={theme.tint} />
                  : <>
                      <Ionicons name="checkmark-circle-outline" size={15} color={theme.tint} />
                      <Text style={[styles.payBtnText, { color: theme.tint }]}>{t('trip.markAsPaid')}</Text>
                    </>
                }
              </Pressable>
            )}
          </View>
        );
      }
      case 'separator':
        return <View style={[styles.separator, { borderBottomColor: theme.border }]} />;
      case 'empty':
        return <Text style={[styles.emptyText, { color: theme.icon }]}>{item.text}</Text>;
      default:
        return null;
    }
  }, [theme, usernameFor, currentUserId, payingKey, handlePaySettlement, t]);

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>

      {/* Segmented control */}
      <View style={[styles.segmentWrap, { backgroundColor: theme.uiBackground }]}>
        {(['expenses', 'balances'] as Tab[]).map(tab => (
          <Pressable
            key={tab}
            style={[
              styles.segment,
              activeTab === tab && { backgroundColor: theme.tabBackground, boxShadow: `0 0 16px ${theme.tint}35` },
            ]}
            onPress={() => handleTabChange(tab)}
          >
            <Text style={[styles.segmentLabel, { color: activeTab === tab ? theme.tint : theme.icon }, activeTab === tab && styles.segmentLabelActive]}>
              {t(tab === 'expenses' ? 'trip.expenses' : 'trip.balances').toUpperCase()}
            </Text>
          </Pressable>
        ))}
      </View>

      {activeTab === 'expenses' && (
        list.loading ? <ActivityIndicator size="large" color={theme.tint} style={styles.centered} /> :
        list.error ? <Text style={[styles.emptyText, { color: theme.icon }]}>{list.error}</Text> : (
          <FlatList
            data={list.expenses ?? []}
            keyExtractor={(item, i) => item.id ?? `${i}`}
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={<Text style={[styles.emptyText, { color: theme.icon }]}>{t('trip.noExpenses')}</Text>}
            renderItem={renderExpenseItem}
            ListFooterComponent={
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
        bals.loading ? <ActivityIndicator size="large" color={theme.tint} style={styles.centered} /> :
        bals.error ? <Text style={[styles.emptyText, { color: theme.icon }]}>{bals.error}</Text> : (
          <FlatList
            data={balanceRows}
            keyExtractor={(item, i) => item._kind === 'balance' ? item.userId : item._kind === 'settlement' ? `${item.fromId}-${item.toId}` : item._kind === 'separator' ? `sep-${i}` : `${item._kind}-${i}`}
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
            renderItem={renderBalanceRow}
          />
        )
      )}

      <ExpenseDetailModal
        detail={detailModal}
        confirmingDelete={confirmingDelete}
        deleting={deleting}
        usernameFor={usernameFor}
        onClose={handleDetailClose}
        onDelete={handleDelete}
        setConfirmingDelete={setConfirmingDelete}
      />

      <CreateExpenseModal
        createModal={createModal}
        createDispatch={createDispatch}
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

  segmentWrap: { flexDirection: 'row', margin: 16, borderRadius: 16, padding: 4 },
  segment: { flex: 1, paddingVertical: 11, borderRadius: 12, alignItems: 'center' },
  segmentLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 1.5, opacity: 0.55 },
  segmentLabelActive: { opacity: 1 },

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

  addBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 17, borderRadius: 18, marginTop: 8 },
  addBtnText: { color: '#fff', fontWeight: '900', fontSize: 13, letterSpacing: 2 },

  balanceCard: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 18, borderWidth: 1, gap: 12 },
  balanceAvatar: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
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
  payBtnText: { fontSize: 12, fontWeight: '800', letterSpacing: 0.5 },
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

  closeBtn: { paddingVertical: 15, borderRadius: 14, alignItems: 'center', marginTop: 10 },
  closeBtnText: { color: '#fff', fontWeight: '900', fontSize: 13, letterSpacing: 2 },
  errText: { color: Colors.warning, fontSize: 13, fontWeight: '600', textAlign: 'center' },

  dropdown: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 14, borderWidth: 1, borderRadius: 12 },
  dropList: { borderRadius: 12, overflow: 'hidden', borderWidth: 0.5 },
  dropItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 0.5 },
  modalBtns: { flexDirection: 'row', gap: 10, marginTop: 4 },
  modalBtn: { flex: 1, paddingVertical: 15, borderRadius: 14, alignItems: 'center' },
});
