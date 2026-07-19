import React, { useCallback, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { getProfiles } from '../../auth/userService';
import { AuthUserRecord } from '../../auth/authStore';
import { Subtle } from '../../components/ui';
import { colors, font, radius, spacing } from '../../theme/theme';
import { AuthStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<AuthStackParamList, 'ProfileSelect'>;

export function ProfileSelectScreen({ navigation }: Props) {
  const [profiles, setProfiles] = useState<AuthUserRecord[]>([]);

  useFocusEffect(
    useCallback(() => {
      getProfiles().then(setProfiles);
    }, []),
  );

  return (
    <View style={styles.screen}>
      <Subtle>Perfiles en este dispositivo</Subtle>
      <FlatList
        style={{ marginTop: spacing.md }}
        data={profiles}
        keyExtractor={(p) => p.id}
        renderItem={({ item }) => (
          <Pressable
            style={styles.card}
            onPress={() =>
              navigation.navigate('Login', {
                userId: item.id,
                name: item.name,
              })
            }
          >
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {item.name.charAt(0).toUpperCase()}
              </Text>
            </View>
            <View>
              <Text style={styles.name}>{item.name}</Text>
              <Text style={styles.sub}>
                {item.biometricEnabled ? 'Biometría habilitada' : 'PIN'}
              </Text>
            </View>
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background, padding: spacing.lg },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginBottom: spacing.md,
    gap: spacing.md,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: colors.textInverse, fontSize: font.lg, fontWeight: '700' },
  name: { fontSize: font.lg, fontWeight: '600', color: colors.text },
  sub: { fontSize: font.sm, color: colors.textMuted },
});
