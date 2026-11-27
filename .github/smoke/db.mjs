// stato del database del sito pubblicato (nessun dato personale)
const base = "https://arcieri-amiconi.vercel.app";
for (let i = 0; i < 3; i++) {
  const t0 = Date.now();
  try {
    const r = await fetch(`${base}/api/salute`, { signal: AbortSignal.timeout(90000) });
    console.log(`salute ${r.status} in ${Date.now() - t0} ms ${(await r.text()).slice(0, 400)}`);
  } catch (e) {
    console.log(`salute ERRORE dopo ${Date.now() - t0} ms ${e.message}`);
  }
}
