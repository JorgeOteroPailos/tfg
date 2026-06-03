import React, { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { StyleSheet, View, FlatList, ActivityIndicator, Pressable, Modal } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useNavigation } from 'expo-router';
import { useAppTheme } from '../../../src/theme';
import { Colors } from '../../../constants/Colors';
import { useExpenses, type ExpenseSummary, type ExpenseDetail, type BalancesInfo } from '../../../src/expenses';
import { useTrip } from '../../../src/trips';
import { Ionicons } from '@expo/vector-icons';
import ThemedText from '../../../components/ThemedText';
import ThemedInput from '../../../components/ThemedInput';

type Tab = 'expenses' | 'balances';

interface ExpenseRowProps {
  item: ExpenseSummary;
  payerName: string;
  background: string;
  icon: string;
  onPress: (item: ExpenseSummary) => void;
}
const ExpenseRow = React.memo(function ExpenseRow({ item, payerName, background, icon, onPress }: ExpenseRowProps) {
  return (
    <View style={[styles.expenseCard, { backgroundColor: background }]}>
      <View style={styles.expenseLeft}>
        <ThemedText style={styles.expenseDescription}>{item.name}</ThemedText>
        <ThemedText style={styles.expensePayer}>{payerName}</ThemedText>
      </View>
      <View style={styles.expenseRight}>
        <ThemedText style={styles.expenseAmount}>{item.amount?.toFixed(2)}€</ThemedText>
        <Pressable onPress={() => onPress(item)} hitSlop={8}>
          <Ionicons name="chevron-down" size={18} color={icon} />
        </Pressable>
      </View>
    </View>
  );
});

// --- Expenses list state ---
type ListState = { expenses: ExpenseSummary[] | null; loading: boolean; error: string | null };
type ListAction =
  | { type: 'loading' }
  | { type: 'loaded'; expenses: ExpenseSummary[] }
  | { type: 'error'; error: string }
  | { type: 'add'; expense: ExpenseSummary };

function listReducer(state: ListState, action: ListAction): ListState {
  switch (action.type) {
    case 'loading': return { ...state, loading: true, error: null };
    case 'loaded': return { expenses: action.expenses, loading: false, error: null };
    case 'error': return { ...state, loading: false, error: action.error };
    case 'add': return { ...state, expenses: state.expenses ? [action.expense, ...state.expenses] : [action.expense] };
    default: return state;
  }
}

// --- Balances state ---
type BalsState = { info: BalancesInfo | null; loading: boolean; error: string | null };
type BalsAction =
  | { type: 'loading' }
  | { type: 'loaded'; info: BalancesInfo }
  | { type: 'error'; error: string }
  | { type: 'invalidate' };

function balsReducer(state: BalsState, action: BalsAction): BalsState {
  switch (action.type) {
    case 'loading': return { ...state, loading: true, error: null };
    case 'loaded': return { info: action.info, loading: false, error: null };
    case 'error': return { ...state, loading: false, error: action.error };
    case 'invalidate': return { ...state, info: null };
    default: return state;
  }
}

// --- Expense detail modal state ---
type DetailState = { visible: boolean; expense: ExpenseDetail | null; loading: boolean; error: string | null };
type DetailAction =
  | { type: 'open' }
  | { type: 'close' }
  | { type: 'loaded'; expense: ExpenseDetail }
  | { type: 'error'; error: string };

function detailReducer(state: DetailState, action: DetailAction): DetailState {
  switch (action.type) {
    case 'open': return { visible: true, expense: null, loading: true, error: null };
    case 'close': return { visible: false, expense: null, loading: false, error: null };
    case 'loaded': return { ...state, expense: action.expense, loading: false };
    case 'error': return { ...state, loading: false, error: action.error };
    default: return state;
  }
}

// --- Create expense modal state ---
type CreateState = {
  visible: boolean;
  creating: boolean;
  error: string | null;
  name: string;
  amount: string;
  payerId: string;
  beneficiaryIds: string[];
  payerDropdownOpen: boolean;
};
type CreateAction =
  | { type: 'open' }
  | { type: 'close' }
  | { type: 'set_name'; value: string }
  | { type: 'set_amount'; value: string }
  | { type: 'set_payer'; id: string }
  | { type: 'toggle_beneficiary'; id: string }
  | { type: 'toggle_dropdown' }
  | { type: 'start_creating' }
  | { type: 'done_creating' }
  | { type: 'set_error'; error: string | null };

const CREATE_INITIAL: CreateState = {
  visible: false, creating: false, error: null,
  name: '', amount: '', payerId: '', beneficiaryIds: [], payerDropdownOpen: false,
};

