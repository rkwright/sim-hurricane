/*
 * Hurricane Model.
 * Based on work by Holland et al, 1980
 * http://journals.ametsoc.org/doi/pdf/10.1175/1520-0493%281980%29108%3C1212%3AAAMOTW%3E2.0.CO%3B2
 *
 * Original Fortran (!) code by Michael Drayton.
 *
 * @author rkwright / www.geofx.com
 *
 * Copyright 2017, All rights reserved.
 *
 */

/**
 * Constants for the Hurricane model
 */
class HurrModel {

    //constants
    static REVISION = '1.1.0';

    static PERIPHERAL_PRESSURE =        1013.0;	// a standard atmosphere in mB
    static INFLOW_ANGLE =                20.0;
    static CORIOLIS =                    2.0e-5;	// Coriolis parameter in the tropics (1/s)
    static MIN_PRESSURE_DIFFERENCE =     0.1;
    static AIR_DENSITY =                 1.225;

    static TIME_STEP = 0.01;

    static DIMX = 10;
    static DIMY = 10;

    static enModelType = ["Holland", "NWS23", "RMS97"];
    static enPositionUnits = ["Meters", "Degrees"];

    /**
     * Initialize the parameters that control hurricane sim
     * @constructor
     */
    constructor ( renderFunc ) {

        this.renderFunc = renderFunc;

        this.metData = undefined;
        this.dataRect = { x0: 0, y0: 0, x1: 1, y1: 1 };
        this.gridStep = 0.5;				// in degrees

        this.nRadialSamples = 12;				// number of steps outward (radial) to be sampled
        this.nAngularSamples = 15;				// number of angular samples

        this.samplePos = undefined;
        this.sampleDist = undefined;
        this.sampleAngle = undefined;
        this.sampleData = undefined;

        this.initialPosX = 0;				// intial coords of center
        this.initialPosY = 0;

        this.carto = new Carto();

        this.radiusStormInfluence = 750.0;	// radius of storm influence, in km
        this.cycloneAzimuth = 0;			// azimuth of hurricane track (degrees clockwise from North)
        this.fillingRate = 0;				// rate at which center fills (hPa/hr)
        this.peripheralPressure = 0;	    // pressure outside hurricane proper
        this.centralPressure = 0;		    // initial pressure at the eye
        this.radiusToMaxWind = 0;		    // radius from eye to max windspeed
        this.rateOfIncrease = 0;			// rate of increase of in RMAX over land (km/hr)
        this.translationalSpeed = 0;	    // speed that eye is moving (m/s)

        this.modelType = HurrModel.enModelType[0];

        //this.nTimeSteps = 0;
        this.dTimeStep = 0;
        this.dt = HurrModel.TIME_STEP;
        this.t = 0.0;
        this.currentTime = 0.0
        this.accumulator = 0.0
    }

    /**
     * Allocates the arrays for the hurricane simulation info
     */
    initArrays () {
        // allocate the equatorial array of pointers
        this.metData = [];
        for ( let  k=0; k<Math.round(360.0 / this.gridStep); k++ ) {
            this.metData.push( [] );
            for ( let n=0; n<Math.round(180.0 / this.gridStep); n++ ) {
                this.metData[k][n] = new MetData();
            }
        }

        // set up the two arrays that hold the pre-calculated angles and distances to the sample
        // points for each time-step
        this.sampleAngle = [];
        let angleIncrement = 360.0 / this.nAngularSamples;
        for ( let i = 0; i < this.nAngularSamples; i++ ) {
            this.sampleAngle.push(i * angleIncrement);
        }

        this.sampleDist = [];
        let logIncrement = Math.log(this.radiusStormInfluence) / (this.nRadialSamples - 1.0);
        for ( let j = 0; j < this.nRadialSamples; j++ ) {
            this.sampleDist.push((Math.exp(j * logIncrement) - 1.0) * 1000.0);  // in m
        }

        // finally allocate the array of sample positions. This is a fixed array of radial positions, each
        // element of the array is the X/Y position of the sample point relative to the eye
        this.samplePos = [];
        for ( let i = 0; i < this.nAngularSamples; i++ ) {
            let angle = Math.toRad(this.sampleAngle[i]);
            let cosAng = Math.cos(angle);
            let sinAng = Math.sin(angle);

            this.samplePos[i] = [];
            for ( let j = 0; j < this.nRadialSamples; j++ ) {
                this.samplePos[i].push( { x: this.sampleDist[j] * cosAng, y: this.sampleDist[j] * sinAng } );
            }
        }

        // allocate the array of CMEtParms to hold the time-step worth of data
        this.sampleData = [];
        for ( let i = 0; i < this.nAngularSamples; i++ ) {

            // allocate the ray of MetData for the time-step data
            this.sampleData[i] = [];
            for ( let j = 0; j < this.nRadialSamples; j++ ) {
                this.sampleData[i].push( new MetData() );
            }
        }
    }

