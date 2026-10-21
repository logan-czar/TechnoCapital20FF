//! Company names for startups (spec 5.19.3 "generated from the world-gen name lists, unique")
//! and tickers at listing (spec 5.20.1 Listing step 4: "a unique ticker of up to 4 letters").
//!
//! Names follow world-gen gen.py `company_name`: a prefix from the HQ country's culture (90%)
//! or from the anglo and local lists together (10%), then a suffix of the industry
//! (names/industry-suffixes.csv), `"{prefix} {suffix}"`, suffix first for "Maison" and
//! "Atelier". Built once at load into [`CompanyNames`] (serde, stored on the World like
//! `NameBooks`, D272).

use serde::{Deserialize, Serialize};
use sim_data::{NameKind, SUPERREGIONS, WorldData};

use crate::rng::{DrawSource, Stream};
use crate::world::{CountryId, IndustryId, Ordinal};

/// gen.py: the culture whose prefixes join the local ones 10% of the time.
pub const ANGLO_CULTURE: &str = "anglo";
/// gen.py: a local prefix 90% of the time.
pub const LOCAL_PREFIX_CHANCE: f64 = 0.9;
/// gen.py: tries at a unique name (D272: then the lowest free roman numeral suffix).
pub const COMPANY_NAME_TRIES: u32 = 500;
/// gen.py: suffixes written before the prefix.
pub const SUFFIX_FIRST: [&str; 2] = ["Maison", "Atelier"];
/// Spec 5.20.1: tickers are up to 4 letters; gen.py's are 3 or 4 (D273).
pub const TICKER_MIN_LETTERS: usize = 3;
pub const TICKER_MAX_LETTERS: usize = 4;
/// gen.py: initials of at most the first four words.
pub const TICKER_INITIAL_WORDS: usize = 4;

/// The company name lists, one prefix list per country and one suffix list per industry, in id
/// order (D4).
#[derive(Debug, Clone, PartialEq, Default, Serialize, Deserialize)]
pub struct CompanyNames {
    /// Distinct prefix lists; `by_country` indexes into it.
    prefix_lists: Vec<Vec<String>>,
    by_country: Vec<u32>,
    anglo: Vec<String>,
    /// For each industry ordinal, its suffixes (industry-suffixes.csv, matched by name).
    suffixes: Vec<Vec<String>>,
}

impl CompanyNames {
    /// Builds the lists for `countries` (iso3, in the World's country order) and `industries`
    /// (industries.csv names, in the World's industry order). A country whose culture has no
    /// prefixes in its superregion file uses the anglo list (D272).
    pub fn build<'a>(
        data: &WorldData,
        countries: impl IntoIterator<Item = &'a str>,
        industries: impl IntoIterator<Item = &'a str>,
    ) -> CompanyNames {
        let mut anglo: Vec<String> = Vec::new();
        for table in &data.names {
            for r in &table.rows {
                if r.culture == ANGLO_CULTURE
                    && r.kind == NameKind::CompanyPrefix
                    && !anglo.contains(&r.name)
                {
                    anglo.push(r.name.clone());
                }
            }
        }
        let mut out = CompanyNames {
            anglo,
            ..CompanyNames::default()
        };
        for iso3 in countries {
            let list = local_prefixes(data, iso3);
            let list = if list.is_empty() {
                out.anglo.clone()
            } else {
                list
            };
            let i = match out.prefix_lists.iter().position(|l| *l == list) {
                Some(i) => i,
                None => {
                    out.prefix_lists.push(list);
                    out.prefix_lists.len() - 1
                }
            };
            out.by_country.push(i as u32);
        }
        for name in industries {
            out.suffixes.push(
                data.industry_suffixes
                    .rows
                    .iter()
                    .filter(|s| s.industry == name)
                    .map(|s| s.suffix.clone())
                    .collect(),
            );
        }
        out
    }

    /// Builds the lists in the World's orders: countries by iso3, industries by id (D4).
    pub fn from_data(data: &WorldData) -> CompanyNames {
        let mut countries: Vec<&str> = data
            .countries
            .rows
            .iter()
            .map(|c| c.iso3.as_str())
            .collect();
        countries.sort_unstable();
        let mut industries: Vec<(&str, &str)> = data
            .industries
            .rows
            .iter()
            .map(|i| (i.id.as_str(), i.name.as_str()))
            .collect();
        industries.sort_unstable();
        CompanyNames::build(data, countries, industries.into_iter().map(|(_, n)| n))
    }

    /// The local prefixes of a country.
    pub fn prefixes(&self, country: CountryId) -> &[String] {
        let i = self.by_country.get(country.index()).copied().unwrap_or(0) as usize;
        self.prefix_lists.get(i).map_or(&[], |l| l.as_slice())
    }

    /// The suffixes of an industry.
    pub fn suffixes(&self, industry: IndustryId) -> &[String] {
        self.suffixes
            .get(industry.index())
            .map_or(&[], |l| l.as_slice())
    }

    /// A unique company name (gen stream; D272). Per try, in order: the 90% local-prefix roll,
    /// the prefix, the suffix. After [`COMPANY_NAME_TRIES`] the last draw takes the lowest free
    /// roman numeral (" II", ...).
    pub fn draw(
        &self,
        country: CountryId,
        industry: IndustryId,
        taken: &dyn Fn(&str) -> bool,
        draws: &mut dyn DrawSource,
    ) -> String {
        let local = self.prefixes(country);
        let mixed: Vec<String> = self.anglo.iter().chain(local).cloned().collect();
        let suffixes = self.suffixes(industry);
        let mut name = String::new();
        for _ in 0..COMPANY_NAME_TRIES {
            let pool = if draws.chance(Stream::Gen, LOCAL_PREFIX_CHANCE) {
                local
            } else {
                mixed.as_slice()
            };
            let pre = pick(pool, draws);
            let suf = pick(suffixes, draws);
            name = compose(pre, suf);
            if !taken(&name) {
                return name;
            }
        }
        (2u32..)
            .map(|n| format!("{name} {}", roman(n)))
            .find(|n| !taken(n))
            .expect("some numeral suffix is free")
    }
}

