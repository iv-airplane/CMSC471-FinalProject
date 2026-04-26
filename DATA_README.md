# Data Processing Pipeline README

## Project Overview

This project processes NYC Taxi and Limousine Commission (TLC) trip data into cleaned, aggregated datasets for two visualization panels:

1. **Yearly Market Share (Ivan)**

   * Output: `data/processed/yearly_market_share.csv`
   * Purpose: Stacked bar chart showing long-term market share changes between taxis and ride-hail services

2. **Zone Hourly Choropleth (Ryley)**

   * Output: `data/processed/zone_hourly.csv`
   * Purpose: Interactive choropleth map of NYC taxi pickups by zone with an hourly time slider

3. **Visualization 3 (Dwarakesh)**

   * Output: `data/processed/weekly_heatmap.csv`
   * Purpose: ________________________________

The goal is to ensure visualization teammates can replace mock data with real data using the exact same schema and no code changes.

---

## Folder Structure

```text
/data
  /raw
    /yellow        # Yellow taxi parquet files
    /green         # Green taxi parquet files
    /hvfhv         # High-volume for-hire vehicle parquet files
    /fhv           # Traditional for-hire vehicle parquet files
    /zones         # Taxi zone lookup CSV

  /processed
    zone_hourly.csv
    yearly_market_share.csv

/scripts
  preprocess_tlc.py
```

---

## Raw Data Sources

All trip data comes from NYC TLC Trip Record Data:

