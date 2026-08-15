use crate::models::{
    Portfolio,
    SimulationConfig,
    SimulationResult,
};

use rand::SeedableRng;
use rand_chacha::ChaCha8Rng;
use rand_distr::{Distribution, Normal};

/// Provjerava osnovnu strukturu i vrijednosti korelacijske matrice.
fn validate_correlation_matrix(matrix: &[Vec<f64>], asset_count: usize) -> Result<(), String> {
    if matrix.len() != asset_count {
        return Err(format!(
            "Broj redaka korelacijske matrice ({}) mora odgovarati broju imovina ({}).",
            matrix.len(), asset_count
        ));
    }

    if matrix.iter().any(|row| row.len() != asset_count) {
        return Err("Korelacijska matrica mora biti kvadratna.".to_string());
    }

    for i in 0..asset_count {
        for j in 0..asset_count {
            let value = matrix[i][j];

            if !value.is_finite() {
                return Err("Korelacijska matrica sadrži neispravnu vrijednost.".to_string());
            }

            if !(-1.0..=1.0).contains(&value) {
                return Err(format!(
                    "Korelacija na poziciji ({}, {}) mora biti između -1 i 1.",
                    i, j
                ));
            }

            if i == j && (value - 1.0).abs() > 1e-10 {
                return Err(format!(
                    "Dijagonalni elementi korelacijske matrice moraju biti 1.0. \
                    Element ({}, {}) je {}.",
                    i, i, value
                ));
            }

            if (matrix[i][j] - matrix[j][i]).abs() > 1e-10 {
                return Err(format!(
                    "Korelacijska matrica mora biti simetrična. \
                    Elementi ({}, {}) i ({}, {}) nisu jednaki.",
                    i, j, j, i
                ));
            }
        }
    }

    Ok(())
}

/// Cholesky dekompozicija korelacijske matrice.
/// Za pozitivno definitnu matricu C pronalazi matricu L
/// takvu da vrijedi:
/// C = L * L^T
fn cholesky_decomposition(matrix: &[Vec<f64>]) -> Result<Vec<Vec<f64>>, String> {
    let n = matrix.len();

    if n == 0 {
        return Err("Korelacijska matrica je prazna.".to_string());
    }

    if matrix.iter().any(|row| row.len() != n) {
        return Err("Korelacijska matrica mora biti kvadratna.".to_string());
    }

    let mut lower = vec![vec![0.0; n]; n];

    for i in 0..n {
        for j in 0..=i {
            let mut sum = matrix[i][j];

            for k in 0..j {
                sum -= lower[i][k] * lower[j][k];
            }

            if i == j {
                if sum <= 0.0 {
                    return Err("Korelacijska matrica nije pozitivno definitna.".to_string());
                }
                lower[i][j] = sum.sqrt();
            } else {
                if lower[j][j].abs() < 1e-12 {
                    return Err("Korelacijska matrica nije pogodna za Cholesky dekompoziciju.".to_string());
                }
                lower[i][j] = sum / lower[j][j];
            }
        }
    }

    Ok(lower)
}

/// Generira korelirane standardne normalne slučajne varijable.
/// Ako je C korelacijska matrica, a L njezina Cholesky
/// dekompozicija, tada za nezavisne Z ~ N(0, I):
/// X = L * Z
/// daje korelirane varijable s korelacijskom matricom C.
fn generate_correlated_shocks(lower: &[Vec<f64>], rng: &mut ChaCha8Rng, normal: &Normal<f64>) -> Vec<f64> {
    let n = lower.len();

    let independent: Vec<f64> = (0..n).map(|_| normal.sample(rng)).collect();

    let mut correlated = vec![0.0; n];

    for i in 0..n {
        for j in 0..=i {
            correlated[i] += lower[i][j] * independent[j];
        }
    }

    correlated
}

/// Pokreće Monte Carlo simulaciju portfelja koristeći GBM model
/// i korelirane slučajne šokove između imovina.
pub fn run_simulation(
    portfolio: &Portfolio,
    config: &SimulationConfig,
) -> Result<Vec<SimulationResult>, String> {
    if portfolio.assets.is_empty() {
        return Err("Portfolio mora sadržavati barem jednu imovinu.".to_string());
    }

    validate_correlation_matrix(
        &portfolio.correlations,
        portfolio.assets.len(),
    )?;

    let mut rng = ChaCha8Rng::seed_from_u64(config.seed);

    let normal = Normal::new(0.0, 1.0).unwrap();

    let lower = cholesky_decomposition(&portfolio.correlations)?;

    let mut results = Vec::with_capacity(config.simulations);

    let dt = 1.0; // godišnji vremenski korak

    for _ in 0..config.simulations {
        let mut portfolio_value = config.initial_investment;
        let mut yearly_values = Vec::with_capacity(config.years as usize + 1);
        yearly_values.push(portfolio_value);

        for _year in 0..config.years {
            // Generiramo jedan skup koreliranih šokova za sve imovine u ovoj godini.
            let shocks = generate_correlated_shocks(&lower, &mut rng, &normal);

            let mut yearly_return = 0.0;

            for (asset_index, asset) in portfolio.assets.iter().enumerate() {
                let z = shocks[asset_index];

                let gbm_return =
                    (asset.expected_return
                    - 0.5 * asset.volatility.powi(2)) * dt
                    +
                    asset.volatility * dt.sqrt() * z;

                let asset_growth = gbm_return.exp() - 1.0;

                yearly_return +=
                    asset.weight * asset_growth;
            }

            portfolio_value *= 1.0 + yearly_return;
            yearly_values.push(portfolio_value);
        }

        results.push(
            SimulationResult {
                final_value: portfolio_value,
                yearly_values,
            }
        );
    }

    Ok(results)
}