function createReducer(state: CreateState, action: CreateAction): CreateState {
  switch (action.type) {
    case 'open': return { ...CREATE_INITIAL, visible: true };
    case 'close': return CREATE_INITIAL;
    case 'set_name': return { ...state, name: action.value };
    case 'set_amount': return { ...state, amount: action.value };
    case 'set_payer': return { ...state, payerId: action.id, payerDropdownOpen: false };
    case 'toggle_beneficiary': return {
      ...state,
      beneficiaryIds: state.beneficiaryIds.includes(action.id)
        ? state.beneficiaryIds.filter(id => id !== action.id)
        : [...state.beneficiaryIds, action.id],
    };
    case 'toggle_dropdown': return { ...state, payerDropdownOpen: !state.payerDropdownOpen };
    case 'start_creating': return { ...state, creating: true, error: null };
    case 'done_creating': return { ...state, creating: false };
    case 'set_error': return { ...state, error: action.error };
    default: return state;
  }
}

// --- Balances FlatList rows ---
type BalanceFlatRow =
  | { _kind: 'header'; title: string; mt?: number }
  | { _kind: 'balance'; userId: string; amount: number }
  | { _kind: 'settlement'; fromId: string; toId: string; amount: number }
  | { _kind: 'empty'; text: string };

const ExpensesScreen = () => {
  const { t } = useTranslation();
  const { themeName } = useAppTheme();
  const theme = Colors[themeName] ?? Colors.light;
  const { trip } = useTrip();
  const { getExpenses, addExpense, getExpenseDetail, getBalances } = useExpenses();
  const navigation = useNavigation();

  const [activeTab, setActiveTab] = useState<Tab>('expenses');
  const [list, listDispatch] = useReducer(listReducer, { expenses: null, loading: false, error: null });
  const [bals, balsDispatch] = useReducer(balsReducer, { info: null, loading: false, error: null });
  const [detailModal, detailDispatch] = useReducer(detailReducer, { visible: false, expense: null, loading: false, error: null });
  const [createModal, createDispatch] = useReducer(createReducer, CREATE_INITIAL);

  const expensesLoadedRef = useRef<string | null>(null);

  useEffect(() => {
    if (trip?.name) navigation.setOptions({ title: trip.name });
  }, [trip?.name, navigation]);

  useEffect(() => {
    if (!trip?.id) return;
    if (expensesLoadedRef.current === trip.id) return;
    expensesLoadedRef.current = trip.id;
    const load = async () => {
      listDispatch({ type: 'loading' });
      try {
        listDispatch({ type: 'loaded', expenses: await getExpenses(trip.id!) });
      } catch {
        listDispatch({ type: 'error', error: t('trip.unableLoadExpenses') });
      }
    };
    load();
  }, [trip?.id, getExpenses, t]);

  const loadBalances = async () => {
    if (!trip?.id || bals.info !== null) return;
    balsDispatch({ type: 'loading' });
    try {
      balsDispatch({ type: 'loaded', info: await getBalances(trip.id!) });
    } catch {
      balsDispatch({ type: 'error', error: t('trip.unableLoadBalances') });
    }
  };

  const handleTabChange = (tab: Tab) => {
    setActiveTab(tab);
    if (tab === 'balances') loadBalances();
  };

  const handleCreate = async () => {
    if (!trip?.id) return;
    const amountValue = Number(createModal.amount);
    if (!createModal.name.trim() || !amountValue || !createModal.payerId || createModal.beneficiaryIds.length === 0) {
      createDispatch({ type: 'set_error', error: t('trip.fillAllRequiredFields') });
      return;
    }
    createDispatch({ type: 'start_creating' });
    try {
      const newExpense = await addExpense(trip.id, {
        name: createModal.name.trim(),
        amount: amountValue,
        payerId: createModal.payerId,
        beneficiaryIds: createModal.beneficiaryIds,
      });
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
    try {
      detailDispatch({ type: 'loaded', expense: await getExpenseDetail(trip.id, item.id) });
    } catch (e) {
      console.log('[handleOpenDetail] error:', e);
      detailDispatch({ type: 'error', error: t('trip.loadExpenseDetailError') });
    }
  }, [trip?.id, getExpenseDetail, t]);

  const members = trip?.members;
  const renderExpenseItem = useCallback(({ item }: { item: ExpenseSummary }) => {
    const payerName = members?.find(m => m.id === item.payerId)?.username ?? '?';
    return (
      <ExpenseRow
        item={item}
        payerName={payerName}
        background={theme.tabBackground}
        icon={theme.icon}
        onPress={handleOpenDetail}
      />
    );
  }, [members, theme.tabBackground, theme.icon, handleOpenDetail]);

  const usernameFor = useCallback((userId: string) =>
    trip?.members?.find(m => m.id === userId)?.username ?? '?',
    [trip?.members]
  );

  const balanceRows: BalanceFlatRow[] = (() => {
    const rows: BalanceFlatRow[] = [];
    const balanceList = bals.info?.balances ?? [];
    const settlementList = bals.info?.settlements ?? [];

    rows.push({ _kind: 'header', title: t('trip.balancePerMember') });
    if (balanceList.length === 0) {
      rows.push({ _kind: 'empty', text: t('trip.noBalances') });
    } else {
      balanceList.forEach(b => rows.push({ _kind: 'balance', userId: b.userId, amount: b.amount }));
    }

    rows.push({ _kind: 'header', title: t('trip.settlements'), mt: 16 });
    if (settlementList.length === 0) {
      rows.push({ _kind: 'empty', text: t('trip.noSettlements') });
    } else {
      settlementList.forEach(s => rows.push({ _kind: 'settlement', fromId: s.fromId, toId: s.toId, amount: s.amount }));
    }

    return rows;
  })();

  const renderBalanceRow = useCallback(({ item }: { item: BalanceFlatRow }) => {
    switch (item._kind) {
      case 'header':
        return (
          <ThemedText style={[styles.sectionHeader, item.mt ? { marginTop: item.mt } : undefined]}>
            {item.title}
          </ThemedText>
        );
      case 'balance':
        return (
          <View style={[styles.balanceCard, { backgroundColor: theme.tabBackground }]}>
            <ThemedText style={styles.balanceName}>{usernameFor(item.userId)}</ThemedText>
            <ThemedText style={[styles.balanceAmount, { color: item.amount >= 0 ? '#4caf50' : Colors.warning }]}>
              {item.amount >= 0 ? '+' : ''}{item.amount.toFixed(2)}€
            </ThemedText>
          </View>
        );
      case 'settlement':
        return (
          <View style={[styles.settlementCard, { backgroundColor: theme.tabBackground }]}>
            <ThemedText style={styles.settlementFrom}>{usernameFor(item.fromId)}</ThemedText>
            <Ionicons name="arrow-forward" size={16} color={theme.icon} />
            <ThemedText style={styles.settlementTo}>{usernameFor(item.toId)}</ThemedText>
            <ThemedText style={styles.settlementAmount}>{item.amount.toFixed(2)}€</ThemedText>
          </View>
        );
      case 'empty':
        return <ThemedText style={styles.emptyText}>{item.text}</ThemedText>;
    }
  }, [theme, usernameFor]);

  return (
    <View style={styles.container}>

      {/* Segmented control */}
      <View style={[styles.tabBar, { backgroundColor: theme.tabBackground }]}>
        {(['expenses', 'balances'] as Tab[]).map(tab => (
          <Pressable
            key={tab}
            style={[styles.tabPill, activeTab === tab && { backgroundColor: theme.tint }]}
            onPress={() => handleTabChange(tab)}
          >
            <ThemedText style={[styles.tabLabel, activeTab === tab && styles.tabLabelActive]}>
              {t(tab === 'expenses' ? 'trip.expenses' : 'trip.balances')}
            </ThemedText>
          </Pressable>
        ))}
      </View>

      {/* Expenses tab */}
      {activeTab === 'expenses' && (
        list.loading ? (
          <ActivityIndicator size="large" color={theme.tint} style={styles.centered} />
        ) : list.error ? (
          <ThemedText style={styles.emptyText}>{list.error}</ThemedText>
        ) : (
          <FlatList
            data={list.expenses ?? []}
            keyExtractor={(item, i) => item.id ?? `${i}`}
            contentContainerStyle={styles.list}
            ListEmptyComponent={<ThemedText style={styles.emptyText}>{t('trip.noExpenses')}</ThemedText>}
            renderItem={renderExpenseItem}
            ListFooterComponent={
              <Pressable
                style={[styles.addButton, { backgroundColor: theme.tint }]}
                onPress={() => createDispatch({ type: 'open' })}
              >
                <Ionicons name="add" size={20} color="white" />
                <ThemedText style={styles.addButtonText}>{t('trip.addExpense')}</ThemedText>
              </Pressable>
            }
          />
        )
      )}

      {/* Balances tab */}
      {activeTab === 'balances' && (
        bals.loading ? (
          <ActivityIndicator size="large" color={theme.tint} style={styles.centered} />
        ) : bals.error ? (
          <ThemedText style={styles.emptyText}>{bals.error}</ThemedText>
        ) : (
          <FlatList
            data={balanceRows}
            keyExtractor={(item, i) => item._kind === 'balance' ? item.userId : item._kind === 'settlement' ? `${item.fromId}-${item.toId}` : `${item._kind}-${i}`}
            contentContainerStyle={styles.list}
            renderItem={renderBalanceRow}
          />
        )
      )}

      {/* Expense detail modal */}
      <Modal visible={detailModal.visible} transparent animationType="fade" onRequestClose={() => detailDispatch({ type: 'close' })}>
        <Pressable style={styles.modalOverlay} onPress={() => detailDispatch({ type: 'close' })}>
          <Pressable onPress={() => {}} style={[styles.modalBox, { backgroundColor: theme.tabBackground }]}>
            <ThemedText style={styles.modalTitle}>{t('trip.expenseDetail')}</ThemedText>

            {detailModal.loading && <ActivityIndicator color={theme.tint} style={{ marginVertical: 20 }} />}
            {detailModal.error && <ThemedText style={styles.errorText}>{detailModal.error}</ThemedText>}

            {detailModal.expense && !detailModal.loading && (
              <>
                <ThemedText style={styles.detailName}>{detailModal.expense.name}</ThemedText>

                <View style={styles.detailRow}>
                  <ThemedText style={styles.detailLabel}>{t('trip.amount')}</ThemedText>
                  <ThemedText style={styles.detailValue}>{detailModal.expense.amount?.toFixed(2)}€</ThemedText>
                </View>

                <View style={styles.detailRow}>
                  <ThemedText style={styles.detailLabel}>{t('trip.date')}</ThemedText>
                  <ThemedText style={styles.detailValue}>
                    {new Date(detailModal.expense.datetime).toLocaleDateString()}
                  </ThemedText>
                </View>

                <View style={styles.detailRow}>
                  <ThemedText style={styles.detailLabel}>{t('trip.payer')}</ThemedText>
                  <ThemedText style={styles.detailValue}>{usernameFor(detailModal.expense.payerId)}</ThemedText>
                </View>

                <ThemedText style={[styles.detailLabel, { marginTop: 12, marginBottom: 4 }]}>{t('trip.beneficiaries')}</ThemedText>
                {detailModal.expense.beneficiaryIds.map(id => (
                  <ThemedText key={id} style={styles.detailBeneficiary}>· {usernameFor(id)}</ThemedText>
                ))}
              </>
            )}

            <Pressable
              style={[styles.closeButton, { backgroundColor: theme.tint }]}
              onPress={() => detailDispatch({ type: 'close' })}
            >
              <ThemedText style={{ color: 'white', fontWeight: '600' }}>{t('common.close')}</ThemedText>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Create expense modal */}
      <Modal visible={createModal.visible} transparent animationType="fade" onRequestClose={() => createDispatch({ type: 'close' })}>
        <Pressable style={styles.modalOverlay} onPress={() => createDispatch({ type: 'close' })}>
          <Pressable onPress={() => {}} style={[styles.modalBox, { backgroundColor: theme.tabBackground }]}>
            <ThemedText style={styles.modalTitle}>{t('trip.newExpense')}</ThemedText>

            <ThemedInput
              style={[styles.modalInput, { color: theme.text, borderColor: theme.tint }]}
              placeholder={t('trip.description')}
              placeholderTextColor={theme.icon}
              value={createModal.name}
              onChangeText={value => createDispatch({ type: 'set_name', value })}
              autoFocus
            />

            <ThemedInput
              style={[styles.modalInput, { color: theme.text, borderColor: theme.tint }]}
              placeholder={t('trip.amount')}
              placeholderTextColor={theme.icon}
              value={createModal.amount}
              onChangeText={value => createDispatch({ type: 'set_amount', value })}
              keyboardType="numeric"
            />

            <Pressable
              style={[styles.dropdown, { borderColor: theme.tint }]}
              onPress={() => createDispatch({ type: 'toggle_dropdown' })}
            >
              <ThemedText>
                {createModal.payerId ? trip?.members?.find(m => m.id === createModal.payerId)?.username : t('trip.selectPayer')}
              </ThemedText>
              <Ionicons name={createModal.payerDropdownOpen ? 'chevron-up' : 'chevron-down'} size={16} color={theme.icon} />
            </Pressable>

            {createModal.payerDropdownOpen && (
              <View style={[styles.dropdownList, { backgroundColor: theme.tabBackground }]}>
                {trip?.members?.map(member => (
                  <Pressable
                    key={member.id}
                    style={styles.dropdownItem}
                    onPress={() => createDispatch({ type: 'set_payer', id: member.id ?? '' })}
                  >
                    <ThemedText>{member.username}</ThemedText>
                  </Pressable>
                ))}
              </View>
            )}

            <ThemedText style={styles.sectionLabel}>{t('trip.beneficiaries')}</ThemedText>
            <View style={[styles.dropdownList, { backgroundColor: theme.tabBackground }]}>
              {trip?.members?.map(member => {
                const selected = createModal.beneficiaryIds.includes(member.id ?? '');
                return (
                  <Pressable
                    key={member.id}
                    style={styles.dropdownItem}
                    onPress={() => createDispatch({ type: 'toggle_beneficiary', id: member.id ?? '' })}
                  >
                    <ThemedText>{member.username}</ThemedText>
                    <Ionicons
                      name={selected ? 'checkbox' : 'square-outline'}
                      size={20}
                      color={selected ? theme.tint : theme.icon}
                    />
                  </Pressable>
                );
              })}
            </View>

            {createModal.error && <ThemedText style={styles.errorText}>{createModal.error}</ThemedText>}

            <View style={styles.modalButtons}>
              <Pressable style={[styles.modalButton, styles.cancelButton]} onPress={() => createDispatch({ type: 'close' })}>
                <ThemedText>{t('common.cancel')}</ThemedText>
              </Pressable>
              <Pressable
                style={[styles.modalButton, { backgroundColor: theme.tint }]}
                onPress={handleCreate}
                disabled={createModal.creating}
              >
                {createModal.creating
                  ? <ActivityIndicator color="white" />
                  : <ThemedText style={{ color: 'white', fontWeight: '600' }}>{t('common.create')}</ThemedText>}
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
};