[https://www.nyc.gov/site/tlc/about/tlc-trip-record-data.page](https://www.nyc.gov/site/tlc/about/tlc-trip-record-data.page)

## Map Geometry Sources (GeoJSON)

### NYC Borough Boundaries (used by `vis2`)

- **Local file**: `data/choropleth/nyc_boroughs.geojson`
- **Downloaded from**: `dwillis/nyc-maps` on GitHub (file `boroughs.geojson`)
- **Direct source URL**: `https://raw.githubusercontent.com/dwillis/nyc-maps/master/boroughs.geojson`
- **Notes**: Contains 5 borough polygons with properties including `BoroName` (e.g. `Manhattan`, `Queens`).

### Yellow Taxi

* Monthly parquet files
* Used for both zone-level aggregation and yearly market share

### Green Taxi

* Monthly parquet files
* Used for both outputs

### HVFHV

* High-Volume For-Hire Vehicles
* Includes Uber, Lyft, Via, and Juno
* Dedicated TLC dataset beginning in 2019

### FHV

* Traditional For-Hire Vehicles
* Includes black cars, liveries, luxury limousines, and dispatch-based services

### Taxi Zone Lookup

* CSV mapping `LocationID -> Borough`
* Used to attach borough labels to taxi zones

---

# Output 1: zone_hourly.csv

## Purpose

Supports the choropleth map visualization with a time slider across a single selected day.

## Output File

```text
data/processed/zone_hourly.csv
```

## Schema

| Column       | Description                    |
| ------------ | ------------------------------ |
| zone_id      | TLC taxi zone ID               |
| borough      | Borough name from lookup table |
| pickup_date  | Selected day                   |
| pickup_hour  | Hour of day (0–23)             |
| vehicle_type | yellow / green / hvfhv         |
| trip_count   | Number of pickups              |
| trip_price   | Average fare (optional)        |

## Processing Steps

1. Read yellow, green, and HVFHV parquet files
2. Standardize pickup datetime columns
3. Filter to one selected day
4. Extract pickup hour
5. Group by zone, date, hour, and vehicle type
6. Compute trip count and average fare
7. Join borough names using taxi zone lookup
8. Fill missing zone/hour combinations with zero trips
9. Export final CSV

## Validation Rules

* Must include all 24 hours (0–23)
* Must include zero-trip zones
* Vehicle types must be exactly:

  * yellow
  * green
  * hvfhv

---

# Output 2: yearly_market_share.csv

## Purpose

Supports stacked bar and donut chart views showing transportation market share over time.

## Output File

```text
data/processed/yearly_market_share.csv
```

## Schema

| Column     | Description                        |
| ---------- | ---------------------------------- |
| year       | Calendar year                      |
| taxi_type  | yellow / green / hvfhv / other_fhv |
| trip_count | Total yearly trips                 |
| share      | Fraction of yearly total           |

## Processing Steps

1. Read yearly trip counts from:

   * yellow taxi files
   * green taxi files
   * HVFHV files
   * FHV files
2. Aggregate trips by year
3. Assign taxi categories
4. Create complete year × taxi_type combinations
5. Fill missing values with zero
6. Compute yearly totals
7. Calculate:

```text
share = trip_count / total trips that year
```

8. Export final CSV

## Validation Rules

* Every year must have exactly 4 rows
* Shares must sum to approximately 1.0 per year
* Vehicle types must be exactly:

  * yellow
  * green
  * hvfhv
  * other_fhv

---

# Methodology Note: HVFHV vs FHV Classification

## Why This Is Difficult

Separating traditional For-Hire Vehicles (FHV) from High-Volume For-Hire Vehicles (HVFHV) is the most important methodological challenge in building `yearly_market_share.csv`.

### FHV

Traditional FHV includes:

* black cars
* liveries
* luxury limousines
* dispatch-only car services

These are not street-hailed taxis.

### HVFHV

HVFHV is a specific subset of FHV and includes major ride-hail platforms such as:

* Uber
* Lyft
* Via
* Juno

These companies generate significantly higher trip volume and are tracked separately by TLC in newer datasets.

---

## The Core Problem

TLC only publishes a dedicated HVFHV dataset beginning in 2019.

Before 2019:

* Uber and Lyft were already active in NYC
* but their trips were mixed inside the broader FHV dataset

This means pre-2019 market share cannot be computed by simply reading a separate HVFHV file.

---

## Final Methodology Used

### 2019 and Later

For 2019 onward, we use the dedicated HVFHV parquet files directly.

These files contain:

* `hvfhs_license_num`
* `dispatching_base_num`

where:

* `HV0002` = Juno
* `HV0003` = Uber
* `HV0004` = Via
* `HV0005` = Lyft

This provides direct identification of ride-hail trips.

---

### Pre-2019 and Historical FHV Split

To estimate historical HVFHV volume, we first extract all dispatching base numbers associated with official HVFHS license holders (`HV0002–HV0005`) from the dedicated HVFHV dataset.

Examples include:

* `B02510`, `B02844` → Lyft
* `B02864`, `B02764`, `B02872`, `B02887`, `B03404`, `B03406` → Uber / dominant HV bases
* `B02800`, `B03136` → Via
* `B02914`, `B02907` → Juno

This creates an authoritative list of high-volume dispatching bases.

We then classify FHV trips using:

```text
if dispatching_base_num ∈ HV base list
→ hvfhv
else
→ other_fhv
```

This is stronger than treating all FHV as `other_fhv`, and more accurate than relying only on `SR_Flag` (shared ride flag).

`SR_Flag` is used as validation rather than the primary classification rule.

---

## Important Caveat

Because `dispatching_base_num` reflects TLC operating entities rather than individual rider-facing platforms, some affiliated bases may still include a small amount of traditional FHV activity.

As a result, the base-number classification may slightly overestimate HVFHV volume in earlier transition years (especially 2015–2018).

However, this is generally preferable to severely underestimating ride-hail volume by classifying all FHV trips as traditional FHV.

This methodology produces a more realistic long-term market share trend and better reflects the rise of Uber and Lyft in NYC transportation.

---

## GitHub Repository Note

Large raw TLC trip files are intentionally not included in the GitHub repository.

This includes:

* `data/raw/`
* all `.parquet` files
* large temporary processing files

These files are excluded using `.gitignore` because:

* TLC parquet files are extremely large and exceed practical GitHub limits
* raw data can be re-downloaded directly from the official TLC source
* the repository should focus on reproducible code, documentation, and final output schemas rather than storing raw source files

The GitHub repository should include:

* preprocessing scripts (`scripts/`)
* README documentation
* schema definitions
* lightweight processed outputs if needed
* visualization-facing CSV outputs

but should not include raw monthly parquet downloads.

This keeps the repository lightweight, reproducible, and easier for collaborators to manage.

If any preprocessing needs to be rerun or updated, Emily will handle the pipeline locally using the raw parquet files, regenerate the required processed datasets, and then push the updated output CSV files and code changes to the shared GitHub repository.

---

## Running the Pipeline

From the project root:

```bash
python scripts/preprocess_tlc.py
```

This will:

1. Generate both processed CSV files
2. Run validation checks
3. Print confirmation messages

---

## Team Ownership

### Data Engineering

### Emily

Responsible for preprocessing and pipeline development for:

* Visualization 1: Yearly Market Share (Ivan)
* Visualization 2: Zone Hourly Choropleth (Ryley)

This included:

* downloading and organizing raw TLC data
* building reproducible preprocessing pipelines
* aggregation and validation
* methodology documentation
* handling historical HVFHV vs FHV classification

### Aadarsh

Responsible for:

* reviewing and refining preprocessing logic
* validating methodology decisions
* helping debug and improve the more complex HVFHV vs FHV market share classification
* leading preprocessing and data preparation for Visualization 3 (Dwarakesh)

### Visualization Students

Responsible for:

* building visualizations against mock files
* verifying compatibility with final outputs

The final real dataset must match the agreed schema exactly so the visualization works without code changes.

