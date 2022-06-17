/* In 'main.js', data is loaded, cleaned, and structured. Functions for drawing the visualizations are called
    from 'main.js'. The names of these functions match the names of their files in the 'js' folder where their
    code lives. 'idmc_disaster.csv' was downloaded from the Internal Displacement Monitoring Centre website.
    Line 2 was deleted. 'regions.csv' was downloaded from Luke Duncalfe's "ISO-3166-Countries-with-Regional-Codes"
    GitHub project, originally named 'all.csv'. Column names of both CSVs were slightly changed. */

/* 'data' stores 'idmc_disaster.csv' post cleaning in 'setupData' */
var data = [];

/* 'regions' stores 'regions.csv'. */
var regions = [];

/* 'countries' is an array of objects where each object is a country. */
var countries = [];

/* 'topPlaces' is variously populated for top countries, regions, and subregions by the 'explore()' function */
var topPlaces = [];

/* 'geos' is an object and has two properties, one for regions and one for subregions. These properties contain arrays of
objects that essentially mirror 'countries' but for regions and subregions. */
var geos = {};

/* 'crisis_categories' (e.g., weather related) and 'hazard_types' (e.g., earthquake) are both arrays of strings */
var crisisCategories = [];
var hazardTypes = [];
var hazardTypesRed = []; //Red = reduced

/* A map where key is hazard type or disaster with no spaces (e.g. "Volcanic activity" = "Volcanic activity")
    and value is a HEX color. */
var colorMap = [];
var colorMapRed = [];

/* The disaster types being visualized as layers in choreoA.js. Global since also used in main.js by 'wrangleData'. */
var stackKeys;

/* Logarithmic movement score */
var score;

/* Load data using d3.queue to prevent unwanted asynchronous activity. */
d3.queue()
    .defer(d3.csv, "data/idmc_disaster.csv")
    .defer(d3.csv, "data/regions.csv")
    .await(setupData);

/* 'setupData' cleans and organizes the IDMC data, and adds extra properties. It also populates the global variables
    'crisisCategories' and 'hazardTypes'. Other functions defined below are called in a waterfall fashion from here. */
function setupData(error, data1, data2) {

    /* Convert numerical strings to number types, change blank cells to "unknown",
    and make a numerical version of 'start' for sorting */
    data1.forEach(function(d){
        d.year = +d.year;
        d.displaced = +d.displaced;

        if (d.event === "") {
            d.event = "unknown";
        }
        if (d.crisis_category === "") {
            d.crisis_category = "unknown";
        }
        if (d.hazard_type === "") {
            d.hazard_type = "unknown";
        }
        // Folding "Wet mass movement" and "Dry mass movement" into "Mass movement".
        if (d.hazard_type === "Wet Mass movement" || d.hazard_type === "Wet Mass Movement"
            || d.hazard_type === "Wet mass movement" || d.hazard_type === "Dry mass movement") {
            d.hazard_type = "Mass movement";
        }
        // Combining "Volcanic activity" and "Volcanic eruption" as "Volcano"
        if (d.hazard_type === "Volcanic activity" || d.hazard_type === "Volcanic eruption") {
            d.hazard_type = "Volcano";
        }

        /* Create a numerical version of 'start' for chronological sorting */
        var year = d.start.substr(0, 4);
        var month = d.start.substr(5, 2);
        var day = d.start.substr(8, 2);
        d.numStart = year+month+day;
        d.numStart = +d.numStart;
    });

    /* Chronologically sort data1 by disaster event date */
    data1.sort(function(a, b) {
        return a.numStart - b.numStart;
    });

    /* Populate global variable 'crisisCategories' */
    data1.forEach(function (d) {
        if (!crisisCategories.includes(d.crisis_category)) {
            crisisCategories.push(d.crisis_category);
        }
    });
    /* Populate global variable 'hazardTypes' and 'hazardTypesRed' */
    data1.forEach(function (d) {
        if (!hazardTypes.includes(d.hazard_type) && d.hazard_type !== "unknown") {
            hazardTypes.push(d.hazard_type);
        }
    });
    hazardTypesRed = hazardTypes;

    data = data1;
    regions = data2;

    /* Populate other global variables */
    popCountries();
    popGeos();
    colorMap = disasterColorKey();
    colorMapRed = colorMap;

    // Populate topPlaces with either countries, regions, or subregions data
    // topPlaces = explore(geos.regions, "regions", 5); //Americas '08-'10
    // topPlaces = explore(geos.subRegions, "subregions", 10); // Western Asia
    topPlaces = explore(countries, "countries", 10); // United States and Indonesia

    console.log("draw me");

    // Draw the visualization for the first time and set choreography score
    score = choreoScore(topPlaces.places[0]);
    printScore(0);
    choreoA(topPlaces.places[0], 1);
    choreoB(0, "year");
    eventHandler();
}

