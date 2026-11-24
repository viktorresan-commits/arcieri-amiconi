"""
Corpo anatomico per l'analisi del gesto, da BodyParts3D (CC BY 4.0, Database Center for Life Science).
Seleziona pelle, ossa e muscoli, li semplifica, calcola i pesi per segmento (per muovere il modello con
la posa del video), il gruppo muscolare di ogni muscolo e le coordinate delle fibre. Scrive un file
binario compatto e un indice JSON.
"""
import json, re, sys, struct
import numpy as np
from scipy.sparse import coo_matrix
from scipy.sparse.csgraph import dijkstra
from scipy.spatial import cKDTree
sys.path.insert(0, '.')
from load import A, part
from pick import classify
from decimate import recompute_normals

OUT = sys.argv[1] if len(sys.argv) > 1 else '/tmp/corpo'
# muscoli profondi, coperti da altri: non si vedono mai, si risparmia peso
DEEP = re.compile(r"vastus intermedius|gluteus minimus|iliacus|psoas|tibialis posterior|flexor digitorum profundus|supinator|pronator quadratus|scalen|longissimus (capitis|cervicis)|iliocostalis cervicis|subscapularis|pectoralis minor|flexor hallucis longus|flexor digitorum longus|extensor indicis|extensor pollicis|abductor pollicis longus|flexor pollicis longus", re.I)
EYE = re.compile(r"(superior|inferior|lateral|medial) rectus$|(superior|inferior) oblique$|perineal", re.I)

# ---------- segmenti ----------
SEGS = ['bacino', 'torace', 'testa', 'clav_L', 'omero_L', 'avambr_L', 'mano_L', 'clav_R', 'omero_R', 'avambr_R', 'mano_R',
        'coscia_L', 'gamba_L', 'piede_L', 'coscia_R', 'gamba_R', 'piede_R']
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
    if re.search(r"scaphoid|lunate|triquetral|pisiform|trapezium|trapezoid|capitate|hamate|metacarpal|finger|thumb", n): return f'mano_{s}'
    if re.search(r"femur|patella", n): return f'coscia_{s}'
    if re.search(r"tibia|fibula", n): return f'gamba_{s}'
    if re.search(r"talus|calcaneus|navicular|cuboid|cuneiform|metatarsal|toe", n): return f'piede_{s}'
    if re.search(r"clavicle|scapula", n): return f'clav_{s}'
    if re.search(r"hip bone|sacrum|coccyx|lumbar", n): return 'bacino'
    if re.search(r"thoracic vertebra|rib|sternum|manubrium|xiphoid|costal", n): return 'torace'
    if re.search(r"(fifth|sixth|seventh) cervical", n): return 'torace'
    if re.search(r"cervical|atlas|axis", n): return 'testa'
    if re.search(r"frontal|parietal|occipital|temporal|maxilla|zygomatic|mandible|nasal|skull", n): return 'testa'
    return None

def muscle_candidates(name):
    n = name.lower(); s = side_of(name)
    sides = [s] if s else ['L', 'R']
    def seg(*names): return [f'{x}_{sd}' if x not in ('bacino', 'torace', 'testa') else x for x in names for sd in sides]
    if re.search(r"biceps brachii|brachialis|triceps|anconeus|coracobrachialis", n): return seg('clav', 'omero', 'avambr')
    if re.search(r"carpi|digitorum superficialis|digitorum profundus|pronator|supinator|palmaris|brachioradialis|extensor digitorum$|extensor digiti minimi$|extensor indicis|pollicis longus|pollicis brevis$|abductor pollicis longus|extensor pollicis", n) and 'foot' not in n:
        return seg('omero', 'avambr', 'mano')
    if re.search(r"hand|pollicis|opponens", n): return seg('avambr', 'mano')
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
        (r"pollicis|opponens|digiti minimi of (left|right) hand", 'mano'),
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
    if k == 'muscle' and DEEP.search(p['name']): continue
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

surf = torso_field()
for s, sg in (('Left', 1), ('Right', -1)):
    hum = by(f'{s} humerus')['full']
    ins = hum[(hum[:, 1] > hum[:, 1].max() - 0.09) & (hum[:, 1] < hum[:, 1].max() - 0.05)].mean(0) + np.array([-sg * 0.012, 0, 0.0])
    def lat(u, v, sg=sg, ins=ins):
        yb = 0.985 + 0.05 * u; yt = 1.22 + 0.15 * u ** 0.8
        y = yb + (yt - yb) * v
        t = sg * np.radians(178 - 80 * u - 10 * v * u)
        k = max(0.0, (u - 0.6) / 0.4) * max(0.0, (v - 0.55) / 0.45)
        return y, t, (k ** 1.3 * 0.9, ins), 1.0 + 1.4 * u
    V, N, I = sheet(lat, 14, 18, 0.004, 0.006)
    parts.append(dict(kind='muscle', name=f'{s} latissimus dorsi', P=V, N=N, I=I, full=V))
    def rab(u, v, sg=sg):
        y = 0.94 + 0.31 * v
        r = 0.16
        w = (0.012 + 0.06 * u * (0.75 + 0.35 * v)) / r
        return y, sg * w, (0.0, np.zeros(3)), 1.0
    V, N, I = sheet(rab, 6, 16, 0.003, 0.008)
    parts.append(dict(kind='muscle', name=f'{s} rectus abdominis', P=V, N=N, I=I, full=V))

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

parts = [x for x in parts if not x.get('drop')]

# ---------- fibre, tendini e gruppi ----------
groups = ['']
for x in parts:
    n = len(x['P'])
    x['T'] = np.zeros(n); x['A'] = np.zeros(n); x['TD'] = np.zeros(n); x['g'] = 0
    if x['kind'] != 'muscle': continue
    Q = x['P'] - x['P'].mean(0)
    _, sv, vt = np.linalg.svd(Q, full_matrices=False)
    ax = vt[0]
    t = Q @ ax; t = (t - t.min()) / max(1e-6, t.max() - t.min())
    a = np.arctan2(Q @ vt[2], Q @ vt[1]); a = (a + np.pi) / (2 * np.pi)
    x['T'] = t; x['A'] = a
    long_ = sv[0] / max(sv[1], 1e-6) > 3.2
    if long_ or 'calcaneal' in x['name'].lower():
        x['TD'] = np.clip(np.maximum((0.12 - t) / 0.1, (t - 0.88) / 0.1), 0, 1)
    if 'calcaneal' in x['name'].lower(): x['TD'][:] = 1
    if 'rectus abdominis' in x['name'].lower():
        yv = x['P'][:, 1]
        x['TD'] = np.clip(1 - np.min(np.abs(yv[:, None] - np.array([1.02, 1.1, 1.17, 1.235])[None]), 1) / 0.006, 0, 1) * 0.9
    g = muscle_group(x['name'])
    if g:
        if g not in groups: groups.append(g)
        x['g'] = groups.index(g)

# ---------- scrittura ----------
LAY = {'skin': 0, 'bone': 1, 'muscle': 2}
allP = np.vstack([x['P'] for x in parts])
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
        V[:, 0:6] = q.view(np.uint8).reshape(-1, 6)
        V[:, 6:9] = nq.view(np.uint8).reshape(-1, 3)
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
    version=2,
    source='BodyParts3D, © The Database Center for Life Science, licensed under CC BY 4.0 (https://dbarchive.biosciencedbc.jp/en/bodyparts3d/lic.html). Geometria semplificata e adattata per Arcieri Amiconi; gran dorsale e retto dell\'addome aggiunti.',
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
