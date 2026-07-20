import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useAuth, useSession } from '../../auth/AuthContext';
import { getUser } from '../../auth/authStore';
import { isBiometricAvailable } from '../../crypto/secureStore';
import {
  disableBiometrics,
  enableBiometrics,
} from '../../auth/userService';
import { Card, Subtle } from '../../components/ui';
import { MainStackParamList } from '../../navigation/types';
import { colors, font, spacing } from '../../theme/theme';

type Nav = NativeStackNavigationProp<MainStackParamList>;

export function SettingsScreen() {
  const navigation = useNavigation<Nav>();
  const { logout } = useAuth();
  const { session } = useSession();
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricOn, setBiometricOn] = useState(false);

  const refresh = useCallback(async () => {
    setBiometricAvailable(await isBiometricAvailable());
    const user = await getUser(session.userId);
    setBiometricOn(user?.biometricEnabled ?? false);
  }, [session.userId]);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  const toggleBiometric = async (value: boolean) => {
    try {
      if (value) {
        await enableBiometrics(session);
      } else {
        await disableBiometrics(session.userId);
      }
      setBiometricOn(value);
    } catch {
      Alert.alert('Biometría', 'No se pudo cambiar la configuración biométrica.');
    }
  };

  const Item = ({
    label,
    onPress,
    danger,
  }: {
    label: string;
    onPress: () => void;
    danger?: boolean;
  }) => (
    <Pressable style={styles.item} onPress={onPress}>
      <Text style={[styles.itemText, danger && { color: colors.danger }]}>
        {label}
      </Text>
      <Text style={styles.chevron}>›</Text>
    </Pressable>
  );

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={{ padding: spacing.lg }}
    >
      <Card>
        <Text style={styles.name}>{session.name}</Text>
        <Subtle>Moneda base: {session.baseCurrency}</Subtle>
      </Card>

      <Text style={styles.section}>Seguridad</Text>
      <Card>
        <View style={styles.switchRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.itemText}>Desbloqueo biométrico</Text>
            <Subtle>
              {biometricAvailable
                ? 'Usar huella/rostro para ingresar más rápido.'
                : 'No disponible en este dispositivo.'}
            </Subtle>
          </View>
          <Switch
            value={biometricOn}
            disabled={!biometricAvailable}
            onValueChange={toggleBiometric}
          />
        </View>
      </Card>

      <Text style={styles.section}>Gestión</Text>
      <Card style={{ padding: 0 }}>
        <Item
          label="Categorías"
          onPress={() => navigation.navigate('CategoryList')}
        />
        <Item
          label="Backups"
          onPress={() => navigation.navigate('Backup')}
        />
        <Item
          label="Agregar usuario"
          onPress={() => navigation.navigate('AddUser')}
        />
      </Card>

      <Text style={styles.section}>Sesión</Text>
      <Card style={{ padding: 0 }}>
        <Item label="Cerrar sesión" danger onPress={logout} />
      </Card>

      <Subtle>
        Recordá: los datos se guardan cifrados solo en este dispositivo. Si
        olvidás tu contraseña no hay forma de recuperarlos. Hacé backups desde
        Gestión → Backups.
      </Subtle>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  name: { fontSize: font.xl, fontWeight: '700', color: colors.text },
  section: {
    fontSize: font.sm,
    color: colors.textMuted,
    textTransform: 'uppercase',
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
    letterSpacing: 0.5,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  itemText: { fontSize: font.md, color: colors.text },
  chevron: { fontSize: font.xl, color: colors.textMuted },
  switchRow: { flexDirection: 'row', alignItems: 'center' },
});
