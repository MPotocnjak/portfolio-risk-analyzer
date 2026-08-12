import init, { run_monte_carlo } from "./pkg/portfolio_risk_analyzer.js";

// Formatiranje prikaza iznosa u x.xxx.xxx,xx €
const formatEuro = value => new Intl.NumberFormat("hr-HR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value) + " €";

async function main() {
    await init();
    
    document.getElementById("runButton").addEventListener("click", () => {
        const simulationError = document.getElementById("simulationError");
        const portfolioError = document.getElementById("portfolioError");
        const simulationResults = document.getElementById("simulationResults");

        simulationError.textContent = "";
        portfolioError.textContent = "";
        simulationResults.innerHTML = "";

        const investment = Number(document.getElementById("investment").value);
        const years = Number(document.getElementById("years").value);
        const simulations = Number(document.getElementById("simulations").value);

        if (investment <= 0) {
            simulationError.textContent = "Početna investicija mora biti veća od 0.";
            return;
        }

        if (years <= 0) {
            simulationError.textContent = "Broj godina mora biti veći od 0.";
            return;
        }

        if (simulations <= 0) {
            simulationError.textContent = "Broj simulacija mora biti veći od 0.";
            return;
        }

        const weights = [
            Number(document.getElementById("weight-stocks").value),
            Number(document.getElementById("weight-bonds").value),
            Number(document.getElementById("weight-gold").value),
            Number(document.getElementById("weight-crypto").value)
        ];
        
        if (weights.some(weight => weight < 0)) {
            portfolioError.textContent = "Udio imovine ne može biti negativan.";
            return;
        }
        
        const weightSum = weights.reduce((sum, weight) => sum + weight, 0);

        if (Math.abs(weightSum - 100) > 0.001) {
            portfolioError.textContent = `Zbroj udjela mora biti 100%. Trenutno je ${weightSum}%.`;
            return;
        }
        
        const returns = [
            Number(document.getElementById("return-stocks").value),
            Number(document.getElementById("return-bonds").value),
            Number(document.getElementById("return-gold").value),
            Number(document.getElementById("return-crypto").value)
        ];

        const volatilities = [
            Number(document.getElementById("volatility-stocks").value),
            Number(document.getElementById("volatility-bonds").value),
            Number(document.getElementById("volatility-gold").value),
            Number(document.getElementById("volatility-crypto").value)
        ];
        
        if (volatilities.some(value => value < 0)) {
            portfolioError.textContent = "Volatilnost ne može biti negativna.";
            return;
        }

        const portfolio = {
            assets: [
                { name: "Dionice", weight: weights[0] / 100, expected_return: returns[0] / 100, volatility: volatilities[0] / 100 },
                { name: "Obveznice", weight: weights[1] / 100, expected_return: returns[1] / 100, volatility: volatilities[1] / 100 },
                { name: "Zlato", weight: weights[2] / 100, expected_return: returns[2] / 100, volatility: volatilities[2] / 100 },
                { name: "Kripto", weight: weights[3] / 100, expected_return: returns[3] / 100, volatility: volatilities[3] / 100 }
            ]
        };

        const config = {
            initial_investment: investment,
            years: years,
            simulations: simulations,
            seed: 42
        };

        const output = run_monte_carlo(portfolio, config);
        const results = output.get("results");
        const statistics = output.get("statistics");

        simulationResults.innerHTML = `
            <h2>Monte Carlo rezultati</h2>
            <p>Srednja vrijednost: ${formatEuro(statistics.get("mean"))}</p>
            <p>Medijan: ${formatEuro(statistics.get("median"))}</p>
            <p>Standardna devijacija: ${formatEuro(statistics.get("std_dev"))}</p>
            <p>5. percentil: ${formatEuro(statistics.get("percentile_5"))}</p>
            <p>95. percentil: ${formatEuro(statistics.get("percentile_95"))}</p>
            <p>VaR 95: ${formatEuro(statistics.get("var_95"))}</p>
            <p>VaR 99: ${formatEuro(statistics.get("var_99"))}</p>
            <p>CVaR 95: ${formatEuro(statistics.get("cvar_95"))}</p>
        `;

        console.log(output);
    });
}

main();