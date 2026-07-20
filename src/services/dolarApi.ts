/**
 * Optional online exchange-rate refresh via DolarApi (Uruguay).
 *
 * The app is offline-first: this is a convenience only. It must never block
 * anything — callers cache the last rate and fall back to manual entry.
 *
 * Endpoint: https://uy.dolarapi.com/v1/cotizaciones/usd (MIT, no auth).
 * Caveat: its USD source is BROU, not the official BCU close, so it differs
 * slightly from the interbank/official rate.
 */

export interface UsdQuote {
  compra: number;
  venta: number;
  /** ISO date/time string from the API. */
  fecha: string;
}

const URL = 'https://uy.dolarapi.com/v1/cotizaciones/usd';
const TIMEOUT_MS = 8000;

export async function fetchUsdQuote(): Promise<UsdQuote> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(URL, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) {
      throw new Error(`Respuesta del servidor: ${res.status}`);
    }
    const data = (await res.json()) as {
      compra?: number;
      venta?: number;
      fechaActualizacion?: string;
    };
    if (typeof data.venta !== 'number' || typeof data.compra !== 'number') {
      throw new Error('Datos de cotización inválidos.');
    }
    return {
      compra: data.compra,
      venta: data.venta,
      fecha: data.fechaActualizacion ?? new Date().toISOString(),
    };
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') {
      throw new Error('La consulta tardó demasiado. Reintentá con conexión.');
    }
    throw new Error(
      'No se pudo obtener la cotización online. Ingresá la tasa manualmente.',
    );
  } finally {
    clearTimeout(timer);
  }
}