/* BEGIN 'setupData' HELPER FUNCTIONS: */

/* 'popCountries' populates global variable 'countries', an array of objects where each object is a country. */
function popCountries() {
    /* Make an array of strings with the names of the countries in 'data'. */
    var countryNames = [];

    data.forEach(function(d) {
        var country = d.country;
        if (!countryNames.includes(country)) {
            countryNames.push(country);
        }
    });

    /* Create a map for returning the total displaced for each country in 'countries' */
    var map = [];

    /* Instantiate 'map' with the countries as keys */
    for (var i = 0; i < countryNames.length; i++) {
        map[countryNames[i]] = 0;
    }

    /* Aggregate total displaced per country in 'map' */
    data.forEach(function (d) {
        map[d.country] += d.displaced;
    });

    /* Create country objects */
    countryNames.forEach(function(d) {
        var obj = {};
        obj.country = d;
        obj.geo = getGeo(d);
        obj.totDispl = map[d];
        obj.years = structureYears(d);
        obj.totHazCategories = mapsToArr("hazCategory", obj.years, "years");
        obj.totHaz = mapsToArr("haz", obj.years, "years");
        countries.push(obj);
    });

    /* Sort 'countries' descending according to greatest displaced */
    countries.sort(function(a, b){
        return b.totDispl - a.totDispl;
    });
}

/* 'getGeo' returns an object with three properties - the ISO 3166 three-letter code (not to be confused with
'iso3166_2' in 'regions.csv'), and the 'country_' (argument's) region and subregion in the world. Note, there are other
possibly useful properties in 'regions.csv' to include in the returned object as needed. */
function getGeo(country_) {
    var code = "";
    var region = "";
    var subRegion = "";

    for (var i = 0; i < data.length; i++) {
        if (country_ === data[i].country) {
            code = data[i].code;
            break;
        }
    }
    for (var j = 0; j < regions.length; j++) {
        if (code === regions[j].alpha3) {
            region = regions[j].region;
            subRegion = regions[j].subRegion;
            break;
        }
    }

    /* Debugged on console, and all countries have been assigned codes, but due to Kosova and Abyei Area not being
    included in 'regions.csv', they have not been assigned a region or subRegion property yet. Doing now: */
    if (country_ === "Kosovo") {
        region = "Europe";
        subRegion = "South-eastern Europe"}
    if (country_ === "Abyei Area") {
        region = "Africa";
        subRegion = "North-eastern Africa";
    }

    var obj = {};
    obj.code = code;
    obj.region = region;
    obj.subRegion = subRegion;

    return obj;
}

/* 'structureYears' returns an array of objects where each object represents one year and contains specific data
    for that year according to 'country_' */
