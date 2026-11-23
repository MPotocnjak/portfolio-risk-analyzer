// JavaScript ekvivalent Rustovog rand_chacha::ChaCha8Rng
// s istim seed_from_u64 postupkom.

const MASK_64 = 0xffffffffffffffffn;

const PCG_MULTIPLIER = 6364136223846793005n;
const PCG_INCREMENT = 11634580027462260723n;

function rotateRight32(value, bits) {
    return (
        (value >>> bits) |
        (value << (32 - bits))
    ) >>> 0;
}

function pcg32(state) {
    state.value =
        (state.value * PCG_MULTIPLIER + PCG_INCREMENT) &
        MASK_64;

    const currentState = state.value;

    const xorshifted =
        Number(
            ((currentState >> 18n) ^ currentState) >> 27n
        ) >>> 0;

    const rotation =
        Number(currentState >> 59n);

    const result =
        rotateRight32(xorshifted, rotation);

    return result;
}

function seedFromU64(seed) {
    const state = {
        value: BigInt(seed) & MASK_64
    };

    const seedBytes = new Uint8Array(32);

    for (let offset = 0; offset < 32; offset += 4) {
        const value = pcg32(state);

        seedBytes[offset] = value & 0xff;
        seedBytes[offset + 1] = (value >>> 8) & 0xff;
        seedBytes[offset + 2] = (value >>> 16) & 0xff;
        seedBytes[offset + 3] = (value >>> 24) & 0xff;
    }

    return seedBytes;
}

function readU32LE(bytes, offset) {
    return (
        bytes[offset] |
        (bytes[offset + 1] << 8) |
        (bytes[offset + 2] << 16) |
        (bytes[offset + 3] << 24)
    ) >>> 0;
}

export class ChaCha8Rng {
    constructor(seed) {
        const seedBytes = seedFromU64(seed);

        this.state = new Uint32Array(16);

        // ChaCha constants: "expand 32-byte k"
        this.state[0] = 0x61707865;
        this.state[1] = 0x3320646e;
        this.state[2] = 0x79622d32;
        this.state[3] = 0x6b206574;

        // 256-bit seed / key
        for (let i = 0; i < 8; i++) {
            this.state[4 + i] =
                readU32LE(seedBytes, i * 4);
        }

        // 64-bit counter
        this.state[12] = 0;
        this.state[13] = 0;

        // 64-bit stream ID
        this.state[14] = 0;
        this.state[15] = 0;

        this.buffer = new Uint32Array(16);
        this.bufferIndex = 16;
    }

    nextUint32() {
        if (this.bufferIndex >= 16) {
            this.generateBlock();
            this.bufferIndex = 0;
        }

        return this.buffer[this.bufferIndex++];
    }

    nextUint64() {
        const low = BigInt(this.nextUint32());
        const high = BigInt(this.nextUint32());
    
        return (high << 32n) | low;
    }
    
    nextFloat() {
        return this.nextUint32() / 4294967296;
    }

    generateBlock() {
        const x = new Uint32Array(this.state);

        // ChaCha8 = 8 rounds = 4 double-rounds
        for (let i = 0; i < 4; i++) {
            // Column round
            this.quarterRound(x, 0, 4, 8, 12);
            this.quarterRound(x, 1, 5, 9, 13);
            this.quarterRound(x, 2, 6, 10, 14);
            this.quarterRound(x, 3, 7, 11, 15);

            // Diagonal round
            this.quarterRound(x, 0, 5, 10, 15);
            this.quarterRound(x, 1, 6, 11, 12);
            this.quarterRound(x, 2, 7, 8, 13);
            this.quarterRound(x, 3, 4, 9, 14);
        }

        for (let i = 0; i < 16; i++) {
            this.buffer[i] =
                (x[i] + this.state[i]) >>> 0;
        }

        // 64-bit counter increment
        this.state[12] =
            (this.state[12] + 1) >>> 0;

        if (this.state[12] === 0) {
            this.state[13] =
                (this.state[13] + 1) >>> 0;
        }
    }

    quarterRound(x, a, b, c, d) {
        x[a] = (x[a] + x[b]) >>> 0;
        x[d] = this.rotateLeft(x[d] ^ x[a], 16);

        x[c] = (x[c] + x[d]) >>> 0;
        x[b] = this.rotateLeft(x[b] ^ x[c], 12);

        x[a] = (x[a] + x[b]) >>> 0;
        x[d] = this.rotateLeft(x[d] ^ x[a], 8);

        x[c] = (x[c] + x[d]) >>> 0;
        x[b] = this.rotateLeft(x[b] ^ x[c], 7);
    }

    rotateLeft(value, bits) {
        return (
            (value << bits) |
            (value >>> (32 - bits))
        ) >>> 0;
    }
}