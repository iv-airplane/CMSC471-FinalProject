const colorScale = {
        domain: ["yellow", "green", "hvfhv", "other_fhv"],
        range: ["#f0a500", "#4caf7d", "#3d5a99", "#aaaaaa"]
};



const margin = { top: 42, right: 18, bottom: 18, left: 18 };
const width = 800;
const height = 520;
const VIS2_DATE = "2024-10-16";
const VIS2_VEHICLE = "yellow";
const TIME_OPTIONS = [
  { label: "8:30am", hour: 8 },
  { label: "12pm", hour: 12 },
  { label: "5:30pm", hour: 17 },
  { label: "11pm", hour: 23 }
];

const root = d3.select("#vis2");
const svg = root.append("svg").attr("width", width).attr("height", height);

const tooltip = d3
  .select("body")
  .selectAll("div.vis2-tooltip")
  .data([null])
  .join("div")
  .attr("class", "vis2-tooltip")
  .style("position", "absolute")
  .style("pointer-events", "none")
  .style("opacity", 0)
  .style("background", "white")
  .style("border", "1px solid #ccc")
  .style("border-radius", "6px")
  .style("padding", "8px 10px")
  .style("font-size", "12px")
  .style("box-shadow", "0 2px 8px rgba(0,0,0,0.12)");

function createVis(zoneHourly, boroughsGeojson) {
  const state = {...TIME_OPTIONS[0]}; // {label, hour}

  svg.selectAll("*").remove();
  root.selectAll(".vis2-controls").remove();

  const title = svg
      .append("text")
      .attr("x", margin.left)
      .attr("y", 24)
      .attr("font-size", 16)
      .attr("font-weight", 700)
      .text(
          `NYC Pickups by Borough (static mock) — ${VIS2_VEHICLE}, ${state.label}`
      );

  const byBorough = d3.rollup(
      zoneHourly.filter(
          d =>
              d.pickup_date === VIS2_DATE &&
              d.pickup_hour === state.hour &&
              d.vehicle_type === VIS2_VEHICLE
      ),
      rs => d3.sum(rs, r => r.trip_count),
      d => d.borough
  );

  const maxVal = d3.max([...byBorough.values()]) ?? 1;
  const colorScale = d3
    .scaleSequential(d3.interpolateBlues)
    .domain([0, maxVal]);

  const projection = d3.geoMercator().fitExtent(
    [
      [margin.left, margin.top],
      [width - margin.right, height - margin.bottom - 46]
    ],
    boroughsGeojson
  );
  const path = d3.geoPath(projection);

  svg
    .append("g")
    .selectAll("path")
    .data(boroughsGeojson.features)
    .join("path")
    .attr("d", path)
    .attr("stroke", "#555")
    .attr("stroke-width", 0.8)
    .attr("fill", f => {
      const borough = f.properties.BoroName ?? f.properties.borough;
      const v = byBorough.get(borough);
      return Number.isFinite(v) ? colorScale(v) : "#f2f2f2";
    })
    .on("mousemove", (event, f) => {
      const borough = f.properties.BoroName ?? f.properties.borough;
      const v = byBorough.get(borough);
      tooltip
        .style("opacity", 1)
        .style("left", `${event.pageX + 12}px`)
        .style("top", `${event.pageY + 12}px`)
        .html(
          `<div style="font-weight:700;margin-bottom:4px;">${borough}</div>` +
            `<div><b>Time:</b> ${state.label}</div>` +
            `<div><b>Vehicle:</b> ${VIS2_VEHICLE}</div>` +
            `<div><b>Trip count:</b> ${
              Number.isFinite(v) ? d3.format(",")(Math.round(v)) : "No data"
            }</div>`
        );
    })
    .on("mouseleave", () => tooltip.style("opacity", 0));

  svg
    .append("g")
    .selectAll("text")
    .data(boroughsGeojson.features)
    .join("text")
    .attr("class", "labels")
    .attr("x", d => path.centroid(d)[0])
    .attr("y", d => path.centroid(d)[1])
    .attr("text-anchor", "middle")
    .attr("dominant-baseline", "middle")
    .attr("font-size", 11)
    .attr("fill", "#222")
    .text(d => d.properties.BoroName ?? d.properties.borough);

  // Legend
  const legendW = 260;
  const legendH = 10;
  const legendX = margin.left;
  const legendY = height - 32;

  const defs = svg.append("defs");
  const gradId = "vis2-legend-gradient";
  const grad = defs
    .append("linearGradient")
    .attr("id", gradId)
    .attr("x1", "0%")
    .attr("x2", "100%");

  grad
    .selectAll("stop")
    .data(d3.range(0, 1.0001, 0.1))
    .join("stop")
    .attr("offset", d => `${d * 100}%`)
    .attr("stop-color", d => colorScale(d * maxVal));

  svg
    .append("rect")
    .attr("x", legendX)
    .attr("y", legendY)
    .attr("width", legendW)
    .attr("height", legendH)
    .attr("fill", `url(#${gradId})`)
    .attr("stroke", "#999");

  svg
    .append("g")
    .attr("transform", `translate(${legendX}, ${legendY + legendH})`)
    .call(
      d3
        .axisBottom(d3.scaleLinear().domain([0, maxVal]).range([0, legendW]))
        .ticks(5)
        .tickFormat(d3.format("~s"))
    )
    .call(g => g.select(".domain").remove());

  // Slider structure
  const controls = root.append("div").attr("class", "vis2-controls");
  controls.html(`
    <div class="vis2-controls__row"><b>Time:</b> <span class="vis2-time-value">${state.label}</span></div>
    <input class="vis2-time-slider" type="range" min="0" max="${TIME_OPTIONS.length - 1}" step="1" value="0" />
    <div class="vis2-time-labels"></div>
  `);

  controls
    .select(".vis2-time-labels")
    .selectAll("span")
    .data(TIME_OPTIONS)
    .join("span")
    .text(d => d.label);

  controls.select(".vis2-time-slider").on("input", e => {
    Object.assign(state, TIME_OPTIONS[+e.target.value]);
    controls.select(".vis2-time-value").text(state.label);
    title.text(
      `NYC Pickups by Borough (static mock) — ${VIS2_VEHICLE}, ${state.label}`
    );
  });
}



