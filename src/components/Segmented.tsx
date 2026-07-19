import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, font, radius, spacing } from '../theme/theme';

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
  color?: string;
}

interface Props<T extends string> {
  value: T;
  options: SegmentOption<T>[];
  onChange: (value: T) => void;
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
}: Props<T>) {
  return (
    <View style={styles.container}>
      {options.map((opt) => {
        const active = opt.value === value;
        const activeColor = opt.color ?? colors.primary;
        return (
          <Pressable
            key={opt.value}
            style={[
              styles.segment,
              active && { backgroundColor: activeColor },
            ]}
            onPress={() => onChange(opt.value)}
          >
            <Text style={[styles.text, active && styles.textActive]}>
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    marginBottom: spacing.md,
  },
  segment: {
    flex: 1,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  text: { fontSize: font.md, fontWeight: '600', color: colors.textMuted },
  textActive: { color: colors.textInverse },
});
