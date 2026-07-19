import React, { useEffect, useState } from 'react';
import { ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { useSession } from '../../auth/AuthContext';
import { Button, ErrorText, Field } from '../../components/ui';
import { CurrencyPicker } from '../../components/CurrencyPicker';
import { Segmented } from '../../components/Segmented';
import { CurrencyCode } from '../../money/currency';
import { formatMoney, parseToMinor } from '../../money/money';
import { AccountType } from '../../data/types';
import { MainStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<MainStackParamList, 'AccountForm'>;

export function AccountFormScreen({ route }: Props) {
  const navigation = useNavigation();
  const { repos } = useSession();
  const editingId = route.params?.accountId;

  const [name, setName] = useState('');
  const [type, setType] = useState<AccountType>('cash');
  const [currency, setCurrency] = useState<CurrencyCode>('UYU');
  const [opening, setOpening] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!editingId) return;
    repos.accounts.get(editingId).then((acc) => {
      if (!acc) return;
      setName(acc.name);
      setType(acc.type as AccountType);
      setCurrency(acc.currency as CurrencyCode);
      setOpening(
        formatMoney(acc.openingBalanceMinor, acc.currency as CurrencyCode, {
          showSymbol: false,
        }),
      );
    });
  }, [editingId, repos]);

  const onSubmit = async () => {
    setError(null);
    if (name.trim().length < 1) return setError('Ingresá un nombre.');
    let openingMinor = 0;
    if (opening.trim() !== '') {
      try {
        openingMinor = parseToMinor(opening, currency);
      } catch {
        return setError('Saldo inicial inválido.');
      }
    }
    setBusy(true);
    try {
      if (editingId) {
        await repos.accounts.update(editingId, {
          name: name.trim(),
          type,
          currency,
          openingBalanceMinor: openingMinor,
        });
      } else {
        await repos.accounts.create({
          name: name.trim(),
          type,
          currency,
          openingBalanceMinor: openingMinor,
        });
      }
      navigation.goBack();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al guardar.');
      setBusy(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={{ padding: 16 }}>
      <Field
        label="Nombre de la cuenta"
        value={name}
        onChangeText={setName}
        placeholder="Ej: Efectivo, BROU, Visa"
      />
      <Segmented<AccountType>
        value={type}
        onChange={setType}
        options={[
          { value: 'cash', label: 'Efectivo' },
          { value: 'bank', label: 'Banco' },
          { value: 'card', label: 'Tarjeta' },
        ]}
      />
      <CurrencyPicker label="Moneda" value={currency} onChange={setCurrency} />
      <Field
        label="Saldo inicial (opcional)"
        value={opening}
        onChangeText={setOpening}
        keyboardType="numeric"
        placeholder="0,00"
      />
      <ErrorText>{error}</ErrorText>
      <Button
        title={editingId ? 'Guardar cambios' : 'Crear cuenta'}
        onPress={onSubmit}
        loading={busy}
      />
    </ScrollView>
  );
}
