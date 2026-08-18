import init, { run_monte_carlo } from "./pkg/portfolio_risk_analyzer.js";
import { runSimulation } from "./jsSimulation.js";

/* ============================================================
KONFIGURACIJA TESTIRANJA
============================================================ */

const portfolio = {
    assets: [
        {
            name: "Dionice",
            expected_return: 0.08,
            volatility: 0.18,
            weight: 0.35
        },
        {
            name: "Obveznice",
            expected_return: 0.04,
            volatility: 0.07,
            weight: 0.25
        },
        {
            name: "Nekretnine",
            expected_return: 0.06,
            volatility: 0.14,
            weight: 0.15
        },
        {
            name: "Roba",
            expected_return: 0.05,
            volatility: 0.20,
            weight: 0.10
        },
        {
            name: "Gotovina",
            expected_return: 0.02,
            volatility: 0.01,
            weight: 0.15
        }
    ],

    correlations: [
        [1.00, 0.30, 0.50, 0.20, 0.00],
        [0.30, 1.00, 0.20, 0.10, 0.00],
        [0.50, 0.20, 1.00, 0.30, 0.00],
        [0.20, 0.10, 0.30, 1.00, 0.00],
        [0.00, 0.00, 0.00, 0.00, 1.00]
    ]
};

const workloads = [
    100,
    1000,
    10000,
    50000,
    100000
];

const years = 30;
const initialInvestment = 10000;

const simulationSeed = 987654321;
const benchmarkSeed = 123456789;

const warmupRuns = 3;
const benchmarkRuns = 30;

/* ============================================================
UI INICIJALIZACIJA
============================================================ */

document.getElementById("initialInvestment").textContent = initialInvestment.toLocaleString();
document.getElementById("years").textContent = years;
//document.getElementById("simulationSeed").textContent = simulationSeed;
//document.getElementById("benchmarkSeed").textContent = benchmarkSeed;
document.getElementById("warmupRuns").textContent = warmupRuns;
document.getElementById("benchmarkRuns").textContent = benchmarkRuns;

/* Tablica portfelja */
const portfolioBody = document.getElementById("portfolioBody");
portfolio.assets.forEach(asset => {
    const row = document.createElement("tr");
    row.innerHTML = `
        <td>${asset.name}</td>
        <td>${(asset.weight * 100).toFixed(1)}%</td>
        <td>${(asset.expected_return * 100).toFixed(1)}%</td>
        <td>${(asset.volatility * 100).toFixed(1)}%</td>
    `;
    portfolioBody.appendChild(row);
});

/* Korelacijska matrica */
const correlationMatrix = document.getElementById("correlationMatrix");
let matrixHTML = "<thead><tr><th></th>";
for (const asset of portfolio.assets) {
    matrixHTML += `<th>${asset.name}</th>`;
}
matrixHTML += "</tr></thead><tbody>";

for (let i = 0; i < portfolio.correlations.length; i++) {
    matrixHTML += `<tr><th>${portfolio.assets[i].name}</th>`;
    for (let j = 0; j < portfolio.correlations[i].length; j++) {
        matrixHTML += `
            <td>${portfolio.correlations[i][j].toFixed(2)}</td>
        `;
    }
    matrixHTML += "</tr>";
}

matrixHTML += "</tbody>";
correlationMatrix.innerHTML = matrixHTML;

/* ============================================================
POMOCNE FUNKCIJE
============================================================ */

function createConfig(simulations) {
    return {
        initial_investment: initialInvestment,
        years,
        simulations,
        seed: simulationSeed
    };
}

function getMean(values) {
    return values.reduce(
        (sum, value) => sum + value,
        0
    ) / values.length;
}

