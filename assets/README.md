# Iconos de la app

Estos archivos definen el ícono de FinTrack. Hoy son un **placeholder** (un
cuadrado verde de la marca). Reemplazalos por el logo real:

## Cómo poner tu logo

1. **`icon.png`** — el logo completo, **1024×1024 px, PNG con fondo
   transparente**. Se usa como ícono principal (iOS y como base en Android).
   Guardá tu imagen encima de este archivo (mismo nombre).

2. **`adaptive-icon.png`** — ícono adaptativo de Android (la máscara lo recorta
   en círculo/squircle). **Importante:** el área segura es el ~66% central, así
   que si tu logo tiene texto abajo (p. ej. "FINANZAS PERSONALES"), ese texto se
   va a recortar. Para que se vea bien, poné acá **solo el emblema** (el
   escudo + planta + monedas), centrado, sin el texto, 1024×1024 con fondo
   transparente. El fondo del ícono adaptativo se controla con
   `android.adaptiveIcon.backgroundColor` en `app.json` (hoy `#FFFFFF`).

## Después de reemplazar

Los íconos se generan durante el `prebuild`, así que hay que regenerar y
recompilar:

```bash
npx expo prebuild --clean
npx expo run:android
```
