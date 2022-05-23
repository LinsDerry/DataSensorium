// SVG drawing area
var marginChoreoA = {top: 60, right: 30, bottom: 0, left: 100};
var widthChoreoA = 1000 - marginChoreoA.left - marginChoreoA.right;
var heightChoreoA = 500 - marginChoreoA.top - marginChoreoA.bottom;

var svgChoreoA = d3.select("#choreoA").append("svg")
    .attr("width", widthChoreoA)
    .attr("height", heightChoreoA)
//     .attr("viewBox", "0 0 " + (widthChoreoA + marginChoreoA.left + marginChoreoA.right) + " " +
//         (heightChoreoA + marginChoreoA.top + marginChoreoA.bottom) + "")
    .append("g")
    .attr("class", "chart")
    .attr("transform", "translate(" + marginChoreoA.left + "," + marginChoreoA.top + ")");

//Scales
var xScaleA = d3.scaleLinear()
    .range([0, widthChoreoA - (marginChoreoA.left + marginChoreoA.right)]);
var yScaleA = d3.scaleLinear()
    .range([0, heightChoreoA - (marginChoreoA.top + marginChoreoA.bottom)]);
var opacityScale = d3.scaleLinear()
    .range([0.4, 1.0]);

//Axes
var xAxisA = d3.axisTop()
    .scale(xScaleA);
var yAxisA = d3.axisLeft()
    .scale(yScaleA);

//Append g elements for axes
var gxAxisA = svgChoreoA.append("g")
    .attr("class", "x-axis axes")
    .attr("transform", "translate(0, -3)");

var gyAxisA = svgChoreoA.append("g")
    .append("g")
    .attr("class", "y-axis axes")
    .attr("transform", "translate(-3, 0)");

// Add labels to axes
gxAxisA.append("text")
    .attr("class", "x-axis axes label")
    .style("text-anchor", "start")
    .attr("transform", "translate(-85, -35)")
    .text(">> Years >>");

gyAxisA.append("text")
    .attr("class", "y-axis axes label")
    .style("text-anchor", "end")
    .attr("transform", "translate(-85, -35)rotate(-90)")
    .text("<< Displacements <<");

var dur = 0; // Duration of transitions

function choreoA(place, span) {
//     console.log("'place' object passed to choreoA:");
//     console.log(place);

    // Add text above table denoting place being visualized (e.g., China)
    var header = document.getElementById("category");
    if (header.hasChildNodes()) {
        header.innerHTML = "";
    }
    var category = topPlaces.category;
    var text = document.createTextNode(place[category]);
    header.appendChild(text);

    var width = widthChoreoA;
    var height = heightChoreoA;

    // Set scale domains
    xScaleA.domain([2008, (2008 + span)]);
    var yDomain = getDomainY(place);
    yScaleA.domain(yDomain);
    var opacityDomain = getDomainOpacity(span);
    opacityScale.domain(opacityDomain);

    // Build stack generator
    var stackGenerator = d3.stack();
    stackKeys = getDisasterKeys(place);
    var stackData = reorgData(place, stackKeys);
    stackGenerator.keys(stackKeys);

    var stackDataSpan = [];
    for (var i = 0; i <= span; i++) {
        stackDataSpan.push(stackData[i]);
    }

    // Call stack generator
    var stackSeries = stackGenerator(stackDataSpan); // Only visualizes span

    svgChoreoA.selectAll("path").remove(); // a temporary solution since "layer.exit().remove" below is not working

    var updateLayer = svgChoreoA.selectAll("path").data(stackSeries);

    var enterLayer = updateLayer.enter()
        .append("path")
        .attr("class", "layer");

    enterLayer.merge(updateLayer)
        .transition()
        .duration(0) // change to 'dur' once transitions between paths work properly
        .attr("d", d3.area()
            .curve(d3.curveBasis)
                .x(function(d) { return xScaleA(d.data.year); })
                .y0(function(d) {
                    return yScaleA(d[0]); })
                .y1(function(d) {
                    return yScaleA(d[1]); })
                    )
            .style("fill", function(d) {
                if (colorMapRed[d.key] === undefined) {
                    return "#bfbfbf"; // match to .chart background in style.css
                }
                else {
                    return colorMapRed[d.key];
                }
                })
            .style("opacity", function(d) {
                return getOpacity(span, d);
            });

    updateLayer.exit().remove(); // not working

    //Call axes generators
    svgChoreoA.select(".x-axis")
        .transition()
        .duration(dur)
        .call(xAxisA.tickFormat(d3.format("d")).ticks(span));
    svgChoreoA.select(".y-axis")
        .transition()
        .duration(dur)
        .call(yAxisA.ticks(5));
}

/* 'getDomainY returns the y-axis domain spanning from 0 to most displaced in a single year for argument 'place' */
function getDomainY(place) {
        var most;
        var sorted;

        sorted = place.years.sort(function (a, b) {
                return b.yrTotDispl - a.yrTotDispl;
            });
        most = sorted[0].yrTotDispl;

        return [0, most];
}

/* 'getDomainOpacity' returns the domain for 'opacityScale' where least and most are aggregates of disaster frequencies
    for given span. Using 'score' for aggregation instead of 'place' since its structure is more conducive to this process.*/
function getDomainOpacity(span) {
    var map = [];
    var least = 0;
    var most = 0;

    // populate map
    hazardTypes.forEach(function(d) {
        var key = d;
        map[key] = 0;
    });
    for (var i = 0; i <= span; i ++) {
            score[i].disasters.forEach(function (e) {
                map[e.hazType] += e.freq;
            });
    }

    // populate most and least
    hazardTypes.forEach(function(d) {
        if (map[d] > most) {
            most = map[d];
        }
    });
    least = most;
    hazardTypes.forEach(function(d) {
        if (map[d] < least && map[d] !== 0) {
            least = map[d];
        }
    });

    return [least, most];
}

/* 'getDisasterKeys' returns an array of the hazard types found in place, excluding "unknown" and any disaster where 0
    people were displaced. */
function getDisasterKeys(place) {
    var keys = [];
    // Sort needed data descending with disaster with most people displaced coming first
    var sorted = place.totHaz.sort(function(a, b) {
        return b.displHaz - a.displHaz;
    });

    sorted.forEach(function(d){
            if (d.hazType !== "unknown" && d.displHaz !== 0) {
                //remove spaces from all disaster names like "Wet mass movement"
                var key = d.hazType.split(" ").join("");
                keys.push(key);
            }
        });
    return keys;
}

/* 'reorgData' returns a new array suitable for passing to d3.stack() generator.
    See http://using-d3js.com/05_06_stacks.html for help on d3.stack() details like format. */
function reorgData(place, keys) {
    var arr = [];

    place.years.forEach(function(d) {
        var obj = {};
        obj.year = d.year;

        d.totHaz.forEach(function(e) {
                var disaster = e.hazType.split(" ").join("");
                if (keys.includes(disaster)) {
                    obj[disaster] = e.displHaz;
                }
        });
        arr.push(obj);
    });

    arr.sort(function(a, b){ return a.year - b.year; });
    return arr;
}

/* 'getOpacity' finds the total frequency of the disaster (datum.key) being visualized for the current 'span' then
  uses 'opacityScale()' to return a value for the fill opacity. */
function getOpacity(span, datum) {
    var totTargetFreq = 0;

    for (var i = 0; i <= span; i++) {
        score[i].disasters.forEach(function (e) {
            var disaster = e.hazType.split(" ").join("");
            if (datum.key === disaster) {
                totTargetFreq += e.freq;
            }
        });
    }

    return opacityScale(totTargetFreq);
}