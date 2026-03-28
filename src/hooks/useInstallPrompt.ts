// ==========================
// Version 2 - src/hooks/useInstallPrompt.ts
// - Captures beforeinstallprompt
// - Tracks platform mode + install method
// - Keeps dismissal session-only
// ==========================

import { useCallback, useEffect, useMemo, useState } from "react";
import { useDevice } from "./useDevice";
import type { DeviceInfo } from "../types/device";

type BIPEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

export type InstallMode =
  | "android"
  | "ios"
  | "desktop-windows"
  | "desktop-macos"
  | "unsupported";

export type InstallMethod = "native" | "manual" | "unsupported";

export type InstallPromptState = {
  device: DeviceInfo;
  mode: InstallMode;
  method: InstallMethod;
  isInstalled: boolean;
  isDismissed: boolean;
  canPromptNative: boolean;
  shouldShowIosHowTo: boolean;
  promptInstall: () => Promise<"accepted" | "dismissed" | "unavailable">;
  dismiss: () => void;
  resetDismissal: () => void;
};

export function useInstallPrompt(): InstallPromptState {
  const device = useDevice();
  const [bipEvent, setBipEvent] = useState<BIPEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);

  const isInstalled = device.isStandalone;
  const shouldShowIosHowTo = device.os === "ios" && !isInstalled && !dismissed;

  useEffect(() => {
    if (typeof window === "undefined") return;

    function onBeforeInstallPrompt(ev: Event) {
      (ev as any).preventDefault?.();
      setBipEvent(ev as BIPEvent);
    }

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt as any);
    return () => window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt as any);
  }, []);

  useEffect(() => {
    if (isInstalled) setBipEvent(null);
  }, [isInstalled]);

  const canPromptNative = Boolean(bipEvent) && !isInstalled && !dismissed;

  const mode: InstallMode = useMemo(() => {
    if (device.os === "android") return "android";
    if (device.os === "ios") return "ios";
    if (device.os === "desktop" && device.desktopPlatform === "windows") return "desktop-windows";
    if (device.os === "desktop" && device.desktopPlatform === "macos") return "desktop-macos";
    return "unsupported";
  }, [device.os, device.desktopPlatform]);

  const method: InstallMethod = useMemo(() => {
    if (canPromptNative) return "native";
    if (mode === "ios") return "manual";

    if (mode === "android") {
      return device.browser === "chrome" || device.browser === "edge" ? "manual" : "unsupported";
    }

    if (mode === "desktop-windows") {
      return device.browser === "chrome" || device.browser === "edge" ? "manual" : "unsupported";
    }

    if (mode === "desktop-macos") {
      return device.browser === "chrome" || device.browser === "edge" || device.browser === "safari"
        ? "manual"
        : "unsupported";
    }

    return "unsupported";
  }, [canPromptNative, mode, device.browser]);

  const dismiss = useCallback(() => {
    setDismissed(true);
  }, []);

  const resetDismissal = useCallback(() => {
    setDismissed(false);
  }, []);

  const promptInstall = useCallback(async () => {
    if (!bipEvent) return "unavailable";

    try {
      await bipEvent.prompt();
      const choice = await bipEvent.userChoice;
      setBipEvent(null);

      if (choice?.outcome === "accepted") return "accepted";
      return "dismissed";
    } catch {
      return "unavailable";
    }
  }, [bipEvent]);

  return useMemo(
    () => ({
      device,
      mode,
      method,
      isInstalled,
      isDismissed: dismissed,
      canPromptNative,
      shouldShowIosHowTo,
      promptInstall,
      dismiss,
      resetDismissal,
    }),
    [
      device,
      mode,
      method,
      isInstalled,
      dismissed,
      canPromptNative,
      shouldShowIosHowTo,
      promptInstall,
      dismiss,
      resetDismissal,
    ]
  );
}

// ==========================
// End of Version 2 - src/hooks/useInstallPrompt.ts
// ==========================
