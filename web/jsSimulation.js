import { ChaCha8Rng } from "./jsRng.js";
import { standardNormal } from "./jsNormal.js";


/*
 * Validates the basic structure and values of the correlation matrix.
 *
 * This mirrors Rust's:
 *
 *     validate_correlation_matrix(...)
 */
function validateCorrelationMatrix(matrix, assetCount) {
    if (matrix.length !== assetCount) {
        throw new Error(
            `Broj redaka korelacijske matrice (${matrix.length}) ` +
            `mora odgovarati broju imovina (${assetCount}).`
        );
    }

    for (const row of matrix) {
        if (row.length !== assetCount) {
            throw new Error(
                "Korelacijska matrica mora biti kvadratna."
            );
        }
    }

    for (let i = 0; i < assetCount; i++) {
        for (let j = 0; j < assetCount; j++) {
            const value = matrix[i][j];

            if (!Number.isFinite(value)) {
                throw new Error(
                    "Korelacijska matrica sadrži neispravnu vrijednost."
                );
            }

            if (value < -1.0 || value > 1.0) {
                throw new Error(
                    `Korelacija na poziciji (${i}, ${j}) ` +
                    "mora biti između -1 i 1."
                );
            }

            if (
                i === j &&
                Math.abs(value - 1.0) > 1e-10
            ) {
                throw new Error(
                    `Dijagonalni elementi korelacijske matrice ` +
                    `moraju biti 1.0. Element (${i}, ${i}) je ${value}.`
                );
            }

            if (
                Math.abs(matrix[i][j] - matrix[j][i]) > 1e-10
            ) {
                throw new Error(
                    `Korelacijska matrica mora biti simetrična. ` +
                    `Elementi (${i}, ${j}) i (${j}, ${i}) nisu jednaki.`
                );
            }
        }
    }
}


/*
 * Cholesky decomposition of a positive-definite matrix.
 *
 * For correlation matrix C, finds lower-triangular matrix L
 * such that:
 *
 *     C = L * L^T
 *
 * This mirrors Rust's:
 *
 *     cholesky_decomposition(...)
 */
function choleskyDecomposition(matrix) {
    const n = matrix.length;

    if (n === 0) {
        throw new Error(
            "Korelacijska matrica je prazna."
        );
    }

    for (const row of matrix) {
        if (row.length !== n) {
            throw new Error(
                "Korelacijska matrica mora biti kvadratna."
            );
        }
    }

    const lower = Array.from(
        { length: n },
        () => Array(n).fill(0.0)
    );

    for (let i = 0; i < n; i++) {
        for (let j = 0; j <= i; j++) {

            let sum = matrix[i][j];

            for (let k = 0; k < j; k++) {
                sum -=
                    lower[i][k] *
                    lower[j][k];
            }

            if (i === j) {
                if (sum <= 0.0) {
                    throw new Error(
                        "Korelacijska matrica nije pozitivno definitna."
                    );
                }

                lower[i][j] = Math.sqrt(sum);

            } else {
                if (
                    Math.abs(lower[j][j]) < 1e-12
                ) {
                    throw new Error(
                        "Korelacijska matrica nije pogodna " +
                        "za Cholesky dekompoziciju."
                    );
                }

                lower[i][j] =
                    sum / lower[j][j];
            }
        }
    }

    return lower;
}


/*
 * Generates correlated standard normal random variables.
 *
 * Given:
 *
 *     Z ~ N(0, I)
 *
 * and:
 *
 *     C = L * L^T
 *
 * we calculate:
 *
 *     X = L * Z
 *
 * so that X has the desired correlation matrix C.
 *
 * This mirrors Rust's:
 *
 *     generate_correlated_shocks(...)
 */
function generateCorrelatedShocks(lower, rng) {
    const n = lower.length;

    /*
     * Generate independent standard normal variables.
     *
     * This is equivalent to:
     *
     *     let independent: Vec<f64> =
     *         (0..n)
     *             .map(|_| normal.sample(rng))
     *             .collect();
     */
    const independent = new Array(n);

    for (let i = 0; i < n; i++) {
        independent[i] = standardNormal(rng);
    }

    /*
     * Apply the lower-triangular Cholesky matrix.
     */
    const correlated = new Array(n).fill(0.0);

    for (let i = 0; i < n; i++) {
        for (let j = 0; j <= i; j++) {
            correlated[i] +=
                lower[i][j] *
                independent[j];
        }
    }

    return correlated;
}


/*
 * Runs the Monte Carlo portfolio simulation.
 *
 * This is a JavaScript implementation of Rust's:
 *
 *     run_simulation(...)
 *
 * The goal is not simply to reproduce the mathematical model,
 * but to reproduce the same sequence of operations so that
 * the JavaScript and WebAssembly implementations can later
 * be benchmarked fairly.
 *
 * Expected portfolio structure:
 *
 * {
 *     assets: [
 *         {
 *             expected_return: Number,
 *             volatility: Number,
 *             weight: Number
 *         },
 *         ...
 *     ],
 *
 *     correlations: [
 *         [...],
 *         ...
 *     ]
 * }
 *
 * Expected config structure:
 *
 * {
 *     initial_investment: Number,
 *     years: Number,
 *     simulations: Number,
 *     seed: Number
 * }
 */
