/*
 * Storm-data loading facilities.  This is based on loading the JSON file derived from the
 * hurrdat2 data file as documented in www.nhc.noaa.gov/data/hurdat/hurdat2-format-atlantic.pdf
 *
 * 2021 (Spaces 1-4) – Year
 * 08 (Spaces 5-6) – Month
 * 29 (Spaces 7-8, before 1st comma) – Day
 * 16 (Spaces 11-12) – Hours in UTC (Universal Time Coordinate)
 * 55 (Spaces 13-14, before 2nd comma) – Minutes
 * L (Space 17, before 3rd comma) – Record identifier (see notes below)
 * C – Closest approach to a coast, not followed by a landfall
 * G – Genesis
 * I – An intensity peak in terms of both pressure and wind
 * L – Landfall (center of system crossing a coastline)
 * P – Minimum in central pressure
 * R – Provides additional detail on the intensity of the cyclone when rapid changes are underway
 * S – Change of status of the system
 * T – Provides additional detail on the track (position) of the cyclone
 * W – Maximum sustained wind speed
 * HU (Spaces 20-21, before 4th comma) – Status of system. Options are:
 * TD – Tropical cyclone of tropical depression intensity (< 34 knots)
 * TS – Tropical cyclone of tropical storm intensity (34-63 knots)
 * HU – Tropical cyclone of hurricane intensity (> 64 knots)
 * EX – Extratropical cyclone (of any intensity)
 * SD – Subtropical cyclone of subtropical depression intensity (< 34 knots)
 * SS – Subtropical cyclone of subtropical storm intensity (> 34 knots)
 * LO – A low that is neither a tropical cyclone, a subtropical cyclone, nor an extratropical cyclone (of any intensity)
 * WV – Tropical Wave (of any intensity)
 * DB – Disturbance (of any intensity)
 * 29.1 (Spaces 24-27) – Latitude
 * N (Space 28, before 5th comma) – Hemisphere – North or South
 * 90.2 (Spaces 31-35) – Longitude
 * W (Space 36, before 6th comma) – Hemisphere – West or East
 * 130 (Spaces 39-41, before 7th comma) – Maximum sustained wind (in knots)
 *
 * @author rkwright / www.geofx.com
 *
 * Copyright 2017, All rights reserved.
 */

'use strict';

class StormFile {

    // Constants
    REVISION =  '1.0';

    // constructor
    constructor () {
        this.stormFile = undefined;
        this.jsonData = undefined;

        this.skipped = [];
        this.index = 0;

        window.stormThis = this;
    }

    // class methods

    /**
     * Load the data from the specified JSON file, then parse the resulting payload
     * @param stormFile
     * @param stormLoaded
     */
    loadData ( stormFile, stormsLoaded ) {

        this.stormFile  = stormFile;
        this.stormsLoaded = stormsLoaded;

        this.loadJSON(function (response) {
            // Parse JSON string into object
            try {
                stormThis.jsonData = JSON.parse(response);

                if (stormThis.pruneStorms()) {
                    stormThis.stormsLoaded();
                }

            } catch (e) {
                if (e instanceof SyntaxError) {
                    console.error(e, true);
                } else {
                    console.error(e, false);
                }
            }
        });
    }

    /**
     * Load the current stormfile
     * @param callbackl
     */
     loadJSON ( callback ) {

         var s = 0;
        var xobj = new XMLHttpRequest();
        xobj.overrideMimeType("application/json");
        xobj.open('GET', this.stormFile, true);
        xobj.onreadystatechange = function () {
            if (xobj.readyState === XMLHttpRequest.HEADERS_RECEIVED) {
                console.log(xobj.getAllResponseHeaders());
            }

            if (xobj.readyState === XMLHttpRequest.DONE && xobj.status === HttpStatus.OK) {
                // Required use of an anonymous callback as .open will NOT return a value
                // but simply returns undefined in asynchronous mode
                callback(xobj.responseText);
            }
        };
        xobj.send(null);
    }

    /**
     * Getter for the JSON data
     * @returns {*}
     */
    getJSON () {
        return this.jsonData;
    }

    /**
     * Walk through the JSON data and for each storm, remove any storm with 3
     * or more consecutive entries with MISSING data. For storms with missing data (<3)
     * interpolate the missing data.
     */
    dumpStorms () {

        for ( var i in this.jsonData.storms ) {
            var storm = this.jsonData.storms[i];

        }
    }
    /**
     * Walk through the JSON data and for each storm, remove any storm with 3
     * or more consecutive entries with MISSING data. For storms with missing data (<3)
     * interpolate the missing data.
     */
    pruneStorms () {

        for ( var i in this.jsonData.storms ) {
            var storm = this.jsonData.storms[i];
            this.convertNASADates( storm );
            //this.fillMissingValues( storm );
        }
    }

    /**
     * For this storm,  convert the NASA-style (F77) dates to JS Data
     * @param storm
     */
    convertNASADates ( storm ) {
        for ( var i in storm.entries ) {
            var entry = storm.entries[i];
            entry.date = this.getUTCDate(entry);
        }
    }

