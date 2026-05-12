# Data Processing

The TLC dataset is very large, with millions of trips recorded each month, so we first needed to process and aggregate the data before using it in our visualizations. We used DuckDB to efficiently query the raw trip-level data and generate smaller, analysis-ready datasets.

From the original data, we created several aggregated datasets:

- Trips by taxi zone, hour, and date (for the choropleth map)
- Trips by day of week and hour (for the heatmap)
- Trips by year and vehicle type (for market share trends)

One challenge we encountered was that before 2019, high-volume FHV (HVFHV) trips were not tracked separately and were grouped with other FHV trips. As ride-hailing services became more common, the data began separating these categories. To make comparisons consistent over time, we manually split FHV and HVFHV during preprocessing.

To support the spatial visualization, we used NYC taxi zone shapefiles and converted them into GeoJSON using Mapshaper so they could be rendered in the browser.

See the `DATA_README.md` files for more details about data preprocessing.

# Visualization

The visualizations are built using D3 and Vega-Lite. We use a taxi zone choropleth map to show how trip activity varies across space, a heatmap to highlight patterns across time, and a stacked bar chart with a donut chart to show changes in market share over time.

We chose a choropleth map to represent spatial patterns because it allows for easy comparison across zones, and a heatmap to show dense temporal patterns without clutter. The market share visualization uses normalized stacked bars to emphasize proportions rather than absolute values.

Interactive elements such as sliders, dropdowns, and tooltips allow users to explore different time periods and vehicle types, making it easier to compare patterns and understand how transportation activity changes across the city.

# Design Decisions

## Three time scales, three charts

The single hardest call early on was whether to build one ambitious view or several smaller, focused ones. We chose three because the dataset answers three different questions at three different time scales, and stretching a single chart across all of them would force us to either average out the weekly patterns — the choropleth would just show a generic Manhattan blob — or hide the decade-long market shift, which is invisible in any one day.

The trade-off is that readers have to jump between views; the upside is each view is honest about what it’s showing.

## One color palette, four meanings

Yellow (`#f0a500`), green (`#4caf7d`), HVFHV blue (`#3d5a99`), and gray (`#aaaaaa`) for other-FHV are reused identically across all three visualizations.

Yellow and green are the obvious choices — they match the actual cabs. Blue for HVFHV reads as “tech / app” without being a literal Uber or Lyft brand color, which we wanted to avoid because the category includes both.

Gray is intentionally muted: “other FHV” is a residual category and we don’t want it competing visually with the three categories the reader actually cares about.

## Why a Wednesday in October for the choropleth

The map shows a single 24-hour period: Wednesday, October 16, 2025. We picked it deliberately.

It is mid-week (no Monday or Friday weekend-tail effects), mid-fall (schools in session, no major holiday nearby, no severe weather in the historical record), and recent enough to reflect the post-pandemic, ride-hail-dominated city, but before congestion pricing took effect on January 5, 2025.

In other words: as close to a “typical” modern NYC day as we can pick.

## A full month for the heatmap, a multi-year span for market share

The hour × day heatmap aggregates a whole month so that no single weather event or news day dominates a cell, and so every `(day, hour)` bucket has enough trips to be a stable estimate.

The market-share chart, by contrast, is intentionally coarse — one row per year per vehicle type. Anything finer would just add noise to a story that is fundamentally about a slow, decade-long structural shift.

## Sequential color for counts, categorical color for types

Inside any one visualization where we are encoding a single quantity — trip counts on the choropleth, trip counts on the heatmap — we use a sequential color ramp from light to dark so brighter cells unambiguously mean more trips.

The four-color categorical palette only appears where we are comparing vehicle types (the market-share chart and the type selector on the heatmap).

Mixing the two encodings in the same view would be confusing.

# Work Breakdown and Responsibilities

### Ivan
- Developed the market share visualization end-to-end, including implementation, interactions, annotations, and the write-up.
- Led repository coordination, including code reviews, pull request management, merges, and integration of visualization components across the project.
- Coordinated project planning, task organization, team meetings, and overall development workflow throughout the project lifecycle.

### Dwarakesh Baraneetharan
- Implemented **vis4** (hour × weekday **heatmap** of TLC trip volumes: D3 scales, sequential color scale and **colorbar** legend, vehicle-type control, tooltips, and integration with preprocessed JSON)
- Aligned **vis5** (2015 vs 2025 **difference heatmap**) with the same grid size, axes, **diverging colorbar**, and **tooltip** behavior
- **Proofread and edited** the main project **webpage** copy (`index.html`) for narrative flow, accuracy (including time windows for each view), and consistency with the dataset
- Contributed to **implementation** / **README** documentation as needed

### Aadarsh
- Updated scale for heatmap visualization, implemented automatic max calculation and tool tips in gradient legend for both heatmap and cholorpleth map.
- Helped write some of the of the writeup on the webpage

### Ryley
- Implemented the choropleth visualization, including animation across the day, and established the initial visualization structure using GeoJSON data.
- Improved visualization integration and consistency across the webpage layout 
- Aided write-up refinement and documentation
- Contributed to project planning discussions, visualization design decisions, and refinement of user interaction features.