    /**
     * Initialise on a per-storm basis.
     *
     * @param stormFile
     * @param index
     */
    initialise ( stormFile, index ) {

        let curStorm = stormFile.storms[index];
        this.startStorm = curStorm.obs[0].julianDay * 24 + curStorm.obs[0].hour;
        let lastObs = curStorm.obs[curStorm.obs.length-1];
        this.endStorm = lastObs.julianDay * 24 + lastObs.hour;

        this.cycloneAzimuth = Math.toRad( curStorm.heading );
        this.translationalSpeed = curStorm.velocity * 1680.0 / 3600.0;   // knots to m/s
        this.initialPosX = curStorm.lon;
        this.initialPosY = curStorm.lat;

        this.nCurStep = 0;              // number of times update has been called, i.e. "steps"
        this.curTime = 0.0;

        this.onLand = false;            // a safe assumption...
        this.maxLandVelocity = 0.0;
        this.signHemisphere = (this.initialPosY < 0.0) ? -1.0 : 1.0;

        // positions in lat/lon degrees
        this.curX = curStorm.obs[0].lon;
        this.curY = curStorm.obs[0].lat;
        this.eyeX = this.curX;
        this.eyeY = this.curY;

        this.xMinPlan = 0.0;
        this.xMaxPlan = 1000000.0;
        this.yMinPlan = 0.0;
        this.yMaxPlan = 1000000.0;

        this.modelDimX  = HurrModel.DIMX;
        this.modelDimY  = HurrModel.DIMY;

        this.translationalSpeed = 5.0;

        this.dX = (this.xMaxPlan - this.xMinPlan) / this.modelDimX;
        this.dY = (this.yMaxPlan - this.yMinPlan) / this.modelDimY;

        // set the time step size so that the cyclone covers one grid square in one time step
        this.dTimeStep  = 3600;  // seconds Math.min(this.dX, this.dY) / this.translationalSpeed;
        this.nTimeSteps = Math.round(Math.hypot(this.dX, this.dY) / this.dTimeStep);

        // we need the peripheral pressure, in pascals
        this.peripheralPressure = HurrModel.PERIPHERAL_PRESSURE * 100.0;
        this.centralPressure = curStorm.obs[0].pressure * 100.0;  // pascals

        this.deltPressure = this.peripheralPressure - this.centralPressure;

        // set limits on RMax ( in metres )
        this.rMaxMax = 200000.0;    // 200 km
        this.rMaxMin = 2000.0;      // 2 km

        // we need it converted to metres, but don't let it over-range
        this.radiusToMaxWind = Math.max(this.radiusToMaxWind * 1000.0, this.rMaxMax, this.rMaxMin);

        // hardcode the inflow angle (why?)
        this.inflowAngle = Math.toRad(HurrModel.INFLOW_ANGLE);

        // covert rate of increase in RMAX over land to m/s
        this.rateOfIncreaseM = this.rateOfIncrease / 3.6;

        // convert inflow-angle to radians
        this.alpha = -this.inflowAngle - Math.PI / 2;		// was positive alpha...

        //----- asymmetric part ----
        this.T0 = 0.514791;	// hmmm, what is this constant?
        this.ATT = 1.5 * Math.pow(this.translationalSpeed, 0.63) * Math.pow(this.T0, 0.37);

        //----- Initial Holland model parameters
        // B parameter - based on central pressure (in millibars)
        this.bHolland = 1.5 + (980.0 - this.centralPressure / 100.0) / 120.0;
        // A parameter - based on distance in kilometres
        this.aHolland = Math.pow((this.radiusToMaxWind / 1000.0), this.bHolland);

        // density of air (kg/m^3)
        this.airDensity = HurrModel.AIR_DENSITY;

        // clean up the storage arrays, as necessary
       // this.stormObsArray = [];  // the array of StormData for this storm
    }

    /**
     * Init the model from the data in the StormObs
     */
    initialiseFromStormObs ( stormObs ) {


        return true;
    }

