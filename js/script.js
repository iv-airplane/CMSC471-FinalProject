const colorScale = {
        domain: ["yellow", "green", "hvfhv", "other_fhv"],
        range: ["#f0a500", "#4caf7d", "#3d5a99", "#aaaaaa"]
    };




function createVis2(data) {

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
            values: allData
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

function createVis4(data) {

}

function init() {
    // Ensure the path points to the correct location of your generated CSV
    d3.csv("data/market-share/taxi_trip_data_2013_2023.csv", d => ({
        // Use the unary plus (+) operator to convert strings to numbers
        year: +d.year,
        taxi_type: d.taxi_type,
        trip_count: +d.trip_count,
        share: +d.share
    })).then(data => {
        // Call your visualization drawing functions with the formatted data
        createVis2(data);
        createVis3(data); // Note: updated from 'allData' to 'data' to use the loaded CSV
        createVis4(data);

        console.log("Data Loaded Successfully:", data);
    }).catch(error => {
        console.error("Error loading the CSV file:", error);
    });
}

window.addEventListener('load', init)