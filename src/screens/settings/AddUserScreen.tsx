import React, { useState } from 'react';
import { ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';

import { useAuth } from '../../auth/AuthContext';
import { Button, Card, ErrorText, Field, Subtle } from '../../components/ui';

export function AddUserScreen() {
  const navigation = useNavigation();
  const { addUser } = useAuth();
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onSubmit = async () => {
    setError(null);
    if (name.trim().length < 2) return setError('Ingresá un nombre.');
    if (password.length < 6) return setError('La contraseña debe tener al menos 6 caracteres.');
    if (password !== confirm) return setError('Las contraseñas no coinciden.');
    setBusy(true);
    try {
      await addUser(name.trim(), password);
      navigation.goBack();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al agregar usuario.');
      setBusy(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={{ padding: 16 }}>
      <Subtle>
        El nuevo perfil comparte esta base cifrada pero ve solo sus propios
        datos. Va a poder ingresar con su propia contraseña.
      </Subtle>
      <Card style={{ marginTop: 16 }}>
        <Field label="Nombre" value={name} onChangeText={setName} autoCapitalize="words" />
        <Field label="Contraseña" value={password} onChangeText={setPassword} secureTextEntry />
        <Field label="Repetir contraseña" value={confirm} onChangeText={setConfirm} secureTextEntry />
        <ErrorText>{error}</ErrorText>
        <Button title="Agregar usuario" onPress={onSubmit} loading={busy} />
      </Card>
    </ScrollView>
  );
}
