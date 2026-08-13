use crate::models::{
    Portfolio,
    SimulationConfig,
    SimulationResult,
};

use rand::SeedableRng;
use rand_chacha::ChaCha8Rng;
use rand_distr::{Distribution, Normal};

/// Pokreće Monte Carlo simulaciju portfelja koristeći GBM model.
pub fn run_simulation(
    portfolio: &Portfolio,
    config: &SimulationConfig,
) -> Vec<SimulationResult> {

    let mut rng = ChaCha8Rng::seed_from_u64(config.seed);

    let normal = Normal::new(0.0, 1.0).unwrap();

    let mut results = Vec::with_capacity(config.simulations);

    let dt = 1.0; // godišnji vremenski korak

    for _ in 0..config.simulations {
        let mut portfolio_value = config.initial_investment;
        let mut yearly_values = Vec::with_capacity(config.years as usize + 1);
        yearly_values.push(portfolio_value);

        for _year in 0..config.years {
            let mut yearly_return = 0.0;

            for asset in &portfolio.assets {
                let z = normal.sample(&mut rng);

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

    results
}