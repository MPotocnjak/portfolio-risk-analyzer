use serde::{Deserialize, Serialize};

/// Predstavlja jednu klasu imovine u portfelju.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Asset {
    /// Naziv klase imovine (npr. Dionice, Obveznice...)
    pub name: String,

    /// Udio u portfelju (0.0 - 1.0)
    pub weight: f64,

    /// Očekivani godišnji prinos
    pub expected_return: f64,

    /// Godišnja volatilnost
    pub volatility: f64,
}

/// Investicijski portfelj.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Portfolio {
    pub assets: Vec<Asset>,

    /// Matrica korelacija između imovina.
    pub correlations: Vec<Vec<f64>>,
}

/// Parametri Monte Carlo simulacije.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SimulationConfig {
    /// Početna vrijednost portfelja
    pub initial_investment: f64,

    /// Broj godina simulacije
    pub years: u32,

    /// Broj Monte Carlo simulacija
    pub simulations: usize,

    /// Sjeme generatora slučajnih brojeva
    pub seed: u64,
}

/// Rezultat jedne Monte Carlo simulacije.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SimulationResult {
    /// Završna vrijednost portfelja
    pub final_value: f64,

    /// Vrijednost portfelja za svaku godinu
    pub yearly_values: Vec<f64>,
}