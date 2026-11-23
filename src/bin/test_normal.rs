use rand::SeedableRng;
use rand_chacha::ChaCha8Rng;
use rand_distr::{Distribution, Normal};

fn main() {
    let seed = 12345u64;
    let mut rng = ChaCha8Rng::seed_from_u64(seed);

    let normal = Normal::new(0.0, 1.0).unwrap();

    for i in 0..10 {
        let value = normal.sample(&mut rng);

        println!("{}: {:.17}", i, value);
    }
}