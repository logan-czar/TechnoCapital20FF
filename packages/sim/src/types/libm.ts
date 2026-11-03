// Bit-exact exp, log, log10, sin and cos for the sim (D1015). The engines' Math.exp, Math.log,
// Math.log10, Math.sin and Math.cos differ in the last bit between Node 24 (V8 13.6) and current
// Chrome, so a run's state hash would differ between headless and the browser worker. Sim code
// calls these instead; Math.sqrt and ** agree across the engines and stay.
//
// This is a port of V8 13.6's src/base/ieee754.cc, which is fdlibm (Sun Microsystems, 1993:
// "Permission to use, copy, modify, and distribute this software is freely granted, provided that
// this notice is preserved"; modified by the V8 authors). Node 24's Math.* runs that same code, so
// every result here equals Node's bit for bit (test/libm.test.ts proves it and pins digests).
// Ported line by line: the same operation order, the constants from their hex words, and the C
// word macros (GET_HIGH_WORD and the rest) done through one shared little-endian Float64Array view,
// where index 1 is the high word. sin and cos are the fdlibm versions (not V8_USE_LIBM_TRIG_FUNCTIONS).

const WORDS = new ArrayBuffer(8);
const F64 = new Float64Array(WORDS);
const I32 = new Int32Array(WORDS);
const U32 = new Uint32Array(WORDS);

F64[0] = 1.0;
if (U32[1] !== 0x3ff00000) throw new Error("libm: the word view assumes a little-endian machine");

/** GET_HIGH_WORD into an int32_t. */
function highWord(x: number): number {
  F64[0] = x;
  return I32[1]!;
}

/** GET_HIGH_WORD into a uint32_t. */
function highWordU(x: number): number {
  F64[0] = x;
  return U32[1]!;
}

/** GET_LOW_WORD into a uint32_t. */
function lowWordU(x: number): number {
  F64[0] = x;
  return U32[0]!;
}

/** INSERT_WORDS: a double from its high and low 32-bit words (either signedness; the bits are kept). */
function fromWords(hi: number, lo: number): number {
  U32[1] = hi;
  U32[0] = lo;
  return F64[0]!;
}

/** SET_HIGH_WORD. */
function setHighWord(d: number, v: number): number {
  F64[0] = d;
  U32[1] = v;
  return F64[0]!;
}

/** SET_LOW_WORD. */
function setLowWord(d: number, v: number): number {
  F64[0] = d;
  U32[0] = v;
  return F64[0]!;
}

/** 2^n for a whole n in [-1022, 1023], exactly. */
function twoPow(n: number): number {
  return fromWords((n + 1023) << 20, 0);
}

/** C scalbn(x, n) for the small n that __kernel_rem_pio2 passes: x * 2^n, one rounding at most. */
function scalbn(x: number, n: number): number {
  if (n > 1023) return x * twoPow(1023) * twoPow(n - 1023);
  if (n < -1022) return x * twoPow(-1022) * twoPow(n + 1022);
  return x * twoPow(n);
}

/** C static_cast<int32_t>(double) for an in-range value: truncates toward zero. */
function toI32(x: number): number {
  return x | 0;
}

// ---------------------------------------------------------------------------------------------
// __ieee754_rem_pio2, __kernel_rem_pio2, __kernel_cos, __kernel_sin

/* Table of constants for 2/pi, 396 Hex digits (476 decimal) of 2/pi */
const TWO_OVER_PI: readonly number[] = [
  0xa2f983, 0x6e4e44, 0x1529fc, 0x2757d1, 0xf534dd, 0xc0db62, 0x95993c, 0x439041, 0xfe5163, 0xabdebb,
  0xc561b7, 0x246e3a, 0x424dd2, 0xe00649, 0x2eea09, 0xd1921c, 0xfe1deb, 0x1cb129, 0xa73ee8, 0x8235f5,
  0x2ebb44, 0x84e99c, 0x7026b4, 0x5f7e41, 0x3991d6, 0x398353, 0x39f49c, 0x845f8b, 0xbdf928, 0x3b1ff8,
  0x97ffde, 0x05980f, 0xef2f11, 0x8b5a0a, 0x6d1f6d, 0x367ecf, 0x27cb09, 0xb74f46, 0x3f669e, 0x5fea2d,
  0x7527ba, 0xc7ebe5, 0xf17b3d, 0x0739f7, 0x8a5292, 0xea6bfb, 0x5fb11f, 0x8d5d08, 0x560330, 0x46fc7b,
  0x6babf0, 0xcfbc20, 0x9af436, 0x1da9e3, 0x91615e, 0xe61b08, 0x659985, 0x5f14a0, 0x68408d, 0xffd880,
  0x4d7327, 0x310606, 0x1556ca, 0x73a8c9, 0x60e27b, 0xc08c6b,
];

