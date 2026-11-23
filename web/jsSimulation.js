import { ChaCha8Rng } from "./jsRng.js";
import { standardNormal } from "./jsNormal.js";

function validateCorrelationMatrix(matrix, assetCount) {
    if (matrix.length !== assetCount) {
        throw new Error(`Broj redaka korelacijske matrice (${matrix.length}) ` + `mora odgovarati broju imovina (${assetCount}).`);
    }

    for (const row of matrix) {
        if (row.length !== assetCount) {
            throw new Error("Korelacijska matrica mora biti kvadratna.");
        }
    }

    for (let i = 0; i < assetCount; i++) {
        for (let j = 0; j < assetCount; j++) {
            const value = matrix[i][j];

            if (!Number.isFinite(value)) {
                throw new Error("Korelacijska matrica sadrži neispravnu vrijednost.");
            }

            if (value < -1.0 || value > 1.0) {
                throw new Error(`Korelacija na poziciji (${i}, ${j}) ` + "mora biti između -1 i 1.");
            }

            if ( i === j && Math.abs(value - 1.0) > 1e-10 ) {
                throw new Error(`Dijagonalni elementi korelacijske matrice ` + `moraju biti 1.0. Element (${i}, ${i}) je ${value}.`);
            }

            if ( Math.abs(matrix[i][j] - matrix[j][i]) > 1e-10 ) {
                throw new Error(`Korelacijska matrica mora biti simetrična. ` + `Elementi (${i}, ${j}) i (${j}, ${i}) nisu jednaki.`);
            }
        }
    }
}

function choleskyDecomposition(matrix) {
    const n = matrix.length;

    if (n === 0) {
        throw new Error("Korelacijska matrica je prazna.");
    }

    for (const row of matrix) {
        if (row.length !== n) {
            throw new Error("Korelacijska matrica mora biti kvadratna.");
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
                sum -= lower[i][k] * lower[j][k];
            }

            if (i === j) {
                if (sum <= 0.0) {
                    throw new Error("Korelacijska matrica nije pozitivno definitna.");
                }
                lower[i][j] = Math.sqrt(sum);
            } else {
                if (
                    Math.abs(lower[j][j]) < 1e-12
                ) {
                    throw new Error("Korelacijska matrica nije pogodna " + "za Cholesky dekompoziciju.");
                }
                lower[i][j] = sum / lower[j][j];
            }
        }
    }

    return lower;
}

function generateCorrelatedShocks(lower, rng) {
    const n = lower.length;
    const independent = new Array(n);

    for (let i = 0; i < n; i++) {
        independent[i] = standardNormal(rng);
    }

    const correlated = new Array(n).fill(0.0);

    for (let i = 0; i < n; i++) {
        for (let j = 0; j <= i; j++) {
            correlated[i] += lower[i][j] * independent[j];
        }
    }

    return correlated;
}

export function runSimulation(portfolio, config) {

    if (!portfolio.assets || portfolio.assets.length === 0) {
        throw new Error("Portfolio mora sadržavati barem jednu imovinu.");
    }

    const assetCount = portfolio.assets.length;
    validateCorrelationMatrix(portfolio.correlations,assetCount);

    const rng = new ChaCha8Rng(config.seed);
    const lower = choleskyDecomposition(portfolio.correlations);
    const results = new Array(config.simulations);
    const dt = 1.0;

    for (let simulation = 0; simulation < config.simulations; simulation++) {
        let portfolioValue = config.initial_investment;
        let currentPortfolioValue = portfolioValue;
        const yearlyValues = [currentPortfolioValue];

        for (let year = 0; year < config.years; year++) {
            const shocks = generateCorrelatedShocks(lower, rng);
            let yearlyReturn = 0.0;
            let totalYearlyReturn = 0.0;

            for (let assetIndex = 0; assetIndex < assetCount; assetIndex++) {
                const asset = portfolio.assets[assetIndex];
                const z = shocks[assetIndex];
                const gbmReturn = (asset.expected_return - 0.5 * asset.volatility * asset.volatility) * dt
                                    + asset.volatility * Math.sqrt(dt) * z;

                const assetGrowth = Math.exp(gbmReturn) - 1.0;
                totalYearlyReturn += asset.weight * assetGrowth;
            }

            currentPortfolioValue *= 1.0 + totalYearlyReturn;
            yearlyValues.push(currentPortfolioValue);
        }

        results[simulation] = {
            final_value: currentPortfolioValue,
            yearly_values: yearlyValues
        };
    }

    return results;
}