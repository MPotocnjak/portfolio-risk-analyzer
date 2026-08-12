import init, { greet, run_monte_carlo } from "./pkg/portfolio_risk_analyzer.js";

async function main() {
    await init();
    document.getElementById("status").textContent = greet();

    // Formatiranje prikaza iznosa u x.xxx.xxx,xx €
    const formatEuro = value => new Intl.NumberFormat("hr-HR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value) + " €";

    document.getElementById("runButton").addEventListener("click", () => {
        const portfolio = {
            assets: [
                { name: "Dionice", weight: 0.50, expected_return: 0.08, volatility: 0.15 },
                { name: "Obveznice", weight: 0.20, expected_return: 0.03, volatility: 0.05 },
                { name: "Zlato", weight: 0.20, expected_return: 0.05, volatility: 0.12 },
                { name: "Kripto", weight: 0.10, expected_return: 0.15, volatility: 0.50 }
            ]
        };

        const config = {
            initial_investment: 10000,
            years: 20,
            simulations: 10000,
            seed: 42
        };

        const output = run_monte_carlo(portfolio, config);
        const results = output.get("results");
        const statistics = output.get("statistics");

        document.getElementById("statistics").innerHTML = `
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