function structureYears(country_) {
    var yearsObj = [];

    /* IMPORTANT - make sure span of years matches 'idmc_disaster.csv' span, 2008-2020. */
    for (var i = 2008; i < 2021; i++) {
        var obj = {};
        obj.year = i;

        /* Create an array of objects where each object contains specific data for the given date or 'start' */
        obj.dates = [];
        for (var j = 0; j < data.length; j++) {
            if (data[j].country === country_ && data[j].year === i) {
                var dateObj = {};
                dateObj.date = data[j].start;
                dateObj.numDate = data[j].numStart;
                dateObj.displ = data[j].displaced;
                dateObj.hazCategory = data[j].crisis_category;
                dateObj.haz = data[j].hazard_type;
                dateObj.event = data[j].event;

                obj.dates.push(dateObj);
            }
        }

        /* Aggregate totals for the given year or 'i' */
        var yrTotDispl = 0;
        obj.dates.forEach(function(d) {
            yrTotDispl += d.displ;
        });
        obj.yrTotDispl = yrTotDispl;

        /* Make an array of objects for the given year or 'i' with specific crisis categories and their frequencies. */
        obj.totHazCategories = mapsToArr("hazCategory", obj.dates, "year");

        /* Make an array of objects for the given year or 'i' with specific hazard types and their frequencies. */
        obj.totHaz = mapsToArr("haz", obj.dates, "year");

        yearsObj.push(obj);
    }

    return yearsObj;
}

/* 'mapsToArr' creates maps to store frequencies and total displaced but returns a sorted array of objects for easier use.
    Returns two possible arrays of objects with specific crisis categories or hazard types and their respective frequencies
    and total displaced, where the argument 'type_' determines which one. Frequencies and total displaced are either
    counted across a single year or all years according to 'span_'. The argument 'time_' is either an array of 'dates'
    or 'years' needed for making the maps of frequencies and total displaced. */
function mapsToArr(type_, time_, span_) {
    var map0 = []; // frequencies
    var map1 = []; // total displaced
    var sortArr = [];

    /* Create 'map0' based on 'crisisCategories' to determine what category is most frequent in 'time_'.
    * And create 'map1' to determine the total displaced for each category. */
    if (type_ === "hazCategory") {
        for (var i = 0; i < crisisCategories.length; i++) {
            map0[crisisCategories[i]] = 0;
            map1[crisisCategories[i]] = 0;
        }
        if (span_ === "year") {
            time_.forEach(function (d) {
                map0[d.hazCategory] += 1;
                map1[d.hazCategory] += d.displ;
            });
        }
        /* This if statement is dependent on the above one having been called. In other words, 'mapsToArr' is called
        * first where 'span_' = "year" in 'popCountries()' */
        if (span_ === "years") {
            time_.forEach(function (d) {
                d.totHazCategories.forEach (function (d) {
                    map0[d.hazCategory] += d.freq;
                    map1[d.hazCategory] += d.displCat;
                });
            });
        }
        for (var k = 0; k < crisisCategories.length; k++) {
            var obj = {};
            obj.hazCategory = crisisCategories[k];
            obj.freq = map0[crisisCategories[k]];
            obj.displCat = map1[crisisCategories[k]];
            sortArr.push(obj);
        }
    }

    /* Create a 'map0' based on 'hazardTypes' to determine what type is most frequent in 'time_'.
    * And create 'map1' to determine the total displaced for each type. */
    if (type_ === "haz") {
        for (var j = 0; j < hazardTypes.length; j++) {
            map0[hazardTypes[j]] = 0;
            map1[hazardTypes[j]] = 0;
        }
        if (span_ === "year") {
            time_.forEach(function (d) {
                map0[d.haz] += 1;
                map1[d.haz] += d.displ;
            });
        }
        /* This if statement is dependent on the above one having been called. In other words, 'mapsToArr' is called
            * first where 'span_' = "year" in 'popCountries()' */
        if (span_ === "years") {
            time_.forEach(function (d) {
                d.totHaz.forEach (function (d) {
                    map0[d.hazType] += d.freq;
                    map1[d.hazType] += d.displHaz;
                });
            });
        }
        for (var m = 0; m < hazardTypes.length; m++) {
            var obj = {};
            obj.hazType = hazardTypes[m];
            obj.freq = map0[hazardTypes[m]];
            obj.displHaz = map1[hazardTypes[m]];
            sortArr.push(obj);
        }
    }

    return sortArr.sort(function (a, b) {
        return b.freq - a.freq;
    });
}

