import React, { useCallback, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import { useSession } from '../../auth/AuthContext';
import { Button, Card, Field } from '../../components/ui';
import { Segmented } from '../../components/Segmented';
import { Category } from '../../db/schema';
import { CategoryKind } from '../../data/types';
import { colors, font, radius, spacing } from '../../theme/theme';

export function CategoryListScreen() {
  const { repos } = useSession();
  const [kind, setKind] = useState<CategoryKind>('expense');
  const [categories, setCategories] = useState<Category[]>([]);
  const [newName, setNewName] = useState('');

  const load = useCallback(async () => {
    setCategories(await repos.categories.list(kind));
  }, [repos, kind]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const onAdd = async () => {
    const name = newName.trim();
    if (name.length < 1) return;
    await repos.categories.create({ name, kind });
    setNewName('');
    load();
  };

  return (
    <View style={styles.screen}>
      <View style={{ padding: spacing.lg }}>
        <Segmented<CategoryKind>
          value={kind}
          onChange={setKind}
          options={[
            { value: 'expense', label: 'Gastos', color: colors.expense },
            { value: 'income', label: 'Ingresos', color: colors.income },
          ]}
        />
        <Card>
          <Field
            label="Nueva categoría"
            value={newName}
            onChangeText={setNewName}
            placeholder="Nombre"
            onSubmitEditing={onAdd}
          />
          <Button title="Agregar" onPress={onAdd} />
        </Card>
      </View>
      <FlatList
        data={categories}
        keyExtractor={(c) => c.id}
        contentContainerStyle={{ paddingHorizontal: spacing.lg }}
        renderItem={({ item }) => (
          <View style={styles.item}>
            <Text style={styles.itemText}>{item.name}</Text>
          </View>
        )}
        ListEmptyComponent={<Text style={styles.muted}>Sin categorías.</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  item: {
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  itemText: { fontSize: font.md, color: colors.text },
  muted: { color: colors.textMuted, paddingHorizontal: spacing.lg },
});
