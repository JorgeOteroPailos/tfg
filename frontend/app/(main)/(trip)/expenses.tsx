import React, { useEffect, useState } from 'react';
import { StyleSheet, View, FlatList, ActivityIndicator, TouchableOpacity, Modal, ScrollView } from 'react-native';
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

const ExpensesScreen = () => {
  const { t } = useTranslation();
  const { themeName } = useAppTheme();
  const theme = Colors[themeName] ?? Colors.light;
  const { trip } = useTrip();
  const { getExpenses, addExpense, getExpenseDetail, getBalances } = useExpenses();
  const navigation = useNavigation();

  const [activeTab, setActiveTab] = useState<Tab>('expenses');

  // --- Expenses state ---
  const [expenses, setExpenses] = useState<ExpenseSummary[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // --- Balances state ---
  const [balancesInfo, setBalancesInfo] = useState<BalancesInfo | null>(null);
  const [balancesLoading, setBalancesLoading] = useState(false);
  const [balancesError, setBalancesError] = useState<string | null>(null);

  // --- Expense detail modal state ---
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [expenseDetail, setExpenseDetail] = useState<ExpenseDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  // --- Create expense modal state ---
  const [modalVisible, setModalVisible] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [payerId, setPayerId] = useState('');
  const [beneficiaryIds, setBeneficiaryIds] = useState<string[]>([]);
  const [payerDropdownOpen, setPayerDropdownOpen] = useState(false);

  useEffect(() => {
    if (trip?.name) navigation.setOptions({ title: trip.name });
  }, [trip?.name]);

  useEffect(() => {
    if (!trip?.id || expenses !== null) return;
    const load = async () => {
      setLoading(true);
      try {
        const data = await getExpenses(trip.id!);
        setExpenses(data);
      } catch {
        setError(t('trip.unableLoadExpenses'));
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [trip?.id, expenses]);

  const loadBalances = async () => {
    if (!trip?.id || balancesInfo !== null) return;
    setBalancesLoading(true);
    setBalancesError(null);
    try {
      const data = await getBalances(trip.id!);
      setBalancesInfo(data);
    } catch {
      setBalancesError(t('trip.unableLoadBalances'));
    } finally {
      setBalancesLoading(false);
    }
  };

  const handleTabChange = (tab: Tab) => {
    setActiveTab(tab);
    if (tab === 'balances') loadBalances();
  };

  const handleCreate = async () => {
    if (!trip?.id) return;
    const amountValue = Number(amount);
    if (!name.trim() || !amountValue || !payerId || beneficiaryIds.length === 0) {
      setCreateError(t('trip.fillAllRequiredFields'));
      return;
    }
    setCreating(true);
    setCreateError(null);
    try {
      const newExpense = await addExpense(trip.id, {
        name: name.trim(),
        amount: amountValue,
        payerId,
        beneficiaryIds,
      });
      setExpenses(prev => prev ? [newExpense, ...prev] : [newExpense]);
      // Invalidate balances so they reload next time
      setBalancesInfo(null);
      setModalVisible(false);
      setName(''); setAmount(''); setPayerId(''); setBeneficiaryIds([]);
    } catch {
      setCreateError(t('trip.createExpenseError'));
    } finally {
      setCreating(false);
    }
  };

  const resetModal = () => {
    setModalVisible(false);
    setCreateError(null);
    setName(''); setAmount(''); setPayerId(''); setBeneficiaryIds([]);
    setPayerDropdownOpen(false);
  };

  const handleOpenDetail = async (item: ExpenseSummary) => {
    if (!trip?.id) return;
    setExpenseDetail(null);
    setDetailError(null);
    setDetailModalVisible(true);
    setDetailLoading(true);
    try {
      const detail = await getExpenseDetail(trip.id, item.id);
      setExpenseDetail(detail);
    } catch (e) {
      console.log('[handleOpenDetail] error:', e);
      setDetailError(t('trip.loadExpenseDetailError'));
    } finally {
      setDetailLoading(false);
    }
  };

  const usernameFor = (userId: string) =>
    trip?.members?.find(m => m.id === userId)?.username ?? '?';

  return (
    <View style={styles.container}>

      {/* Segmented control */}
      <View style={[styles.tabBar, { backgroundColor: theme.tabBackground }]}>
        {(['expenses', 'balances'] as Tab[]).map(tab => (
          <TouchableOpacity
            key={tab}
            style={[styles.tabPill, activeTab === tab && { backgroundColor: theme.tint }]}
            onPress={() => handleTabChange(tab)}
          >
            <ThemedText style={[styles.tabLabel, activeTab === tab && styles.tabLabelActive]}>
              {t(tab === 'expenses' ? 'trip.expenses' : 'trip.balances')}
            </ThemedText>
          </TouchableOpacity>
        ))}
      </View>

      {/* Expenses tab */}
      {activeTab === 'expenses' && (
        loading ? (
          <ActivityIndicator size="large" color={theme.tint} style={styles.centered} />
        ) : error ? (
          <ThemedText style={styles.emptyText}>{error}</ThemedText>
        ) : (
          <FlatList
            data={expenses ?? []}
            keyExtractor={(item, i) => item.id ?? `${i}`}
            contentContainerStyle={styles.list}
            ListEmptyComponent={<ThemedText style={styles.emptyText}>{t('trip.noExpenses')}</ThemedText>}
            renderItem={({ item }) => {
              const payer = trip?.members?.find(m => m.id === item.payerId);
              return (
                <View style={[styles.expenseCard, { backgroundColor: theme.tabBackground }]}>
                  <View style={styles.expenseLeft}>
                    <ThemedText style={styles.expenseDescription}>{item.name}</ThemedText>
                    <ThemedText style={styles.expensePayer}>{payer?.username ?? '?'}</ThemedText>
                  </View>
                  <View style={styles.expenseRight}>
                    <ThemedText style={styles.expenseAmount}>{item.amount?.toFixed(2)}€</ThemedText>
                    <TouchableOpacity onPress={() => handleOpenDetail(item)} hitSlop={8}>
                      <Ionicons name="chevron-down" size={18} color={theme.icon} />
                    </TouchableOpacity>
                  </View>
                </View>
              );
            }}
            ListFooterComponent={
              <TouchableOpacity
                style={[styles.addButton, { backgroundColor: theme.tint }]}
                onPress={() => setModalVisible(true)}
              >
                <Ionicons name="add" size={20} color="white" />
                <ThemedText style={styles.addButtonText}>{t('trip.addExpense')}</ThemedText>
              </TouchableOpacity>
            }
          />
        )
      )}

      {/* Balances tab */}
      {activeTab === 'balances' && (
        balancesLoading ? (
          <ActivityIndicator size="large" color={theme.tint} style={styles.centered} />
        ) : balancesError ? (
          <ThemedText style={styles.emptyText}>{balancesError}</ThemedText>
        ) : (
          <ScrollView contentContainerStyle={styles.list}>

            {/* Per-user balances */}
            <ThemedText style={styles.sectionHeader}>{t('trip.balancePerMember')}</ThemedText>
            {(balancesInfo?.balances ?? []).length === 0 && (
              <ThemedText style={styles.emptyText}>{t('trip.noBalances')}</ThemedText>
            )}
            {(balancesInfo?.balances ?? []).map(b => (
              <View key={b.userId} style={[styles.balanceCard, { backgroundColor: theme.tabBackground }]}>
                <ThemedText style={styles.balanceName}>{usernameFor(b.userId)}</ThemedText>
                <ThemedText style={[styles.balanceAmount, { color: b.amount >= 0 ? '#4caf50' : Colors.warning }]}>
                  {b.amount >= 0 ? '+' : ''}{b.amount.toFixed(2)}€
                </ThemedText>
              </View>
            ))}

            {/* Settlement suggestions */}
            <ThemedText style={[styles.sectionHeader, { marginTop: 16 }]}>{t('trip.settlements')}</ThemedText>
            {(balancesInfo?.settlements ?? []).length === 0 && (
              <ThemedText style={styles.emptyText}>{t('trip.noSettlements')}</ThemedText>
            )}
            {(balancesInfo?.settlements ?? []).map((s, i) => (
              <View key={i} style={[styles.settlementCard, { backgroundColor: theme.tabBackground }]}>
                <ThemedText style={styles.settlementFrom}>{usernameFor(s.fromId)}</ThemedText>
                <Ionicons name="arrow-forward" size={16} color={theme.icon} />
                <ThemedText style={styles.settlementTo}>{usernameFor(s.toId)}</ThemedText>
                <ThemedText style={styles.settlementAmount}>{s.amount.toFixed(2)}€</ThemedText>
              </View>
            ))}

          </ScrollView>
        )
      )}

      {/* Expense detail modal */}
      <Modal visible={detailModalVisible} transparent animationType="fade" onRequestClose={() => setDetailModalVisible(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setDetailModalVisible(false)}>
          <TouchableOpacity activeOpacity={1} style={[styles.modalBox, { backgroundColor: theme.tabBackground }]}>
            <ThemedText style={styles.modalTitle}>{t('trip.expenseDetail')}</ThemedText>

            {detailLoading && <ActivityIndicator color={theme.tint} style={{ marginVertical: 20 }} />}
            {detailError && <ThemedText style={styles.errorText}>{detailError}</ThemedText>}

            {expenseDetail && !detailLoading && (
              <>
                <ThemedText style={styles.detailName}>{expenseDetail.name}</ThemedText>

                <View style={styles.detailRow}>
                  <ThemedText style={styles.detailLabel}>{t('trip.amount')}</ThemedText>
                  <ThemedText style={styles.detailValue}>{expenseDetail.amount?.toFixed(2)}€</ThemedText>
                </View>

                <View style={styles.detailRow}>
                  <ThemedText style={styles.detailLabel}>{t('trip.date')}</ThemedText>
                  <ThemedText style={styles.detailValue}>
                    {new Date(expenseDetail.datetime).toLocaleDateString()}
                  </ThemedText>
                </View>

                <View style={styles.detailRow}>
                  <ThemedText style={styles.detailLabel}>{t('trip.payer')}</ThemedText>
                  <ThemedText style={styles.detailValue}>{usernameFor(expenseDetail.payerId)}</ThemedText>
                </View>

                <ThemedText style={[styles.detailLabel, { marginTop: 12, marginBottom: 4 }]}>{t('trip.beneficiaries')}</ThemedText>
                {expenseDetail.beneficiaryIds.map(id => (
                  <ThemedText key={id} style={styles.detailBeneficiary}>· {usernameFor(id)}</ThemedText>
                ))}
              </>
            )}

            <TouchableOpacity
              style={[styles.closeButton, { backgroundColor: theme.tint }]}
              onPress={() => setDetailModalVisible(false)}
            >
              <ThemedText style={{ color: 'white', fontWeight: '600' }}>{t('common.close')}</ThemedText>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Create expense modal */}
      <Modal visible={modalVisible} transparent animationType="fade" onRequestClose={resetModal}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={resetModal}>
          <TouchableOpacity activeOpacity={1} style={[styles.modalBox, { backgroundColor: theme.tabBackground }]}>
            <ThemedText style={styles.modalTitle}>{t('trip.newExpense')}</ThemedText>

            <ThemedInput
              style={[styles.modalInput, { color: theme.text, borderColor: theme.tint }]}
              placeholder={t('trip.description')}
              placeholderTextColor={theme.icon}
              value={name}
              onChangeText={setName}
              autoFocus
            />

            <ThemedInput
              style={[styles.modalInput, { color: theme.text, borderColor: theme.tint }]}
              placeholder={t('trip.amount')}
              placeholderTextColor={theme.icon}
              value={amount}
              onChangeText={setAmount}
              keyboardType="numeric"
            />

            <TouchableOpacity
              style={[styles.dropdown, { borderColor: theme.tint }]}
              onPress={() => setPayerDropdownOpen(!payerDropdownOpen)}
            >
              <ThemedText>
                {payerId ? trip?.members?.find(m => m.id === payerId)?.username : t('trip.selectPayer')}
              </ThemedText>
              <Ionicons name={payerDropdownOpen ? 'chevron-up' : 'chevron-down'} size={16} color={theme.icon} />
            </TouchableOpacity>

            {payerDropdownOpen && (
              <View style={[styles.dropdownList, { backgroundColor: theme.tabBackground }]}>
                {trip?.members?.map(member => (
                  <TouchableOpacity
                    key={member.id}
                    style={styles.dropdownItem}
                    onPress={() => { setPayerId(member.id ?? ''); setPayerDropdownOpen(false); }}
                  >
                    <ThemedText>{member.username}</ThemedText>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            <ThemedText style={styles.sectionLabel}>{t('trip.beneficiaries')}</ThemedText>
            <View style={[styles.dropdownList, { backgroundColor: theme.tabBackground }]}>
              {trip?.members?.map(member => {
                const selected = beneficiaryIds.includes(member.id ?? '');
                return (
                  <TouchableOpacity
                    key={member.id}
                    style={styles.dropdownItem}
                    onPress={() => setBeneficiaryIds(prev =>
                      prev.includes(member.id ?? '')
                        ? prev.filter(id => id !== member.id)
                        : [...prev, member.id ?? '']
                    )}
                  >
                    <ThemedText>{member.username}</ThemedText>
                    <Ionicons
                      name={selected ? 'checkbox' : 'square-outline'}
                      size={20}
                      color={selected ? theme.tint : theme.icon}
                    />
                  </TouchableOpacity>
                );
              })}
            </View>

            {createError && <ThemedText style={styles.errorText}>{createError}</ThemedText>}

            <View style={styles.modalButtons}>
              <TouchableOpacity style={[styles.modalButton, styles.cancelButton]} onPress={resetModal}>
                <ThemedText>{t('common.cancel')}</ThemedText>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: theme.tint }]}
                onPress={handleCreate}
                disabled={creating}
              >
                {creating
                  ? <ActivityIndicator color="white" />
                  : <ThemedText style={{ color: 'white', fontWeight: '600' }}>{t('common.create')}</ThemedText>}
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
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
