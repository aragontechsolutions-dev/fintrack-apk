import React, { useState } from 'react';
import { Alert, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';

import { useAuth } from '../../auth/AuthContext';
import { Button, Card, ErrorText, Field, Subtle } from '../../components/ui';

export function ChangePinScreen() {
  const navigation = useNavigation();
  const { changePin } = useAuth();
  const [oldPin, setOldPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onSubmit = async () => {
    setError(null);
    if (newPin.length < 6) return setError('El nuevo PIN debe tener al menos 6 caracteres.');
    if (newPin !== confirm) return setError('Los PIN nuevos no coinciden.');
    if (newPin === oldPin) return setError('El nuevo PIN debe ser distinto al actual.');
    setBusy(true);
    try {
      await changePin(oldPin, newPin);
      Alert.alert('Listo', 'Tu PIN fue actualizado.');
      navigation.goBack();
    } catch (e) {
      setError(
        e instanceof Error && e.name === 'InvalidCredentialsError'
          ? 'El PIN actual es incorrecto.'
          : e instanceof Error
            ? e.message
            : 'No se pudo cambiar el PIN.',
      );
      setBusy(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={{ padding: 16 }}>
      <Subtle>
        Necesitás tu PIN actual para cambiarlo. Si tenés biometría activada,
        seguirá funcionando (la clave de datos no cambia).
      </Subtle>
      <Card style={{ marginTop: 16 }}>
        <Field label="PIN actual" value={oldPin} onChangeText={setOldPin} secureTextEntry />
        <Field label="Nuevo PIN" value={newPin} onChangeText={setNewPin} secureTextEntry />
        <Field label="Repetir nuevo PIN" value={confirm} onChangeText={setConfirm} secureTextEntry />
        <ErrorText>{error}</ErrorText>
        <Button title="Cambiar PIN" onPress={onSubmit} loading={busy} />
      </Card>
    </ScrollView>
  );
}
