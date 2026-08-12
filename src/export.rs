use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub fn greet() -> String {
    "Portfolio Risk Analyzer WASM radi!".to_string()
}

#[wasm_bindgen]
pub fn double(value: f64) -> f64 {
    value * 2.0
}

#[wasm_bindgen]
pub fn test_config(initial_investment: f64, years: u32, simulations: usize) -> f64 {
    initial_investment * (years as f64) + simulations as f64
}