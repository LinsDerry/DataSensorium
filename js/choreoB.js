// SVG drawing area
var marginChoreoB = {top: 10, right: 10, bottom: 10, left: 10};
var widthChoreoB = 1000 - marginChoreoB.left - marginChoreoB.right;
var heightChoreoB = 500 - marginChoreoB.top - marginChoreoB.bottom;

var svgChoreoB = d3.select("#choreoB").append("svg")
    .attr("width", widthChoreoB)
    .attr("height", heightChoreoB)
    // .attr("viewBox", "0 0 " + (widthChoreoB + marginChoreoB.left + marginChoreoB.right) + " " +
    //     (heightChoreoB + marginChoreoB.top + marginChoreoB.bottom) + "")
    .append("g")
    .attr("class", "chart")
    .attr("transform", "translate(" + marginChoreoB.left + "," + marginChoreoB.top + ")");

var textChoreoB = svgChoreoB.append("g")
    .attr("class", "axes label") // using axes class to match choreoA label styling in 'style.css'
    .append("text")
    .style("text-anchor", "start")
    .attr("transform", "translate(" + (widthChoreoB / 2 * 0.35) + "," + heightChoreoB / 2 + ")");

var stepDis = 0;
var inRadius = 0;
var outRadius = 0;
var fade = 0.05; // opacity for out-of-focus rings and layers

function choreoB(index, show) {

    // Update chart text
    if (show !== "all") {
        textChoreoB.text(2008 + index);
    }
    else {
        textChoreoB.text("2008-2020");
    }

    // Reset to default state when score is updated as indicated when 'index' is 0
    if (index === 0 && show === "year") {
        svgChoreoB.selectAll("g.arc").remove();
        stepDis = 0;
        inRadius = 0;
        outRadius = 0;
        stepDis = getStepDis();
    }

    // Show all rings for the given year as indicated by 'index'. This is the default view that corresponds with choreoA
    if (show === "year") {
        // Fade out all previously drawn rings before drawing more rings for new year
        svgChoreoB.selectAll("path")
            .style("opacity", function (d) {
                return fade;
            });

        var pie = d3.pie()
            .startAngle(-36 * Math.PI / 180) // centers first section at 12:00
            .endAngle(-36 * Math.PI / 180 + 2 * Math.PI)
            .value(function (d) {
                return d.value;
            })
            .sort(function (a, b) {
                return a.order - b.order;
            });

        var pieDatum; // Only using one object for building rings one at a time

        var arc = d3.arc();

        // advance through disasters array for given year in 'score'
        for (var k = 0; k < score[index].disasters.length; k++) {
            // Update radii and pie datum
            setRadii(score[index].disasters[k]);
            arc.innerRadius(inRadius)
                .outerRadius(outRadius);
            pieDatum = updatePieDatum(index, k);

            pieDatum = pie(pieDatum);

            //Draw new ring
            var ring = svgChoreoB.append("g")
                .selectAll("g.arc")
                .data(pieDatum)
                .enter()
                .append("g")
                .attr("class", "arc")
                .attr("transform", "translate(" + (widthChoreoB / 2) + "," + (heightChoreoB / 2) + ")");

            ring.append("path")
                .style("fill", function (d) {
                    return d.data.fill;
                })
                .style("opacity", function (d) {
                    return d.data.opacity;
                })
                .attr("d", arc);
        }
    }

    // Show all rings (this occurs when "n" is pushed in 'eventHandler()' in 'main.js" after progressing through 2008-20)
    if (show === "all") {
        svgChoreoB.selectAll("path")
            .style("opacity", function (d) {
                return d.data.opacity;
            });
    }

    // Show single ring in current year being danced (see 'eventHandler()' in 'main.js'
    if (show === "single") {
        svgChoreoB.selectAll("path")
            .style("fill", function (d) {
                /* 'hazTypesRed' is defined in 'main.js' and updated in 'wrangleData()' based on what keys are
                pressed representing disaster types. */
                if (hazardTypesRed.includes(d.data.hazType) && d.data.index === index) { // show selected disaster in current year
                    return d.data.fill;
                }
                else if (d.data.index === index) { // hide other disasters in current year
                    return "#bfbfbf"; // match to .chart background in style.css
                }
                else { // leave previous rings/years visible
                    return d.data.fill;
                }
            })
            .style("opacity", function (d) {
                // see comments above (same logic pattern)
                if (hazardTypesRed.includes(d.data.hazType) === show && d.data.index === index) {
                    return d.data.opacity;
                }
                else if (d.data.index === index) {
                    return 1;
                }
                else {
                    return fade;
                }
            });
    }
}

/* 'getStepDis' determines how many pixels should represent one step in the movement score so that the completed chart
*   fits in svgChoreoB */
function getStepDis() {
    var steps = 0; // total number of steps taken
    var stepDis = 0; // pixel distance used to encode each step

    for (var i = 0; i < score.length; i += 2) { //advancing every two years
        score[i].disasters.forEach(function (d) {
            steps += d.steps;
        });
    }

    stepDis = (heightChoreoB / 2 / steps * 0.9);
    return stepDis;
}

/* 'setRadii' determines the pixel distance or interval for each 'step', then sets the initial radii of first
*   ring so that the ring width encodes the total number of steps taken for a particular disaster. */
function setRadii(scoreForRing) {

    inRadius = outRadius;
    outRadius += scoreForRing.steps * stepDis;
}

/* 'updatePieDatum' creates an array of (one) objects (required by d3.pie) that binds useful information, including
    value, disaster type, index (indicating year), fill, and opacity to the path element once drawn. */
function updatePieDatum(index, k) {
    var datum = [];
    var obj = {};

    obj.value = 1;

    // set disaster type value
    obj.hazType = score[index].disasters[k].hazType;

    // use 'index' to indicate what year in the score we're in
    obj.index = index;

    // set fill value
    var dis = score[index].disasters[k].hazType;
    dis = dis.split(" ").join("");
    obj.fill = colorMap[dis];

    // set opacity value
    if (score[index].disasters[k].reps === 5) {
        obj.opacity = 1;
    }
    if (score[index].disasters[k].reps === 4) {
        obj.opacity = 0.85;
    }
    if (score[index].disasters[k].reps === 3) {
        obj.opacity = 0.7;
    }
    if (score[index].disasters[k].reps === 2) {
        obj.opacity = 0.55;
    }
    if (score[index].disasters[k].reps === 1) {
        obj.opacity = 0.4;
    }

    datum.push(obj);
    return datum;
}