import React, { useEffect, useState } from 'react';
import { StyleSheet, View, ActivityIndicator, Pressable, Modal } from 'react-native';
import { useTranslation } from 'react-i18next';
import ThemedText from './ThemedText';
import ThemedInput from './ThemedInput';
import { useAppTheme } from '../src/theme';
import { Colors } from '../constants/Colors';
import { useExpenses, type ExpenseSummary } from '../src/expenses';
import { useTrip } from '../src/trips';

type TripExpensesProps = {
  tripId?: string;
};

const TripExpenses = ({ tripId }: TripExpensesProps) => {
  const { t } = useTranslation();
  const { themeName } = useAppTheme();
  const theme = Colors[themeName] ?? Colors.light;
  const { getExpenses, addExpense } = useExpenses();
  const [expenses, setExpenses] = useState<ExpenseSummary[] | null>(null);
  const loadingExpenses = Boolean(tripId) && expenses === null && expensesError === null;
  const [expensesError, setExpensesError] = useState<string | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [creatingExpense, setCreatingExpense] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [payerId, setPayerId] = useState('');
  const [beneficiaryIds, setBeneficiaryIds] = useState<string[]>([]);
  const [payerDropdownOpen, setPayerDropdownOpen] = useState(false);

  useEffect(() => {
    if (!tripId || expenses !== null) return;

    const loadExpenses = async () => {
      setExpensesError(null);

      try {
        const data = await getExpenses(tripId);
        setExpenses(data);
      } catch (error) {
        console.error('Error loading expenses:', error);
        setExpensesError(t('trip.unableLoadExpenses', 'Unable to load expenses'));
      }
    };

    loadExpenses();
  }, [tripId, expenses, getExpenses, t]);

  const handleCreateExpense = async () => {
    if (!tripId) return;

    const amountValue = Number(amount);
    const beneficiaries = beneficiaryIds
      .filter(Boolean);

    if (!description.trim() || !amountValue || !payerId.trim() || beneficiaries.length === 0) {
      setCreateError(t('trip.fillAllRequiredFields', 'Please fill all required fields'));
      return;
    }

    setCreatingExpense(true);
    setCreateError(null);

    const newExpenseData: any = {
      description: description.trim(),
      amount: amountValue,
      payerId: payerId.trim(),
      beneficiaryIds: beneficiaries,
    };

    try {
      const newExpense = await addExpense(tripId, newExpenseData);

      setExpenses(current => current ? [newExpense, ...current] : [newExpense]);
      setModalVisible(false);
      setDescription('');
      setAmount('');
      setPayerId('');
      setBeneficiaryIds([]);
    } catch (error) {
      console.error('Error creating expense:', error);
      setCreateError(t('trip.createExpenseError', 'Unable to create expense'));
    } finally {
      setCreatingExpense(false);
    }
  };

  const { trip } = useTrip();

  return (
    <View style={styles.expensesContainer}>
      <Pressable
        style={[styles.addButton, { backgroundColor: theme.tabBackground }]}
        onPress={() => setModalVisible(true)}
      >
        <ThemedText style={styles.addButtonText}>
          + {t('trip.addExpense', 'Add expense')}
        </ThemedText>
      </Pressable>

      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setModalVisible(false)}
        >
          <Pressable onPress={() => {}} style={[styles.modalBox, { backgroundColor: theme.tabBackground }]}>
            <ThemedText style={styles.modalTitle}>{t('trip.newExpense', 'New expense')}</ThemedText>

            <ThemedInput
              style={[styles.modalInput, { color: theme.text, borderColor: theme.tint }]}
              placeholder={t('trip.description', 'Description')}
              placeholderTextColor={theme.icon}
              value={description}
              onChangeText={setDescription}
              autoFocus
            />

            <ThemedInput
              style={[styles.modalInput, { color: theme.text, borderColor: theme.tint }]}
              placeholder={t('trip.amount', 'Amount')}
              placeholderTextColor={theme.icon}
              value={amount}
              onChangeText={setAmount}
              keyboardType="numeric"
            />

            <Pressable
              style={[styles.modalInput, styles.dropdown, { borderColor: theme.tint }]}
              onPress={() => setPayerDropdownOpen(!payerDropdownOpen)}
              >
              <ThemedText>
                  {payerId 
                  ? trip?.members?.find(m => m.id === payerId)?.username 
                  : t('trip.selectPayer')}
              </ThemedText>
              </Pressable>

              {payerDropdownOpen && (
              <View style={[styles.dropdownList, { backgroundColor: theme.tabBackground }]}>
                  {trip?.members?.map(member => (
                  <Pressable
                      key={member.id}
                      style={styles.dropdownItem}
                      onPress={() => {
                      setPayerId(member.id ?? '');
                      setPayerDropdownOpen(false);
                      }}
                  >
                      <ThemedText>{member.username}</ThemedText>
                  </Pressable>
                  ))}
              </View>
              )}

            <View style={[styles.dropdownList, { backgroundColor: theme.tabBackground }]}>
              {trip?.members?.map(member => {
                const isSelected = beneficiaryIds.includes(member.id ?? '');
                return (
                  <Pressable
                    key={member.id}
                    style={styles.dropdownItem}
                    onPress={() => {
                      setBeneficiaryIds(current => {
                        if (current.includes(member.id ?? '')) {
                          return current.filter(id => id !== member.id);
                        }
                        return [...current, member.id ?? ''];
                      });
                    }}
                  >
                    <ThemedText>{member.username}</ThemedText>
                    <ThemedText>{isSelected ? '☑️' : '⬜️'}</ThemedText>
                  </Pressable>
                );
              })}
            </View>

            {createError ? <ThemedText style={styles.errorText}>{createError}</ThemedText> : null}

            <View style={styles.modalButtons}>
              <Pressable
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => {
                  setModalVisible(false);
                  setCreateError(null);
                }}
              >
                <ThemedText>{t('common.cancel', 'Cancel')}</ThemedText>
              </Pressable>

              <Pressable
                style={[styles.modalButton, { backgroundColor: theme.tint }]}
                onPress={handleCreateExpense}
                disabled={creatingExpense}
              >
                {creatingExpense
                  ? <ActivityIndicator color="white" />
                  : <ThemedText style={{ color: 'white', fontWeight: '600' }}>{t('common.create', 'Create')}</ThemedText>
                }
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {loadingExpenses ? (
        <ActivityIndicator size="large" color={theme.tint} />
      ) : expensesError ? (
        <ThemedText style={styles.emptyText}>{expensesError}</ThemedText>
      ) : expenses && expenses.length > 0 ? (
        expenses.map((expense, index) => (
          <ThemedText key={expense.id ?? `expense-${index}`} style={styles.expenseItem}>
            {expense.name ?? t('trip.noName', 'No name')} — {expense.amount?.toFixed(2) ?? '0.00'}
          </ThemedText>
        ))
      ) : (
        <ThemedText style={styles.emptyText}>
          {t('trip.noExpenses', 'No expenses yet')}
        </ThemedText>
      )}
    </View>
  );
};

export default TripExpenses;

const styles = StyleSheet.create({
  expensesContainer: {
    width: '100%',
    paddingHorizontal: 8,
  },
  addButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 16,
  },
  addButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalBox: {
    width: '100%',
    maxWidth: 450,
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 10,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 16,
  },
  modalInput: {
    marginBottom: 12,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
    marginTop: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  cancelButton: {
    borderWidth: 1,
    borderColor: '#ccc',
  },
  errorText: {
    color: '#d9534f',
    marginBottom: 8,
    textAlign: 'center',
    fontWeight: '600',
  },
  emptyText: {
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 16,
  },
  expenseItem: {
    fontSize: 15,
    marginBottom: 8,
  },
  dropdown: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderWidth: 1.5,
    borderRadius: 8,
    marginBottom: 12,
    justifyContent: 'center',
  },
  dropdownList: {
    borderRadius: 8,
    marginBottom: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#ccc',
  },
  dropdownItem: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
});
