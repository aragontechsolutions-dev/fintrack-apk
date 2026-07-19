import React, { useState } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { colors, font, radius, spacing } from '../theme/theme';

export interface PickerOption {
  value: string;
  label: string;
  sublabel?: string;
}

interface Props {
  label: string;
  placeholder?: string;
  value: string | null;
  options: PickerOption[];
  onChange: (value: string) => void;
}

export function Picker({ label, placeholder, value, options, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);

  return (
    <View style={{ marginBottom: spacing.md }}>
      <Text style={styles.label}>{label}</Text>
      <Pressable style={styles.field} onPress={() => setOpen(true)}>
        <Text style={selected ? styles.value : styles.placeholder}>
          {selected ? selected.label : placeholder ?? 'Seleccionar…'}
        </Text>
        <Text style={styles.chevron}>▾</Text>
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>{label}</Text>
            <FlatList
              data={options}
              keyExtractor={(o) => o.value}
              renderItem={({ item }) => (
                <Pressable
                  style={styles.option}
                  onPress={() => {
                    onChange(item.value);
                    setOpen(false);
                  }}
                >
                  <Text style={styles.optionLabel}>{item.label}</Text>
                  {item.sublabel ? (
                    <Text style={styles.optionSub}>{item.sublabel}</Text>
                  ) : null}
                </Pressable>
              )}
              ListEmptyComponent={
                <Text style={styles.empty}>No hay opciones.</Text>
              }
            />
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: font.sm, color: colors.textMuted, marginBottom: spacing.xs },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    minHeight: 48,
  },
  value: { fontSize: font.md, color: colors.text },
  placeholder: { fontSize: font.md, color: colors.textMuted },
  chevron: { color: colors.textMuted, fontSize: font.md },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: spacing.lg,
    maxHeight: '70%',
  },
  sheetTitle: {
    fontSize: font.lg,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.md,
  },
  option: {
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  optionLabel: { fontSize: font.md, color: colors.text },
  optionSub: { fontSize: font.sm, color: colors.textMuted, marginTop: 2 },
  empty: { color: colors.textMuted, paddingVertical: spacing.lg },
});
