"""
Corpo anatomico per l'analisi del gesto, da BodyParts3D (CC BY 4.0, Database Center for Life Science).
Seleziona pelle, ossa e muscoli, li semplifica, calcola i pesi per segmento (per muovere il modello con
la posa del video), il gruppo muscolare di ogni muscolo e le coordinate delle fibre. Scrive un file
binario compatto e un indice JSON.
"""
import json, re, sys, struct, os
import numpy as np
from scipy.sparse import coo_matrix
from scipy.sparse.csgraph import dijkstra
from scipy.spatial import cKDTree
sys.path.insert(0, '.')
from load import A, part
from pick import classify
from decimate import cluster, recompute_normals

OUT = sys.argv[1] if len(sys.argv) > 1 else '/tmp/corpo'
# muscoli profondi, coperti da altri: non si vedono mai, si risparmia peso
DEEP = re.compile(r"vastus intermedius|gluteus minimus|iliacus|psoas|tibialis posterior|flexor digitorum profundus|supinator|pronator quadratus|scalen|longissimus (capitis|cervicis)|iliocostalis cervicis|subscapularis|pectoralis minor|flexor hallucis longus|flexor digitorum longus|extensor indicis|extensor pollicis|abductor pollicis longus|flexor pollicis longus", re.I)
EYE = re.compile(r"(superior|inferior|lateral|medial) rectus$|(superior|inferior) oblique$|perineal", re.I)

# ---------- segmenti ----------
SEGS = ['bacino', 'torace', 'testa', 'clav_L', 'omero_L', 'avambr_L', 'mano_L', 'clav_R', 'omero_R', 'avambr_R', 'mano_R',
        'coscia_L', 'gamba_L', 'piede_L', 'coscia_R', 'gamba_R', 'piede_R', 'dita_L', 'pollice_L', 'dita_R', 'pollice_R']
SI = {s: i for i, s in enumerate(SEGS)}

def side_of(name):
    n = name.lower()
    if re.search(r"\bleft\b", n): return 'L'
    if re.search(r"\bright\b", n): return 'R'
    return None

def bone_segment(name):
    n = name.lower(); s = side_of(name)
    if re.search(r"humerus", n): return f'omero_{s}'
    if re.search(r"radius|ulna", n): return f'avambr_{s}'
    if re.search(r"phalanx of (left|right) thumb", n): return f'pollice_{s}'
    if re.search(r"phalanx of (left|right) (index|middle|ring|little) finger", n): return f'dita_{s}'
    if re.search(r"scaphoid|lunate|triquetral|pisiform|trapezium|trapezoid|capitate|hamate|metacarpal|finger|thumb", n): return f'mano_{s}'
    if re.search(r"femur|patella", n): return f'coscia_{s}'
    if re.search(r"tibia|fibula", n): return f'gamba_{s}'
    if re.search(r"talus|calcaneus|navicular|cuboid|cuneiform|metatarsal|toe", n): return f'piede_{s}'
    if re.search(r"clavicle|scapula", n): return f'clav_{s}'
    if re.search(r"hip bone|sacrum|coccyx|lumbar", n): return 'bacino'
    if re.search(r"thoracic vertebra|rib|sternum|manubrium|xiphoid|costal", n): return 'torace'
    if re.search(r"(fifth|sixth|seventh) cervical", n): return 'torace'
    if re.search(r"cervical|atlas|axis", n): return 'testa'
    if re.search(r"frontal|parietal|occipital|temporal|maxilla|zygomatic|mandible|nasal|skull|sclera|iris", n): return 'testa'
    return None

def muscle_candidates(name):
    n = name.lower(); s = side_of(name)
    sides = [s] if s else ['L', 'R']
    def seg(*names): return [f'{x}_{sd}' if x not in ('bacino', 'torace', 'testa') else x for x in names for sd in sides]
    if re.search(r"biceps brachii|brachialis|triceps|anconeus|coracobrachialis", n): return seg('clav', 'omero', 'avambr')
    if re.search(r"carpi|digitorum superficialis|digitorum profundus|pronator|supinator|palmaris|brachioradialis|extensor digitorum$|extensor digiti minimi$|extensor indicis|pollicis longus|pollicis brevis$|abductor pollicis longus|extensor pollicis", n) and 'foot' not in n:
        return seg('omero', 'avambr', 'mano')
    if re.search(r"foot|hallucis|plantar|digitorum brevis|extensor digitorum longus", n): return seg('gamba', 'piede')
    if re.search(r"hand|pollicis|opponens", n): return seg('avambr', 'mano', 'dita', 'pollice')
    if re.search(r"frontalis|occipitalis|temporalis|masseter|orbicularis|zygomaticus|risorius|depressor|levator (labii|anguli)|nasalis|procerus|mentalis|corrugator|bucinator|buccinator", n): return ['testa']
    if re.search(r"hyoid|thyroid", n): return ['testa', 'torace']
    if re.search(r"pyramidalis|linea alba", n): return ['bacino', 'torace']
    if re.search(r"deltoid|supraspinatus|infraspinatus|teres|subscapularis", n): return seg('clav', 'omero')
    if re.search(r"pectoralis major", n): return seg('torace', 'clav', 'omero')
    if re.search(r"latissimus", n): return seg('torace', 'bacino', 'omero')
    if re.search(r"pectoralis minor|serratus anterior", n): return seg('torace', 'clav')
    if re.search(r"trapezius|rhomboid|levator scapulae", n): return seg('torace', 'clav', 'testa')
    if re.search(r"sternocleidomastoid|scalen|capitis|cervicis", n): return seg('torace', 'testa', 'clav')
    if re.search(r"oblique|rectus abdominis|iliocostalis|longissimus|spinalis|psoas|iliacus", n): return seg('bacino', 'torace')
    if re.search(r"gluteus|tensor fasciae|iliotibial|sartorius|gracilis|adductor|rectus femoris|vastus|biceps femoris|semitendinosus|semimembranosus", n): return seg('bacino', 'coscia', 'gamba')
    if re.search(r"gastrocnemius|soleus|tibialis|fibularis|digitorum longus|hallucis longus|calcaneal", n): return seg('coscia', 'gamba', 'piede')
    if re.search(r"foot|hallucis|plantar", n): return seg('gamba', 'piede')
    return None

