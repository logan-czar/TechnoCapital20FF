//! Reading and writing the map's PNGs (docs/build/m8-map-assets.md) with the `png` crate, which
//! Bevy's image loader already builds: 16-bit greyscale for the province index, 8-bit RGB for
//! the colour bitmap and the border distance field.

use std::io::{BufReader, BufWriter};
use std::path::Path;

/// A decoded image: its size and its samples, row-major.
#[derive(Debug, Clone, PartialEq)]
pub struct Raster<T> {
    pub width: u32,
    pub height: u32,
    pub data: Vec<T>,
}

/// No map PNG comes near this; the default 64 MiB limit is under an 8192 x 4096 RGB image.
const DECODE_LIMIT_BYTES: usize = 1 << 30;

fn decode(path: &Path) -> Result<(png::OutputInfo, Vec<u8>), String> {
    let file = std::fs::File::open(path).map_err(|e| format!("{}: {e}", path.display()))?;
    let decoder = png::Decoder::new_with_limits(
        BufReader::new(file),
        png::Limits {
            bytes: DECODE_LIMIT_BYTES,
        },
    );
    let mut reader = decoder
        .read_info()
        .map_err(|e| format!("{}: {e}", path.display()))?;
    let size = reader
        .output_buffer_size()
        .ok_or_else(|| format!("{}: too large", path.display()))?;
    let mut buf = vec![0; size];
    let info = reader
        .next_frame(&mut buf)
        .map_err(|e| format!("{}: {e}", path.display()))?;
    buf.truncate(info.buffer_size());
    Ok((info, buf))
}

/// Reads a 16-bit greyscale PNG (`province-index.png`).
pub fn read_gray16(path: &Path) -> Result<Raster<u16>, String> {
    let (info, buf) = decode(path)?;
    if info.color_type != png::ColorType::Grayscale || info.bit_depth != png::BitDepth::Sixteen {
        return Err(format!(
            "{}: expected 16-bit greyscale, found {:?} {:?}",
            path.display(),
            info.color_type,
            info.bit_depth
        ));
    }
    // PNG stores 16-bit samples big-endian.
    let data = buf
        .chunks_exact(2)
        .map(|b| u16::from_be_bytes([b[0], b[1]]))
        .collect();
    Ok(Raster {
        width: info.width,
        height: info.height,
        data,
    })
}

/// Reads an 8-bit RGB PNG (`province-borders.png`, `province-ids.png`) as RGB triples.
pub fn read_rgb8(path: &Path) -> Result<Raster<[u8; 3]>, String> {
    let (info, buf) = decode(path)?;
    if info.color_type != png::ColorType::Rgb || info.bit_depth != png::BitDepth::Eight {
        return Err(format!(
            "{}: expected 8-bit RGB, found {:?} {:?}",
            path.display(),
            info.color_type,
            info.bit_depth
        ));
    }
    let data = buf.chunks_exact(3).map(|b| [b[0], b[1], b[2]]).collect();
    Ok(Raster {
        width: info.width,
        height: info.height,
        data,
    })
}

fn encoder(
    path: &Path,
    width: u32,
    height: u32,
) -> Result<png::Encoder<'static, BufWriter<std::fs::File>>, String> {
    let file = std::fs::File::create(path).map_err(|e| format!("{}: {e}", path.display()))?;
    let mut enc = png::Encoder::new(BufWriter::new(file), width, height);
    enc.set_compression(png::Compression::Fast);
    Ok(enc)
}

/// Writes a 16-bit greyscale PNG.
pub fn write_gray16(path: &Path, r: &Raster<u16>) -> Result<(), String> {
    let mut enc = encoder(path, r.width, r.height)?;
    enc.set_color(png::ColorType::Grayscale);
    enc.set_depth(png::BitDepth::Sixteen);
    let bytes: Vec<u8> = r.data.iter().flat_map(|v| v.to_be_bytes()).collect();
    let mut w = enc.write_header().map_err(|e| e.to_string())?;
    w.write_image_data(&bytes).map_err(|e| e.to_string())?;
    w.finish().map_err(|e| e.to_string())
}

/// Writes an 8-bit RGB PNG.
pub fn write_rgb8(path: &Path, r: &Raster<[u8; 3]>) -> Result<(), String> {
    let mut enc = encoder(path, r.width, r.height)?;
    enc.set_color(png::ColorType::Rgb);
    enc.set_depth(png::BitDepth::Eight);
    let bytes: Vec<u8> = r.data.iter().flatten().copied().collect();
    let mut w = enc.write_header().map_err(|e| e.to_string())?;
    w.write_image_data(&bytes).map_err(|e| e.to_string())?;
    w.finish().map_err(|e| e.to_string())
}
