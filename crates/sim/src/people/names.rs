//! Person names from the superregion name lists (spec 3.7.1 "name from a list for the HQ
//! country's superregion", 3.7.2 "unique against characters.csv"; data/names/, M0.6).
//!
//! A country's culture comes from names/country-cultures.csv; its first names and surnames from
//! the rows of that culture in the country's superregion file. Cultures with `family_first` put
//! the surname first, as the world-gen generator does (tools/world-gen/gen.py `person_name`).

use sim_data::{NameKind, NameRow, SUPERREGIONS, WorldData};

use crate::rng::{DrawSource, Stream};

/// Chance a generated person is female (decision D203).
pub const FEMALE_CHANCE: f64 = 0.5;
/// Tries at a unique full name before a numeral suffix is added (D203; world-gen uses 200).
pub const UNIQUE_NAME_TRIES: u32 = 200;

/// The name parts of one culture (spec 3.7.1), in file order.
#[derive(Debug, Clone, PartialEq)]
pub struct NameBook {
    pub culture: String,
    pub family_first: bool,
    pub male: Vec<String>,
    pub female: Vec<String>,
    pub surnames: Vec<String>,
}

impl NameBook {
    /// The book for `culture` from one superregion file's rows, or None if the file has no
    /// first names and surnames for it.
    pub fn from_rows(rows: &[NameRow], culture: &str) -> Option<NameBook> {
        let pick = |kind: NameKind| -> Vec<String> {
            rows.iter()
                .filter(|r| r.culture == culture && r.kind == kind)
                .map(|r| r.name.clone())
                .collect()
        };
        let book = NameBook {
            culture: culture.to_string(),
            family_first: rows.iter().any(|r| r.culture == culture && r.family_first),
            male: pick(NameKind::Male),
            female: pick(NameKind::Female),
            surnames: pick(NameKind::Surname),
        };
        let usable = !book.male.is_empty() && !book.female.is_empty() && !book.surnames.is_empty();
        usable.then_some(book)
    }

    /// The book for a country (countries.csv `iso3`): its culture from country-cultures.csv, in
    /// its superregion's file. If the culture is missing from that file, the file's first culture
    /// (in file order) is used (D203); the sim-data checks make this not happen with today's data.
    pub fn for_country(data: &WorldData, iso3: &str) -> Option<NameBook> {
        let country = data.countries.rows.iter().find(|c| c.iso3 == iso3)?;
        let region = SUPERREGIONS
            .iter()
            .position(|(_, name)| *name == country.superregion)?;
        let rows = &data.names.get(region)?.rows;
        let culture = data
            .country_cultures
            .rows
            .iter()
            .find(|c| c.iso3 == iso3)
            .map(|c| c.culture.as_str());
        culture
            .and_then(|c| NameBook::from_rows(rows, c))
            .or_else(|| {
                rows.first()
                    .and_then(|r| NameBook::from_rows(rows, &r.culture))
            })
    }

    /// A random full name: female with [`FEMALE_CHANCE`], then a first name and a surname, each
    /// uniform over the lists (gen stream). Draw order is frozen: sex, first name, surname.
    pub fn draw(&self, draws: &mut dyn DrawSource) -> String {
        let female = draws.chance(Stream::Gen, FEMALE_CHANCE);
        let firsts = if female { &self.female } else { &self.male };
        let first = pick(draws, firsts);
        let sur = pick(draws, &self.surnames);
        if self.family_first {
            format!("{sur} {first}")
        } else {
            format!("{first} {sur}")
        }
    }

    /// A name for which `taken` is false (spec 3.7.2: unique against characters.csv and the
    /// characters made in play). After [`UNIQUE_NAME_TRIES`] tries the last draw gets the lowest
    /// numeral suffix (" II", " III", ...) that is free (D203).
    pub fn draw_unique(&self, draws: &mut dyn DrawSource, taken: &dyn Fn(&str) -> bool) -> String {
        let mut name = String::new();
        for _ in 0..UNIQUE_NAME_TRIES {
            name = self.draw(draws);
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

fn pick<'a>(draws: &mut dyn DrawSource, list: &'a [String]) -> &'a str {
    let i = draws.int_inclusive(Stream::Gen, 0, list.len() as i64 - 1);
    &list[i as usize]
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn roman_numerals() {
        assert_eq!(roman(2), "II");
        assert_eq!(roman(4), "IV");
        assert_eq!(roman(14), "XIV");
    }
}