const NPIO2_HW: readonly number[] = [
  0x3ff921fb, 0x400921fb, 0x4012d97c, 0x401921fb, 0x401f6a7a, 0x4022d97c, 0x4025fdbb, 0x402921fb, 0x402c463a,
  0x402f6a7a, 0x4031475c, 0x4032d97c, 0x40346b9c, 0x4035fdbb, 0x40378fdb, 0x403921fb, 0x403ab41b, 0x403c463a,
  0x403dd85a, 0x403f6a7a, 0x40407e4c, 0x4041475c, 0x4042106c, 0x4042d97c, 0x4043a28c, 0x40446b9c, 0x404534ac,
  0x4045fdbb, 0x4046c6cb, 0x40478fdb, 0x404858eb, 0x404921fb,
];

/*
 * invpio2:  53 bits of 2/pi
 * pio2_1:   first  33 bit of pi/2
 * pio2_1t:  pi/2 - pio2_1
 * pio2_2:   second 33 bit of pi/2
 * pio2_2t:  pi/2 - (pio2_1+pio2_2)
 * pio2_3:   third  33 bit of pi/2
 * pio2_3t:  pi/2 - (pio2_1+pio2_2+pio2_3)
 */
const RP_ZERO = 0.0;
const RP_HALF = fromWords(0x3fe00000, 0x00000000); /* 5.00000000000000000000e-01 */
const RP_TWO24 = fromWords(0x41700000, 0x00000000); /* 1.67772160000000000000e+07 */
const INVPIO2 = fromWords(0x3fe45f30, 0x6dc9c883); /* 6.36619772367581382433e-01 */
const PIO2_1 = fromWords(0x3ff921fb, 0x54400000); /* 1.57079632673412561417e+00 */
const PIO2_1T = fromWords(0x3dd0b461, 0x1a626331); /* 6.07710050650619224932e-11 */
const PIO2_2 = fromWords(0x3dd0b461, 0x1a600000); /* 6.07710050630396597660e-11 */
const PIO2_2T = fromWords(0x3ba3198a, 0x2e037073); /* 2.02226624879595063154e-21 */
const PIO2_3 = fromWords(0x3ba3198a, 0x2e000000); /* 2.02226624871116645580e-21 */
const PIO2_3T = fromWords(0x397b839a, 0x252049c1); /* 8.47842766036889956997e-32 */

/** The y[2] out-parameter of __ieee754_rem_pio2, reused across calls (the sim is single-threaded). */
const REM_Y = new Float64Array(2);

/* __ieee754_rem_pio2(x,y)
 *
 * return the remainder of x rem pi/2 in y[0]+y[1]
 * use __kernel_rem_pio2()
 */
