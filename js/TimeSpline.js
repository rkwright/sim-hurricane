/*
 * Time Spline.  Parametrizes the application of a spline to a time-series
 *
 * @author rkwright / www.geofx.com
 *
 * Copyright 2018, All rights reserved.
 *
 */

class TimeSpline {

    /**
     * @constructor
     */
    constructor () {

        this.timeIntcp = 0;             // date object in MS since 1970
        this.timeSlope = 1;             // slope of span from t0 to tfin
        this.spline    = undefined;     // the THREE spline object
    }
}
