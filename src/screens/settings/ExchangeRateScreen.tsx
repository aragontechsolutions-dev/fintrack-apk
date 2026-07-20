import React, { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import { useSession } from '../../auth/AuthContext';
import { Button, Card, ErrorText, Field, Subtle } from '../../components/ui';
import { RATE_SCALE, formatRate, parseRate } from '../../money/fx';
import { fetchUsdQuote } from '../../services/dolarApi';
import { todayISO } from '../../utils/date';
import { colors, font, spacing } from '../../theme/theme';

export function ExchangeRateScreen() {
  const { session, repos } = useSession();
  const base = session.baseCurrency;

  const [current, setCurrent] = useState<number | null>(null);
  const [rateInput, setRateInput] = useState('');
  const [info, setInfo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const r = await repos.rates.latest('USD', base);
    setCurrent(r);
    if (r) setRateInput(formatRate(r));
  }, [repos, base]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  if (base === 'USD') {
    return (
      <ScrollView contentContainerStyle={{ padding: spacing.lg }}>
        <Subtle>Tu moneda base es USD; no se requiere cotización.</Subtle>
      </ScrollView>
    );
  }

  const saveManual = async () => {
    setError(null);
    setInfo(null);
    let scaled: number;
    try {
      scaled = parseRate(rateInput);
    } catch {
      return setError('Tasa inválida.');
    }
    setBusy('manual');
    try {
      await repos.rates.save('USD', base, scaled, todayISO(), 'manual');
      await load();
      setInfo('Tasa guardada.');
    } finally {
      setBusy(null);
    }
  };

  const refreshOnline = async () => {
    setError(null);
    setInfo(null);
    setBusy('online');
    try {
      const quote = await fetchUsdQuote();
      const scaled = Math.round(quote.venta * Math.pow(10, RATE_SCALE));
      await repos.rates.save('USD', base, scaled, todayISO(), 'dolarapi');
      await load();
      setInfo(
        `Actualizada a ${quote.venta} ${base}/USD (venta, fuente BROU vía DolarApi).`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo actualizar.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <ScrollView contentContainerStyle={{ padding: spacing.lg }}>
      <Card>
        <Text style={styles.label}>Tasa actual USD → {base}</Text>
        <Text style={styles.rate}>
          {current !== null ? `${formatRate(current)} ${base}` : 'Sin tasa guardada'}
        </Text>
      </Card>

      <Card>
        <Field
          label={`Tasa manual (1 USD = ? ${base})`}
          value={rateInput}
          onChangeText={setRateInput}
          keyboardType="numeric"
          placeholder="Ej: 40,50"
        />
        <Button title="Guardar tasa manual" onPress={saveManual} loading={busy === 'manual'} />
      </Card>

      <Card>
        <Subtle>
          Actualización online opcional. Requiere conexión. La fuente es BROU (vía
          DolarApi), que difiere levemente del cierre oficial del BCU. La app
          funciona sin conexión con la última tasa guardada.
        </Subtle>
        <Button
          title="Actualizar desde DolarApi"
          variant="secondary"
          onPress={refreshOnline}
          loading={busy === 'online'}
          style={{ marginTop: spacing.md }}
        />
      </Card>

      {info ? <Text style={styles.info}>{info}</Text> : null}
      <ErrorText>{error}</ErrorText>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: font.sm, color: colors.textMuted },
  rate: { fontSize: font.xl, fontWeight: '800', color: colors.text, marginTop: spacing.xs },
  info: { color: colors.income, fontSize: font.sm, marginTop: spacing.sm },
});
