// ==========================
// Version 1 — src/types/device.ts
// - Shared device detection types for tutorials + install prompt logic
// ==========================

export type DeviceOS = "ios" | "android" | "desktop" | "unknown";
export type DeviceBrowser = "safari" | "chrome" | "firefox" | "edge" | "other";
export type DeviceDesktopPlatform = "windows" | "macos" | "linux" | "other" | "unknown";

export type DeviceInfo = {
  os: DeviceOS;
  browser: DeviceBrowser;
  desktopPlatform: DeviceDesktopPlatform;

  // PWA context
  isStandalone: boolean; // launched as installed app (or iOS "standalone")
  displayMode: "standalone" | "browser" | "unknown";

  // Install prompt support (Android Chrome only)
  canShowInstallPrompt: boolean;

  // Raw info (debug-friendly)
  userAgent: string;
};

// ==========================
// End of Version 1 — src/types/device.ts
// ==========================
