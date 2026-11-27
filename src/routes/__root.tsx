import { createRootRoute, HeadContent, Outlet, Scripts } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Toaster } from "sonner";
import { AuthProvider } from "@/lib/auth/provider";
import { PreviewHostBridge } from "@/components/preview-host-bridge";
import appCss from "../styles.css?url";
import { initNativeApp } from "@/lib/arcieri/native";

const cssHref = import.meta.env.DEV ? `${appCss}${String(appCss).includes("?") ? "&" : "?"}direct` : appCss;

const APP_NAME = "Arcieri Amiconi";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { title: APP_NAME },
      { name: "description", content: "Quaderno di allenamento del gruppo Arcieri Amiconi: punteggi, classifiche, attrezzatura e gare." },
      { name: "theme-color", content: "#0c1210" },
    ],
    links: [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@500;700&family=Outfit:wght@400;500;600;700&display=swap",
      },
      { rel: "icon", type: "image/png", sizes: "192x192", href: "/__grok/icon-192.png" },
      { rel: "icon", type: "image/png", sizes: "512x512", href: "/__grok/icon-512.png" },
      { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
      { rel: "stylesheet", href: cssHref },
      { rel: "manifest", href: "/__grok/manifest.webmanifest" },
      { rel: "apple-touch-icon", sizes: "180x180", href: "/__grok/icon-180.png" },
    ],
  }),
  component: () => (
    <html lang="it" suppressHydrationWarning>
      <head>
        {/* se l'app non parte entro 12 secondi: avviso con «Riprova» e una segnalazione al server (errori e stato, niente dati personali) */}
        <script dangerouslySetInnerHTML={{ __html: WATCHDOG }} />
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var d=document.documentElement,ink=localStorage.getItem("aa-ink")||"verde",p=JSON.parse(localStorage.getItem("aa-prefs-v1")||"{}");d.dataset.ink=ink;d.dataset.icons=p.icons||"tema";d.dataset.motion=p.motion||"piena";d.dataset.scenes=p.scenes||"si";if(matchMedia("(pointer: coarse)").matches&&Math.min(screen.width,screen.height)<600)d.classList.add("aa-phone")}catch(e){}`,
          }}
        />
        {/* conta le scritture verso il server (ogni richiesta allo stesso sito che non è una lettura):
            prima di qualunque altro codice, così le vede tutte. I dati già caricati restano finché non
            si salva qualcosa (vedi use-load). */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var F=window.fetch;if(F&&!F.__aa){var W=function(i,o){var p=F.apply(window,arguments);try{var m=String((o&&o.method)||(i&&typeof i==="object"&&i.method)||"GET").toUpperCase();if(m!=="GET"&&m!=="HEAD"){var u=new URL(typeof i==="string"?i:i&&i.url?i.url:String(i),location.href);if(u.origin===location.origin&&u.pathname.indexOf("/_vercel")!==0&&u.pathname.indexOf("/api/auth/")!==0){var b=function(){window.__aaWrites=(window.__aaWrites||0)+1};p.then(b,function(){})}}}catch(e){}return p};W.__aa=1;window.fetch=W}}catch(e){}`,
          }}
        />
        <style
          dangerouslySetInnerHTML={{
            __html: "html,body{margin:0;background:#0c1210;color:#f3f0e8}",
          }}
        />
        <HeadContent />
      </head>
      <body>
        <PreviewHostBridge />
        <Started />
        <AuthProvider>
          <Outlet />
          <ToastHost />
        </AuthProvider>
        <Scripts />
      </body>
    </html>
  ),
});

function ToastHost() {
  const [theme, setTheme] = useState<"light" | "dark">("dark");
  useEffect(() => {
    initNativeApp();
  }, []);
  useEffect(() => {
    const sync = () => setTheme(document.documentElement.classList.contains("light") ? "light" : "dark");
    sync();
    const obs = new MutationObserver(sync);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);
  return <Toaster theme={theme} />;
}

const WATCHDOG = `try{(function(){var E=window.__aaErr=[];var send=function(kind,extra){try{var b=JSON.stringify({kind:kind,url:location.pathname,ua:navigator.userAgent,errs:E.slice(-6),me:!!localStorage.getItem("aa-me"),tok:!!sessionStorage.getItem("grok-auth.bearer-token"),extra:extra||""});if(navigator.sendBeacon)navigator.sendBeacon("/api/errore",b);else fetch("/api/errore",{method:"POST",body:b,keepalive:true})}catch(e){}};window.addEventListener("error",function(e){var t=e&&e.target;if(t&&t!==window&&(t.src||t.href)){E.push("carico "+(t.src||t.href))}else{E.push(String(e&&e.message||"errore")+" @"+(e&&e.filename||"")+":"+(e&&e.lineno||""))}},true);window.addEventListener("unhandledrejection",function(e){var r=e&&e.reason;E.push("promessa: "+String(r&&(r.stack||r.message)||r).slice(0,300))});setTimeout(function(){var up=window.__aaHydrated;var busy=!!document.querySelector(".aa-loading");if(up&&!busy)return;send(up?"in-attesa":"non-partita");var d=document.createElement("div");d.setAttribute("style","position:fixed;left:12px;right:12px;bottom:24px;z-index:99999;background:#1b2420;color:#f3f0e8;border:1px solid #3d5a48;border-radius:16px;padding:14px;font:14px system-ui,sans-serif");d.innerHTML="<b>L'app non è partita.</b><div style='margin-top:6px;font-size:12px;opacity:.8;word-break:break-word'>"+(E.length?E.slice(-2).join(" | ").replace(/[<>&]/g,""):(up?"In attesa del server.":"Il codice dell'app non si è avviato."))+"</div><button style='margin-top:10px;padding:10px 14px;border-radius:12px;border:0;background:#3d8a4e;color:#fff;font-weight:600'>Riprova</button>";d.querySelector("button").onclick=function(){location.reload()};document.body.appendChild(d)},12000)})()}catch(e){}`;

/** l'app è partita (il codice è attivo): il controllo di avvio non mostra l'avviso */
function Started() {
  useEffect(() => {
    (window as Window & { __aaHydrated?: number }).__aaHydrated = 1;
  }, []);
  return null;
}
