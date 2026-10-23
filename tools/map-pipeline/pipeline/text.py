"""Name folding and phrase extraction for the P3 fuzzy match."""

from __future__ import annotations

import re
import unicodedata

_ABBREV = [
    (re.compile(r"\bst\b\.?"), "saint"),
    (re.compile(r"\bste\b\.?"), "sainte"),
    (re.compile(r"\bmt\b\.?"), "mount"),
    (re.compile(r"\bft\b\.?"), "fort"),
]
_NON_WORD = re.compile(r"[^a-z0-9 ]+")
_SPACES = re.compile(r"\s+")

# Words that are place names somewhere but mean something else in province names and notes.
STOPWORDS = {
    "a", "an", "and", "the", "of", "de", "del", "la", "las", "los", "el", "in", "on", "at", "to",
    "city", "county", "port", "ports", "harbor", "harbour", "valley", "coast", "delta", "basin",
    "central", "centre", "center", "north", "south", "east", "west", "northern", "southern",
    "eastern", "western", "upper", "lower", "rural", "metro", "downtown", "island", "islands",
    "lake", "lakes", "river", "bay", "plains", "corridor", "gulf", "union", "liberty", "hope",
    "commerce", "industry", "energy", "plant", "plants", "capital", "state",
    "national", "golden", "park", "grove", "garden", "gardens", "springs", "spring", "heights",
    "falls", "beach", "hills", "sierra", "frontera", "progreso", "reforma", "libertad", "bolsa",
    "independence", "concord", "paris", "athens", "berlin", "moscow",
    "ford", "nike", "intel", "tesla", "boeing", "deere", "toyota", "hyundai", "mercedes",
    "volvo", "honda", "mazda", "nissan", "audi", "kroger", "target", "jeep", "mack", "dell",
    "steel", "oil", "gas", "coal", "gold", "silver", "copper", "iron", "salt", "sugar", "cotton",
    "wheat", "corn", "rice", "dairy", "timber", "paper", "glass", "tires", "media", "film",
}


BASE_STOPWORDS = frozenset(STOPWORDS)


def set_region_words(cfg: dict) -> None:
    """Per-region stopwords from the hints file's `[text]` table (D675): `allow` lists base
    stopwords that are real places there (Paris and Berlin in Europe, Moscow in Russia), `stop`
    adds words that are places somewhere but ordinary words in that file's names and notes."""
    global STOPWORDS
    allow = {fold(w) for w in cfg.get("allow", [])}
    stop = {fold(w) for w in cfg.get("stop", [])}
    STOPWORDS = (set(BASE_STOPWORDS) - allow) | stop


def fold(s: str) -> str:
    """ASCII, lower case, abbreviations expanded, punctuation to spaces."""
    s = unicodedata.normalize("NFKD", s or "")
    s = "".join(c for c in s if not unicodedata.combining(c))
    s = s.lower().replace("&", " and ").replace("'", "").replace("’", "")
    s = _NON_WORD.sub(" ", s)
    for pat, rep in _ABBREV:
        s = pat.sub(rep, s)
    return _SPACES.sub(" ", s).strip()


def name_parts(name: str) -> list[str]:
    """`Birmingham-North Alabama` -> the whole name and each hyphen or `and` part, folded."""
    whole = fold(name)
    parts = [whole]
    for p in re.split(r"-| and |/", name):
        f = fold(p)
        if f and f not in parts:
            parts.append(f)
    return parts


def note_phrases(notes: str) -> list[str]:
    """Comma, semicolon and parenthesis separated fragments of the notes, folded."""
    out = []
    for p in re.split(r"[,;()]", notes or ""):
        f = fold(p)
        if f:
            out.append(f)
    return out


DIRECTIONS = {
    # word -> unit vector (east, north)
    "north": (0.0, 1.0), "northern": (0.0, 1.0), "upper": (0.0, 1.0),
    "south": (0.0, -1.0), "southern": (0.0, -1.0), "lower": (0.0, -1.0),
    "east": (1.0, 0.0), "eastern": (1.0, 0.0),
    "west": (-1.0, 0.0), "western": (-1.0, 0.0),
    "northeast": (0.707, 0.707), "northeastern": (0.707, 0.707),
    "northwest": (-0.707, 0.707), "northwestern": (-0.707, 0.707),
    "southeast": (0.707, -0.707), "southeastern": (0.707, -0.707),
    "southwest": (-0.707, -0.707), "southwestern": (-0.707, -0.707),
    "central": (0.0, 0.0), "midlands": (0.0, 0.0), "downtown": (0.0, 0.0), "centro": (0.0, 0.0),
    # compounds and the French and Spanish words the province names use
    "northside": (0.0, 1.0), "southside": (0.0, -1.0), "eastside": (1.0, 0.0), "westside": (-1.0, 0.0),
    "nord": (0.0, 1.0), "sud": (0.0, -1.0), "est": (1.0, 0.0), "ouest": (-1.0, 0.0),
    "norte": (0.0, 1.0), "sur": (0.0, -1.0), "oriente": (1.0, 0.0), "poniente": (-1.0, 0.0),
}


def directions(name: str) -> list[tuple[float, float]]:
    """Direction words in a province name, as unit vectors (central is the zero vector)."""
    out = []
    for w in fold(name).split():
        if w in DIRECTIONS:
            out.append(DIRECTIONS[w])
    return out


def contains_any_word(phrase: str) -> set[str]:
    return set(phrase.split())


def contains_word(phrase: str, needle: str) -> bool:
    return re.search(r"(?<![a-z0-9])" + re.escape(needle) + r"(?![a-z0-9])", phrase) is not None


if __name__ == "__main__":
    assert fold("Nuevo León") == "nuevo leon"
    assert fold("St. John's-Avalon") == "saint johns avalon"
    assert name_parts("Birmingham-North Alabama") == ["birmingham north alabama", "birmingham", "north alabama"]
    assert contains_word("birmingham steel and banking", "birmingham")
    assert not contains_word("tyson headquarters", "tyson h")
    assert directions("Northern and Western Wisconsin") == [(0.0, 1.0), (-1.0, 0.0)]
    print("text: ok")
