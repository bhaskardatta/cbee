// src/hooks/useNetwork.ts
//
// Tiny wrapper over `@capacitor/network` + the Network Information API
// for components that need to react to the current connection type
// (wifi vs cellular vs offline). `OfflineDetector.tsx` only cares about
// connected/disconnected; the reels feed needs to distinguish wifi from
// cellular so it can switch the `<video preload>` attribute.

import { useEffect, useState } from "react";
import { Capacitor } from "@capacitor/core";

export type ConnectionType =
  | "wifi"
  | "cellular"
  | "none"
  | "unknown";

interface NetworkState {
  connectionType: ConnectionType;
  connected: boolean;
}

// Maps the @capacitor/network ConnectionType strings to our four buckets.
// CF's `wifi`/`cellular` map 1:1; `ethernet` and `unknown` we treat as wifi
// (assume the user has bandwidth); `none` is offline.
const mapNativeConnectionType = (t: string | undefined): ConnectionType => {
  switch (t) {
    case "wifi":
    case "ethernet":
      return "wifi";
    case "cellular":
      return "cellular";
    case "none":
      return "none";
    default:
      return "unknown";
  }
};

// Web fallback uses the experimental Network Information API. On browsers
// without it (Safari), we default to wifi — Safari users on real devices
// are usually on wifi anyway and `preload='metadata'` is a safe default.
const readWebConnectionType = (): ConnectionType => {
  if (typeof navigator === "undefined") return "unknown";
  if (!navigator.onLine) return "none";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const conn = (navigator as any).connection;
  if (!conn) return "wifi";
  const effectiveType: string | undefined = conn.effectiveType;
  // 4g/5g/slow-2g/3g → cellular. Network Information API doesn't expose
  // "wifi" reliably across browsers; cell signals are the only thing we
  // can detect with confidence.
  if (
    effectiveType === "4g" ||
    effectiveType === "5g" ||
    effectiveType === "3g" ||
    effectiveType === "2g" ||
    effectiveType === "slow-2g"
  ) {
    return "cellular";
  }
  return "wifi";
};

export const useNetwork = (): NetworkState => {
  const [state, setState] = useState<NetworkState>(() => ({
    connectionType: readWebConnectionType(),
    connected:
      typeof navigator === "undefined" ? true : navigator.onLine,
  }));

  useEffect(() => {
    let cleanup: (() => void) | undefined;

    if (Capacitor.isNativePlatform()) {
      (async () => {
        try {
          const { Network } = await import("@capacitor/network");
          const status = await Network.getStatus();
          setState({
            connectionType: mapNativeConnectionType(status.connectionType),
            connected: status.connected,
          });
          const handle = await Network.addListener(
            "networkStatusChange",
            (s) => {
              setState({
                connectionType: mapNativeConnectionType(s.connectionType),
                connected: s.connected,
              });
            },
          );
          cleanup = () => handle.remove();
        } catch (e) {
          console.warn("[useNetwork] native listener failed", e);
        }
      })();
    } else {
      const handleOnline = () =>
        setState({ connectionType: readWebConnectionType(), connected: true });
      const handleOffline = () =>
        setState({ connectionType: "none", connected: false });
      window.addEventListener("online", handleOnline);
      window.addEventListener("offline", handleOffline);
      cleanup = () => {
        window.removeEventListener("online", handleOnline);
        window.removeEventListener("offline", handleOffline);
      };
    }

    return () => cleanup?.();
  }, []);

  return state;
};