export function runSimulation(portfolio, config) {

    /*
     * Rust:
     *
     *     if portfolio.assets.is_empty() {
     *         return Err(...)
     *     }
     */
    if (!portfolio.assets || portfolio.assets.length === 0) {
        throw new Error(
            "Portfolio mora sadržavati barem jednu imovinu."
        );
    }

    const assetCount = portfolio.assets.length;

    /*
     * Validate the correlation matrix before starting
     * the actual simulation.
     */
    validateCorrelationMatrix(
        portfolio.correlations,
        assetCount
    );

    /*
     * Create the exact same RNG type and initialize it
     * with the simulation seed.
     *
     * Rust:
     *
     *     let mut rng =
     *         ChaCha8Rng::seed_from_u64(config.seed);
     */
    const rng = new ChaCha8Rng(config.seed);

    /*
     * Rust uses:
     *
     *     Normal::new(0.0, 1.0)
     *
     * We don't need to construct an object here because
     * standardNormal(rng) implements the same N(0, 1)
     * sampling algorithm.
     */
    
    /*
     * Calculate the Cholesky decomposition once.
     *
     * Rust does this before starting the simulations.
     */
    const lower = choleskyDecomposition(
        portfolio.correlations
    );

    /*
     * Rust:
     *
     *     let mut results =
     *         Vec::with_capacity(config.simulations);
     */
    const results = new Array(config.simulations);

    /*
     * Rust:
     *
     *     let dt = 1.0;
     *
     * Annual time step.
     */
    const dt = 1.0;

    /*
     * Run all Monte Carlo simulations.
     */
    for (
        let simulation = 0;
        simulation < config.simulations;
        simulation++
    ) {

        /*
         * Start each simulation with the initial investment.
         *
         * Rust:
         *
         *     let mut portfolio_value =
         *         config.initial_investment;
         */
        let portfolioValue =
            config.initial_investment;

        /*
         * JavaScript variables declared with `let` are mutable,
         * so we use a separate variable below for the evolving
         * portfolio value.
         */
        let currentPortfolioValue =
            portfolioValue;

        /*
         * Rust:
         *
         *     let mut yearly_values =
         *         Vec::with_capacity(config.years as usize + 1);
         *
         *     yearly_values.push(portfolio_value);
         */
        const yearlyValues = [
            currentPortfolioValue
        ];

        /*
         * Simulate every year.
         */
        for (
            let year = 0;
            year < config.years;
            year++
        ) {

            /*
             * Generate one set of correlated shocks for
             * all assets during this year.
             *
             * Important:
             *
             * We generate ALL asset shocks first and then
             * calculate the asset returns.
             *
             * This is exactly what the Rust implementation does.
             */
            const shocks =
                generateCorrelatedShocks(
                    lower,
                    rng
                );

            /*
             * Rust:
             *
             *     let mut yearly_return = 0.0;
             */
            let yearlyReturn = 0.0;

            let totalYearlyReturn = 0.0;

            /*
             * Calculate the contribution of each asset.
             */
            for (
                let assetIndex = 0;
                assetIndex < assetCount;
                assetIndex++
            ) {

                const asset =
                    portfolio.assets[assetIndex];

                const z =
                    shocks[assetIndex];

                /*
                 * Geometric Brownian Motion:
                 *
                 *     gbm_return =
                 *         (μ - 0.5σ²)dt
                 *         + σ√dt Z
                 *
                 * Rust:
                 *
                 *     let gbm_return =
                 *         (asset.expected_return
                 *         - 0.5 * asset.volatility.powi(2)) * dt
                 *         +
                 *         asset.volatility * dt.sqrt() * z;
                 */
                const gbmReturn =
                    (
                        asset.expected_return -
                        0.5 *
                        asset.volatility *
                        asset.volatility
                    ) *
                    dt
                    +
                    asset.volatility *
                    Math.sqrt(dt) *
                    z;

                /*
                 * Convert the continuously compounded
                 * GBM return into an asset growth rate.
                 *
                 * Rust:
                 *
                 *     let asset_growth =
                 *         gbm_return.exp() - 1.0;
                 */
                const assetGrowth =
                    Math.exp(gbmReturn) - 1.0;

                /*
                 * Add the weighted contribution of this asset
                 * to the portfolio's yearly return.
                 *
                 * Rust:
                 *
                 *     yearly_return +=
                 *         asset.weight * asset_growth;
                 */
                totalYearlyReturn +=
                    asset.weight *
                    assetGrowth;
            }

            /*
             * Update portfolio value.
             *
             * Rust:
             *
             *     portfolio_value *=
             *         1.0 + yearly_return;
             */
            currentPortfolioValue *=
                1.0 + totalYearlyReturn;

            /*
             * Store portfolio value at the end of this year.
             */
            yearlyValues.push(
                currentPortfolioValue
            );
        }

        /*
         * Store the same structure as Rust's
         * SimulationResult:
         *
         * {
         *     final_value,
         *     yearly_values
         * }
         */
        results[simulation] = {
            final_value:
                currentPortfolioValue,

            yearly_values:
                yearlyValues
        };
    }

    return results;
}