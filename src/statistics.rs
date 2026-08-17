use crate::models::SimulationResult;
use serde::Serialize;

/// Statistički pokazatelji Monte Carlo simulacije.
#[derive(Debug, Serialize)]
pub struct Statistics {
    pub mean: f64,
    pub median: f64,
    pub std_dev: f64,
    pub percentile_5: f64,
    pub percentile_95: f64,
    pub var_95: f64,
    pub var_99: f64,
    pub cvar_95: f64,
}

/// Aritmetička sredina
fn mean(results: &[SimulationResult]) -> f64 {
    let sum: f64 = results.iter().map(|r| r.final_value).sum();
    sum / results.len() as f64
}

/// Medijan
fn median(results: &[SimulationResult]) -> f64 {
    let mut values: Vec<f64> = results.iter().map(|r| r.final_value).collect();

    values.sort_by(|a, b| a.total_cmp(b)); // ova fja sigurno usporedjuje f64
    // brojevi s pomicnim zarezom f64 mogu sadrzavati NaN i Rust zato ne dopusta obicno sortiranje

    let n = values.len();

    if n % 2 == 0 {
        (values[n / 2 - 1] + values[n / 2]) / 2.0   // ako imas paran broj elemenata, uzmi sredinu od 2 broja u sredini
    } else {
        values[n / 2]   // ako je neparan broj elemenata, n/2-ti element je medijan
    }
}

// Percentil parametrizirani
fn percentile(values: &[f64], p: f64) -> f64 {
    let mut values = values.to_vec();

    values.sort_by(|a, b| a.total_cmp(b));

    let index = ((values.len() - 1) as f64 * p).round() as usize;

    values[index]
}

fn std_dev(results: &[SimulationResult]) -> f64 {
    let mean = mean(results);

    let variance: f64 = results
        .iter()
        .map(|r| (r.final_value - mean).powi(2))
        .sum::<f64>()
        / results.len() as f64;

    variance.sqrt()
}

fn cvar(pnl: &[f64], perc: f64) -> f64 {
    let threshold = percentile(pnl, perc);

    let tail: Vec<f64> = pnl
        .iter()
        .copied()
        .filter(|v| *v <= threshold)
        .collect();

    tail.iter().sum::<f64>() / tail.len() as f64
}

pub fn calculate_statistics(results: &[SimulationResult], initial_investment: f64) -> Statistics {
    let final_values: Vec<f64> = results.iter().map(|r| r.final_value).collect();
    let pnl: Vec<f64> = results.iter().map(|r| r.final_value - initial_investment).collect();

    Statistics {
        mean: mean(results),
        median: median(results),
        std_dev: std_dev(results),
        percentile_5: percentile(&final_values, 0.05),
        percentile_95: percentile(&final_values, 0.95),
        var_95: percentile(&pnl, 0.05),
        var_99: percentile(&pnl, 0.01),
        cvar_95: cvar(&pnl, 0.05),
    }
}