// https://vega.github.io/vega-lite/examples/stacked_bar_weather.html

/*
  Quantitative: Numerical values you can measure and do math with.
  Nominal: Categories with no inherit order
  Ordinal: Categories with meaningful order
*/
function createVis3(data) {
    const marketShareChartSpec = {
        $schema: "https://vega.github.io/schema/vega-lite/v6.json",
        data: {
            values: data
        },
        vconcat: [
            createTopRow(),
            createStackedBarChart()
        ]
    };

    // Embed the chart in the HTML file
    vegaEmbed('#vis3', marketShareChartSpec);
}


function createDonutChart() {
    return {
        width: 200,
        height: 200,
        layer: [
            // Donut arcs
            {
                mark: {
                    type: "arc",
                    innerRadius: 60,
                    outerRadius: 90
                },
                encoding: {
                    theta: {
                        field: "share",
                        type: "quantitative"
                    },
                    color: {
                        field: "taxi_type",
                        type: "nominal",
                        scale: colorScale,
                        legend: null // IMPORTANT: we use custom legend
                    }
                }
            },
            // Center label (year) for the donut chart
            {
                mark: {
                    type: "text",
                    fontSize: 20,
                    fontWeight: "bold",
                    align: "center",
                    baseline: "middle"
                },
                encoding: {
                    text: {
                        aggregate: "max",
                        field: "year"
                    }
                }
            },
            // "share" label above year 
            {
                mark: {
                    type: "text",
                    fontSize: 12,
                    dy: -20,
                    align: "center",
                    baseline: "middle",
                    color: "#666"
                },
                // Add the clarifying label
                encoding: {
                    text: { value: "total trips" }
                }
            },
            // Display Total number of trips for the selecyed year
            {
                mark: {
                    type: "text",
                    fontSize: 12,
                    dy: 20,
                    align: "center",
                    baseline: "middle",
                    color: "#333"
                },
                encoding: {
                    text: {
                    aggregate: "sum",
                    field: "trip_count",
                    format: ","
                    }
                }
            }
        ]
    };
}