fn local_prefixes(data: &WorldData, iso3: &str) -> Vec<String> {
    let Some(country) = data.countries.rows.iter().find(|c| c.iso3 == iso3) else {
        return Vec::new();
    };
    let Some(region) = SUPERREGIONS
        .iter()
        .position(|(_, n)| *n == country.superregion)
    else {
        return Vec::new();
    };
    let Some(culture) = data
        .country_cultures
        .rows
        .iter()
        .find(|c| c.iso3 == iso3)
        .map(|c| c.culture.as_str())
    else {
        return Vec::new();
    };
    data.names
        .get(region)
        .map(|t| {
            t.rows
                .iter()
                .filter(|r| r.culture == culture && r.kind == NameKind::CompanyPrefix)
                .map(|r| r.name.clone())
                .collect()
        })
        .unwrap_or_default()
}

fn pick<'a>(list: &'a [String], draws: &mut dyn DrawSource) -> &'a str {
    if list.is_empty() {
        return "";
    }
    let i = draws.int_inclusive(Stream::Gen, 0, list.len() as i64 - 1);
    &list[i as usize]
}

/// `"{prefix} {suffix}"`, or `"{suffix} {prefix}"` for Maison and Atelier (gen.py).
pub fn compose(prefix: &str, suffix: &str) -> String {
    let (a, b) = if SUFFIX_FIRST.contains(&suffix) {
        (suffix, prefix)
    } else {
        (prefix, suffix)
    };
    [a, b]
        .iter()
        .filter(|s| !s.is_empty())
        .copied()
        .collect::<Vec<_>>()
        .join(" ")
}

/// A roman numeral (for name suffixes).
fn roman(mut n: u32) -> String {
    const TABLE: [(u32, &str); 13] = [
        (1000, "M"),
        (900, "CM"),
        (500, "D"),
        (400, "CD"),
        (100, "C"),
        (90, "XC"),
        (50, "L"),
        (40, "XL"),
        (10, "X"),
        (9, "IX"),
        (5, "V"),
        (4, "IV"),
        (1, "I"),
    ];
    let mut out = String::new();
    for (v, s) in TABLE {
        while n >= v {
            out.push_str(s);
            n -= v;
        }
    }
    out
}

/// The ticker candidates of a name, in order (world-gen gen.py `ticker`): the initials of the
/// first four words, the first two letters of the first two words, the first three of the
/// first word and the first of the second, the first four letters, the first three; only those
/// of 3 or 4 letters.
pub fn ticker_candidates(name: &str) -> Vec<String> {
    let cleaned = name.replace('-', " ").replace('\'', "");
    let words: Vec<&str> = cleaned
        .split_whitespace()
        .filter(|w| w.chars().next().is_some_and(|c| c.is_alphabetic()))
        .collect();
    let letters: String = name
        .to_uppercase()
        .chars()
        .filter(|c| c.is_ascii_alphabetic())
        .collect();
    let head = |w: &str, n: usize| -> String { w.chars().take(n).collect() };
    let mut out = Vec::new();
    if words.len() >= 2 {
        out.push(
            words
                .iter()
                .take(TICKER_INITIAL_WORDS)
                .map(|w| head(w, 1))
                .collect::<String>()
                .to_uppercase(),
        );
        out.push(format!("{}{}", head(words[0], 2), head(words[1], 2)).to_uppercase());
        out.push(format!("{}{}", head(words[0], 3), head(words[1], 1)).to_uppercase());
    }
    out.push(head(&letters, TICKER_MAX_LETTERS));
    out.push(head(&letters, TICKER_MIN_LETTERS));
    out.into_iter()
        .filter(|t| {
            (TICKER_MIN_LETTERS..=TICKER_MAX_LETTERS).contains(&t.chars().count())
                && t.chars().all(|c| c.is_ascii_uppercase())
        })
        .collect()
}

/// A unique ticker for a listing (spec 5.20.1; D273): the first free [`ticker_candidates`];
/// else, with no draw (gen.py's random fallback replaced by a fixed order), the first free
/// 4-letter code that starts with the name's first letter, the other three running AAA to ZZZ;
/// else the first free 4-letter code from AAAA.
pub fn ticker(name: &str, taken: &dyn Fn(&str) -> bool) -> String {
    if let Some(t) = ticker_candidates(name).into_iter().find(|t| !taken(t)) {
        return t;
    }
    let first = name
        .to_uppercase()
        .chars()
        .find(|c| c.is_ascii_uppercase())
        .unwrap_or('A');
    let alphabet = || (b'A'..=b'Z').map(char::from);
    for a in alphabet() {
        for b in alphabet() {
            for c in alphabet() {
                let t: String = [first, a, b, c].iter().collect();
                if !taken(&t) {
                    return t;
                }
            }
        }
    }
    for f in alphabet() {
        for a in alphabet() {
            for b in alphabet() {
                for c in alphabet() {
                    let t: String = [f, a, b, c].iter().collect();
                    if !taken(&t) {
                        return t;
                    }
                }
            }
        }
    }
    panic!("all 456,976 four-letter tickers are taken")
}