function ieee754RemPio2(x: number, y: Float64Array): number {
  let z: number;
  let w: number;
  let t: number;
  let r: number;
  let fn: number;
  let i: number;
  let j: number;
  let n: number;

  z = 0;
  const hx = highWord(x); /* high word of x */
  const ix = hx & 0x7fffffff;
  if (ix <= 0x3fe921fb) {
    /* |x| ~<= pi/4 , no need for reduction */
    y[0] = x;
    y[1] = 0;
    return 0;
  }
  if (ix < 0x4002d97c) {
    /* |x| < 3pi/4, special case with n=+-1 */
    if (hx > 0) {
      z = x - PIO2_1;
      if (ix !== 0x3ff921fb) {
        /* 33+53 bit pi is good enough */
        y[0] = z - PIO2_1T;
        y[1] = z - y[0]! - PIO2_1T;
      } else {
        /* near pi/2, use 33+33+53 bit pi */
        z -= PIO2_2;
        y[0] = z - PIO2_2T;
        y[1] = z - y[0]! - PIO2_2T;
      }
      return 1;
    } else {
      /* negative x */
      z = x + PIO2_1;
      if (ix !== 0x3ff921fb) {
        /* 33+53 bit pi is good enough */
        y[0] = z + PIO2_1T;
        y[1] = z - y[0]! + PIO2_1T;
      } else {
        /* near pi/2, use 33+33+53 bit pi */
        z += PIO2_2;
        y[0] = z + PIO2_2T;
        y[1] = z - y[0]! + PIO2_2T;
      }
      return -1;
    }
  }
  if (ix <= 0x413921fb) {
    /* |x| ~<= 2^19*(pi/2), medium size */
    t = Math.abs(x);
    n = toI32(t * INVPIO2 + RP_HALF);
    fn = n;
    r = t - fn * PIO2_1;
    w = fn * PIO2_1T; /* 1st round good to 85 bit */
    if (n < 32 && ix !== NPIO2_HW[n - 1]) {
      y[0] = r - w; /* quick check no cancellation */
    } else {
      j = ix >> 20;
      y[0] = r - w;
      let high = highWordU(y[0]!);
      i = j - ((high >>> 20) & 0x7ff);
      if (i > 16) {
        /* 2nd iteration needed, good to 118 */
        t = r;
        w = fn * PIO2_2;
        r = t - w;
        w = fn * PIO2_2T - (t - r - w);
        y[0] = r - w;
        high = highWordU(y[0]!);
        i = j - ((high >>> 20) & 0x7ff);
        if (i > 49) {
          /* 3rd iteration need, 151 bits acc */
          t = r; /* will cover all possible cases */
          w = fn * PIO2_3;
          r = t - w;
          w = fn * PIO2_3T - (t - r - w);
          y[0] = r - w;
        }
      }
    }
    y[1] = r - y[0]! - w;
    if (hx < 0) {
      y[0] = -y[0]!;
      y[1] = -y[1]!;
      return -n;
    } else {
      return n;
    }
  }
  /*
   * all other (large) arguments
   */
  if (ix >= 0x7ff00000) {
    /* x is inf or NaN */
    y[0] = y[1] = x - x;
    return 0;
  }
  /* set z = scalbn(|x|,ilogb(x)-23) */
  const low = lowWordU(x);
  z = setLowWord(z, low);
  const e0 = (ix >> 20) - 1046; /* e0 = ilogb(z)-23; */
  z = setHighWord(z, ix - (e0 << 20));
  const tx = new Float64Array(3);
  for (i = 0; i < 2; i++) {
    tx[i] = toI32(z);
    z = (z - tx[i]!) * RP_TWO24;
  }
  tx[2] = z;
  let nx = 3;
  while (tx[nx - 1] === RP_ZERO) nx--; /* skip zero term */
  n = kernelRemPio2(tx, y, e0, nx, 2, TWO_OVER_PI);
  if (hx < 0) {
    y[0] = -y[0]!;
    y[1] = -y[1]!;
    return -n;
  }
  return n;
}

const INIT_JK: readonly number[] = [2, 3, 4, 6]; /* initial value for jk */

const PIO2: readonly number[] = [
  fromWords(0x3ff921fb, 0x40000000) /* 1.57079625129699707031e+00 */,
  fromWords(0x3e74442d, 0x00000000) /* 7.54978941586159635335e-08 */,
  fromWords(0x3cf84698, 0x80000000) /* 5.39030252995776476554e-15 */,
  fromWords(0x3b78cc51, 0x60000000) /* 3.28200341580791294123e-22 */,
  fromWords(0x39f01b83, 0x80000000) /* 1.27065575308067607349e-29 */,
  fromWords(0x387a2520, 0x40000000) /* 1.22933308981111328932e-36 */,
  fromWords(0x36e38222, 0x80000000) /* 2.73370053816464559624e-44 */,
  fromWords(0x3569f31d, 0x00000000) /* 2.16741683877804819444e-51 */,
];

const KR_ZERO = 0.0;
const KR_ONE = 1.0;
const KR_TWO24 = fromWords(0x41700000, 0x00000000); /* 1.67772160000000000000e+07 */
const KR_TWON24 = fromWords(0x3e700000, 0x00000000); /* 5.96046447753906250000e-08 */

/* __kernel_rem_pio2(x,y,e0,nx,prec,ipio2)
 * return the last three digits of N with y = x - N*pi/2 so that |y| < pi/2. x[] is the positive
 * input broken into nx 24-bit pieces, x[0]*2^e0 matching x up to 24 bits; ipio2[] holds 2/pi in
 * 24-bit chunks. See fdlibm k_rem_pio2.c (and ieee754.cc) for the full description.
 */
