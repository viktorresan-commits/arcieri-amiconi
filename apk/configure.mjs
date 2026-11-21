// Scrive capacitor.config.json con l'indirizzo dell'app pubblicata (variabile APP_URL).
import fs from "node:fs";

const raw = (process.env.APP_URL || "").trim();
let url;
try {
  url = new URL(raw);
} catch {
  console.error("APP_URL mancante o non valido. Su GitHub: Settings → Secrets and variables → Actions → Variables → APP_URL = https://indirizzo-della-tua-app");
  process.exit(1);
}
if (url.protocol !== "https:") {
  console.error("APP_URL deve iniziare con https://");
  process.exit(1);
}

const config = {
  appId: "it.arcieriamiconi.app",
  appName: "Arcieri Amiconi",
  webDir: "www",
  server: {
    url: url.origin + url.pathname.replace(/\/$/, ""),
    androidScheme: "https",
    allowNavigation: [url.hostname],
  },
  android: {
    allowMixedContent: false,
    captureInput: true,
  },
  plugins: {
    StatusBar: {
      overlaysWebView: true,
      style: "DARK",
      backgroundColor: "#0C1210",
    },
    SplashScreen: {
      launchShowDuration: 900,
      backgroundColor: "#0C1210",
      showSpinner: false,
    },
  },
};

fs.writeFileSync(new URL("./capacitor.config.json", import.meta.url), JSON.stringify(config, null, 2));
console.log("App:", config.server.url);
