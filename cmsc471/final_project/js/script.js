
function createVis2(data) {

}

function createVis3(data) {
   
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
        createVis3(data);
        createVis4(data);
        console.log(data); // Check if data loads correctly
    });
}

window.addEventListener('load', init)