# gruppo muscolare (lo stesso nome usato dall'analisi: si accende quando lavora)
def muscle_group(name):
    n = name.lower(); s = side_of(name) or 'C'
    rules = [
        (r"clavicular part of .*deltoid", 'deltoide-ant'), (r"acromial part of .*deltoid", 'deltoide-med'), (r"spinal part of .*deltoid", 'deltoide-post'),
        (r"biceps brachii", 'bicipite'), (r"brachialis", 'brachiale'), (r"coracobrachialis", 'bicipite'), (r"triceps|anconeus", 'tricipite'),
        (r"brachioradialis", 'brachioradiale'),
        (r"flexor carpi|flexor digitorum (superficialis|profundus)|palmaris|pronator|flexor pollicis longus", 'flessori'),
        (r"extensor carpi|extensor digitorum$|extensor digiti minimi$|extensor indicis|supinator|abductor pollicis longus|extensor pollicis", 'estensori'),
        (r"(pollicis|opponens|digiti minimi)(?!.*foot)", 'mano'),
        (r"pectoralis", 'pettorale'),
        (r"descending part of .*trapezius|levator scapulae", 'trapezio-sup'), (r"transverse part of .*trapezius", 'trapezio-med'), (r"ascending part of .*trapezius", 'trapezio-inf'),
        (r"rhomboid", 'romboidi'), (r"infraspinatus|teres minor|supraspinatus", 'sottospinato'), (r"latissimus|teres major", 'dorsale'),
        (r"serratus anterior", 'dentato'), (r"sternocleidomastoid", 'scm'),
        (r"rectus abdominis", 'addome'), (r"oblique", 'obliqui'), (r"iliocostalis|longissimus|spinalis", 'erettori'),
        (r"gluteus|tensor fasciae", 'glutei'), (r"rectus femoris|vastus", 'quadricipite'), (r"biceps femoris|semitendinosus|semimembranosus", 'femorali'),
        (r"gastrocnemius|soleus", 'polpacci'), (r"tibialis anterior", 'tibiale'),
    ]
    for pat, g in rules:
        if re.search(pat, n): return f'{s}:{g}' if g not in ('addome', 'erettori') else g
    return None

# ---------- carica e semplifica ----------
parts = []  # dict(kind, name, P, N, I)
for p in A['parts']:
    k = classify(p)
    if p['name'] in ('Left tensor fasciae latae', 'Right tensor fasciae latae'): k = 'muscle'
    if p['name'] in ('Left calcaneal tendon', 'Right calcaneal tendon'): k = 'muscle'
    if not k or EYE.search(p['name']): continue
    if k == 'muscle': continue  # i muscoli vengono tutti da Z-Anatomy, adattati alle ossa (sotto)
    pos, nor, idx = part(p)
    # piena definizione dell'atlante: niente semplificazione che apra buchi
    P = pos.astype(np.float64); N = nor.astype(np.float64); I = idx.astype(np.int64)
    # vertici doppi nello stesso punto: si uniscono (metà del peso, superficie continua, normali lisce)
    key = np.round(P / 0.00005).astype(np.int64)
    _, first, inv = np.unique(key, axis=0, return_index=True, return_inverse=True)
    inv = inv.reshape(-1)
    Nw = np.zeros((len(first), 3)); np.add.at(Nw, inv, N)
    P = P[first]; I = inv[I]
    I = I[(I[:, 0] != I[:, 1]) & (I[:, 1] != I[:, 2]) & (I[:, 0] != I[:, 2])]
    N = Nw / np.maximum(np.linalg.norm(Nw, axis=1, keepdims=True), 1e-6)
    parts.append(dict(kind=k, name=p['name'], P=P, N=N, I=I, full=P))
print('parti', len(parts), 'triangoli', sum(len(x['I']) for x in parts))

def by(name):
    r = [x for x in parts if x['name'] == name]
    if not r: raise KeyError(name)
    return r[0]

# ---------- punti di riposo (indici come i 33 punti della posa) ----------
def top(P, h): return P[P[:, 1] > P[:, 1].max() - h].mean(0)
def bot(P, h): return P[P[:, 1] < P[:, 1].min() + h].mean(0)
rest = {}
for s, sg, (sh, el, wr, pk, ix, th, hp, kn, an, he, to, ear) in [('Left', 1, (11, 13, 15, 17, 19, 21, 23, 25, 27, 29, 31, 7)), ('Right', -1, (12, 14, 16, 18, 20, 22, 24, 26, 28, 30, 32, 8))]:
    hu = by(f'{s} humerus')['full']
    rest[sh] = top(hu, 0.035); rest[el] = bot(hu, 0.03)
    ru = np.vstack([by(f'{s} radius')['full'], by(f'{s} ulna')['full']])
    rest[wr] = bot(ru, 0.02)
    rest[pk] = bot(by(f'{s} fifth metacarpal bone')['full'], 0.008)
    rest[ix] = bot(by(f'{s} second metacarpal bone')['full'], 0.008)
    rest[th] = bot(by(f'{s} first metacarpal bone')['full'], 0.008)
    fe = by(f'{s} femur')['full']
    hd = fe[fe[:, 1] > fe[:, 1].max() - 0.07]
    rest[hp] = hd.mean(0)
    rest[kn] = bot(fe, 0.03)
    rest[an] = by(f'{s} talus')['full'].mean(0)
    ca = by(f'{s} calcaneus')['full']; rest[he] = ca[ca[:, 2] < ca[:, 2].min() + 0.015].mean(0)
    bt = [x for x in parts if re.search(rf'distal phalanx of {s.lower()} (big|second) toe', x['name'], re.I)]
    rest[to] = np.vstack([b['full'] for b in bt]).mean(0)
    tb = by(f'{s} temporal bone')['full']; rest[ear] = tb[np.abs(tb[:, 0]) > np.abs(tb[:, 0]).max() - 0.012].mean(0)
    sd = s[0]
    rest[f'dita0_{sd}'] = np.mean([bot(by(f'{s} {o} metacarpal bone')['full'], 0.008) for o in ('second', 'third', 'fourth', 'fifth')], 0)
    rest[f'dita1_{sd}'] = np.mean([bot(by(f'Distal phalanx of {s.lower()} {f} finger')['full'], 0.004) for f in ('index', 'middle', 'ring', 'little')], 0)
    rest[f'pol0_{sd}'] = rest[th]
    rest[f'pol1_{sd}'] = bot(by(f'Distal phalanx of {s.lower()} thumb')['full'], 0.004)
