/*r
 * Storm data for a single observation for the hurricane modelling
 *
 * These are the time-node state parameters that are derived from the raw storm file.
 * They are effectively the inputs for each time step.
 *
 * @author rkwright / www.geofx.com
 *
 * Copyright 2017, All rights reserved.
 *
 */

class Storm {
	// constants
	static REVISION = "1.0.0";

	/**
	 * @constructor
	 */
	constructor( curStorm, julian ) {
		this.name = curStorm.name;
		this.id = curStorm.atcID;

		this.obs = [];
		for ( let i in curStorm.entries ) {
			let entry = curStorm.entries[i];
			let stormObs = new StormObs();

			stormObs.lon = entry[StormFile.LON];
			stormObs.lat = entry[StormFile.LAT];
			stormObs.pressure = entry[StormFile.MINPRESS];
			stormObs.velocity = -1;  	// compute!
			stormObs.heading = -1;      // compute!
			stormObs.windspeed = entry[StormFile.MAXWIND];
			stormObs.maxWind = entry[StormFile.MAXWIND];
			stormObs.minPress = entry[StormFile.MINPRESS];
			stormObs.hour = entry[StormFile.TIME] / 100;    // NASA formats the time as 0,600,1200,1800
			stormObs.day = entry[StormFile.DAY];
			stormObs.month = entry[StormFile.MONTH];
			stormObs.year = entry[StormFile.YEAR];
			stormObs.julianDay = julian.getJulian( entry[StormFile.DAY], entry[StormFile.MONTH],
											entry[StormFile.YEAR],);

			this.obs.push( stormObs );
		}
	}
}

class StormObs {
	// constants
	static REVISION = "1.1.0";

	/**
	 * @constructor
	 */
	constructor() {
		this.lon = 0;
		this.lat = 0;
		this.pressure = 0;
		this.velocity = 0;
		this.heading = 0;
		this.windspeed = 0;
		this.hour = 0;
		this.day = 0;
		this.month = 0;
		this.year = 0;
		this.julianDay = 0;
	}
}