(function () {
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

  const wrap = d3.select("#chart-wrap");
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

  const tooltip = d3.select("#tooltip");
  const selectEl = d3.select("#taxi-type");

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

  function updateChart(bundle, typeKey) {
    const cells = bundle.types[typeKey].cells;
    const maxC = d3.max(cells, (d) => d.count) || 1;
    const color = d3.scaleSequential(d3.interpolateYlOrRd).domain([0, maxC]);
    const taxiLabel = TYPE_LABELS[typeKey];
    drawLegend(maxC, color);
    renderCells(cells, color, taxiLabel);
  }

  d3.json("heatmap_data.json").then((bundle) => {
    const types = Object.keys(bundle.types).sort((a, b) => {
      if (a === "all") return -1;
      if (b === "all") return 1;
      return a.localeCompare(b);
    });
    const month = bundle.monthLabel;
    d3.select("#title").text("City Wake Up: Total Trips by Hour and Day of Week");
    d3.select("#subtitle").text(month ? `(${month})` : "");

    selectEl
      .selectAll("option")
      .data(types)
      .join("option")
      .attr("value", (d) => d)
      .text((d) => TYPE_LABELS[d]);

    selectEl.property("value", types[0]);
    updateChart(bundle, types[0]);

    selectEl.on("change", function () {
      updateChart(bundle, this.value);
    });
  });
})();