function kernelRemPio2(
  x: Float64Array,
  y: Float64Array,
  e0: number,
  nx: number,
  prec: number,
  ipio2: readonly number[],
): number {
  let jz: number;
  let carry: number;
  let n: number;
  let i: number;
  let j: number;
  let k: number;
  let q0: number;
  let ih: number;
  let z: number;
  let fw: number;
  const iq = new Int32Array(20);
  const f = new Float64Array(20);
  const fq = new Float64Array(20);
  const q = new Float64Array(20);

  /* initialize jk*/
  const jk = INIT_JK[prec]!;
  const jp = jk;

  /* determine jx,jv,q0, note that 3>q0 */
  const jx = nx - 1;
  let jv = toI32((e0 - 3) / 24);
  if (jv < 0) jv = 0;
  q0 = e0 - 24 * (jv + 1);

  /* set up f[0] to f[jx+jk] where f[jx+jk] = ipio2[jv+jk] */
  j = jv - jx;
  const m = jx + jk;
  for (i = 0; i <= m; i++, j++) {
    f[i] = j < 0 ? KR_ZERO : ipio2[j]!;
  }

  /* compute q[0],q[1],...q[jk] */
  for (i = 0; i <= jk; i++) {
    for (j = 0, fw = 0.0; j <= jx; j++) fw += x[j]! * f[jx + i - j]!;
    q[i] = fw;
  }

  jz = jk;
  for (;;) {
    // recompute:
    /* distill q[] into iq[] reversingly */
    for (i = 0, j = jz, z = q[jz]!; j > 0; i++, j--) {
      fw = toI32(KR_TWON24 * z);
      iq[i] = toI32(z - KR_TWO24 * fw);
      z = q[j - 1]! + fw;
    }

    /* compute n */
    z = scalbn(z, q0); /* actual value of z */
    z -= 8.0 * Math.floor(z * 0.125); /* trim off integer >= 8 */
    n = toI32(z);
    z -= n;
    ih = 0;
    if (q0 > 0) {
      /* need iq[jz-1] to determine n */
      i = iq[jz - 1]! >> (24 - q0);
      n += i;
      iq[jz - 1] = iq[jz - 1]! - (i << (24 - q0));
      ih = iq[jz - 1]! >> (23 - q0);
    } else if (q0 === 0) {
      ih = iq[jz - 1]! >> 23;
    } else if (z >= 0.5) {
      ih = 2;
    }

    if (ih > 0) {
      /* q > 0.5 */
      n += 1;
      carry = 0;
      for (i = 0; i < jz; i++) {
        /* compute 1-q */
        j = iq[i]!;
        if (carry === 0) {
          if (j !== 0) {
            carry = 1;
            iq[i] = 0x1000000 - j;
          }
        } else {
          iq[i] = 0xffffff - j;
        }
      }
      if (q0 > 0) {
        /* rare case: chance is 1 in 12 */
        switch (q0) {
          case 1:
            iq[jz - 1] = iq[jz - 1]! & 0x7fffff;
            break;
          case 2:
            iq[jz - 1] = iq[jz - 1]! & 0x3fffff;
            break;
        }
      }
      if (ih === 2) {
        z = KR_ONE - z;
        if (carry !== 0) z -= scalbn(KR_ONE, q0);
      }
    }

    /* check if recomputation is needed */
    if (z === KR_ZERO) {
      j = 0;
      for (i = jz - 1; i >= jk; i--) j |= iq[i]!;
      if (j === 0) {
        /* need recomputation */
        for (k = 1; jk >= k && iq[jk - k] === 0; k++) {
          /* k = no. of terms needed */
        }

        for (i = jz + 1; i <= jz + k; i++) {
          /* add q[jz+1] to q[jz+k] */
          f[jx + i] = ipio2[jv + i]!;
          for (j = 0, fw = 0.0; j <= jx; j++) fw += x[j]! * f[jx + i - j]!;
          q[i] = fw;
        }
        jz += k;
        continue; // goto recompute
      }
    }
    break;
  }

  /* chop off zero terms */
  if (z === 0.0) {
    jz -= 1;
    q0 -= 24;
    while (iq[jz] === 0) {
      jz--;
      q0 -= 24;
    }
  } else {
    /* break z into 24-bit if necessary */
    z = scalbn(z, -q0);
    if (z >= KR_TWO24) {
      fw = toI32(KR_TWON24 * z);
      iq[jz] = toI32(z - KR_TWO24 * fw);
      jz += 1;
      q0 += 24;
      iq[jz] = toI32(fw);
    } else {
      iq[jz] = toI32(z);
    }
  }

  /* convert integer "bit" chunk to floating-point value */
  fw = scalbn(KR_ONE, q0);
  for (i = jz; i >= 0; i--) {
    q[i] = fw * iq[i]!;
    fw *= KR_TWON24;
  }

  /* compute PIo2[0,...,jp]*q[jz,...,0] */
  for (i = jz; i >= 0; i--) {
    for (fw = 0.0, k = 0; k <= jp && k <= jz - i; k++) fw += PIO2[k]! * q[i + k]!;
    fq[jz - i] = fw;
  }

  /* compress fq[] into y[] */
  switch (prec) {
    case 0:
      fw = 0.0;
      for (i = jz; i >= 0; i--) fw += fq[i]!;
      y[0] = ih === 0 ? fw : -fw;
      break;
    case 1:
    case 2:
      fw = 0.0;
      for (i = jz; i >= 0; i--) fw += fq[i]!;
      y[0] = ih === 0 ? fw : -fw;
      fw = fq[0]! - fw;
      for (i = 1; i <= jz; i++) fw += fq[i]!;
      y[1] = ih === 0 ? fw : -fw;
      break;
    case 3 /* painful */:
      for (i = jz; i > 0; i--) {
        fw = fq[i - 1]! + fq[i]!;
        fq[i] = fq[i]! + (fq[i - 1]! - fw);
        fq[i - 1] = fw;
      }
      for (i = jz; i > 1; i--) {
        fw = fq[i - 1]! + fq[i]!;
        fq[i] = fq[i]! + (fq[i - 1]! - fw);
        fq[i - 1] = fw;
      }
      for (fw = 0.0, i = jz; i >= 2; i--) fw += fq[i]!;
      if (ih === 0) {
        y[0] = fq[0]!;
        y[1] = fq[1]!;
        y[2] = fw;
      } else {
        y[0] = -fq[0]!;
        y[1] = -fq[1]!;
        y[2] = -fw;
      }
  }
  return n & 7;
}

