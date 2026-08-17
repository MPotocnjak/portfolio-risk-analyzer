import {
    ZIG_NORM_R,
    ZIG_NORM_X,
    ZIG_NORM_F
} from "./jsNormalTables.js";

/*
 * Helpers for reproducing the floating-point operations used by
 * rand 0.9.5 / rand_distr 0.5.1.
 *
 * Rust's IntoFloat::into_float_with_exponent() does not divide by
 * 2^52. Instead, it constructs the IEEE-754 f64 bit representation
 * directly.
 *
 * For f64:
 *   - fraction bits = 52
 *   - exponent bias = 1023
 *
 * The helper below reproduces:
 *
 *     (bits >> 12).into_float_with_exponent(1)
 *
 * which produces a value in [2, 4).
 */
const floatBuffer = new ArrayBuffer(8);
const uint64View = new BigUint64Array(floatBuffer);
const float64View = new Float64Array(floatBuffer);

function intoFloatWithExponent(value, exponent) {
    // Rust:
    //
    // let exponent_bits =
    //     ((exponent_bias + exponent) as u64) << fraction_bits;
    //
    // f64:
    //   exponent_bias = 1023
    //   fraction_bits = 52
    const exponentBits =
        BigInt(1023 + exponent) << 52n;

    // Reconstruct the IEEE-754 f64 bit pattern.
    uint64View[0] = value | exponentBits;

    return float64View[0];
}


/*
 * Reproduces the way rand 0.9 generates a uniform f64.
 *
 * Rust's StandardUniform<f64> implementation:
 *
 *     let float_size = 64;
 *     let precision = 53;
 *     let scale = 1.0 / 2^53;
 *
 *     let value: u64 = rng.random();
 *     let value = value >> (64 - 53);
 *
 *     scale * value
 *
 * Therefore the result is in [0, 1).
 */
function randomF64(rng) {
    const bits = rng.nextUint64();

    // Keep the 53 most significant random bits.
    const value = bits >> 11n;

    // Divide by 2^53.
    return Number(value) / 2 ** 53;
}


/*
 * Reproduces the Open01 distribution used by rand_distr's
 * Ziggurat tail sampling.
 *
 * Open01 generates a floating-point value strictly inside (0, 1).
 *
 * We construct the value from random bits using the same
 * floating-point representation approach as rand 0.9.
 */
function open01(rng) {
    while (true) {
        const bits = rng.nextUint64();

        // Use the 53 most significant bits.
        const value = bits >> 11n;

        // Convert to [0, 1).
        const result = Number(value) / 2 ** 53;

        // Ziggurat's logarithm requires a non-zero value.
        if (result > 0.0) {
            return result;
        }
    }
}


/*
 * Generate one sample from the standard normal distribution N(0, 1).
 *
 * This reproduces the ZIGNOR / Ziggurat implementation used by
 * rand_distr 0.5.1 for StandardNormal.
 *
 * The important point for our benchmark is that this uses:
 *
 *     ChaCha8Rng
 *          ↓
 *     same next_u64()
 *          ↓
 *     same Ziggurat algorithm
 *          ↓
 *     same StandardNormal distribution
 *
 * Therefore, given the same seed, JavaScript should produce the
 * same normal samples as the Rust implementation.
 */
export function standardNormal(rng) {
    while (true) {
        /*
         * Rust's Ziggurat implementation starts with:
         *
         *     let bits = rng.next_u64();
         *
         * The lowest 8 bits determine the Ziggurat layer.
         */
        const bits = rng.nextUint64();

        const i = Number(bits & 0xffn);

        /*
         * Rust:
         *
         *     let u = (bits >> 12)
         *         .into_float_with_exponent(1)
         *         - 3.0;
         *
         * `into_float_with_exponent(1)` creates an f64
         * in [2, 4), so subtracting 3 gives:
         *
         *     u ∈ [-1, 1)
         *
         * This is deliberately implemented using IEEE-754
         * bit construction rather than normal division.
         */
        const u =
            intoFloatWithExponent(bits >> 12n, 1) - 3.0;

        /*
         * Scale the uniform value according to the width
         * of the selected Ziggurat layer.
         */
        const x = u * ZIG_NORM_X[i];

        /*
         * Fast path.
         *
         * If x lies inside the next Ziggurat layer,
         * it is accepted immediately.
         */
        if (Math.abs(x) < ZIG_NORM_X[i + 1]) {
            return x;
        }

        /*
         * Special case for the bottom layer.
         *
         * This is the tail of the normal distribution.
         * Ziggurat uses a separate rejection procedure
         * here because the tail is not covered by the
         * rectangular layers.
         */
        if (i === 0) {
            let xTail;
            let yTail;

            do {
                /*
                 * Rust samples two independent values
                 * from Open01 for the tail calculation.
                 */
                const xRandom = open01(rng);
                const yRandom = open01(rng);

                /*
                 * Generate the tail candidate.
                 */
                xTail =
                    Math.log(xRandom) / ZIG_NORM_R;

                yTail =
                    Math.log(yRandom);

            } while (
                -2.0 * yTail < xTail * xTail
            );

            /*
             * Restore the sign of the original candidate.
             */
            return u < 0.0
                ? xTail - ZIG_NORM_R
                : ZIG_NORM_R - xTail;
        }

        /*
         * Rejection step for all other layers.
         *
         * We interpolate between the probability density
         * values at the two boundaries of the selected layer.
         */
        const random = randomF64(rng);

        const lower =
            ZIG_NORM_F[i + 1] +
            (
                ZIG_NORM_F[i] -
                ZIG_NORM_F[i + 1]
            ) * random;

        /*
         * Standard normal probability density function,
         * without the constant 1/sqrt(2π), which cancels
         * in the rejection comparison.
         */
        const pdf =
            Math.exp(-0.5 * x * x);

        /*
         * Accept the candidate if it lies below the
         * normal density curve.
         */
        if (lower < pdf) {
            return x;
        }

        /*
         * Otherwise reject the candidate and draw another
         * Ziggurat sample.
         */
    }
}


/*
 * Generate a sample from N(mean, standardDeviation).
 *
 * This corresponds to rand_distr::Normal:
 *
 *     X = mean + standard_deviation * Z
 *
 * where Z ~ N(0, 1).
 *
 * We may not need this immediately, because the simulation
 * currently uses standard normal returns, but keeping this
 * helper makes the module equivalent to the Normal distribution
 * API and may be useful later.
 */
export function normal(rng, mean = 0, standardDeviation = 1) {
    return (
        mean +
        standardDeviation * standardNormal(rng)
    );
}