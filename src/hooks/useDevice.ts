// ==========================
// Version 1 — src/hooks/useDevice.ts
// - Best-effort OS/browser detection for desktop/android/iOS
// - Detects PWA standalone mode
// - Captures "beforeinstallprompt" availability (Android Chrome)
// ==========================

import { useEffect, useMemo, useState } from "react";
import type { DeviceBrowser, DeviceDesktopPlatform, DeviceInfo, DeviceOS } from "../types/device";

function getUA(): string {
  if (typeof navigator === "undefined") return "";
  return navigator.userAgent || "";
}

function detectOS(ua: string): DeviceOS {
  const uaL = ua.toLowerCase();

  // Android is straightforward
  if (uaL.includes("android")) return "android";

  // iOS detection:
  // - iPhone/iPad/iPod in UA OR iPadOS masquerading as Mac (Macintosh + touch points)
  const isAppleMobile =
    /iphone|ipad|ipod/i.test(ua) ||
    (uaL.includes("macintosh") && typeof navigator !== "undefined" && (navigator as any).maxTouchPoints > 1);

  if (isAppleMobile) return "ios";

  // Desktop fallback
  if (ua) return "desktop";
  return "unknown";
}

function detectBrowser(ua: string): DeviceBrowser {
  const uaL = ua.toLowerCase();

  // Edge before Chrome (Edge UA includes "chrome")
  if (uaL.includes("edg/")) return "edge";

  // Firefox
  if (uaL.includes("firefox/")) return "firefox";

  // Chrome (includes CriOS on iOS)
  if (uaL.includes("chrome/") || uaL.includes("crios/")) return "chrome";

  // Safari (iOS Safari + macOS Safari)
  // (Chrome on iOS uses WebKit but UA includes CriOS, so it’s already caught)
  if (uaL.includes("safari/")) return "safari";

  return "other";
}

function detectDesktopPlatform(ua: string, os: DeviceOS): DeviceDesktopPlatform {
  if (os !== "desktop") return "unknown";

  const uaL = ua.toLowerCase();
  if (uaL.includes("windows")) return "windows";
  if (uaL.includes("macintosh") || uaL.includes("mac os x")) return "macos";
  if (uaL.includes("linux")) return "linux";
  if (ua) return "other";
  return "unknown";
}

function detectStandalone(): { isStandalone: boolean; displayMode: "standalone" | "browser" | "unknown" } {
  if (typeof window === "undefined") return { isStandalone: false, displayMode: "unknown" };

  // Standard PWA display-mode media query
  const mm = window.matchMedia ? window.matchMedia("(display-mode: standalone)") : null;
  const displayModeStandalone = Boolean(mm && mm.matches);

  // iOS Safari legacy standalone flag
  const navAny: any = navigator as any;
  const iosStandalone = Boolean(navAny && navAny.standalone);

  const isStandalone = displayModeStandalone || iosStandalone;
  return { isStandalone, displayMode: isStandalone ? "standalone" : "browser" };
}

export function useDevice(): DeviceInfo {
  const [canShowInstallPrompt, setCanShowInstallPrompt] = useState(false);

  const ua = useMemo(() => getUA(), []);
  const os = useMemo(() => detectOS(ua), [ua]);
  const browser = useMemo(() => detectBrowser(ua), [ua]);
  const desktopPlatform = useMemo(() => detectDesktopPlatform(ua, os), [ua, os]);

  const { isStandalone, displayMode } = useMemo(() => detectStandalone(), []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // beforeinstallprompt is mainly Android Chrome/Edge.
    // We just use it as "support exists", not to store the event yet (Step 2).
    function onBIP() {
      // Don’t preventDefault here yet — we’ll do that later in install prompt step.
      setCanShowInstallPrompt(true);
    }

    window.addEventListener("beforeinstallprompt", onBIP as any);
    return () => window.removeEventListener("beforeinstallprompt", onBIP as any);
  }, []);

  return {
    os,
    browser,
    desktopPlatform,
    isStandalone,
    displayMode,
    canShowInstallPrompt,
    userAgent: ua,
  };
}

// ==========================
// End of Version 1 — src/hooks/useDevice.ts
// ==========================
