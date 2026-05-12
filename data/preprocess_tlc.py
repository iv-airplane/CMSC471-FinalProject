import json

import pandas as pd
import duckdb
from pathlib import Path

# Input and output folders used throughout the script.
# Raw parquet files are expected under data/raw, and generated files go to data/processed.
RAW_DIR = Path("data/raw")
PROCESSED_DIR = Path("data/processed")
PROCESSED_DIR.mkdir(parents=True, exist_ok=True)

# Main settings for the outputs.
# The choropleth uses one selected day, while market share is built across a range of years.
SELECTED_DATE = "2025-10-16"
START_YEAR = 2015
END_YEAR = 2025

# Settings for the hour x weekday heatmap output.
# These stems match the January 2026 parquet files used for the heatmap view.
HEATMAP_MONTH_LABEL = "Jan 2026"
HEATMAP_TYPE_SPECS: dict[str, tuple[str, str]] = {
    "green_tripdata_2026-01": ("green", "lpep_pickup_datetime"),
    "yellow_tripdata_2026-01": ("yellow", "tpep_pickup_datetime"),
    "fhv_tripdata_2026-01": ("fhv", "pickup_datetime"),
    "fhvhv_tripdata_2026-01": ("fhvhv", "pickup_datetime"),
}



# ============================================================
# Helpers
# ============================================================

def parquet_glob(folder_name):
    """Return the path pattern DuckDB should use to read all parquet files in a folder."""
    return str(RAW_DIR / folder_name / "*.parquet")


def file_exists_in_folder(folder_name):
    """Check that the folder exists and has at least one parquet file before querying it."""
    folder = RAW_DIR / folder_name
    return folder.exists() and any(folder.glob("*.parquet"))




def heatmap_parquet_path(stem):
    """Return the expected parquet path for one monthly heatmap file."""
    return RAW_DIR / f"{stem}.parquet"


def heatmap_file_exists(stem):
    """Check whether a monthly heatmap parquet file exists before reading it."""
    return heatmap_parquet_path(stem).exists()


def safe_duckdb_query(query):
    """Run a DuckDB query and return an empty dataframe if the query fails."""
    try:
        return duckdb.query(query).to_df()
    except Exception as e:
        print(f"DuckDB query failed:\n{e}")
        return pd.DataFrame()


# ============================================================
# Output 1: zone_hourly.csv
# Ryley's choropleth map
# ============================================================

def zone_hourly_query(path, pickup_col, zone_col, price_col, vehicle_type, selected_date):
    """
    Build the SQL query for hourly trip counts by pickup zone.

    The column names differ slightly by vehicle type, so they are passed in as arguments
    instead of hard-coded inside the query.
    """
    return f"""
    SELECT
        CAST({zone_col} AS INTEGER) AS zone_id,
        CAST(DATE({pickup_col}) AS VARCHAR) AS pickup_date,
        CAST(HOUR({pickup_col}) AS INTEGER) AS pickup_hour,
        '{vehicle_type}' AS vehicle_type,
        COUNT(*) AS trip_count,
        AVG({price_col}) AS trip_price
    FROM read_parquet('{path}')
    WHERE DATE({pickup_col}) = DATE '{selected_date}'
      AND {zone_col} IS NOT NULL
    GROUP BY
        zone_id,
        pickup_date,
        pickup_hour,
        vehicle_type
    """