/* 'popGeos' populates global variable 'geos', an object, with two properties, one for regions and one for subregions.
* The structure of the array of objects linked to those properties, mirrors 'countries'. */
function popGeos() {
    var regionNames = [];
    var subRegionNames = [];

    countries.forEach(function (d) {
        var code = d.geo.code;
        var region = d.geo.region;
        var subRegion = d.geo.subRegion;
        if (!regionNames.includes(region)) {
            regionNames.push(region);
        }
        if (!subRegionNames.includes(subRegion)) {
            subRegionNames.push(subRegion);
        }
    });

    /* Create maps for returning the total displaced for each region and subregion. */
    var mapRegion = [];
    var mapSubRegion = [];

    /* Instantiate maps with the region and subregion names as keys */
    for (var i = 0; i < regionNames.length; i++) {
        mapRegion[regionNames[i]] = 0;
    }
    for (var j = 0; j < subRegionNames.length; j++) {
        mapSubRegion[subRegionNames[j]] = 0;
    }

    /* Aggregate total displaced per region and subregion in maps */
    countries.forEach(function (d) {
        mapRegion[d.geo.region] += d.totDispl;
        mapSubRegion[d.geo.subRegion] += d.totDispl;
    });

    /* Create region objects */
    var allRegions = [];
    regionNames.forEach(function(d) {
        var obj = {};
        obj.region = d;
        obj.countries = getCountries(d, "region");
        obj.totDispl = mapRegion[d];
        obj.years = aggrYears(obj.countries);
        obj.totHazCategories = mapsToArr("hazCategory", obj.years, "years");
        obj.totHaz = mapsToArr("haz", obj.years, "years");
        allRegions.push(obj);
    });

    /* Create subregion objects */
    var allSubRegions = [];
    subRegionNames.forEach(function(d) {
        var obj = {};
        obj.subRegion = d;
        obj.countries = getCountries(d, "subRegion");
        obj.totDispl = mapSubRegion[d];
        obj.years = aggrYears(obj.countries);
        obj.totHazCategories = mapsToArr("hazCategory", obj.years, "years");
        obj.totHaz = mapsToArr("haz", obj.years, "years");
        allSubRegions.push(obj);
    });

    allRegions.sort(function (a, b) {
        return b.totDispl - a.totDispl;
    });
    geos.regions = allRegions;

    allSubRegions.sort(function (a, b) {
        return b.totDispl - a.totDispl;
    });
    geos.subRegions = allSubRegions;
}

/* 'getCountries' returns an array of objects or subset of 'countries' based on the specific 'place' passed through,
* which is either a region or subregion according to 'type'. */
function getCountries(place, type) {
    var places = [];

    countries.forEach(function (d) {
        if (type === "region" && d.geo.region === place) {
            places.push(d);
        }
        if (type === "subRegion" && d.geo.subRegion === place) {
            places.push(d);
        }
    });

    return places;
}

/* 'aggrYears' returns an array of objects, where each object tells a story about all that happened with regard to
disasters and displacements for the set of countries selected. */
function aggrYears(countries_) {
    var yrs = [];
    var tempYrs = [];

    countries_.forEach(function (d) {
        d.years.forEach(function (e) {
            tempYrs.push(e);
        });
    });
    tempYrs.sort(function (a, b) {
        return a.year - b.year;
    });

    for (var i = 2008; i < 2021; i++) {
        var objYr = {};
        objYr.year = i;
        objYr.dates = [];
        objYr.yrTotDispl = 0;
        objYr.totHazCategories = [];
        objYr.totHaz = [];

        tempYrs.forEach(function (d) {
            if (d.year === i) {
                d.dates.forEach(function (e) {
                    objYr.dates.push(e);
                });
                objYr.yrTotDispl += d.yrTotDispl;
            }
        });
        objYr.dates.sort(function (a, b) {
            return a.numDate - b.numDate;
        });

        objYr.totHazCategories = mapsToArr("hazCategory", objYr.dates, "year");
        objYr.totHaz = mapsToArr("haz", objYr.dates, "year");

        yrs.push(objYr);
    }

    return yrs;
}

