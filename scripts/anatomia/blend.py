"""lettore minimo di file .blend (Blender 3.x, 64 bit, little endian, non compresso)"""
import struct, numpy as np, re

class Blend:
    def __init__(self, path):
        self.buf = buf = memoryview(open(path, 'rb').read())
        assert bytes(buf[:7]) == b'BLENDER' and bytes(buf[7:9]) == b'-v'
        self.ver = int(bytes(buf[9:12]))
        off = 12
        self.blocks = []  # (code, size, oldptr, sdna, count, dataoff)
        self.byptr = {}
        while off < len(buf):
            code = bytes(buf[off:off + 4]); size, = struct.unpack_from('<i', buf, off + 4)
            ptr, = struct.unpack_from('<Q', buf, off + 8); sdna, count = struct.unpack_from('<ii', buf, off + 16)
            data = off + 24
            if code == b'ENDB': break
            blk = (code, size, ptr, sdna, count, data)
            if ptr: self.byptr.setdefault(ptr, []).append(len(self.blocks))
            self.blocks.append(blk + (len(self.blocks),))
            if code == b'DNA1': self._dna(data)
            off = data + size

    def _dna(self, o):
        b = self.buf; s0 = o
        al = lambda x: s0 + ((x - s0 + 3) & ~3)
        assert bytes(b[o:o + 8]) == b'SDNANAME'
        o += 8; n, = struct.unpack_from('<i', b, o); o += 4
        names = []
        for _ in range(n):
            e = bytes(b[o:o + 300]).index(b'\0'); names.append(bytes(b[o:o + e]).decode()); o += e + 1
        o = al(o); assert bytes(b[o:o + 4]) == b'TYPE'; o += 4
        n, = struct.unpack_from('<i', b, o); o += 4; types = []
        for _ in range(n):
            e = bytes(b[o:o + 300]).index(b'\0'); types.append(bytes(b[o:o + e]).decode()); o += e + 1
        o = al(o); assert bytes(b[o:o + 4]) == b'TLEN'; o += 4
        tlen = list(struct.unpack_from('<%dh' % n, b, o)); o += 2 * n
        o = al(o); assert bytes(b[o:o + 4]) == b'STRC'; o += 4
        ns, = struct.unpack_from('<i', b, o); o += 4
        self.names, self.types, self.tlen = names, types, tlen
        self.tidx = {t: i for i, t in enumerate(types)}
        self.structs = []; self.sbytype = {}
        for i in range(ns):
            t, nf = struct.unpack_from('<hh', b, o); o += 4
            fields = []; foff = 0
            for _ in range(nf):
                ft, fn = struct.unpack_from('<hh', b, o); o += 4
                name = names[fn]
                arr = 1
                for m in re.findall(r'\[(\d+)\]', name): arr *= int(m)
                isptr = name.startswith('*') or name.startswith('(*')
                size = (8 if isptr else tlen[ft]) * arr
                base = re.sub(r'\[.*', '', name).lstrip('*').strip('()*')
                if name.startswith('(*'): base = name[2:name.index(')')]
                fields.append(dict(name=base, raw=name, type=types[ft], off=foff, size=size, ptr=isptr, arr=arr))
                foff += size
            self.structs.append((types[t], {f['name']: f for f in fields}, fields))
            self.sbytype[types[t]] = i

    def sname(self, blk): return self.structs[blk[3]][0]

    def field(self, blk, name, idx=0):
        """legge un campo semplice del blocco (struttura all'indice idx)"""
        st = self.structs[blk[3]]
        return self.read_field(blk[5] + idx * self.tlen[self.tidx[st[0]]], st[0], name)

    def read_field(self, off, stype, path):
        st = self.structs[self.sbytype[stype]]
        parts = path.split('.')
        f = st[1][parts[0]]
        if len(parts) > 1: return self.read_field(off + f['off'], f['type'], '.'.join(parts[1:]))
        o = off + f['off']; b = self.buf
        if f['ptr']:
            if f['arr'] == 1: return struct.unpack_from('<Q', b, o)[0]
            return struct.unpack_from('<%dQ' % f['arr'], b, o)
        fmt = {'char': 'b', 'uchar': 'B', 'short': 'h', 'ushort': 'H', 'int': 'i', 'float': 'f', 'double': 'd', 'int64_t': 'q', 'uint64_t': 'Q', 'int8_t': 'b', 'uint8_t': 'B', 'int16_t': 'h', 'uint16_t': 'H', 'int32_t': 'i', 'uint32_t': 'I'}.get(f['type'])
        if fmt is None: return o  # struttura annidata: ritorna l'offset
        if f['type'] == 'char' and f['arr'] > 1:
            s = bytes(b[o:o + f['arr']]); return s[:s.index(b'\0')].decode('utf8', 'replace') if b'\0' in s else s.decode('utf8', 'replace')
        if f['arr'] == 1: return struct.unpack_from('<' + fmt, b, o)[0]
        return np.frombuffer(b, dtype='<' + fmt, count=f['arr'], offset=o).copy() if fmt not in 'bB' or True else None

    def blk(self, ptr, after=None):
        """blocco con quel puntatore; con 'after' prende il primo scritto dopo quel blocco (puntatori riusati)"""
        l = self.byptr.get(ptr)
        if not l: return None
        if after is not None and len(l) > 1:
            i = after[6]
            for k in l:
                if k > i: return self.blocks[k]
        return self.blocks[l[0]]

    def arr(self, ptr, dtype, cols=None):
        b = self.blk(ptr)
        if b is None: return None
        a = np.frombuffer(self.buf, dtype=dtype, count=b[1] // np.dtype(dtype).itemsize, offset=b[5])
        return a.reshape(-1, cols) if cols else a

    def listbase(self, off, stype='ListBase'):
        first, = struct.unpack_from('<Q', self.buf, off)
        out = []; p = first
        while p:
            bl = self.blk(p)
            if bl is None: break
            out.append(bl)
            p = struct.unpack_from('<Q', self.buf, bl[5])[0]  # next
        return out