// A helper function to create custom legend for the plot
function createLegendChart() {
    return {
        width: 400,
        height: 200,
        encoding: {
            y: {
                field: "taxi_type",
                type: "nominal",
                sort: null,
                axis: null
            }
        },
        layer: [
            // Color squares
            {
                mark: {
                    type: "point",
                    shape: "square",
                    size: 200
                },
                encoding: {
                    color: {
                        field: "taxi_type",
                        type: "nominal",
                        scale: colorScale,
                        legend: null
                    },
                    x: { value: 10 }
                }
            },
            // Labels for taxis (Uber, Yellow cab...)
            {
                mark: {
                    type: "text",
                    align: "left",
                    dx: 20
                },
                encoding: {
                    text: {
                        field: "taxi_type",
                        type: "nominal"
                    },
                    x: { value: 30 }
                }
            },
            // Percentages share of taxi companies (RIGHT aligned)
            {
                mark: {
                    type: "text",
                    align: "right"
                },
                encoding: {
                    text: {
                        field: "share",
                        type: "quantitative",
                        format: ".0%"
                    },
                    x: { value: 350 } // push to right
                }
            }
        ]
    };
}

function createTopRow() {
    return {
        // This transform filters the data feeding into the top row 
        // based on the current selection from the bar chart
        transform: [
            { 
                // If yearSelection exists, filter by the selected year. 
                // Otherwise, show only 2020.
                filter: "yearSelection.year ? datum.year === yearSelection.year[0] : datum.year === 2020"
            }
        ],
        hconcat: [
            createDonutChart(),
            createLegendChart()
        ],
        spacing: 40
    };
}

function createStackedBarChart() {
    return {
        width: 700,
        height: 300,
        title: "Taxi Market Share Throughout The Years",
        layer: [
            // Main stacked bars
            {
                mark: {
                    type: "bar",
                    size: 18
                },
                
                /* 
                   Parameters should live ONLY in the 
                   chart of intereset not at the top level
                   to avoid errors
                */
                params: [
                    {
                        name: "yearSelection",
                        select: {
                            type: "point",
                            fields: ["year"],
                            on: "click",
                            clear: "dblclick"
                        }
                    }
                ],
                encoding: {
                    x: {
                        field: "year",
                        type: "ordinal",
                        axis: {
                            title: "Year",
                            labelAngle: 0
                        },
                        scale: {
                            paddingInner: 0.15,
                            paddingOuter: 0.05
                        }
                    },
                    y: {
                        aggregate: "sum",
                        field: "trip_count",
                        type: "quantitative",
                        stack: "normalize",
                        axis: null
                    },
                    color: {
                        field: "taxi_type",
                        type: "nominal",
                        scale: colorScale,
                        legend: null
                    },
                    // Highlight the selected bar
                    opacity: {
                        condition: { param: "yearSelection", value: 1 },
                        value: 0.4
                    },
                    tooltip: [
                        { field: "year", type: "ordinal" },
                        { field: "taxi_type", type: "nominal" },
                        {
                            aggregate: "sum",
                            field: "trip_count",
                            type: "quantitative",
                            title: "Trips",
                            format: "," // Adds commas to separate thousands
                        }
                    ]
                }
            },
            // Labels years with events of interest 
            {
                data: {
                    values: [
                        { year: 2015, label: "Uber enters" },
                        { year: 2018, label: "Ride-hailing cap" },
                        { year: 2020, label: "COVID" },
                        { year: 2023, label: "Congestion pricing" }
                    ]
                },
                mark: {
                    type: "text",
                    dy: -8,
                    fontSize: 11
                },
                encoding: {
                    x: {
                        field: "year",
                        type: "ordinal"
                    },
                    y: {
                        value: 0
                    },
                    text: {
                        field: "label"
                    }
                }
            }
        ]
    };
}

