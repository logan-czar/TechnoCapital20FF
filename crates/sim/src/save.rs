//! Saves (spec 9.1 `Save`, `Load`; build-plan 2.2, M1.7): the whole [`World`], the RNG positions
//! and the controls, encoded with postcard and gzip-compressed with flate2. Everything derives
//! serde, so new fields are saved with no extra code. A loaded game continues with exactly the
//! ticks and draws it would have made (same hashes, build-plan 4.3).
//!
//! The format is the 8-byte [`SAVE_MAGIC`], then gzip of postcard of [`SAVE_VERSION`] and the
//! state. A save from another version is refused rather than misread, except a version 8 save,
//! which differs only in its alert levels and loads with Quarter start at its default (D800).

use std::io::{Read, Write};

use flate2::Compression;
use flate2::read::GzDecoder;
use flate2::write::GzEncoder;
use serde::{Deserialize, Serialize};
use thiserror::Error;

use crate::rng::RngStreams;
use crate::time::Controls;
use crate::world::World;

/// The first bytes of every save.
pub const SAVE_MAGIC: &[u8; 8] = b"TC20FFSV";
/// Bumped whenever the saved layout changes (any new field in any table).
/// 7: each daily bar holds its EFV (D424), companies their companies.csv control (D425) and
/// countries their superregion.
/// 8: each exchange keeps its index's daily closes (D540); each IPO ballot names its voter
/// (D542); a startup headline carries its event's id (D543); each headline has its id (D544).
/// 9: the controls' alert levels hold Quarter start (D800); version 8 saves still load.
pub const SAVE_VERSION: u32 = 9;
/// The last version before Quarter start, still read (D800).
const SAVE_VERSION_V8: u32 = 8;

