import { useEffect, useState } from "react";
import { GROK_PROVIDERS, type GrokProvider } from "./providers";

/**
 * Google e X passano dal servizio di accesso di Grok: li mostro solo quando l'app
 * è aperta da un dominio Grok. Altrove (Vercel, APK) si entra con utente e password.
 */
export function useOauthProviders(): readonly GrokProvider[] {
  const [list, setList] = useState<readonly GrokProvider[]>([]);
  useEffect(() => {
    const host = window.location.hostname;
    if (/(^|\.)grok\.me$|grok-sandbox\.com$|app-builder-testing\.com$/.test(host)) setList(GROK_PROVIDERS);
  }, []);
  return list;
}
