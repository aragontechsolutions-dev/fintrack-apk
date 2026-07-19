import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Transaction } from '../db/schema';
import { CurrencyCode } from '../money/currency';
import { formatMoney } from '../money/money';
import { TransactionType, balanceSign } from '../data/types';
import { formatDisplayDate } from '../utils/date';
import { colors, font, radius, spacing } from '../theme/theme';

const TYPE_META: Record<TransactionType, { color: string; symbol: string }> = {
  income: { color: colors.income, symbol: '+' },
  expense: { color: colors.expense, symbol: '−' },
  transfer_in: { color: colors.transfer, symbol: '+' },
  transfer_out: { color: colors.transfer, symbol: '−' },
};

interface Props {
  txn: Transaction;
  subtitle?: string;
  onPress?: () => void;
}

export function TransactionRow({ txn, subtitle, onPress }: Props) {
  const type = txn.type as TransactionType;
  const meta = TYPE_META[type];
  const sign = balanceSign(type);

  return (
    <Pressable style={styles.row} onPress={onPress}>
      <View style={{ flex: 1 }}>
        <Text style={styles.title} numberOfLines={1}>
          {txn.payee || subtitle || (type.startsWith('transfer') ? 'Transferencia' : 'Movimiento')}
        </Text>
        <Text style={styles.sub}>
          {formatDisplayDate(txn.date)}
          {subtitle && txn.payee ? ` · ${subtitle}` : ''}
        </Text>
      </View>
      <Text style={[styles.amount, { color: meta.color }]}>
        {meta.symbol}
        {formatMoney(txn.amountMinor, txn.currency as CurrencyCode, {
          showCode: true,
        })}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
    gap: spacing.md,
  },
  title: { fontSize: font.md, fontWeight: '600', color: colors.text },
  sub: { fontSize: font.sm, color: colors.textMuted, marginTop: 2 },
  amount: { fontSize: font.md, fontWeight: '700' },
});
