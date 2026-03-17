// ==========================
// Version 2 - src/components/InstallPromptModal.tsx
// - Install modal with explicit platform modes and install methods
// - Supports Android, iOS, Windows, macOS, and unsupported devices
// ==========================

import type { DeviceInfo } from "../types/device";
import type { InstallMethod, InstallMode } from "../hooks/useInstallPrompt";

export default function InstallPromptModal({
  open,
  device,
  mode,
  method,
  onClose,
  onInstall,
  installing,
}: {
  open: boolean;
  device: DeviceInfo;
  mode: InstallMode;
  method: InstallMethod;
  onClose: () => void;
  onInstall?: () => void;
  installing?: boolean;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-end justify-center p-4 sm:items-center">
      <button
        aria-label="Close install modal"
        onClick={onClose}
        className="absolute inset-0 bg-black/60"
      />

      <div
        className="relative w-full max-w-md overflow-hidden rounded-2xl border border-white/14 bg-[#0b0c24]/92 backdrop-blur-2xl shadow-[0_44px_110px_-70px_rgba(0,0,0,0.98)]"
      >
        <div className="p-5 sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-sm font-semibold text-white">Install BadAss Habits</div>
              <div className="mt-1 text-xs text-white/60">
                Faster launch, full-screen experience, and more reliable reminders.
              </div>
            </div>

            <button
              onClick={onClose}
              className="shrink-0 rounded-xl border border-white/14 bg-white/[0.08] px-3 py-1.5 text-xs font-semibold text-white/80 hover:bg-white/[0.12]"
            >
              Not now
            </button>
          </div>

          {method === "native" ? (
            <>
              <div className="mt-4 rounded-xl border border-white/12 bg-white/[0.06] p-4 text-xs text-white/70">
                <div className="font-semibold text-white/85">This device supports one-tap install.</div>
                <div className="mt-1">Click install and follow the browser prompt.</div>
                <div className="mt-2 text-white/45">
                  Detected: {mode} • {device.browser}
                </div>
              </div>

              <button
                onClick={onInstall}
                disabled={!onInstall || installing}
                className="mt-4 w-full rounded-xl border border-white/14 bg-white/[0.12] px-4 py-3 text-sm font-semibold text-white hover:bg-white/[0.16] disabled:opacity-60"
              >
                {installing ? "Opening install..." : "Install"}
              </button>

              <div className="mt-3 text-[11px] text-white/45">
                If you do not see the prompt, try the browser menu and look for "Install app".
              </div>
            </>
          ) : method === "manual" && mode === "ios" ? (
            <>
              <div className="mt-4 rounded-xl border border-white/12 bg-white/[0.06] p-4 text-xs text-white/70">
                <div className="font-semibold text-white/85">How to install on iPhone/iPad</div>
                <ol className="mt-2 list-inside list-decimal space-y-2 text-white/70">
                  <li>Open this app in Safari.</li>
                  <li>Tap the Share button.</li>
                  <li>Choose Add to Home Screen.</li>
                  <li>Open the app from your Home Screen.</li>
                </ol>
                <div className="mt-2 text-white/45">iOS does not support the one-tap install prompt.</div>
              </div>

              <button
                onClick={onClose}
                className="mt-4 w-full rounded-xl border border-white/14 bg-white/[0.10] px-4 py-3 text-sm font-semibold text-white hover:bg-white/[0.14]"
              >
                Got it
              </button>
            </>
          ) : method === "manual" && mode === "android" ? (
            <>
              <div className="mt-4 rounded-xl border border-white/12 bg-white/[0.06] p-4 text-xs text-white/70">
                <div className="font-semibold text-white/85">Install on Android</div>
                <div className="mt-1">
                  Open the browser menu and choose Install app or Add to Home screen.
                </div>
                <div className="mt-2 text-white/45">Detected: Android • {device.browser}</div>
              </div>

              <button
                onClick={onClose}
                className="mt-4 w-full rounded-xl border border-white/14 bg-white/[0.10] px-4 py-3 text-sm font-semibold text-white hover:bg-white/[0.14]"
              >
                Got it
              </button>
            </>
          ) : method === "manual" && mode === "desktop-windows" ? (
            <>
              <div className="mt-4 rounded-xl border border-white/12 bg-white/[0.06] p-4 text-xs text-white/70">
                <div className="font-semibold text-white/85">Install on Windows</div>
                <div className="mt-1">
                  In Chrome or Edge, use the install icon in the address bar or open the browser menu and choose Install app.
                </div>
                <div className="mt-2 text-white/45">Detected: Windows • {device.browser}</div>
              </div>

              <button
                onClick={onClose}
                className="mt-4 w-full rounded-xl border border-white/14 bg-white/[0.10] px-4 py-3 text-sm font-semibold text-white hover:bg-white/[0.14]"
              >
                Got it
              </button>
            </>
          ) : method === "manual" && mode === "desktop-macos" ? (
            <>
              <div className="mt-4 rounded-xl border border-white/12 bg-white/[0.06] p-4 text-xs text-white/70">
                <div className="font-semibold text-white/85">Install on macOS</div>
                <div className="mt-1">
                  In Chrome or Edge, use the install icon in the address bar or open the browser menu and choose Install app.
                </div>
                <div className="mt-2 text-white/45">Detected: macOS • {device.browser}</div>
              </div>

              <button
                onClick={onClose}
                className="mt-4 w-full rounded-xl border border-white/14 bg-white/[0.10] px-4 py-3 text-sm font-semibold text-white hover:bg-white/[0.14]"
              >
                Got it
              </button>
            </>
          ) : (
            <>
              <div className="mt-4 rounded-xl border border-white/12 bg-white/[0.06] p-4 text-xs text-white/70">
                <div className="font-semibold text-white/85">Install is not available here</div>
                <div className="mt-1">
                  This browser/device combination does not currently support a reliable install flow for this app.
                </div>
                <div className="mt-2 text-white/45">
                  Try Chrome or Edge on Windows/Android, or Safari on iPhone/iPad.
                </div>
              </div>

              <button
                onClick={onClose}
                className="mt-4 w-full rounded-xl border border-white/14 bg-white/[0.10] px-4 py-3 text-sm font-semibold text-white hover:bg-white/[0.14]"
              >
                Got it
              </button>
            </>
          )}

          <div className="mt-4 text-[11px] text-white/45">
            We will keep reminding you until the app is installed.
          </div>
        </div>
      </div>
    </div>
  );
}

// ==========================
// End of Version 2 - src/components/InstallPromptModal.tsx
// ==========================