function getMedian(values) {
    const sorted = [...values].sort((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);

    if (sorted.length % 2 === 0) {
        return (sorted[middle - 1] + sorted[middle]) / 2;
    }

    return sorted[middle];
}

function getStandardDeviation(values) {
    const mean = getMean(values);

    const variance = values.reduce(
        (sum, value) =>
            sum + Math.pow(value - mean, 2),
        0
    ) / values.length;

    return Math.sqrt(variance);
}

/* ============================================================
DETERMINISTICKI GENERATOR SLUCAJNIH BROJEVA
============================================================ */

class BenchmarkRng {
    constructor(seed) {this.state = seed >>> 0;}

    nextUint32() {
        let x = this.state;

        x ^= x << 13;
        x ^= x >>> 17;
        x ^= x << 5;

        this.state = x >>> 0;

        return this.state;
    }

    nextBoolean() {
        return (this.nextUint32() & 1) === 0;
    }
}

/* ============================================================
FUNKCIJE SIMULACIJE
============================================================ */

function runJS(config) {
    runSimulation(portfolio, config);
}

function runWASM(config) {
    run_monte_carlo(portfolio, config);
}

function measure(functionToMeasure) {
    const start = performance.now();
    functionToMeasure();
    const end = performance.now();
    return end - start;
}

/* ============================================================
VALIDACIJA REZULTATA
============================================================ */

function verifyResults(config) {
    const jsResults = runSimulation(portfolio, config);
    const wasmOutput = run_monte_carlo(portfolio, config);
    const wasmResults = wasmOutput.get("results");
    const tolerance = 1e-10;

    if (jsResults.length !== wasmResults.length) {
        return false;
    }

    for (let i = 0; i < jsResults.length; i++) {
        const jsResult = jsResults[i];
        const wasmResult = wasmResults[i];

        const jsFinal = jsResult.final_value;
        const wasmFinal = wasmResult.get("final_value");
        if (Math.abs(jsFinal - wasmFinal) > tolerance) {
            return false;
        }

        const jsYearly = jsResult.yearly_values;
        const wasmYearly = wasmResult.get("yearly_values");
        if (jsYearly.length !== wasmYearly.length) {
            return false;
        }
        for (let year = 0;year < jsYearly.length;year++) {
            if (Math.abs(jsYearly[year] - wasmYearly[year]) > tolerance) {
                return false;
            }
        }
    }

    return true;
}

/* ============================================================
UI FUNKCIJE ZA AZURIRANJE
============================================================ */

function updateProgress(completed, total, status) {
    const percentage = (completed / total) * 100;
    document.getElementById("progressBar").style.width = `${percentage}%`;
    document.getElementById("progressText").textContent =`${percentage.toFixed(1)}%`;
    document.getElementById("statusText").textContent = status;
}

function addResultRow(result) {
    const resultsBody = document.getElementById("resultsBody");
    const row = document.createElement("tr");
    row.innerHTML = `
        <td>${result.simulations.toLocaleString()}</td>
        <td>${result.jsMean.toFixed(3)} ms</td>
        <td>${result.wasmMean.toFixed(3)} ms</td>
        <td>${result.jsMedian.toFixed(3)} ms</td>
        <td>${result.wasmMedian.toFixed(3)} ms</td>
        <td>${result.jsStdDev.toFixed(3)} ms</td>
        <td>${result.wasmStdDev.toFixed(3)} ms</td>
        <td class="speedup">${result.speedup.toFixed(2)}×</td>
    `;
    resultsBody.appendChild(row);
}

/*
* Omogućuje pregledniku da prikaže promjene korisničkog sučelja 
* prije nastavka sljedeće operacije mjerenja performansi.
*/
function waitForRender() {
    return new Promise(resolve => {
        setTimeout(resolve, 0);
    });
}

/* ============================================================
BENCHMARK
============================================================ */

async function runBenchmark() {

    const startTime = performance.now();

    const startButton = document.getElementById("startButton");
    startButton.disabled = true;
    startButton.textContent = "Testiranje pokrenuto...";

    document.getElementById("resultsBody").innerHTML = "";
    document.getElementById("completionCard").style.display = "none";

    const totalSteps = workloads.length * benchmarkRuns;
    let completedSteps = 0;
    updateProgress(0, totalSteps, "Inicijalizacija testiranja...");
    await waitForRender();

    const benchmarkResults = [];
    for (const simulations of workloads) {
        const config = createConfig(simulations);
        updateProgress(completedSteps, totalSteps, `Validacija ${simulations.toLocaleString()} simulacije...`);
        await waitForRender();

        if (!verifyResults(config)) {
            throw new Error(
                `JavaScript i WASM rezultati se razlikuju za ${simulations} simulaciju.`
            );
        }

        // Warm-up
        updateProgress(completedSteps, totalSteps, `Priprema ${simulations.toLocaleString()} simulacije...`);
        await waitForRender();

        for (let i = 0;i < warmupRuns;i++) {
            runJS(config);
            runWASM(config);
            await waitForRender();
        }

        const jsTimes = [];
        const wasmTimes = [];
        const orderRng = new BenchmarkRng(benchmarkSeed + simulations);

        // Stvarna mjerenja
        for (let i = 0;i < benchmarkRuns;i++) {
            const runNumber = i + 1;
            updateProgress(completedSteps,totalSteps,`Testiranje ${simulations.toLocaleString()} simulacije u tijeku ${runNumber}/${benchmarkRuns}`);
            await waitForRender();
            const jsFirst = orderRng.nextBoolean();
            if (jsFirst) {
                const jsTime = measure(() => runJS(config));
                const wasmTime = measure(() => runWASM(config));
                jsTimes.push(jsTime);
                wasmTimes.push(wasmTime);
            } else {
                const wasmTime = measure(() => runWASM(config));
                const jsTime = measure(() => runJS(config));
                wasmTimes.push(wasmTime);
                jsTimes.push(jsTime);
            }

            completedSteps++;
        }

        const jsMean = getMean(jsTimes);
        const wasmMean = getMean(wasmTimes);
        const jsMedian = getMedian(jsTimes);
        const wasmMedian = getMedian(wasmTimes);
        const jsStdDev = getStandardDeviation(jsTimes);
        const wasmStdDev = getStandardDeviation(wasmTimes);
        const speedup = jsMean / wasmMean;
        const result = {simulations,years,jsMean,wasmMean,jsMedian,wasmMedian,jsStdDev,wasmStdDev,speedup};
        benchmarkResults.push(result);

        // Prikazi gotovu simulaciju
        addResultRow(result);
        updateProgress(completedSteps,totalSteps,`Završena ${simulations.toLocaleString()} simulacija.`);
        await waitForRender();
    }

    const endTime = performance.now();
    const totalTime = (endTime - startTime) / 1000;

    updateProgress(totalSteps,totalSteps,"Testiranje je uspješno završeno.");
    document.getElementById("completionCard").style.display = "block";
    document.getElementById("totalTime").textContent = `${totalTime.toFixed(2)} seconds`;
    startButton.disabled = false;
    startButton.textContent = "Pokreni ponovno";

    console.log("Final benchmark results:",benchmarkResults);
}

/* ============================================================
INICIJALIZACIJA WASM-a i GUMBA
============================================================ */

await init();
document.getElementById("startButton").addEventListener("click",runBenchmark);