export default ExpensesScreen;

const styles = StyleSheet.create({
  container: { flex: 1, marginTop: 20 },
  centered: { flex: 1 },
  tabBar: {
    flexDirection: 'row',
    margin: 12,
    borderRadius: 10,
    padding: 4,
  },
  tabPill: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  tabLabel: {
    fontSize: 14,
    fontWeight: '500',
    opacity: 0.6,
  },
  tabLabelActive: {
    color: 'white',
    opacity: 1,
    fontWeight: '600',
  },
  list: { padding: 16, gap: 10 },
  emptyText: { textAlign: 'center', marginTop: 20, fontSize: 15, opacity: 0.6 },
  sectionHeader: {
    fontSize: 13,
    fontWeight: '600',
    opacity: 0.5,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  expenseCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
  },
  expenseLeft: { gap: 4 },
  expenseDescription: { fontSize: 15, fontWeight: '500' },
  expensePayer: { fontSize: 13, opacity: 0.6 },
  expenseAmount: { fontSize: 16, fontWeight: '600' },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 16,
    borderRadius: 12,
    marginTop: 8,
  },
  addButtonText: { color: 'white', fontWeight: '600', fontSize: 16 },
  balanceCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
  },
  balanceName: { fontSize: 15, fontWeight: '500' },
  balanceAmount: { fontSize: 15, fontWeight: '700' },
  settlementCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    gap: 8,
  },
  settlementFrom: { fontSize: 14, fontWeight: '500' },
  settlementTo: { flex: 1, fontSize: 14, fontWeight: '500' },
  settlementAmount: { fontSize: 14, fontWeight: '700' },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalBox: {
    width: '100%',
    borderRadius: 16,
    padding: 20,
  },
  modalTitle: { fontSize: 20, fontWeight: '700', marginBottom: 16 },
  modalInput: { marginBottom: 12 },
  sectionLabel: { fontSize: 13, opacity: 0.6, marginBottom: 6 },
  dropdown: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderWidth: 1.5,
    borderRadius: 8,
    marginBottom: 12,
  },
  dropdownList: {
    borderRadius: 8,
    marginBottom: 12,
    overflow: 'hidden',
    borderWidth: 0.5,
    borderColor: '#ccc',
  },
  dropdownItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 0.5,
    borderBottomColor: '#eee',
  },
  modalButtons: { flexDirection: 'row', gap: 8, marginTop: 12 },
  modalButton: { flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  cancelButton: { borderWidth: 1, borderColor: '#ccc' },
  errorText: { color: '#d9534f', marginBottom: 8, textAlign: 'center' },
  expenseRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  detailName: { fontSize: 18, fontWeight: '700', marginBottom: 16 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  detailLabel: { fontSize: 13, opacity: 0.6, fontWeight: '500' },
  detailValue: { fontSize: 15, fontWeight: '600' },
  detailBeneficiary: { fontSize: 14, marginBottom: 4 },
  closeButton: { paddingVertical: 12, borderRadius: 10, alignItems: 'center', marginTop: 20 },
});