def build_zone_hourly(selected_date=SELECTED_DATE):
    """Create zone_hourly.csv for the map visualization."""
    parts = []

    # Each vehicle type has its own pickup datetime and fare column names.
    # Query whichever folders are available so the script can still run with partial data.
    if file_exists_in_folder("yellow"):
        yellow = safe_duckdb_query(
            zone_hourly_query(
                parquet_glob("yellow"),
                "tpep_pickup_datetime",
                "PULocationID",
                "fare_amount",
                "yellow",
                selected_date
            )
        )
        parts.append(yellow)

    if file_exists_in_folder("green"):
        green = safe_duckdb_query(
            zone_hourly_query(
                parquet_glob("green"),
                "lpep_pickup_datetime",
                "PULocationID",
                "fare_amount",
                "green",
                selected_date
            )
        )
        parts.append(green)

    if file_exists_in_folder("hvfhv"):
        hvfhv = safe_duckdb_query(
            zone_hourly_query(
                parquet_glob("hvfhv"),
                "pickup_datetime",
                "PULocationID",
                "base_passenger_fare",
                "hvfhv",
                selected_date
            )
        )
        parts.append(hvfhv)

    if file_exists_in_folder("fhv"):
        other_fhv = safe_duckdb_query(
            zone_hourly_query(
                parquet_glob("fhv"),
                "pickup_datetime",
                "PUlocationID",
                "SR_Flag",   # placeholder price col; FHV does not really have fare
                "other_fhv",
                selected_date
            )
        )
        other_fhv["trip_price"] = None
        parts.append(other_fhv)

    if not parts:
        raise ValueError("No trip data found for zone_hourly.csv")

    # Combine the results from all vehicle types into one dataframe.
    grouped = pd.concat(parts, ignore_index=True)

    # Add borough information using the taxi zone lookup table.
    zones_path = Path("data") / "zones" / "taxi_zone_lookup.csv"
    zones = pd.read_csv(zones_path)

    zones = zones.rename(columns={
        "LocationID": "zone_id",
        "Borough": "borough"
    })

    zones["zone_id"] = zones["zone_id"].astype(int)

    # Build a complete grid of every zone, hour, and vehicle type.
    # This keeps the visualization stable even when a combination has zero trips.
    all_zone_ids = zones["zone_id"].unique()
    all_hours = range(24)
    all_vehicle_types = ["yellow", "green", "hvfhv", "other_fhv"]

    full_index = pd.MultiIndex.from_product(
        [all_zone_ids, [selected_date], all_hours, all_vehicle_types],
        names=["zone_id", "pickup_date", "pickup_hour", "vehicle_type"]
    ).to_frame(index=False)

    # Merge the actual trip counts onto the full grid.
    # Missing rows after the merge represent zero trips for that zone/hour/type.
    final = full_index.merge(
        grouped,
        on=["zone_id", "pickup_date", "pickup_hour", "vehicle_type"],
        how="left"
    )

    final = final.merge(
        zones[["zone_id", "borough"]],
        on="zone_id",
        how="left"
    )

    final["trip_count"] = final["trip_count"].fillna(0).astype(int)
    final["trip_price"] = final["trip_price"].round(2)

    # Keep the final file in the exact column order expected by the frontend.
    final = final[
        [
            "zone_id",
            "borough",
            "pickup_date",
            "pickup_hour",
            "vehicle_type",
            "trip_count",
            "trip_price"
        ]
    ]

    output_path = PROCESSED_DIR / "zone_hourly.csv"
    final.to_csv(output_path, index=False)

    print(f"Saved {output_path}")


# ============================================================
# Output 2: yearly_market_share.csv
# Ivan's market share chart
# ============================================================

def yearly_count_query(path, pickup_col, taxi_type):
    """Count trips by year for one vehicle category."""
    return f"""
    SELECT
        CAST(YEAR({pickup_col}) AS INTEGER) AS year,
        '{taxi_type}' AS taxi_type,
        COUNT(*) AS trip_count
    FROM read_parquet('{path}')
    WHERE {pickup_col} IS NOT NULL
    GROUP BY year
    """


def get_hv_base_list_from_hvfhv():
    """
    Build authoritative high-volume base list from HVFHV files.

    HV0002 = Juno
    HV0003 = Uber
    HV0004 = Via
    HV0005 = Lyft

    These base numbers are later used to separate older FHV records into
    ride-hail/high-volume trips versus other for-hire vehicle trips.
    """

    query = f"""
    SELECT DISTINCT
        dispatching_base_num
    FROM read_parquet('{parquet_glob("hvfhv")}')
    WHERE hvfhs_license_num IN ('HV0002', 'HV0003', 'HV0004', 'HV0005')
      AND dispatching_base_num IS NOT NULL
      AND dispatching_base_num != '\\N'
    ORDER BY dispatching_base_num
    """

    df = safe_duckdb_query(query)

    hv_bases = df["dispatching_base_num"].dropna().unique().tolist()

    print("\nAUTHORITATIVE HV BASE LIST")
    print(f"Number of HV bases found: {len(hv_bases)}")
    print(hv_bases)

    return hv_bases


def fhv_split_query(path, hv_bases):
    """
    Split FHV trips into:
    - hvfhv if dispatching_base_num appears in authoritative HV base list
    - other_fhv otherwise
    """

    if not hv_bases:
        raise ValueError("HV base list is empty. Cannot split FHV data.")

    # Format the base list so it can be used inside the SQL IN (...) clause.
    base_list = ", ".join([f"'{b}'" for b in hv_bases])

    return f"""
    SELECT
        CAST(YEAR(pickup_datetime) AS INTEGER) AS year,
        CASE
            WHEN dispatching_base_num IN ({base_list})
                THEN 'hvfhv'
            ELSE 'other_fhv'
        END AS taxi_type,
        COUNT(*) AS trip_count
    FROM read_parquet('{path}')
    WHERE pickup_datetime IS NOT NULL
    GROUP BY year, taxi_type
    """


