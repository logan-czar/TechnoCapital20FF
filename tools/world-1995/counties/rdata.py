"""A small reader for R's `save()` files (`.Rdata`, XDR format, versions 2 and 3), enough for a
data frame of numbers, strings and factors. Standard library only.

The format is R's serialization (R Internals, "Serialization Formats"): after the header, each item
is a 32-bit flags word (type in the low byte; bits 8 to 10 say whether it is an object and has
attributes and a tag) and then its payload, all big-endian.

    load(path) -> {name: value}
    A data frame comes back as a dict of column name to list; a factor as its labels; NA as None.
"""

import bz2
import gzip
import lzma
import struct

NA_INT = -(2**31)
# R's NA_real_ is a NaN with the low word 1954.
NA_REAL_LOW = 1954

NILVALUE, REFSXP, ALTREP = 254, 255, 238
SYMSXP, LISTSXP, CLOSXP, ENVSXP, PROMSXP, LANGSXP = 1, 2, 3, 4, 5, 6
CHARSXP, LGLSXP, INTSXP, REALSXP, STRSXP, VECSXP, EXPRSXP = 9, 10, 13, 14, 16, 19, 20
EXTPTRSXP, RAWSXP = 22, 24
GLOBALENV, EMPTYENV, BASEENV, MISSINGARG, UNBOUND, BASENAMESPACE = 253, 242, 241, 251, 252, 247
NAMESPACESXP, PACKAGESXP, PERSISTSXP = 249, 250, 247


class Obj:
    """A value with its attributes."""

    def __init__(self, value, attrs):
        self.value = value
        self.attrs = attrs


class Reader:
    def __init__(self, data: bytes):
        self.d = data
        self.p = 0
        self.refs: list = []

    def int(self) -> int:
        v = struct.unpack_from(">i", self.d, self.p)[0]
        self.p += 4
        return v

    def length(self) -> int:
        n = self.int()
        if n == -1:  # a long vector: two words
            hi, lo = self.int(), self.int()
            n = (hi << 32) + (lo & 0xFFFFFFFF)
        return n

    def chars(self, flags: int):
        n = self.int()
        if n == -1:
            return None
        raw = self.d[self.p : self.p + n]
        self.p += n
        latin1 = (flags >> 12) & 4
        return raw.decode("latin-1" if latin1 else "utf-8", errors="replace")

    def pairlist(self, flags: int) -> list:
        """A pairlist as [(tag, value)], read without recursing down its tail."""
        out = []
        while True:
            kind = flags & 0xFF
            if kind == NILVALUE:
                return out
            if kind not in (LISTSXP, LANGSXP):
                out.append((None, self.item_of(flags)))
                return out
            if flags & 0x200:
                self.item()
            tag = self.item() if flags & 0x400 else None
            out.append((tag, self.item()))
            flags = self.int()

    def item(self):
        return self.item_of(self.int())

    def item_of(self, flags: int):
        kind = flags & 0xFF
        has_attr = bool(flags & 0x200)
        if kind in (NILVALUE, GLOBALENV, EMPTYENV, BASEENV, MISSINGARG, UNBOUND, BASENAMESPACE):
            return None
        if kind == REFSXP:
            i = flags >> 8
            return self.refs[(i if i else self.int()) - 1]
        if kind == SYMSXP:
            name = self.item()
            self.refs.append(name)
            return name
        if kind in (LISTSXP, LANGSXP):
            return self.pairlist(flags)
        if kind == CHARSXP:
            return self.chars(flags)
        if kind in (NAMESPACESXP, PACKAGESXP):
            self.int()
            info = [self.item() for _ in range(self.int())]
            self.refs.append(info)
            return info
        if kind == ENVSXP:
            env: dict = {}
            self.refs.append(env)
            self.int()  # locked
            for _ in range(4):  # enclosure, frame, hash table, attributes
                self.item()
            return env
        if kind == EXTPTRSXP:
            ptr = Obj(None, {})
            self.refs.append(ptr)
            self.item()
            self.item()
            if has_attr:
                self.item()
            return ptr
        if kind == ALTREP:
            info = self.item()
            state = self.item()
            self.item()  # attributes
            return self.altrep(info, state)
        if kind in (CLOSXP, PROMSXP):
            if has_attr:
                self.item()
            return [self.item() for _ in range(3)]
        if kind in (LGLSXP, INTSXP):
            n = self.length()
            vals = struct.unpack_from(f">{n}i", self.d, self.p)
            self.p += 4 * n
            value = [None if v == NA_INT else v for v in vals]
        elif kind == REALSXP:
            n = self.length()
            vals = struct.unpack_from(f">{n}d", self.d, self.p)
            words = struct.unpack_from(f">{2 * n}I", self.d, self.p)
            self.p += 8 * n
            value = [None if v != v and words[2 * i + 1] == NA_REAL_LOW else v for i, v in enumerate(vals)]
        elif kind == STRSXP:
            value = [self.item() for _ in range(self.length())]
        elif kind in (VECSXP, EXPRSXP):
            value = [self.item() for _ in range(self.length())]
        elif kind == RAWSXP:
            n = self.length()
            value = self.d[self.p : self.p + n]
            self.p += n
        else:
            raise ValueError(f"R item type {kind} at byte {self.p} is not supported")
        if not has_attr:
            return value
        attrs = {tag: v for tag, v in self.pairlist(self.int())}
        levels = attrs.get("levels")
        if kind == INTSXP and levels is not None:
            return [None if v is None else plain(levels)[v - 1] for v in value]
        names = attrs.get("names")
        if kind == VECSXP and names is not None:
            return dict(zip(plain(names), (plain(v) for v in value)))
        return Obj(value, attrs)

    def altrep(self, info, state):
        cls = info[0][1] if info and isinstance(info[0], tuple) else info[0]
        state = plain(state)
        if cls == "compact_intseq":
            n, start, step = (int(x) for x in state)
            return [start + i * step for i in range(n)]
        if cls == "compact_realseq":
            n, start, step = state
            return [start + i * step for i in range(int(n))]
        if cls == "deferred_string":
            arg = plain(state[0][1] if isinstance(state[0], tuple) else state[0])
            return [None if v is None else (str(int(v)) if float(v).is_integer() else repr(v)) for v in arg]
        if cls.startswith("wrap_"):
            return state[0][1] if isinstance(state[0], tuple) else state[0]
        raise ValueError(f"R ALTREP class {cls} is not supported")


def plain(v):
    return v.value if isinstance(v, Obj) else v


def load(path: str) -> dict:
    with open(path, "rb") as f:
        data = f.read()
    if data[:2] == b"\x1f\x8b":
        data = gzip.decompress(data)
    elif data[:3] == b"BZh":
        data = bz2.decompress(data)
    elif data[:6] == b"\xfd7zXZ\x00":
        data = lzma.decompress(data)
    if data[:5] not in (b"RDX2\n", b"RDX3\n") or data[5:7] != b"X\n":
        raise ValueError("not an R save() file in XDR format")
    r = Reader(data)
    r.p = 7
    version = r.int()
    r.int()
    r.int()
    if version == 3:
        n = r.int()  # the writer's native encoding
        r.p += n
    return {tag: plain(v) for tag, v in r.pairlist(r.int())}
