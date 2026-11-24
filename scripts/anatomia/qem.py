"""
Semplificazione per collasso di spigoli con errore quadratico (Garland-Heckbert), senza librerie esterne.
Mantiene la superficie chiusa: non collassa spigoli che creerebbero pieghe non valide o facce rovesciate.
"""
import heapq
import numpy as np


def simplify(P, F, target_faces, max_err=None):
    P = P.astype(np.float64).copy()
    F = F.astype(np.int64).copy()
    n = len(P)
    # quadriche per vertice
    v0, v1, v2 = P[F[:, 0]], P[F[:, 1]], P[F[:, 2]]
    nrm = np.cross(v1 - v0, v2 - v0)
    area = np.linalg.norm(nrm, axis=1)
    nn = nrm / np.maximum(area[:, None], 1e-18)
    d = -np.einsum('ij,ij->i', nn, v0)
    pl = np.concatenate([nn, d[:, None]], 1)
    K = np.einsum('fi,fj->fij', pl, pl) * area[:, None, None]
    Q = np.zeros((n, 4, 4))
    for k in range(3):
        np.add.at(Q, F[:, k], K)
    vf = [set() for _ in range(n)]
    for fi, (a, b, c) in enumerate(F):
        vf[a].add(fi); vf[b].add(fi); vf[c].add(fi)
    alive = np.ones(len(F), bool)
    valive = np.ones(n, bool)
    # spigoli di bordo: i vertici restano fermi
    edge_count = {}
    for a, b, c in F:
        for x, y in ((a, b), (b, c), (c, a)):
            k = (x, y) if x < y else (y, x)
            edge_count[k] = edge_count.get(k, 0) + 1
    locked = np.zeros(n, bool)
    for (x, y), cnt in edge_count.items():
        if cnt != 2:
            locked[x] = locked[y] = True
    stamp = np.zeros(n, np.int64)

    def cost(a, b):
        q = Q[a] + Q[b]
        A = q[:3, :3]; bb = -q[:3, 3]
        cand = []
        if abs(np.linalg.det(A)) > 1e-14:
            x = np.linalg.solve(A, bb)
            # non lontano dallo spigolo
            mid = (P[a] + P[b]) / 2
            if np.linalg.norm(x - mid) < 2 * np.linalg.norm(P[a] - P[b]) + 1e-9:
                cand.append(x)
        cand += [P[a], P[b], (P[a] + P[b]) / 2]
        best, bx = None, None
        for x in cand:
            h = np.append(x, 1.0)
            e = h @ q @ h
            if best is None or e < best:
                best, bx = e, x
        return max(best, 0.0), bx

    heap = []
    for (x, y) in edge_count:
        if locked[x] or locked[y]:
            continue
        c, _ = cost(x, y)
        heap.append((c, x, y, 0, 0))
    heapq.heapify(heap)
    faces_left = int(alive.sum())

    def neighbors(v):
        s = set()
        for f in vf[v]:
            s.update(F[f])
        s.discard(v)
        return s

    while faces_left > target_faces and heap:
        c, a, b, sa, sb = heapq.heappop(heap)
        if not (valive[a] and valive[b]) or stamp[a] != sa or stamp[b] != sb:
            continue
        if max_err is not None and c > max_err:
            break
        shared = vf[a] & vf[b]
        if len(shared) != 2:
            continue
        # condizione di collegamento: i vicini comuni sono solo i due vertici opposti
        opp = set()
        for f in shared:
            opp.update(F[f])
        opp -= {a, b}
        if neighbors(a) & neighbors(b) != opp:
            continue
        _, x = cost(a, b)
        # nessuna faccia rovesciata
        ok = True
        for v in (a, b):
            for f in vf[v] - shared:
                tri = F[f].copy()
                p = P[tri]
                old = np.cross(p[1] - p[0], p[2] - p[0])
                p2 = p.copy()
                for k in range(3):
                    if tri[k] in (a, b):
                        p2[k] = x
                new = np.cross(p2[1] - p2[0], p2[2] - p2[0])
                ln, lo = np.linalg.norm(new), np.linalg.norm(old)
                if ln < 1e-14 or np.dot(new, old) < 0.2 * ln * lo:
                    ok = False
                    break
            if not ok:
                break
        if not ok:
            continue
        # collasso: b sparisce dentro a
        P[a] = x
        Q[a] = Q[a] + Q[b]
        for f in shared:
            alive[f] = False
            for v in F[f]:
                vf[v].discard(f)
            faces_left -= 1
        for f in list(vf[b]):
            F[f][F[f] == b] = a
            vf[a].add(f)
        vf[b] = set()
        valive[b] = False
        stamp[a] += 1
        for v in neighbors(a):
            if locked[v] or locked[a]:
                continue
            cc, _ = cost(a, v)
            heapq.heappush(heap, (cc, a, v, stamp[a], stamp[v]) if True else None)
    F2 = F[alive]
    used = np.unique(F2)
    remap = -np.ones(n, np.int64)
    remap[used] = np.arange(len(used))
    return P[used], remap[F2], used
