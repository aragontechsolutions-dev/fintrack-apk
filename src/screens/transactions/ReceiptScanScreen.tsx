import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';

import { useAuth, useSession } from '../../auth/AuthContext';
import { Button, Card, ErrorText, Field, Subtle } from '../../components/ui';
import { Picker, PickerOption } from '../../components/Picker';
import {
  ItemDraft,
  LineItemsEditor,
  draftsSubtotalMinor,
} from '../../components/LineItemsEditor';
import { Account, Category } from '../../db/schema';
import { RATE_ONE } from '../../money/fx';
import { formatMoney, lineTotalMinor, parseQuantity, parseToMinor } from '../../money/money';
import {
  captureReceiptPhoto,
  pickReceiptPhoto,
  recognizeReceiptLines,
} from '../../ocr/recognize';
import { Confidence, parseReceipt } from '../../ocr/parseReceipt';
import { saveEncryptedImage } from '../../receipts/receiptStore';
import { todayISO } from '../../utils/date';
import { colors, font, spacing } from '../../theme/theme';

type Phase = 'capture' | 'processing' | 'review';

export function ReceiptScanScreen() {
  const navigation = useNavigation();
  const { session, repos } = useSession();
  const { runWithoutAutoLock } = useAuth();
  const base = session.baseCurrency;

  const [phase, setPhase] = useState<Phase>('capture');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [items, setItems] = useState<ItemDraft[]>([]);
  const [lowCount, setLowCount] = useState(0);
  const [total, setTotal] = useState('');
  const [payee, setPayee] = useState('');
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    repos.accounts.list().then((accs) => {
      setAccounts(accs);
      if (accs[0]) setAccountId(accs[0].id);
    });
    repos.categories.list('expense').then(setCategories);
  }, [repos]);

  const confidenceToDraft = (
    it: { description: string; quantity: number; unitPriceMinor: number; confidence: Confidence },
    idx: number,
  ): ItemDraft => ({
    key: `ocr-${idx}`,
    description: it.description,
    quantity: String(it.quantity),
    unitPrice: formatMoney(it.unitPriceMinor, base, { showSymbol: false }),
  });

  const runOcr = async (getUri: () => Promise<string | null>) => {
    setError(null);
    let uri: string | null;
    try {
      // The camera/gallery sends the app to background momentarily; suspend the
      // auto-lock so the session survives until the photo is picked.
      uri = await runWithoutAutoLock(getUri);
    } catch (e) {
      return setError(e instanceof Error ? e.message : 'No se pudo abrir la cámara.');
    }
    if (!uri) return;
    setImageUri(uri);
    setPhase('processing');
    try {
      const lines = await recognizeReceiptLines(uri);
      const parsed = parseReceipt(lines, base);
      setItems(parsed.items.map(confidenceToDraft));
      setLowCount(parsed.items.filter((i) => i.confidence === 'low').length);
      const totalMinor =
        parsed.detectedTotalMinor ??
        parsed.items.reduce((s, i) => s + i.lineTotalMinor, 0);
      setTotal(formatMoney(totalMinor, base, { showSymbol: false }));
      setPhase('review');
    } catch (e) {
      setError(
        e instanceof Error
          ? `Error de OCR: ${e.message}`
          : 'No se pudo leer el ticket.',
      );
      setPhase('capture');
    }
  };

  const buildItems = () => {
    const result: {
      description: string;
      quantity: number;
      unitPriceMinor: number;
      lineTotalMinor: number;
    }[] = [];
    for (const d of items) {
      if (d.description.trim() === '' && d.unitPrice.trim() === '') continue;
      if (d.description.trim() === '') {
        throw new Error('Cada ítem necesita una descripción.');
      }
      const qty = parseQuantity(d.quantity);
      const unit = parseToMinor(d.unitPrice, base);
      result.push({
        description: d.description.trim(),
        quantity: qty,
        unitPriceMinor: unit,
        lineTotalMinor: lineTotalMinor(qty, unit),
      });
    }
    return result;
  };

  const onConfirm = async () => {
    setError(null);
    if (!accountId) return setError('Elegí una cuenta.');
    let totalMinor: number;
    try {
      totalMinor = parseToMinor(total, base);
    } catch {
      return setError('Total inválido.');
    }
    if (totalMinor <= 0) return setError('El total debe ser mayor a 0.');

    let parsedItems;
    try {
      parsedItems = buildItems();
    } catch (e) {
      return setError(e instanceof Error ? e.message : 'Detalle inválido.');
    }

    setBusy(true);
    try {
      let receiptName: string | null = null;
      if (imageUri) {
        receiptName = await saveEncryptedImage(imageUri, session.dek);
      }
      const txnId = await repos.transactions.create({
        accountId,
        categoryId,
        type: 'expense',
        date: todayISO(),
        payee: payee.trim() || null,
        notes: null,
        amountMinor: totalMinor,
        currency: base,
        fxRateToBaseScaled: RATE_ONE,
        amountBaseMinor: totalMinor,
        source: 'ocr',
        receiptImagePath: receiptName,
      });
      await repos.transactions.replaceItems(txnId, parsedItems);
      navigation.goBack();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al guardar.');
      setBusy(false);
    }
  };

  if (phase === 'processing') {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.processing}>Leyendo el ticket…</Text>
      </View>
    );
  }

  if (phase === 'capture') {
    return (
      <ScrollView contentContainerStyle={{ padding: spacing.lg }}>
        <Subtle>
          Sacá una foto del ticket o elegí una de la galería. El texto se procesa
          en el dispositivo (offline). Después vas a poder revisar y corregir cada
          línea antes de guardar.
        </Subtle>
        <View style={{ height: spacing.lg }} />
        <Button title="📷 Tomar foto del ticket" onPress={() => runOcr(captureReceiptPhoto)} />
        <Button
          title="Elegir de la galería"
          variant="secondary"
          onPress={() => runOcr(pickReceiptPhoto)}
          style={{ marginTop: spacing.md }}
        />
        <ErrorText>{error}</ErrorText>
      </ScrollView>
    );
  }

  // review
  const subtotal = draftsSubtotalMinor(items, base);
  let totalMinorNow: number | null = null;
  try {
    totalMinorNow = parseToMinor(total, base);
  } catch {
    totalMinorNow = null;
  }
  const diff = totalMinorNow != null ? subtotal - totalMinorNow : null;

  const accountOptions: PickerOption[] = accounts.map((a) => ({
    value: a.id,
    label: a.name,
    sublabel: a.currency,
  }));
  const categoryOptions: PickerOption[] = categories.map((c) => ({
    value: c.id,
    label: c.name,
  }));

  return (
    <ScrollView contentContainerStyle={{ padding: spacing.lg }}>
      <Card>
        <Text style={styles.reviewTitle}>Revisá el detalle</Text>
        <Subtle>
          El OCR no es perfecto (papel térmico, foto). Corregí lo que haga falta
          antes de guardar.
        </Subtle>
        {imageUri ? (
          <Image source={{ uri: imageUri }} style={styles.thumb} resizeMode="contain" />
        ) : null}
        {lowCount > 0 ? (
          <Text style={styles.warn}>
            ⚠️ {lowCount} línea(s) de baja confianza — revisalas con cuidado.
          </Text>
        ) : null}
      </Card>

      <Card>
        <LineItemsEditor items={items} currency={base} onChange={setItems} />
      </Card>

      <Field
        label={`Total del ticket (${base})`}
        value={total}
        onChangeText={setTotal}
        keyboardType="numeric"
        placeholder="0,00"
      />
      {diff !== null && diff !== 0 ? (
        <Text style={styles.diff}>
          El detalle suma {formatMoney(subtotal, base)} ({diff > 0 ? '+' : ''}
          {formatMoney(diff, base)} vs. total).
        </Text>
      ) : null}

      <Field label="Comercio" value={payee} onChangeText={setPayee} placeholder="Ej: Ta-Ta" />
      <Picker label="Cuenta" placeholder="Elegí una cuenta" value={accountId} options={accountOptions} onChange={setAccountId} />
      <Picker label="Categoría" placeholder="Sin categoría" value={categoryId} options={categoryOptions} onChange={setCategoryId} />

      <ErrorText>{error}</ErrorText>
      <Button title="Guardar movimiento" onPress={onConfirm} loading={busy} />
      <Button
        title="Descartar y volver a escanear"
        variant="secondary"
        onPress={() => {
          setPhase('capture');
          setItems([]);
          setImageUri(null);
        }}
        style={{ marginTop: spacing.sm }}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  processing: { marginTop: spacing.md, color: colors.textMuted, fontSize: font.md },
  reviewTitle: { fontSize: font.lg, fontWeight: '700', color: colors.text, marginBottom: spacing.xs },
  thumb: {
    width: '100%',
    height: 180,
    marginTop: spacing.md,
    borderRadius: 8,
    backgroundColor: colors.background,
  },
  warn: { color: colors.warning, fontSize: font.sm, marginTop: spacing.md },
  diff: { color: colors.warning, fontSize: font.sm, marginBottom: spacing.md },
});