def build_yearly_market_share(start_year=2015, end_year=2025):
    """Create yearly_market_share.csv showing each vehicle type's share by year."""
    parts = []

    # Yellow taxis
    if file_exists_in_folder("yellow"):
        yellow = safe_duckdb_query(
            yearly_count_query(
                parquet_glob("yellow"),
                "tpep_pickup_datetime",
                "yellow"
            )
        )
        print("\nYELLOW COUNTS")
        print(yellow)
        parts.append(yellow)

    # Green taxis
    if file_exists_in_folder("green"):
        green = safe_duckdb_query(
            yearly_count_query(
                parquet_glob("green"),
                "lpep_pickup_datetime",
                "green"
            )
        )
        print("\nGREEN COUNTS")
        print(green)
        parts.append(green)

    # Dedicated HVFHV files are used directly and also provide the base list
    # needed to classify older FHV data.
    if file_exists_in_folder("hvfhv"):
        hvfhv = safe_duckdb_query(
            yearly_count_query(
                parquet_glob("hvfhv"),
                "pickup_datetime",
                "hvfhv"
            )
        )
        print("\nDEDICATED HVFHV COUNTS")
        print(hvfhv)
        parts.append(hvfhv)

        hv_bases = get_hv_base_list_from_hvfhv()
    else:
        hv_bases = []

    # Older FHV files can include both high-volume ride-hail bases and other FHV bases,
    # so they need to be split before calculating market share.
    if file_exists_in_folder("fhv"):
        if hv_bases:
            fhv_split = safe_duckdb_query(
                fhv_split_query(
                    parquet_glob("fhv"),
                    hv_bases
                )
            )
        else:
            # If no HVFHV files exist, there is no reliable base list to split with,
            # so all FHV trips are kept as other_fhv.
            fhv_split = safe_duckdb_query(
                yearly_count_query(
                    parquet_glob("fhv"),
                    "pickup_datetime",
                    "other_fhv"
                )
            )

        print("\nFHV SPLIT COUNTS")
        print(fhv_split)
        parts.append(fhv_split)

    if not parts:
        raise ValueError("No trip data found for yearly_market_share.csv")

    yearly = pd.concat(parts, ignore_index=True)

    print("\nBEFORE GROUPING")
    print(yearly.sort_values(["year", "taxi_type"]))

    # Combine duplicate year/type rows, which can happen when multiple folders
    # contribute to the same vehicle category.
    yearly = (
        yearly.groupby(["year", "taxi_type"], as_index=False)["trip_count"]
        .sum()
    )

    yearly = yearly[
        (yearly["year"] >= start_year) &
        (yearly["year"] <= end_year)
    ]

    print("\nAFTER YEAR FILTER")
    print(yearly.sort_values(["year", "taxi_type"]))

    # Force every year to have the same four taxi_type rows.
    # This makes the stacked market share chart easier to draw consistently.
    all_years = range(start_year, end_year + 1)
    all_types = ["yellow", "green", "hvfhv", "other_fhv"]

    full_index = pd.MultiIndex.from_product(
        [all_years, all_types],
        names=["year", "taxi_type"]
    ).to_frame(index=False)

    yearly = full_index.merge(
        yearly,
        on=["year", "taxi_type"],
        how="left"
    )

    yearly["trip_count"] = yearly["trip_count"].fillna(0).astype(int)

    # Calculate each vehicle type's share of total trips for that year.
    yearly["year_total"] = yearly.groupby("year")["trip_count"].transform("sum")
    yearly["share"] = yearly["trip_count"] / yearly["year_total"]
    yearly["share"] = yearly["share"].fillna(0).round(4)

    yearly = yearly[
        [
            "year",
            "taxi_type",
            "trip_count",
            "share"
        ]
    ]

    output_path = PROCESSED_DIR / "yearly_market_share.csv"
    yearly.to_csv(output_path, index=False)

    print(f"\nSaved {output_path}")
    print(yearly)


# ============================================================
# Output 3: heatmap_data.json
# Hour x weekday trip volume heatmap
# ============================================================

def full_grid(rows):
    """Fill in all 24 hours for all 7 weekdays, using 0 when no trips appear."""
    counts_by_cell = {}

    for hour, dow, count in rows:
        counts_by_cell[(hour, dow)] = int(count)

    cells = []
    for dow in range(1, 8):
        for hour in range(24):
            cells.append({
                "dow": dow,
                "hour": hour,
                "count": counts_by_cell.get((hour, dow), 0)
            })

    return cells


def aggregate_heatmap_file(parquet_path, pickup_col):
    """Aggregate one parquet file into hour x weekday counts for the heatmap."""
    path_sql = str(parquet_path).replace("\\", "/")

    query = f"""
    SELECT
      EXTRACT(hour FROM t.{pickup_col})::INTEGER AS hr,
      EXTRACT(isodow FROM t.{pickup_col})::INTEGER AS isodow,
      COUNT(*)::BIGINT AS cnt
    FROM read_parquet('{path_sql}') AS t
    WHERE t.{pickup_col} IS NOT NULL
    GROUP BY 1, 2
    """

    con = duckdb.connect(database=":memory:")
    rows = con.execute(query).fetchall()
    con.close()

    return full_grid(rows)


