# Corpo anatomico dell'analisi del gesto

`public/anatomia/corpo.bin` (e `.bin.gz`, `corpo.json`, più la versione `corpo-leggero.*` usata
mentre il corpo si muove) nasce da:

- BodyParts3D, © The Database Center for Life Science, licenza CC BY 4.0
  (https://dbarchive.biosciencedbc.jp/en/bodyparts3d/lic.html), nella versione di
  github.com/ashemag/human-atlas: pelle e ossa;
- Z-Anatomy, licenza CC BY-SA 4.0 (https://github.com/Z-Anatomy/Models-of-human-anatomy),
  dal file originale `Startup.blend`: tutti i muscoli visibili e le cartilagini costali.

Z-Anatomy ha ossa e muscoli nello stesso spazio. Ogni osso di Z-Anatomy viene allineato al suo osso
di BodyParts3D (allineamento rigido, scarto mediano circa 1 mm); i muscoli seguono gli ossi vicini
con la stessa trasformazione, mescolata in modo morbido, quindi restano attaccati alle ossa come
nell'atlante. La pelle trasparente si allarga di qualche millimetro dove i muscoli sporgono.

Per la clausola "condividi allo stesso modo" di Z-Anatomy, i file in `public/anatomia` sono
distribuiti con licenza CC BY-SA 4.0.

Per rigenerarli servono Python con numpy e scipy:

    ZA_BLEND=percorso/Z-Anatomy/Startup.blend python3 build.py ../../public/anatomia/corpo

(il percorso dei modelli BodyParts3D è in `load.py`).

- `blend.py` legge i file `.blend` di Blender 3.x senza Blender;
- `za_blend.py` estrae ossa e muscoli di Z-Anatomy con la loro posizione nel corpo;
- `za_names.py` traduce i nomi delle ossa di Z-Anatomy in quelli di BodyParts3D;
- `za_fit2.py` allinea osso per osso e costruisce lo spostamento dei muscoli;
- `qem.py` semplifica senza aprire buchi.