const KC_ONE = fromWords(0x3ff00000, 0x00000000); /* 1.00000000000000000000e+00 */
const C1 = fromWords(0x3fa55555, 0x5555554c); /* 4.16666666666666019037e-02 */
const C2 = fromWords(0xbf56c16c, 0x16c15177); /* -1.38888888888741095749e-03 */
const C3 = fromWords(0x3efa01a0, 0x19cb1590); /* 2.48015872894767294178e-05 */
const C4 = fromWords(0xbe927e4f, 0x809c52ad); /* -2.75573143513906633035e-07 */
const C5 = fromWords(0x3e21ee9e, 0xbdb4b1c4); /* 2.08757232129817482790e-09 */
const C6 = fromWords(0xbda8fae9, 0xbe8838d4); /* -1.13596475577881948265e-11 */

/* __kernel_cos( x,  y )
 * kernel cos function on [-pi/4, pi/4], pi/4 ~ 0.785398164
 * Input x is assumed to be bounded by ~pi/4 in magnitude.
 * Input y is the tail of x.
 * cos(x+y) = 1 - (x*x/2 - (r - x*y)), or for x > 0.3, (1-qx) - ((x*x/2-qx) - (r-x*y)) with
 * qx = |x|/4 (last 32 bits masked off), or 0.28125 when x > 0.78125.
 */
function kernelCos(x: number, y: number): number {
  let qx: number;
  let ix = highWord(x);
  ix &= 0x7fffffff; /* ix = |x|'s high word*/
  if (ix < 0x3e400000) {
    /* if x < 2**27 */
    if (toI32(x) === 0) return KC_ONE; /* generate inexact */
  }
  const z = x * x;
  const r = z * (C1 + z * (C2 + z * (C3 + z * (C4 + z * (C5 + z * C6)))));
  if (ix < 0x3fd33333) {
    /* if |x| < 0.3 */
    return KC_ONE - (0.5 * z - (z * r - x * y));
  } else {
    if (ix > 0x3fe90000) {
      /* x > 0.78125 */
      qx = 0.28125;
    } else {
      qx = fromWords(ix - 0x00200000, 0); /* x/4 */
    }
    const iz = 0.5 * z - qx;
    const a = KC_ONE - qx;
    return a - (iz - (z * r - x * y));
  }
}

const KS_HALF = fromWords(0x3fe00000, 0x00000000); /* 5.00000000000000000000e-01 */
const S1 = fromWords(0xbfc55555, 0x55555549); /* -1.66666666666666324348e-01 */
const S2 = fromWords(0x3f811111, 0x1110f8a6); /* 8.33333333332248946124e-03 */
const S3 = fromWords(0xbf2a01a0, 0x19c161d5); /* -1.98412698298579493134e-04 */
const S4 = fromWords(0x3ec71de3, 0x57b1fe7d); /* 2.75573137070700676789e-06 */
const S5 = fromWords(0xbe5ae5e6, 0x8a2b9ceb); /* -2.50507602534068634195e-08 */
const S6 = fromWords(0x3de5d93a, 0x5acfd57c); /* 1.58969099521155010221e-10 */

/* __kernel_sin( x, y, iy)
 * kernel sin function on [-pi/4, pi/4], pi/4 ~ 0.7854
 * Input x is assumed to be bounded by ~pi/4 in magnitude.
 * Input y is the tail of x.
 * Input iy indicates whether y is 0. (if iy=0, y assume to be 0).
 * sin(x) = x + (S1*x^3 + (x^2*(r-y/2)+y)), r = x^3*(S2+x^2*(S3+x^2*(S4+x^2*(S5+x^2*S6)))).
 */
