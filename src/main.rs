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
                weight: 0.50,
                expected_return: 0.08,
                volatility: 0.15,
            },

            Asset {
                name: "Obveznice".to_string(),
                weight: 0.20,
                expected_return: 0.03,
                volatility: 0.05,
            },

            Asset {
                name: "Zlato".to_string(),
                weight: 0.20,
                expected_return: 0.05,
                volatility: 0.12,
            },

            Asset {
                name: "Kripto".to_string(),
                weight: 0.10,
                expected_return: 0.15,
                volatility: 0.50,
            },
        ],
    };

    let config = SimulationConfig {
        initial_investment: 10_000.0,
        years: 20,
        simulations: 10_000,
        seed: 42,
    };

    let results = run_simulation(
        &portfolio,
        &config,
    );

    println!("Broj simulacija: {}", results.len());

    let first = &results[0];
    println!(
        "Prvi rezultat: {:.2} €",
        first.final_value
    );

}