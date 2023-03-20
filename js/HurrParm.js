/*
 * Hurricane parameters for the hurricane modelling
 *
 * Original Fortran (!) code by Michael Drayton.
 *
 * @author rkwright / www.geofx.com
 *
 * Copyright 2017, All rights reserved.
 *
 */

class HurrParm {
    // constants
    REVISION = "1.1.0";

    /**
     * @constructor
     */
    constructor() {
        this.cycloneAzimuth = 0.0;
        this.fillingRate = 1.0;
        this.initialPosX = 1900.0;
        this.initialPosY = 2600.0;
        this.peripheralPressure = 1013.0;
        this.centralPressure = 880.0;
        this.radiusToMaxWind = 10.0;
        this.rateOfIncrease = 1.0;
        this.translationalSpeed = 5.0;
        this.nTimeSteps = 250;
        this.modelType = "Holland";
    }
}
