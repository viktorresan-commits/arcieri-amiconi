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

(il percorso dei modelli BodyParts3D è in `load.py`). Poi, sui tre corpi:

    python3 fix_orient.py ../../public/anatomia/corpo ../../public/anatomia/corpo-leggero ../../public/anatomia/corpo-hd
    python3 mark_inner.py ../../public/anatomia/corpo ../../public/anatomia/corpo-leggero ../../public/anatomia/corpo-hd

- `fix_orient.py` gira verso l'esterno i muscoli specchiati di Z-Anatomy (i ".l" hanno la matrice con
  determinante negativo: restavano rovesciati e con le facce posteriori scartate sembravano vuoti);
  `build.py` ora li gira già, lo script serve per i file fatti prima;
- `mark_inner.py` segna la parete interna del guscio della pelle (fondo di carne in ombra dietro i muscoli,
  visibile solo negli spiragli tra un muscolo e l'altro).

Poi, nell'ordine:

    python3 fix_abs.py ../../public/anatomia/corpo ../../public/anatomia/corpo-leggero ../../public/anatomia/corpo-hd
    BP3D_MODELS=<human-atlas>/public/models/ python3 add_face.py ../../public/anatomia/corpo:0.3 ../../public/anatomia/corpo-leggero:0.15 ../../public/anatomia/corpo-hd:0.7
    python3 za_nerve_curves.py
    BP3D_MODELS=<human-atlas>/public/models/ python3 add_nerves.py ../../public/anatomia/corpo:0.010:6 ../../public/anatomia/corpo-leggero:0.022:4 ../../public/anatomia/corpo-hd:0.006:8
    python3 fix_dita.py ../../public/anatomia/corpo ../../public/anatomia/corpo-leggero ../../public/anatomia/corpo-hd

- `fix_abs.py`: la parete dell'addome (retti, linea alba, obliqui, erettori) passa dal bacino al torace con un peso
  che dipende solo dall'altezza, uguale per tutti: torcendo il busto si torce tutta insieme;
- `add_face.py`: muscoli del viso, della masticazione e dell'occhio, galea e platisma (Z-Anatomy) in un blocco di
  muscoli in più; il bianco degli occhi segnato nelle ossa (0,5 nel canale dei tendini, l'iride ha 1);
- `za_nerve_curves.py` e `add_nerves.py`: i nervi di Z-Anatomy sono curve; si leggono da Startup.blend e diventano
  tubi (strato `nerve`), ogni punto con i due segmenti delle ossa più vicine della sua regione;
- `fix_dita.py`: muscoli e tendini delle dita prendono segmenti e pesi della pelle che li copre (dita e pollice),
  così si piegano con le dita in presa sulla corda e sull'impugnatura invece di restare dritti.

Tutti aggiungono una voce a `ritocchi` nel `.json`: cambia l'impronta del corpo e i telefoni lo riscaricano.

- `blend.py` legge i file `.blend` di Blender 3.x senza Blender;
- `za_blend.py` estrae ossa e muscoli di Z-Anatomy con la loro posizione nel corpo;
- `za_names.py` traduce i nomi delle ossa di Z-Anatomy in quelli di BodyParts3D;
- `za_fit2.py` allinea osso per osso e costruisce lo spostamento dei muscoli;
- `qem.py` semplifica senza aprire buchi.

## Pelle vera (`pelle.*`)

Il corpo chiuso della pelle vera è il personaggio Quaternius Superhero_Male (CC0) con la forma della pelle
dell'atlante dove c'è (BodyParts3D, CC BY 4.0) e la grana del pacchetto pelle dell'avatar:

    esbuild wrap_rest.ts --bundle --platform=node --format=esm --alias:@=../../src --outfile=/tmp/wrap_rest.mjs
    node /tmp/wrap_rest.mjs ../../public/anatomia/corpo.json <pelle originale>.json > rest-bones.json
    python3 wrap_skin.py <pelle originale> rest-bones.json ../../public/anatomia/corpo ../../public/anatomia/pelle
    python3 bake_face.py ../../public/anatomia/pelle.rest.npz - <pacchetto pelle>/09_face_albedo_4k.jpg ../../public/anatomia/pelle-testa.jpg ../../public/anatomia/pelle.json
    python3 bake_relief.py ../../public/anatomia/pelle.body.npz <tavola normal map del corpo> ../../public/anatomia/pelle-rilievo.jpg ../../public/anatomia/pelle.json
    python3 skin_detail.py <human_materials_1_cc0.glb | cartella del pacchetto pelle> ../../public/anatomia
    python3 smooth_skin.py ../../public/anatomia/pelle.json ../../public/anatomia/pelle.bin 150
    python3 add_fat.py ../../public/anatomia/pelle.json ../../public/anatomia/pelle.bin 0.85
    python3 fit_feet.py ../../public/anatomia/pelle.json ../../public/anatomia/pelle.bin ../../public/anatomia/corpo.json
    python3 fix_neck.py ../../public/anatomia/pelle.json ../../public/anatomia/pelle.bin
    python3 sharp_elbows.py ../../public/anatomia/pelle.json ../../public/anatomia/pelle.bin
    python3 tone_relief.py ../../public/anatomia/pelle.json ../../public/anatomia/pelle.bin ../../public/anatomia/pelle-rilievo.jpg ../../public/anatomia/pelle-rilievo.jpg 0.85
    python3 cloth_mask.py ../../public/anatomia/pelle ../../public/anatomia/pelle.jpg ../../public/anatomia/corpo.json

- `wrap_rest.ts` mette le ossa del personaggio nel riposo dell'atlante con il codice dell'app;
- `wrap_skin.py` divide i triangoli, porta la pelle sulla forma dell'atlante (muscoli veri, spalle e gomiti
  compresi; la testa prima allineata a quella dell'atlante, orecchie del personaggio tenute), poi la stende
  sull'involucro di muscoli e ossa: per busto, braccia e gambe una griglia di 2,5 mm con i tessuti della stessa
  parte (la parte di ogni punto viene dallo scheletro del personaggio, così l'interno del braccio non si attacca
  al busto), chiusa, gonfiata di 15 mm e stretta fino a 4 mm sopra i tessuti, levigata di circa 4 mm (la pelle passa sopra i solchi tra i muscoli); ogni punto della pelle va
  su quella superficie lungo il gradiente (testa, mani e dita dei piedi restano del personaggio). Riempie i buchi,
  prende i pesi dai muscoli e dalle ossa sotto ogni punto (nell'app la pelle si muove con le loro stesse matrici e
  resta sopra di loro in ogni posa; collo e vita con rotazioni interpolate), prende il muscolo sotto ogni punto
  (la pelle si gonfia con lui) e cuoce l'occlusione;
- `bake_face.py` (oltre a quanto sotto): la foto solo dove la pelle guarda davvero davanti, orecchie senza foto né
  capelli, attaccatura morbida e un poco ondulata, lati della testa del tono medio della pelle e metà
  dell'ombreggiatura larga della foto tolta (viso meno scuro e meno rosso del collo); scrive `faceSkin`.
- `bake_face.py` fa la testa nuova: la foto del viso del pacchetto (occhi aperti) deformata sulla testa
  dell'atlante con punti di riferimento, capelli rasati ai lati e dietro, in `pelle-testa.jpg` (uv sferiche);
  `pelle.rest.npz` è un file di passaggio, non va nel sito;
- `bake_relief.py` porta sulla pelle il rilievo fine delle tavole di riferimento dell'avatar (normal map di
  fronte, di schiena e delle braccia): addominali, dorsali, glutei, ginocchia, polpacci, vene; in
  `pelle-rilievo.jpg`, nello spazio tangente delle uv del corpo (`pelle.body.npz` è di passaggio);
- `smooth_skin.py` leviga la forma a riposo di busto, braccia e gambe (solo lungo la normale, 150 passate di
  Taubin): contorni senza gobbe e spigoli; mani, piedi e testa restano; dopo si rifà `cloth_mask.py`.
- `add_fat.py` aggiunge lo strato di grasso sotto la pelle (la pelle anatomica era incollata ai muscoli: vita
  75 cm su 1,72 m). Spessore per zona (pancia e fianchi ~2 cm, cosce ~1,5 cm, braccia pochi mm; niente su testa,
  mani e piedi), limitato dove braccia e busto o le due cosce sono vicini, spinto lungo normali molto lisciate.
  Con scala 0.85: torace ~105, vita ~86, fianchi ~95 cm. Va dopo `smooth_skin.py` e prima di `cloth_mask.py`.
  Sopra il grasso un poco di massa muscolare (MUSCLE: deltoidi, braccia, petto, dorso, trapezio, cosce; la scala
  vale solo per il grasso): braccio ~35 cm, avambraccio ~31, coscia ~53, spalle ~48 cm.
- `fit_feet.py` porta i piedi sulle ossa del piede dell'atlante: la pelle finiva 6-7 cm oltre le falangi (dita
  lunghe il doppio, sotto il pavimento). Davanti alle teste dei metatarsi la pelle si accorcia fino a 1,2 cm oltre
  la punta delle ossa, le dita si stringono un poco e la loro pianta torna a terra, poi il piede si leviga (dita
  piene, resto a metà: anche lo scalino sul collo del piede). Dopo `add_fat.py`, prima di `cloth_mask.py`.
