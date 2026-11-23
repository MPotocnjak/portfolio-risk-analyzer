import { ZIG_NORM_R, ZIG_NORM_X, ZIG_NORM_F } from "./jsNormalTables.js";

const floatBuffer = new ArrayBuffer(8);
const uint64View = new BigUint64Array(floatBuffer);
const float64View = new Float64Array(floatBuffer);

function intoFloatWithExponent(value, exponent) {
    const exponentBits = BigInt(1023 + exponent) << 52n;

    // Reconstruct the IEEE-754 f64 bit pattern.
    uint64View[0] = value | exponentBits;

    return float64View[0];
}

function randomF64(rng) {
    const bits = rng.nextUint64();

    // Keep the 53 most significant random bits.
    const value = bits >> 11n;

    // Divide by 2^53.
    return Number(value) / 2 ** 53;
}

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

export function standardNormal(rng) {
    while (true) {
        const bits = rng.nextUint64();
        const i = Number(bits & 0xffn);
        const u = intoFloatWithExponent(bits >> 12n, 1) - 3.0;
        const x = u * ZIG_NORM_X[i];

        if (Math.abs(x) < ZIG_NORM_X[i + 1]) {
            return x;
        }
        
        if (i === 0) {
            let xTail;
            let yTail;

            do {
                const xRandom = open01(rng);
                const yRandom = open01(rng);
                xTail = Math.log(xRandom) / ZIG_NORM_R;
                yTail = Math.log(yRandom);
            } while (
                -2.0 * yTail < xTail * xTail
            );

            // Restore the sign of the original candidate.
            return u < 0.0
                ? xTail - ZIG_NORM_R
                : ZIG_NORM_R - xTail;
        }

        const random = randomF64(rng);
        const lower = ZIG_NORM_F[i + 1] + ( ZIG_NORM_F[i] - ZIG_NORM_F[i + 1]) * random;
        const pdf = Math.exp(-0.5 * x * x);

        if (lower < pdf) {
            return x;
        }
    }
}

export function normal(rng, mean = 0, standardDeviation = 1) {
    return (
        mean +
        standardDeviation * standardNormal(rng)
    );
}