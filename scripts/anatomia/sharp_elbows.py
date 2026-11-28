"""
Gomiti meno tondi. Tra omero e avambraccio la pelle passa dall'uno all'altro con rotazioni interpolate attorno al
gomito (vedi atlasSkinBones nell'app): con il passaggio lungo quanto lo dava wrap_skin.py, a gomito piegato (la
mano della corda al viso) il gomito diventava un tubo arrotondato, senza la punta dell'olecrano. Qui il passaggio
dei pesi tra omero e avambraccio si accorcia attorno a metà (pendenza x1.8): il gomito piegato fa la sua punta,
la piega interna la distendono le pieghe dell'app (relaxFolds).

Uso: python3 scripts/anatomia/sharp_elbows.py <pelle.json> <pelle.bin> [pendenza=1.8] [uscita.bin]
(una volta sola: rifatto, il passaggio si accorcia ancora)
"""
import json
import sys
from pathlib import Path

import numpy as np


def main() -> None:
    js_p, bin_p = Path(sys.argv[1]), Path(sys.argv[2])
    gain = float(sys.argv[3]) if len(sys.argv) > 3 else 1.8
    out_p = Path(sys.argv[4]) if len(sys.argv) > 4 else bin_p
    js = json.loads(js_p.read_text())
    m = js["meshes"]["corpo"]
    n, st = m["n"], js["stride"]
    raw = bytearray(bin_p.read_bytes())
    rec = np.frombuffer(bytes(raw[m["vOffset"] : m["vOffset"] + n * st]), dtype=np.uint8).reshape(n, st).copy()
    jo = rec[:, 19:23].astype(np.int64)
    wt = rec[:, 23:27].astype(np.int64)
    segs = js["segments"]
    changed = 0
    for sd in ("L", "R"):
        a, b = segs.index(f"omero_{sd}"), segs.index(f"avambr_{sd}")
        for i in np.nonzero(((jo == a) & (wt > 0)).any(1) & ((jo == b) & (wt > 0)).any(1))[0]:
            ka = int(np.nonzero((jo[i] == a) & (wt[i] > 0))[0][0])
            kb = int(np.nonzero((jo[i] == b) & (wt[i] > 0))[0][0])
            s = wt[i, ka] + wt[i, kb]
            t = wt[i, kb] / s
            t2 = min(1.0, max(0.0, (t - 0.5) * gain + 0.5))
            nb = int(round(s * t2))
            if nb != wt[i, kb]:
                changed += 1
            wt[i, kb] = nb
            wt[i, ka] = s - nb
    rec[:, 23:27] = wt.astype(np.uint8)
    raw[m["vOffset"] : m["vOffset"] + n * st] = rec.tobytes()
    out_p.write_bytes(bytes(raw))
    print(f"gomiti: {changed} punti con il passaggio più corto, scritto {out_p}")


if __name__ == "__main__":
    main()
