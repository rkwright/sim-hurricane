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

    static enModelType = ["Holland", "NWS23", "RMS97"];
    static enPositionUnits = ["Meters", "Degrees"];

    static MISSING = -999;

    /**
     * Initialize the parameters that control hurricane sim
     * @constructor
     */
    constructor ( objParm ) {

        this.renderFunc = objParm.renderFunc;

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

        //this.nTimeSteps = 0;
        this.dTimeStep = 0;

        this.modelType = HURRMODEL.enModelType[0];

        /*
        this.xMinPlan = 0;
        this.xMaxPlan = 0;
        this.yMinPlan = 0;
        this.yMaxPlan = 0;
        */
    };

    /**
     *
     */
    initialise ( curStorm ) {

        this.initialiseFromStormData( curStorm );

        this.nCurStep = 0;
        this.curTime = 0.0;

        //this.centreOnScreen = true;
        this.onLand = false;   // a safe assumption...

        // we need the positions in metres
        this.yVelNow = 0.0;
        this.xVelNow = 0.0;
        this.maxVelocity = 1.0;
        this.maxLandVelocity = 0.0;

        this.signHemisphere = (this.initialPosY < 0.0) ? -1.0 : 1.0;

        // positions in lat/lon degrees
        this.xNow = this.initialPosX;
        this.yNow = this.initialPosY;
        this.xEye = this.initialPosX;
        this.yEye = this.initialPosY;

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
        this.stormTrack = [];
        this.stormArray = [];
    }

    /**
     * Init the model from the data in the StormParm
     */
    initialiseFromStormData ( storm ) {
        //var storm = this.stormArray[0];
        this.startStorm = storm.julianDay * 24 + storm.hour;

        this.cycloneAzimuth = storm.heading;
        this.cycloneAzimuthRadians = Math.toRad(this.cycloneAzimuth);
        this.translationalSpeed = storm.fwdVelocity * 1680.0 / 3600.0;   // knots to m/s
        //this.TSSinAzimuth = this.translationalSpeed * Math.sin(this.cycloneAzimuthRadians) * this.dTimeStep;
        //this.TSCosAzimuth = this.translationalSpeed * Math.cos(this.cycloneAzimuthRadians) * this.dTimeStep;
        this.initialPosX = storm.x;
        this.initialPosY = storm.y;

        return true;
    }

    /**
     * Allocates the arrays for the hurricane simulation info
     */
    initArrays () {

        // allocate the equatorial array of pointers
        this.metData = []; //(CMetParm **) new (CMetParm *[ Math.round(360.0 / this.dataNodeStep) ]);
        for ( var  n=0; n<Math.round(360.0 / this.dataNodeStep); n++ )
            this.metData.push( [] );

        // set up the two arrays that hold the pre-calculated angles and distances to the sample
        // points for each time-step
        this.sampleAngle = []; //(double *) new double[ this.nAngularSamples ];
        var angleIncrement = 360.0 / this.nAngularSamples;
        for ( var i = 0; i < this.nAngularSamples; i++ ) {
            this.sampleAngle.push(i * angleIncrement);
        }

        this.sampleDist = [];  //(double *) new double[ this.nRadialSamples ];
        var logIncrement = Math.log(this.radiusStormInfluence) / (this.nRadialSamples - 1.0);
        for ( var j = 0; j < this.nRadialSamples; j++ ) {
            this.sampleDist.push((Math.exp(j * logIncrement) - 1.0) * 1000.0);  // in m
        }

        // finally allocate the array of sample positions. This is a fixed array of radial positions, each
        // element of the array is the X/Y position of the sample point relative to the eye
        this.samplePos = [];  //(double ***) new (double **[ this.nAngularSamples ]);
        for ( i = 0; i < this.nAngularSamples; i++ ) {
            var angle = Math.toRad(this.sampleAngle[i]);
            var cosAng = Math.cos(angle);
            var sinAng = Math.sin(angle);

            this.samplePos[i] = [];  //(double **) new (double *[ this.nRadialSamples ]);
            for ( j = 0; j < this.nRadialSamples; j++ ) {
                this.samplePos[i].push( new THREE.Vector2(this.sampleDist[j] * cosAng, this.sampleDist[j] * sinAng) );
            }
        }

        // allocate the array of CMEtParms to hold the time-step worth of data
        this.sampleData = [];   //(CMetParm **) new (CMetParm *[ this.nAngularSamples ]);
        for (i = 0; i < this.nAngularSamples; i++) {

            // allocate the ray of CMetParm for the time-step data
            this.sampleData[i] = [];   //(CMetParm *) new CMetParm[this.nRadialSamples];
            for (j = 0; j < this.nRadialSamples; j++) {
                this.sampleData[i].push( new MetParm() );
            }
        }

        return true;
    }

    /**
     * Drive the animation, alternating between updating the model and calling back to
     * have it rendered.
     * @returns {number}
     */
    timeStep () {

        var newTime = performance.now();
        var deltaTime = Math.min(newTime - this.currentTime, this.MAX_RENDER_TIME);
        this.currentTime = newTime;

        this.accumulator += deltaTime;

        //console.log("Accum:" + this.accumulator.toFixed(2) + " t: " + this.t.toFixed(2) );

        var n = 0;
        while (this.accumulator >= this.dt) {
            this.accumulator -= this.dt;

            this.update( this.dt / 1000 );

            this.t += this.dt;

            n++;
        }

        var alpha = this.accumulator / this.dt;

        //console.log("Render: " + this.accumulator.toFixed(2) + " t: " + this.t.toFixed(2) + " n: " + n);

        this.renderFunc( this.sampleData );

        return 0;
    }

    /**
     * Performs one time-step iteration for the model
     *
     */
    update ( dt ) {

        // update the available params if the function returns false, the storm is complete
        if (this.updateStormData() === false)
            return true;

        // loop through all the time steps calculating and plotting the wind arrows
        this.nCurStep++;
        this.curTime += this.dTimeStep;

        //this.centreOnScreen = (this.xEye >= this.xMinPlan && this.xEye <= this.xMaxPlan &&
        //                        this.yEye >= this.yMinPlan && this.yEye <= this.yMaxPlan);

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
        for (var i = 0; i < this.nAngularSamples; i++) {
            var angle = this.sampleAngle[i];

            // TRACE("%3d", i);
            for ( var j = 0; j < this.nRadialSamples; j++ ) {

                var velocity = this.calcWindSpeeds(this.sampleDist[j], angle);

                this.sampleData[i][j].xVel = velocity.x;
                this.sampleData[i][j].yVel = velocity.y;

                this.sampleData[i][j].velocity = Math.sqrt(velocity.x * velocity.x + velocity.y * velocity.y);

                // TRACE("(%3.0f, %3.0f) ", xVel,yVel);
            }

            // TRACE("\n");
        }

        this.accumulateData();

        return false;
    }

    /**
     * Get the current, possibly interpolated, data for this time step
     */
    updateStormData () {
        var storm;
        var prevStorm;
        var stormTime;

        if (this.nCurStep === 0) {
            storm = this.stormArray[0];
            this.startStorm = storm.julianDay * 24 + storm.hour;
        }

        var curTime = this.startStorm + this.nCurStep * this.dTimeStep / 3600.0;

        for (var i = 0; i < this.stormArray.length; i++) {
            storm = this.stormArray[i];

            stormTime = storm.julianDay * 24 + storm.hour;

            // if we have found the right spot, interpolate the values we need
            if (stormTime >= curTime)
                break;
        }

        // end of time?
        if (i >= this.stormArray.length)
            return false;

        prevStorm = this.stormArray[i - 1];
        var prevTime = prevStorm.julianDay * 24 + prevStorm.hour;
        var prop = (stormTime - curTime) / (stormTime - prevTime);
        var heading;
        var lon;
        var lat;
        var fwdVelocity;

        if (this.interpolate(storm.heading, prevStorm.heading, prop, heading, HurrModel.MISSING, true) &&
            this.interpolate(storm.fwdVelocity, prevStorm.fwdVelocity, prop, fwdVelocity, HurrModel.MISSING, true) &&
            this.interpolate(storm.x, prevStorm.x, prop, lon, HurrModel.MISSING, true) &&
            this.interpolate(storm.y, prevStorm.y, prop, lat, HurrModel.MISSING, true)) {
            this.cycloneAzimuth = heading;
            this.cycloneAzimuthRadians = Math.toRad(this.cycloneAzimuth);
            this.translationalSpeed = fwdVelocity * HurrModel.NAUTICALMILE_TO_METER / 3600.0;   // knots to m/s
            //this.TSSinAzimuth = this.translationalSpeed * Math.sin(this.cycloneAzimuthRadians) * this.dTimeStep;
            //this.TSCosAzimuth = this.translationalSpeed * Math.cos(this.cycloneAzimuthRadians) * this.dTimeStep;
            this.xEye = lon;
            this.yEye = lat;

            return true;
        }

        return false;
    }

    /**
     * Interpolates the two values to obtain the linear interpolation for the
     * new value.  Interpolates between the values if flag is false, else
     *    does backwards interpolation.
     */

    interpolate (a, b, prop, newValue, missing, bTween) {
        if (a === HurrModel.MISSING || b === HurrModel.MISSING)
            return false;

        var slope = b - a;
        if (bTween) {
            newValue = a + slope * prop;
        }
        else {
            newValue = a - slope * prop;
        }

        return true;
    }

    /**
     * Calculate the cyclone wind velocity, pressure and pressure gradients
     * at a specified point at the current time
     */
    calcWindSpeeds (rDist, Ang) {

        var AziSite = 0;
        var beta = 0;
        var Vel = 0;
        var Rkm = 0;
        var Rf2 = 0;
        var Rb = 0;
        var earb = 0;
        //var R2;
        var PressDiff = 0;
        var Rr = 0;
        var eRr = 0;
        var VelC2 = 0;
        var velocity = new THREE.Vector2(0, 0);

        // calculate the distance from the current point to the cyclone centre
        var polarC = this.carto.cartesianToPolarNorth( this.xNow, this.yNow, this.xEye, this.yEye );

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

        //	TRACE("%8.1f %8.1f %8.1f %8.1f %8.1f %8.1f\n", this.xNow, this.yNow, this.xEye, this.yEye, this.yVelNow, this.xVelNow );

        return velocity;
    }

    /**
     * This accumulates the data from the detailed time-step calcualtions across the nodal grid
     */
    accumulateData () {

        // first, find the closest meridian to the hurricane's center
        var nMeridian = Math.round((180.0 + this.xEye) / this.dataNodeStep);
        var nCenterY = Math.round((90.0 + this.yEye) / this.dataNodeStep);
        var stepKM = this.carto.degToMeters(this.dataNodeStep) / 1000.0;
        var maxRangeX = Math.round(this.radiusStormInfluence / stepKM);

        // clear all the old windfields
        var met;
        for ( var k = 0; k < Math.round(360.0 / this.dataNodeStep); k++ ) {
            if ( this.metData[k] !== undefined ) {
                for ( var n=0; n< Math.round(180.0 / this.dataNodeStep); n++ ) {
                    met = this.metData[k][n];
                    met.xVel = 0.0;
                    met.yVel = 0.0;
                    met.velocity = 0.0;
                }
            }

        }
        // now oscillate back and forth in longitude and accumulate the detailed
        // time step data into the nodal grid

        //var bDone = false;
        //var nDir = 1;
        var index = 0;

        var centerMerc = this.carto.latlonToMerc(this.xEye, this.yEye);
        var xCenter = centerMerc.x;
        var yCenter = centerMerc.y;
        var xNode, yNode;

        // find the lat/lon of the closest node.
        var closeLon = Math.round(this.xEye / this.dataNodeStep) * this.dataNodeStep;
        var closeLat = Math.round(this.yEye / this.dataNodeStep) * this.dataNodeStep;
        var maxDist = Math.hypot(stepKM, stepKM) / 2.0 * 1000.0;  // in m

        do {

            // see if we have already allocated this meridian. If not, do so now
            if (this.metData[nMeridian + index] === undefined)
                this.metData[nMeridian + index] = new MetParm.MetParm[Math.round(180.0 / this.dataNodeStep)];

            // now find the upper and lower bounds that need to be updated

            var angle = Math.atan((index * stepKM) / this.radiusStormInfluence);
            var nRangeY = Math.round(Math.abs(Math.cos(angle)) * this.radiusStormInfluence / stepKM);
            var rPos = [];
            var aPos = [];

            var lon = closeLon + index * this.dataNodeStep;
            var lat = closeLat - nRangeY * this.dataNodeStep;
            var nodeMerc;
            var weight;

            for ( n = -nRangeY; n < nRangeY; n++) {
                met = this.metData[nMeridian + index][nCenterY + n];
                nodeMerc = this.carto.latlonToMerc(lon, lat);
                xNode = nodeMerc.x;
                yNode = nodeMerc.y;

                // now find the four closest sampled points
                var nClose = this.findClosest(xNode - xCenter, yNode - yCenter, rPos, aPos);

                if (nClose > 0) {
                    var xVel = 0.0;
                    var yVel = 0.0;
                    var sumWeight = 0.0;
                    var xSamp = 0.0;
                    var ySamp = 0.0;
                    for (var j = 0; j < nClose; j++) {
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
     * @returns             number of closest points
     */
    findClosest  (x, y, rPos, aPos) {

        var n = 0;
        var angle = Math.toDeg(Math.atan2(y, x));

        if (angle < 0.0)
            angle += 360.0;

        var angleIndex = Math.round(angle / 360.0 * this.nAngularSamples);
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