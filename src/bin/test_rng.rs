use rand::RngCore;
use rand::SeedableRng;
use rand_chacha::ChaCha8Rng;

fn main() {
    let seed = 12345u64;
    let mut rng = ChaCha8Rng::seed_from_u64(seed);

    for i in 0..10 {
        let value = rng.next_u32();
        println!("{}: {}", i, value);
    }
}