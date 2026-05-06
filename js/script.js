const colorScale = {
        domain: ["yellow", "green", "hvfhv", "other_fhv"],
        range: ["#f0a500", "#4caf7d", "#3d5a99", "#aaaaaa"]
};



const margin = { top: 54, right: 18, bottom: 18, left: 18 };
const width = 800;
const height = 520;
const VIS2_DATE = "2024-10-16";
const VIS2_DEFAULT_VEHICLE = "all";
function formatHourLabel(hour) {
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  const suffix = hour < 12 ? "am" : "pm";
  return `${h12}:00 ${suffix}`;
}

function formatHourTickLabel(hour) {
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  const suffix = hour < 12 ? "a" : "p";
  return `${h12}${suffix}`;
}

const TIME_OPTIONS = d3.range(24).map(hour => ({
  label: formatHourLabel(hour),
  hour
}));

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
  const state = {
    ...TIME_OPTIONS[0],
    vehicleType: VIS2_DEFAULT_VEHICLE
  };
  let byBorough = new Map();
  let fixedMaxVal = 1;
  let currentColorScale = d3.scaleSequential(d3.interpolateYlOrRd).domain([0, 1]);

  const visRootNode = root.node();
  if (visRootNode.__vis2PlayDayTimer) {
    clearInterval(visRootNode.__vis2PlayDayTimer);
    visRootNode.__vis2PlayDayTimer = null;
  }

  svg.selectAll("*").remove();
  root.selectAll(".vis2-controls").remove();

  const vehicleTypes = Array.from(new Set(zoneHourly.map(d => d.vehicle_type))).sort((a, b) =>
    a.localeCompare(b)
  );
  const vehicleOptions = [{ value: "all", label: "All types" }].concat(
    vehicleTypes.map(v => ({ value: v, label: v }))
  );

  function getVehicleLabel(vehicleType) {
    return vehicleOptions.find(v => v.value === vehicleType)?.label ?? vehicleType;
  }

  const title = svg
      .append("text")
      .attr("x", margin.left)
      .attr("y", 22)
      .attr("font-size", 16)
      .attr("font-weight", 700)
      .text(
          `NYC Pickups by Borough — ${getVehicleLabel(state.vehicleType)}, ${state.label}`
      );

  const subtitle = svg
      .append("text")
      .attr("class", "vis2-subtitle")
      .attr("x", margin.left)
      .attr("y", 40)
      .attr("font-size", 12)
      .attr("fill", "#444")
      .text("");

  function formatHourlyTotal(total) {
    return `Total trips this hour: ${d3.format(",")(Math.round(total))}`;
  }

  const vis2Rows = zoneHourly.filter(d => d.pickup_date === VIS2_DATE);

  const byVehicleHourBorough = d3.rollup(
    vis2Rows,
    rs => d3.sum(rs, r => r.trip_count),
    d => d.vehicle_type,
    d => d.pickup_hour,
    d => d.borough
  );

  const byHourBoroughAll = d3.rollup(
    vis2Rows,
    rs => d3.sum(rs, r => r.trip_count),
    d => d.pickup_hour,
    d => d.borough
  );

  function computeByBorough(hour, vehicleType) {
    if (vehicleType === "all") {
      return byHourBoroughAll.get(hour) ?? new Map();
    }
    return byVehicleHourBorough.get(vehicleType)?.get(hour) ?? new Map();
  }

  function computeFixedMax(vehicleType) {
    const byHour = vehicleType === "all"
      ? byHourBoroughAll
      : byVehicleHourBorough.get(vehicleType) ?? new Map();
    const maxVal =
      d3.max(Array.from(byHour.values(), boroughMap => d3.max([...boroughMap.values()]) ?? 0)) ?? 1;
    return Math.max(1, maxVal);
  }

  function updateColorScale(vehicleType) {
    fixedMaxVal = computeFixedMax(vehicleType);
    currentColorScale = d3.scaleSequential(d3.interpolateYlOrRd).domain([0, fixedMaxVal]);
    gradientStops.attr("stop-color", d => currentColorScale(d * fixedMaxVal));
    updateLegend(vehicleType);
  }

  const projection = d3.geoMercator().fitExtent(
    [
      [margin.left, margin.top],
      [width - margin.right, height - margin.bottom - 46]
    ],
    boroughsGeojson
  );
  const path = d3.geoPath(projection);

  const mapPaths = svg
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
      return Number.isFinite(v) ? currentColorScale(v) : "#f2f2f2";
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
            `<div><b>Vehicle:</b> ${getVehicleLabel(state.vehicleType)}</div>` +
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

  const gradientStops = grad
    .selectAll("stop")
    .data(d3.range(0, 1.0001, 0.1))
    .join("stop")
    .attr("offset", d => `${d * 100}%`)
    .attr("stop-color", d => currentColorScale(d * fixedMaxVal));

  svg
    .append("rect")
    .attr("x", legendX)
    .attr("y", legendY)
    .attr("width", legendW)
    .attr("height", legendH)
    .attr("fill", `url(#${gradId})`)
    .attr("stroke", "#999");

  svg
    .append("text")
    .attr("class", "vis2-legend-title")
    .attr("x", legendX + legendW / 2)
    .attr("y", legendY - 6)
    .attr("text-anchor", "middle")
    .attr("font-size", 11)
    .attr("font-weight", 600)
    .attr("fill", "#333")
    .text("Trip Count");

  const legendAxisG = svg
    .append("g")
    .attr("transform", `translate(${legendX}, ${legendY + legendH})`);

  const legendTooltip = d3
    .select("body")
    .selectAll("div.vis2-legend-tooltip")
    .data([null])
    .join("div")
    .attr("class", "vis2-legend-tooltip")
    .style("position", "absolute")
    .style("pointer-events", "none")
    .style("opacity", 0)
    .style("background", "white")
    .style("border", "1px solid #ccc")
    .style("border-radius", "6px")
    .style("padding", "6px 8px")
    .style("font-size", "11px")
    .style("box-shadow", "0 2px 8px rgba(0,0,0,0.12)");

  function formatAdaptiveValue(value) {
    if (fixedMaxVal >= 1000) {
      return `${d3.format(",.1f")(value / 1000).replace(/\.0$/, "")}k`;
    }
    return d3.format(",.0f")(value);
  }

  function updateLegend(vehicleType) {
    const includeMaxTick = vehicleType !== "all";
    const axisTickValues = Array.from(
      new Set(includeMaxTick ? [...d3.scaleLinear().domain([0, fixedMaxVal]).range([0, legendW]).ticks(5), fixedMaxVal] : d3.scaleLinear().domain([0, fixedMaxVal]).range([0, legendW]).ticks(5))
    ).sort((a, b) => a - b);

    legendAxisG.selectAll("*").remove();
    legendAxisG
      .call(
        d3
          .axisBottom(d3.scaleLinear().domain([0, fixedMaxVal]).range([0, legendW]))
          .tickValues(axisTickValues)
          .tickFormat((d) => formatAdaptiveValue(d))
      )
      .call(g => g.select(".domain").remove());

    const legendScale = d3.scaleLinear().domain([0, fixedMaxVal]).range([0, legendW]);
    legendAxisG
      .append("rect")
      .attr("x", 0)
      .attr("y", -legendH)
      .attr("width", legendW)
      .attr("height", legendH)
      .attr("fill", "transparent")
      .on("mousemove", function (event) {
        const pos = d3.pointer(event, this)[0];
        const hoverVal = legendScale.invert(pos);
        legendTooltip
          .style("opacity", 1)
          .style("left", `${event.pageX + 8}px`)
          .style("top", `${event.pageY - 24}px`)
          .html(`<strong>Trip Count</strong><br/>${formatAdaptiveValue(hoverVal)}`);
      })
      .on("mouseleave", () => legendTooltip.style("opacity", 0));
  }

  function updateChoropleth() {
    byBorough = computeByBorough(state.hour, state.vehicleType);

    const hourlyTotal = d3.sum([...byBorough.values()]);
    subtitle.text(formatHourlyTotal(hourlyTotal));

    mapPaths
      .transition()
      .duration(250)
      .ease(d3.easeCubicOut)
      .attr("fill", f => {
        const borough = f.properties.BoroName ?? f.properties.borough;
        const v = byBorough.get(borough);
        return Number.isFinite(v) ? currentColorScale(v) : "#f2f2f2";
      });

    updateLegend(state.vehicleType);
  }

  legendAxisG
    .call(
      d3
        .axisBottom(d3.scaleLinear().domain([0, fixedMaxVal]).range([0, legendW]))
        .tickValues(Array.from(
          new Set([...d3.scaleLinear().domain([0, fixedMaxVal]).range([0, legendW]).ticks(5), fixedMaxVal])
        ).sort((a, b) => a - b))
        .tickFormat((d) => formatAdaptiveValue(d))
    )
    .call(g => g.select(".domain").remove());

  const legendScale = d3.scaleLinear().domain([0, fixedMaxVal]).range([0, legendW]);
  legendAxisG
    .append("rect")
    .attr("x", 0)
    .attr("y", -legendH)
    .attr("width", legendW)
    .attr("height", legendH)
    .attr("fill", "transparent")
    .on("mousemove", function (event) {
      const pos = d3.pointer(event, this)[0];
      const hoverVal = legendScale.invert(pos);
      legendTooltip
        .style("opacity", 1)
        .style("left", `${event.pageX + 8}px`)
        .style("top", `${event.pageY - 24}px`)
        .html(`<strong>Trip Count</strong><br/>${d3.format(",")(Math.round(hoverVal))} (${formatAdaptiveValue(hoverVal)})`);
    })
    .on("mouseleave", () => legendTooltip.style("opacity", 0));

  // Slider structure
  const controls = root.append("div").attr("class", "vis2-controls");
  controls.html(`
    <div class="vis2-controls-section vis2-vehicle-section">
      <label class="vis2-field-label" for="vis2-vehicle-select">Vehicle type</label>
      <select id="vis2-vehicle-select" class="vis2-vehicle-select" aria-label="Vehicle type"></select>
    </div>
    <div class="vis2-controls-section vis2-time-section">
      <div class="vis2-time-header">
        <div class="vis2-time-current">
          <span class="vis2-field-label">Hour of day</span>
          <span class="vis2-time-value" aria-live="polite">${state.label}</span>
        </div>
        <button type="button" class="vis2-play-toggle">Play day</button>
      </div>
      <input class="vis2-time-slider" type="range" min="0" max="${TIME_OPTIONS.length - 1}" step="1" value="0" aria-label="Hour of day" />
      <div class="vis2-time-labels" aria-hidden="true"></div>
    </div>
  `);

  const sliderTickHours = TIME_OPTIONS.filter(d => d.hour % 3 === 0 || d.hour === 23);

  controls
    .select(".vis2-time-labels")
    .selectAll("span")
    .data(sliderTickHours)
    .join("span")
    .text(d => formatHourTickLabel(d.hour));

  controls
    .select(".vis2-vehicle-select")
    .selectAll("option")
    .data(vehicleOptions)
    .join("option")
    .attr("value", d => d.value)
    .text(d => d.label);

  controls.select(".vis2-vehicle-select").property("value", state.vehicleType);

  const playToggle = controls.select(".vis2-play-toggle");
  const VIS2_PLAY_MS = 800;

  function syncHourFromIndex(idx) {
    const i = Math.min(TIME_OPTIONS.length - 1, Math.max(0, +idx));
    controls.select(".vis2-time-slider").property("value", i);
    Object.assign(state, TIME_OPTIONS[i]);
    controls.select(".vis2-time-value").text(state.label);
    title.text(
      `NYC Pickups by Borough — ${getVehicleLabel(state.vehicleType)}, ${state.label}`
    );
    updateChoropleth();
  }

  function stopPlayDay() {
    if (visRootNode.__vis2PlayDayTimer) {
      clearInterval(visRootNode.__vis2PlayDayTimer);
      visRootNode.__vis2PlayDayTimer = null;
    }
    playToggle.text("Play day");
  }

  playToggle.on("click", () => {
    if (visRootNode.__vis2PlayDayTimer) {
      stopPlayDay();
      return;
    }
    visRootNode.__vis2PlayDayTimer = setInterval(() => {
      const nextIdx = (state.hour + 1) % TIME_OPTIONS.length;
      syncHourFromIndex(nextIdx);
    }, VIS2_PLAY_MS);
    playToggle.text("Pause");
  });

  controls.select(".vis2-time-slider").on("input", e => {
    stopPlayDay();
    syncHourFromIndex(+e.target.value);
  });

  controls.select(".vis2-vehicle-select").on("change", e => {
    stopPlayDay();
    state.vehicleType = e.target.value;
    title.text(
      `NYC Pickups by Borough — ${getVehicleLabel(state.vehicleType)}, ${state.label}`
    );
    updateColorScale(state.vehicleType);
    updateChoropleth();
  });

  updateColorScale(state.vehicleType);
  updateChoropleth();
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

    // Embed the chart in the HTML file,
    // set actions = false, to remove the menu / Vega-lite source artifcat
    vegaEmbed('#vis3', marketShareChartSpec, {actions: false});
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
                    // move color squares further from the border 
                    x: { value: 30 }
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
              // define the order of categories, place HVFHV at the bottom for clarity
              transform: [
                    {
                      calculate:
                        "datum.taxi_type == 'hvfhv' ? 0 : " +
                        "datum.taxi_type == 'other_fhv' ? 1 : " +
                        "datum.taxi_type == 'green' ? 2 : " +
                        "datum.taxi_type == 'yellow' ? 3 : 4",
                      as: "stack_order"
                    }
                  ],

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
                        legend: null,
                    },

                    // order layers using our custom ""
                    order: {
                        field: "stack_order",
                        type: "quantitative",
                        sort: "ascending"
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
                        { year: 2025, label: "Congestion pricing" }
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

function createVis4(bundle) {
  const TYPE_LABELS = {
    all: "All types",
    green: "Green taxi",
    yellow: "Yellow taxi",
    fhv: "FHV (for-hire)",
    fhvhv: "FHVHV (high-volume / app)",
  };

  const margin = { top: 16, right: 220, bottom: 72, left: 120 };
  const innerWidth = 24 * 28;
  const innerHeight = 7 * 36;
  const width = margin.left + innerWidth + margin.right;
  const height = margin.top + innerHeight + margin.bottom;

  const wrap = d3.select("#vis4-chart-wrap");
  wrap.selectAll("*").remove();

  const svg = wrap
    .append("svg")
    .attr("viewBox", `0 0 ${width} ${height}`)
    .attr("width", "100%")
    .attr("height", height)
    .attr("preserveAspectRatio", "xMidYMid meet");

  const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

  const x = d3
    .scaleBand()
    .domain(d3.range(24).map(String))
    .range([0, innerWidth])
    .paddingInner(0.02)
    .paddingOuter(0.03)
    .paddingOuter(0);

  const dayOrder = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  const y = d3.scaleBand().domain(dayOrder).range([0, innerHeight]).paddingInner(0.02).paddingOuter(0);

  const xAxis = d3.axisBottom(x).tickValues(d3.range(1, 24, 2).map(String));
  const yAxis = d3.axisLeft(y);

  const xAxisG = g.append("g").attr("class", "axis").attr("transform", `translate(0,${innerHeight})`).call(xAxis);
  xAxisG.selectAll("text").attr("text-anchor", "middle").attr("dy", "0.75em");
  // Replace tick labels (which are odd hours: 1,3,...,23) with even labels 2,4,...,24
  xAxisG.selectAll(".tick text").text((d) => String(Number(d) + 1));
  // Position tick groups at the center of each hour band so labels sit on the mid-ticks
  xAxisG.selectAll(".tick").attr("transform", function (d) {
    const xPos = x(String(d));
    const mid = (xPos != null ? xPos : innerWidth) + x.bandwidth() / 2;
    return `translate(${mid},0)`;
  });
  // Add a small centered tick for each hour band (hours 1..24 mapped to bands 0..23)
  const midHours = d3.range(24);
  xAxisG
    .selectAll("line.mid-tick")
    .data(midHours)
    .join("line")
    .attr("class", "mid-tick")
    .attr("x1", (d) => x(String(d)) + x.bandwidth() / 2)
    .attr("x2", (d) => x(String(d)) + x.bandwidth() / 2)
    .attr("y1", 0)
    .attr("y2", 6)
    .attr("stroke", "#666")
    .attr("stroke-width", 0.6);
  // Note: final '24' label is provided by converting the 23 tick to 24 above
  xAxisG
    .append("text")
    .attr("fill", "#333")
    .attr("x", innerWidth / 2)
    .attr("y", 54)
    .attr("text-anchor", "middle")
    .style("font-size", "12px")
    .text("Hour of day (1–24)");

  g.append("g")
    .attr("class", "axis")
    .call(yAxis)
    .append("text")
    .attr("fill", "#333")
    .attr("transform", "rotate(-90)")
    .attr("x", -innerHeight / 2)
    .attr("y", -84)
    .attr("text-anchor", "middle")
    .style("font-size", "12px")
    .text("Day of week");

  const legendG = svg
    .append("g")
    .attr("class", "legend-wrap")
    .attr("transform", `translate(${margin.left + innerWidth + 16}, ${margin.top})`);

  const tooltip = d3.select("#vis4-tooltip");
  tooltip.style("opacity", 0);

  function showTooltip(html, event) {
    tooltip.style("opacity", 1).html(html);
    positionTooltip(event);
  }

  function hideTooltip() {
    tooltip.style("opacity", 0);
  }

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

  function drawLegend(maxVal, color, typeKey) {
    legendG.selectAll("*").remove();
    const lh = innerHeight;
    const lw = 18;
    const n = 48;
    const legendScale = d3.scaleLinear().domain([0, maxVal]).range([lh, 0]);
    const useThousands = maxVal >= 1000;
    const formatLegendValue = (value) => {
      if (!useThousands) return d3.format(",.0f")(value);
      return `${d3.format(",.1f")(value / 1000).replace(/\.0$/, "")}k`;
    };
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
      .attr("stroke-width", 0.2)
      .on("mouseenter", (event, d) => {
        const rangeLo = Math.round(legendScale.invert(d.y + d.h));
        const rangeHi = Math.round(legendScale.invert(d.y));
        showTooltip(
          `<strong>Trips</strong><br/>` +
            `Range: ${formatLegendValue(rangeLo)} - ${formatLegendValue(rangeHi)}`,
          event
        );
      })
      .on("mousemove", (event) => positionTooltip(event))
      .on("mouseleave", hideTooltip);

    const includeMaxTick = !["green", "fhvhv", "all"].includes(typeKey);
    const axisTickValues = Array.from(
      new Set(includeMaxTick ? [...legendScale.ticks(6), maxVal] : legendScale.ticks(6))
    ).sort((a, b) => a - b);
    const axis = d3.axisRight(legendScale).tickValues(axisTickValues).tickFormat((d) => formatLegendValue(d));

    legendG
      .append("g")
      .attr("transform", `translate(${lw},0)`)
      .call(axis)
      .selectAll("text")
      .attr("fill", "#444")
      .style("font-size", "9px")
      .attr("dy", "0.35em");

    legendG
      .append("text")
      .attr("x", lw / 2)
      .attr("y", -6)
      .attr("text-anchor", "middle")
      .style("font-size", "10px")
      .style("fill", "#555")
      .text(useThousands ? "Trips (k)" : "Trips");
  }

  function renderCells(cells, color, taxiLabel) {
    const key = (d) => `${d.dow}-${d.hour}`;
    const dayName = (dow) => dayOrder[dow - 1];
    const tipHtml = (d) =>
      `<strong>${dayName(d.dow)}</strong><br/>Hour <strong>${d.hour}:00</strong>–<strong>${d.hour}:59</strong><br/>` +
      `<strong>${d3.format(",")(d.count)}</strong> trips<br/><span style="opacity:.85">${taxiLabel}</span>`;

    const sel = g.selectAll("rect.cell").data(cells, key);
    sel.exit().remove();

    // Enter: position immediately but invisible so we can animate appearance left->right
    const ent = sel
      .enter()
      .append("rect")
      .attr("class", "cell")
      .attr("x", (d) => x(String(d.hour)))
      .attr("y", (d) => y(dayName(d.dow)))
      .attr("width", x.bandwidth())
      .attr("height", y.bandwidth())
      .attr("fill", (d) => color(0))
      .style("opacity", 0)
      .on("mouseenter", (event, d) => {
        tooltip.style("opacity", 1);
        tooltip.html(tipHtml(d));
        positionTooltip(event);
      })
      .on("mousemove", (event) => positionTooltip(event))
      .on("mouseleave", () => tooltip.style("opacity", 0));

    const merged = ent.merge(sel);

    // Animate color and opacity left-to-right based on hour index
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

    const baseDelay = 24; // ms per hour column
    merged
      .transition()
      .delay((d) => (Number(d.hour) || 0) * baseDelay)
      .duration(480)
      .ease(d3.easeCubicOut)
      .style("opacity", 1)
      .attr("fill", (d) => color(d.count));
  }

  function updateChart(typeKey) {
    const cells = bundle.types[typeKey].cells;
    const maxC = d3.max(cells, (d) => d.count) || 1;
    const color = d3.scaleSequential(d3.interpolateYlOrRd).domain([0, maxC]);
    const taxiLabel = TYPE_LABELS[typeKey];
    drawLegend(maxC, color, typeKey);
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
    d3.csv("data/processed/zone_hourly.csv", d => ({
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