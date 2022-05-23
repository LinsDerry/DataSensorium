// SVG drawing area
var marginLegend = {top: 40, right: 55, bottom: 75, left: 85};
var widthLegend = 150 - marginLegend.left - marginLegend.right;
var heightLegend = 300 - marginLegend.top - marginLegend.bottom;
var svgLegend = d3.select("#colorLegend").append("svg")
    .attr("width", (widthLegend + marginLegend.left + marginLegend.right))
    .attr("height", heightLegend + marginLegend.top + marginLegend.bottom)
    // .attr("viewBox", "0 0 " + (widthLegend + marginLegend.left + marginLegend.right) + " " +
    //     (heightLegend + marginLegend.top + marginLegend.bottom) + "")
    .append("g")
    .attr("class", "legendOrdinal")
    .attr("transform", "translate(" + marginLegend.left + "," + marginLegend.top + ")");

// Create y-scale and y-axis
var yScaleLeg = d3.scalePoint()
    .range([0, heightLegend]);
var yAxisLeg = d3.axisLeft()
    .scale(yScaleLeg);

// Append g element for y-axis
svgLegend.append("g")
    .attr("class", "y-axis axes");

function colorLegend() {
    yScaleLeg.domain(hazardTypesRed);

    var updateCir = svgLegend.selectAll("circle").data(hazardTypesRed);
    var enterCir = updateCir.enter()
        .append("circle")
        .attr("class", "cir");

    enterCir.merge(updateCir)
        .transition()
        .duration(dur) // dur is set in 'choreoA.js'
        .attr("cx", marginLegend.left / 4)
        .attr("cy", function (d) {
            return yScaleLeg(d);
        })
        .attr("r", 10)
        .style("fill", function (d) {
            //remove spaces from disaster name like "Wet mass movement"
            var key = d.split(" ").join("");
            return colorMapRed[key];
        })
        .style("stroke", "black")
        .style("stroke-width", "0.25");

    updateCir.exit().remove();

    //Call axis generator
    svgLegend.select(".y-axis")
        .transition()
        .duration(dur)
        .call(yAxisLeg);
}