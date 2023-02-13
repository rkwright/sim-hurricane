/**
 * Originally from https://github.com/springmeyer/arc.js/
 * Includes a partial port of dateline handling from: gdal/ogr/ogrgeometryfactory.cpp
 * TODO - does not handle all wrapping scenarios yet
 * Forked and cleaned up by rkwright, January 2018
 */

'use strict';

/**
 * Constants
 */
var GREATCIRCLE = {
    revision: '1.1'
};

/**
 * http://en.wikipedia.org/wiki/Great-circle_distance
 *
 * @constructor
 */
function GreatCircle() {
}

GreatCircle.prototype = {

    /**
     * Generate points along the great circle
     *
     * @param start, in degrees
     * @param end, in degrees
     * @param npoints
     * @param options
     * @returns {Array}
     */
    generateArc: function( start, end, npoints, options ) {

        // intialize all the class variables for this arc
        this.initArc( start, end );

        var first_pass = [];
        if (!npoints || npoints <= 2) {
            first_pass.push([this.start.lon, this.start.lat]);
            first_pass.push([this.end.lon, this.end.lat]);
        }
        else {
            var delta = 1.0 / (npoints - 1);
            for (var i = 0; i < npoints; ++i) {
                var step = delta * i;
                var pair = this.interpolate(step);
                first_pass.push(pair);
            }
        }

        var dateLine = this.checkDateLine( first_pass, options );

        var poMulti = [];
        if (dateLine)
            poMulti = this.handleDateLine( first_pass );
        else {
            // add normally
            var poNewLS0 = [];
            poMulti.push(poNewLS0);
            for (var l = 0; l < first_pass.length; ++l) {
                poNewLS0.push([first_pass[l][0], first_pass[l][1]]);
            }
        }

        return poMulti;
    },

    /**
     * @param start, in degrees
     * @param end, in degrees
     */
    initArc: function  ( start, end ) {

        if (!start || start.lon === undefined || start.lat === undefined ||
            !end || end.lon === undefined || end.lat === undefined) {
            throw new Error("GreatCircle constructor expects two args: start and end objects with x and y properties");
        }

        this.startLon = Math.toRad(start.lon);
        this.startLat = Math.toRad(start.lat);

        this.endLon = Math.toRad(end.lon);
        this.endLat = Math.toRad(end.lat);

        var w = this.startLon - this.endLon;
        var h = this.startLat - this.endLat;
        var z = Math.sqr(Math.sin(h / 2.0)) + Math.cos(this.startLat) * Math.cos(this.endLat) * Math.sqr(Math.sin(w / 2.0));
        this.g = 2.0 * Math.asin(Math.sqrt(z));

        this.dateLineOffset = 0;
        this.leftBorderX    = 0;
        this.rightBorderX   = 0;
        this.diffSpace      = 0;

        if (this.g === Math.PI) {
            throw new Error('it appears ' + start.view() + ' and ' + end.view() + " are 'antipodal', e.g diametrically opposite, thus there is no single route but rather infinite");
        } else if (isNaN(this.g)) {
            throw new Error('could not calculate great circle between ' + start + ' and ' + end);
        }
    },

    /*
     * http://williams.best.vwh.net/avform.htm#Intermediate
     */
    interpolate: function(f) {
        var A = Math.sin((1 - f) * this.g) / Math.sin(this.g);
        var B = Math.sin(f * this.g) / Math.sin(this.g);
        var x = A * Math.cos(this.startLat) * Math.cos(this.startLon) + B * Math.cos(this.endLat) * Math.cos(this.endLon);
        var y = A * Math.cos(this.startLat) * Math.sin(this.startLon) + B * Math.cos(this.endLat) * Math.sin(this.endLon);
        var z = A * Math.sin(this.startLat) + B * Math.sin(this.endLat);
        var lat = Math.toDeg(Math.atan2(z, Math.sqrt(Math.sqr(x) + Math.sqr(y))));
        var lon = Math.toDeg(Math.atan2(y, x));
        return [lon, lat];
    },

    /**
     * See if the proposed great circle arc would cross the dateline, if so, handle it specially
     * @param first_pass
     * @param options
     * @returns {boolean}
     */
    checkDateLine: function( first_pass, options ) {
        var bHasBigDiff = false;
        var dfMaxSmallDiffLong = 0;
        // from http://www.gdal.org/ogr2ogr.html
        // (starting with GDAL 1.10) offset from dateline in degrees (default lon = +/- 10deg,
        // so geometries within 170deg to -170deg will be split)
        this.dateLineOffset = options && options.offset ? options.offset : 10;
        this.leftBorderX = 180 - this.dateLineOffset;
        this.rightBorderX = -180 + this.dateLineOffset;
        this.diffSpace = 360 - this.dateLineOffset;

        // https://github.com/OSGeo/gdal/blob/7bfb9c452a59aac958bff0c8386b891edf8154ca/gdal/ogr/ogrgeometryfactory.cpp#L2342
        for (var j = 1; j < first_pass.length; ++j) {
            var dfPrevX = first_pass[j - 1][0];
            var dfX = first_pass[j][0];
            var dfDiffLong = Math.abs(dfX - dfPrevX);
            if (dfDiffLong > this.diffSpace &&
                ((dfX > this.leftBorderX && dfPrevX < this.rightBorderX) || (dfPrevX > this.leftBorderX && dfX < this.rightBorderX))) {
                bHasBigDiff = true;
            } else if (dfDiffLong > dfMaxSmallDiffLong) {
                dfMaxSmallDiffLong = dfDiffLong;
            }
        }
        return bHasBigDiff && dfMaxSmallDiffLong < this.dateLineOffset;
    },

    /**
     * Take care of splitting the generated arcs across the dateline
     * @param first_pass
     * @returns {Array}
     */
    handleDateLine: function ( first_pass ) {
        var poMulti = [];
        var poNewLS = [];

        poMulti.push(poNewLS);
        for (var k = 0; k < first_pass.length; ++k) {
            var dfX0 = parseFloat(first_pass[k][0]);
            if (k > 0 && Math.abs(dfX0 - first_pass[k - 1][0]) > this.diffSpace) {
                var dfX1 = parseFloat(first_pass[k - 1][0]);
                var dfY1 = parseFloat(first_pass[k - 1][1]);
                var dfX2 = parseFloat(first_pass[k][0]);
                var dfY2 = parseFloat(first_pass[k][1]);
                if (dfX1 > -180 && dfX1 < this.rightBorderX && dfX2 === 180 &&
                    k + 1 < first_pass.length &&
                    first_pass[k - 1][0] > -180 && first_pass[k - 1][0] < this.rightBorderX) {
                    poNewLS.push([-180, first_pass[k][1]]);
                    k++;
                    poNewLS.push([first_pass[k][0], first_pass[k][1]]);
                    continue;
                }
                else if (dfX1 > this.leftBorderX && dfX1 < 180 && dfX2 === -180 &&
                    k + 1 < first_pass.length &&
                    first_pass[k - 1][0] > this.leftBorderX && first_pass[k - 1][0] < 180) {
                    poNewLS.push([180, first_pass[k][1]]);
                    k++;
                    poNewLS.push([first_pass[k][0], first_pass[k][1]]);
                    continue;
                }

                if (dfX1 < this.rightBorderX && dfX2 > this.leftBorderX) {
                    Math.swap(dfX1, dfX2);
                    Math.swap(dfY1, dfY2);
                }
                if (dfX1 > this.leftBorderX && dfX2 < this.rightBorderX) {
                    dfX2 += 360;
                }

                if (dfX1 <= 180 && dfX2 >= 180 && dfX1 < dfX2) {
                    var dfRatio = (180 - dfX1) / (dfX2 - dfX1);
                    var dfY = dfRatio * dfY2 + (1 - dfRatio) * dfY1;
                    poNewLS.push([first_pass[k - 1][0] > this.leftBorderX ? 180 : -180, dfY]);
                    poNewLS = [];
                    poNewLS.push([first_pass[k - 1][0] > this.leftBorderX ? -180 : 180, dfY]);
                    poMulti.push(poNewLS);
                }
                else {
                    poNewLS = [];
                    poMulti.push(poNewLS);
                }
                poNewLS.push([dfX0, first_pass[k][1]]);
            } else {
                poNewLS.push([first_pass[k][0], first_pass[k][1]]);
            }
        }

        return poMulti;
    }
};
