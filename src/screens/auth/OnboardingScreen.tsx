import React, { useState } from 'react';
import { ScrollView } from 'react-native';

import { useAuth } from '../../auth/AuthContext';
import {
  Button,
  Card,
  ErrorText,
  Field,
  Heading,
  Subtle,
} from '../../components/ui';
import { CurrencyPicker } from '../../components/CurrencyPicker';
import { CurrencyCode } from '../../money/currency';

export function OnboardingScreen() {
  const { createFirstUser } = useAuth();
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [currency, setCurrency] = useState<CurrencyCode>('UYU');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onSubmit = async () => {
    setError(null);
    if (name.trim().length < 2) return setError('Ingresá un nombre.');
    if (password.length < 6)
      return setError('El PIN/contraseña debe tener al menos 6 caracteres.');
    if (password !== confirm) return setError('Las contraseñas no coinciden.');
    setBusy(true);
    try {
      await createFirstUser(name.trim(), password, currency);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al crear el usuario.');
      setBusy(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={{ padding: 16 }}>
      <Heading>Creá tu perfil</Heading>
      <Subtle>
        FinTrack guarda todo cifrado en tu dispositivo, sin servidores. Recordá
        tu contraseña: no hay forma de recuperarla. Hacé backups.
      </Subtle>
      <Card style={{ marginTop: 16 }}>
        <Field
          label="Nombre"
          value={name}
          onChangeText={setName}
          placeholder="Tu nombre"
          autoCapitalize="words"
        />
        <Field
          label="PIN / contraseña"
          value={password}
          onChangeText={setPassword}
          placeholder="Mínimo 6 caracteres"
          secureTextEntry
        />
        <Field
          label="Repetir contraseña"
          value={confirm}
          onChangeText={setConfirm}
          secureTextEntry
        />
        <CurrencyPicker
          label="Moneda base"
          value={currency}
          onChange={setCurrency}
        />
        <ErrorText>{error}</ErrorText>
        <Button
          title="Crear perfil"
          onPress={onSubmit}
          loading={busy}
          style={{ marginTop: 8 }}
        />
      </Card>
    </ScrollView>
  );
}
