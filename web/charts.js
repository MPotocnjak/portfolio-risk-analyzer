let distributionChart;
let pathsChart;

let currentResults = null;
let currentPathSelection = null;

function percentile(values, p) {
    const index = (values.length - 1) * p;
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    if (lower === upper) return values[lower];
    return values[lower] + (values[upper] - values[lower]) * (index - lower);
}

function formatNumber(value) {
    return new Intl.NumberFormat("hr-HR", {
        maximumFractionDigits: 0
    }).format(value);
}

function resetHistogramColors() {
    if (!distributionChart) return;

    distributionChart.data.datasets[0].backgroundColor =
        distributionChart.data.datasets[0].data.map(() => "rgba(37, 99, 235, 0.65)");

    distributionChart.data.datasets[0].borderColor =
        distributionChart.data.datasets[0].data.map(() => "rgba(37, 99, 235, 1)");

    distributionChart.update();
}

function highlightHistogramBar(index) {
    const dataset = distributionChart.data.datasets[0];

    dataset.backgroundColor = dataset.data.map((_, i) =>
        i === index
            ? "rgba(37, 99, 235, 0.9)"
            : "rgba(150, 150, 150, 0.3)"
    );

    dataset.borderColor = dataset.data.map((_, i) =>
        i === index
            ? "rgba(30, 64, 175, 1)"
            : "rgba(150, 150, 150, 0.5)"
    );

    distributionChart.update();
}

export function drawDistribution(results) {
    currentResults = results;

    const values = results.map(result => result.get("final_value")).filter(Number.isFinite);
    const sorted = [...values].sort((a, b) => a - b);

    const min = sorted[0];
    const max = sorted[sorted.length - 1];
    const p1 = percentile(sorted, 0.01);
    const p5 = percentile(sorted, 0.05);
    const p95 = percentile(sorted, 0.95);
    const p99 = percentile(sorted, 0.99);

    const zones = [[min, p1, 4], [p1, p5, 4], [p5, p95, 24], [p95, p99, 4], [p99, max, 4]];
    const edges = [];

    zones.forEach(([start, end, count]) => {
        if (end <= start) return;
        const width = (end - start) / count;
        for (let i = 0; i < count; i++) {
            edges.push({ start: start + i * width, end: start + (i + 1) * width });
        }
    });

    const counts = edges.map(bin =>
        values.filter(value => value >= bin.start && value < bin.end).length
    );

    if (counts.length) {
        const last = edges.length - 1;
        counts[last] = values.filter(value => value >= edges[last].start && value <= edges[last].end).length;
    }

    if (distributionChart) distributionChart.destroy();

    distributionChart = new Chart(document.getElementById("distributionChart"), {
        type: "bar",
        data: {
            labels: edges.map(bin => bin.start),
            datasets: [{
                label: "Broj simulacija",
                data: counts,
                backgroundColor: "#2563eb",
                borderColor: "#ffffff",
                borderWidth: 1,
                barPercentage: 1,
                categoryPercentage: 1
            }]
        },
        options: {
            responsive: true,
            onClick: (event) => {
                const elements = distributionChart.getElementsAtEventForMode(event, "nearest", { intersect: true }, true);
                
                // Klik izvan stupca
                if (!elements.length) {
                    resetHistogramColors();
                    currentPathSelection = null;
                    drawSimulationPaths(currentResults);
                    return;
                }

                const binIndex = elements[0].index;
                const bin = edges[elements[0].index];

                highlightHistogramBar(binIndex);
            
                const simulations = currentResults.map((result, index) => ({
                    index,
                    finalValue: result.get("final_value"),
                    yearlyValues: result.get("yearly_values")
                }));
            
                const matching = simulations.filter(simulation =>
                    simulation.finalValue >= bin.start &&
                    simulation.finalValue < bin.end
                );
            
                const selected = matching
                    .sort(() => Math.random() - 0.5)
                    .slice(0, 20);
            
                currentPathSelection = selected;
                
                drawSimulationPaths(currentResults, selected,
                    `${formatNumber(bin.start)} – ${formatNumber(bin.end)} €`
                );
            },
            plugins: {
                title: {
                    display: true,
                    text: "Distribucija završnih vrijednosti portfelja",
                    font: { size: 18 }
                },
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        title: items => {
                            const bin = edges[items[0].dataIndex];
                            return `${formatNumber(bin.start)} – ${formatNumber(bin.end)} €`;
                        },
                        label: item => `Broj simulacija: ${item.raw}`
                    }
                }
            },
            scales: {
                x: {
                    title: {
                        display: true,
                        text: "Završna vrijednost (€)"
                    },
                    ticks: {
                        autoSkip: true,
                        maxTicksLimit: 10,
                        callback: (value, index) => formatNumber(edges[index].start)
                    }
                },
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: "Broj simulacija"
                    }
                }
            }
        }
    });
}

