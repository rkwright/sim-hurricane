/*
 * math-ext
 *
 * Add some missing methods to the Math object
 *
 * @author rkwright / www.geofx.com
 *
 * Copyright 2018, All rights reserved.
 */

Math.QUARTER_PI = Math.PI / 4;
Math.HALF_PI    = Math.PI / 2;
Math.TWO_PI     = Math.PI*2;
Math.RAD2DEG    = 180 / Math.PI;

Math.sqr    = function (arg) { return arg*arg; };
Math.fmod   = function (a,b) { return Number((a - (Math.floor(a / b) * b)).toPrecision(8)); };
Math.toRad  = function (angle) { return angle * (Math.PI / 180); };
Math.toDeg  = function (angle) { return angle * (180 / Math.PI); };
Math.clamp  = function (cv, lo, hi) { return ((cv > hi) ? hi : ((cv < lo) ? lo : cv)); };
Math.hypot  = function (x, y) { return Math.sqrt(x * x + y * y); };
Math.roundi = function (a) { return (a < 0) ? Math.round(a - 0.5) : Math.round(a + 0.5); };

Math.wrapAng = function( arg, loLim, upLim, incr ){
    while (arg > upLim)
        arg -= incr;

    while (arg < loLim)
        arg += incr;

    return arg;
};

/**
 * Reduces a normal vector specified as a set of three coordinates,
 * to a unit normal vector of length one.
 * @param vector
 */
Math.reduceToUnit = function (  vector ) {
    let	length;

    // Calculate the length of the vector
    length = Math.sqrt((vector.x*vector.x) + (vector.y*vector.y) + (vector.z*vector.z));

    // Keep the program from blowing up by providing an acceptable
    // value for vectors that may have been calculated too close to zero.
    if (length === 0.0)
        length = 1.0;

    // Dividing each element by the length will result in a unit normal vector.
    vector.x /= length;
    vector.y /= length;
    vector.z /= length;
}

/**
 * Points p1, p2, & p3 specified in counter clock-wise order
 * @param v0
 * @param v1
 * @param v2
 * @returns {{}}
 */
Math.calcNormal = function( v0, v1, v2 ) {
    let  	va = {};
    let   	vb = {};
    let     out = {};

    // Calculate two vectors from the three points
    va.x = v0.x - v1.x;
    va.y = v0.y - v1.y;
    va.z = v0.z - v1.z;

    vb.x = v1.x - v2.x;
    vb.y = v1.y - v2.y;
    vb.z = v1.z - v2.z;

    // Take the cross product of the two vectors to get
    // the normal vector which will be stored in out
    out.x = va.y * vb.z - va.z * vb.y;
    out.y = va.z * vb.x - va.x * vb.z;
    out.z = va.x * vb.y - va.y * vb.x;

    // Normalize the vector (shorten length to one)
    Math.reduceToUnit(out);

    return out;
}

Math.lerp = function ( A, B, t ) {
    return A + t * (B - A);
};