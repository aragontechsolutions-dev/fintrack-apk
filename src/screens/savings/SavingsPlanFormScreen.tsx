import React, { useEffect, useState } from 'react';
import { ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { useSession } from '../../auth/AuthContext';
import { Button, ErrorText, Field, Subtle } from '../../components/ui';
import { CurrencyPicker } from '../../components/CurrencyPicker';
import { Segmented } from '../../components/Segmented';
import { CurrencyCode } from '../../money/currency';
import { formatMoney, parseToMinor } from '../../money/money';
import { MainStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<MainStackParamList, 'SavingsPlanForm'>;
type Kind = 'goal' | 'envelope';

export function SavingsPlanFormScreen({ route }: Props) {
  const navigation = useNavigation();
  const { session, repos } = useSession();
  const editingId = route.params?.planId;

  const [name, setName] = useState('');
  const [target, setTarget] = useState('');
  const [currency, setCurrency] = useState<CurrencyCode>(session.baseCurrency);
  const [kind, setKind] = useState<Kind>('goal');
  const [targetDate, setTargetDate] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!editingId) return;
    repos.savings.getPlan(editingId).then((p) => {
      if (!p) return;
      setName(p.name);
      setCurrency(p.currency as CurrencyCode);
      setKind(p.kind as Kind);
      setTargetDate(p.targetDate ?? '');
      setTarget(formatMoney(p.targetMinor, p.currency as CurrencyCode, { showSymbol: false }));
    });
  }, [editingId, repos]);

  const onSubmit = async () => {
    setError(null);
    if (name.trim().length < 1) return setError('Ingresá un nombre.');
    let targetMinor: number;
    try {
      targetMinor = parseToMinor(target, currency);
    } catch {
      return setError('Monto objetivo inválido.');
    }
    if (targetMinor <= 0) return setError('El objetivo debe ser mayor a 0.');
    if (targetDate && !/^\d{4}-\d{2}-\d{2}$/.test(targetDate)) {
      return setError('La fecha objetivo debe tener formato AAAA-MM-DD.');
    }
    setBusy(true);
    try {
      if (editingId) {
        await repos.savings.updatePlan(editingId, {
          name: name.trim(),
          targetMinor,
          currency,
          kind,
          targetDate: targetDate || null,
        });
      } else {
        await repos.savings.createPlan({
          name: name.trim(),
          targetMinor,
          currency,
          kind,
          targetDate: targetDate || null,
        });
      }
      navigation.goBack();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al guardar.');
      setBusy(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={{ padding: 16 }}>
      <Field label="Nombre de la meta" value={name} onChangeText={setName} placeholder="Ej: Vacaciones, Fondo de emergencia" />
      <Field label="Monto objetivo" value={target} onChangeText={setTarget} keyboardType="numeric" placeholder="0,00" />
      <CurrencyPicker label="Moneda" value={currency} onChange={setCurrency} />
      <Segmented<Kind>
        value={kind}
        onChange={setKind}
        options={[
          { value: 'goal', label: 'Meta' },
          { value: 'envelope', label: 'Sobre' },
        ]}
      />
      <Subtle>
        Una "meta" junta hacia un objetivo. Un "sobre" reserva dinero para una
        categoría de gasto.
      </Subtle>
      <Field
        label="Fecha objetivo (opcional)"
        value={targetDate}
        onChangeText={setTargetDate}
        placeholder="AAAA-MM-DD"
        autoCapitalize="none"
      />
      <ErrorText>{error}</ErrorText>
      <Button title={editingId ? 'Guardar cambios' : 'Crear meta'} onPress={onSubmit} loading={busy} />
    </ScrollView>
  );
}