skin = by('Skin')
# inguine da manichino: l'app è usata anche da ragazzi, la pelle trasparente non mostra i genitali
def mannequin(S):
    P = S['P']
    ax = np.abs(P[:, 0])
    def sm(a, b, x): t = np.clip((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t)
    zc = 0.02 + 0.055 * sm(0.75, 0.885, P[:, 1])
    bx = 1 - sm(0.032, 0.062, ax)
    reg = (P[:, 1] > 0.69) & (P[:, 1] < 0.89) & (P[:, 2] > -0.03) & (bx > 0)
    z_new = np.minimum(P[:, 2], zc + 0.01 * ax / 0.06)
    P[reg, 2] = P[reg, 2] * (1 - bx[reg]) + z_new[reg] * bx[reg]
    low = reg & (P[:, 1] < 0.75) & (ax < 0.045)
    P[low, 1] = P[low, 1] * (1 - bx[low]) + 0.75 * bx[low]
    S['N'] = recompute_normals(P, S['I'])
mannequin(skin)
SP = skin['P']
head = SP[SP[:, 1] > 1.5]
rest[0] = head[np.argmax(head[:, 2])]
# mento e fronte (punti 152 e 10 del viso)
mid = SP[np.abs(SP[:, 0]) < 0.012]
cz = mid[(mid[:, 1] > 1.40) & (mid[:, 1] < 1.53)]
cz = cz[cz[:, 2] > cz[:, 2].max() - 0.025]
rest['mento'] = cz[np.argmin(cz[:, 1])]
fz = mid[(mid[:, 1] > 1.64) & (mid[:, 1] < 1.72)]
rest['fronte'] = fz[np.argmax(fz[:, 2])]
mid_m = [by('Manubrium')['full']] if any(x['name'] == 'Manubrium' for x in parts) else []
notch = top(mid_m[0], 0.01) if mid_m else (rest[11] + rest[12]) / 2
rest['notch'] = notch
print('punti di riposo', {k: np.round(v, 3).tolist() for k, v in rest.items() if k in (0, 7, 11, 13, 15, 23, 25, 27, 31)})

# ---------- muscoli che mancano in BodyParts3D: gran dorsale e retto dell'addome ----------
# costruiti sulla superficie del busto (pelle rientrata di qualche millimetro), come lamine con spessore
def torso_field():
    tree_b = None
    # solo la pelle del busto: lontana dalle braccia
    m = (SP[:, 1] > 0.85) & (SP[:, 1] < 1.5)
    hum = np.vstack([by('Left humerus')['full'], by('Right humerus')['full'], by('Left radius')['full'], by('Right radius')['full']])
    d_arm = cKDTree(hum).query(SP)[0]
    m &= d_arm > 0.07
    Q = SP[m]
    cz = -0.02
    th = np.arctan2(Q[:, 0], Q[:, 2] - cz)  # 0 davanti, +pi/2 a sinistra
    r = np.hypot(Q[:, 0], Q[:, 2] - cz)
    ys = np.arange(0.85, 1.5, 0.01); ts = np.radians(np.arange(-180, 181, 6))
    F = np.full((len(ys), len(ts)), np.nan)
    yi = np.clip(((Q[:, 1] - 0.85) / 0.01).astype(int), 0, len(ys) - 1)
    ti = np.clip(((th + np.pi) / np.radians(6)).round().astype(int), 0, len(ts) - 1)
    for a, b, rr in zip(yi, ti, r):
        if np.isnan(F[a, b]) or rr > F[a, b]: F[a, b] = rr
    # riempi i buchi lungo theta e y
    for _ in range(6):
        G = F.copy()
        for a in range(len(ys)):
            for b in range(len(ts)):
                if np.isnan(F[a, b]):
                    nb = [F[a2, b2 % len(ts)] for a2, b2 in ((a - 1, b), (a + 1, b), (a, b - 1), (a, b + 1)) if 0 <= a2 < len(ys)]
                    nb = [x for x in nb if not np.isnan(x)]
                    if nb: G[a, b] = np.mean(nb)
        F = G
    def surf(y, t, inset):
        a = np.clip((y - 0.85) / 0.01, 0, len(ys) - 1.001); b = np.clip((t + np.pi) / np.radians(6), 0, len(ts) - 1.001)
        a0, b0 = int(a), int(b); fa, fb = a - a0, b - b0
        r = (F[a0, b0] * (1 - fa) * (1 - fb) + F[a0 + 1, b0] * fa * (1 - fb) + F[a0, b0 + 1] * (1 - fa) * fb + F[a0 + 1, b0 + 1] * fa * fb) - inset
        return np.array([np.sin(t) * r, y, cz + np.cos(t) * r])
    return surf

def sheet(fn, nu, nv, inset, thick):
    """lamina muscolare: fn(u, v) -> (y, theta, extra spostamento); superficie esterna e interna chiuse ai bordi"""
    outer = np.zeros((nv, nu, 3)); inner = np.zeros((nv, nu, 3))
    for j in range(nv):
        for i in range(nu):
            u, v = i / (nu - 1), j / (nv - 1)
            y, t, pull, th = fn(u, v)
            o = surf(y, t, inset); n = surf(y, t, inset + thick * th)
            outer[j, i] = o * (1 - pull[0]) + pull[1] * pull[0]
            inner[j, i] = n * (1 - pull[0]) + (pull[1] - (o - n) * 0.3) * pull[0]
    V = np.vstack([outer.reshape(-1, 3), inner.reshape(-1, 3)])
    off = nu * nv
    I = []
    for j in range(nv - 1):
        for i in range(nu - 1):
            a, b, c, d = j * nu + i, j * nu + i + 1, (j + 1) * nu + i, (j + 1) * nu + i + 1
            I += [[a, c, b], [b, c, d], [a + off, b + off, c + off], [b + off, d + off, c + off]]
    # bordi
    ring = [(j, 0) for j in range(nv)] + [(nv - 1, i) for i in range(nu)] + [(j, nu - 1) for j in range(nv - 1, -1, -1)] + [(0, i) for i in range(nu - 1, -1, -1)]
    for (j1, i1), (j2, i2) in zip(ring, ring[1:]):
        a, b = j1 * nu + i1, j2 * nu + i2
        I += [[a, b, a + off], [b, b + off, a + off]]
    I = np.array(I, np.int64)
    # orientamento: le normali verso l'esterno del busto
    N = recompute_normals(V, I)
    c = V.mean(0); c[1] = V[:, 1].mean()
    out = V - np.array([0, V[:, 1].mean(), -0.02]) * [1, 0, 1]
    out[:, 1] = 0
    if (np.einsum('ij,ij->i', N[:off], out[:off]) < 0).mean() > 0.5:
        I = I[:, [0, 2, 1]]; N = -N
    return V, N, I

# ---------- muscoli da Z-Anatomy (CC BY-SA 4.0), adattati alle ossa ----------
# Z-Anatomy ha ossa e muscoli nello stesso spazio. Ogni osso di Z-Anatomy viene portato sul suo osso di
# BodyParts3D (allineamento rigido); i muscoli seguono gli ossi vicini con la stessa trasformazione, mescolata
# in modo morbido: restano attaccati alle ossa come nell'atlante, senza lo scarto di un paio di centimetri.
from za_blend import load as za_blend_load
from za_fit2 import bone_field, world as za_world
from qem import simplify as qem_simplify
za_warp, _, za_info = bone_field()
print('Z-Anatomy -> ossa: scarto mediano ossa mm', round(za_info['err_mm'], 2))
ZA_SKIP = re.compile(r"frontalis|occipitalis|temporalis|masseter|orbicularis|zygomaticus|risorius|depressor|levator labii|levator anguli|nasalis|procerus|mentalis|corrugator|bucinator|buccinator|auricular|modiolus|levator veli|tensor veli|uvula|fascia|bursa|sheath|retinacul|septum|aponeuros|ligament|tendinous (ring|arch)|tendon of|intercostal|transversus (abdominis|thoracis)|internal abdominal oblique|diaphragm|arytenoid|cricothyroid|thyro-|epiglott|pharyn|stylopharyn|glossus|palpebr|(superior|inferior|lateral|medial) rectus muscle|(superior|inferior) oblique muscle|trochlea|tarsus|sphincter|coccygeus|iliococcygeus|pubococcygeus|pubo-analis|interspinales|intertransversarii|rotatores|multifidus|levatores|longus colli|longus capitis|rectus (anterior|lateralis|posterior) |obliquus|semispinalis|splenius colli|spinalis (colli|capitis)|longissimus (colli|capitis)|iliocostalis colli|serratus posterior|quadratus lumborum|psoas|iliacus|obturator|gemellus|piriformis|quadratus femoris|pectineus|adductor minimus|adductor brevis|vastus intermedius|gluteus minimus|tibialis posterior|flexor digitorum longus|flexor hallucis|popliteus|plantaris|subclavius|pectoralis minor|subscapularis|supinator|pronator quadratus|flexor digitorum profundus|extensor indicis|lumbrical|palmar interossei|plantar interossei|dorsal interossei muscles of foot|quadratus plantae|digastric|stylohyoid|mylohyoid|geniohyoid|pterygoid|epicranial|platysma|temporoparietalis|deep part of masseter|adductor hallucis|opponens digiti minimi muscle of foot|flexor digiti minimi of foot|deep head of flexor pollicis|scalenus posterior|levator nasolabialis|depressor septi", re.I)
def za_name(n):
    b = re.sub(r"\.(l|r)$", "", n).strip("()")
    m = re.search(r"\.(l|r)$", n)
    if not m: return b
    return ('Left ' if m.group(1) == 'l' else 'Right ') + b[0].lower() + b[1:]
def weld(P, I):
    key = np.round(P / 0.00002).astype(np.int64)
    _, first, inv = np.unique(key, axis=0, return_index=True, return_inverse=True); inv = inv.reshape(-1)
    I = inv[I]; I = I[(I[:, 0] != I[:, 1]) & (I[:, 1] != I[:, 2]) & (I[:, 0] != I[:, 2])]
    return P[first], I
skin_tree = cKDTree(SP)
def keep_under_skin(X, gap=0.0025):
    d, i = skin_tree.query(X)
    n = skin['N'][i]
    sd = np.einsum('ij,ij->i', X - SP[i], n)
    push = np.clip(sd + gap, 0, None)
    return X - n * push[:, None]
za_all = za_blend_load()
n_za = 0
for z in za_all:
    nm = z['name']
    if z['cat'] == 'Skeletal system' and re.match(r"Costal cartilage of \w+ rib\.(l|r)$", nm):
        kind = 'bone'; outname = za_name(nm)  # cartilagini costali: chiudono la gabbia toracica davanti
    elif z['cat'].startswith('7:') and re.match(r"(Sclera|Iris)\.(l|r)$", nm):
        kind = 'bone'; outname = za_name(nm)  # occhi: bianco dell'occhio e iride
    elif z['cat'] == 'Muscular system' and not z['mods'] and not ZA_SKIP.search(nm) and (not nm.startswith('(') or nm.startswith('(Abdominal part of pectoralis')):
        kind = 'muscle'; outname = za_name(nm)
    else:
        continue
    P, I = weld(za_world(z), z['I'])
    # le parti di sinistra (".l") sono specchiate (matrice con determinante negativo): senza girare i triangoli
    # resterebbero rovesciate, con le normali verso l'interno (fix_orient.py corregge i file già fatti)
    if np.linalg.det(z['M'][:3, :3]) < 0: I = I[:, [0, 2, 1]]
    if len(I) < 40: continue
    # i più grandi si alleggeriscono (forma uguale, meno triangoli)
    # ZA_KEEP=1: piena definizione dell'atlante (versione per foto e video in alta definizione)
    _keep = float(os.environ.get('ZA_KEEP', '0.38'))
    if _keep < 1 and len(I) > 1300: P, I, _ = qem_simplify(P, I, max(1300, int(len(I) * _keep)))
    P = za_warp(P)
    N = recompute_normals(P, I)
    parts.append(dict(kind=kind, name=outname, P=P, N=N, I=I, full=P, za=True))
    n_za += 1
# la pelle (trasparente) si allarga dove i muscoli di Z-Anatomy sporgono: i muscoli restano interi,
# senza schiacciarli tutti sulla stessa superficie (strati sovrapposti = schegge che sfarfallano)
def inflate_skin(gap=0.004, rad=0.03):
    SPn = skin['P']; Nn = skin['N']
    mus = np.vstack([x['P'] for x in parts if x['kind'] == 'muscle'])
    d, i = skin_tree.query(mus)
    sd = np.einsum('ij,ij->i', mus - SPn[i], Nn[i])
    out = sd > -gap
    Mo, So = mus[out], sd[out] + gap
    push = np.zeros(len(SPn))
    if len(Mo):
        t = cKDTree(Mo)
        for k, nb in enumerate(t.query_ball_point(SPn, rad)):
            if nb:
                dd = np.linalg.norm(Mo[nb] - SPn[k], axis=1)
                push[k] = np.max(So[nb] * np.clip(1 - dd / rad, 0, 1) ** 0.5)
    # spinta morbida lungo la superficie
    e = np.vstack([skin['I'][:, [0, 1]], skin['I'][:, [1, 2]], skin['I'][:, [2, 0]]])
    deg = np.bincount(e.ravel(), minlength=len(SPn)).astype(float)
    p0 = push.copy()
    for _ in range(8):
        acc = np.zeros(len(SPn)); np.add.at(acc, e[:, 0], push[e[:, 1]]); np.add.at(acc, e[:, 1], push[e[:, 0]])
        push = np.maximum(p0, 0.5 * push + 0.5 * acc / np.maximum(deg, 1))
    push = np.minimum(push, 0.05)
    skin['P'] = SPn + Nn * push[:, None]
    skin['full'] = skin['P']
    skin['N'] = recompute_normals(skin['P'], skin['I'])
    print('pelle allargata sui muscoli: vertici', int((push > 0.001).sum()), 'massimo mm', round(float(push.max()) * 1000, 1))
# obliquo esterno: la sua lamina davanti al retto (aponeurosi) copriva gli addominali; si toglie,
# così si vedono il retto e le sue intersezioni come nelle tavole
def open_rectus():
    rect = [x for x in parts if x['kind'] == 'muscle' and 'rectus abdominis' in x['name'].lower()]
    if not rect: return
    R = np.vstack([x['P'] for x in rect])
    tr = cKDTree(R[:, [1]])
    for x in parts:
        if x['kind'] != 'muscle' or 'external abdominal oblique' not in x['name'].lower(): continue
        P, I = x['P'], x['I']
        C = P[I].mean(1)
        keep = np.ones(len(I), bool)
        for k, c in enumerate(C):
            nb = tr.query_ball_point([c[1]], 0.012)
            if not nb: continue
            rx = np.abs(R[nb, 0]).max()
            if abs(c[0]) < rx - 0.006: keep[k] = False  # il bordo dell'obliquo copre di poco il retto: nessuna fessura
        before = len(I)
        I = I[keep]
        used = np.unique(I); remap = -np.ones(len(P), int); remap[used] = np.arange(len(used))
        x['P'] = P[used]; x['I'] = remap[I]; x['N'] = recompute_normals(x['P'], x['I']); x['full'] = x['P']
        print('obliquo: tolta la lamina davanti al retto', before - len(I), 'triangoli')
open_rectus()

# linea alba: la fascia bianca tra i due retti dell'addome. Senza, tra un retto e l'altro si vedeva la
# colonna vertebrale (una striscia azzurra e frastagliata in mezzo agli addominali)
def linea_alba():
    rect = [x for x in parts if x['kind'] == 'muscle' and 'rectus abdominis' in x['name'].lower()]
    if len(rect) < 2: return
    R = np.vstack([x['P'] for x in rect]); RN = np.vstack([x['N'] for x in rect])
    front = RN[:, 2] > 0.2
    Lm = R[(R[:, 0] > 0) & front]; Rm = R[(R[:, 0] < 0) & front]
    if len(Lm) < 20 or len(Rm) < 20: return
    y0 = max(Lm[:, 1].min(), Rm[:, 1].min()) + 0.004
    y1 = min(Lm[:, 1].max(), Rm[:, 1].max()) - 0.004
    rows = []
    for y in np.arange(y0, y1, 0.005):
        a = Lm[np.abs(Lm[:, 1] - y) < 0.005]; b = Rm[np.abs(Rm[:, 1] - y) < 0.005]
        if len(a) < 2 or len(b) < 2: continue
        pa = a[np.argmin(a[:, 0])]; pb = b[np.argmax(b[:, 0])]
        rows.append([y, pa[0], pa[2], pb[0], pb[2]])
    if len(rows) < 8: return
    rows = np.array(rows)
    # bordi senza denti: media mobile lungo l'altezza
    k = 5; ker = np.ones(k) / k
    for c in range(1, 5):
        pad = np.pad(rows[:, c], (k // 2, k // 2), mode='edge')
        rows[:, c] = np.convolve(pad, ker, mode='valid')
    P, I = [], []
    for y, ax, az, bx, bz in rows:
        # entra di qualche millimetro sotto ogni retto (nessuna fessura), appena incavata in mezzo
        P.append([ax + 0.004, y, az - 0.002]); P.append([(ax + bx) / 2, y, min(az, bz) - 0.0015]); P.append([bx - 0.004, y, bz - 0.002])
    P = np.array(P, float)
    for r in range(len(rows) - 1):
        o = r * 3
        for c in range(2):
            I.append([o + c, o + c + 1, o + 3 + c]); I.append([o + c + 1, o + 4 + c, o + 3 + c])
    I = np.array(I, np.int64)
    N = recompute_normals(P, I)
    if N[:, 2].mean() < 0:
        I = I[:, [0, 2, 1]]; N = recompute_normals(P, I)
    parts.append(dict(kind='muscle', name='Linea alba', P=P, N=N, I=I, full=P, za=True))
    print('linea alba: righe', len(rows), 'larghezza media mm', round(float(np.mean(rows[:, 1] - rows[:, 3])) * 1000, 1))
linea_alba()
inflate_skin()
SP = skin['P']
print('Z-Anatomy: parti', n_za, 'muscoli', sum(1 for x in parts if x['kind'] == 'muscle'), 'triangoli muscoli', sum(len(x['I']) for x in parts if x['kind'] == 'muscle'))

# ---------- pesi per segmento ----------
bone_pts, bone_seg = [], []
for x in parts:
    if x['kind'] != 'bone': continue
    sgm = bone_segment(x['name'])
    if sgm is None or sgm.endswith('_None'):
        x['seg'] = None; continue
    x['seg'] = SI[sgm]
    bone_pts.append(x['P']); bone_seg.append(np.full(len(x['P']), SI[sgm]))
BP = np.vstack(bone_pts); BS = np.concatenate(bone_seg)
trees = {s: cKDTree(BP[BS == s]) for s in range(len(SEGS)) if (BS == s).any()}
SIG = 0.022

def weights_from_dist(D):
    """D: n x S distanze; due segmenti più vicini con pesi morbidi"""
    order = np.argsort(D, 1)[:, :2]
    d0 = np.take_along_axis(D, order[:, :1], 1)[:, 0]; d1 = np.take_along_axis(D, order[:, 1:2], 1)[:, 0]
    w0 = 1 / (1 + np.exp(-(d1 - d0) / SIG * 2.2))
    return order.astype(np.uint8), w0

for x in parts:
    if x['kind'] == 'bone':
        if x.get('seg') is None:
            x['drop'] = True; continue
        n = len(x['P']); x['J'] = np.stack([np.full(n, x['seg']), np.full(n, x['seg'])], 1).astype(np.uint8); x['W'] = np.ones(n)
    elif x['kind'] == 'muscle':
        cand = muscle_candidates(x['name'])
        if not cand:
            print('senza segmenti, tolto:', x['name']); x['drop'] = True; continue
        D = np.full((len(x['P']), len(SEGS)), 9.0)
        for c in cand:
            if SI[c] in trees: D[:, SI[c]] = trees[SI[c]].query(x['P'])[0]
        x['J'], x['W'] = weights_from_dist(D)
        # muscoli dal busto all'omero: seguono il braccio solo vicino all'attacco sull'omero
        if re.search(r"latissimus|pectoralis major|teres major", x['name'], re.I):
            sd = side_of(x['name'])
            hum = by(f"{'Left' if sd == 'L' else 'Right'} humerus")['full']
            top_h = hum[hum[:, 1] > hum[:, 1].max() - 0.12]
            dh = cKDTree(top_h).query(x['P'])[0]
            wa = np.clip((0.05 - dh) / 0.035, 0, 1) ** 1.5
            if re.search(r"teres major", x['name'], re.I):
                base = SI[f'clav_{sd}']
                D2 = D.copy()
            else:
                D2 = D.copy(); D2[:, SI[f'omero_{sd}']] = 9.0
            o, w0 = weights_from_dist(D2)
            base = o[:, 0]
            om = SI[f'omero_{sd}']
            J = np.stack([base, np.full(len(base), om)], 1).astype(np.uint8)
            x['J'], x['W'] = J, 1 - wa

# pelle: etichette sicure vicino alle ossa, poi distanza lungo la superficie (le mani non si attaccano alle cosce)
S = by('Skin'); P = S['P']; I = S['I']
D = np.full((len(P), len(SEGS)), 9.0)
for s, t in trees.items(): D[:, s] = t.query(P)[0]
e = np.vstack([I[:, [0, 1]], I[:, [1, 2]], I[:, [2, 0]]])
L = np.linalg.norm(P[e[:, 0]] - P[e[:, 1]], axis=1)
G = coo_matrix((np.concatenate([L, L]), (np.concatenate([e[:, 0], e[:, 1]]), np.concatenate([e[:, 1], e[:, 0]]))), shape=(len(P), len(P))).tocsr()
srt = np.sort(D, 1)
sure = (srt[:, 0] < 0.03) & (srt[:, 1] - srt[:, 0] > 0.015)
GD = np.full((len(P), len(SEGS)), 9.0)
for s in range(len(SEGS)):
    seeds = np.where(sure & (np.argmin(D, 1) == s))[0]
    if len(seeds): GD[:, s] = np.minimum(dijkstra(G, indices=seeds, min_only=True), 9.0)
S['J'], S['W'] = weights_from_dist(GD)
# dove il braccio a riposo tocca il fianco (o la mano la coscia) la pelle dell'atlante è un'unica superficie:
# quei triangoli, quando il braccio si alza, diventerebbero un lenzuolo tra braccio e busto. Si tolgono.
_dom = np.where(S['W'] >= 0.5, S['J'][:, 0], S['J'][:, 1])
_arm = np.isin(_dom, [SI[k] for k in ('omero_L', 'avambr_L', 'mano_L', 'omero_R', 'avambr_R', 'mano_R')])
_trunk = np.isin(_dom, [SI[k] for k in ('torace', 'bacino', 'coscia_L', 'coscia_R')])
_mixed = _arm[S['I']].any(1) & _trunk[S['I']].any(1) & (S['P'][S['I']].mean(1)[:, 1] < 1.30)
S['I'] = S['I'][~_mixed]
print('pelle: tolti', int(_mixed.sum()), 'triangoli tra braccio e fianco')

parts = [x for x in parts if not x.get('drop')]

# --- controllo: ogni muscolo agganciato a segmenti vicini ---
for x in parts:
    if x['kind'] != 'muscle': continue
    dom = np.where(x['W'] >= 0.5, x['J'][:, 0], x['J'][:, 1])
    far = []
    for sgi in np.unique(dom):
        if sgi in trees:
            dd = trees[sgi].query(x['P'][dom == sgi])[0]
            if np.median(dd) > 0.1: far.append((SEGS[sgi], round(float(np.median(dd)), 3)))
    if far:
        print('tolto, aggancio lontano:', x['name'], far)
        x['drop'] = True
parts = [x for x in parts if not x.get('drop')]
# ---------- fibre, tendini e gruppi ----------
def fan_insertion(name):
    """punto verso cui convergono le fibre dei muscoli a ventaglio (coordinate di riposo)"""
    n = name.lower()
    side = 'L' if n.startswith('left') else 'R' if n.startswith('right') else None
    if side is None: return None
    sh, el, hip = (11, 13, 23) if side == 'L' else (12, 14, 24)
    S, E, H = rest[sh], rest[el], rest[hip]
    lat = np.array([1.0 if side == 'L' else -1.0, 0, 0])
    if re.search(r"deltoid", n): return S + (E - S) * 0.42
    if re.search(r"pectoralis major|latissimus|teres major", n): return S + (E - S) * 0.22
    if re.search(r"trapezius", n): return S - lat * 0.03
    if re.search(r"infraspinatus|supraspinatus|teres minor", n): return S + (E - S) * 0.06
    if re.search(r"gluteus (maximus|medius)", n): return H + lat * 0.08 - np.array([0, 0.06, 0])
    return None

groups = ['']
for x in parts:
    n = len(x['P'])
    x['T'] = np.zeros(n); x['A'] = np.zeros(n); x['TD'] = np.zeros(n); x['g'] = 0
    if x['kind'] != 'muscle':
        # iride: segnata nel canale dei tendini, la scheda grafica la colora scura
        if re.search(r"iris", x['name'], re.I): x['TD'][:] = 1
        continue
    Q = x['P'] - x['P'].mean(0)
    _, sv, vt = np.linalg.svd(Q, full_matrices=False)
    # direzione delle fibre: da un attacco all'altro (dalla parte del primo segmento a quella del secondo),
    # come nelle tavole: il pettorale va dallo sterno all'omero, il dorsale dalla schiena al braccio
    ax = vt[0]
    Jm, Wm = x.get('J'), x.get('W')
    if Jm is not None and Wm is not None:
        dom = np.where(Wm >= 0.5, Jm[:, 0], Jm[:, 1])
        segs, cnt = np.unique(dom, return_counts=True)
        if len(segs) >= 2:
            o = np.argsort(-cnt)[:2]
            if cnt[o[1]] >= 0.12 * len(dom):
                ca = x['P'][dom == segs[o[0]]].mean(0); cb = x['P'][dom == segs[o[1]]].mean(0)
                d = cb - ca
                if np.linalg.norm(d) > 0.02: ax = d / np.linalg.norm(d)
    if 'rectus abdominis' in x['name'].lower() and ax[1] < 0: ax = -ax  # dal pube verso lo sterno
    t = Q @ ax; t = (t - t.min()) / max(1e-6, t.max() - t.min())
    # di traverso: l'asse più largo tra quelli perpendicolari alle fibre (niente cucitura come con l'angolo)
    R = Q - np.outer(Q @ ax, ax)
    _, _, vt2 = np.linalg.svd(R, full_matrices=False)
    c2 = R @ vt2[0]
    wdt = max(1e-6, c2.max() - c2.min())
    # righe ogni 4-5 mm sui muscoli stretti, più larghe sui muscoli molto larghi
    a = (c2 - c2.min()) / max(wdt, 0.15)
    # muscoli a ventaglio (pettorale, dorsale, deltoide, trapezio, glutei): le fibre convergono
    # verso l'inserzione, come nelle tavole anatomiche
    ins = fan_insertion(x['name'])
    if ins is not None:
        V = x['P'] - ins
        nrm = vt[2]
        Vp = V - np.outer(V @ nrm, nrm)
        dist = np.linalg.norm(Vp, axis=1)
        b1 = Vp.mean(0); b1 = b1 / max(1e-9, np.linalg.norm(b1)); b2 = np.cross(nrm, b1)
        th = np.arctan2(Vp @ b2, Vp @ b1)
        arc = (th - th.min()) * np.median(dist)
        a = arc / max(arc.max(), 0.15)
        t = (dist - dist.min()) / max(1e-6, dist.max() - dist.min())
    x['T'] = t; x['A'] = a
    long_ = sv[0] / max(sv[1], 1e-6) > 3.2
    # tendini chiari alle estremità dei muscoli lunghi (braccia, gambe, collo)
    if long_ or 'calcaneal' in x['name'].lower():
        tl = np.clip(Q @ vt[0], None, None); tl = (tl - tl.min()) / max(1e-6, tl.max() - tl.min())
        x['TD'] = np.clip(np.maximum((0.1 - tl) / 0.08, (tl - 0.9) / 0.08), 0, 1)
    if 'calcaneal' in x['name'].lower() or 'linea alba' in x['name'].lower(): x['TD'][:] = 1
    # retto dell'addome: tre intersezioni tendinee chiare (i "quadretti" degli addominali)
    if 'rectus abdominis' in x['name'].lower():
        tt = x['T']
        cuts = (0.46, 0.66, 0.84)
        band = np.zeros(n)
        for c in cuts:
            band = np.maximum(band, np.clip((1 - np.abs(tt - c) / 0.014) * 1.6, 0, 1))
        x['TD'] = np.maximum(x['TD'], band * 0.7)
        # rilievo vero dei "quadretti": ogni tratto tra due intersezioni si gonfia in avanti,
        # le intersezioni restano incavate (si leggono anche con la luce, non solo col colore)
        edges = (0.0,) + cuts + (1.0,)
        prof = np.zeros(n)
        for a0, a1 in zip(edges[:-1], edges[1:]):
            inside = (tt >= a0) & (tt <= a1)
            u = (tt[inside] - a0) / max(1e-6, a1 - a0)
            prof[inside] = np.sin(np.pi * u) ** 0.7
        front = np.clip((x['N'][:, 2] - 0.2) / 0.5, 0, 1)
        x['P'] = x['P'] + x['N'] * (0.0045 * prof * front - 0.0015 * band * front)[:, None]
        x['N'] = recompute_normals(x['P'], x['I'])
        if 'full' in x: x['full'] = x['P']
    g = muscle_group(x['name'])
    if g:
        if g not in groups: groups.append(g)
        x['g'] = groups.index(g)

# ---------- scrittura ----------
def write(parts, OUT, lo=None, hi=None):
    LAY = {'skin': 0, 'bone': 1, 'muscle': 2}
    allP = np.vstack([x['P'] for x in parts])
    if lo is None:
        lo = allP.min(0) - 0.001; hi = allP.max(0) + 0.001
    batches = []
    blob = bytearray()
    def align4():
        while len(blob) % 4: blob.append(0)
    for kind in ('bone', 'muscle', 'skin'):
        group = [x for x in parts if x['kind'] == kind]
        cur, cnt = [], 0
        chunks = []
        for x in group:
            if cnt + len(x['P']) > 65000 and cur: chunks.append(cur); cur, cnt = [], 0
            cur.append(x); cnt += len(x['P'])
        if cur: chunks.append(cur)
        for ch in chunks:
            P = np.vstack([x['P'] for x in ch]); N = np.vstack([x['N'] for x in ch])
            off = np.cumsum([0] + [len(x['P']) for x in ch[:-1]])
            I = np.vstack([x['I'] + o for x, o in zip(ch, off)])
            J = np.vstack([x['J'] for x in ch]); W = np.concatenate([x['W'] for x in ch])
            T = np.concatenate([x['T'] for x in ch]); Aa = np.concatenate([x['A'] for x in ch]); TD = np.concatenate([x['TD'] for x in ch])
            Gp = np.concatenate([np.full(len(x['P']), x['g']) for x in ch])
            q = np.round((P - lo) / (hi - lo) * 65535).astype(np.uint16)
            nq = np.round(np.clip(N, -1, 1) * 127).astype(np.int8)
            # vertice: 6 posizione + 4 normale (+1 vuoto) + 2 segmenti + 1 peso + 1 gruppo + 1 fibra + 1 giro + 1 tendine + 1 vuoto = 18 -> 20
            # vertice da 16 byte: posizione 6, normale 3, segmenti 2, peso, gruppo, fibra, giro, tendine
            V = np.zeros((len(P), 16), np.uint8)
            V[:, 0:6] = np.ascontiguousarray(q).view(np.uint8).reshape(-1, 6)
            V[:, 6:9] = np.ascontiguousarray(nq).view(np.uint8).reshape(-1, 3)
            V[:, 9:11] = J
            V[:, 11] = np.round(W * 255)
            V[:, 12] = Gp
            V[:, 13] = np.round(T * 255); V[:, 14] = np.round(Aa * 255); V[:, 15] = np.round(TD * 255)
            align4(); vo = len(blob); blob.extend(V.tobytes())
            align4(); io = len(blob); blob.extend(I.astype(np.uint16).tobytes())
            batches.append(dict(layer=kind, vertices=int(len(P)), indices=int(I.size), vOffset=vo, iOffset=io))
            print(kind, 'blocco', len(P), 'vertici', len(I), 'triangoli')

    def r3(v): return [round(float(c), 4) for c in v]
    meta = dict(
        version=3,
        source='BodyParts3D, © The Database Center for Life Science, licensed under CC BY 4.0 (https://dbarchive.biosciencedbc.jp/en/bodyparts3d/lic.html). Muscoli e cartilagini costali da Z-Anatomy (CC BY-SA 4.0, https://github.com/Z-Anatomy/Models-of-human-anatomy), portati sulle ossa di BodyParts3D osso per osso. Geometria adattata per Arcieri Amiconi.',
        lo=r3(lo), hi=r3(hi), stride=16, segments=SEGS, groups=groups,
        rest={str(k): r3(v) for k, v in rest.items()},
        batches=batches, bytes=len(blob),
    )
    import gzip
    open(OUT + '.bin', 'wb').write(blob)
    # compresso: il sito lo scarica così e lo apre nel telefono (DecompressionStream)
    open(OUT + '.bin.gz', 'wb').write(gzip.compress(bytes(blob), 9))
    json.dump(meta, open(OUT + '.json', 'w'), ensure_ascii=False)
    print('scritto', OUT, len(blob), 'byte', 'gruppi', len(groups))
    return lo, hi

lo_, hi_ = write(parts, OUT)

# versione leggera per il movimento: stesse parti semplificate (stessi pesi e gruppi sui vertici rimasti)
if not os.environ.get('NOLIGHT'):
    light = []
    for x in parts:
        nt = len(x['I'])
        # addominali e muscoli del busto davanti: più triangoli anche nel leggero (si vedono da vicino)
        keepmore = re.search(r"rectus abdominis|external abdominal oblique|pectoralis", x['name'], re.I)
        target = max(40, int(nt * (0.55 if keepmore else 0.28 if x['kind'] != 'skin' else 0.4)))
        if nt <= 60:
            light.append(x); continue
        P2, I2, used = qem_simplify(x['P'], x['I'], target)
        y = dict(x); y['P'] = P2; y['I'] = I2
        for k in ('J', 'W', 'T', 'A', 'TD'):
            y[k] = x[k][used]
        y['N'] = recompute_normals(P2, I2)
        light.append(y)
    print('leggero: triangoli', sum(len(x['I']) for x in light))
    write(light, OUT.replace('corpo', 'corpo-leggero') if 'corpo' in OUT.split('/')[-1] else OUT + '-leggero', lo_, hi_)
# --- diagnostica pelle (solo quando richiesto) ---
if os.environ.get('DIAG'):
    S = by('Skin'); J = S['J']; W = S['W']; I = S['I']; P = S['P']
    dom = np.where(W >= 0.5, J[:, 0], J[:, 1])
    arm = np.isin(dom, [SI['omero_L'], SI['avambr_L'], SI['mano_L'], SI['omero_R'], SI['avambr_R'], SI['mano_R']])
    trunk = np.isin(dom, [SI['torace'], SI['bacino'], SI['coscia_L'], SI['coscia_R']])
    mixed = (arm[I].any(1)) & (trunk[I].any(1))
    cy = P[I].mean(1)[:, 1]
    print('triangoli misti braccio-busto', mixed.sum(), 'sotto l\'ascella', (mixed & (cy < 1.30)).sum())
    e = np.linalg.norm(P[I[:, 0]] - P[I[:, 1]], axis=1)
    print('lunghezza media lati misti mm', round(e[mixed].mean() * 1000, 1), 'tutti', round(e.mean() * 1000, 1))
