# FinTrack

Aplicación Android nativa (React Native + Expo) de **finanzas personales**,
**offline-first**, multiusuario local y con la base de datos **cifrada** en el
dispositivo. Sin servidores: toda la seguridad recae en el cifrado en reposo y
el control de acceso local.

> Estado actual: **Etapa 0 (Fundaciones) + Etapa 1 (Multiusuario + núcleo
> financiero) completas**, más la base de multimoneda (Etapa 2 parcial). Ver
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
- **Dashboard**: saldo total por moneda, ingresos/gastos/balance del mes.
- **Seguridad**: base cifrada con SQLCipher, clave protegida por
  key-wrapping (Argon2id + AES-256-GCM), auto-logout por inactividad, bloqueo
  al pasar a segundo plano y bloqueo de capturas de pantalla.

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

---

## Estructura del proyecto

```
src/
  crypto/        Argon2id, AES-256-GCM, key-wrapping, random, secure store
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
- Auto-logout por inactividad + bloqueo al ir a segundo plano.
- Bloqueo de capturas de pantalla en sesión (`expo-screen-capture`).
- **Sin recuperación de contraseña:** si se olvida, los datos son
  irrecuperables. La app insiste en hacer backups (llegan en Etapa 4).

---

## Roadmap

| Etapa | Descripción | Estado |
|---|---|---|
| 0 | Fundaciones: dev build, SQLCipher+Drizzle, cripto (Argon2id/AES-GCM/key-wrapping) | ✅ |
| 1 | Multiusuario local, núcleo financiero (cuentas, categorías, transacciones, transferencias, saldos), auto-logout, biometría | ✅ |
| 2 | Multimoneda + líneas de detalle por compra | 🟡 (multimoneda base lista; falta detalle de ítems y OCR) |
| 3 | Planes de ahorro + presupuestos + reportes/gráficos | ⬜ (esquema listo) |
| 4 | Backups manual + automático cifrados y versionados | ⬜ |
| 5 | OCR de tickets (ML Kit on-device) + pantalla de revisión | ⬜ |
| 6 | Endurecimiento MASVS, tasa BCU/DolarApi opcional, backup a la nube | ⬜ |

Las tablas de ahorro, presupuestos y líneas de detalle **ya existen en el
esquema** (`src/db/schema.ts`), listas para construir sus pantallas.
