# FinTrack

Aplicación Android nativa (React Native + Expo) de **finanzas personales**,
**offline-first**, multiusuario local y con la base de datos **cifrada** en el
dispositivo. Sin servidores: toda la seguridad recae en el cifrado en reposo y
el control de acceso local.

> Estado actual: **Etapas 0–6 completas.** App funcionalmente terminada:
> fundaciones, multiusuario, multimoneda + detalle, ahorro/presupuestos/reportes,
> backups, OCR de tickets, y endurecimiento (cambio de PIN, auto-logout
> configurable, borrado de datos, cotización USD online opcional). Ver
> [Roadmap](#roadmap).

---

## ¿Qué hace hoy?

- **Perfiles locales múltiples** en un mismo dispositivo, cada uno con su
  contraseña. El primer perfil se crea en el onboarding; se pueden agregar más
  desde Ajustes.
- **Login con PIN/contraseña** y, opcionalmente, **biometría** (huella/rostro).
- **Cuentas / billeteras** (efectivo, banco, tarjeta) en UYU o USD, con saldo
  calculado.
- **Movimientos** de ingreso / gasto / **transferencia** entre cuentas, con
  categorías.
- **Multimoneda**: cada movimiento guarda su moneda, la tasa de cambio usada y
  el equivalente en la moneda base (por defecto UYU). Dinero siempre en
  **enteros de centavos** (nunca float).
- **Detalle de productos por compra**: ítems con descripción, cantidad
  (fraccional) y precio unitario, con cuadre de la suma contra el total del
  movimiento (la diferencia se muestra como impuesto/descuento/ajuste).
- **OCR de tickets** (on-device, offline): foto → ML Kit → parser → pantalla de
  **revisión obligatoria** que precarga las líneas; la imagen se guarda cifrada
  (ver [OCR](#ocr-de-tickets)).
- **Dashboard**: saldo total por moneda, ingresos/gastos/balance del mes.
- **Ahorro**: metas y sobres con progreso, aportes y proyección de cumplimiento.
- **Presupuestos**: límite mensual por categoría con gasto consumido y alerta de
  exceso.
- **Reportes**: ingresos y gastos por categoría, ingresos vs. gastos de los
  últimos 6 meses, y **tasa de ahorro** del mes y su tendencia (gráficos basados
  en Views, sin dependencias nativas de charts).
- **Seguridad**: base cifrada con SQLCipher, clave protegida por
  key-wrapping (Argon2id + AES-256-GCM), **auto-logout configurable** (1/2/5/10
  min o nunca), bloqueo al pasar a segundo plano, bloqueo de capturas de
  pantalla, **cambio de PIN** (pidiendo el anterior) y **borrado de datos/perfil**.
- **Cotización USD opcional**: tasa manual o actualización online desde DolarApi
  (con fallback y cache; la app funciona sin conexión).
- **Backups**: export portable cifrado con passphrase + snapshots locales
  automáticos cada 24 h (ver [Backups](#backups)).

---

## Arquitectura y decisiones clave

### Dinero: enteros de centavos
Todos los montos se guardan y calculan como **enteros en la unidad mínima**
(centavos) en columnas `INTEGER` de SQLite. Nunca se usa `float`/`REAL` para
dinero. Las columnas llevan el sufijo `Minor` para que la unidad sea inequívoca.
La capa `src/money/` centraliza formateo, parseo y aritmética.

### Base única cifrada + aislamiento por usuario (key-wrapping)
- Una sola base **SQLCipher** (AES-256) para todos los perfiles.
- Se genera una **DEK** (clave de la base) aleatoria de 256 bits al crear el
  primer usuario.
- La contraseña de cada usuario se estira con **Argon2id** (salt único) a una
  **KEK**, que **envuelve** (AES-256-GCM) la DEK. Solo se guarda el blob
  cifrado.
- Sin la contraseña correcta, la DEK no se puede recuperar y la base no abre
  (el tag GCM falla → "credenciales inválidas").
- La separación entre perfiles dentro de la base es **lógica**: cada consulta
  filtra siempre por `user_id` en la capa de repositorios
  (`src/data/repositories.ts`), nunca en la UI.

> **Compromiso a conocer:** todos los perfiles locales comparten la misma DEK,
> así que la protección criptográfica es fuerte frente a alguien **sin** una
> contraseña válida, pero entre perfiles del propio dispositivo el aislamiento
> es lógico. Si en el futuro se requiere aislamiento criptográfico total entre
> usuarios, la ruta de mejora es **una base por usuario** (el modelo con
> `user_id` y claves envueltas ya lo facilita).

### Los secretos de auth viven FUERA de la base cifrada
Para abrir la base hay que derivar su clave, así que el salt, los parámetros de
Argon2 y la DEK envuelta se guardan en un archivo JSON en claro
(`src/auth/authStore.ts`). Es seguro: la DEK envuelta es inútil sin la
contraseña. La biometría guarda la DEK en el **Android Keystore** vía
`expo-secure-store` (con fallback obligatorio al PIN).

### Multimoneda offline
- Monedas soportadas: **UYU (base por defecto)** y **USD**, ambas con 2
  decimales.
- Las tasas de cambio se ingresan **manualmente** y se cachean
  (`exchange_rates`). La app funciona 100% sin conexión.
- La integración automática con el BCU (SOAP, sin CORS, solo días hábiles) **no**
  se implementa por diseño; queda como mejora opcional vía proxy/DolarApi.

### Backups

Hay **dos mecanismos complementarios**, porque la app descarta la clave de la
base (DEK) al ir a segundo plano y una tarea en background no puede descifrarla:

1. **Export portable cifrado (manual).** Vuelca los datos del usuario a un
   contenedor `.ftbk` cifrado con **AES-256-GCM**, con clave derivada por
   **Argon2id** de una **passphrase propia** (independiente del PIN). Incluye
   cabecera con versión de formato/esquema y checksum SHA-256. Es portable entre
   dispositivos y se comparte con el share sheet. Restaurar valida
   magic/versión/checksum, descifra (el tag GCM detecta passphrase incorrecta o
   manipulación) y **reemplaza** los datos del usuario (remapeando `user_id`).
2. **Snapshot local automático.** Copia el archivo `.db` (ya cifrado en reposo)
   + `auth.json` a `documentDirectory/backups/`. Como no necesita la DEK, puede
   correr en **background** (`expo-background-fetch`/WorkManager). Escritura
   atómica (temp → move), se conservan los últimos N y se guarda `lastBackupAt`.

**Sobre "cada 24 h":** Android no garantiza hora exacta (WorkManager: mínimo
15 min, sujeto a Doze/fabricante). Por eso el mecanismo confiable es
**oportunista**: al iniciar sesión, si pasaron ≥24 h, se crea un snapshot; el
background es un refuerzo best-effort que además notifica si hace ≥3 días que no
hay backup. Antes de cualquier restauración se toma un snapshot de seguridad.

### OCR de tickets

Pipeline 100% on-device (offline, gratis) con **Google ML Kit Text Recognition
v2** (`@react-native-ml-kit/text-recognition`) + `expo-image-picker`:

1. **Captura** foto (cámara o galería), con calidad reducida.
2. **OCR** → texto + geometría de líneas (`src/ocr/recognize.ts`).
3. **Parser** heurístico (`src/ocr/parseReceipt.ts`, puro y con tests): agrupa
   descripción + cantidad + precio, detecta patrones `N x precio`, cantidad
   inicial, excluye metadatos (SUBTOTAL/IVA/RUT/…), detecta el TOTAL y asigna un
   **nivel de confianza** a cada línea.
4. **Pantalla de revisión obligatoria** (`ReceiptScanScreen`): muestra la foto y
   precarga el **editor de líneas** para corregir; resalta cuántas líneas son de
   baja confianza y compara el subtotal con el total.
5. Al confirmar, guarda el movimiento con `source='ocr'` y la **imagen cifrada**
   con la DEK (AES-256-GCM, `src/receipts/receiptStore.ts`) para poder
   reprocesarla sin dejar copia en claro en reposo.

**Límites reales (de la investigación):** la precisión de líneas ronda ~90-93%
en supermercado limpio y baja en tickets térmicos degradados; por eso la
**corrección manual es obligatoria** y ninguna línea se guarda sin confirmación.
El parser es un punto de partida razonable: **ajustalo probando con tickets
uruguayos reales en tu dispositivo** (los tests cubren un caso representativo).
Requiere **development build** y **Google Play Services**.

---

## Estructura del proyecto

```
src/
  crypto/        Argon2id, AES-256-GCM, key-wrapping, random, secure store
  backup/        Export/import portable, snapshots locales, tarea background
  ocr/           Reconocimiento ML Kit + parser de tickets
  receipts/      Almacenamiento cifrado de imágenes de tickets
  services/      Integraciones externas opcionales (DolarApi)
  db/            Esquema Drizzle, cliente SQLCipher, migraciones, seeds
  money/         Tipo Money (centavos), formateo/parseo, tasas de cambio (fx)
  auth/          Auth store (JSON), servicio de usuarios, AuthContext (sesión)
  data/          Repositorios con aislamiento por user_id, tipos de dominio
  navigation/    React Navigation (stacks + tabs)
  screens/       Pantallas (auth, dashboard, cuentas, movimientos, ajustes…)
  components/    UI reutilizable (Button, Field, Picker, TransactionRow…)
  theme/         Tokens de diseño
  utils/         Fechas
```

---

## Requisitos para compilar

Esta app usa módulos nativos (SQLCipher, cripto, biometría), por lo que **no**
funciona en Expo Go: hay que generar un **development build**.

1. **Node.js 18+** y **npm**.
2. **Android Studio** — solo para el **Android SDK** y un **emulador (AVD)**, o
   un teléfono físico con depuración USB. El código NO se edita en Android
   Studio; usá VS Code u otro editor.
3. Opcional: cuenta de **Expo** (EAS) si querés compilar en la nube.

### Instalar dependencias

```bash
npm install
```

### Alinear versiones nativas con el SDK (recomendado, en tu PC)

```bash
npx expo install --check
npx expo-doctor
```

### Compilar y correr

**Opción A — build local con tu Android SDK (Android Studio):**
```bash
npx expo run:android
```
Esto hace el `prebuild` (genera la carpeta `android/`), compila y lanza la app
en el emulador/dispositivo. Requiere el Android SDK configurado
(`ANDROID_HOME`).

**Opción B — build en la nube con EAS:**
```bash
npm install -g eas-cli
eas login
eas build --profile development --platform android
```
Instalá el APK resultante y luego:
```bash
npx expo start --dev-client
```

---

## Notas técnicas

- **New Architecture** está **desactivada** (`app.json → newArchEnabled:false`)
  para maximizar la compatibilidad de `react-native-quick-crypto` y
  `react-native-argon2` en el primer build. Se puede activar tras verificar que
  esas librerías funcionan en New Arch en tus dispositivos objetivo.
- **Migraciones Drizzle:** generadas en `src/db/migrations/`. Para regenerar
  tras cambiar el esquema:
  ```bash
  npm run db:generate
  ```
- **Typecheck:**
  ```bash
  npm run typecheck
  ```

---

## Seguridad (resumen MASVS)

- Datos en reposo cifrados (SQLCipher / AES-256). Secretos en Keystore.
- Derivación de clave con Argon2id (OWASP: m≥19 MiB, t=2, p=1).
- Cifrado autenticado AES-256-GCM (detecta manipulación).
- Auto-logout por inactividad **configurable** + bloqueo al ir a segundo plano.
- Bloqueo de capturas de pantalla en sesión (`expo-screen-capture`).
- Cambio de PIN (verifica el anterior; re-envuelve la misma DEK).
- Borrado de datos del perfil y eliminación total del perfil (incluye imágenes
  de tickets cifradas).
- **Sin recuperación de contraseña:** si se olvida, los datos son
  irrecuperables. La app insiste en hacer backups (llegan en Etapa 4).

---

## Roadmap

| Etapa | Descripción | Estado |
|---|---|---|
| 0 | Fundaciones: dev build, SQLCipher+Drizzle, cripto (Argon2id/AES-GCM/key-wrapping) | ✅ |
| 1 | Multiusuario local, núcleo financiero (cuentas, categorías, transacciones, transferencias, saldos), auto-logout, biometría | ✅ |
| 2 | Multimoneda + líneas de detalle por compra (manual) | ✅ |
| 3 | Planes de ahorro + presupuestos + reportes/gráficos | ✅ |
| 4 | Backups manual + automático cifrados y versionados | ✅ |
| 5 | OCR de tickets (ML Kit on-device) + pantalla de revisión | ✅ |
| 6 | Endurecimiento (cambio de PIN, auto-logout config., borrado, DolarApi) | ✅ |

> Extras opcionales que quedan fuera de alcance por ahora: auditoría MASVS
> automatizada en CI (MobSF) y backup a la nube (Google Drive). El backup local
> cifrado y el export portable ya cubren la recuperación ante desastre.

La Etapa 5 (OCR de tickets con ML Kit on-device) reutiliza el editor de líneas
de detalle (`src/components/LineItemsEditor.tsx`): el OCR sólo precarga las filas
y el usuario revisa/corrige antes de confirmar.

Los reportes usan gráficos basados en Views (`src/components/charts.tsx`) para
no arrastrar dependencias nativas. Si más adelante se necesitan gráficos
interactivos (tooltips, gestos), la ruta de mejora es **Victory Native (XL)**
sobre Skia.