function kernelSin(x: number, y: number, iy: number): number {
  let ix = highWord(x);
  ix &= 0x7fffffff; /* high word of x */
  if (ix < 0x3e400000) {
    /* |x| < 2**-27 */
    if (toI32(x) === 0) return x;
  } /* generate inexact */
  const z = x * x;
  const v = z * x;
  const r = S2 + z * (S3 + z * (S4 + z * (S5 + z * S6)));
  if (iy === 0) {
    return x + v * (S1 + z * r);
  } else {
    return x - (z * (KS_HALF * y - v * r) - y - v * S1);
  }
}

// ---------------------------------------------------------------------------------------------
// cos, sin

/** cos(x), fdlibm (V8 13.6 ieee754::cos). */
export function cosF(x: number): number {
  const z = 0.0;

  /* High word of x. */
  let ix = highWord(x);

  /* |x| ~< pi/4 */
  ix &= 0x7fffffff;
  if (ix <= 0x3fe921fb) {
    return kernelCos(x, z);
  } else if (ix >= 0x7ff00000) {
    /* cos(Inf or NaN) is NaN */
    return x - x;
  } else {
    /* argument reduction needed */
    const y = REM_Y;
    const n = ieee754RemPio2(x, y);
    switch (n & 3) {
      case 0:
        return kernelCos(y[0]!, y[1]!);
      case 1:
        return -kernelSin(y[0]!, y[1]!, 1);
      case 2:
        return -kernelCos(y[0]!, y[1]!);
      default:
        return kernelSin(y[0]!, y[1]!, 1);
    }
  }
}

/** sin(x), fdlibm (V8 13.6 ieee754::sin). */
export function sinF(x: number): number {
  const z = 0.0;

  /* High word of x. */
  let ix = highWord(x);

  /* |x| ~< pi/4 */
  ix &= 0x7fffffff;
  if (ix <= 0x3fe921fb) {
    return kernelSin(x, z, 0);
  } else if (ix >= 0x7ff00000) {
    /* sin(Inf or NaN) is NaN */
    return x - x;
  } else {
    /* argument reduction needed */
    const y = REM_Y;
    const n = ieee754RemPio2(x, y);
    switch (n & 3) {
      case 0:
        return kernelSin(y[0]!, y[1]!, 1);
      case 1:
        return kernelCos(y[0]!, y[1]!);
      case 2:
        return -kernelSin(y[0]!, y[1]!, 1);
      default:
        return -kernelCos(y[0]!, y[1]!);
    }
  }
}

// ---------------------------------------------------------------------------------------------
// exp

const EXP_ONE = 1.0;
const HALF_SIGNED: readonly number[] = [0.5, -0.5];
const O_THRESHOLD = fromWords(0x40862e42, 0xfefa39ef); /* 7.09782712893383973096e+02 */
const U_THRESHOLD = fromWords(0xc0874910, 0xd52d3051); /* -7.45133219101941108420e+02 */
const LN2_HI_SIGNED: readonly number[] = [
  fromWords(0x3fe62e42, 0xfee00000) /* 6.93147180369123816490e-01 */,
  fromWords(0xbfe62e42, 0xfee00000) /* -6.93147180369123816490e-01 */,
];
const LN2_LO_SIGNED: readonly number[] = [
  fromWords(0x3dea39ef, 0x35793c76) /* 1.90821492927058770002e-10 */,
  fromWords(0xbdea39ef, 0x35793c76) /* -1.90821492927058770002e-10 */,
];
const INVLN2 = fromWords(0x3ff71547, 0x652b82fe); /* 1.44269504088896338700e+00 */
const P1 = fromWords(0x3fc55555, 0x5555553e); /* 1.66666666666666019037e-01 */
const P2 = fromWords(0xbf66c16c, 0x16bebd93); /* -2.77777777770155933842e-03 */
const P3 = fromWords(0x3f11566a, 0xaf25de2c); /* 6.61375632143793436117e-05 */
const P4 = fromWords(0xbebbbd41, 0xc5d26bf1); /* -1.65339022054652515390e-06 */
const P5 = fromWords(0x3e663769, 0x72bea4d0); /* 4.13813679705723846039e-08 */
const E = fromWords(0x4005bf0a, 0x8b145769); /* 2.718281828459045 */
const HUGE = 1.0e300;
const TWOM1000 = fromWords(0x01700000, 0); /* 9.33263618503218878990e-302, 2**-1000 */
const TWO1023 = fromWords(0x7fe00000, 0); /* 8.988465674311579539e307, 0x1p1023 */

