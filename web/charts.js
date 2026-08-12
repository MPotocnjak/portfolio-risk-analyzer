let distributionChart;

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

export function drawDistribution(results) {
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