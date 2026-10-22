//! Saves (spec 9.1 `Save`, `Load`; build-plan 2.2, M1.7): the whole [`World`], the RNG positions
//! and the controls, encoded with postcard and gzip-compressed with flate2. Everything derives
//! serde, so new fields are saved with no extra code. A loaded game continues with exactly the
//! ticks and draws it would have made (same hashes, build-plan 4.3).
//!
//! The format is the 8-byte [`SAVE_MAGIC`], then gzip of postcard of [`SAVE_VERSION`] and the
//! state. A save from another version is refused rather than misread.

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
/// (D542); a startup headline carries its event's id (D543).
pub const SAVE_VERSION: u32 = 8;

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
    if found != SAVE_VERSION {
        return Err(SaveError::Version { found });
    }
    Ok(postcard::from_bytes(rest)?)
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

    #[test]
    fn bad_saves_are_refused() {
        assert!(matches!(decode(b"nope"), Err(SaveError::BadMagic)));
        let mut junk = SAVE_MAGIC.to_vec();
        junk.extend_from_slice(b"not gzip");
        assert!(decode(&junk).is_err());
    }
}