def sum_cell_grids(grids):
    """Add several vehicle-type heatmap grids together to create the all-types view."""
    if not grids:
        return full_grid([])

    combined = []

    for i in range(len(grids[0])):
        dow = grids[0][i]["dow"]
        hour = grids[0][i]["hour"]
        total = sum(int(grid[i]["count"]) for grid in grids)
        combined.append({"dow": dow, "hour": hour, "count": total})

    return combined


def build_heatmap_data(month_label=HEATMAP_MONTH_LABEL):
    """Create heatmap_data.json for the hour x weekday heatmap visualization."""
    per_type = {}

    for stem, (label, pickup_col) in HEATMAP_TYPE_SPECS.items():
        if not heatmap_file_exists(stem):
            print(f"Skipping missing heatmap file: {heatmap_parquet_path(stem)}")
            continue

        cells = aggregate_heatmap_file(
            heatmap_parquet_path(stem),
            pickup_col
        )
        per_type[label] = {"cells": cells}

    if not per_type:
        raise ValueError("No trip data found for heatmap_data.json")

    # The frontend has an "all" option, so combine the individual vehicle grids too.
    grids = [vehicle_data["cells"] for vehicle_data in per_type.values()]
    all_cells = sum_cell_grids(grids)

    types_out = {"all": {"cells": all_cells}}
    types_out.update(per_type)

    output = {
        "monthLabel": month_label,
        "types": types_out
    }

    output_path = PROCESSED_DIR / "heatmap_data.json"
    output_path.write_text(json.dumps(output, indent=0), encoding="utf-8")

    print(f"Saved {output_path}")


# ============================================================
# Validation
# ============================================================

def validate_zone_hourly():
    """Basic checks for the choropleth data before using it in the website."""
    path = PROCESSED_DIR / "zone_hourly.csv"
    df = pd.read_csv(path)

    required_cols = {
        "zone_id",
        "borough",
        "pickup_date",
        "pickup_hour",
        "vehicle_type",
        "trip_count",
        "trip_price"
    }

    assert required_cols.issubset(df.columns), "Missing required columns"

    allowed_types = {"yellow", "green", "hvfhv", "other_fhv"}
    assert set(df["vehicle_type"].unique()) <= allowed_types, "Invalid vehicle_type"

    assert df["pickup_hour"].between(0, 23).all(), "pickup_hour must be 0–23"

    assert (df["trip_count"] >= 0).all(), "trip_count must be non-negative"

    # The map animation expects all 24 hours to be available.
    expected_hours = set(range(24))
    actual_hours = set(df["pickup_hour"].unique())
    assert actual_hours == expected_hours, "Not all 24 hours are present"

    print("zone_hourly.csv passed validation")


def validate_yearly_market_share():
    """Basic checks for the market share data before using it in the website."""
    path = PROCESSED_DIR / "yearly_market_share.csv"
    df = pd.read_csv(path)

    required_cols = {
        "year",
        "taxi_type",
        "trip_count",
        "share"
    }

    assert required_cols.issubset(df.columns), "Missing required columns"

    allowed_types = {"yellow", "green", "hvfhv", "other_fhv"}
    assert set(df["taxi_type"].unique()) <= allowed_types, "Invalid taxi_type"

    # Each year should have one row for each of the four vehicle categories.
    rows_per_year = df.groupby("year").size()
    assert (rows_per_year == 4).all(), "Each year must have exactly 4 rows"

    assert (df["trip_count"] >= 0).all(), "trip_count must be non-negative"

    share_sums = df.groupby("year")["share"].sum()

    # Only check share totals for years that actually have trip data.
    valid_share_years = share_sums[
        df.groupby("year")["trip_count"].sum() > 0
    ]

    assert ((valid_share_years - 1).abs() <= 0.01).all(), \
        "Shares must sum to approximately 1.0 per year"

    print("yearly_market_share.csv passed validation")


# ============================================================
# Main
# ============================================================

if __name__ == "__main__":
    # Build and validate the hourly zone dataset for the choropleth map.
    build_zone_hourly(selected_date=SELECTED_DATE)
    # validate_zone_hourly()

    # # Build and validate the yearly market share dataset.
    # build_yearly_market_share(
    #     start_year=START_YEAR,
    #     end_year=END_YEAR
    # )
    # validate_yearly_market_share()

    # # Build the monthly hour x weekday heatmap dataset.
    # build_heatmap_data(month_label=HEATMAP_MONTH_LABEL)