    /**
     * Drive the animation, alternating between updating the model and calling back to
     * have it rendered.
     * @returns {number}
     */
    timeStep () {
        let newTime = performance.now();

        if (this.currentTime === 0)
            this.currentTime = newTime;

        let deltaTime = Math.min(newTime - this.currentTime, HurrPlot.MAX_RENDER_TIME);
        this.currentTime = newTime;

        this.accumulator += deltaTime;

        //console.log("Accum:" + this.accumulator.toFixed(2) + " t: " + this.t.toFixed(2) );

        let n = 0;
        while (this.accumulator >= this.dt) {
            this.accumulator -= this.dt;

            this.update( this.dt / 1000 );

            this.t += this.dt;

            n++;
        }

        //let alpha = this.accumulator / this.dt;

        //console.log("Render: " + this.accumulator.toFixed(2) + " t: " + this.t.toFixed(2) + " n: " + n);

        this.renderFunc( this.eyeX, this.eyeY, this.metData, this.dataRect );

        return 0;
    }

    /**
     * Performs one time-step iteration for the model
     *
     */
    update ( dt ) {

        // update the available params if the function returns false, the storm is complete
        if (this.updateStormObs() === false)
            return true;

        // loop through all the time steps calculating and plotting the wind arrows
        this.nCurStep++;
        this.curTime += this.dTimeStep;

       console.log("nCurStep: " + this.nCurStep + " curTime: " + this.curTime);

        // if the storm has moved on to land, recalculate the Holland model parameters
        this.checkOnLand();

        // now calculate the windfield for the current time
        for (let i = 0; i < this.nAngularSamples; i++) {
            let angle = this.sampleAngle[i];

            for ( let j = 0; j < this.nRadialSamples; j++ ) {

                let velocity = this.calcWindVelocity(this.sampleDist[j], angle);

              //  console.log("velocity: " + velocity.x + " " + velocity.y);

                this.sampleData[i][j].xVel = velocity.x;
                this.sampleData[i][j].yVel = velocity.y;

                this.sampleData[i][j].velocity = Math.sqrt(velocity.x * velocity.x + velocity.y * velocity.y);

            }
        }

       this.accumulateData();

        return false;
    }

    /**
     *  Se if the storm has trnasitioned onto land.  If so, update the Holland parameters.
     */
    checkOnLand() {
        if (this.onLand) {
            this.centralPressure = Math.min(this.centralPressure + this.fillingRate * this.dTimeStep, this.peripheralPressure );
            this.radiusToMaxWind = this.radiusToMaxWind + this.rateOfIncreaseM * this.dTimeStep;
            this.radiusToMaxWind = Math.clamp(this.radiusToMaxWind, this.rMaxMax, this.rMaxMin);
            this.deltPressure = this.peripheralPressure - this.centralPressure;
            this.bHolland = 1.5 + (980.0 - this.centralPressure / 100.0) / 120.0;
            this.aHolland = Math.pow((this.radiusToMaxWind / 1000.0), this.bHolland);
        }
    }

    /**
     * Get the current, possibly interpolated, data for this time step
     */
    updateStormObs () {
        let stormObs;
        let prevStormObs;
        let stormTime;
        let kObs;
        let storm = stormFile.storms[0];
        this.startStorm = storm.obs[0].julianDay * 24 + storm.obs[0].hour;

        let curTime = this.startStorm + this.nCurStep * this.dTimeStep / 3600.0;

        for ( kObs=1;  kObs<storm.obs.length; kObs++ ) {

            stormTime = storm.obs[kObs].julianDay * 24 + storm.obs[kObs].hour;

            // if we have found the next storm, interpolate the values we need
            if (stormTime >= curTime) {
                break;
            }
        }

        // end of time?
        if ( stormTime < curTime || kObs >= storm.obs.length )
            return false;

        stormObs = storm.obs[kObs];
        prevStormObs = storm.obs[kObs - 1];
        let prevTime = prevStormObs.julianDay * 24 + prevStormObs.hour;
        let prop = (curTime - prevTime) / (stormTime - prevTime);

        this.cycloneAzimuth = Math.lerp( prevStormObs.heading, stormObs.heading, prop );

        let velocity = Math.lerp( prevStormObs.velocity, stormObs.velocity, prop );
        this.translationalSpeed = velocity * Carto.NAUTICALMILE_TO_METER / 3600.0;   // knots to m/s

        this.eyeX = Math.lerp( prevStormObs.lon, stormObs.lon, prop );
        this.eyeY = Math.lerp( prevStormObs.lat, stormObs.lat, prop );

        this.pressure = Math.lerp( prevStormObs.pressure, stormObs.pressure, prop );

        this.deltPressure = Math.lerp( prevStormObs.pressure - this.peripheralPressure,
                                        stormObs.pressure  - this.peripheralPressure, prop );

        console.log("stormTime: " + stormTime + "  curTime: " + curTime + " eyeX: " + this.eyeX + " eyeY: " + this.eyeY);

        return true;
    }

