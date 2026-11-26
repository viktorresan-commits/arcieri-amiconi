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

/**
 * Condivide testo e (se c'è) un'immagine con il foglio «Condividi» del telefono:
 * WhatsApp (una persona o un gruppo), Instagram, Facebook, Telegram, e-mail…
 * «ok» condiviso, «cancel» chiuso dall'utente, «none» il dispositivo non sa condividere (si usa un'altra strada).
 */
export async function shareRich(o: { title: string; text?: string; file?: Blob; name?: string }): Promise<"ok" | "cancel" | "none"> {
  const name = o.name ?? "annuncio.jpg";
  if (isNativeApp()) {
    const share = plugin("Share") as unknown as { share: (x: { title?: string; text?: string; files?: string[]; dialogTitle?: string }) => Promise<unknown> } | undefined;
    const fs = plugin("Filesystem") as unknown as { writeFile: (x: { path: string; data: string; directory: string }) => Promise<{ uri: string }> } | undefined;
    if (share) {
      let files: string[] | undefined;
      if (o.file && fs) {
        try {
          files = [(await fs.writeFile({ path: name, data: await toBase64(o.file), directory: "CACHE" })).uri];
        } catch {
          files = undefined;
        }
      }
      try {
        await share.share({ title: o.title, text: o.text, files, dialogTitle: o.title });
        return "ok";
      } catch {
        return "cancel";
      }
    }
  }
  if (typeof navigator === "undefined" || typeof navigator.share !== "function") return "none";
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  const file = o.file ? new File([o.file], name, { type: o.file.type || "image/jpeg" }) : null;
  const withFile = file && nav.canShare?.({ files: [file] }) ? { files: [file], title: o.title, ...(o.text ? { text: o.text } : {}) } : null;
  if (o.file && !withFile && !o.text) return "none";
  try {
    await nav.share(withFile ?? { title: o.title, text: o.text });
    return "ok";
  } catch (e) {
    return e instanceof DOMException && e.name === "AbortError" ? "cancel" : "none";
  }
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

/** L'app a schermo intero: niente ora e batteria sopra l'intestazione. Se il plugin manca, lascio spazio alla barra. */
async function fullScreen() {
  const bar = plugin("StatusBar") as unknown as { hide?: () => Promise<void>; setOverlaysWebView?: (o: { overlay: boolean }) => Promise<void>; setBackgroundColor?: (o: { color: string }) => Promise<void> } | undefined;
  const root = document.documentElement;
  if (!bar?.hide) {
    root.classList.add("aa-statusbar");
    return;
  }
  try {
    await bar.setOverlaysWebView?.({ overlay: true });
    await bar.hide();
    root.classList.remove("aa-statusbar");
  } catch {
    root.classList.add("aa-statusbar");
  }
}

/** chi ha qualcosa aperto sopra la pagina (menu, fogli) lo chiude col tasto indietro prima di cambiare pagina */
const backStack: (() => boolean)[] = [];
export function onBack(fn: () => boolean) {
  backStack.push(fn);
  return () => {
    const i = backStack.lastIndexOf(fn);
    if (i >= 0) backStack.splice(i, 1);
  };
}

/** Tasto indietro di Android: chiude ciò che è aperto, poi torna alla pagina precedente; chiude l'app solo dalla prima. */
export function initNativeApp() {
  if (started || !isNativeApp()) return;
  started = true;
  document.documentElement.classList.add("aa-native");
  void fullScreen();
  const app = plugin("App");
  // tornando nell'app (dopo un'altra app o il browser) la barra può ricomparire
  void app?.addListener?.("appStateChange", (data) => {
    if ((data as unknown as { isActive?: boolean }).isActive) void fullScreen();
  });
  if (!app?.addListener) return;
  void app.addListener("appUrlOpen", (data) => {
    const url = (data as unknown as { url?: string }).url ?? "";
    if (url.startsWith("arcieriamiconi://")) void finishGoogle(url);
  });
  void app.addListener("backButton", ({ canGoBack }) => {
    for (let i = backStack.length - 1; i >= 0; i--) if (backStack[i]()) return;
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
    `Ciao${name ? ` ${name}` : ""}! Ti invito negli *Arcieri Amiconi*`,
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
