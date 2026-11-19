/**
 * Ponte con l'app Android (Capacitor). Nel browser non fa niente di speciale;
 * dentro l'APK salva i file con il foglio "Condividi" e gestisce il tasto indietro.
 * Usa i plugin che l'APK espone su window.Capacitor, senza importare pacchetti nel sito.
 */

type Listener = { remove: () => Promise<void> | void };
type Plugin = Record<string, (...args: never[]) => Promise<unknown>> & {
  addListener?: (event: string, cb: (data: { canGoBack: boolean; url?: string }) => void) => Promise<Listener> | Listener;
};
type Capacitor = {
  isNativePlatform?: () => boolean;
  Plugins?: Record<string, Plugin | undefined>;
  registerPlugin?: (name: string) => Plugin;
};

function cap(): Capacitor | undefined {
  if (typeof window === "undefined") return undefined;
  return (window as unknown as { Capacitor?: Capacitor }).Capacitor;
}

export function isNativeApp() {
  return Boolean(cap()?.isNativePlatform?.());
}

function plugin(name: string): Plugin | undefined {
  const c = cap();
  if (!c) return undefined;
  return c.Plugins?.[name] ?? c.registerPlugin?.(name);
}

function toBase64(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

/** Salva un file: nel browser lo scarica, nell'app apre "Condividi" (Galleria, Drive, WhatsApp…). */
export async function saveFile(blob: Blob, name: string) {
  if (isNativeApp()) {
    type Fs = {
      writeFile: (o: { path: string; data: string; directory: string }) => Promise<{ uri: string }>;
      appendFile?: (o: { path: string; data: string; directory: string }) => Promise<void>;
      getUri?: (o: { path: string; directory: string }) => Promise<{ uri: string }>;
    };
    const fs = plugin("Filesystem") as unknown as Fs | undefined;
    const share = plugin("Share") as unknown as { share: (o: { title: string; files: string[] }) => Promise<unknown> } | undefined;
    if (fs && share) {
      let uri: string;
      // un video di qualche MB in base64 in un colpo solo blocca l'app: lo scrivo a pezzi (multipli di 3 byte)
      const CHUNK = 3 * 256 * 1024;
      if (blob.size > CHUNK && fs.appendFile) {
        uri = (await fs.writeFile({ path: name, data: await toBase64(blob.slice(0, CHUNK)), directory: "CACHE" })).uri;
        for (let at = CHUNK; at < blob.size; at += CHUNK) {
          await fs.appendFile({ path: name, data: await toBase64(blob.slice(at, at + CHUNK)), directory: "CACHE" });
        }
      } else {
        uri = (await fs.writeFile({ path: name, data: await toBase64(blob), directory: "CACHE" })).uri;
      }
      try {
        await share.share({ title: name, files: [uri] });
      } catch {
        /* condivisione annullata: il file resta comunque nella cache */
      }
      return;
    }
  }
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(a.href), 60_000);
}

let started = false;

/** Login con Google dall'app: si apre il browser del telefono sulla pagina di passaggio. */
export async function googleViaBrowser() {
  const browser = plugin("Browser") as unknown as { open: (o: { url: string }) => Promise<void> } | undefined;
  const url = `${window.location.origin}/accesso-google`;
  try {
    if (browser) await browser.open({ url });
    else window.open(url, "_system");
    return true;
  } catch {
    return false;
  }
}

/** Il browser ha finito con Google e rimanda qui: scambio il gettone con la sessione dell'app. */
async function finishGoogle(link: string) {
  let token = "";
  try {
    token = new URL(link).searchParams.get("ott") ?? "";
  } catch {
    return;
  }
  if (!token) return;
  const browser = plugin("Browser") as unknown as { close: () => Promise<void> } | undefined;
  try {
    await browser?.close();
  } catch {
    /* già chiuso */
  }
  const res = await fetch("/api/auth/one-time-token/verify", {
    method: "POST",
    credentials: "include",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ token }),
  });
  window.location.href = res.ok ? "/" : "/login";
}

/** Tasto indietro di Android: torna alla pagina precedente, e chiude l'app solo dalla prima. */
export function initNativeApp() {
  if (started || !isNativeApp()) return;
  started = true;
  const app = plugin("App");
  if (!app?.addListener) return;
  void app.addListener("appUrlOpen", (data) => {
    const url = (data as unknown as { url?: string }).url ?? "";
    if (url.startsWith("arcieriamiconi://")) void finishGoogle(url);
  });
  void app.addListener("backButton", ({ canGoBack }) => {
    if (canGoBack && window.history.length > 1) window.history.back();
    else void (app.exitApp as unknown as () => Promise<void>)?.();
  });
}

/** Apre un link fuori dall'app (WhatsApp, siti): nell'app Android passa dal browser di sistema. */
export async function openExternal(url: string) {
  const browser = plugin("Browser") as unknown as { open: (o: { url: string }) => Promise<void> } | undefined;
  if (isNativeApp() && browser) {
    try {
      await browser.open({ url });
      return;
    } catch {
      /* si prova col metodo del browser */
    }
  }
  const win = window.open(url, "_blank", "noopener");
  if (!win) window.location.href = url;
}

export const SITE_URL = "https://arcieri-amiconi.vercel.app";
export const APK_URL = "https://github.com/viktorresan-commits/arcieri-amiconi/releases/latest/download/arcieri-amiconi.apk";

/** Messaggio di invito per WhatsApp. */
export function inviteText(name?: string, code?: string) {
  return [
    `Ciao${name ? ` ${name}` : ""}! Ti invito negli *Arcieri Amiconi* 🏹`,
    "",
    `Apri l'app: ${SITE_URL}`,
    `Android (APK): ${APK_URL}`,
    "",
    code ? `Registrati con nome utente e password, poi nel profilo usa il codice *${code}* per prendere il tuo posto in squadra.` : "Registrati con nome utente e password e sei subito in squadra.",
  ].join("\n");
}

export function whatsappLink(text: string) {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}
