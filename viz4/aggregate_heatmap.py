from __future__ import annotations

import json
from pathlib import Path

import duckdb

HERE = Path(__file__).resolve().parent
DATA = HERE / "data"

TYPE_SPECS: dict[str, tuple[str, str]] = {
    "green_tripdata_2026-01": ("green", "lpep_pickup_datetime"),
    "yellow_tripdata_2026-01": ("yellow", "tpep_pickup_datetime"),
    "fhv_tripdata_2026-01": ("fhv", "pickup_datetime"),
    "fhvhv_tripdata_2026-01": ("fhvhv", "pickup_datetime"),
}


def full_grid(rows: list[tuple[int, int, int]]) -> list[dict]:
    m: dict[tuple[int, int], int] = {}
    for hr, dow, cnt in rows:
        m[(hr, dow)] = int(cnt)
    cells = []
    for dow in range(1, 8):
        for hour in range(24):
            cells.append({"dow": dow, "hour": hour, "count": m.get((hour, dow), 0)})
    return cells


def aggregate_one(parquet_path: Path, pickup_col: str) -> list[dict]:
    path_sql = str(parquet_path).replace("\\", "/")
    q = f"""
    SELECT
      EXTRACT(hour FROM t.{pickup_col})::INTEGER AS hr,
      EXTRACT(isodow FROM t.{pickup_col})::INTEGER AS isodow,
      COUNT(*)::BIGINT AS cnt
    FROM read_parquet('{path_sql}') AS t
    WHERE t.{pickup_col} IS NOT NULL
    GROUP BY 1, 2
    """
    con = duckdb.connect(database=":memory:")
    fetched = con.execute(q).fetchall()
    con.close()
    return full_grid(fetched)


def sum_cell_grids(grids: list[list[dict]]) -> list[dict]:
    n = len(grids[0])
    out: list[dict] = []
    for i in range(n):
        dow = grids[0][i]["dow"]
        hour = grids[0][i]["hour"]
        total = sum(int(g[i]["count"]) for g in grids)
        out.append({"dow": dow, "hour": hour, "count": total})
    return out


def main() -> None:
    per_type: dict[str, dict] = {}
    for stem, (label, col) in TYPE_SPECS.items():
        per_type[label] = {"cells": aggregate_one(DATA / f"{stem}.parquet", col)}

    grids = [per_type[k]["cells"] for k in per_type]
    all_cells = sum_cell_grids(grids)

    types_out: dict[str, dict] = {"all": {"cells": all_cells}}
    types_out.update(per_type)

    out = {"monthLabel": "Jan 2026", "types": types_out}
    (HERE / "heatmap_data.json").write_text(json.dumps(out, indent=0), encoding="utf-8")


if __name__ == "__main__":
    main()
