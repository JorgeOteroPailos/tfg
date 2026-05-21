import React, { useEffect, useState } from 'react';
import { StyleSheet, View, FlatList, ActivityIndicator, TouchableOpacity, Modal } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useNavigation } from 'expo-router';
import { useAppTheme } from '../../../src/theme';
import { Colors } from '../../../constants/Colors';
import { useExpenses, type ExpenseSummary } from '../../../src/expenses';
import { useTrip } from '../../../src/trips';
import { Ionicons } from '@expo/vector-icons';
import ThemedText from '../../../components/ThemedText';
import ThemedInput from '../../../components/ThemedInput';

const ExpensesScreen = () => {
  const { t } = useTranslation();
  const { themeName } = useAppTheme();
  const theme = Colors[themeName] ?? Colors.light;
  const { trip } = useTrip();
  const { getExpenses, addExpense } = useExpenses();
  const navigation = useNavigation();

  const [expenses, setExpenses] = useState<ExpenseSummary[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [description, setDescription] = useState('');
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

  const handleCreate = async () => {
    if (!trip?.id) return;
    const amountValue = Number(amount);
    if (!description.trim() || !amountValue || !payerId || beneficiaryIds.length === 0) {
      setCreateError(t('trip.fillAllRequiredFields'));
      return;
    }
    setCreating(true);
    setCreateError(null);
    try {
      const newExpense = await addExpense(trip.id, {
        description: description.trim(),
        amount: amountValue,
        payerId,
        beneficiaryIds,
      });
      setExpenses(prev => prev ? [newExpense, ...prev] : [newExpense]);
      setModalVisible(false);
      setDescription(''); setAmount(''); setPayerId(''); setBeneficiaryIds([]);
    } catch {
      setCreateError(t('trip.createExpenseError'));
    } finally {
      setCreating(false);
    }
  };

  const resetModal = () => {
    setModalVisible(false);
    setCreateError(null);
    setDescription(''); setAmount(''); setPayerId(''); setBeneficiaryIds([]);
    setPayerDropdownOpen(false);
  };

  return (
    <View style={styles.container}>
      {loading ? (
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
                <ThemedText style={styles.expenseAmount}>{item.amount?.toFixed(2)}€</ThemedText>
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
      )}

      <Modal visible={modalVisible} transparent animationType="fade" onRequestClose={resetModal}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={resetModal}>
          <TouchableOpacity activeOpacity={1} style={[styles.modalBox, { backgroundColor: theme.tabBackground }]}>
            <ThemedText style={styles.modalTitle}>{t('trip.newExpense')}</ThemedText>

            <ThemedInput
              style={[styles.modalInput, { color: theme.text, borderColor: theme.tint }]}
              placeholder={t('trip.description')}
              placeholderTextColor={theme.icon}
              value={description}
              onChangeText={setDescription}
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
  list: { padding: 16, gap: 10 },
  emptyText: { textAlign: 'center', marginTop: 40, fontSize: 15 },
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
});