    /**
     * Calculate the cyclone wind velocity, pressure and pressure gradients at a specified point at the current time
     *
     * @param rDist
     * @param ang
     * @returns {{x: number, y: number}}
     */
    calcWindVelocity ( rDist, ang ) {

        let velocity = { x: 0, y: 0 };
        let vel = 0;

        // calculate the distance from the current point to the cyclone centre
        this.curX = this.eyeX + Math.cos(ang) * rDist / Carto.METERPERDEG;
        this.curY = this.eyeY + Math.sin(ang) * rDist / Carto.METERPERDEG;

        let polarC = this.carto.cartesianToPolarNorth( this.curX, this.curY, this.eyeX, this.eyeY );

        // impose a lower limit on the value of rdist. Set the pressure to P0 and the wind velocity to 0 inside this limit
        if ((rDist / this.radiusToMaxWind) < 0.05) {
            velocity.x = 0.0;
            velocity.y = 0.0;
        }
        else {
            if (this.modelType === "NWS23")
                vel = this.getNWS23Velocity( polarC );
            else
                vel = this.getHollandVelocity( polarC  );

            //	wind azimuth at cell centre
            let azimuth = ang + this.signHemisphere * this.alpha;  // was minus this.sign..etc
            let beta    = azimuth - this.cycloneAzimuth;

            // final speed in moving cyclone with inflow at cell centre Note that the asymmetric part does not decay
            // with distance. Unless some limit is imposed the asymmetric part will generate meaningless wind
            // velocities far from the cyclone centre. Check Vel against ATT to ensure that the velocities
            // on the left hand side (relative to the track) never become anticyclonic.

            // N.B. Our azimuths are geodetic i.e. clockwise from north, but the sine and cosine functions
            // are defined in terms of counter-clockwise rotation from "east" so we have to correct for this

            if (vel >= this.ATT) {
                vel += this.ATT * Math.cos(this.carto.azimuthToRadians(beta));          // - HALF_PI );
                velocity.vx = vel * Math.sin(this.carto.azimuthToRadians(azimuth));     // - HALF_PI );
                velocity.vy = vel * Math.cos(this.carto.azimuthToRadians(azimuth));     // - HALF_PI);
            }
            else {
                velocity.vx = 0.0;
                velocity.vy = 0.0;
            }
        }

        return velocity;
    }

    /**
     *
     * @param polarC
     * @returns {number}
     */
    getNWS23Velocity( polarC ) {
        let Rr = this.radiusToMaxWind / polarC.dist;
        let eRr = Math.exp(-Rr);
        //PressDiff = this.deltPressure * (eRr - 1.0);
        let VelC2 = this.deltPressure * Rr * eRr / this.airDensity;
        let Rf2 = 0.5 * polarC.dist * HurrModel.CORIOLIS;

        return Rf2 * Math.sqrt(1.0 + VelC2 / (Rf2 * Rf2)) - 1.0;
    }

    /**
     * Note: rdist has units of metres but AHolland requires distances to be in kilometres (AHolland/Rb is dimensionless)
     *
     * @param polarC
     * @returns {*}
     */
    getHollandVelocity ( polarC ) {
        let Rkm = polarC.dist / 1000.0;											// kilometres
        let Rf2 = 0.5 * polarC.dist * Math.abs(HurrModel.CORIOLIS);						// metres/sec
        let Rb = Math.pow(Rkm, this.bHolland);									// km^B
        let earb = Math.exp(-this.aHolland / Rb);								// dimensionless
        let pressDiff = this.deltPressure * earb;									// Pascals
        let vel = pressDiff * this.aHolland * this.bHolland / Rb;			// Pascals

        return Math.sqrt(vel / this.airDensity + Rf2 * Rf2) - Rf2;		// m/s
    }