- `fix_neck.py` aggiusta l'attacco tra testa e collo: l'orlo del collo era spiegazzato e l'anello d'attacco
  andava a zig-zag (3-8 mm), in posa una frangia a denti sotto la nuca e la mandibola. I punti dei due pezzi
  sull'anello diventano uno, l'anello si leviga come una curva e la pelle attorno (3,5 cm) si distende.
- `sharp_elbows.py` accorcia il passaggio dei pesi tra omero e avambraccio (x1.8, una volta sola): a gomito
  piegato il gomito fa la sua punta invece di un tubo arrotondato.
- `tone_relief.py` calma il rilievo delle tavole dove arriva di sbieco (fianchi, lati del torace, sotto le
  braccia: lì diventava righe), con un filo di sfocatura e la forza data (0.85). Va una volta sola dopo
  `bake_relief.py`.
- `skin_detail.py` fa la grana della pelle (pori, rossori, rilievo, ruvidità) che si ripete: ora dal file .glb di
  "Human Materials 1 (CC0)" di britdawgmasterfunk (Sketchfab; nel file la licenza è CC BY 4.0, si cita),
  materiale "Material", a 1024 px.
- `cloth_mask.py` fa il bordo dei pantaloncini liscio: dalla stoffa dell'immagine del corpo una vita e due orli
  sulle cosce, e in ogni vertice la distanza da quel bordo (byte 31 di pelle.bin, extra.cloth).
