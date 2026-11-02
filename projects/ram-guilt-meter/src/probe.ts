// Everything the browser is willing to tell us about memory.

export type Browser = "chrome" | "edge" | "firefox" | "safari" | "other";

export interface Probe {
  browser: Browser;
  /** navigator.deviceMemory: Chromium only, rounded down, capped at 8. */
  deviceMemory?: number;
  cores?: number;
  /** performance.memory.usedJSHeapSize in MB: Chromium only, this tab's JS heap. */
  jsHeapMb?: number;
  /** Whether performance.measureUserAgentSpecificMemory() can run (needs cross-origin isolation). */
  canMeasure: boolean;
}

interface ChromiumPerformance extends Performance {
  memory?: { usedJSHeapSize: number };
  measureUserAgentSpecificMemory?: () => Promise<{ bytes: number }>;
}

const perf = () => performance as ChromiumPerformance;

export function detectBrowser(ua: string): Browser {
  if (/Edg\//.test(ua)) return "edge";
  if (/Firefox\//.test(ua)) return "firefox";
  if (/Chrome\/|CriOS\//.test(ua)) return "chrome";
  if (/Safari\//.test(ua)) return "safari";
  return "other";
}

export function probe(): Probe {
  const nav = navigator as Navigator & { deviceMemory?: number };
  const heap = perf().memory?.usedJSHeapSize;
  return {
    browser: detectBrowser(nav.userAgent),
    deviceMemory: typeof nav.deviceMemory === "number" ? nav.deviceMemory : undefined,
    cores: nav.hardwareConcurrency || undefined,
    jsHeapMb: heap ? heap / 1024 ** 2 : undefined,
    canMeasure: Boolean(globalThis.crossOriginIsolated && perf().measureUserAgentSpecificMemory),
  };
}

/** Asks Chromium for this page's full memory footprint. The result arrives after the next GC, so it can take a while. */
export async function measurePageMb(timeoutMs = 30_000): Promise<number | undefined> {
  const measure = perf().measureUserAgentSpecificMemory;
  if (!globalThis.crossOriginIsolated || !measure) return undefined;
  try {
    const result = await Promise.race([
      measure.call(performance),
      new Promise<undefined>((resolve) => setTimeout(resolve, timeoutMs, undefined)),
    ]);
    return result ? result.bytes / 1024 ** 2 : undefined;
  } catch {
    return undefined;
  }
}