    /**
     * This accumulates the data from the detailed time-step calcualtions across the nodal grid
     */
    accumulateData () {
        // first, find the closest meridian to the hurricane's center
        let meridianX = Math.round((180.0 + this.eyeX) / this.gridStep);
        let parallelY = Math.round((90.0 + this.eyeY) / this.gridStep);
        let stepKM = this.carto.degToMeters(this.gridStep) / 1000.0;
        let maxRangeX = Math.round(this.radiusStormInfluence / stepKM);

        this.clearWindfields();

        // now oscillate back and forth in longitude and accumulate the detailed time step data into the nodal grid
        let index = 0;
        let eyeMerc = this.carto.latlonToMerc(this.eyeX, this.eyeY);

        // find the lat/lon of the closest node on the half-degree grid.
        let closeLon = Math.round(this.eyeX / this.gridStep) * this.gridStep;
        let closeLat = Math.round(this.eyeY / this.gridStep) * this.gridStep;

        // find the lat/lon of the closest node on the half-degree grid
        do {

            // now find the upper and lower bounds that need to be updated
            let angle = Math.atan((index * stepKM) / this.radiusStormInfluence);
            let nRangeY = Math.round(Math.abs(Math.cos(angle)) * this.radiusStormInfluence / stepKM);
            let rPos = [];
            let aPos = [];

            let lon = closeLon + index * this.gridStep;
            let lat = closeLat - nRangeY * this.gridStep;

            this.dataRect.x0 = meridianX - maxRangeX;
            this.dataRect.y0 = parallelY - nRangeY;
            this.dataRect.x1 = meridianX + maxRangeX;
            this.dataRect.y1 = parallelY + nRangeY;

            for ( let n = -nRangeY; n < nRangeY; n++) {
                let met = this.metData[meridianX + index][parallelY + n];
                let nodeMerc = this.carto.latlonToMerc(lon, lat);

                // now find the four closest sampled points
                let nClose = this.findClosest(nodeMerc.x - eyeMerc.x, nodeMerc.y - eyeMerc.y, rPos, aPos);

                if (nClose > 0) {
                    let xVel = 0.0;
                    let yVel = 0.0;
                    let sumWeight = 0.0;
                    let xSamp = 0.0;
                    let ySamp = 0.0;
                    for (let j = 0; j < nClose; j++) {
                        xSamp = eyeMerc.x + this.samplePos[aPos[j]][rPos[j]].x;
                        ySamp = eyeMerc.y + this.samplePos[aPos[j]][rPos[j]].y;

                        // now perform a simple moving average accumulation
                        let weight = Math.hypot(xSamp - nodeMerc.x, ySamp - nodeMerc.y );
                        xVel += this.sampleData[aPos[j]][rPos[j]].xVel / weight;
                        yVel += this.sampleData[aPos[j]][rPos[j]].yVel / weight;
                        sumWeight += 1.0 / weight;
                    }

                    xVel /= sumWeight;
                    yVel /= sumWeight;

                    // assign the results back to the array element
                    met.xVel = xVel;
                    met.yVel = yVel;
                    met.velocity = Math.hypot(xVel, yVel);
                    if (met.velocity > met.maxVelocity)
                        met.maxVelocity = met.velocity;

                    if (this.onLand)
                        this.maxLandVelocity = Math.max(this.maxLandVelocity, met.velocity);
                }

                lat += this.gridStep;
            }

            // flip the index
            if (index <= 0)
                index = -index + 1;
            else
                index = -index;
        }
        while (index > -maxRangeX);
    }

    /**
     *  Just clear all the deta in the metData array
     */
    clearWindfields() {
        for ( let k = 0; k < Math.round(360.0 / this.gridStep); k++ ) {
            for ( let n=0; n<Math.round(180.0 / this.gridStep); n++ ) {
                let met = this.metData[k][n];
                met.xVel = 0;
                met.yVel = 0;
                met.velocity = 0;
            }
        }
    }
    /**
     *  Find the four closest points in the samplePos array to the specified point
     *
     * @param x             coordinates of the current point
     * @param y
     * @param rPos          X-indices of the four closest points
     * @param aPos          Y-indices of the four closest points
     * @returns             number of the closest points
     */
    findClosest  (x, y, rPos, aPos) {

        let n = 0;
        let angle = Math.toDeg(Math.atan2(y, x));

        if (angle < 0.0)
            angle += 360.0;

        let angleIndex = Math.round(angle / 360.0 * this.nAngularSamples);
        if (angleIndex >= (this.nAngularSamples - 1))
            angleIndex = 0;

        x = Math.hypot(x, y);

        while (x >= this.sampleDist[n] && n < this.nRadialSamples) n++;

        // check for out of range.  This shouldn't occur normally, but...
        if (n >= this.nRadialSamples)
            return 0;

        // check for the special case where we are in the eye...
        aPos[0] = angleIndex;
        aPos[1] = angleIndex;
        aPos[2] = angleIndex + 1;
        aPos[3] = angleIndex + 1;

        rPos[0] = n - 1;
        rPos[1] = n;
        rPos[2] = n - 1;
        rPos[3] = n;

        return 4;
    }
}