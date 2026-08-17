import init, { run_monte_carlo } from "./pkg/portfolio_risk_analyzer.js";
import { drawDistribution, drawSimulationPaths, clearCharts } from "./charts.js";

// Formatiranje prikaza iznosa u x.xxx.xxx,xx €
const formatEuro = value => new Intl.NumberFormat("hr-HR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value) + " €";

// Korelacijska matrica portfelja
const correlations = [
    [1.00, -0.20, 0.10, 0.50],
    [-0.20, 1.00, 0.20, 0.25],
    [0.10, 0.20, 1.00, 0.05],
    [0.50, 0.25, 0.05, 1.00]
];

// Čitanje vrijednosti iz HTML inputa
function getInputValues() {
    return {
        investment: Number(document.getElementById("investment").value),
        years: Number(document.getElementById("years").value),
        simulations: Number(document.getElementById("simulations").value),

        weights: [
            Number(document.getElementById("weight-stocks").value),
            Number(document.getElementById("weight-bonds").value),
            Number(document.getElementById("weight-gold").value),
            Number(document.getElementById("weight-crypto").value)
        ],

        returns: [
            Number(document.getElementById("return-stocks").value),
            Number(document.getElementById("return-bonds").value),
            Number(document.getElementById("return-gold").value),
            Number(document.getElementById("return-crypto").value)
        ],

        volatilities: [
            Number(document.getElementById("volatility-stocks").value),
            Number(document.getElementById("volatility-bonds").value),
            Number(document.getElementById("volatility-gold").value),
            Number(document.getElementById("volatility-crypto").value)
        ]
    };
}

// Izrada portfolija iz vrijednosti inputa
function createPortfolio(values) {
    return {
        assets: [
            {
                name: "Dionice",
                weight: values.weights[0] / 100,
                expected_return: values.returns[0] / 100,
                volatility: values.volatilities[0] / 100
            },
            {
                name: "Obveznice",
                weight: values.weights[1] / 100,
                expected_return: values.returns[1] / 100,
                volatility: values.volatilities[1] / 100
            },
            {
                name: "Zlato",
                weight: values.weights[2] / 100,
                expected_return: values.returns[2] / 100,
                volatility: values.volatilities[2] / 100
            },
            {
                name: "Kripto",
                weight: values.weights[3] / 100,
                expected_return: values.returns[3] / 100,
                volatility: values.volatilities[3] / 100
            }
        ],

        correlations
    };
}

// Izrada konfiguracije simulacije
function createSimulationConfig(values, simulations = values.simulations) {
    return {
        initial_investment: values.investment,
        years: values.years,
        simulations,
        seed: 42
    };
}

// Validacija ulaznih podataka
function validateInputs(values) {
    const simulationError = document.getElementById("simulationError");
    const portfolioError = document.getElementById("portfolioError");
    
    simulationError.textContent = "";
    portfolioError.textContent = "";

    if (values.investment <= 0) {
        simulationError.textContent = "Početna investicija mora biti veća od 0.";
        return false;
    }

    if (values.years <= 0) {
        simulationError.textContent = "Broj godina mora biti veći od 0.";
        return false;
    }

    if (values.simulations <= 0) {
        simulationError.textContent = "Broj simulacija mora biti veći od 0.";
        return false;
    }

    if (values.weights.some(weight => weight < 0)) {
        portfolioError.textContent = "Udio imovine ne može biti negativan.";
        return false;
    }
    
    const weightSum = values.weights.reduce((sum, weight) => sum + weight, 0);

    if (Math.abs(weightSum - 100) > 0.001) {
        portfolioError.textContent = `Zbroj udjela mora biti 100%. Trenutno je ${weightSum}%.`;
        return false;
    }

    if (values.volatilities.some(value => value < 0)) {
        portfolioError.textContent = "Volatilnost ne može biti negativna.";
        return false;
    }

    return true;
}

// Ažuriranje napretka kod testiranja
function updateProgress(completedSteps, totalSteps, text) {
    completedSteps++;

    const percent = Math.round((completedSteps / totalSteps) * 100);

    document.getElementById("benchmarkProgressFill").style.width = `${percent}%`;
    document.getElementById("benchmarkProgressPercent").textContent = `${percent}%`;
    document.getElementById("benchmarkProgressText").textContent = text;

    return completedSteps;
}

// Testiranje performansi WebAssemblyja
async function benchmarkWasm(portfolio, config) {
    const simulationCounts = [1000, 10000, 50000, 100000];
    const warmupRuns = 3;
    const benchmarkRuns = 10;

    const totalSteps = simulationCounts.length * (warmupRuns + benchmarkRuns);
    let completedSteps = 0;

    const benchmarkResults = [];

    // Daj browseru priliku da osvježi UI
    async function yieldToBrowser() {
        await new Promise(resolve => setTimeout(resolve, 0));
    }

    for (const simulationCount of simulationCounts) {

        const benchmarkConfig = { ...config, simulations: simulationCount};

        // Warm-up: ne mjerimo ova pokretanja
        for (let i = 0; i < warmupRuns; i++) {
            run_monte_carlo(portfolio, benchmarkConfig);
            
            completedSteps = updateProgress(completedSteps,totalSteps,
                `Priprema: ${simulationCount.toLocaleString("hr-HR")} simulacija...`
            );
            await yieldToBrowser();
        }

        const times = [];

        // Stvarna mjerenja
        for (let i = 0; i < benchmarkRuns; i++) {
            const start = performance.now();
            run_monte_carlo(portfolio, benchmarkConfig);
            const end = performance.now();
            times.push(end - start);

            completedSteps = updateProgress(completedSteps,totalSteps,
                `Mjerenje: ${simulationCount.toLocaleString("hr-HR")} simulacija — ${i + 1}/${benchmarkRuns}`
            );
            await yieldToBrowser();
        }

        const sortedTimes = [...times].sort((a, b) => a - b);

        const average = times.reduce((sum, time) => sum + time, 0) / times.length;

        const median =
            sortedTimes.length % 2 === 0
                ? (sortedTimes[sortedTimes.length / 2 - 1] + sortedTimes[sortedTimes.length / 2]) / 2
                : sortedTimes[Math.floor(sortedTimes.length / 2)];

        const min = sortedTimes[0];
        const max = sortedTimes[sortedTimes.length - 1];
        const result = { simulations: simulationCount, average, median, min, max };

        benchmarkResults.push(result);

        console.log(
            `WASM | ${simulationCount.toLocaleString("hr-HR")} simulacija | ` +
            `prosjek: ${average.toFixed(2)} ms | ` +
            `medijan: ${median.toFixed(2)} ms | ` +
            `min: ${min.toFixed(2)} ms | ` +
            `max: ${max.toFixed(2)} ms`
        );
    }

    console.log("WASM benchmark rezultati:", benchmarkResults);
    updateProgress(totalSteps - 1, totalSteps, "Benchmark završen.");
    return benchmarkResults;
}

function getRiskClass(value) {
    if (value > 0) return "risk-positive";
    if (value < 0) return "risk-negative";
    return "";
}

async function main() {
    await init();
    
    const simulationResults = document.getElementById("simulationResults");
    const simulationParameters = document.getElementById("simulationParameters");
    const benchmarkResultsElement = document.getElementById("benchmarkResults");
    const runButton = document.getElementById("runButton");
    const benchmarkButton = document.getElementById("benchmarkButton");
    const benchmarkProgress = document.getElementById("benchmarkProgress");
    
    // ==========================================
    // POKRENI SIMULACIJU
    // ==========================================
    document.getElementById("runButton").addEventListener("click", async () => {
        simulationResults.innerHTML = "";
        simulationParameters.hidden = true;
        benchmarkResultsElement.innerHTML = "";
        benchmarkProgress.hidden = true;
        clearCharts();

        const values = getInputValues();
        if (!validateInputs(values)) { return; }
        const portfolio = createPortfolio(values);
        const config = createSimulationConfig(values);

        document.getElementById("resultInvestment").textContent = formatEuro(values.investment);
        document.getElementById("resultYears").textContent = values.years;
        document.getElementById("resultSimulations").textContent = values.simulations.toLocaleString("hr-HR");
        document.getElementById("resultSeed").textContent = config.seed;
        document.getElementById("assetParameters").innerHTML =
            portfolio.assets.map(asset => `
                <tr>
                    <td>${asset.name}</td>
                    <td>${(asset.weight * 100).toFixed(2)}%</td>
                    <td>${(asset.expected_return * 100).toFixed(2)}%</td>
                    <td>${(asset.volatility * 100).toFixed(2)}%</td>
                </tr>
            `).join("");
        document.getElementById("correlationParameters").innerHTML =
            portfolio.correlations.map((row, i) => `
                <tr>
                    <th>${portfolio.assets[i].name}</th>
                    ${row.map(value => `<td>${value.toFixed(2)}</td>`).join("")}
                </tr>
            `).join("");

        runButton.disabled = true;
        const simulationLoading = document.getElementById("simulationLoading");
        simulationLoading.hidden = false;

        await new Promise(resolve => setTimeout(resolve, 0));

        const wasmStart = performance.now();
        
        let output;
        try {
            output = run_monte_carlo(portfolio, config);
        } catch (error) {
            const message = typeof error === "string" ? error : error?.message || String(error);
            document.getElementById("portfolioError").textContent = message;
            runButton.disabled = false;
            simulationLoading.hidden = true;
            return;
        }

        const wasmEnd = performance.now();
        const wasmTime = wasmEnd - wasmStart;
        console.log(`WASM vrijeme izračuna: ${wasmTime.toFixed(2)} ms`);

        const results = output.get("results");
        const statistics = output.get("statistics");

        simulationResults.innerHTML = `
            <h2>Monte Carlo rezultati</h2>
            <div class="statistics-grid">
                <div><span class="statistic-label">
                    Aritmetička sredina: 
                    <span class="tooltip">Prosječna završna vrijednost portfelja kroz sve provedene simulacije.</span></span>
                    <strong>${formatEuro(statistics.get("mean"))}</strong></div>
                <div><span class="statistic-label">
                    Medijan: 
                    <span class="tooltip">Srednja vrijednost svih simuliranih završnih vrijednosti. Polovica rezultata je ispod, a polovica iznad ove vrijednosti.</span></span>
                    <strong>${formatEuro(statistics.get("median"))}</strong></div>
                <div><span class="statistic-label">
                    Standardna devijacija: 
                    <span class="tooltip">Mjera raspršenosti završnih vrijednosti oko njihove srednje vrijednosti. Veća vrijednost označava veću varijabilnost rezultata.</span></span>
                    <strong>${formatEuro(statistics.get("std_dev"))}</strong></div>
                <div><span class="statistic-label">
                    5. percentil: 
                    <span class="tooltip">Vrijednost ispod koje se nalazi približno 5% simuliranih završnih vrijednosti.</span></span>
                    <strong>${formatEuro(statistics.get("percentile_5"))}</strong></div>
                <div><span class="statistic-label">
                    95. percentil: 
                    <span class="tooltip">Vrijednost ispod koje se nalazi približno 95% simuliranih završnih vrijednosti.</span></span>
                    <strong>${formatEuro(statistics.get("percentile_95"))}</strong></div>
                <div><span class="statistic-label">
                    VaR 95: 
                    <span class="tooltip">
                        Maksimalni očekivani gubitak portfelja pri razini pouzdanosti od 95%.
                        Pozitivna vrijednost znači da ni u najgorih 5% ishoda nije ostvaren gubitak.
                        Negativna vrijednost znači da u približno 5% simulacija gubitak može biti veći od ove vrijednosti.
                    </span></span>
                    <strong class="${getRiskClass(statistics.get("var_95"))}">${formatEuro(statistics.get("var_95"))}</strong></div>
                <div><span class="statistic-label">
                    VaR 99: 
                    <span class="tooltip">
                        Maksimalni očekivani gubitak portfelja pri razini pouzdanosti od 99%.
                        Pozitivna vrijednost znači da ni u najgorih 1% ishoda nije ostvaren gubitak.
                        Negativna vrijednost znači da u približno 1% simulacija gubitak može biti veći od ove vrijednosti.
                    </span></span>
                    <strong class="${getRiskClass(statistics.get("var_99"))}">${formatEuro(statistics.get("var_99"))}</strong></div>
                <div><span class="statistic-label">
                    CVaR 95: 
                    <span class="tooltip">
                        Prosječna promjena vrijednosti portfelja u najgorih 5% simulacija.
                        Pozitivna vrijednost znači da ni u tom najgorem dijelu distribucije u prosjeku nije ostvaren gubitak.
                        Negativna vrijednost predstavlja prosječni potencijalni gubitak u najgorih 5% ishoda.
                    </span></span>
                    <strong class="${getRiskClass(statistics.get("cvar_95"))}">${formatEuro(statistics.get("cvar_95"))}</strong></div>
            </div>
        `;

        simulationParameters.hidden = false;
        drawDistribution(results);
        drawSimulationPaths(results);

        runButton.disabled = false;
        simulationLoading.hidden = true;        
    });

    // ==========================================
    // POKRENI WASM TEST
    // ==========================================
    document.getElementById("benchmarkButton").addEventListener("click", async () => {
        simulationResults.innerHTML = "";
        simulationParameters.hidden = true;
        benchmarkResultsElement.innerHTML = "";
        clearCharts();

        const values = getInputValues();
        if (!validateInputs(values)) { return; }
        const portfolio = createPortfolio(values);
        const config = createSimulationConfig(values, 10000);    

        benchmarkButton.disabled = true;
        benchmarkProgress.hidden = false;
        document.getElementById("benchmarkProgressFill").style.width = "0%";
        document.getElementById("benchmarkProgressPercent").textContent = "0%";
        document.getElementById("benchmarkProgressText").textContent = "Pokretanje WASM benchmarka...";

        const benchmarkResults = await benchmarkWasm(portfolio, config);
        benchmarkResultsElement.innerHTML = `
            <h2>WASM benchmark</h2>
            <table>
                <thead>
                    <tr>
                        <th>Broj simulacija</th>
                        <th>Prosjek (ms)</th>
                        <th>Medijan (ms)</th>
                        <th>Min (ms)</th>
                        <th>Max (ms)</th>
                    </tr>
                </thead>
    
                <tbody>
                    ${benchmarkResults.map(result => `
                        <tr>
                            <td>${result.simulations.toLocaleString("hr-HR")}</td>
                            <td>${result.average.toFixed(2)}</td>
                            <td>${result.median.toFixed(2)}</td>
                            <td>${result.min.toFixed(2)}</td>
                            <td>${result.max.toFixed(2)}</td>
                        </tr>
                    `).join("")}
                </tbody>
            </table>
        `;
        benchmarkButton.disabled = false;
        benchmarkProgress.hidden = true;
    });
}

main();