/* 'explore' places can be 'countries', 'geos.regions', or 'geos.subRegions'. Basically produces three arrays,
'topPlaces', 'topHazCategories', and 'topHazTypes' for analysis. The number of top anything is determined by the
argument 'max'. If uncommented, prints discoveries to the console. Returns an object. */
function explore(places, name, max) {
    var category;

    if (places === countries) { category = "country"; }
    if (places === geos.regions) { category = "region"; }
    if (places === geos.subRegions) { category = "subRegion"; }

    /* Aggregate top places and their 'years' into two arrays */
    var topPlaces = [];
    var topYrs = [];

    /* Adjust loop for 'max' number of top places with most displaced */
    if (name === "regions" && max > 5) { max = 5; } // A fail safe since there are only 5 regions total.
    for (var i = 0; i < max; i++) {
        topPlaces.push(places[i]);
        places[i].years.forEach(function (d) {
            topYrs.push(d);
        });
    }

    /* Pass 'topYrs' into function 'mapToArr' to view specific crisis categories or hazard types and their
    respective frequencies. */
    var topHazCategories = mapsToArr("hazCategory", topYrs, "years");
    var topHazTypes = mapsToArr("haz", topYrs, "years");

    /* Print to console for analysis */
    // console.log("Top " + topPlaces.length + " " + name + " with greatest displacements (2008-2020):")
    // console.log(topPlaces);
    // console.log("Hazard categories sorted descending for top " + topPlaces.length + " " + name + ":")
    // console.log(topHazCategories);
    // console.log("Hazard types sorted descending for top " + topPlaces.length + " " + name + ":")
    // console.log(topHazTypes);

    var obj = {
        category: category,
        places: topPlaces,
        hazCategories: topHazCategories,
        hazTypes: topHazTypes
    };

    return obj;
}

/* disasterColorKey returns a map where the key is the hazard type and the value, an arbitrarily assigned color. */
function disasterColorKey() {
    var map = [];

    // map["Flood"] = "#2a3b90";
    // map["Storm"] = "#63808F";
    // map["Wildfire"] = "#990E17"; //"#7D0B13";
    // map["Earthquake"] = "#204e49"; // "#817C8A";
    // map["Volcano"] = "#FF4B0A";
    // map["Drought"] = "#817C8A"; // "#D6D2CE";
    // map["Massmovement"] = "#735937";
    // map["Extremetemperature"] = "#ac128f"; // "#E6FF96";
    // map["Severewintercondition"] = "#FFFFFF";
    // map["unknown"] = "#000000";

    map["Flood"] = "#285D82";
    map["Storm"] = "#93A7B5";
    map["Wildfire"] = "#822A28";
    map["Earthquake"] = "#204F4A";
    map["Volcano"] = "#F02D3A";
    map["Drought"] = "#817C8A";
    map["Massmovement"] = "#5C423D";
    map["Extremetemperature"] = "#4FC2B6";
    map["Severewintercondition"] = "#FFFFFF";
    map["unknown"] = "#000000";



    return map;
}