/**
 * exp(x), fdlibm (V8 13.6 ieee754::exp). x = k*ln2 + r with |r| <= 0.5*ln2, exp(r) from a degree-5
 * rational approximation, then scaled by 2^k. Overflows past 7.09782712893383973096e+02 and
 * underflows below -7.45133219101941108420e+02.
 */
export function expF(x: number): number {
  let y: number;
  let hi = 0.0;
  let lo = 0.0;
  let t: number;
  let twopk: number;
  let k = 0;

  let hx = highWordU(x);
  const xsb = (hx >>> 31) & 1; /* sign bit of x */
  hx &= 0x7fffffff; /* high word of |x| */

  /* filter out non-finite argument */
  if (hx >= 0x40862e42) {
    /* if |x|>=709.78... */
    if (hx >= 0x7ff00000) {
      const lx = lowWordU(x);
      if (((hx & 0xfffff) | lx) !== 0) return x + x; /* NaN */
      else return xsb === 0 ? x : 0.0; /* exp(+-inf)={inf,0} */
    }
    if (x > O_THRESHOLD) return HUGE * HUGE; /* overflow */
    if (x < U_THRESHOLD) return TWOM1000 * TWOM1000; /* underflow */
  }

  /* argument reduction */
  if (hx > 0x3fd62e42) {
    /* if  |x| > 0.5 ln2 */
    if (hx < 0x3ff0a2b2) {
      /* and |x| < 1.5 ln2 */
      // V8 special-cases exp(1) to return the correctly rounded E.
      if (x === 1.0) return E;
      hi = x - LN2_HI_SIGNED[xsb]!;
      lo = LN2_LO_SIGNED[xsb]!;
      k = 1 - xsb - xsb;
    } else {
      k = toI32(INVLN2 * x + HALF_SIGNED[xsb]!);
      t = k;
      hi = x - t * LN2_HI_SIGNED[0]!; /* t*ln2HI is exact here */
      lo = t * LN2_LO_SIGNED[0]!;
    }
    x = hi - lo;
  } else if (hx < 0x3e300000) {
    /* when |x|<2**-28 */
    if (HUGE + x > EXP_ONE) return EXP_ONE + x; /* trigger inexact */
  } else {
    k = 0;
  }

  /* x is now in primary range */
  t = x * x;
  if (k >= -1021) {
    twopk = fromWords(0x3ff00000 + (k << 20), 0);
  } else {
    twopk = fromWords(0x3ff00000 + ((k + 1000) << 20), 0);
  }
  const c = x - t * (P1 + t * (P2 + t * (P3 + t * (P4 + t * P5))));
  if (k === 0) {
    return EXP_ONE - ((x * c) / (c - 2.0) - x);
  } else {
    y = EXP_ONE - (lo - (x * c) / (2.0 - c) - hi);
  }
  if (k >= -1021) {
    if (k === 1024) return y * 2.0 * TWO1023;
    return y * twopk;
  } else {
    return y * twopk * TWOM1000;
  }
}

// ---------------------------------------------------------------------------------------------
// log, log10

const LN2_HI = fromWords(0x3fe62e42, 0xfee00000); /* 6.93147180369123816490e-01 */
const LN2_LO = fromWords(0x3dea39ef, 0x35793c76); /* 1.90821492927058770002e-10 */
const TWO54 = fromWords(0x43500000, 0x00000000); /* 1.80143985094819840000e+16 */
const LG1 = fromWords(0x3fe55555, 0x55555593); /* 6.666666666666735130e-01 */
const LG2 = fromWords(0x3fd99999, 0x9997fa04); /* 3.999999999940941908e-01 */
const LG3 = fromWords(0x3fd24924, 0x94229359); /* 2.857142874366239149e-01 */
const LG4 = fromWords(0x3fcc71c5, 0x1d8e78af); /* 2.222219843214978396e-01 */
const LG5 = fromWords(0x3fc74664, 0x96cb03de); /* 1.818357216161805012e-01 */
const LG6 = fromWords(0x3fc39a09, 0xd078c69f); /* 1.531383769920937332e-01 */
const LG7 = fromWords(0x3fc2f112, 0xdf3e5244); /* 1.479819860511658591e-01 */
const LOG_ZERO = 0.0;

/**
 * log(x), fdlibm (V8 13.6 ieee754::log). x = 2^k * (1+f) with sqrt(2)/2 < 1+f < sqrt(2), then
 * log(1+f) from s = f/(2+f) and a degree-14 polynomial, plus k*ln2 split into ln2_hi + ln2_lo.
 */
