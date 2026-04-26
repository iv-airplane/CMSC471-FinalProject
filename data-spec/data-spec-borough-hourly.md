# Data Spec: NYC Pickups by Zone Over Time (Ryley)

> **Purpose:** This document defines the data contract between the data engineering team (Aadarsh & Emily) and Ryley (choropleth map visualization). It ensures the output dataset matches exactly what the visualization requires.

---

## 1. Overview

| Field | Value |
|---|---|
| Panel | NYC pickups by zone (choropleth with time slider) |
| Visualization owner | Ryley |
| Data engineers | Aadarsh & Emily |
| Data file | `data/zone_hourly.csv` |
| Mock file due | End of week 1 (produced by Ryley) |
| Real file due | Mid-week 2 (produced by data engineers) |

---

## 2. Schema

| Column | Type | Description | Example values |
|---|---|---|---|
| `zone_id` | integer | TLC taxi zone ID | `161`, `236` |
| `borough` | string | Borough name | `Manhattan`, `Queens`, `Brooklyn` |
| `pickup_date` | date | Selected day in 2024 | `2024-10-16` |
| `pickup_hour` | integer (0–23) | Hour of day | `8`, `17`, `23` |
| `vehicle_type` | string (enum) | Taxi category | `yellow`, `green`, `hvfhv` |
| `trip_count` | integer | Total pickups for that zone/hour/type | `1243` |
| `trip_price` | float | Average fare or total fare (optional) | `18.75` |

### Column notes

- **`zone_id` must match TLC zone IDs** used in the dataset.
- **`borough` is derived**, not raw. It must be joined from `Taxi_zone_lookup.csv`.
- **`pickup_hour` must include all 24 hours (0–23)** with no gaps.
- **`vehicle_type` values are fixed.** Use exactly:
  - `yellow`
  - `green`
  - `hvfhv`
- **`trip_count` is the primary metric** used for coloring the choropleth.
- **`trip_price` is optional** but should be included if easily available for richer tooltips.

---

## 3. Time range and granularity

| Dimension | Value | Rationale |
|---|---|---|
| Date | One specific day in 2024 | Keeps visualization focused and performant |
| Granularity | Hourly | Smooth time-based interaction |
| Time range | 0–23 hours | Full daily cycle |

If the team later decides to add finer granularity (e.g., 15-minute intervals), a separate file (`data/zone_15min_2024.csv`) should be created rather than changing this schema.

---

## 4. Source data

### Raw sources

| Source | URL | Format | Covers |
|---|---|---|---|
| TLC Yellow Taxi Trip Records | https://www.nyc.gov/site/tlc/about/tlc-trip-record-data.page | Parquet | Yellow taxis |
| TLC Green Taxi Trip Records | Same page | Parquet | Green taxis |
| TLC HVFHV Trip Records | Same page | Parquet | Uber/Lyft/etc. |
| Taxi Zone Lookup | Same page | CSV | Zone → borough mapping |

### Pipeline ownership

The data engineering team (Aadarsh & Emily) owns the full pipeline: downloading raw TLC files, filtering to a single day in 2024, aggregating trips by zone and hour, mapping zones to boroughs, and exporting the final dataset. The visualization student does not need to specify how to build the pipeline — only what shape the output must have (this schema) and what questions it must answer (see visualization contract).

---

## 5. Mock data

**Owner: Ryley (the visualization student).**

The visualization student creates a mock dataset with realistic values to build and debug the visualization before real data arrives.

Example:

```csv
zone_id,borough,pickup_date,pickup_hour,vehicle_type,trip_count,trip_price
161,Manhattan,2024-10-16,8,yellow,1200,15.2
161,Manhattan,2024-10-16,9,yellow,1450,16.1
236,Manhattan,2024-10-16,8,hvfhv,2100,18.5
132,Queens,2024-10-16,8,yellow,300,22.0
```

---

## 6. Visualization contract

What Ryley promises to build against this data:

- **Primary view:** Choropleth-style map of NYC zones. Color encodes `trip_count`.
- **Time interaction:** Slider (0–23) controlling `pickup_hour`.
- **Hover tooltip:** Zone ID, borough, trip count, and optionally average price.
- **Color scale:** Sequential (light → dark), consistent across all hours.
- **Tool:** Vega-Lite or D3-based implementation.

---

## 7. Data acceptance criteria

The dataset is accepted when:

- [ ] The file parses as valid CSV with all required columns  
- [ ] `vehicle_type` contains only (`yellow`, `green`, `hvfhv`)  
- [ ] All 24 hours (0–23) exist for each zone  
- [ ] `trip_count` values are non-negative integers  
- [ ] `borough` values are correctly mapped  
- [ ] The visualization renders correctly with no code changes when mock data is replaced  

---

## 8. Known caveats

1. **Single-day snapshot.** Patterns may differ across weekdays vs weekends.
2. **HVFHV data limitations.** Ride-hail data may differ in structure from taxi data and require preprocessing alignment.
3. **Missing zones.** Some zones may have zero trips in certain hours and must still appear in the dataset.
4. **Aggregation tradeoff.** Hourly aggregation simplifies the visualization but hides finer temporal patterns.