#[derive(Debug, Error)]
pub enum SaveError {
    #[error("save file: {0}")]
    Io(#[from] std::io::Error),
    #[error("not a TechnoCapital20FF save")]
    BadMagic,
    #[error("save version {found}, this build reads version {SAVE_VERSION}")]
    Version { found: u32 },
    #[error("save data: {0}")]
    Format(#[from] postcard::Error),
}

#[derive(Serialize)]
struct SaveRef<'a> {
    world: &'a World,
    rng: &'a RngStreams,
    controls: &'a Controls,
}

/// The decoded state of a save.
#[derive(Debug, Deserialize)]
pub struct SaveState {
    pub world: World,
    pub rng: RngStreams,
    pub controls: Controls,
}

/// Encodes a save.
pub fn encode(world: &World, rng: &RngStreams, controls: &Controls) -> Vec<u8> {
    let body = postcard::to_stdvec(&(
        SAVE_VERSION,
        SaveRef {
            world,
            rng,
            controls,
        },
    ))
    .expect("serializing to memory cannot fail");
    let mut gz = GzEncoder::new(SAVE_MAGIC.to_vec(), Compression::default());
    gz.write_all(&body).expect("writing to memory cannot fail");
    gz.finish().expect("writing to memory cannot fail")
}

/// Decodes a save.
pub fn decode(bytes: &[u8]) -> Result<SaveState, SaveError> {
    let rest = bytes.strip_prefix(SAVE_MAGIC).ok_or(SaveError::BadMagic)?;
    let mut body = Vec::new();
    GzDecoder::new(rest).read_to_end(&mut body)?;
    let (found, rest): (u32, &[u8]) = postcard::take_from_bytes(&body)?;
    match found {
        SAVE_VERSION => Ok(postcard::from_bytes(rest)?),
        SAVE_VERSION_V8 => Ok(postcard::from_bytes::<SaveStateV8>(rest)?.into()),
        _ => Err(SaveError::Version { found }),
    }
}

/// A version 8 save's controls: the same fields, with the five alert levels before Quarter
/// start (D800).
#[derive(Debug, Serialize, Deserialize)]
struct ControlsV8 {
    speed: u8,
    paused: bool,
    skip: Option<crate::time::control::Skip>,
    alerts: [crate::world::AlertLevel; 5],
    omniscient: bool,
    watchlist: std::collections::BTreeSet<crate::world::CompanyId>,
}

#[derive(Debug, Deserialize)]
struct SaveStateV8 {
    world: World,
    rng: RngStreams,
    controls: ControlsV8,
}

impl From<SaveStateV8> for SaveState {
    fn from(v: SaveStateV8) -> SaveState {
        let c = v.controls;
        SaveState {
            world: v.world,
            rng: v.rng,
            controls: Controls {
                speed: c.speed,
                paused: c.paused,
                skip: c.skip,
                alerts: crate::world::AlertLevels::from_v8(c.alerts),
                omniscient: c.omniscient,
                watchlist: c.watchlist,
            },
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::rng::{DrawSource, Stream};

    #[test]
    fn rng_positions_and_spare_normals_survive_a_save() {
        let data = sim_data::load_world(&sim_data::default_data_dir()).unwrap();
        let world = World::from_data(&data).unwrap();
        let mut rng = RngStreams::new(11);
        for (i, s) in Stream::ALL.iter().enumerate() {
            for _ in 0..(10 * i + 3) {
                rng.normal(*s);
            }
        }
        let bytes = encode(&world, &rng, &Controls::default());
        let mut back = decode(&bytes).unwrap();
        assert_eq!(back.world, world);
        assert_eq!(back.rng, rng);
        for s in Stream::ALL {
            for _ in 0..50 {
                assert_eq!(back.rng.normal(s).to_bits(), rng.normal(s).to_bits());
            }
        }
    }

    /// A version 8 save (five alert levels) loads with its levels and Quarter start at its
    /// default (D800); any other old version is still refused.
    #[test]
    fn a_version_8_save_loads_with_quarter_start_at_its_default() {
        use crate::world::{AlertKind, AlertLevel, CompanyId};
        let data = sim_data::load_world(&sim_data::default_data_dir()).unwrap();
        let world = World::from_data(&data).unwrap();
        let rng = RngStreams::new(5);
        let old = ControlsV8 {
            speed: 3,
            paused: true,
            skip: None,
            alerts: [
                AlertLevel::Off,
                AlertLevel::Notify,
                AlertLevel::Log,
                AlertLevel::Pause,
                AlertLevel::Log,
            ],
            omniscient: false,
            watchlist: [CompanyId(2)].into_iter().collect(),
        };
        let v8 = |version: u32| {
            #[derive(Serialize)]
            struct V8<'a> {
                world: &'a World,
                rng: &'a RngStreams,
                controls: &'a ControlsV8,
            }
            let body = postcard::to_stdvec(&(
                version,
                V8 {
                    world: &world,
                    rng: &rng,
                    controls: &old,
                },
            ))
            .unwrap();
            let mut gz = GzEncoder::new(SAVE_MAGIC.to_vec(), Compression::default());
            gz.write_all(&body).unwrap();
            gz.finish().unwrap()
        };
        let back = decode(&v8(8)).unwrap();
        assert_eq!(back.world, world);
        assert_eq!(back.rng, rng);
        let c = &back.controls;
        assert_eq!((c.speed, c.paused, &c.watchlist), (3, true, &old.watchlist));
        for (i, kind) in AlertKind::ALL[..5].iter().enumerate() {
            assert_eq!(c.alerts.get(*kind), old.alerts[i]);
        }
        assert_eq!(c.alerts.get(AlertKind::QuarterStart), AlertLevel::Pause);
        assert!(matches!(
            decode(&v8(7)),
            Err(SaveError::Version { found: 7 })
        ));
    }

    #[test]
    fn bad_saves_are_refused() {
        assert!(matches!(decode(b"nope"), Err(SaveError::BadMagic)));
        let mut junk = SAVE_MAGIC.to_vec();
        junk.extend_from_slice(b"not gzip");
        assert!(decode(&junk).is_err());
    }
}
