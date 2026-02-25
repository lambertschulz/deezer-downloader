interface AppConfig {
  apiRoot: string;
  useMpd: boolean;
}

declare global {
  interface Window {
    __CONFIG__?: AppConfig;
  }
}

export function getConfig(): AppConfig {
  return window.__CONFIG__ ?? { apiRoot: "", useMpd: false };
}
