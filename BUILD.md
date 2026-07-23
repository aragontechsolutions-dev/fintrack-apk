# Guía de compilación y ejecución (Android)

FinTrack usa módulos nativos (SQLCipher, criptografía, biometría, OCR ML Kit,
tareas en background), por lo que **no corre en Expo Go**: hay que generar un
**development build**. Esta guía asume que ya tenés **Android Studio, Node y
npm** instalados.

---

## 1. Verificar prerrequisitos

```bash
node -v      # 18+ (idealmente 20)
npm -v
java -version   # debe ser 17 (ver más abajo)
```

### Java 17 (JDK)
React Native 0.76 requiere **JDK 17**. Android Studio ya trae uno (JBR). Si
`java -version` no muestra 17, apuntá `JAVA_HOME` al JBR de Android Studio:

- **Linux:** `export JAVA_HOME=~/android-studio/jbr`
- **macOS:** `export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"`
- **Windows (PowerShell):** `$env:JAVA_HOME="C:\Program Files\Android\Android Studio\jbr"`

### Android SDK
Abrí **Android Studio → Settings → Languages & Frameworks → Android SDK** y en
**SDK Platforms** instalá **Android 15 (API 35)** (o 14/API 34). En **SDK Tools**
marcá y aplicá:

- Android SDK Build-Tools
- Android SDK Platform-Tools
- **NDK (Side by side)** ← necesario para compilar `react-native-argon2` (C nativo)
- **CMake** ← también para el build nativo
- Android Emulator (si vas a usar emulador)

### Variables de entorno
Agregá a tu shell (`~/.bashrc`, `~/.zshrc` o variables de sistema en Windows):

```bash
export ANDROID_HOME=$HOME/Android/Sdk          # macOS: $HOME/Library/Android/sdk
export PATH=$PATH:$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator
```

Verificá:

```bash
adb --version
```

---

## 2. Clonar el proyecto

```bash
git clone <URL-del-repo> fintrack-apk
cd fintrack-apk
git checkout claude/android-finance-app-dev-fx372e
```

---

## 3. Instalar dependencias

```bash
npm install
```

Luego, alineá versiones nativas con el SDK de Expo y revisá el proyecto (esto
requiere conexión):

```bash
npx expo install --check     # acepta los ajustes de versión que sugiera
npx expo-doctor              # 0 problemas ideal; ver notas al final
```

---

## 4. Preparar un dispositivo

### Opción A — Dispositivo físico (recomendado)
Mejor para probar **cámara/OCR, biometría y Google Play Services**.

1. En el teléfono: **Ajustes → Acerca del teléfono → tocar "Número de compilación" 7 veces** para activar Opciones de desarrollador.
2. **Opciones de desarrollador → Depuración USB: ON**.
3. Conectá por USB y aceptá el diálogo de autorización.
4. Verificá: `adb devices` (debe listar tu equipo).

### Opción B — Emulador
1. Android Studio → **Device Manager → Create Device**.
2. Elegí un teléfono y una imagen de sistema **con Google Play** (importante para
   ML Kit / OCR).
3. Iniciá el emulador.

> Nota: el OCR y la biometría funcionan mejor en dispositivo físico. En emulador,
> usá una imagen "Google Play" y configurá una huella en los ajustes del AVD.

---

## 5. Compilar y ejecutar (build local)

```bash
npx expo run:android
```

Esto hace el `prebuild` (genera la carpeta `android/`), compila con Gradle,
instala la app y arranca Metro. **La primera vez tarda varios minutos** (baja
Gradle y compila el código nativo de cripto).

Cuando termine, la app se abre sola. Para las siguientes sesiones (sin recompilar
nativo) alcanza con:

```bash
npx expo start --dev-client
```

y abrir la app ya instalada.

---

## 6. Alternativa: build en la nube con EAS

Si no querés compilar localmente:

```bash
npm install -g eas-cli
eas login
eas build --profile development --platform android
```

Descargá el APK que genera, instalalo en el dispositivo y luego
`npx expo start --dev-client`.

Para un APK instalable de prueba (sin cuenta de dev, tipo "preview"):

```bash
eas build --profile preview --platform android
```

---

## 7. Generar un APK para compartir (sin EAS)

Después de un `npx expo run:android` (que ya creó `android/`):

```bash
cd android
./gradlew assembleRelease     # requiere configurar firma; o assembleDebug para pruebas
```

El APK queda en `android/app/build/outputs/apk/`. Para release firmado, configurá
un keystore (ver docs de Android/Expo). Para probar rápido alcanza `assembleDebug`.

---

## 8. Primer uso

1. Al abrir por primera vez: **onboarding** → creá tu perfil (nombre + PIN).
   **Recordá el PIN**: sin él, los datos cifrados no se recuperan.
2. Creá una **cuenta** (Inicio → Cuentas) y empezá a cargar movimientos.
3. Permisos: la primera vez que uses **Escanear ticket** pedirá cámara, y la
   biometría pedirá autenticación.

---

## Problemas frecuentes

| Síntoma | Causa / solución |
|---|---|
| `SDK location not found` | Falta `ANDROID_HOME`. Definila (paso 1) o creá `android/local.properties` con `sdk.dir=/ruta/al/Sdk`. |
| Falla el build nativo de cripto / CMake / NDK | Instalá **NDK (Side by side)** y **CMake** desde SDK Tools (paso 1). |
| `Unsupported class file major version` / errores de Gradle | Java incorrecto. Usá **JDK 17** (`JAVA_HOME` al JBR). |
| `adb: no devices` | Emulador apagado o USB sin autorizar. `adb devices` para confirmar. |
| OCR devuelve vacío o error de ML Kit | Usá dispositivo/emulador **con Google Play Services**. |
| La app no respalda en background a horario exacto | Es esperado: Android (WorkManager) es best-effort. El backup oportunista al abrir la app es el camino confiable. |
| `2 files found with path 'lib/arm64-v8a/libcrypto.so'` | Choque de OpenSSL entre librerías. Ya resuelto (el cifrado usa `@noble/ciphers` en JS puro, sin OpenSSL nativo). Si aparece con un build viejo: `npx expo prebuild --clean` y recompilá. |
| `Compose Compiler requires Kotlin version 1.9.25 but ... 1.9.24` | Ya resuelto: `expo-build-properties` fija `android.kotlinVersion=1.9.25` en `app.json`. Si aparece, `npx expo prebuild --clean` y recompilá. |
| Build se rompe tras `npm audit fix --force` (Expo saltó a 57, errores de Kotlin 2.2, etc.) | **Nunca** corras `npm audit fix --force` en este proyecto. Restaurá: `git checkout -- package.json package-lock.json`, borrá `node_modules` y `android`, `npm install`, `npx expo prebuild --clean`. Las 23 "vulnerabilidades" son de herramientas de build, no van en el APK: ignoralas. |
| `expo-doctor` marca versiones | Corré `npx expo install --check` y aceptá los ajustes. |
| Cambios en JS no se reflejan | Recargá Metro (tecla `r`) o reiniciá `npx expo start --dev-client -c`. |

---

## Notas del proyecto

- **New Architecture está desactivada** (`app.json`) para máxima compatibilidad de
  `react-native-argon2`. Se puede activar más adelante tras verificar esa
  librería en tus dispositivos.
- El **parser de OCR** (`src/ocr/parseReceipt.ts`) es un punto de partida:
  ajustalo probando con tickets uruguayos reales (los tests cubren un caso
  representativo).
- La carpeta `android/` se genera con `prebuild` y está en `.gitignore`; podés
  borrarla y regenerarla con `npx expo prebuild --clean` si algo se corrompe.
