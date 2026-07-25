import React, { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useAuth, useSession } from '../../auth/AuthContext';
import { getUser } from '../../auth/authStore';
import { isBiometricAvailable } from '../../crypto/secureStore';
import { disableBiometrics, enableBiometrics } from '../../auth/userService';
import { Card, Subtle } from '../../components/ui';
import { AtsCredit } from '../../components/AtsCredit';
import { Picker } from '../../components/Picker';
import { MainStackParamList } from '../../navigation/types';
import { colors, font, spacing } from '../../theme/theme';

type Nav = NativeStackNavigationProp<MainStackParamList>;

const AUTO_LOGOUT_OPTIONS = [
  { value: '60', label: '1 minuto' },
  { value: '120', label: '2 minutos' },
  { value: '300', label: '5 minutos' },
  { value: '600', label: '10 minutos' },
  { value: '0', label: 'Nunca (no recomendado)' },
];

export function SettingsScreen() {
  const navigation = useNavigation<Nav>();
  const { logout, session, setAutoLogoutSeconds, purgeMyData, deleteMyProfile } =
    useAuth();
  const { session: sess } = useSession();
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricOn, setBiometricOn] = useState(false);
  const autoLogout = String(session?.autoLogoutSeconds ?? 120);

  const refresh = useCallback(async () => {
    setBiometricAvailable(await isBiometricAvailable());
    const user = await getUser(sess.userId);
    setBiometricOn(user?.biometricEnabled ?? false);
  }, [sess.userId]);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  const toggleBiometric = async (value: boolean) => {
    try {
      if (value) await enableBiometrics(sess);
      else await disableBiometrics(sess.userId);
      setBiometricOn(value);
    } catch {
      Alert.alert('Biometría', 'No se pudo cambiar la configuración biométrica.');
    }
  };

  const onChangeAutoLogout = async (value: string) => {
    try {
      await setAutoLogoutSeconds(Number(value));
    } catch {
      Alert.alert('Error', 'No se pudo guardar el tiempo de bloqueo.');
    }
  };

  const confirmPurge = () => {
    Alert.alert(
      'Borrar mis datos',
      'Se eliminarán todas tus cuentas, movimientos, metas y presupuestos (tu perfil se conserva). Esto no se puede deshacer. ¿Continuar?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Borrar',
          style: 'destructive',
          onPress: async () => {
            try {
              await purgeMyData();
              Alert.alert('Listo', 'Tus datos fueron borrados.');
            } catch {
              Alert.alert('Error', 'No se pudieron borrar los datos.');
            }
          },
        },
      ],
    );
  };

  const confirmDeleteProfile = () => {
    Alert.alert(
      'Eliminar mi perfil',
      'Se eliminarán tu perfil y TODOS tus datos de este dispositivo, de forma permanente. ¿Continuar?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar todo',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteMyProfile();
            } catch {
              Alert.alert('Error', 'No se pudo eliminar el perfil.');
            }
          },
        },
      ],
    );
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
      <Text style={[styles.itemText, danger && { color: colors.danger }]}>{label}</Text>
      <Text style={styles.chevron}>›</Text>
    </Pressable>
  );

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={{ padding: spacing.lg }}
    >
      <Card>
        <Text style={styles.name}>{sess.name}</Text>
        <Subtle>Moneda base: {sess.baseCurrency}</Subtle>
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
          <Switch value={biometricOn} disabled={!biometricAvailable} onValueChange={toggleBiometric} />
        </View>
        <View style={styles.divider} />
        <Picker
          label="Bloqueo por inactividad"
          value={autoLogout}
          options={AUTO_LOGOUT_OPTIONS}
          onChange={onChangeAutoLogout}
        />
      </Card>
      <Card style={{ padding: 0 }}>
        <Item label="Cambiar PIN" onPress={() => navigation.navigate('ChangePin')} />
      </Card>

      <Text style={styles.section}>Gestión</Text>
      <Card style={{ padding: 0 }}>
        <Item label="Cuentas" onPress={() => navigation.navigate('Accounts')} />
        <Item label="Categorías" onPress={() => navigation.navigate('CategoryList')} />
        <Item label="Cotización USD" onPress={() => navigation.navigate('ExchangeRate')} />
        <Item label="Backups" onPress={() => navigation.navigate('Backup')} />
        <Item label="Agregar usuario" onPress={() => navigation.navigate('AddUser')} />
      </Card>

      <Text style={styles.section}>Sesión</Text>
      <Card style={{ padding: 0 }}>
        <Item label="Cerrar sesión" onPress={logout} />
      </Card>

      <Text style={[styles.section, { color: colors.danger }]}>Zona de riesgo</Text>
      <Card style={{ padding: 0 }}>
        <Item label="Borrar mis datos" danger onPress={confirmPurge} />
        <Item label="Eliminar mi perfil" danger onPress={confirmDeleteProfile} />
      </Card>

      <Subtle>
        Recordá: los datos se guardan cifrados solo en este dispositivo. Si
        olvidás tu contraseña no hay forma de recuperarlos. Hacé backups desde
        Gestión → Backups.
      </Subtle>

      <AtsCredit />
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
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginVertical: spacing.md,
  },
});
