# Data Spec: Market Share Over Time (Ivan)

> **Purpose:** This document defines the data contract between the data engineering team (Aadarsh & Emily) and Ivan (market share visualization). It can be used as a template by other visualization experts.

---

## 1. Overview

| Field | Value |
|---|---|
| Panel | Market share: medallion taxis vs. high-volume for-hire vehicles |
| Visualization owner | Ivan |
| Data engineers | Aadarsh & Emily |
| Data file | `data/yearly_market_share.csv` |
| Mock file due | End of week 1 (produced by Ivan) |
| Real file due | Mid-week 2 (produced by data engineers) |
| Approximate row count | ~40 rows |
| Approximate file size | < 5 KB |

---

## 2. Schema

| Column | Type | Description | Example values |
|---|---|---|---|
| `year` | integer | Calendar year | `2015`, `2019`, `2023` |
| `taxi_type` | string (enum) | Category of vehicle | `yellow`, `green`, `hvfhv`, `other_fhv` |
| `trip_count` | integer | Total trips for that year and type | `170000000` |
| `share` | float (0–1) | Fraction of all trips that year | `0.45` |

### Column notes

- **`taxi_type` values are fixed.** Use exactly the four strings above everywhere in the project. Do not abbreviate, capitalize, or rename.
  - `yellow` — Medallion yellow cabs.
  - `green` — Street-hail livery (Boro Taxis), introduced 2013.
  - `hvfhv` — High-Volume For-Hire Vehicles (Uber, Lyft, Via, Juno).
  - `other_fhv` — Traditional black cars, liveries, luxury limos.
- **`share` is derived, not raw.** Computed as `trip_count / sum(trip_count) for that year`. Must sum to 1.0 (±0.01 rounding tolerance) for each year.
- **`trip_count` is the total for the full calendar year.** Partial years (e.g., the latest year if incomplete) should be noted in `data/README.md` but still included.

---

## 3. Time range and granularity

| Dimension | Value | Rationale |
|---|---|---|
| Start year | 2015 | Uber had meaningful market share by 2015; earlier years have messy FHV data and negligible ride-hail volume |
| End year | Latest full year available - 2025 when congestion pricing was introduced | Use the most recent complete calendar year |
| Granularity | One row per year per taxi type | Finer granularity (monthly) is not needed for this panel |

If the team later decides to add a monthly drill-down, a separate file (`data/monthly_market_share.csv`) should be created rather than changing this schema.

---

## 4. Source data

### Raw sources

| Source | URL | Format | Covers |
|---|---|---|---|
| TLC Yellow Taxi Trip Records | https://www.nyc.gov/site/tlc/about/tlc-trip-record-data.page | Parquet (monthly files) | Yellow cabs, all years |
| TLC Green Taxi Trip Records | Same page | Parquet | Green cabs, 2015–present |
| TLC FHV Trip Records | Same page | Parquet / CSV | All for-hire vehicles pre-2019; traditional FHV post-2019 |
| TLC HVFHV Trip Records | Same page | Parquet | Uber/Lyft/etc., Feb 2019–present |

### Pipeline ownership

The data engineering team (Aadarsh & Emily) owns the full pipeline: downloading raw TLC files, researching how to distinguish HVFHV from other FHV in pre-2019 data, handling edge cases, computing the aggregations, and documenting their methodology. The visualization student does not need to specify *how* to build the pipeline — only *what shape the output must have* (this schema) and *what questions the output must answer* (the visualization contract below).

The data engineers should keep their pipeline scripts in `scripts/` and document their approach and any methodological decisions in `data/README.md`.

---

## 5. Mock data

**Owner: Ivan (the visualization student).**

The visualization student creates their own mock file against this schema by end of week 1. The mock should have the right column names, plausible magnitudes, and the full year range, so the visualization can be built and debugged before real data arrives. This is the viz student's responsibility because they know best what data shapes will exercise their chart's edge cases (very small shares, zero values, the COVID dip, etc.).

When the data engineers deliver the real file in week 2, it must match this schema exactly so the swap is a file rename with zero code changes. If the real data reveals that the schema needs to change, both sides discuss and update this spec first.

Example mock rows:

```csv
year,taxi_type,trip_count,share
2015,yellow,145000000,0.68
2015,green,9000000,0.04
2015,hvfhv,52000000,0.24
2015,other_fhv,7000000,0.03
2016,yellow,130000000,0.58
2016,green,9000000,0.04
2016,hvfhv,75000000,0.34
2016,other_fhv,8000000,0.04
2017,yellow,110000000,0.45
2017,green,8000000,0.03
2017,hvfhv,118000000,0.48
2017,other_fhv,9000000,0.04
```

---

## 6. Visualization contract

What Ivan promises to build against this data:

- **Primary view:** Stacked bar chart. X-axis = `year`. Y-axis = `share` (0–1). Stacked by `taxi_type`. Colors per style guide: yellow `#EF9F27`, green `#1D9E75`, hvfhv `#185FA5`, other_fhv `#888780`.
- **Secondary view:** Donut chart for the selected year, driven by click on any bar in the stacked chart.
- **Annotations:** At minimum, "Uber active since ~2011, data starts here" (2015), "COVID" (2020). Rendered as vertical rule marks or text labels on the stacked bar.
- **Hover tooltip:** Year, taxi type, trip count (formatted with commas), share (formatted as percentage).
- **Tool:** Vega-Lite. Two separate specs embedded in the shared HTML layout, connected by a small JavaScript listener on Vega's `signal` API.

---

## 7. Data Acceptance criteria

The real data file is accepted when both the data engineers and the visualization student verify:

- [ ] The file parses as valid CSV with the four columns above.
- [ ] `taxi_type` contains only the four allowed values (`yellow`, `green`, `hvfhv`, `other_fhv`).
- [ ] `share` sums to 1.0 (±0.01) for every `year`.
- [ ] Every year from 2015 to the latest complete year has exactly four rows.
- [ ] `trip_count` values are non-negative integers.
- [ ] The file is committed to `data/yearly_market_share.csv` in the repo.
- [ ] A pipeline script that reproduces the file is committed to `scripts/`.
- [ ] The existing visualization renders correctly with no code changes when the mock is replaced.

---

## 8. Known caveats

These should be researched and documented by the data engineers in `data/README.md`:

1. **Data starts at 2015.** Uber was active in NYC from ~2011 but ride-hail volume was negligible and FHV data quality is poor before 2015. The visualization should note this context for the viewer.
2. **HVFHV as a separate TLC file began Feb 2019.** Pre-2019 ride-hail data requires extraction from the general FHV file. The data engineers own the methodology for this split and should document it.
3. **COVID collapse in 2020.** Total trip counts dropped ~65%. Shares shifted because different taxi types recovered at different rates.
4. **"Other FHV" is a residual category.** The data engineers should document what it includes and excludes.
5. **Lyft is grouped into `hvfhv`, not broken out separately.** If the team later wants an Uber/Lyft split, update this spec first and agree on new `taxi_type` enum values.


| File | Viz owner | Key dimensions |
|---|---|---|
| `data/yearly_market_share.csv` | Ivan | `year`, `taxi_type` |
| `data/borough_hourly.csv` | Ryley | `borough`, `day_of_week`, `hour`, `taxi_type` |
| `data/weekly_heatmap.csv` | Dwarakesh | `day_of_week`, `hour`, `taxi_type` |
