// SVG drawing area
var marginChoreoA = {top: 50, right: 30, bottom: 0, left: 85};
var widthChoreoA = 1100 - marginChoreoA.left - marginChoreoA.right; //1100 x 650
var heightChoreoA = 500 - marginChoreoA.top - marginChoreoA.bottom;

var svgChoreoA = d3.select("#choreoA").append("svg")
    .attr("viewBox", "0 0 " + (widthChoreoA + marginChoreoA.left + marginChoreoA.right) + " " +
        (heightChoreoA + marginChoreoA.top + marginChoreoA.bottom) + "")
    .append("g")
    .attr("class", "chart")
    .attr("transform", "translate(" + marginChoreoA.left + "," + marginChoreoA.top + ")");

//Scales
var xScaleA = d3.scaleLinear()
    .range([0, widthChoreoA - (marginChoreoA.left + marginChoreoA.right)]);

var yScaleA = d3.scaleLinear()
    .range([0, heightChoreoA - (marginChoreoA.top + marginChoreoA.bottom)]);

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
    .style("text-anchor", "end")
    .attr("transform", "translate(" + (widthChoreoA - (marginChoreoA.left + marginChoreoA.right)) + ", -25)")
    .text("time");

gyAxisA.append("text")
    .attr("class", "y-axis axes label")
    .style("text-anchor", "start")
    .attr("transform", "translate(-65," + (heightChoreoA - (marginChoreoA.top + marginChoreoA.bottom)) + ")rotate(-90)")
    .text("displaced persons");

var dur = 0; // Duration of transitions

function choreoA(place, span) {
    console.log("'place' object passed to choreoA function:");
    console.log(place);

    svgChoreoA.selectAll("path").remove();

    // Add text above chart denoting place being visualized (e.g., China)
    var header = document.getElementById("category");
    if (header.hasChildNodes()) {
        header.innerHTML = ""; // Remove any text from previous viz
    }
    var category = topPlaces.category;
    var text = document.createTextNode(place[category]);
    header.appendChild(text);

    var width = widthChoreoA;
    var height = heightChoreoA;

    // Set domain for scales
    var xDomain = getDomainX(place, span);
    xScaleA.domain(xDomain);
    var yDomain = getDomainY(place, span);
    yScaleA.domain(yDomain);

    // Build stack generator
    var stackGenerator = d3.stack();
    stackKeys = getDisasterKeys(place, span);
    var stackData = reorgData(place, span, stackKeys);
    stackGenerator.keys(stackKeys);

    // Call stack generator
    var stackSeries = stackGenerator(stackData);

    var chart = svgChoreoA.append("g")
        .selectAll("path")
        .data(stackSeries)
        .enter()
        .append("path")
        .style("fill", function(d) {
            return colorMapRed[d.key];
        })
        .transition() // trans and dur not seeming to work
        .duration(dur)
        .attr("d", d3.area()
            .curve(d3.curveBasis)
            .x(function(d) {
                if (span == "all") { return xScaleA(d.data.year); }
                else { return xScaleA(d.data.date); }
            })
            .y0(function(d) {
                return yScaleA(d[0]); })
            .y1(function(d) {
                return yScaleA(d[1]); })
        );

    //Call axes generators
    svgChoreoA.select(".x-axis")
        .transition()
        .duration(dur)
        .call(xAxisA.tickFormat(d3.format("d")));
    svgChoreoA.select(".y-axis")
        .transition()
        .duration(dur)
        .call(yAxisA.ticks(5));
}

/* TO-DO: change forEach into something that can be broken in below functions that check for span equaling a year.
    Make deepClones for 'sorted'. getDomainX for a year may return a least/most for an event with 0 displacements
    and thus an event whose disaster type is not in keys. */

/* 'getDomainY returns the y-axis domain spanning from 0 to most displaced in a single year for argument 'place' */
function getDomainY(place, span) {
    var most;
    var sorted;

    if (span === "all") {
        sorted = place.years.sort(function (a, b) {
            return b.yrTotDispl - a.yrTotDispl;
        });
        most = sorted[0].yrTotDispl;
    }
    else {
        var yr = parseInt(span);
        place.years.forEach(function (d) {
            if (d.year === yr) {
                sorted = d.dates.sort(function (a,b) {
                    return b.displ - a.displ;
                });
                most = sorted[0].displ;
            }
        });
    }
    console.log("y domain:")
    console.log([0, most]);
    return [0, most];
}

/* 'getDomainX' returns the x-axis domain according to 'span': if "all", the domain runs from 2008 to 2020, but if a specific year,
    the domain runs from the first numerical event date to the last one. TO-DO, make a separate x-scale that uses the normal date structures
      (e.g., '2008-12-05') for scaling a single year. */
function getDomainX(place, span) {
    var dateFirst;
    var dateLast;
    var sorted;

    if (span === "all") { return [2008, 2020];}
    else {
        var yr = parseInt(span);
        place.years.forEach(function (d) {
            if (d.year === yr) {
                sorted = d.dates.sort(function (a,b) {
                    return a.numDate - b.numDate;
                });
                dateFirst = sorted[0].numDate;
                dateLast = sorted[(sorted.length - 1)].numDate;
            }
        });

        console.log("x domain:")
        console.log([dateFirst, dateLast]);
        return [dateFirst, dateLast];
    }
}

/* 'getDisasterKeys' returns an array of the hazard types found in place, excluding "unknown" and any disaster where 0
    people were displaced. */
function getDisasterKeys(place, span) {
    var keys = [];
    var sorted;

    if (span == "all") {
        // Sort needed data descending with the most people displaced coming first
        sorted = place.totHaz.sort(function(a, b) {
            return b.displHaz - a.displHaz;
        });

        sorted.forEach(function(d){
            if (d.hazType !== "unknown" && d.displHaz !== 0) {
                //remove spaces from all disaster names like "Wet mass movement" since keys can't have spaces
                var key = d.hazType.split(" ").join("");
                keys.push(key);
            }
        });
    }
    else {
        // Sort needed data descending with the most people displaced coming first
        var yr = parseInt(span);
        place.years.forEach(function (d) {
            if (d.year === yr) {
                sorted = d.totHaz.sort(function(a, b) {
                    return b.displHaz - a.displHaz;
                });
            }
        });

        sorted.forEach(function(d){
            if (d.hazType !== "unknown" && d.displHaz !== 0) {
                //remove spaces from all disaster names like "Wet mass movement" since keys can't have spaces
                var key = d.hazType.split(" ").join("");
                keys.push(key);
            }
        });

    }
    console.log("keys:")
    console.log(keys);
    return keys;
}

/* 'reorgData' returns a new array suitable for passing to d3.stack() generator.
    See http://using-d3js.com/05_06_stacks.html for help on d3.stack() details like format. */
function reorgData(place, span, keys) {
    var arr = [];

    if (span === "all") {
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
    }

    else {
        var yr = parseInt(span);
        place.years.forEach(function (d) {
            if (d.year === yr) {
                d.dates.forEach(function(d) {
                    var obj = {};
                    obj.date = d.numDate;

                    var disaster = d.haz.split(" ").join(""); // Remove spaces to match keys
                    if (keys.includes(disaster)) {
                        obj[disaster] = d.displ;
                        for (var i = 0; i < keys.length; i++) { // Set all other key values to 0 for layer continuity
                            if (keys[i] !== disaster) {
                                obj[keys[i]] = 0;
                            }
                        }
                        arr.push(obj);
                    }
                });
            }
        });

        arr.sort(function(a, b){ return a.date - b.date; });
    }
    console.log("Stack data:")
    console.log(arr);
    return arr;
}