/* 'eventHandler' listens for keyboard interactions initiated through the choreographic interface. */
function eventHandler() {
    var choice = "";
    var counter = 0; // 'counter' progresses through individual places in 'topPlaces'
    var index = 0; // 'index' progresses through 2008-2020, maxing out at 12

    document.addEventListener("keyup", function (event) {

        // Listening for numerical keys associated with disaster type poses
        if (event.key === "0") {
            choice = "Neutral";
        }
        if (event.key === "f") {
            choice = "Flood";
            /* Check that 'choice' is one of the layers being visualized before redrawing viz to highlight it. */
            if (stackKeys.includes(choice)) {
                wrangleData(choice);
                if (index === 0) {
                    choreoA(topPlaces.places[counter], index + 1); // Need a span of 1 year for default viz
                }
                else {
                    choreoA(topPlaces.places[counter], index);
                }
                choreoB(index, "single");
            }
            else {
                choice = "";
            }
        } // Flood
        if (event.key === "s") {
            choice = "Storm";
            if (stackKeys.includes(choice)) {
                wrangleData(choice);
                if (index === 0) {
                    choreoA(topPlaces.places[counter], index + 1); // Need a span of 1 year for default viz
                }
                else {
                    choreoA(topPlaces.places[counter], index);
                }
                choreoB(index, "single");
            }
            else {
                choice = "";
            }
        } // Storm
        if (event.key === "w") {
            choice = "Wildfire";
            if (stackKeys.includes(choice)) {
                wrangleData(choice);
                if (index === 0) {
                    choreoA(topPlaces.places[counter], index + 1); // Need a span of 1 year for default viz
                }
                else {
                    choreoA(topPlaces.places[counter], index);
                }
                choreoB(index, "single");
            }
            else {
                choice = "";
            }
        } // Wildfire
        if (event.key === "e") {
            choice = "Earthquake";
            if (stackKeys.includes(choice)) {
                wrangleData(choice);
                if (index === 0) {
                    choreoA(topPlaces.places[counter], index + 1); // Need a span of 1 year for default viz
                }
                else {
                    choreoA(topPlaces.places[counter], index);
                }
                choreoB(index, "single");
            }
            else {
                choice = "";
            }
        } // Earthquake
        if (event.key === "v") {
            choice = "Volcano";
            if (stackKeys.includes(choice)) {
                wrangleData(choice);
                if (index === 0) {
                    choreoA(topPlaces.places[counter], index + 1); // Need a span of 1 year for default viz
                }
                else {
                    choreoA(topPlaces.places[counter], index);
                }
                choreoB(index, "single");
            }
            else {
                choice = "";
            }
        } // Volcano
        if (event.key === "d") {
            choice = "Drought";
            if (stackKeys.includes(choice)) {
                wrangleData(choice);
                if (index === 0) {
                    choreoA(topPlaces.places[counter], index + 1); // Need a span of 1 year for default viz
                }
                else {
                    choreoA(topPlaces.places[counter], index);
                }
                choreoB(index, "single");
            }
            else {
                choice = "";
            }
        } // Drought
        if (event.key === "m") {
            choice = "Mass movement";
            // Eliminate spaces for checking 'stackKeys' ("Mass movement" > "Massmovement")
            if (stackKeys.includes(choice.split(" ").join(""))) {
                wrangleData(choice);
                if (index === 0) {
                    choreoA(topPlaces.places[counter], index + 1); // Need a span of 1 year for default viz
                }
                else {
                    choreoA(topPlaces.places[counter], index);
                }
                choreoB(index, "single");
            }
            else {
                choice = "";
            }
        } // Mass movement
        if (event.key === "x") {
            choice = "Extreme temperature";
            if (stackKeys.includes(choice.split(" ").join(""))) {
                wrangleData(choice);
                if (index === 0) {
                    choreoA(topPlaces.places[counter], index + 1); // Need a span of 1 year for default viz
                }
                else {
                    choreoA(topPlaces.places[counter], index);
                }
                choreoB(index, "single");
            }
            else {
                choice = "";
            }
        } // Extreme temperature
        if (event.key === "c") {
            choice = "Severe winter condition";
            if (stackKeys.includes(choice.split(" ").join(""))) {
                wrangleData(choice);
                if (index === 0) {
                    choreoA(topPlaces.places[counter], index + 1); // Need a span of 1 year for default viz
                }
                else {
                    choreoA(topPlaces.places[counter], index);
                }
                choreoB(index, "single");
            }
            else {
                choice = "";
            }
        } // Severe winter condition

        // Listening for arrow keys to cycle through top places
        if (event.key === "ArrowRight") {
            if (counter < (topPlaces.places.length - 1)) {
                counter++;
                // Refresh visualization for new place in 'topPlaces'
                choice = "";
                wrangleData("");
                choreoA(topPlaces.places[counter], 1);
                hazardTypesRed = hazardTypes;
                colorMapRed = colorMap;
                // Refresh score table
                score = choreoScore(topPlaces.places[counter]);
                printScore(0);
                index = 0;
                choreoB(index, "year");
            }
        }
        if (event.key === "ArrowLeft") {
            if (counter >= 1) {
                counter--;
                // Refresh visualization for new place in 'topPlaces'
                choice = "";
                wrangleData("");
                choreoA(topPlaces.places[counter], 1);
                hazardTypesRed = hazardTypes;
                colorMapRed = colorMap;
                // Refresh score table
                score = choreoScore(topPlaces.places[counter]);
                printScore(0);
                index = 0;
                choreoB(index, "year");
            }
        }

        // Listening for 'n' (next) key to cycle froward through movement score
        if (event.key === "n") {
            if (index < 12) { // (2008-2020)
                index += 2; // advance score and viz by two years
                // Update score table
                printScore(index);
                // Reset visualization in case poses hid layers
                choice = "";
                wrangleData("");
                choreoA(topPlaces.places[counter], index);
                choreoB(index, "year");
                hazardTypesRed = hazardTypes;
                colorMapRed = colorMap;
            }
            // All rings are shown when "n" is pushed in 'main.js" after progressing through 2008-2020
            else if (index + 2 > 12) {
                choreoB(index, "all");
            }
        }

        // Listening for 'b' (back) key to cycle backward through movement score
        if (event.key === "b") {
            if (index >= 2) {
                index -= 2; // regress score and viz by two years
                // Update score table
                printScore(index);
                // Reset visualization in case poses hid layers
                choice = "";
                wrangleData("");
                if (index === 0) {
                    choreoA(topPlaces.places[counter], 1); //sets span to 2008-2009
                }
                else {
                    choreoA(topPlaces.places[counter], index);
                }

                hazardTypesRed = hazardTypes;
                colorMapRed = colorMap;
            }
        }

        // Add text above chart denoting place being visualized (e.g., China)
        var header = document.getElementById("choice");
        if (header.hasChildNodes()) {
            header.innerHTML = "";
        }
        var text = document.createTextNode(choice);
        header.appendChild(text);
    });
}

