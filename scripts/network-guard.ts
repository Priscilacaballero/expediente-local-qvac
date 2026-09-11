import http from "node:http";
import https from "node:https";
import net from "node:net";
import tls from "node:tls";

type NetworkModule = Record<string, unknown>;

export type NetworkGuard = {
  attempts: string[];
  restore(): void;
};

function hostFrom(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  if (value && typeof value === "object") {
    const host = (value as Record<string, unknown>).host ?? (value as Record<string, unknown>).hostname;
    return typeof host === "string" ? host : undefined;
  }
  return undefined;
}

function isLoopback(host: string | undefined): boolean {
  return host === undefined || host === "127.0.0.1" || host === "::1" || host === "localhost";
}

/**
 * Blocks Node-owned outbound traffic while preserving loopback IPC used by the
 * local QVAC runtime. It is intentionally installed before importing QVAC.
 */
export function blockExternalNetwork(): NetworkGuard {
  const attempts: string[] = [];
  const restorers: Array<() => void> = [];
  const deny = (kind: string, host: string | undefined): never => {
    const destination = host ?? "unspecified-host";
    attempts.push(`${kind}:${destination}`);
    throw new Error(`External network blocked during local QVAC validation: ${kind}:${destination}`);
  };

  const replace = (target: NetworkModule, key: string, replacement: unknown) => {
    const original = target[key];
    target[key] = replacement;
    restorers.push(() => { target[key] = original; });
  };

  for (const [kind, module] of [["net.connect", net], ["net.createConnection", net], ["tls.connect", tls]] as const) {
    const key = kind.split(".")[1]!;
    const original = module[key as keyof typeof module] as (...args: unknown[]) => unknown;
    replace(module as unknown as NetworkModule, key, (...args: unknown[]) => {
      if (!isLoopback(hostFrom(args[0]))) return deny(kind, hostFrom(args[0]));
      return original(...args);
    });
  }

  for (const [kind, module] of [["http.request", http], ["https.request", https]] as const) {
    const key = "request";
    const original = module.request.bind(module);
    replace(module as unknown as NetworkModule, key, (...args: Parameters<typeof module.request>) => {
      const first = args[0] as unknown;
      const host = first instanceof URL ? first.hostname : hostFrom(first) ?? hostFrom(args[1]);
      if (!isLoopback(host)) return deny(kind, host);
      return original(...args);
    });
  }

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const url = typeof input === "string" || input instanceof URL ? new URL(input) : new URL(input.url);
    if (!isLoopback(url.hostname)) return deny("fetch", url.hostname);
    return originalFetch(input, init);
  };
  restorers.push(() => { globalThis.fetch = originalFetch; });

  return { attempts, restore: () => restorers.reverse().forEach((restore) => restore()) };
}
