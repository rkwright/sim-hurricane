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
    static REVISION = '1.0';

    static PERIPHERAL_PRESSURE =        1013.0;	// in mB
    static INFLOW_ANGLE =                20.0;
    static CORIOLIS =                    2.0e-5;	// Coriolis parameter in the tropics (1/s)
    static MIN_PRESSURE_DIFFERENCE =     0.1;
    static AIR_DENSITY =                 1.225;

    static TIME_STEP = 0.01;

    static enModelType = ["Holland", "NWS23", "RMS97"];
    static enPositionUnits = ["Meters", "Degrees"];


    /**
     * Initialize the parameters that control hurricane sim
     * @constructor
     */
    constructor ( renderFunc ) {

        this.renderFunc = renderFunc;

        this.metData = undefined;

        this.dataNodeStep = 0.5;				// in degrees

        this.radiusStormInfluence = 750.0;		// radius of storm influence, in km
        this.nRadialSamples = 12;				// number of steps outward (radial) to be sampled
        this.nAngularSamples = 15;				// number of angular samples

        this.samplePos = undefined;
        this.sampleDist = undefined;
        this.sampleAngle = undefined;
        this.sampleData = undefined;

        this.carto = new Carto();

        //
        this.cycloneAzimuth = 0;			// azimuth of hurricane track (degrees clockwise from North)
        this.fillingRate = 0;				// rate at which center fills (hPa/hr)
        this.initialPosX = 0;				// intial coords of center
        this.initialPosY = 0;
        this.peripheralPressure = 0;	// pressure outside hurricane proper
        this.centralPressure = 0;		// initial pressure at the eye
        this.radiusToMaxWind = 0;		// radius from eye to max windspeed
        this.rateOfIncrease = 0;			// rate of increase of in RMAX over land (km/hr)
        this.translationalSpeed = 0;	// speed that eye is moving (m/s)

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
        this.metData = []; //(CMetParm **) new (CMetParm *[ Math.round(360.0 / this.dataNodeStep) ]);
        for ( let  k=0; k<Math.round(360.0 / this.dataNodeStep); k++ ) {
            this.metData.push( [] );
            for ( let n=0; n<Math.round(180.0 / this.dataNodeStep); n++ ) {
                this.metData[k][n] = new MetData();
            }
        }

        // set up the two arrays that hold the pre-calculated angles and distances to the sample
        // points for each time-step
        this.sampleAngle = []; //(double *) new double[ this.nAngularSamples ];
        let angleIncrement = 360.0 / this.nAngularSamples;
        for ( let i = 0; i < this.nAngularSamples; i++ ) {
            this.sampleAngle.push(i * angleIncrement);
        }

        this.sampleDist = [];  //(double *) new double[ this.nRadialSamples ];
        let logIncrement = Math.log(this.radiusStormInfluence) / (this.nRadialSamples - 1.0);
        for ( let j = 0; j < this.nRadialSamples; j++ ) {
            this.sampleDist.push((Math.exp(j * logIncrement) - 1.0) * 1000.0);  // in m
        }

        // finally allocate the array of sample positions. This is a fixed array of radial positions, each
        // element of the array is the X/Y position of the sample point relative to the eye
        this.samplePos = [];  //(double ***) new (double **[ this.nAngularSamples ]);
        for ( let i = 0; i < this.nAngularSamples; i++ ) {
            let angle = Math.toRad(this.sampleAngle[i]);
            let cosAng = Math.cos(angle);
            let sinAng = Math.sin(angle);

            this.samplePos[i] = [];  //(double **) new (double *[ this.nRadialSamples ]);
            for ( let j = 0; j < this.nRadialSamples; j++ ) {
                this.samplePos[i].push( new THREE.Vector2(this.sampleDist[j] * cosAng, this.sampleDist[j] * sinAng) );
            }
        }

        // allocate the array of CMEtParms to hold the time-step worth of data
        this.sampleData = [];   //(CMetParm **) new (CMetParm *[ this.nAngularSamples ]);
        for ( let i = 0; i < this.nAngularSamples; i++ ) {

            // allocate the ray of MetData for the time-step data
            this.sampleData[i] = [];   // (CMetParm *) new CMetParm[this.nRadialSamples];
            for ( let j = 0; j < this.nRadialSamples; j++ ) {
                this.sampleData[i].push( new MetData() );
            }
        }

        return true;
    }

    /**
     *
     */
    initialise ( curStorm ) {

        this.initialiseFromStormObs( curStorm );

        this.nCurStep = 0;
        //this.curTime = 0.0;

        //this.centreOnScreen = true;
        this.onLand = false;   // a safe assumption...

        // we need the positions in metres
        this.yVelNow = 0.0;
        this.xVelNow = 0.0;
        this.maxVelocity = 1.0;
        this.maxLandVelocity = 0.0;

        this.signHemisphere = (this.initialPosY < 0.0) ? -1.0 : 1.0;

        // positions in lat/lon degrees
        this.curX = this.initialPosX;
        this.curY = this.initialPosY;
        this.eyeX = this.initialPosX;
        this.eyeY = this.initialPosY;

        // we need the initial central pressure in pascals
        this.centralPressurePascals = this.centralPressure * 100.0;

        // we need the peripheral pressure in pascals as well
        this.peripheralPressurePascals = this.peripheralPressure * 100.0;

        this.deltPressure = this.peripheralPressurePascals - this.centralPressurePascals;
        //this.centreFilled = this.deltPressure > HurrModel.MIN_PRESSURE_DIFFERENCE;

        // set limits on RMax ( in metres )
        this.rMaxMax = 200000.0;    // 200 km
        this.rMaxMin = 2000.0;      // 2 km

        // we need it converted to metres, but don't let it over-range
        this.radiusToMaxWindMetres = Math.max(this.radiusToMaxWind * 1000.0, this.rMaxMax, this.rMaxMin);

        // hardcode the inflow angle (why?)
        this.inflowAngle = Math.toRad(HurrModel.INFLOW_ANGLE);

        // filling rate over land - convert to Pascals/sec
        this.fillingRatePascals = this.fillingRate / 36.0;

        // covert rate of increase in RMAX over land to m/s
        this.rateOfIncreaseMetres = this.rateOfIncrease / 3.6;

        // convert to the cyclone azimuth to radians
        this.cycloneAzimuthRadians = Math.toRad(this.cycloneAzimuth);
        //this.TSSinAzimuth = this.translationalSpeed * Math.sin(this.cycloneAzimuthRadians) * this.dTimeStep;
        //this.TSCosAzimuth = this.translationalSpeed * Math.cos(this.cycloneAzimuthRadians) * this.dTimeStep;

        // convert inflow-angle to radians
        this.alpha = -this.inflowAngle - Math.PI / 2;		// was positive alpha...
        // this.alpha = this.inflowAngle;

        //----- asymmetric part ----
        this.T0 = 0.514791;	// hmmm, what is this constant?
        this.ATT = 1.5 * Math.pow(this.translationalSpeed, 0.63) * Math.pow(this.T0, 0.37);

        //----- Initial Holland model parameters
        // B parameter - based on central pressure (in millibars)
        this.bHolland = 1.5 + (980.0 - this.centralPressurePascals / 100.0) / 120.0;

        // A parameter - based on distance in kilometres
        this.aHolland = Math.pow((this.radiusToMaxWindMetres / 1000.0), this.bHolland);

        // density of air (kg/m^3)
        this.airDensity = HurrModel.AIR_DENSITY;

        // clean up the storage arrays, as necessary
        //this.stormTrack = [];
        this.stormObsArray = [];  // the array of StormParms for this storm
    }

    /**
     * Init the model from the data in the StormObs
     */
    initialiseFromStormObs ( stormObs ) {
        this.startStorm = stormObs.julianDay * 24 + stormObs.hour;

        this.cycloneAzimuth = stormObs.heading;
        this.cycloneAzimuthRadians = Math.toRad(this.cycloneAzimuth);
        this.translationalSpeed = stormObs.fwdVelocity * 1680.0 / 3600.0;   // knots to m/s
        //this.TSSinAzimuth = this.translationalSpeed * Math.sin(this.cycloneAzimuthRadians) * this.dTimeStep;
        //this.TSCosAzimuth = this.translationalSpeed * Math.cos(this.cycloneAzimuthRadians) * this.dTimeStep;
        this.initialPosX = stormObs.x;
        this.initialPosY = stormObs.y;

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

        this.renderFunc( this.eyeX, this.eyeY, this.sampleData );

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

        //this.centreOnScreen = (this.eyeX >= this.xMinPlan && this.eyeX <= this.xMaxPlan &&
        //                        this.eyeY >= this.yMinPlan && this.eyeY <= this.yMaxPlan);
        // if the storm has moved on to land, recalculate the Holland model parameters
        if (this.onLand) {
            this.centralPressurePascals = Math.min(this.centralPressurePascals + this.fillingRatePascals * this.dTimeStep, this.peripheralPressurePascals);
            this.radiusToMaxWindMetres = this.radiusToMaxWindMetres + this.rateOfIncreaseMetres * this.dTimeStep;
            this.radiusToMaxWindMetres = Math.clamp(this.radiusToMaxWindMetres, this.rMaxMax, this.rMaxMin);
            this.deltPressure = this.peripheralPressurePascals - this.centralPressurePascals;
            this.bHolland = 1.5 + (980.0 - this.centralPressurePascals / 100.0) / 120.0;
            this.aHolland = Math.pow((this.radiusToMaxWindMetres / 1000.0), this.bHolland);
        }

        // check if the centre has filled to the peripheral pressure
        //this.centreFilled = Math.abs(this.peripheralPressurePascals - this.centralPressurePascals) < HurrModel.MIN_PRESSURE_DIFFERENCE;

        // now calculate the windfield for the current time
        for (let i = 0; i < this.nAngularSamples; i++) {
            let angle = this.sampleAngle[i];

            for ( let j = 0; j < this.nRadialSamples; j++ ) {

                let velocity = this.calcWindSpeeds(this.sampleDist[j], angle);

                this.sampleData[i][j].xVel = velocity.x;
                this.sampleData[i][j].yVel = velocity.y;

                this.sampleData[i][j].velocity = Math.sqrt(velocity.x * velocity.x + velocity.y * velocity.y);

            }
        }

       this.accumulateData();

        return false;
    }

    /**
     * Get the current, possibly interpolated, data for this time step
     */
    updateStormObs () {
        let stormObs;
        let prevStormObs;
        let stormTime;
        let kObs = 0;

        if (this.nCurStep === 0) {
            stormObs = this.stormObsArray[0];
            this.startStorm = stormObs.julianDay * 24 + stormObs.hour;
        }

        let curTime = this.startStorm + this.nCurStep * this.dTimeStep / 3600.0;

        for ( let k=1;  k<this.stormObsArray.length; k++ ) {
            stormObs = this.stormObsArray[k];

            stormTime = stormObs.julianDay * 24 + stormObs.hour;

            // if we have found the right spot, interpolate the values we need
            if (stormTime >= curTime) {
                kObs = k;
                break;
            }
        }

        // end of time?
        if ( stormTime < curTime )
            return false;

        prevStormObs = this.stormObsArray[kObs - 1];
        let prevTime = prevStormObs.julianDay * 24 + prevStormObs.hour;
        let prop = (stormTime - curTime) / (stormTime - prevTime);

        this.cycloneAzimuth = Math.lerp( stormObs.heading, prevStormObs.heading, prop );
        this.cycloneAzimuthRadians = Math.toRad(this.cycloneAzimuth);

        let fwdVelocity = Math.lerp( stormObs.fwdVelocity, prevStormObs.fwdVelocity, prop );
        this.translationalSpeed = fwdVelocity * Carto.NAUTICALMILE_TO_METER / 3600.0;   // knots to m/s

        this.eyeX = Math.lerp( stormObs.x, prevStormObs.x, prop );
        this.eyeY = Math.lerp( stormObs.y, prevStormObs.y, prop );
            //this.TSSinAzimuth = this.translationalSpeed * Math.sin(this.cycloneAzimuthRadians) * this.dTimeStep;
            //this.TSCosAzimuth = this.translationalSpeed * Math.cos(this.cycloneAzimuthRadians) * this.dTimeStep;

        return true;
    }

    /**
     * Calculate the cyclone wind velocity, pressure and pressure gradients
     * at a specified point at the current time
     */
    calcWindSpeeds (rDist, Ang) {

        let AziSite = 0;
        let beta = 0;
        let Vel = 0;
        let Rkm = 0;
        let Rf2 = 0;
        let Rb = 0;
        let earb = 0;
        //let R2;
        let PressDiff = 0;
        let Rr = 0;
        let eRr = 0;
        let VelC2 = 0;
        let velocity = new THREE.Vector2(0, 0);

        // calculate the distance from the current point to the cyclone centre
        let polarC = this.carto.cartesianToPolarNorth( this.curX, this.curY, this.eyeX, this.eyeY );

        //R2 = rDist * rDist;			// m^2
        //Ang = Math.toRad(Ang);

        // impose a lower limit on the value of rdist. Set the pressure to
        // P0 and the wind velocity to 0 inside this limit
        if (rDist / this.radiusToMaxWindMetres < 0.05) {
            velocity.x = 0.0;
            velocity.y = 0.0;
        }
        else {
            if (this.modelType === "NWS23") {
                // NWS23 model
                Rr = this.radiusToMaxWindMetres / polarC.dist;
                eRr = Math.exp(-Rr);
                //PressDiff = this.deltPressure * (eRr - 1.0);
                VelC2 = this.deltPressure * Rr * eRr / this.airDensity;
                Rf2 = 0.5 * polarC.dist * HurrModel.CORIOLIS;
                Vel = Rf2 * Math.sqrt(1.0 + VelC2 / (Rf2 * Rf2)) - 1.0;
            }
            else {
                // Holland model
                // Note: rdist has units of metres but AHolland requires
                //       distances to be in kilometres (AHolland/Rb is dimensionless)

                Rkm = polarC.dist / 1000.0;											// kilometres
                Rf2 = 0.5 * polarC.dist * Math.abs(HurrModel.CORIOLIS);						// metres/sec
                Rb = Math.pow(Rkm, this.bHolland);									// km^B
                earb = Math.exp(-this.aHolland / Rb);								// dimensionless
                PressDiff = this.deltPressure * earb;									// Pascals
                Vel = PressDiff * this.aHolland * this.bHolland / Rb;			// Pascals

                Vel = Math.sqrt(Vel / this.airDensity + Rf2 * Rf2) - Rf2;		// m/s
            }

            // reduce to 10 minute mean winds at surface (0.8 after Powell 1980,
            // although Hubbert et al 1991 use a reduction factor of 0.7 and
            // NWS23 uses 0.9-0.95)
            // Vel = 0.8D0*Vel   TODO??

            //	wind azimuth at cell centre
            AziSite = Ang + this.signHemisphere * this.alpha;  // was minus this.sign..etc

            // angle beta
            beta = AziSite - this.cycloneAzimuthRadians;

            // final speed in moving cyclone with inflow at cell centre
            // Note that the asymmetric part does not decay with distance.
            // Unless some limit is imposed the asymmetric part will
            // generate meaningless wind velocities far from the cyclone
            // centre. Check Vel against ATT to ensure that the velocities
            // on the left hand side (relative to the track) never become
            // anticyclonic.

            // N.B. Our azimuths are geodetic i.e. clockwise from north, but the sine and cosine functions
            // are defined in terms of counter-clockwise rotation from "east" so we have to correct for this

            if (Vel >= this.ATT) {
                Vel += this.ATT * Math.cos(this.carto.azimuthToRadians(beta));          // - HALF_PI );
                velocity.vx = Vel * Math.sin(this.carto.azimuthToRadians(AziSite));     // - HALF_PI );
                velocity.vy = Vel * Math.cos(this.carto.azimuthToRadians(AziSite));     // - HALF_PI);
            }
            else {
                velocity.vx = 0.0;
                velocity.vy = 0.0;
            }
        }

        //	TRACE("%8.1f %8.1f %8.1f %8.1f %8.1f %8.1f\n", this.curX, this.curY, this.eyeX, this.eyeY, this.yVelNow, this.xVelNow );

        return velocity;
    }

    /**
     * This accumulates the data from the detailed time-step calcualtions across the nodal grid
     */
    accumulateData () {

        // first, find the closest meridian to the hurricane's center
        let nMeridian = Math.round((180.0 + this.eyeX) / this.dataNodeStep);
        let nCenterY = Math.round((90.0 + this.eyeY) / this.dataNodeStep);
        let stepKM = this.carto.degToMeters(this.dataNodeStep) / 1000.0;
        let maxRangeX = Math.round(this.radiusStormInfluence / stepKM);

        // clear all the old windfields and ensure the MetData is allocated
        for ( let k = 0; k < Math.round(360.0 / this.dataNodeStep); k++ ) {
            for ( let n=0; n<Math.round(180.0 / this.dataNodeStep); n++ ) {
                let met = this.metData[k][n];
                met.xVel = 0;
                met.yVel = 0;
                met.velocity = 0;
            }
        }

        // now oscillate back and forth in longitude and accumulate the detailed
        // time step data into the nodal grid

        //let bDone = false;
        //let nDir = 1;
        let index = 0;

        let centerMerc = this.carto.latlonToMerc(this.eyeX, this.eyeY);
        let xCenter = centerMerc.x;
        let yCenter = centerMerc.y;
        let xNode, yNode;

        // find the lat/lon of the closest node.
        let closeLon = Math.round(this.eyeX / this.dataNodeStep) * this.dataNodeStep;
        let closeLat = Math.round(this.eyeY / this.dataNodeStep) * this.dataNodeStep;
        let maxDist = Math.hypot(stepKM, stepKM) / 2.0 * 1000.0;  // in m

        do {

            // see if we have already allocated this meridian. If not, do so now
            if (this.metData[nMeridian + index] === undefined)
                this.metData[nMeridian + index] = new MetData[Math.round(180.0 / this.dataNodeStep)];

            // now find the upper and lower bounds that need to be updated

            let angle = Math.atan((index * stepKM) / this.radiusStormInfluence);
            let nRangeY = Math.round(Math.abs(Math.cos(angle)) * this.radiusStormInfluence / stepKM);
            let rPos = [];
            let aPos = [];

            let lon = closeLon + index * this.dataNodeStep;
            let lat = closeLat - nRangeY * this.dataNodeStep;
            let nodeMerc;
            let weight;

            for ( let n = -nRangeY; n < nRangeY; n++) {
                let met = this.metData[nMeridian + index][nCenterY + n];
                nodeMerc = this.carto.latlonToMerc(lon, lat);
                xNode = nodeMerc.x;
                yNode = nodeMerc.y;

                // now find the four closest sampled points
                let nClose = this.findClosest(xNode - xCenter, yNode - yCenter, rPos, aPos);

                if (nClose > 0) {
                    let xVel = 0.0;
                    let yVel = 0.0;
                    let sumWeight = 0.0;
                    let xSamp = 0.0;
                    let ySamp = 0.0;
                    for (let j = 0; j < nClose; j++) {
                        xSamp = xCenter + this.samplePos[aPos[j]][rPos[j]][0];
                        ySamp = yCenter + this.samplePos[aPos[j]][rPos[j]][1];

                        // now perform a simple moving average accumulation
                        weight = Math.hypot(xSamp - xNode, ySamp - yNode);
                        xVel += this.sampleData[aPos[j]][rPos[j]].xVel / weight;
                        yVel += this.sampleData[aPos[j]][rPos[j]].yVel / weight;
                        sumWeight += 1.0 / weight;
                    }

                    xVel /= sumWeight;
                    yVel /= sumWeight;

                    met.xVel = xVel;
                    met.yVel = yVel;
                    met.velocity = Math.hypot(xVel, yVel);
                    if (met.velocity > met.maxVelocity)
                        met.maxVelocity = met.velocity;

                    if (this.onLand)
                        this.maxLandVelocity = Math.max(this.maxLandVelocity, met.velocity);
                }

                lat += this.dataNodeStep;
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
     *  Find the four closest points in the samplePos array to the specified point
     *
     * @param x             coordinates of the current point
     * @param y
     * @param rPos          X-indicies of the four closest points
     * @param aPos          Y-indicies of the four closest points
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