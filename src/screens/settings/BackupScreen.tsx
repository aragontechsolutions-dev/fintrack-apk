import React, { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import { useAuth, useSession } from '../../auth/AuthContext';
import { Button, Card, ErrorText, Field, Subtle } from '../../components/ui';
import { closeDatabase, getDatabase } from '../../db/client';
import {
  exportUserBackup,
  importUserBackup,
  pickBackupFile,
  shareBackup,
} from '../../backup/exportImport';
import { createSnapshot, deleteSnapshot, listSnapshots, restoreSnapshot, SnapshotInfo } from '../../backup/snapshot';
import { BackupMeta, readMeta, updateMeta } from '../../backup/meta';
import { colors, font, spacing } from '../../theme/theme';

function formatWhen(ms: number | null): string {
  if (!ms) return 'nunca';
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function BackupScreen() {
  const { session } = useSession();
  const { logout } = useAuth();

  const [meta, setMeta] = useState<BackupMeta | null>(null);
  const [snapshots, setSnapshots] = useState<SnapshotInfo[]>([]);

  const [exportPass, setExportPass] = useState('');
  const [exportPass2, setExportPass2] = useState('');
  const [importPass, setImportPass] = useState('');
  const [pickedUri, setPickedUri] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setMeta(await readMeta());
    setSnapshots(await listSnapshots());
  }, []);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  const onExport = async () => {
    setError(null);
    if (exportPass.length < 8) return setError('La passphrase debe tener al menos 8 caracteres.');
    if (exportPass !== exportPass2) return setError('Las passphrases no coinciden.');
    setBusy('export');
    try {
      const { uri } = await exportUserBackup(getDatabase(), session.userId, session.name, exportPass);
      await shareBackup(uri);
      setExportPass('');
      setExportPass2('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al exportar.');
    } finally {
      setBusy(null);
    }
  };

  const onPick = async () => {
    setError(null);
    const uri = await pickBackupFile();
    if (uri) setPickedUri(uri);
  };

  const onImport = () => {
    setError(null);
    if (!pickedUri) return setError('Elegí un archivo de backup.');
    if (importPass.length < 1) return setError('Ingresá la passphrase del backup.');
    Alert.alert(
      'Restaurar backup',
      'Esto REEMPLAZA todos tus datos actuales por los del backup. Se guarda un snapshot de seguridad antes. ¿Continuar?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Restaurar',
          style: 'destructive',
          onPress: async () => {
            setBusy('import');
            try {
              const counts = await importUserBackup(getDatabase(), session.userId, pickedUri, importPass);
              setImportPass('');
              setPickedUri(null);
              await refresh();
              Alert.alert(
                'Restauración completa',
                `Se restauraron ${counts.transactions} movimientos, ${counts.accounts} cuentas y ${counts.categories} categorías.`,
              );
            } catch (e) {
              setError(e instanceof Error ? e.message : 'Error al restaurar.');
            } finally {
              setBusy(null);
            }
          },
        },
      ],
    );
  };

  const onBackupNow = async () => {
    setBusy('now');
    try {
      await createSnapshot();
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al crear snapshot.');
    } finally {
      setBusy(null);
    }
  };

  const onToggleAuto = async (value: boolean) => {
    const next = await updateMeta({ autoEnabled: value });
    setMeta(next);
  };

  const onRestoreSnapshot = (snap: SnapshotInfo) => {
    Alert.alert(
      'Restaurar snapshot',
      `Vas a restaurar el snapshot del ${formatWhen(snap.createdAt)}. Se cerrará la sesión y deberás volver a ingresar. ¿Continuar?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Restaurar',
          style: 'destructive',
          onPress: async () => {
            try {
              // Close the DB first (restore overwrites the files), then log out.
              closeDatabase();
              await restoreSnapshot(snap.dir);
              logout();
            } catch (e) {
              setError(e instanceof Error ? e.message : 'Error al restaurar snapshot.');
            }
          },
        },
      ],
    );
  };

  const onDeleteSnapshot = (snap: SnapshotInfo) => {
    Alert.alert('Eliminar snapshot', '¿Eliminar este snapshot?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          await deleteSnapshot(snap.dir);
          await refresh();
        },
      },
    ]);
  };

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={{ padding: spacing.lg }}>
      <ErrorText>{error}</ErrorText>

      {/* Automatic snapshots */}
      <Text style={styles.section}>Backup automático</Text>
      <Card>
        <View style={styles.switchRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.itemText}>Snapshot diario</Text>
            <Subtle>Último: {formatWhen(meta?.lastBackupAt ?? null)}</Subtle>
          </View>
          <Switch value={meta?.autoEnabled ?? true} onValueChange={onToggleAuto} />
        </View>
        {meta?.lastError ? (
          <Subtle>Último error: {meta.lastError}</Subtle>
        ) : null}
        <Button
          title="Hacer backup ahora"
          onPress={onBackupNow}
          loading={busy === 'now'}
          style={{ marginTop: spacing.sm }}
        />
        <Subtle>
          El snapshot copia la base cifrada dentro del dispositivo. Android no
          garantiza una hora exacta en segundo plano (mínimo 15 min, según Doze y
          el fabricante); por eso también se respalda al abrir la app si venció el
          plazo.
        </Subtle>
      </Card>

      {snapshots.length > 0 ? (
        <Card style={{ padding: 0 }}>
          {snapshots.map((s) => (
            <View key={s.name} style={styles.snapRow}>
              <Text style={styles.itemText}>{formatWhen(s.createdAt)}</Text>
              <View style={{ flexDirection: 'row', gap: spacing.md }}>
                <Pressable onPress={() => onRestoreSnapshot(s)}>
                  <Text style={styles.link}>Restaurar</Text>
                </Pressable>
                <Pressable onPress={() => onDeleteSnapshot(s)}>
                  <Text style={[styles.link, { color: colors.danger }]}>Eliminar</Text>
                </Pressable>
              </View>
            </View>
          ))}
        </Card>
      ) : null}

      {/* Portable export */}
      <Text style={styles.section}>Exportar (portable, cifrado)</Text>
      <Card>
        <Subtle>
          Crea un archivo cifrado con una passphrase propia, para guardar fuera
          del dispositivo o migrar a otro. Guardá bien la passphrase: sin ella el
          backup es irrecuperable.
        </Subtle>
        <Field label="Passphrase del backup" value={exportPass} onChangeText={setExportPass} secureTextEntry />
        <Field label="Repetir passphrase" value={exportPass2} onChangeText={setExportPass2} secureTextEntry />
        <Button title="Crear y compartir backup" onPress={onExport} loading={busy === 'export'} />
      </Card>

      {/* Portable import */}
      <Text style={styles.section}>Restaurar desde archivo</Text>
      <Card>
        <Button title={pickedUri ? 'Archivo seleccionado ✓' : 'Elegir archivo…'} variant="secondary" onPress={onPick} />
        <Field label="Passphrase del backup" value={importPass} onChangeText={setImportPass} secureTextEntry style={{ marginTop: spacing.md }} />
        <Button title="Restaurar (reemplaza tus datos)" variant="danger" onPress={onImport} loading={busy === 'import'} />
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  section: {
    fontSize: font.sm,
    color: colors.textMuted,
    textTransform: 'uppercase',
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
    letterSpacing: 0.5,
  },
  itemText: { fontSize: font.md, color: colors.text },
  switchRow: { flexDirection: 'row', alignItems: 'center' },
  snapRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  link: { color: colors.primary, fontWeight: '600', fontSize: font.md },
});