/* 'choreoScore' uses Lodash to make a deep copy of key data structures from 'place' that are then simplified into a
    movement score. */
function choreoScore(place) {
    var years = [];

    // Scales
    var stepScale = d3.scaleLog().range([1, 5]); // returns number of steps to be taken
    var repScale = d3.scaleLog().range([1, 5]); // returns number of repetitions to be danced
    var domStep;
    var domRep;

    domStep = getDomainY(place); // 'getDomainY' is a function of choreoA.js
    domStep[0] = 1; // Set least to 1 to work with log scale
    stepScale.domain(domStep);

    domRep = getDomainRep(place);
    repScale.domain(domRep);

    for (var j = 0; j < place.years.length; j++) {
        var obj = {};
        // CHANGES MADE TO DISASTERS WAS CHANGING 'place.years[j].totHaz'. Discovered Lodash to solve this pointer issue.
        var disasters = _.cloneDeep(place.years[j].totHaz);

        // Reorganize disasters
        disasters.sort(function (a, b) {
            return b.displHaz - a.displHaz // Most to least displacements
        });
        // Delete disasters with 0 frequencies or displacements
        for (var i = 0; i < disasters.length; i++) {
            if (disasters[i].freq === 0 || disasters[i].displHaz === 0) {
                disasters.splice(i, 1);
                i--;
            }
        }
        disasters.forEach(function (e) {
            // Add new keys
            e.reps = Math.round(repScale(e.freq)); // # of repetitions for disaster pose rounded to nearest integer
            e.steps = Math.round(stepScale(e.displHaz)); // # of steps for disaster rounded to nearest integer
        });

        obj.year = place.years[j].year;
        obj.disasters = disasters;
        years.push(obj);
    }

    years.sort(function (a, b) {
        return a.year - b.year;
    });

    return years;
}

/* 'getDomainRep' returns the domain from least to most 'freq' over all disasters/years */
function getDomainRep(place) {
    var most = 0;

    place.years.forEach(function (d) {
        d.totHaz.forEach(function (e) {
            if (e.freq > most) { most = e.freq }
        });
    });

    return [1, most]; // Set least to 1 for log scale
}

