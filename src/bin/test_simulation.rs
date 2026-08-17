use portfolio_risk_analyzer::models::{
    Asset,
    Portfolio,
    SimulationConfig,
};
use portfolio_risk_analyzer::simulation::run_simulation;

fn main() {
    let portfolio = Portfolio {
        assets: vec![
            Asset {
                name: "Dionice".to_string(),
                expected_return: 0.08,
                volatility: 0.18,
                weight: 0.35,
            },
            Asset {
                name: "Obveznice".to_string(),
                expected_return: 0.04,
                volatility: 0.07,
                weight: 0.25,
            },
            Asset {
                name: "Nekretnine".to_string(),
                expected_return: 0.06,
                volatility: 0.14,
                weight: 0.15,
            },
            Asset {
                name: "Roba".to_string(),
                expected_return: 0.05,
                volatility: 0.20,
                weight: 0.10,
            },
            Asset {
                name: "Gotovina".to_string(),
                expected_return: 0.02,
                volatility: 0.01,
                weight: 0.15,
            },
        ],
        correlations: vec![
            vec![1.00, 0.30, 0.50, 0.20, 0.00],
            vec![0.30, 1.00, 0.20, 0.10, 0.00],
            vec![0.50, 0.20, 1.00, 0.30, 0.00],
            vec![0.20, 0.10, 0.30, 1.00, 0.00],
            vec![0.00, 0.00, 0.00, 0.00, 1.00],
        ],
    };

    let config = SimulationConfig {
        initial_investment: 10_000.0,
        years: 30,
        simulations: 10,
        seed: 987654321,
    };

    let results = run_simulation(&portfolio, &config)
        .expect("Simulation failed");

    for (i, result) in results.iter().enumerate() {
        println!("Simulation {}:", i);
        println!("  final_value = {:.17}", result.final_value);

        for (year, value) in result.yearly_values.iter().enumerate() {
            println!("  year {} = {:.17}", year, value);
        }
    }
}