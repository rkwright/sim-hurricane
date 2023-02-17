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
    REVISION =  '1.1.0';

    // contents of the fields in the HURRDAT2 file
    static YEAR     = 0;
    static MONTH    = 1;
    static DAY      = 2;
    static TIME     = 3;    // an integer in 24 hour format, e.g. 600, 1200, etc.
    static EVENT    = 4;    // e.g. landfall, etc.  Usually blank
    static STATUS   = 5;    // e.g. HU, TS, etc.
    static LAT      = 6;    // in degrees with sign
    static LON      = 7;    // in degrees with sign
    static MAXWIND  = 8;    // in knots
    static MINPRESS = 9;    // in mb

    static MISSING  = -999;

    // constructor
    constructor () {

        this.index = 0;

        window.stormThis = this;
    }

    // class methods

    /**
     * Load the data from the specified JSON file, then parse the resulting payload
     * @param stormFile
     * @param stormsLoaded
     */
    loadData ( stormFile, stormsLoaded ) {

        this.stormFile  = stormFile;
        this.stormsLoaded = stormsLoaded;

        this.loadJSON(function (response) {
            // Parse JSON string into object
            try {
                stormThis.jsonData = JSON.parse(response);

                //stormThis.validateStorms();

                if (stormThis.validateStorms()) {
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
     * @param callBack
     */
     loadJSON ( callBack ) {

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
                callBack(xobj.responseText);
            }
        };
        xobj.send(null);
    }

    /**
     * Walk through the JSON data and for each storm, remove any storm with
     * consecutive entries with MISSING data. For storms with missing data
     * interpolate the missing data.
     */
    validateStorms () {

        for ( let i in this.jsonData.storms ) {
            let storm = this.jsonData.storms[i];
            //console.log(storm.atcID + ": " + storm.name + " n: " + storm.entries.length);
            for ( let n in storm.entries ) {
                let entry = storm.entries[n];
           }
        }

        return true;
    }

    /**
     *
     * @param entries
     * @param col
     */
    linearInterp ( entries, col ) {

    }

    /**
     * Given a NASA-style UNIX date, return the JavaScript UTC date object
     * @param entry
     * @returns {Date}
     */
    getUTCDate ( entry ) {
        var hours = Math.floor( entry[StormFile.TIME] / 100 );
        var minutes  = entry[StormFile.TIME] % 100;
        return new Date( Date.UTC(
            entry[StormFile.YEAR],
            entry[StormFile.MONTH],
            entry[StormFile.DAY],
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
}
