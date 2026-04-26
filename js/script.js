const allData = [
    { year: 2013, taxi_type: "yellow", trip_count: 210000000, share: 0.92 },
    { year: 2013, taxi_type: "green", trip_count: 12000000, share: 0.05 },
    { year: 2013, taxi_type: "hvfhv", trip_count: 4000000, share: 0.02 },
    { year: 2013, taxi_type: "other_fhv", trip_count: 2000000, share: 0.01 },
    { year: 2014, taxi_type: "yellow", trip_count: 180000000, share: 0.80 },
    { year: 2014, taxi_type: "green", trip_count: 11000000, share: 0.05 },
    { year: 2014, taxi_type: "hvfhv", trip_count: 28000000, share: 0.13 },
    { year: 2014, taxi_type: "other_fhv", trip_count: 4000000, share: 0.02 },
    { year: 2015, taxi_type: "yellow", trip_count: 145000000, share: 0.68 },
    { year: 2015, taxi_type: "green", trip_count: 9000000, share: 0.04 },
    { year: 2015, taxi_type: "hvfhv", trip_count: 52000000, share: 0.24 },
    { year: 2015, taxi_type: "other_fhv", trip_count: 7000000, share: 0.03 },
    { year: 2016, taxi_type: "yellow", trip_count: 130000000, share: 0.58 },
    { year: 2016, taxi_type: "green", trip_count: 9000000, share: 0.04 },
    { year: 2016, taxi_type: "hvfhv", trip_count: 75000000, share: 0.34 },
    { year: 2016, taxi_type: "other_fhv", trip_count: 8000000, share: 0.04 },
    { year: 2017, taxi_type: "yellow", trip_count: 110000000, share: 0.45 },
    { year: 2017, taxi_type: "green", trip_count: 8000000, share: 0.03 },
    { year: 2017, taxi_type: "hvfhv", trip_count: 118000000, share: 0.48 },
    { year: 2017, taxi_type: "other_fhv", trip_count: 9000000, share: 0.04 },
    { year: 2018, taxi_type: "yellow", trip_count: 90000000, share: 0.35 },
    { year: 2018, taxi_type: "green", trip_count: 7000000, share: 0.03 },
    { year: 2018, taxi_type: "hvfhv", trip_count: 150000000, share: 0.59 },
    { year: 2018, taxi_type: "other_fhv", trip_count: 8000000, share: 0.03 },
    { year: 2019, taxi_type: "yellow", trip_count: 75000000, share: 0.28 },
    { year: 2019, taxi_type: "green", trip_count: 6000000, share: 0.02 },
    { year: 2019, taxi_type: "hvfhv", trip_count: 182000000, share: 0.67 },
    { year: 2019, taxi_type: "other_fhv", trip_count: 8000000, share: 0.03 },
    { year: 2020, taxi_type: "yellow", trip_count: 30000000, share: 0.17 },
    { year: 2020, taxi_type: "green", trip_count: 2000000, share: 0.01 },
    { year: 2020, taxi_type: "hvfhv", trip_count: 130000000, share: 0.74 },
    { year: 2020, taxi_type: "other_fhv", trip_count: 14000000, share: 0.08 },
    { year: 2021, taxi_type: "yellow", trip_count: 45000000, share: 0.19 },
    { year: 2021, taxi_type: "green", trip_count: 3000000, share: 0.01 },
    { year: 2021, taxi_type: "hvfhv", trip_count: 183000000, share: 0.76 },
    { year: 2021, taxi_type: "other_fhv", trip_count: 9000000, share: 0.04 },
    { year: 2022, taxi_type: "yellow", trip_count: 60000000, share: 0.22 },
    { year: 2022, taxi_type: "green", trip_count: 4000000, share: 0.01 },
    { year: 2022, taxi_type: "hvfhv", trip_count: 200000000, share: 0.73 },
    { year: 2022, taxi_type: "other_fhv", trip_count: 10000000, share: 0.04 },
    { year: 2023, taxi_type: "yellow", trip_count: 65000000, share: 0.22 },
    { year: 2023, taxi_type: "green", trip_count: 5000000, share: 0.02 },
    { year: 2023, taxi_type: "hvfhv", trip_count: 205000000, share: 0.72 },
    { year: 2023, taxi_type: "other_fhv", trip_count: 10000000, share: 0.04 },
];

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
    d3.csv("data/COVID_US_cases.csv", d => ({
        date: new Date(d.date + 'T12:00:00.000+08:00'),
        newConfirmed: +d.new_confirmed > 0 ? +d.new_confirmed : 0
    })).then(data => {
        // Call visualization drawing functions
        createVis2(data);
        createVis3(allData);
        createVis4(data);
        console.log(data); // Check if data loads correctly
    });
}

window.addEventListener('load', init)