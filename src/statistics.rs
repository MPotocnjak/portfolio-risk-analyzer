use crate::models::SimulationResult;

/// Statistički pokazatelji Monte Carlo simulacije.
#[derive(Debug)]
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
fn percentile(results: &[SimulationResult], p: f64) -> f64 {
    let mut values: Vec<f64> = results.iter().map(|r| r.final_value).collect();

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

fn cvar(results: &[SimulationResult], perc: f64) -> f64 {
    let threshold = percentile(results, perc);

    let tail: Vec<f64> = results
        .iter()
        .map(|r| r.final_value)
        .filter(|v| *v <= threshold)
        .collect();

    tail.iter().sum::<f64>() / tail.len() as f64
}

pub fn calculate_statistics(results: &[SimulationResult]) -> Statistics {

    Statistics {
        mean: mean(results),
        median: median(results),
        std_dev: std_dev(results),
        percentile_5: percentile(results, 0.05),
        percentile_95: percentile(results, 0.95),
        var_95: percentile(results, 0.05),
        var_99: percentile(results, 0.01),
        cvar_95: cvar(results, 0.05),
    }
}