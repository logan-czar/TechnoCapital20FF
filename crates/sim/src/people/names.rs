//! Person names from the superregion name lists (spec 3.7.1 "name from a list for the HQ
//! country's superregion", 3.7.2 "unique against characters.csv"; data/names/, M0.6).
//!
//! A country's culture comes from names/country-cultures.csv; its first names and surnames from
//! the rows of that culture in the country's superregion file. Cultures with `family_first` put
//! the surname first, as the world-gen generator does (tools/world-gen/gen.py `person_name`).
//!
//! Jobs see only the `World` (no `WorldData`), and a save loads without the CSVs (D13), so the
//! books are built once at load into [`NameBooks`] (serde, one entry per country in country id
//! order) and stored on the World; generators read from there.

use serde::{Deserialize, Serialize};
use sim_data::{NameKind, NameRow, SUPERREGIONS, WorldData};

use crate::rng::{DrawSource, Stream};
use crate::world::{CountryId, Ordinal};

/// Chance a generated person is female (decision D203).
pub const FEMALE_CHANCE: f64 = 0.5;
/// Tries at a unique full name before a numeral suffix is added (D203; world-gen uses 200).
pub const UNIQUE_NAME_TRIES: u32 = 200;

/// The name parts of one culture (spec 3.7.1), in file order.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
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
    /// Scans the name rows: build [`NameBooks`] once at load rather than calling this per draw.
    pub fn for_country(data: &WorldData, iso3: &str) -> Option<NameBook> {
        let (region, culture) = country_culture(data, iso3)?;
        NameBook::from_rows(&data.names.get(region)?.rows, &culture)
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

/// The superregion file index and culture a country's names come from (D203 fallback).
fn country_culture(data: &WorldData, iso3: &str) -> Option<(usize, String)> {
    let country = data.countries.rows.iter().find(|c| c.iso3 == iso3)?;
    let region = SUPERREGIONS
        .iter()
        .position(|(_, name)| *name == country.superregion)?;
    let rows = &data.names.get(region)?.rows;
    let listed = data
        .country_cultures
        .rows
        .iter()
        .find(|c| c.iso3 == iso3)
        .map(|c| c.culture.clone())
        .filter(|c| NameBook::from_rows(rows, c).is_some());
    let culture = listed.or_else(|| rows.first().map(|r| r.culture.clone()))?;
    Some((region, culture))
}

/// One [`NameBook`] per country, built once at load and stored on the World (spec 3.7.1, 3.7.2;
/// D203). Countries sharing a superregion and culture share one book.
#[derive(Debug, Clone, PartialEq, Default, Serialize, Deserialize)]
pub struct NameBooks {
    /// Distinct books, in the order first needed.
    books: Vec<NameBook>,
    /// For each country ordinal, its index in `books`.
    by_country: Vec<u32>,
}

/// A country with no name book (its superregion file is missing or has no usable culture).
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct NoNameBook(pub String);

impl NameBooks {
    /// Builds the books for `country_keys` (iso3), given in country id order (the World's
    /// `countries` table order, D4), so `get(CountryId)` lines up with the World.
    pub fn build<'a>(
        data: &WorldData,
        country_keys: impl IntoIterator<Item = &'a str>,
    ) -> Result<NameBooks, NoNameBook> {
        let mut keys: Vec<(usize, String)> = Vec::new();
        let mut out = NameBooks::default();
        for iso3 in country_keys {
            let missing = || NoNameBook(iso3.to_string());
            let key = country_culture(data, iso3).ok_or_else(missing)?;
            let index = match keys.iter().position(|k| *k == key) {
                Some(i) => i,
                None => {
                    let rows = &data.names.get(key.0).ok_or_else(missing)?.rows;
                    let book = NameBook::from_rows(rows, &key.1).ok_or_else(missing)?;
                    keys.push(key);
                    out.books.push(book);
                    out.books.len() - 1
                }
            };
            out.by_country.push(index as u32);
        }
        Ok(out)
    }

    /// Builds the books for every country of `data` in ascending iso3 byte order, the World's
    /// country id order (D4).
    pub fn from_data(data: &WorldData) -> Result<NameBooks, NoNameBook> {
        let mut keys: Vec<&str> = data
            .countries
            .rows
            .iter()
            .map(|c| c.iso3.as_str())
            .collect();
        keys.sort_unstable();
        NameBooks::build(data, keys)
    }

    /// The book of a country.
    pub fn get(&self, country: CountryId) -> Option<&NameBook> {
        let i = *self.by_country.get(country.index())?;
        self.books.get(i as usize)
    }

    /// Countries covered.
    pub fn len(&self) -> usize {
        self.by_country.len()
    }

    pub fn is_empty(&self) -> bool {
        self.by_country.is_empty()
    }

    /// Distinct books held.
    pub fn distinct(&self) -> usize {
        self.books.len()
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
