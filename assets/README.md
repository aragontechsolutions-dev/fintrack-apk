# Iconos de la app

- **`icon.png`** (1024×1024) — ícono principal (iOS y base en Android). Fondo
  verde degradé opaco con el emblema centrado.
- **`adaptive-icon.png`** (1024×1024) — capa de primer plano del ícono
  adaptativo de Android (transparente; el emblema queda dentro del área segura).
  El color de fondo del ícono adaptativo se define en `app.json`
  (`android.adaptiveIcon.backgroundColor`).
- **`logo-source.svg`** — fuente vectorial editable del logo (brote creciendo
  desde una pila de monedas = "el ahorro que crece").

## Cambiar el logo

Editá `logo-source.svg` y volvé a rasterizar a PNG (1024×1024) con la
herramienta que prefieras (Inkscape, un conversor online, `resvg`, etc.),
sobrescribiendo `icon.png` y `adaptive-icon.png`. Para el `adaptive-icon.png`
usá una versión con el emblema un poco más chico (área segura ≈ 66% central) y
fondo transparente.

Los iconos se generan durante el `prebuild`, así que después:

```bash
npx expo prebuild --clean
npx expo run:android
```
