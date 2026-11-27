// apre il sito pubblicato in Chrome senza interfaccia e stampa errori della pagina e richieste fallite
import puppeteer from "puppeteer-core";
const base = "https://arcieri-amiconi.vercel.app";
const browser = await puppeteer.launch({ executablePath: "/usr/bin/google-chrome", args: ["--no-sandbox"] });
for (const path of ["/", "/login", "/squadra", "/obiettivi"]) {
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, isMobile: true });
  const log = [];
  page.on("pageerror", (e) => log.push(`PAGEERROR ${e.message}`));
  page.on("console", (m) => { if (["error", "warning"].includes(m.type())) log.push(`CONSOLE ${m.type()} ${m.text()}`); });
  page.on("requestfailed", (r) => log.push(`FAILED ${r.url()} ${r.failure()?.errorText}`));
  page.on("response", (r) => { if (r.status() >= 400) log.push(`HTTP ${r.status()} ${r.url()}`); });
  const t0 = Date.now();
  try {
    await page.goto(base + path, { waitUntil: "networkidle2", timeout: 30000 });
  } catch (e) {
    log.push(`GOTO ${e.message}`);
  }
  await new Promise((r) => setTimeout(r, 4000));
  const info = await page.evaluate(() => ({ url: location.href, text: document.body.innerText.slice(0, 300).replace(/\s+/g, " "), loading: !!document.querySelector(".aa-loading") }));
  console.log(`=== ${path} (${Date.now() - t0} ms) ${JSON.stringify(info)}`);
  for (const l of log) console.log(l);
  await page.close();
}
await browser.close();
