import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { useAuth } from '../../auth/AuthContext';
import { getUser } from '../../auth/authStore';
import { isBiometricAvailable } from '../../crypto/secureStore';
import {
  Button,
  Card,
  ErrorText,
  Field,
  Heading,
} from '../../components/ui';
import { AuthStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<AuthStackParamList, 'Login'>;

export function LoginScreen({ route }: Props) {
  const { userId, name } = route.params;
  const { loginWithPassword, loginWithBiometrics } = useAuth();
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [biometricOffered, setBiometricOffered] = useState(false);

  useEffect(() => {
    (async () => {
      const user = await getUser(userId);
      const available = await isBiometricAvailable();
      if (user?.biometricEnabled && available) {
        setBiometricOffered(true);
        // Auto-prompt biometric on entry.
        void tryBiometric();
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const tryBiometric = async () => {
    setError(null);
    const ok = await loginWithBiometrics(userId);
    if (!ok) setError('No se pudo autenticar con biometría. Usá tu PIN.');
  };

  const onSubmit = async () => {
    setError(null);
    setBusy(true);
    try {
      await loginWithPassword(userId, password);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al ingresar.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ flex: 1, padding: 16 }}>
      <Heading>Hola, {name}</Heading>
      <Card style={{ marginTop: 16 }}>
        <Field
          label="PIN / contraseña"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoFocus
          onSubmitEditing={onSubmit}
        />
        <ErrorText>{error}</ErrorText>
        <Button title="Ingresar" onPress={onSubmit} loading={busy} />
        {biometricOffered ? (
          <Button
            title="Usar biometría"
            variant="secondary"
            onPress={tryBiometric}
            style={{ marginTop: 8 }}
          />
        ) : null}
      </Card>
    </View>
  );
}
