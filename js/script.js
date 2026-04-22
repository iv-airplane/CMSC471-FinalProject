const allData = [
  { year: 2013, taxi_type: "yellow",    trip_count: 210000000, share: 0.92 },
  { year: 2013, taxi_type: "green",     trip_count:  12000000, share: 0.05 },
  { year: 2013, taxi_type: "hvfhv",     trip_count:   4000000, share: 0.02 },
  { year: 2013, taxi_type: "other_fhv", trip_count:   2000000, share: 0.01 },
  { year: 2014, taxi_type: "yellow",    trip_count: 180000000, share: 0.80 },
  { year: 2014, taxi_type: "green",     trip_count:  11000000, share: 0.05 },
  { year: 2014, taxi_type: "hvfhv",     trip_count:  28000000, share: 0.13 },
  { year: 2014, taxi_type: "other_fhv", trip_count:   4000000, share: 0.02 },
  { year: 2015, taxi_type: "yellow",    trip_count: 145000000, share: 0.68 },
  { year: 2015, taxi_type: "green",     trip_count:   9000000, share: 0.04 },
  { year: 2015, taxi_type: "hvfhv",     trip_count:  52000000, share: 0.24 },
  { year: 2015, taxi_type: "other_fhv", trip_count:   7000000, share: 0.03 },
  { year: 2016, taxi_type: "yellow",    trip_count: 130000000, share: 0.58 },
  { year: 2016, taxi_type: "green",     trip_count:   9000000, share: 0.04 },
  { year: 2016, taxi_type: "hvfhv",     trip_count:  75000000, share: 0.34 },
  { year: 2016, taxi_type: "other_fhv", trip_count:   8000000, share: 0.04 },
  { year: 2017, taxi_type: "yellow",    trip_count: 110000000, share: 0.45 },
  { year: 2017, taxi_type: "green",     trip_count:   8000000, share: 0.03 },
  { year: 2017, taxi_type: "hvfhv",     trip_count: 118000000, share: 0.48 },
  { year: 2017, taxi_type: "other_fhv", trip_count:   9000000, share: 0.04 },
  { year: 2018, taxi_type: "yellow",    trip_count:  90000000, share: 0.35 },
  { year: 2018, taxi_type: "green",     trip_count:   7000000, share: 0.03 },
  { year: 2018, taxi_type: "hvfhv",     trip_count: 150000000, share: 0.59 },
  { year: 2018, taxi_type: "other_fhv", trip_count:   8000000, share: 0.03 },
  { year: 2019, taxi_type: "yellow",    trip_count:  75000000, share: 0.28 },
  { year: 2019, taxi_type: "green",     trip_count:   6000000, share: 0.02 },
  { year: 2019, taxi_type: "hvfhv",     trip_count: 182000000, share: 0.67 },
  { year: 2019, taxi_type: "other_fhv", trip_count:   8000000, share: 0.03 },
  { year: 2020, taxi_type: "yellow",    trip_count:  30000000, share: 0.17 },
  { year: 2020, taxi_type: "green",     trip_count:   2000000, share: 0.01 },
  { year: 2020, taxi_type: "hvfhv",     trip_count: 130000000, share: 0.74 },
  { year: 2020, taxi_type: "other_fhv", trip_count:  14000000, share: 0.08 },
  { year: 2021, taxi_type: "yellow",    trip_count:  45000000, share: 0.19 },
  { year: 2021, taxi_type: "green",     trip_count:   3000000, share: 0.01 },
  { year: 2021, taxi_type: "hvfhv",     trip_count: 183000000, share: 0.76 },
  { year: 2021, taxi_type: "other_fhv", trip_count:   9000000, share: 0.04 },
  { year: 2022, taxi_type: "yellow",    trip_count:  60000000, share: 0.22 },
  { year: 2022, taxi_type: "green",     trip_count:   4000000, share: 0.01 },
  { year: 2022, taxi_type: "hvfhv",     trip_count: 200000000, share: 0.73 },
  { year: 2022, taxi_type: "other_fhv", trip_count:  10000000, share: 0.04 },
  { year: 2023, taxi_type: "yellow",    trip_count:  65000000, share: 0.22 },
  { year: 2023, taxi_type: "green",     trip_count:   5000000, share: 0.02 },
  { year: 2023, taxi_type: "hvfhv",     trip_count: 205000000, share: 0.72 },
  { year: 2023, taxi_type: "other_fhv", trip_count:  10000000, share: 0.04 },
];




function createVis2(data) {

}

// https://vega.github.io/vega-lite/examples/stacked_bar_weather.html

/*
  Quantitative: Numerical values you can measure and do math with.
  Nominal: Categories with no inherit order
  Ordinal: Categories with meaningful order
*/
function createVis3(data) {
    const marketShareChartSpec = {
        "$schema": "https://vega.github.io/schema/vega-lite/v6.json",
        "width": 700,
        "height": 400,
        "data": {"values": allData},
        "mark": {
            "type": "bar",
            "size": 15
        },
        "encoding": {
            "x": {
                "field": "year", 
                "type": "ordinal",
                "scale": {
                    "paddingInner": 0.1,
                    "paddingOuter": 0.05
                }
            },
            "y": {
               "aggregate": "sum",
               "field": "trip_count",
               "type": "quantitative",
               "stack": "normalize",
               "axis": null // disable y-axis completely, it's not visible
            },
            "color": {
                "field": "taxi_type",
                "type": "nominal",
                "scale": {
                    // map taxi types to appropriate colors
                    "domain": ["yellow", "green", "hvfhv", "other_fhv"],
                    "range": ["#f0a500", "#4caf7d", "#3d5a99", "#aaaaaa"]
                }
            },
        },
        "title": "Taxi Market Share Throughout The Years"
    }
    

    // Embed the chart in the HTML file
    vegaEmbed('#vis3', marketShareChartSpec);
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