use wasm_bindgen::prelude::*;
use serde_wasm_bindgen::{from_value, to_value};
use crate::models::{Portfolio, SimulationConfig};
use crate::simulation::run_simulation;

#[wasm_bindgen]
pub fn greet() -> String {
    "Portfolio Risk Analyzer WASM radi!".to_string()
}

#[wasm_bindgen]
pub fn run_monte_carlo(portfolio: JsValue, config: JsValue) -> Result<JsValue, JsValue> {
    let portfolio: Portfolio = from_value(portfolio)
        .map_err(|e| JsValue::from_str(&e.to_string()))?;
    let config: SimulationConfig = from_value(config)
        .map_err(|e| JsValue::from_str(&e.to_string()))?;
    let results = run_simulation(&portfolio, &config);
    to_value(&results).map_err(|e| JsValue::from_str(&e.to_string()))
}