import React, { useEffect, useState } from 'react';
import { ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';

import { useSession } from '../../auth/AuthContext';
import { Button, ErrorText, Field, Subtle } from '../../components/ui';
import { Picker, PickerOption } from '../../components/Picker';
import { Account } from '../../db/schema';
import { CurrencyCode } from '../../money/currency';
import { parseToMinor } from '../../money/money';
import { RATE_ONE } from '../../money/fx';
import { todayISO } from '../../utils/date';

export function AddTransferScreen() {
  const navigation = useNavigation();
  const { session, repos } = useSession();
  const base = session.baseCurrency;

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [fromId, setFromId] = useState<string | null>(null);
  const [toId, setToId] = useState<string | null>(null);
  const [amount, setAmount] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    repos.accounts.list().then((accs) => {
      setAccounts(accs);
      if (accs[0]) setFromId(accs[0].id);
      if (accs[1]) setToId(accs[1].id);
    });
  }, [repos]);

  const options: PickerOption[] = accounts.map((a) => ({
    value: a.id,
    label: a.name,
    sublabel: a.currency,
  }));

  const onSubmit = async () => {
    setError(null);
    if (!fromId || !toId) return setError('Elegí ambas cuentas.');
    if (fromId === toId) return setError('Las cuentas deben ser distintas.');

    const from = accounts.find((a) => a.id === fromId)!;
    const to = accounts.find((a) => a.id === toId)!;
    if (from.currency !== to.currency) {
      return setError(
        'Por ahora solo se admiten transferencias entre cuentas de la misma moneda.',
      );
    }
    let amountMinor: number;
    try {
      amountMinor = parseToMinor(amount, from.currency as CurrencyCode);
    } catch {
      return setError('Monto inválido.');
    }
    if (amountMinor <= 0) return setError('El monto debe ser mayor a 0.');

    setBusy(true);
    try {
      await repos.transactions.createTransfer({
        fromAccountId: fromId,
        toAccountId: toId,
        date: todayISO(),
        amountMinor,
        currency: from.currency,
        // Transfers do not affect income/expense; base equiv kept for record.
        fxRateToBaseScaled: from.currency === base ? RATE_ONE : RATE_ONE,
        amountBaseMinor: from.currency === base ? amountMinor : amountMinor,
        notes: `Transferencia ${from.name} → ${to.name}`,
      });
      navigation.goBack();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al transferir.');
      setBusy(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={{ padding: 16 }}>
      <Subtle>
        Una transferencia mueve dinero entre tus cuentas. No cuenta como ingreso
        ni gasto.
      </Subtle>
      <Picker
        label="Desde"
        value={fromId}
        options={options}
        onChange={setFromId}
      />
      <Picker label="Hacia" value={toId} options={options} onChange={setToId} />
      <Field
        label="Monto"
        value={amount}
        onChangeText={setAmount}
        keyboardType="numeric"
        placeholder="0,00"
      />
      <ErrorText>{error}</ErrorText>
      <Button title="Transferir" onPress={onSubmit} loading={busy} />
    </ScrollView>
  );
}
