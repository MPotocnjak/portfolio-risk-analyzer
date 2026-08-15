use portfolio_risk_analyzer::statistics::calculate_statistics;
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

        correlations: vec![
            vec![1.00, -0.20, 0.10, 0.50],
            vec![-0.20, 1.00, 0.20, 0.25],
            vec![0.10, 0.20, 1.00, 0.05],
            vec![0.50, 0.25, 0.05, 1.00],
        ],
    };

    let config = SimulationConfig {
        initial_investment: 10_000.0,
        years: 20,
        simulations: 10_000,
        seed: 42,
    };

    let results = run_simulation(&portfolio, &config).expect("Simulacija nije uspjela.");

    let stats = calculate_statistics(&results);

    println!("\nMonte Carlo statistika");
    println!("----------------------");
    println!("Broj simulacija: {}", results.len());
    println!("Srednja vrijednost: {:.2} €", stats.mean);
    println!("Medijan: {:.2} €", stats.median);
    println!("Standardna devijacija: {:.2}", stats.std_dev);
    println!("5. percentil: {:.2} €", stats.percentile_5);
    println!("95. percentil: {:.2} €", stats.percentile_95);
    println!("VaR 95: {:.2} €", stats.var_95);
    println!("VaR 99: {:.2} €", stats.var_99);
    println!("CVaR 95: {:.2} €", stats.cvar_95);
    
    let first = &results[0];
    println!(
        "Prvi rezultat: {:.2} €",
        first.final_value
    );

}