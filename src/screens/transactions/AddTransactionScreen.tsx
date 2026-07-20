import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { useSession } from '../../auth/AuthContext';
import { Button, ErrorText, Field } from '../../components/ui';
import { CurrencyPicker } from '../../components/CurrencyPicker';
import { Picker, PickerOption } from '../../components/Picker';
import { Segmented } from '../../components/Segmented';
import {
  ItemDraft,
  LineItemsEditor,
  draftsSubtotalMinor,
  emptyDraft,
} from '../../components/LineItemsEditor';
import { Account, Category } from '../../db/schema';
import { CurrencyCode } from '../../money/currency';
import {
  formatMoney,
  lineTotalMinor,
  parseQuantity,
  parseToMinor,
} from '../../money/money';
import { RATE_ONE, RATE_SCALE, formatRate, parseRate } from '../../money/fx';
import { convertMinor } from '../../money/money';
import { todayISO } from '../../utils/date';
import { colors, font, spacing } from '../../theme/theme';
import { MainStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<MainStackParamList, 'AddTransaction'>;
type EntryType = 'income' | 'expense';

export function AddTransactionScreen({ route }: Props) {
  const navigation = useNavigation<Props['navigation']>();
  const { session, repos } = useSession();
  const editingId = route.params?.transactionId;
  const base = session.baseCurrency;

  const [type, setType] = useState<EntryType>('expense');
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState<CurrencyCode>(base);
  const [rate, setRate] = useState('');
  const [date] = useState(todayISO());
  const [payee, setPayee] = useState('');
  const [notes, setNotes] = useState('');
  const [detail, setDetail] = useState(false);
  const [items, setItems] = useState<ItemDraft[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Load accounts + categories for the current type.
  const loadRefs = useCallback(async () => {
    const accs = await repos.accounts.list();
    setAccounts(accs);
    if (!accountId && accs.length > 0) {
      setAccountId(accs[0].id);
      setCurrency(accs[0].currency as CurrencyCode);
    }
  }, [repos, accountId]);

  useEffect(() => {
    loadRefs();
  }, [loadRefs]);

  useEffect(() => {
    repos.categories.list(type).then(setCategories);
  }, [repos, type]);

  // Load existing transaction when editing.
  useEffect(() => {
    if (!editingId) return;
    repos.transactions.get(editingId).then((t) => {
      if (!t) return;
      if (t.type === 'income' || t.type === 'expense') setType(t.type);
      setAccountId(t.accountId);
      setCategoryId(t.categoryId);
      setCurrency(t.currency as CurrencyCode);
      setAmount(formatMoney(t.amountMinor, t.currency as CurrencyCode, { showSymbol: false }));
      setPayee(t.payee ?? '');
      setNotes(t.notes ?? '');
      if (t.currency !== base) setRate(formatRate(t.fxRateToBaseScaled));
      if (t.hasLineItems) {
        repos.transactions.listItems(editingId).then((rows) => {
          if (rows.length === 0) return;
          setDetail(true);
          setItems(
            rows.map((r) => ({
              key: r.id,
              description: r.description,
              quantity: String(r.quantity),
              unitPrice: formatMoney(r.unitPriceMinor, t.currency as CurrencyCode, {
                showSymbol: false,
              }),
            })),
          );
        });
      }
    });
  }, [editingId, repos, base]);

  // Prefill FX rate from last known when currency differs from base.
  useEffect(() => {
    if (currency === base) {
      setRate('');
      return;
    }
    repos.rates.latest(currency, base).then((r) => {
      if (r) setRate(formatRate(r));
    });
  }, [currency, base, repos]);

  const accountOptions: PickerOption[] = accounts.map((a) => ({
    value: a.id,
    label: a.name,
    sublabel: `${a.type} · ${a.currency}`,
  }));
  const categoryOptions: PickerOption[] = categories.map((c) => ({
    value: c.id,
    label: c.name,
  }));

  const computeBase = (): { amountMinor: number; rateScaled: number; baseMinor: number } => {
    const amountMinor = parseToMinor(amount, currency);
    if (currency === base) {
      return { amountMinor, rateScaled: RATE_ONE, baseMinor: amountMinor };
    }
    const rateScaled = parseRate(rate);
    const baseMinor = convertMinor(amountMinor, rateScaled, RATE_SCALE);
    return { amountMinor, rateScaled, baseMinor };
  };

  /** Parse the detail rows, validating each non-empty row. Throws on error. */
  const buildItems = () => {
    const result: {
      description: string;
      quantity: number;
      unitPriceMinor: number;
      lineTotalMinor: number;
    }[] = [];
    for (const d of items) {
      const empty = d.description.trim() === '' && d.unitPrice.trim() === '';
      if (empty) continue;
      if (d.description.trim() === '') {
        throw new Error('Cada ítem del detalle necesita una descripción.');
      }
      const qty = parseQuantity(d.quantity);
      const unit = parseToMinor(d.unitPrice, currency);
      result.push({
        description: d.description.trim(),
        quantity: qty,
        unitPriceMinor: unit,
        lineTotalMinor: lineTotalMinor(qty, unit),
      });
    }
    return result;
  };

  const onSubmit = async () => {
    setError(null);
    if (!accountId) return setError('Elegí una cuenta.');
    let calc;
    try {
      calc = computeBase();
    } catch (e) {
      return setError(e instanceof Error ? e.message : 'Monto o tasa inválidos.');
    }
    if (calc.amountMinor <= 0) return setError('El monto debe ser mayor a 0.');

    let parsedItems: ReturnType<typeof buildItems> = [];
    if (detail) {
      try {
        parsedItems = buildItems();
      } catch (e) {
        return setError(e instanceof Error ? e.message : 'Detalle inválido.');
      }
    }

    setBusy(true);
    try {
      if (currency !== base) {
        await repos.rates.save(currency, base, calc.rateScaled, date, 'manual');
      }
      const payload = {
        accountId,
        categoryId,
        type,
        date,
        payee: payee.trim() || null,
        notes: notes.trim() || null,
        amountMinor: calc.amountMinor,
        currency,
        fxRateToBaseScaled: calc.rateScaled,
        amountBaseMinor: calc.baseMinor,
        source: 'manual' as const,
      };
      let txnId = editingId;
      if (editingId) {
        await repos.transactions.update(editingId, payload);
      } else {
        txnId = await repos.transactions.create(payload);
      }
      // Persist line items (or clear them when the detail is turned off).
      if (txnId) {
        await repos.transactions.replaceItems(txnId, detail ? parsedItems : []);
      }
      navigation.goBack();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al guardar.');
      setBusy(false);
    }
  };

  const onDelete = () => {
    if (!editingId) return;
    Alert.alert('Eliminar movimiento', '¿Seguro que querés eliminarlo?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          await repos.transactions.remove(editingId);
          navigation.goBack();
        },
      },
    ]);
  };

  const showBaseHint = currency !== base && amount.trim() !== '' && rate.trim() !== '';
  let baseHint = '';
  if (showBaseHint) {
    try {
      const c = computeBase();
      baseHint = `≈ ${formatMoney(c.baseMinor, base, { showCode: true })}`;
    } catch {
      baseHint = '';
    }
  }

  // Subtotal of the detail vs the entered total (for validation hint).
  const subtotalMinor = detail ? draftsSubtotalMinor(items, currency) : 0;
  let diff: number | null = null;
  if (detail && amount.trim() !== '') {
    try {
      diff = subtotalMinor - parseToMinor(amount, currency);
    } catch {
      diff = null;
    }
  }

  return (
    <ScrollView contentContainerStyle={{ padding: 16 }}>
      <Segmented<EntryType>
        value={type}
        onChange={(t) => {
          setType(t);
          setCategoryId(null);
        }}
        options={[
          { value: 'expense', label: 'Gasto', color: colors.expense },
          { value: 'income', label: 'Ingreso', color: colors.income },
        ]}
      />

      <Field
        label="Monto"
        value={amount}
        onChangeText={setAmount}
        keyboardType="numeric"
        placeholder="0,00"
      />
      <CurrencyPicker
        label="Moneda"
        value={currency}
        onChange={setCurrency}
      />
      {currency !== base ? (
        <Field
          label={`Tasa de cambio (1 ${currency} = ? ${base})`}
          value={rate}
          onChangeText={setRate}
          keyboardType="numeric"
          placeholder="Ej: 40,50"
          error={baseHint ? null : undefined}
        />
      ) : null}
      {baseHint ? <ErrorText>{baseHint}</ErrorText> : null}

      <Picker
        label="Cuenta"
        placeholder="Elegí una cuenta"
        value={accountId}
        options={accountOptions}
        onChange={(id) => {
          setAccountId(id);
          const acc = accounts.find((a) => a.id === id);
          if (acc) setCurrency(acc.currency as CurrencyCode);
        }}
      />
      <Picker
        label="Categoría"
        placeholder="Sin categoría"
        value={categoryId}
        options={categoryOptions}
        onChange={setCategoryId}
      />
      <Field label="Comercio / descripción" value={payee} onChangeText={setPayee} placeholder="Ej: Ta-Ta, Antel" />
      <Field label="Notas" value={notes} onChangeText={setNotes} placeholder="Opcional" />

      <View style={styles.detailToggle}>
        <View style={{ flex: 1 }}>
          <Text style={styles.detailTitle}>Detalle de productos</Text>
          <Text style={styles.detailSub}>Cargá los ítems de la compra.</Text>
        </View>
        <Switch
          value={detail}
          onValueChange={(v) => {
            setDetail(v);
            if (v && items.length === 0) setItems([emptyDraft()]);
          }}
        />
      </View>

      {detail ? (
        <View style={styles.detailBox}>
          <LineItemsEditor items={items} currency={currency} onChange={setItems} />
          {diff !== null && diff !== 0 ? (
            <View>
              <Text style={styles.diffText}>
                El detalle {diff > 0 ? 'supera' : 'queda por debajo de'} el total en{' '}
                {formatMoney(Math.abs(diff), currency)} (impuestos/descuento/ajuste).
              </Text>
              <Pressable onPress={() => setAmount(formatMoney(subtotalMinor, currency, { showSymbol: false }))}>
                <Text style={styles.useSubtotal}>Usar suma del detalle como total</Text>
              </Pressable>
            </View>
          ) : null}
          {diff === 0 && subtotalMinor > 0 ? (
            <Text style={styles.okText}>El detalle cuadra con el total ✓</Text>
          ) : null}
        </View>
      ) : null}

      <ErrorText>{error}</ErrorText>
      <Button
        title={editingId ? 'Guardar cambios' : 'Guardar movimiento'}
        onPress={onSubmit}
        loading={busy}
      />
      {editingId ? (
        <Button
          title="Eliminar"
          variant="danger"
          onPress={onDelete}
          style={{ marginTop: 8 }}
        />
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  detailToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: spacing.sm,
  },
  detailTitle: { fontSize: font.md, fontWeight: '600', color: colors.text },
  detailSub: { fontSize: font.sm, color: colors.textMuted },
  detailBox: { marginBottom: spacing.md },
  diffText: { fontSize: font.sm, color: colors.warning, marginTop: spacing.sm },
  okText: { fontSize: font.sm, color: colors.income, marginTop: spacing.sm },
  useSubtotal: {
    fontSize: font.sm,
    color: colors.primary,
    fontWeight: '600',
    marginTop: spacing.xs,
  },
});
