import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { CURRENCY_LIST, CurrencyCode } from '../money/currency';
import { colors, font, radius, spacing } from '../theme/theme';

interface Props {
  label?: string;
  value: CurrencyCode;
  onChange: (c: CurrencyCode) => void;
}

export function CurrencyPicker({ label, value, onChange }: Props) {
  return (
    <View style={{ marginBottom: spacing.md }}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View style={styles.row}>
        {CURRENCY_LIST.map((c) => {
          const active = c.code === value;
          return (
            <Pressable
              key={c.code}
              onPress={() => onChange(c.code)}
              style={[styles.pill, active && styles.pillActive]}
            >
              <Text style={[styles.pillText, active && styles.pillTextActive]}>
                {c.code} · {c.symbol}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    fontSize: font.sm,
    color: colors.textMuted,
    marginBottom: spacing.xs,
  },
  row: { flexDirection: 'row', gap: spacing.sm },
  pill: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  pillActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  pillText: { color: colors.text, fontSize: font.md, fontWeight: '600' },
  pillTextActive: { color: colors.textInverse },
});