function createVis4(bundle) {
  const TYPE_LABELS = {
    all: "All types",
    green: "Green taxi",
    yellow: "Yellow taxi",
    fhv: "FHV (for-hire)",
    fhvhv: "FHVHV (high-volume / app)",
  };

  const margin = { top: 16, right: 100, bottom: 48, left: 88 };
  const innerWidth = 24 * 28;
  const innerHeight = 7 * 36;
  const width = margin.left + innerWidth + margin.right;
  const height = margin.top + innerHeight + margin.bottom;

  const wrap = d3.select("#vis4-chart-wrap");
  wrap.selectAll("*").remove();

  const svg = wrap
    .append("svg")
    .attr("viewBox", `0 0 ${width} ${height}`)
    .attr("width", width)
    .attr("height", height);

  const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

  const x = d3
    .scaleBand()
    .domain(d3.range(24).map(String))
    .range([0, innerWidth])
    .paddingInner(0.02)
    .paddingOuter(0);

  const dayOrder = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  const y = d3.scaleBand().domain(dayOrder).range([0, innerHeight]).paddingInner(0.02).paddingOuter(0);

  const xAxis = d3.axisBottom(x).tickValues(d3.range(0, 24, 2).map(String));
  const yAxis = d3.axisLeft(y);

  g.append("g")
    .attr("class", "axis")
    .attr("transform", `translate(0,${innerHeight})`)
    .call(xAxis)
    .append("text")
    .attr("fill", "#333")
    .attr("x", innerWidth / 2)
    .attr("y", 40)
    .attr("text-anchor", "middle")
    .style("font-size", "12px")
    .text("Hour of day (0–23)");

  g.append("g")
    .attr("class", "axis")
    .call(yAxis)
    .append("text")
    .attr("fill", "#333")
    .attr("transform", "rotate(-90)")
    .attr("x", -innerHeight / 2)
    .attr("y", -56)
    .attr("text-anchor", "middle")
    .style("font-size", "12px")
    .text("Day of week");

  const legendG = svg
    .append("g")
    .attr("class", "legend-wrap")
    .attr("transform", `translate(${margin.left + innerWidth + 16}, ${margin.top})`);

  const tooltip = d3.select("#vis4-tooltip");
  tooltip.style("opacity", 0);

  const selectEl = d3.select("#vis4-taxi-type");

  function positionTooltip(event) {
    const pad = 12;
    let x0 = event.clientX + pad;
    let y0 = event.clientY + pad;
    const node = tooltip.node();
    const rect = node.getBoundingClientRect();
    if (x0 + rect.width > window.innerWidth - 8) x0 = event.clientX - rect.width - pad;
    if (y0 + rect.height > window.innerHeight - 8) y0 = event.clientY - rect.height - pad;
    tooltip.style("left", x0 + "px").style("top", y0 + "px");
  }

  function drawLegend(maxVal, color) {
    legendG.selectAll("*").remove();
    const lh = innerHeight;
    const lw = 18;
    const n = 48;
    const legendScale = d3.scaleLinear().domain([0, maxVal]).range([lh, 0]);
    const bars = d3.range(n).map((i) => {
      const lo = (i / n) * maxVal;
      const hi = ((i + 1) / n) * maxVal;
      return { y: legendScale(hi), h: Math.max(1, legendScale(lo) - legendScale(hi)), c: color((lo + hi) / 2) };
    });
    legendG
      .selectAll("rect.lg")
      .data(bars)
      .join("rect")
      .attr("class", "lg")
      .attr("x", 0)
      .attr("y", (d) => d.y)
      .attr("width", lw)
      .attr("height", (d) => d.h)
      .attr("fill", (d) => d.c)
      .attr("stroke", "#ccc")
      .attr("stroke-width", 0.2);

    const axis = d3.axisRight(legendScale).ticks(6).tickFormat((d) => d3.format(",.0f")(d));

    legendG
      .append("g")
      .attr("transform", `translate(${lw},0)`)
      .call(axis)
      .selectAll("text")
      .attr("fill", "#444")
      .style("font-size", "10px");

    legendG
      .append("text")
      .attr("x", lw / 2)
      .attr("y", -6)
      .attr("text-anchor", "middle")
      .style("font-size", "10px")
      .style("fill", "#555")
      .text("Trips");
  }

  function renderCells(cells, color, taxiLabel) {
    const key = (d) => `${d.dow}-${d.hour}`;
    const dayName = (dow) => dayOrder[dow - 1];
    const tipHtml = (d) =>
      `<strong>${dayName(d.dow)}</strong><br/>Hour <strong>${d.hour}:00</strong>–<strong>${d.hour}:59</strong><br/>` +
      `<strong>${d3.format(",")(d.count)}</strong> trips<br/><span style="opacity:.85">${taxiLabel}</span>`;

    const sel = g.selectAll("rect.cell").data(cells, key);
    sel.exit().remove();
    const ent = sel.enter().append("rect").attr("class", "cell").attr("fill", (d) => color(d.count));

    const merged = ent.merge(sel);
    merged
      .attr("x", (d) => x(String(d.hour)))
      .attr("y", (d) => y(dayName(d.dow)))
      .attr("width", x.bandwidth())
      .attr("height", y.bandwidth())
      .on("mouseenter", (event, d) => {
        tooltip.style("opacity", 1);
        tooltip.html(tipHtml(d));
        positionTooltip(event);
      })
      .on("mousemove", (event) => positionTooltip(event))
      .on("mouseleave", () => tooltip.style("opacity", 0));

    merged.transition().duration(450).ease(d3.easeCubicOut).attr("fill", (d) => color(d.count));
  }

  function updateChart(typeKey) {
    const cells = bundle.types[typeKey].cells;
    const maxC = d3.max(cells, (d) => d.count) || 1;
    const color = d3.scaleSequential(d3.interpolateYlOrRd).domain([0, maxC]);
    const taxiLabel = TYPE_LABELS[typeKey];
    drawLegend(maxC, color);
    renderCells(cells, color, taxiLabel);
  }

  const types = Object.keys(bundle.types).sort((a, b) => {
    if (a === "all") return -1;
    if (b === "all") return 1;
    return a.localeCompare(b);
  });
  const month = bundle.monthLabel;
  d3.select("#vis4-title").text("City Wake Up: Total Trips by Hour and Day of Week");
  d3.select("#vis4-subtitle").text(month ? `(${month})` : "");

  selectEl.selectAll("option").remove();
  selectEl
    .selectAll("option")
    .data(types)
    .join("option")
    .attr("value", (d) => d)
    .text((d) => TYPE_LABELS[d]);

  selectEl.property("value", types[0]);
  updateChart(types[0]);

  selectEl.on("change", function () {
    updateChart(this.value);
  });
}

// Load data
function init() {
  Promise.all([
    d3.json("data/choropleth/nyc_boroughs.geojson"),
    d3.csv("data/choropleth/mock_zone_hourly.csv", d => ({
      zone_id: +d.zone_id,
      borough: d.borough,
      pickup_date: d.pickup_date,
      pickup_hour: +d.pickup_hour,
      vehicle_type: d.vehicle_type,
      trip_count: +d.trip_count,
      trip_price: d.trip_price === "" ? null : +d.trip_price
    })),
    d3.csv("data/processed/yearly_market_share.csv", d => ({
        // Use the unary plus (+) operator to convert strings to numbers
        year: +d.year,
        taxi_type: d.taxi_type,
        trip_count: +d.trip_count,
        share: +d.share  })),
    d3.json("data/processed/heatmap_data.json")
  ]).then(([boroughsGeojson, zoneHourly, marketShare, heatmapBundle]) => {
    createVis(zoneHourly, boroughsGeojson);
    createVis3(marketShare);
    createVis4(heatmapBundle);
  }).catch(error => {
        console.error("Error loading project data:", error);
  });
}

window.addEventListener("load", init);