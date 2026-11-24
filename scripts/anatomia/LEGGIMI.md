# Corpo anatomico dell'analisi del gesto

`public/anatomia/corpo.bin` e `corpo.json` nascono da BodyParts3D
(© The Database Center for Life Science, licenza CC BY 4.0,
https://dbarchive.biosciencedbc.jp/en/bodyparts3d/lic.html), nella versione semplificata
pubblicata in github.com/ashemag/human-atlas (cartella `public/models`).

Per rigenerarli:

    BP3D_MODELS=percorso/human-atlas/public/models/ python3 build.py ../../public/anatomia/corpo

Lo script sceglie pelle, ossa e muscoli, li semplifica, aggiunge gran dorsale e retto
dell'addome (assenti nell'atlante), calcola i pesi dei 17 segmenti e i gruppi muscolari.
Serve Python con numpy e scipy.