export function logF(x: number): number {
  let hfsq: number;
  let R: number;
  let dk: number;
  let k: number;
  let hx: number;
  let i: number;

  F64[0] = x; /* EXTRACT_WORDS(hx, lx, x) */
  hx = I32[1]!;
  const lx = U32[0]!;

  k = 0;
  if (hx < 0x00100000) {
    /* x < 2**-1022  */
    if (((hx & 0x7fffffff) | lx) === 0) {
      return Number.NEGATIVE_INFINITY; /* log(+-0)=-inf */
    }
    if (hx < 0) {
      return Number.NaN; /* log(-#) = NaN */
    }
    k -= 54;
    x *= TWO54; /* subnormal number, scale up x */
    hx = highWord(x);
  }
  if (hx >= 0x7ff00000) return x + x;
  k += (hx >> 20) - 1023;
  hx &= 0x000fffff;
  i = (hx + 0x95f64) & 0x100000;
  x = setHighWord(x, hx | (i ^ 0x3ff00000)); /* normalize x or x/2 */
  k += i >> 20;
  const f = x - 1.0;
  if ((0x000fffff & (2 + hx)) < 3) {
    /* -2**-20 <= f < 2**-20 */
    if (f === LOG_ZERO) {
      if (k === 0) {
        return LOG_ZERO;
      } else {
        dk = k;
        return dk * LN2_HI + dk * LN2_LO;
      }
    }
    // The C writes 0.33333333333333333; this is the same double, spelled as it round-trips.
    R = f * f * (0.5 - 0.3333333333333333 * f);
    if (k === 0) {
      return f - R;
    } else {
      dk = k;
      return dk * LN2_HI - (R - dk * LN2_LO - f);
    }
  }
  const s = f / (2.0 + f);
  dk = k;
  const z = s * s;
  i = hx - 0x6147a;
  const w = z * z;
  const j = 0x6b851 - hx;
  const t1 = w * (LG2 + w * (LG4 + w * LG6));
  const t2 = z * (LG1 + w * (LG3 + w * (LG5 + w * LG7)));
  i |= j;
  R = t2 + t1;
  if (i > 0) {
    hfsq = 0.5 * f * f;
    if (k === 0) return f - (hfsq - s * (hfsq + R));
    else return dk * LN2_HI - (hfsq - (s * (hfsq + R) + dk * LN2_LO) - f);
  } else {
    if (k === 0) return f - s * (f - R);
    else return dk * LN2_HI - (s * (f - R) - dk * LN2_LO - f);
  }
}

// The C gives only the decimal 4.34294481903251816668e-01; these are the words it compiles to.
const IVLN10 = fromWords(0x3fdbcb7b, 0x1526e50e);
const LOG10_2HI = fromWords(0x3fd34413, 0x509f6000); /* 3.01029995663611771306e-01 */
const LOG10_2LO = fromWords(0x3d59fef3, 0x11f12b36); /* 3.69423907715893078616e-13 */

/**
 * log10(x), fdlibm (V8 13.6 ieee754::log10): n = ilogb(x) (n+1 when negative), x scaled by 2^-n,
 * then n*log10_2hi + (n*log10_2lo + ivln10*log(x)). log10(10^N) = N for N = 0..22.
 */
export function log10F(x: number): number {
  let k: number;
  let hx: number;
  let lx: number;

  F64[0] = x; /* EXTRACT_WORDS(hx, lx, x) */
  hx = I32[1]!;
  lx = U32[0]!;

  k = 0;
  if (hx < 0x00100000) {
    /* x < 2**-1022  */
    if (((hx & 0x7fffffff) | lx) === 0) {
      return Number.NEGATIVE_INFINITY; /* log(+-0)=-inf */
    }
    if (hx < 0) {
      return Number.NaN; /* log(-#) = NaN */
    }
    k -= 54;
    x *= TWO54; /* subnormal number, scale up x */
    hx = highWord(x);
    lx = lowWordU(x);
  }
  if (hx >= 0x7ff00000) return x + x;
  if (hx === 0x3ff00000 && lx === 0) return 0.0; /* log(1) = +0 */
  k += (hx >> 20) - 1023;

  // C: (k & 0x80000000) >> 31 on an unsigned value, so 1 when k < 0.
  const i = (k & 0x80000000) >>> 31;
  hx = (hx & 0x000fffff) | ((0x3ff - i) << 20);
  const y = k + i;
  x = setHighWord(x, hx);
  x = setLowWord(x, lx);

  const z = y * LOG10_2LO + IVLN10 * logF(x);
  return z + y * LOG10_2HI;
}
