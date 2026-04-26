import pandas as pd
import duckdb
from pathlib import Path

RAW_DIR = Path("data/raw")
PROCESSED_DIR = Path("data/processed")
PROCESSED_DIR.mkdir(parents=True, exist_ok=True)

SELECTED_DATE = "2024-10-16"
START_YEAR = 2015
END_YEAR = 2025



# ============================================================
# Helpers
# ============================================================

def parquet_glob(folder_name):
    return str(RAW_DIR / folder_name / "*.parquet")


def file_exists_in_folder(folder_name):
    folder = RAW_DIR / folder_name
    return folder.exists() and any(folder.glob("*.parquet"))


def safe_duckdb_query(query):
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
    parts = []

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

    if not parts:
        raise ValueError("No trip data found for zone_hourly.csv")

    grouped = pd.concat(parts, ignore_index=True)

    zones_path = RAW_DIR / "zones" / "taxi_zone_lookup.csv"
    zones = pd.read_csv(zones_path)

    zones = zones.rename(columns={
        "LocationID": "zone_id",
        "Borough": "borough"
    })

    zones["zone_id"] = zones["zone_id"].astype(int)

    # Ensure every zone/hour/vehicle type exists, even if trip_count = 0
    all_zone_ids = zones["zone_id"].unique()
    all_hours = range(24)
    all_vehicle_types = ["yellow", "green", "hvfhv"]

    full_index = pd.MultiIndex.from_product(
        [all_zone_ids, [selected_date], all_hours, all_vehicle_types],
        names=["zone_id", "pickup_date", "pickup_hour", "vehicle_type"]
    ).to_frame(index=False)

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

    # Dedicated HVFHV files
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

    # FHV files split using authoritative HV base list
    if file_exists_in_folder("fhv"):
        if hv_bases:
            fhv_split = safe_duckdb_query(
                fhv_split_query(
                    parquet_glob("fhv"),
                    hv_bases
                )
            )
        else:
            # fallback: if no HVFHV files exist, classify all FHV as other_fhv
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
# Validation
# ============================================================

def validate_zone_hourly():
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

    allowed_types = {"yellow", "green", "hvfhv"}
    assert set(df["vehicle_type"].unique()) <= allowed_types, "Invalid vehicle_type"

    assert df["pickup_hour"].between(0, 23).all(), "pickup_hour must be 0–23"

    assert (df["trip_count"] >= 0).all(), "trip_count must be non-negative"

    expected_hours = set(range(24))
    actual_hours = set(df["pickup_hour"].unique())
    assert actual_hours == expected_hours, "Not all 24 hours are present"

    print("zone_hourly.csv passed validation")


def validate_yearly_market_share():
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

    rows_per_year = df.groupby("year").size()
    assert (rows_per_year == 4).all(), "Each year must have exactly 4 rows"

    assert (df["trip_count"] >= 0).all(), "trip_count must be non-negative"

    share_sums = df.groupby("year")["share"].sum()

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
    build_zone_hourly(selected_date=SELECTED_DATE)
    validate_zone_hourly()

    build_yearly_market_share(
        start_year=START_YEAR,
        end_year=END_YEAR
    )
    validate_yearly_market_share()