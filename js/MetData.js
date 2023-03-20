/*
 * Meteorological parameters for the hurricane modelling
 *
 * Original Fortran (!) code by Michael Drayton.
 *
 * @author rkwright / www.geofx.com
 *
 * Copyright 2017, All rights reserved.
 */

class MetData {

	// constants
	REVISION = "1.1.0";

	/**
	 * @constructor
	 */
	constructor() {
		this.yVel = 0.0;
		this.xVel = 0.0;
		this.yVelMax = 0.0;
		this.xVelMax = 0.0;
		this.velocity = 0.0;
		this.maxVelocity = 0.0;
		this.pressure = 0.0;
		this.minPressure = 0.0;

		this.lat = 0.0;
		this.lon = 0.0;
		this.mesh = {};
	}
}