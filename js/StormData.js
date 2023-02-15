/*
 * Storm Data.  The object represents a single storm for the hurricane modelling
 *
 * @author rkwright / www.geofx.com
 *
 * Copyright 2018, All rights reserved.
 *
 */

class StormData  {

    // constants
    static REVISION = "1.1";

    /**
     * @constructor
     */
    constructor() {
        this.atcID = undefined;
        this.name = undefined;
        this.entries = [];
    };

    // ----- Constants ------
    static SAFFIR =  [
        {cat: '5', minMPH: 157, color: 0xff6060},
        {cat: '4', minMPH: 130, color: 0xff8f20},
        {cat: '3', minMPH: 111, color: 0xffc140},
        {cat: '2', minMPH: 96, color: 0xffe775},
        {cat: '1', minMPH: 74, color: 0xffffcc},
        {cat: 'TS', minMPH: 39, color: 0x01faf4},
        {cat: 'TD', minMPH: 33, color: 0x5dbaff}
    ];

    // contents of the entry fields
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

    // class methods

    /**
     * Return the Saffir-Simpson category for the specified windspeed, in MPH
     * @param windSpeed
     * @returns {*}
     */
    getSaffirCat (windSpeed) {
        for (var i = 0; i < StormData.SAFFIR.length - 1; i++) {
            if (windSpeed >= StormData.SAFFIR[i].minMPH)
                break;
        }

        return i;
    }
}

