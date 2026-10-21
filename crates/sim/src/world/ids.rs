//! Ordinal ids (build-plan 2.3 `world/`): each table row is addressed by a small newtype over its
//! position. Ordinals follow the CSV ids in ascending byte order (decision D4), so iterating a
//! table in ordinal order is iterating it in id order, and "ties go to the lower id" (D2) is
//! "ties go to the lower ordinal".

use std::fmt;

use serde::{Deserialize, Serialize};

/// A row's position in its [`Table`](super::Table).
pub trait Ordinal: Copy + Ord + fmt::Debug {
    fn from_index(index: usize) -> Self;
    fn index(self) -> usize;
}

macro_rules! ordinal_id {
    ($($(#[$meta:meta])* $name:ident;)*) => {$(
        $(#[$meta])*
        #[derive(
            Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize,
        )]
        pub struct $name(pub u32);

        impl Ordinal for $name {
            fn from_index(index: usize) -> Self {
                Self(u32::try_from(index).expect("table larger than u32"))
            }

            fn index(self) -> usize {
                self.0 as usize
            }
        }

        impl fmt::Display for $name {
            fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
                write!(f, "{}#{}", stringify!($name), self.0)
            }
        }
    )*};
}

ordinal_id! {
    /// A financial zone (spec 3.2.1), from financial-zones.csv `zone_id`.
    ZoneId;
    /// A country (spec 3.2), from countries.csv `iso3`.
    CountryId;
    /// A province (spec 3.3), from the provinces-*.csv `id`. The map's province ordinal (spec 9.2).
    ProvinceId;
    /// An industry (spec 3.4), from industries.csv `id`.
    IndustryId;
    /// A corporation (spec 3.5), from companies.csv `id`; companies born in play append (5.19).
    CompanyId;
    /// A full character (spec 3.7.2), from characters.csv `id`; those made in play append.
    CharacterId;
    /// A startup event that fired, fixed or random (spec 3.1 `startup_events`, 5.19).
    StartupEventId;
}
