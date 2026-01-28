declare module "virtual:pwa-register" {
  export type RegisterSWOptions = {
    immediate?: boolean;
    onRegistered?: (swUrl: string, reg: ServiceWorkerRegistration | undefined) => void;
    onRegisterError?: (error: unknown) => void;
    onNeedRefresh?: () => void;
    onOfflineReady?: () => void;
  };

  export function registerSW(options?: RegisterSWOptions): (reloadPage?: boolean) => Promise<void>;
}