export function drawSimulationPaths(results, selected = null, selectionLabel = null) {
    const simulations = results.map((result, index) => ({
        index,
        finalValue: result.get("final_value"),
        yearlyValues: result.get("yearly_values")
    }));

    if(!selected) {
        const sorted = [...simulations].sort((a, b) => a.finalValue - b.finalValue);
        const median = sorted.length % 2
            ? sorted[Math.floor(sorted.length / 2)].finalValue
            : (sorted[sorted.length / 2 - 1].finalValue + sorted[sorted.length / 2].finalValue) / 2;

        selected = simulations
            .sort((a, b) => Math.abs(a.finalValue - median) - Math.abs(b.finalValue - median))
            .slice(0, 20);
    }
    const years = selected[0].yearlyValues.map((_, index) => index);

    if (pathsChart) pathsChart.destroy();

    pathsChart = new Chart(document.getElementById("simulationPathsChart"), {
        type: "line",
        data: {
            labels: years,
            datasets: selected.map((simulation, index) => ({
                label: `Simulacija ${simulation.index + 1}`,
                data: simulation.yearlyValues,    
                borderColor: `hsl(${index * 18}, 70%, 50%)`,
                backgroundColor: "transparent",    
                borderWidth: 2,
                pointRadius: 0,
                pointHoverRadius: 5,
                pointHitRadius: 10,    
                tension: 0
            }))
        },    
        options: {
            responsive: true,    
            interaction: { mode: "nearest", intersect: false},    
            onClick: (event) => {
                const elements = pathsChart.getElementsAtEventForMode(event, "nearest", { intersect: true }, true);    
                
                // Kliknuta je linija
                if (elements.length) {
                    const selectedDatasetIndex = elements[0].datasetIndex;

                    pathsChart.data.datasets.forEach((dataset, index) => {
                        if (index === selectedDatasetIndex) {
                            dataset.borderColor = `hsl(${index * 18}, 70%, 50%)`;
                            dataset.borderWidth = 4;
                        } else {
                            dataset.borderColor = "rgba(150, 150, 150, 0.25)";
                            dataset.borderWidth = 1.5;
                        }
                    });

                    pathsChart.update();
                    return;
                }

                // Klik izvan svih linija → sve ponovno oboji
                pathsChart.data.datasets.forEach((dataset, index) => {
                    dataset.borderColor = `hsl(${index * 18}, 70%, 50%)`;
                    dataset.borderWidth = 2;
                });

                pathsChart.update();
            },    
            plugins: {
                title: {
                    display: true,
                    text: selectionLabel
                        ? `Razvoj vrijednosti portfelja kroz vrijeme sa završnim vrijednostima ${selectionLabel}`
                        : "Razvoj vrijednosti portfelja kroz vrijeme oko medijana",
                    font: {
                        size: 18
                    }
                },    
                legend: { display: false },    
                tooltip: {
                    callbacks: {
                        title: items => `Godina ${items[0].label}`,    
                        label: item => `Simulacija ${selected[item.datasetIndex].index + 1}: ${formatNumber(item.raw)} €`
                    }
                }
            },    
            scales: {
                x: {
                    title: {
                        display: true,
                        text: "Godina"
                    }
                },    
                y: {
                    title: {
                        display: true,
                        text: "Vrijednost portfelja (€)"
                    },    
                    ticks: {
                        callback: value => formatNumber(value)
                    }
                }
            }
        }
    });
}