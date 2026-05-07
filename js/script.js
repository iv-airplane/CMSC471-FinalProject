const colorScale = {
        domain: ["yellow", "green", "hvfhv", "other_fhv"],
        range: ["#f0a500", "#4caf7d", "#3d5a99", "#aaaaaa"]
};



const margin = { top: 54, right: 18, bottom: 18, left: 18 };
const width = 1000;
const height = 650;
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



function createVis(zoneHourly, taxiZonesGeojson, boroughsGeojson) {
  const state = {
    ...TIME_OPTIONS[0],
    vehicleType: VIS2_DEFAULT_VEHICLE,
    viewMode: "borough"
  };

  function getActiveGeojson() {
    return state.viewMode === "borough" ? boroughsGeojson : taxiZonesGeojson;
  } 
  let byZone = new Map();
  let fixedMaxVal = 1;
  let currentColorScale = d3.scaleSequential(d3.interpolateYlOrRd).domain([0, 1]);

  let selectedFeature = null;
  let selectedKey = null;
  const visRootNode = root.node();
  if (visRootNode.__vis2PlayDayTimer) {
    clearInterval(visRootNode.__vis2PlayDayTimer);
    visRootNode.__vis2PlayDayTimer = null;
  }

  svg.selectAll("*").remove();
  root.selectAll(".vis2-controls").remove();
  root.selectAll(".vis2-map-overlay").remove();

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
    .text(`NYC Pickups by Taxi Zone — ${getVehicleLabel(state.vehicleType)}, ${state.label}`);

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
  const VEHICLE_ORDER = ["yellow", "green", "hvfhv", "other_fhv"];

  const VEHICLE_LABELS = {
    yellow: "Yellow",
    green: "Green",
    hvfhv: "HVFHV",
    other_fhv: "Other FHV"
  };

  const VEHICLE_COLORS = {
    yellow: "#f0a500",
    green: "#4caf7d",
    hvfhv: "#3d5a99",
    other_fhv: "#aaaaaa"
  };

  function getFeatureKey(f) {
    if (state.viewMode === "borough") {
      return getFeatureBorough(f);
    }
    return +f.properties.LocationID;
  }

  function getFeatureName(f) {
    if (state.viewMode === "borough") {
      return getFeatureBorough(f) || "Unknown borough";
    }
    return f.properties.zone || f.properties.Zone || `Zone ${+f.properties.LocationID}`;
  }


 
  const vis2Rows = zoneHourly.filter(d => d.pickup_date === VIS2_DATE);
  function computeByKey(hour, vehicleType) {
    const filtered = vis2Rows.filter(d => +d.pickup_hour === +hour);

    const rows =
      vehicleType === "all"
        ? filtered
        : filtered.filter(d => d.vehicle_type === vehicleType);

    const keyFn =
      state.viewMode === "borough"
        ? d => d.borough
        : d => +d.zone_id;

    return d3.rollup(
      rows,
      rs => d3.sum(rs, r => +r.trip_count),
      keyFn
    );
  }

  function getBreakdownForFeature(f) {
    const key = getFeatureKey(f);

    const rows = vis2Rows.filter(d => {
      const sameHour = +d.pickup_hour === +state.hour;
      const sameKey =
        state.viewMode === "borough"
          ? d.borough === key
          : +d.zone_id === +key;

      return sameHour && sameKey;
    });

    const counts = d3.rollup(
      rows,
      rs => d3.sum(rs, r => +r.trip_count),
      d => d.vehicle_type
    );

    const total = d3.sum(VEHICLE_ORDER, v => counts.get(v) || 0);

    return VEHICLE_ORDER.map(v => ({
      type: v,
      label: VEHICLE_LABELS[v],
      count: counts.get(v) || 0,
      share: total > 0 ? (counts.get(v) || 0) / total : 0
    }));
  }

  function breakdownBarHtml(breakdown) {
    return `
      <div style="margin-top:8px;">
        <div style="font-weight:700;margin-bottom:4px;">Vehicle breakdown</div>
        ${breakdown.map(d => `
          <div style="display:grid;grid-template-columns:64px 90px 42px;align-items:center;gap:6px;margin:3px 0;">
            <span>${d.label}</span>
            <div style="height:8px;background:#eee;border-radius:999px;overflow:hidden;">
              <div style="height:8px;width:${d.share * 100}%;background:${VEHICLE_COLORS[d.type]};"></div>
            </div>
            <span style="text-align:right;">${d3.format(".0%")(d.share)}</span>
          </div>
        `).join("")}
      </div>
    `;
  }
  

  const byVehicleHourZone = d3.rollup(
    vis2Rows,
    rs => d3.sum(rs, r => +r.trip_count),
    d => d.vehicle_type,
    d => +d.pickup_hour,
    d => +d.zone_id
  );

  const byHourZoneAll = d3.rollup(
    vis2Rows,
    rs => d3.sum(rs, r => +r.trip_count),
    d => +d.pickup_hour,
    d => +d.zone_id
  );

function computeByZone(hour, vehicleType) {
  return computeByKey(hour, vehicleType);
}

  function computeFixedMax(vehicleType) {
    const hours = d3.range(24);

    const maxVal = d3.max(hours, hour => {
      const valuesForHour = computeByKey(hour, vehicleType);
      return d3.max([...valuesForHour.values()]) ?? 0;
    }) ?? 1;

    return Math.max(1, maxVal);
  }

  function updateColorScale(vehicleType) {
    fixedMaxVal = computeFixedMax(vehicleType);
    currentColorScale = d3.scaleSequential(d3.interpolateYlOrRd).domain([0, fixedMaxVal]);
    gradientStops.attr("stop-color", d => currentColorScale(d * fixedMaxVal));
    updateLegend(vehicleType);
  }

const mapG = svg.append("g");
const zoom = d3.zoom()
  .scaleExtent([1, 8])
  .translateExtent([[0, 0], [width, height]])
  .on("zoom", event => {
    mapG.attr("transform", event.transform);
  });

svg.call(zoom);

let mapPaths;
let mapLabels;
let hoveredFeature = null;
let lastMouseEvent = null;
function getFeatureBorough(f) {
    return (
      f.properties.borough ||
      f.properties.Borough ||
      f.properties.boro_name ||
      f.properties.BoroName ||
      f.properties.BoroName ||
      f.properties.name ||
      f.properties.NAME ||
      ""
    );
  }
function resetInfoCard() {
  selectedFeature = null;
  selectedKey = null;

  mapOverlay.select(".vis2-info-title").text("Click an area");
  mapOverlay.select(".vis2-info-body").text("Trip details will appear here.");
}
function showVis2Tooltip(event, f) {
  const key = getFeatureKey(f);
  const name = getFeatureName(f);
  const borough = getFeatureBorough(f);
  const v = byZone.get(key);
  const breakdown = getBreakdownForFeature(f);

  mapOverlay.select(".vis2-info-title").html(name);

  mapOverlay.select(".vis2-info-body").html(
    (state.viewMode === "zone"
      ? `<div><b>Zone ID:</b> ${+f.properties.LocationID}</div>`
      : "") +
    `<div><b>Borough:</b> ${borough}</div>` +
    `<div><b>View:</b> ${state.viewMode === "borough" ? "Borough" : "Taxi zone"}</div>` +
    `<div><b>Time:</b> ${state.label}</div>` +
    `<div><b>Vehicle:</b> ${getVehicleLabel(state.vehicleType)}</div>` +
    `<div><b>Trip count:</b> ${
      Number.isFinite(v) ? d3.format(",")(Math.round(v)) : "No data"
    }</div>` +
    breakdownBarHtml(breakdown)
  );
}
function drawMap() {
  const activeGeojson = getActiveGeojson();

  if (!activeGeojson || !activeGeojson.features || activeGeojson.features.length === 0) {
    console.error("Missing or invalid GeoJSON for", state.viewMode, activeGeojson);
    return;
  }
  console.log("taxiZonesGeojson", taxiZonesGeojson);
  console.log("boroughsGeojson", boroughsGeojson);
  console.log("taxi features", taxiZonesGeojson?.features?.length);
  console.log("borough features", boroughsGeojson?.features?.length);
  const projection = d3.geoIdentity()
    .reflectY(true)
    .fitExtent(
      [
        [margin.left, margin.top],
        [width - margin.right, height - margin.bottom - 46]
      ],
      taxiZonesGeojson
    );

  const path = d3.geoPath(projection);

  mapG.selectAll("path").remove();
  mapG.selectAll("text.borough-label").remove();

  mapPaths = mapG
    .selectAll("path")
    .data(activeGeojson.features)
    .join("path")
    .attr("d", path)
    .attr("stroke", "#555")
    .attr("stroke-width", state.viewMode === "borough" ? 1.1 : 0.35)
    .attr("fill", "#f2f2f2")
    .on("click", (event, f) => {
      selectedFeature = f;
      selectedKey = getFeatureKey(f);

      showVis2Tooltip(event, f);

      mapPaths
        .attr("stroke", d => getFeatureKey(d) === selectedKey ? "#575353ff" : "#484848ff")
        .attr("stroke-width", d => getFeatureKey(d) === selectedKey ? 1.8 : state.viewMode === "borough" ? 1.1 : 0.35)
        .attr("filter", d => getFeatureKey(d) === selectedKey ? "brightness(0.9)" : null);
    });
   
  // Borough outline layer for both borough and neighborhood views
  if (boroughsGeojson?.features?.length) {
    mapG
      .selectAll("path.borough-boundary")
      .data(boroughsGeojson.features)
      .join("path")
      .attr("class", "borough-boundary")
      .attr("d", path)
      .attr("fill", "none")
      .attr("stroke", "#111")
      .attr("stroke-width", state.viewMode === "borough" ? 1.6 : 1.2)
      .attr("pointer-events", "none")
      .style("opacity", state.viewMode === "borough" ? 0.45 : 0.85);
  }
  updateChoropleth();

  // Borough labels (always visible)
  if (boroughsGeojson?.features?.length) {
    mapLabels = mapG
      .selectAll("text.borough-label")
      .data(boroughsGeojson.features)
      .join("text")
      .attr("class", "borough-label")
      .attr("x", f => path.centroid(f)[0])
      .attr("y", f => path.centroid(f)[1])
      .attr("text-anchor", "middle")
      .attr("dominant-baseline", "middle")
      .attr("font-size", 14)
      .attr("font-weight", 700)
      .attr("fill", "#222")
      .attr("stroke", "white")
      .attr("stroke-width", 3)
      .attr("paint-order", "stroke")
      .style("pointer-events", "none")
      .style("opacity", state.viewMode === "borough" ? 0.9 : 0.75)
      .text(f => getFeatureBorough(f));
  }
}
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
  function refreshSelectedInfoCard() {
    if (selectedFeature) {
      showVis2Tooltip(null, selectedFeature);
    }
  }
  function updateLegend(vehicleType) {
    const includeMaxTick = vehicleType !== "all";

    const legendScale = d3.scaleLinear().domain([0, fixedMaxVal]).range([0, legendW]);

    const axisTickValues = Array.from(
      new Set(
        includeMaxTick
          ? [...legendScale.ticks(5), fixedMaxVal]
          : legendScale.ticks(5)
      )
    ).sort((a, b) => a - b);

    legendAxisG.selectAll("*").remove();

    legendAxisG
      .call(
        d3
          .axisBottom(legendScale)
          .tickValues(axisTickValues)
          .tickFormat(d => formatAdaptiveValue(d))
      )
      .call(g => g.select(".domain").remove());

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
    byZone = computeByZone(state.hour, state.vehicleType);

    const hourlyTotal = d3.sum([...byZone.values()]);
    subtitle.text(formatHourlyTotal(hourlyTotal));

    mapPaths
      .interrupt()
      .transition()
      .duration(250)
      .ease(d3.easeCubicOut)
      .attr("fill", f => {
        const key = getFeatureKey(f);
        const v = byZone.get(key);
        return Number.isFinite(v) ? currentColorScale(v) : "#f2f2f2";
      });

    updateLegend(state.vehicleType);
    if (hoveredFeature && lastMouseEvent) {
      showVis2Tooltip(lastMouseEvent, hoveredFeature);
    }
  }

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
  
  const mapOverlay = root
    .append("div")
    .attr("class", "vis2-map-overlay");

  mapOverlay.html(`
    <div class="vis2-overlay-card">
      <span class="vis2-field-label">Map view</span>
      <div class="vis2-toggle" role="group" aria-label="Map view">
        <button type="button" class="vis2-toggle-btn active" data-view="borough">Borough</button>
        <button type="button" class="vis2-toggle-btn" data-view="zone">Neighborhood</button>
      </div>
    </div>

    <div class="vis2-overlay-card vis2-zoom-section">
      <button type="button" class="vis2-zoom-btn vis2-zoom-in">+</button>
      <button type="button" class="vis2-zoom-btn vis2-zoom-out">−</button>
      <button type="button" class="vis2-zoom-btn vis2-zoom-reset">Reset</button>
    </div>
    
    <div class="vis2-overlay-card vis2-info-card">
      <div class="vis2-info-title">Hover over an area</div>
      <div class="vis2-info-body">Trip details will appear here.</div>
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
    `NYC Pickups by ${state.viewMode === "borough" ? "Borough" : "Taxi Zone"} — ${getVehicleLabel(state.vehicleType)}, ${state.label}`
  );

    updateChoropleth();
    refreshSelectedInfoCard();
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
    // stopStory()
    syncHourFromIndex(+e.target.value);
  });
  
  

  mapOverlay.selectAll(".vis2-toggle-btn").on("click", function () {
    stopPlayDay();
    // stopStory();

    state.viewMode = this.dataset.view;

    mapOverlay
      .selectAll(".vis2-toggle-btn")
      .classed("active", function () {
        return this.dataset.view === state.viewMode;
      });

    title.text(
      `NYC Pickups by ${
        state.viewMode === "borough" ? "Borough" : "Taxi Zone"
      } — ${getVehicleLabel(state.vehicleType)}, ${state.label}`
    );

    updateColorScale(state.vehicleType);
    svg.transition().duration(250).call(zoom.transform, d3.zoomIdentity);
    resetInfoCard();
    drawMap();
    updateChoropleth();
  });
  mapOverlay.select(".vis2-zoom-in").on("click", () => {
    svg.transition().duration(250).call(zoom.scaleBy, 1.4);
  });

  mapOverlay.select(".vis2-zoom-out").on("click", () => {
    svg.transition().duration(250).call(zoom.scaleBy, 1 / 1.4);
  });

  mapOverlay.select(".vis2-zoom-reset").on("click", () => {
    svg.transition().duration(250).call(zoom.transform, d3.zoomIdentity);
  });
  controls.select(".vis2-vehicle-select").on("change", e => {
    stopPlayDay();
    // stopStory();
    state.vehicleType = e.target.value;

    title.text(
      `NYC Pickups by ${state.viewMode === "borough" ? "Borough" : "Taxi Zone"} — ${getVehicleLabel(state.vehicleType)}, ${state.label}`
    );  

    updateColorScale(state.vehicleType);
    updateChoropleth();
    refreshSelectedInfoCard();
  });
  

  
    updateColorScale(state.vehicleType);
    drawMap();
    // updateChoropleth();
  }



// https://vega.github.io/vega-lite/examples/stacked_bar_weather.html

/*
  Quantitative: Numerical values you can measure and do math with.
  Nominal: Categories with no inherit order
  Ordinal: Categories with meaningful order
*/
function createVis3(data) {
    const colorScale = {
        domain: ["yellow", "green", "hvfhv", "other_fhv"],
        range: ["#f0a500", "#4caf7d", "#3d5a99", "#aaaaaa"]
    };

    const marketShareChartSpec = {
        $schema: "https://vega.github.io/schema/vega-lite/v6.json",

        data: {
            values: data
        },

        vconcat: [
            createTopRow(2020),
            createStackedBarChart()
        ]
    };


    // Embed the chart in the HTML file
    vegaEmbed('#vis3', marketShareChartSpec);
}

function createDonutChart(year) {
  const colorScale = {
        domain: ["yellow", "green", "hvfhv", "other_fhv"],
        range: ["#f0a500", "#4caf7d", "#3d5a99", "#aaaaaa"]
    };

  return {
    width: 200,
    height: 200,

    transform: [
      { filter: `datum.year === ${year}` }
    ],

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

      // 🔤 Center label (year)
      {
        mark: {
          type: "text",
          fontSize: 20,
          fontWeight: "bold",
          align: "center",
          baseline: "middle"
        },
        encoding: {
          text: { value: String(year) }
        }
      },

      // 🔤 Optional: "share" label above year (matches your reference UI)
      {
        mark: {
          type: "text",
          fontSize: 12,
          dy: -20,
          align: "center",
          baseline: "middle",
          color: "#666"
        },
        encoding: {
          text: { value: "share" }
        }
      }
    ]
  };
}

// A helper function to create custom legend for the plot
function createLegendChart(year) {
  return {
    width: 400,
    height: 200,

    transform: [
      { filter: `datum.year === ${year}` }
    ],

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

      // Labels (Uber, Yellow cab...)
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

      // Percentages (RIGHT aligned)
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

function createTopRow(year) {
  return {
    hconcat: [
      createDonutChart(year),
      createLegendChart(year)
    ],
    spacing: 40
  };
}

function createStackedBarChart() {
  return {
    width: 700,
    height: 300,

    title: "Taxi Market Share Throughout The Years",

    mark: {
      type: "bar",
      size: 18
    },

    encoding: {
      // X-axis
      x: {
        field: "year",
        type: "ordinal",
        axis: {
          title: "year",
          labelAngle: 0
        },
        scale: {
          paddingInner: 0.15,
          paddingOuter: 0.05
        }
      },

      // Y-axis: don't show it, don't need it
      y: {
        aggregate: "sum",
        field: "trip_count",
        type: "quantitative",
        stack: "normalize",
        axis: null
      },

      // Color
      color: {
        field: "taxi_type",
        type: "nominal",
        scale: colorScale,
        legend: null
      },

      // Tooltip
      tooltip: [
        { field: "year", type: "ordinal" },
        { field: "taxi_type", type: "nominal" },
        {
          aggregate: "sum",
          field: "trip_count",
          type: "quantitative",
          title: "Trips"
        }
      ]
    }
  };
}

function createVis4(bundle, chartWrapId, selectId, tooltipId, titleId, subtitleId, globalMax) {
  console.log("bundle keys:", Object.keys(bundle.types));
  const TYPE_LABELS = {
    all: "All types",
    green: "Green taxi",
    yellow: "Yellow taxi",
    other_fhv: "FHV (for-hire)",
    hvfhv: "HVFHV (high-volume / app)",
  };

  const margin = { top: 16, right: 220, bottom: 72, left: 120 };
  const innerWidth = 24 * 28;
  const innerHeight = 7 * 36;
  const width = margin.left + innerWidth + margin.right;
  const height = margin.top + innerHeight + margin.bottom;

  const wrap = d3.select("#" + chartWrapId);
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

  const tooltip = d3.select("#" + tooltipId);

  tooltip.style("opacity", 0);

  function showTooltip(html, event) {
    tooltip.style("opacity", 1).html(html);
    positionTooltip(event);
  }

  function hideTooltip() {
    tooltip.style("opacity", 0);
  }

  const selectEl = d3.select("#" + selectId);


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
      .interrupt()
      .transition()
      .delay((d) => (Number(d.hour) || 0) * baseDelay)
      .duration(480)
      .ease(d3.easeCubicOut)
      .style("opacity", 1)
      .attr("fill", (d) => color(d.count));
  }

  function updateChart(typeKey) {
    const cells = bundle.types[typeKey].cells;
    const color = d3.scaleSequential(d3.interpolateYlOrRd).domain([0, globalMax]);
    const taxiLabel = TYPE_LABELS[typeKey];
    drawLegend(globalMax, color, typeKey);
    renderCells(cells, color, taxiLabel);
  }

  const types = Object.keys(bundle.types).sort((a, b) => {
    if (a === "all") return -1;
    if (b === "all") return 1;
    return a.localeCompare(b);
  });
  const month = bundle.monthLabel;
  d3.select("#" + titleId).text("City Wake Up: Total Trips by Hour and Day of Week");
  d3.select("#" + subtitleId).text(month ? `(${month})` : "");

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








function createDifferenceHeatmap(heatmap2015, heatmap2025, selectedType = "all") {
  const container = d3.select("#vis5");

  const tooltip = d3.select("#vis5-tooltip");
    tooltip.style("opacity", 0);
    
  function showTooltip(html) {
    tooltip
      .style("opacity", 1)
      .html(html)
      .style("left", null)
      .style("top", null);
  }

  function hideTooltip() {
    tooltip.style("opacity", 0);
  }

function positionTooltip(event) {
  const pad = 12;
  let x = event.pageX + pad;
  let y = event.pageY + pad;

  const rect = tooltip.node().getBoundingClientRect();

  if (x + rect.width > window.innerWidth) {
    x = event.pageX - rect.width - pad;
  }
  if (y + rect.height > window.innerHeight) {
    y = event.pageY - rect.height - pad;
  }

  tooltip.style("left", x + "px").style("top", y + "px");
}  
  if (container.empty()) {
    console.error("Missing #vis5 container in HTML");
    return;
  }

  if (!heatmap2015.types || !heatmap2025.types) {
    console.error("Heatmap data does not have .types", heatmap2015, heatmap2025);
    return;
  }

  if (!heatmap2015.types[selectedType] || !heatmap2025.types[selectedType]) {
    console.error("Selected type missing:", selectedType);
    console.log("2015 types:", Object.keys(heatmap2015.types));
    console.log("2025 types:", Object.keys(heatmap2025.types));
    return;
  }

  const cells2015 = heatmap2015.types[selectedType].cells;
  const cells2025 = heatmap2025.types[selectedType].cells;
  console.log("2015 total:", d3.sum(cells2015, d => d.count));
  console.log("2025 total:", d3.sum(cells2025, d => d.count));
  container.selectAll("*").remove();

  const margin = { top: 60, right: 80, bottom: 50, left: 90 };
  const width = 620 - margin.left - margin.right;
  const height = 360 - margin.top - margin.bottom;

  const svg = container
    .append("svg")
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom);

  const g = svg
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  const dayOrder = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  const hours = d3.range(24);

  const dayName = dow => dayOrder[+dow - 1];

  const key = d => `${d.dow}-${+d.hour}`;

  const map2015 = new Map(cells2015.map(d => [key(d), +d.count]));
  const map2025 = new Map(cells2025.map(d => [key(d), +d.count]));
  
  const diffData = [];

  d3.range(1, 8).forEach(dow => {
    hours.forEach(hour => {
      const k = `${dow}-${hour}`;
      diffData.push({
        dow,
        day: dayName(dow),
        hour,
        diff: (map2025.get(k) || 0) - (map2015.get(k) || 0)
      });
    });
  });

  const maxAbs = d3.max(diffData, d => Math.abs(d.diff)) || 1;

  const x = d3.scaleBand()
    .domain(hours.map(String))
    .range([0, width])
    .padding(0.03);

  const y = d3.scaleBand()
    .domain(dayOrder)
    .range([0, height])
    .padding(0.03);

  const color = d3.scaleDiverging()
    .domain([-maxAbs, 0, maxAbs])
    .interpolator(t => d3.interpolateRdBu(1 - t));

  g.append("text")
    .attr("x", 0)
    .attr("y", -32)
    .attr("font-size", 20)
    .attr("font-weight", 700)
    .text("Change in Trip Volume: 2025 vs 2015");

  g.append("text")
    .attr("x", 0)
    .attr("y", -10)
    .attr("font-size", 12)
    .attr("fill", "#555")
    .text("Blue = fewer trips than 2015, red = more trips than 2015");

  g.selectAll("rect")
    .data(diffData)
    .join("rect")
    .attr("x", d => x(String(d.hour)))
    .attr("y", d => y(d.day))
    .attr("width", x.bandwidth())
    .attr("height", y.bandwidth())
    .attr("fill", d => color(d.diff))
    .attr("stroke", "white")
    .attr("stroke-width", 0.5)
    .on("mouseenter", (event, d) => {
      const direction =
        d.diff > 0 ? "more trips than 2015" :
        d.diff < 0 ? "fewer trips than 2015" :
        "no change from 2015";

      showTooltip(
        `<strong>${d.day}</strong><br/>
        Hour <strong>${d.hour}:00</strong>–<strong>${d.hour}:59</strong><br/>
        <strong>${d3.format(",")(Math.abs(d.diff))}</strong> ${direction}`
      );
    })
    .on("mouseleave", hideTooltip);





  g.append("g")
    .attr("transform", `translate(0,${height})`)
    .call(
      d3.axisBottom(x)
        .tickValues([0, 3, 6, 9, 12, 15, 18, 21, 23].map(String))
        .tickFormat(d => formatHourTickLabel(+d))
    );

  g.append("g")
    .call(d3.axisLeft(y));
}
// Load data
function init() {
    // Ensure the path points to the correct location of your generated CSV
    // d3.csv("data/market-share/taxi_trip_data_2013_2023.csv", d => ({
    //     // Use the unary plus (+) operator to convert strings to numbers
    //     year: +d.year,
    //     taxi_type: d.taxi_type,
    //     trip_count: +d.trip_count,
    //     share: +d.share
    // })).then(data => {
    //     // Call your visualization drawing functions with the formatted data
    //     createVis2(data);
    //     createVis3(data); // Note: updated from 'allData' to 'data' to use the loaded CSV
    //     createVis4(data);
    //
    //     console.log("Data Loaded Successfully:", data);
    // }).catch(error => {
    //     console.error("Error loading the CSV file:", error);
    // });
  Promise.all([
    d3.json("data/zones/taxi_zones_wgs84.geojson"),
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
    d3.csv("data/market-share/taxi_trip_data_2013_2023.csv", d => ({
        // Use the unary plus (+) operator to convert strings to numbers
        year: +d.year,
        taxi_type: d.taxi_type,
        trip_count: +d.trip_count,
        share: +d.share  })),
    d3.json("data/processed/heatmap_data_2015.json"),  // 2015
    d3.json("data/processed/heatmap_data_2025.json"),  // 2025
  ]).then(([taxiZonesGeojson, boroughsGeojson, zoneHourly, marketShare, heatmap2015, heatmap2025]) => {
    const globalMax = Math.max(
        ...Object.values(heatmap2015.types).map(t => d3.max(t.cells, d => d.count)),
        ...Object.values(heatmap2025.types).map(t => d3.max(t.cells, d => d.count))
    );
    
    createVis(zoneHourly, taxiZonesGeojson, boroughsGeojson);
    createVis3(marketShare);
    // createVis4(heatmap2015, "vis4-chart-wrap-2015", "vis4-taxi-type-2015", "vis4-tooltip-2015", "vis4-title-2015", "vis4-subtitle-2015", globalMax);
    createVis4(heatmap2025, "vis4-chart-wrap-2025", "vis4-taxi-type-2025", "vis4-tooltip-2025", "vis4-title-2025", "vis4-subtitle-2025", globalMax);
    
    createDifferenceHeatmap(heatmap2015, heatmap2025, "all");
  }).catch(error => {
    console.error("Error loading project data:", error);
  });
}





window.addEventListener("load", init);