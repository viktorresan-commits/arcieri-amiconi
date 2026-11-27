// quanto ci mette il database a rispondere: un accesso con un utente che non esiste (nessun account creato)
const base = "https://arcieri-amiconi.vercel.app";
const time = async (label, url, init) => {
  const t0 = Date.now();
  try {
    const ctl = new AbortController();
    const to = setTimeout(() => ctl.abort(), 60000);
    const r = await fetch(url, { ...init, signal: ctl.signal });
    clearTimeout(to);
    const body = (await r.text()).slice(0, 200).replace(/\s+/g, " ");
    console.log(`${label}: ${r.status} in ${Date.now() - t0} ms ${body}`);
  } catch (e) {
    console.log(`${label}: ERRORE dopo ${Date.now() - t0} ms ${e.message}`);
  }
};
for (let i = 0; i < 3; i++) {
  await time("get-session", `${base}/api/auth/get-session`, { headers: { origin: base } });
  await time("sign-in (utente inesistente)", `${base}/api/auth/sign-in/username`, { method: "POST", headers: { "content-type": "application/json", origin: base }, body: JSON.stringify({ username: "prova-inesistente-zz", password: "prova-sbagliata-zz" }) });
}
