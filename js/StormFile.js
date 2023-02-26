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
 *      C – Closest approach to a coast, not followed by a landfall
 *      G – Genesis
 *      I – An intensity peak in terms of both pressure and wind
 *      L – Landfall (center of system crossing a coastline)
 *      P – Minimum in central pressure
 *      R – Provides additional detail on the intensity of the cyclone when rapid changes are underway
 *      S – Change of status of the system
 *      T – Provides additional detail on the track (position) of the cyclone
 *      W – Maximum sustained wind speed
 *  HU (Spaces 20-21, before 4th comma) – Status of system. Options are:
 *      TD – Tropical cyclone of tropical depression intensity (< 34 knots)
 *      TS – Tropical cyclone of tropical storm intensity (34-63 knots)
 *      HU – Tropical cyclone of hurricane intensity (> 64 knots)
 *      EX – Extratropical cyclone (of any intensity)
 *      SD – Subtropical cyclone of subtropical depression intensity (< 34 knots)
 *      SS – Subtropical cyclone of subtropical storm intensity (> 34 knots)
 *      LO – A low that is neither a tropical cyclone, subtropical cyclone, nor extratropical cyclone (of any intensity)
 *      WV – Tropical Wave (of any intensity)
 *      DB – Disturbance (of any intensity)
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

    //--- Constants ---
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
    static YEARZERO = 1851;

    //--- class methods ---

    constructor () {

        this.julian = new Julian();
        window.stormThis = this;
    }

    /**
     * Load the data from the specified JSON file, then parse the resulting payload
     * @param stormURL
     * @param stormsLoaded
     */
    loadData ( stormURL, stormsLoaded ) {

        this.stormURL  = stormURL;
        this.stormsLoaded = stormsLoaded;

        this.loadJSON(function (response) {
            // Parse JSON string into object
            try {
                stormThis.jsonData = JSON.parse(response);

                if (stormThis.validateStorms()) {
                   stormThis.stormsLoaded();
                }

            } catch (e) {
                console.error(e, (e instanceof SyntaxError));
            }
        });
    }

    /**
     * Load the current stormfile
     * @param callBack
     */
     loadJSON ( callBack ) {

        let xobj = new XMLHttpRequest();
        xobj.overrideMimeType("application/json");
        xobj.open('GET', this.stormURL, true);
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
     * consecutive entries with MISSING data. For storms with single instancess of
     * missing data interpolate the missing data.
     */
    validateStorms () {

        let i = 0;
        while ( i < this.jsonData.storms.length ) {
            let storm = this.jsonData.storms[i];

            let t0 = this.getStormTime( storm.entries[0] );
            let t1 = this.getStormTime( storm.entries[storm.entries.length-1] );
            let stormLen = t1 - t0;
            let missing = -1;

            for ( let n in storm.entries ) {
                let entry = storm.entries[n];
                entry.tProp = stormLen > 0 ? ( this.getStormTime(entry) - t0 ) / stormLen : 0.0;

                if (this.checkForMissing( entry, storm.entries, n )) {
                    missing = n;
                    break;
                }
            }

            // if we detected missing data, delete this storm
            if (missing !== -1) {
                this.jsonData.storms.splice( i, 1)
             }
            else {
                i++;
            }
        }

        return true;
    }

    /**
     * Check for any missing entries.  If found and the missing value cannot be interpolated
     * then return true. Else interpolate the missing value and return false
     * @param entry
     */
    checkForMissing ( entry ) {

        for (let k in entry) {
            if (entry[k] === StormFile.MISSING) {
                return true;
            }
        }

        return false;
    }

    /**
     * Create the array of StormParms.  This is really just a convenience for the model implementation.
     * @returns {number}
     */
    createStormArray ( stormArray ) {
        let stormParm = new StormParm();

        for (let i in this.jsonData.storms) {
            let storm = this.jsonData.storms[i];
            let entry = storm.entries[0];

            console.log();

            stormParm.x = entry[StormFile.LON];
            stormParm.y = entry[StormFile.LAT];
            stormParm.pressure = entry[StormFile.MINPRESS];
            stormParm.fwdVelocity = -1;  // compute!
            stormParm.heading = -1;      // compute!
            stormParm.windspeed = entry[StormFile.MAXWIND];
            stormParm.day = entry[StormFile.DAY];
            stormParm.month = entry[StormFile.MONTH];
            stormParm.year = entry[StormFile.YEAR];
            stormParm.julianDay = this.julian.getJulian( entry[StormFile.DAY], entry[StormFile.MONTH], entry[StormFile.YEAR],);;
            stormParm.hour = entry[StormFile.TIME];    // 0,600,1200,1800

            stormArray.push( stormParm );
        }
    }

    /**
     * For this storm, calculate the number of hours since January 1, 1851
     * @param entry
     * @returns {number}
     */
    getStormTime ( entry ) {
        let hours = Math.floor( entry[StormFile.TIME] / 100 );
        let years = entry[StormFile.YEAR] - StormFile.YEARZERO;
        let jDays = this.julian.getJulian( entry[StormFile.DAY], entry[StormFile.MONTH], entry[StormFile.YEAR],);
        return years * (24*365) + hours +  jDays * 24;
    }

    /**
     * Given a NASA-style UNIX date, return the JavaScript UTC date object
     * @param entry
     * @param t0
     * @param t1
     * @returns {Date}
     */
    getJSDate ( entry, t0, t1 ) {
        let hours = Math.floor( entry[StormFile.TIME] / 100 );
        return new Date( Date.UTC( entry[StormFile.YEAR],
                                   entry[StormFile.MONTH],
                                   entry[StormFile.DAY],
                                   hours,0));
    }

    /**
     * Searches the current JSON data-file and returns an array of all the years
     * with storm data. Years are 4-digit Numbers.
     */
    getYearsWithStorms () {
        let results = [];
        let storm;
        let lastYear = undefined;

        for ( let index in this.jsonData.storms ) {
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
        let results = [];
        let storm;

        for ( let index in this.jsonData.storms ) {
            storm = this.jsonData.storms[index];
            if (storm && storm.entries[0][0] === year) {
                results.push(storm);
            }
        }

        return results;
    }
}
