/**
 * Attribution line shown across the app:
 * "Desarrollado y mantenido por ATS · Aragon Tech Solutions".
 */

import React from 'react';
import { StyleSheet, Text, View, ViewStyle } from 'react-native';

import { colors, font, spacing } from '../theme/theme';

export function AtsCredit({ style }: { style?: ViewStyle }) {
  return (
    <View style={[styles.container, style]}>
      <Text style={styles.text}>Desarrollado y mantenido por</Text>
      <Text style={styles.brand}>ATS · Aragon Tech Solutions</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
  },
  text: {
    fontSize: font.sm,
    color: colors.textMuted,
  },
  brand: {
    fontSize: font.sm,
    color: colors.primary,
    fontWeight: '700',
    marginTop: 2,
  },
});
