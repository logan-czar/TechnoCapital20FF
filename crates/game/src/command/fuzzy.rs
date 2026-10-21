//! Fuzzy matching for the command bar (D455). A query matches a candidate when its characters
//! appear in order (case-insensitive, ASCII); the score rewards, best first: an exact match, a
//! prefix, a whole-word prefix, a substring, then a scattered subsequence whose characters fall on
//! word starts and run together. No match is `None`.

/// Score tiers; a higher tier always beats a lower one.
const EXACT: i32 = 10_000;
const PREFIX: i32 = 8_000;
const WORD_PREFIX: i32 = 6_000;
const SUBSTRING: i32 = 4_000;
const SUBSEQUENCE: i32 = 1_000;

/// The score of `query` against `candidate`, or `None` when it does not match. Both are
/// compared lowercased; an empty query matches nothing.
pub fn score(query: &str, candidate: &str) -> Option<i32> {
    score_lower(
        &query.trim().to_ascii_lowercase(),
        &candidate.to_ascii_lowercase(),
    )
}

/// [`score`] for a query and candidate already trimmed and lowercased (the name index keeps its
/// names lowercased, so a search allocates nothing per candidate).
pub fn score_lower(q: &str, c: &str) -> Option<i32> {
    if q.is_empty() {
        return None;
    }
    // Shorter candidates win within a tier (a closer fit).
    let len_penalty = (c.len() as i32).min(200);
    if c == q {
        return Some(EXACT);
    }
    if c.starts_with(q) {
        return Some(PREFIX - len_penalty);
    }
    if let Some(pos) = word_starts(c).find(|&i| c.as_bytes()[i..].starts_with(q.as_bytes())) {
        return Some(WORD_PREFIX - pos as i32 - len_penalty);
    }
    if let Some(pos) = c.find(q) {
        return Some(SUBSTRING - pos as i32 - len_penalty);
    }
    subsequence(q, c).map(|s| SUBSEQUENCE + s - len_penalty)
}

/// Byte offsets where a word starts: the start, and after a space, '-', '.', '/', '(' or '&'.
fn word_starts(c: &str) -> impl Iterator<Item = usize> + '_ {
    let b = c.as_bytes();
    (0..b.len())
        .filter(move |&i| i == 0 || matches!(b[i - 1], b' ' | b'-' | b'.' | b'/' | b'(' | b'&'))
}

/// The best in-order placement of `q`'s letters in `c` (a linear DP): each letter on a word
/// start earns 30, each letter right after the previous one 15, and each skipped byte costs 1.
/// `None` if a letter is missing.
fn subsequence(q: &str, c: &str) -> Option<i32> {
    const NONE: i32 = i32::MIN / 4;
    let cb = c.as_bytes();
    let n = cb.len();
    let bonus: Vec<i32> = (0..n)
        .map(|i| {
            if i == 0 || matches!(cb[i - 1], b' ' | b'-' | b'.' | b'/' | b'(' | b'&') {
                30
            } else {
                0
            }
        })
        .collect();
    let mut prev: Option<Vec<i32>> = None;
    for qc in q.bytes().filter(|&b| b != b' ') {
        let mut cur = vec![NONE; n];
        // The best of prev[k] + k over k < i - 1 (a gap before i), kept as a running max.
        let mut gap_best = NONE;
        for i in 0..n {
            if let Some(p) = &prev
                && i >= 2
                && p[i - 2] > NONE
            {
                gap_best = gap_best.max(p[i - 2] + (i as i32 - 2));
            }
            if cb[i] != qc {
                continue;
            }
            cur[i] = match &prev {
                None => bonus[i] - i as i32 / 4,
                Some(p) => {
                    let run = if i >= 1 && p[i - 1] > NONE {
                        p[i - 1] + 15
                    } else {
                        NONE
                    };
                    let gap = if gap_best > NONE {
                        gap_best - i as i32
                    } else {
                        NONE
                    };
                    let best = run.max(gap);
                    if best <= NONE { NONE } else { best + bonus[i] }
                }
            };
        }
        prev = Some(cur);
    }
    prev?.into_iter().filter(|&v| v > NONE).max()
}

/// The best score of `query` over several names of one thing (name, ticker, code).
pub fn best_score<'a>(query: &str, names: impl IntoIterator<Item = &'a str>) -> Option<i32> {
    names.into_iter().filter_map(|n| score(query, n)).max()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn tiers_rank_as_documented() {
        let exact = score("ardr", "ARDR").unwrap();
        let prefix = score("arrow", "Arrowhead Drilling").unwrap();
        let word = score("drill", "Arrowhead Drilling").unwrap();
        let sub = score("rowh", "Arrowhead Drilling").unwrap();
        let subseq = score("ahd", "Arrowhead Drilling").unwrap();
        assert!(exact > prefix && prefix > word && word > sub && sub > subseq);
        assert_eq!(score("xyz", "Arrowhead Drilling"), None);
        assert_eq!(score("", "anything"), None);
        assert_eq!(score("   ", "anything"), None);
        assert_eq!(score("drz", "Arrowhead Drilling"), None, "order matters");
    }

    #[test]
    fn case_and_length() {
        assert_eq!(score("OIL", "oil"), Some(EXACT));
        // A shorter name ranks above a longer one in the same tier.
        assert!(score("ai", "AI labs").unwrap() > score("ai", "AI labs and robotics").unwrap());
    }

    #[test]
    fn word_starts_beat_scattered_letters() {
        // "ad" on word starts (Arrowhead Drilling) beats "ad" mid-word (Bad Bank...).
        let on_starts = score("adr", "Arrowhead Drilling").unwrap();
        let scattered = score("adr", "Bread and rice").unwrap();
        assert!(on_starts > scattered, "{on_starts} vs {scattered}");
        assert_eq!(
            best_score("ardr", ["Arrowhead Drilling", "ARDR"]),
            Some(EXACT)
        );
        assert_eq!(best_score("zz", ["Arrowhead Drilling", "ARDR"]), None);
    }
}
