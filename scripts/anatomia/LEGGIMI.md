# Corpo anatomico dell'analisi del gesto

`public/anatomia/corpo.bin` (e `.bin.gz`, `corpo.json`) nasce da:

- BodyParts3D, © The Database Center for Life Science, licenza CC BY 4.0
  (https://dbarchive.biosciencedbc.jp/en/bodyparts3d/lic.html), nella versione semplificata di
  github.com/ashemag/human-atlas: pelle, ossa e quasi tutti i muscoli;
- Z-Anatomy, licenza CC BY-SA 4.0 (https://github.com/Z-Anatomy/Models-of-human-anatomy):
  gran dorsale, retto dell'addome e obliquo esterno, che BodyParts3D non ha.

Per la clausola "condividi allo stesso modo" di Z-Anatomy, i file in `public/anatomia` sono
distribuiti con licenza CC BY-SA 4.0.

Per rigenerarli servono Python con numpy e scipy:

    BP3D_MODELS=percorso/human-atlas/public/models/ ZA_GLB=percorso/z-anatomy-muscles.glb \
      python3 build.py ../../public/anatomia/corpo

`meshopt_decode.py` legge il glb compresso di Z-Anatomy (formato EXT_meshopt_compression),
`qem.py` semplifica senza aprire buchi, `za_align.py` adatta Z-Anatomy allo scheletro di BodyParts3D.