    /**
     * Checks the values for lat/lon, pressure and windspeed.
     * If any of the values are missing (-999), then the value
     * needs to be computed via linear interpolation.
     * @param storm
     */
    fillMissingValues ( storm ) {
        // this.fillMissingValuesByCol( storm, StormData.LAT);
        //this.fillMissingValuesByCol( storm, StormData.LON);
        //this.fillMissingValuesByCol( storm, StormData.MAXWIND);
        this.fillMissingValuesByCol( storm, StormData.MINPRESS);
    }

    linearInterp ( entries, col ) {

        if (index < 1 || index >= entries.length)
            return false;

        if ( entries[index-1][col] !== StormData.MISSING || entries[index+1][col] !== StormData.MISSING )
            return false;

        var t = entries[index-1][col] + t * (entries[index-+1][col] - entries[index-1][col])

        entries[index][col] = entries[index-1][col] + t * (entries[index+1][col] - entries[index-1][col])
    }

    /**
     *
     * @param storm
     * @param col
     */
    fillMissingValuesByCol ( storm, col ) {

        this.skipped = [];
        this.index   = 0;

        while ( this.getNextEntry() ) {

            var curEnt = entries[this.index];
            if (curEnt[col] === StormData.MISSING) {
                console.log("Handling missing value here");
                if (this.linearInterp( curEnt, col )) {

                }
                else if ( this.lerp( curEnt, col ) ) {

                }
            }
        }
    }
    getNextEntry ( entries, skipped ) {
        if ( skipped.length > 0) {
            this.index = skipped.pop();
            return true;
        }
        else if (this.index < entries.length) {
            return true;
        }

        return false;
    }

    /**
     * Given a NASA-style UNIX date, return the JavaScript UTC date object
     * @param entry
     * @returns {Date}
     */
    getUTCDate ( entry ) {
        var hours = Math.floor( entry[StormData.TIME] / 100 );
        var minutes  = entry[StormData.TIME] % 100;
        return new Date( Date.UTC(
            entry[StormData.YEAR],
            entry[StormData.MONTH],
            entry[StormData.DAY],
            hours,
            minutes));
    }

    /**
     * Searches the current JSON data-file and returns an array of all the years
     * with storm data. Years are 4-digit Numbers.
     */
    getYearsWithStorms () {
        var results = [];
        var storm;
        var lastYear = undefined;

        for (var index in this.jsonData.storms ) {
            storm = this.jsonData.storms[index];
            if (storm && storm.entries[0][0] !== lastYear) {
                results.push(storm.entries[0][0]);
                lastYear = storm.entries[0][0];
            }
        }

        return results;
    }

    /**
     * Searches the currrent JSON data file and returns an array of the storms that occurred
     * during the specified year. Storms are returned as an array of StormData objects.
     * @param year
     */
    getStormsForYear ( year ) {
        var results = [];
        var storm;

        for (var index = 0; index < this.jsonData.storms.length; index++) {
            storm = this.jsonData.storms[index];
            if (storm && storm.entries[0][0] === year) {
                results.push(storm);
            }
        }

        return results;
    }

    /**
     * For each storm, fetch the ATCID and Name, concatenate them and add
     * them to the array
     *
     * @param storms
     * @returns {Array}
     */
    getStormLabels ( storms ) {
        var results = [];
        var storm;
        var mois = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

        for (var index = 0; index < storms.length; index++) {
            storm = storms[index];
            var entry = storm.entries[0];
            var start = mois[entry[1]] + " " + entry[2];
            if (storm) {
                var label = storm.atcID + " : " + storm.name + " : " + start;
                results.push(label);
            }
        }

        return results;
    }

    /**
     * Construct an array of strings which comprises the data in each entry
     * @param storm
     * @returns {Array}
     */
    getEntryLabels ( storm ) {
        var results = [];
        var entry;
        var label;

        for (var index = 0; index < storm.entries.length; index++) {
            entry = storm.entries[index];
            if (entry) {
                label = entry[2] + " " + this.pad("0000", entry[3], true).substring(0, 2) + "h " + entry[6].toFixed(1) + " " +
                    entry[7].toFixed(1) + " " + entry[8].toFixed(0) + " " + entry[9].toFixed(0);

                results.push(label);
            }
        }

        return results;
    }

    /**
     * Pad a string with specified chars, left or right
     * For example, to zero pad a number to a length of 10 digits,
     *     pad('0000000000',123,true);  ->   "0000000123"
     *
     * @param pad       the string to fill
     * @param str       the string to be padded
     * @param padLeft   padding on the left or right
     * @returns {*}
     */
    pad ( pad, str, padLeft ) {
        if (typeof str === 'undefined')
            return pad;
        if (padLeft) {
            return (pad + str).slice(-pad.length);
        } else {
            return (str + pad).substring(0, pad.length);
        }
    }
}
