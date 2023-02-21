/*
 * Hurricane Gui setup.
 *
 * @author rkwright / www.geofx.com
 *
 * Copyright 2018, All rights reserved.
 *
 */

'use strict';
class HurrGui  {

    // Constants
    static REVISION = '1.1.0';

    // Constructor
    constructor( gui, stormFile, updateCallback, runCallback ) {
        this.gui = gui;
        this.stormFile = stormFile;
        this.updateCallback = updateCallback;
        this.runCallback = runCallback;

        this.stormOptions = {};

        window.gThis = this;
    }

    /**
     *
     */
    setupDatGui = () => {

        this.setupGui();
        this.setupYearsGui();
        this.setupStormsGui();
        this.setupEntriesGui();

        this.updateYears(this.curStorm.entries[0][StormFile.YEAR]);
        this.updateStorms(this.curStorm.entries[0][StormFile.YEAR]);
        this.updateEntries(this.storms[0]);
    }

    /**
     * Set up the datgui controls on the basis of the loaded storm data
     */
    setupGui = () => {
        this.hurrGui = this.gui.addFolder("Hurricanes");

        this.years = this.stormFile.getYearsWithStorms();
        this.storms = this.stormFile.getStormsForYear(this.years[0]);
        this.curStorm = this.storms[0];
        this.stormLabels = this.getStormLabels(this.storms);
        this.entryLabels = this.getEntryLabels(this.storms[0]);

        this.stormOptions.year = this.years[0];
        this.stormOptions.stormLabels = this.stormLabels[0];
        this.stormOptions.entryLabels = this.entryLabels[0];

        this.hurrGui.open();
    }

    /**
     * Set up the years gui
     */
    setupYearsGui = () => {
       // this.yearsGui = this.gui.addFolder("Years");
       // this.yearsGui.open();
    }

    /**
     * Set up the storms gui
     */
    setupStormsGui = () => {
       // this.stormsGui = this.gui.addFolder("Storms");
        //this.stormsGui.open();
    }

    /**
     * Set up the entries gui
     */
    setupEntriesGui = () => {
      //  this.entriesGui = this.gui.addFolder("Entries");
      //  this.entriesGui.open();
    }

    /**
     * Update the existing controller for years and create a new one.
     * Have to do it this way as there appears to be no easy way to
     * "refresh" the data in a controller
     */
    updateYears (year) {
        if (this.yearsGui !== undefined ) {
            this.hurrGui.remove(this.yearsGui);
            console.log(this.yearsGui);
        }

        this.yearsGui = this.hurrGui.add(this.stormOptions, "year", this.years).name("Years").onChange(this.yearChange);
    }

    /**
     * Handle change in the year combo-box
     */
    yearChange () {
        console.log("Changed year");

        var gThis = window.gThis;
        gThis.updateStorms(gThis.stormOptions.year);
        gThis.updateEntries(gThis.storms[0]);
    }

    /**
     * Update the existing controller for years and create a new one.
     * Have to do it this way as there appears to be no easy way to
     * "refresh" the data in a controller
     */
    updateStorms (year) {
        if (this.stormsGui !== undefined)
            this.hurrGui.remove(this.stormsGui);

        this.storms = this.stormFile.getStormsForYear(Number(year));
        this.curStorm = this.storms[0];
        this.stormLabels = this.getStormLabels(this.storms);
        this.stormOptions.stormLabels = this.stormLabels[0];

        this.stormsGui = this.hurrGui.add(this.stormOptions, "stormLabels", this.stormLabels).name("Storms").onChange(this.stormsChange);
    }

    /**
     * Handle the change event for the storms controller
     */
    stormsChange () {
        var gThis = window.gThis;
        var index = gThis.stormLabels.indexOf( gThis.stormOptions.stormLabels );
        gThis.curStorm = gThis.storms[index];
        gThis.updateEntries( gThis.curStorm );
    }

    /**
     * Simple access to the currently selected storm
     * @returns {*}
     */
    getCurrentStorm() {
        return gThis.curStorm;
    }

    /*
     * Update existing controller for the entries and create a new one
     */
    updateEntries (storm) {
        if (this.entriesGui !== undefined)
            this.hurrGui.remove( this.entriesGui );

        this.entryLabels = this.getEntryLabels(storm);
        this.stormOptions.entryLabels = this.entryLabels[0];

        this.entriesGui = this.hurrGui.add(this.stormOptions, "entryLabels", this.entryLabels).name("Entries").onChange(this.entriesChange);
    }

    /**
     * Handle the change event for the entries controller.  Not used yet.
     */
    entriesChange () {
        var gThis = window.gThis;
        gThis.entryLabels.indexOf( gThis.stormOptions.entryLabels );
    }

    /**
     * For each storm, fetch the ATCID and Name, concatenate them and add
     * them to the array
     *
     * @param storms
     * @returns {Array}
     */
    getStormLabels ( storms ) {
        var results = [];
        var storm;
        var mois = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

        for (var index = 0; index < storms.length; index++) {
            storm = storms[index];
            var entry = storm.entries[0];
            var start = mois[entry[1]] + " " + entry[2];
            if (storm) {
                var label = storm.atcID + " : " + storm.name + " : " + start;
                results.push(label);
            }
        }

        return results;
    }

    /**
     * Construct an array of strings which comprises the data in each entry
     * @param storm
     * @returns {Array}
     */
    getEntryLabels ( storm ) {
        var results = [];
        var entry;
        var label;

        for (var index = 0; index < storm.entries.length; index++) {
            entry = storm.entries[index];
            if (entry) {
                label = entry[2] + " " + this.pad("0000", entry[3], true).substring(0, 2) + "h " + entry[6].toFixed(1) + " " +
                    entry[7].toFixed(1) + " " + entry[8].toFixed(0) + " " + entry[9].toFixed(0);

                results.push(label);
            }
        }

        return results;
    }

    /**
     * Pad a string with specified chars, left or right
     * For example, to zero pad a number to a length of 10 digits,
     *     pad('0000000000',123,true);  ->   "0000000123"
     *
     * @param pad       the string to fill
     * @param str       the string to be padded
     * @param padLeft   padding on the left or right
     * @returns {*}
     */
    pad ( pad, str, padLeft ) {
        if (typeof str === 'undefined')
            return pad;
        if (padLeft) {
            return (pad + str).slice(-pad.length);
        } else {
            return (str + pad).substring(0, pad.length);
        }
    }

}
