"""
Lettore del formato EXT_meshopt_compression (glTF), scritto dalle specifiche pubbliche del formato:
codifica dei vertici (versione 0) e dei triangoli (versioni 0 e 1), filtro OCTAHEDRAL.
Serve solo a leggere i muscoli di Z-Anatomy nel file glb compresso.
"""
import numpy as np


def _unzigzag8(v):
    v = v.astype(np.int16)
    return ((-(v & 1)) ^ (v >> 1)).astype(np.int16)


def _decode_bytes_group(data, pos, bits):
    """16 valori; ritorna (valori, nuova posizione)"""
    if bits == 0:
        return np.zeros(16, np.uint8), pos
    if bits == 3:
        return np.frombuffer(data, np.uint8, 16, pos).copy(), pos + 16
    nb = 2 if bits == 1 else 4
    packed_len = 4 if bits == 1 else 8
    raw = data[pos:pos + packed_len]
    extra = pos + packed_len
    out = np.zeros(16, np.uint8)
    sentinel = (1 << nb) - 1
    k = 0
    for byte in raw:
        for s in range(8 // nb):
            enc = (byte >> (8 - nb * (s + 1))) & sentinel
            if enc == sentinel:
                out[k] = data[extra]
                extra += 1
            else:
                out[k] = enc
            k += 1
    return out, extra


def _decode_bytes(data, pos, size):
    header_size = ((size // 16) + 3) // 4
    header = data[pos:pos + header_size]
    pos += header_size
    out = np.empty(size, np.uint8)
    for g in range(size // 16):
        bits = (header[g // 4] >> ((g % 4) * 2)) & 3
        vals, pos = _decode_bytes_group(data, pos, bits)
        out[g * 16:(g + 1) * 16] = vals
    return out, pos


def decode_vertex_buffer(data: bytes, count: int, stride: int) -> np.ndarray:
    if data[0] != 0xA0:
        raise ValueError("versione dei vertici non supportata: %x" % data[0])
    block = min(256, (8192 // stride) & ~15)
    last = np.frombuffer(data, np.uint8, stride, len(data) - stride).copy()
    out = np.empty((count, stride), np.uint8)
    pos = 1
    done = 0
    while done < count:
        n = min(block, count - done)
        aligned = (n + 15) & ~15
        for k in range(stride):
            buf, pos = _decode_bytes(data, pos, aligned)
            d = _unzigzag8(buf[:n])
            vals = (np.cumsum(d, dtype=np.int64) + int(last[k])) & 0xFF
            out[done:done + n, k] = vals
        last = out[done + n - 1].copy()
        done += n
    return out


def _vbyte(data, pos):
    result = 0
    shift = 0
    while True:
        b = data[pos]
        pos += 1
        result |= (b & 127) << shift
        shift += 7
        if b < 128:
            return result, pos


def decode_index_buffer(data: bytes, count: int) -> np.ndarray:
    header = data[0]
    if header & 0xF0 != 0xE0:
        raise ValueError("formato degli indici sconosciuto")
    version = header & 0x0F
    fecmax = 13 if version >= 1 else 15
    tri = count // 3
    code = 1
    pos = 1 + tri
    aux = data[len(data) - 16:]
    vf = [0] * 16
    ef = [[0, 0] for _ in range(16)]
    vo = 0
    eo = 0
    nxt = 0
    last = 0
    out = np.empty(count, np.uint32)
    M = 0xFFFFFFFF

    def dec_index(pos, last):
        v, pos = _vbyte(data, pos)
        d = (v >> 1) ^ -(v & 1)
        return (last + d) & M, pos

    for i in range(0, count, 3):
        ct = data[code]
        code += 1
        if ct < 0xF0:
            fe = ct >> 4
            a, b = ef[(eo - 1 - fe) & 15]
            fec = ct & 15
            if fec < fecmax:
                if fec == 0:
                    c = nxt
                    nxt += 1
                    vf[vo] = c
                    vo = (vo + 1) & 15
                else:
                    c = vf[(vo - 1 - fec) & 15]
                    vf[vo] = c  # scritto ma non avanza
            else:
                if fec != 15:
                    c = (last + (fec - (fec ^ 3))) & M
                else:
                    c, pos = dec_index(pos, last)
                last = c
                vf[vo] = c
                vo = (vo + 1) & 15
            out[i], out[i + 1], out[i + 2] = a, b, c
            ef[eo] = [c, b]
            eo = (eo + 1) & 15
            ef[eo] = [a, c]
            eo = (eo + 1) & 15
        elif ct < 0xFE:
            ca = aux[ct & 15]
            feb = ca >> 4
            fec = ca & 15
            a = nxt
            nxt += 1
            if feb == 0:
                b = nxt
                nxt += 1
            else:
                b = vf[(vo - feb) & 15]
            if fec == 0:
                c = nxt
                nxt += 1
            else:
                c = vf[(vo - fec) & 15]
            out[i], out[i + 1], out[i + 2] = a, b, c
            vf[vo] = a
            vo = (vo + 1) & 15
            vf[vo] = b
            vo = (vo + (1 if feb == 0 else 0)) & 15
            vf[vo] = c
            vo = (vo + (1 if fec == 0 else 0)) & 15
            ef[eo] = [b, a]
            eo = (eo + 1) & 15
            ef[eo] = [c, b]
            eo = (eo + 1) & 15
            ef[eo] = [a, c]
            eo = (eo + 1) & 15
        else:
            ca = data[pos]
            pos += 1
            fea = 0 if ct == 0xFE else 15
            feb = ca >> 4
            fec = ca & 15
            if ca == 0:
                nxt = 0
            if fea == 0:
                a = nxt
                nxt += 1
            else:
                a = 0
            if feb == 0:
                b = nxt
                nxt += 1
            else:
                b = vf[(vo - feb) & 15]
            if fec == 0:
                c = nxt
                nxt += 1
            else:
                c = vf[(vo - fec) & 15]
            if fea == 15:
                a, pos = dec_index(pos, last)
                last = a
            if feb == 15:
                b, pos = dec_index(pos, last)
                last = b
            if fec == 15:
                c, pos = dec_index(pos, last)
                last = c
            out[i], out[i + 1], out[i + 2] = a, b, c
            vf[vo] = a
            vo = (vo + 1) & 15
            vf[vo] = b
            vo = (vo + (1 if (feb == 0 or feb == 15) else 0)) & 15
            vf[vo] = c
            vo = (vo + (1 if (fec == 0 or fec == 15) else 0)) & 15
            ef[eo] = [b, a]
            eo = (eo + 1) & 15
            ef[eo] = [c, b]
            eo = (eo + 1) & 15
            ef[eo] = [a, c]
            eo = (eo + 1) & 15
    return out


def octahedral_int8(raw: np.ndarray) -> np.ndarray:
    """raw: n x 4 byte del filtro OCTAHEDRAL a 8 bit -> normali n x 3 (float)"""
    v = raw.view(np.int8).astype(np.float64)
    x, y = v[:, 0].copy(), v[:, 1].copy()
    z = v[:, 2] - np.abs(x) - np.abs(y)
    t = np.minimum(z, 0)
    x += np.where(x >= 0, t, -t)
    y += np.where(y >= 0, t, -t)
    n = np.stack([x, y, z], 1)
    return n / np.maximum(np.linalg.norm(n, axis=1, keepdims=True), 1e-9)
