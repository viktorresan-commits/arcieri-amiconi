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