/* 'printScore' fills in #choreoATable setup in index.html with movement and text score */
function printScore(index) {

    var alphabet = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] // Using letters since <table> IDs must start with one
    var updated = [];
    var id;

    // Add new text to score table in 'index.html'
    for (var i = 0; i < score[index].disasters.length; i++) {
        id = alphabet[i];
        updated.push(i);
        for (var j = 0; j < 5; j++) {
            id += j.toString();
            // Add text
            if (j === 0) {
                document.getElementById(id).innerHTML = score[index].disasters[i].hazType;

                // Change color of text to serve as a color key
                var key = score[index].disasters[i].hazType.split(" ").join(""); //remove spaces from disaster name like "Wet mass movement"
                document.getElementById(id).style.color = colorMap[key];
            }
            if (j === 1) {
                document.getElementById(id).innerHTML = score[index].disasters[i].reps;

                // Change color of text to serve as a color key
                var key = score[index].disasters[i].hazType.split(" ").join(""); //remove spaces from disaster name like "Wet mass movement"
                document.getElementById(id).style.color = colorMap[key];
            }
            if (j === 2) {
                var frequency = score[index].disasters[i].freq;
                frequency = frequency.toLocaleString('en-US'); // convert to string and add commas
                document.getElementById(id).innerHTML = "(" + frequency + ")";

                // Change color of text to serve as a color key
                var key = score[index].disasters[i].hazType.split(" ").join(""); //remove spaces from disaster name like "Wet mass movement"
                document.getElementById(id).style.color = colorMap[key];
            }
            if (j === 3) {
                document.getElementById(id).innerHTML = score[index].disasters[i].steps;

                // Change color of text to serve as a color key
                var key = score[index].disasters[i].hazType.split(" ").join(""); //remove spaces from disaster name like "Wet mass movement"
                document.getElementById(id).style.color = colorMap[key];
            }
            if (j === 4) {
                var displacements = score[index].disasters[i].displHaz;
                displacements = displacements.toLocaleString('en-US'); // convert to string and add commas
                document.getElementById(id).innerHTML = "(" + displacements + ")";

                // Change color of text to serve as a color key
                var key = score[index].disasters[i].hazType.split(" ").join(""); //remove spaces from disaster name like "Wet mass movement"
                document.getElementById(id).style.color = colorMap[key];
            }
            id = id.slice(0, (id.length - 1));
        }
        document.getElementById("time").innerHTML = score[index].year + " Logarithmic Movement Score";

        //Remove any remaining text from score table in 'index.html' not replaced above
        for (var k = 0; k < alphabet.length; k++) {
            if (!updated.includes(k)) {
                id = alphabet[k];
                for (var m = 0; m < 5; m++) {
                    id += m.toString();
                    // Remove old text
                    if (document.getElementById(id) !== null) {
                        document.getElementById(id).innerHTML = "";
                    }

                    id = id.slice(0, (id.length - 1));
                }
            }
        }
    }
}

/* END 'setupData' HELPER FUNCTIONS: */


/* 'wrangleData' accepts 'choice', a disaster type coinciding with a key event. It organizes 'hazardTypesRed' and
*   'colorMapRed' to be the accumulation of all 12 disasters before clearing both arrays. Visually, this allows the
*   layers to be added one-by-one to the stack chart. */
function wrangleData(choice) {
    // for building colorMapRed
    var key;
    var value;

    if (choice === "") {
        hazardTypesRed = hazardTypes;
        colorMapRed = colorMap;
    }
    else {
        if (hazardTypesRed.length === hazardTypes.length) {
            hazardTypesRed = [];
            hazardTypesRed.push(choice);

            colorMapRed = [];
            key = choice.split(" ").join("");
            value = colorMap[key];
            colorMapRed[key] = value;
        }
        else if (hazardTypesRed.length < hazardTypes.length && !hazardTypesRed.includes(choice)) {
            hazardTypesRed.push(choice);

            key = choice.split(" ").join("");
            value = colorMap[key];
            colorMapRed[key] = value;
        }
    }
}