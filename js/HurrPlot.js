/*
 * Hurricane Plot setup.
 *
 * @author rkwright / www.geofx.com
 *
 * Copyright 2018, All rights reserved.
 *
 */

//<script src="gfx/gfx-scene.js"></script>

'use strict';
class HurrPlot  {

    // Constants
    static REVISION = '1.1.0';

    static TRACK_DIA = 0.002;

    // ----- Constants ------
    static SAFFIR =  [
        {cat: '5', minMPH: 157, color: 0xff6060},
        {cat: '4', minMPH: 130, color: 0xff8f20},
        {cat: '3', minMPH: 111, color: 0xffc140},
        {cat: '2', minMPH: 96, color: 0xffe775},
        {cat: '1', minMPH: 74, color: 0xffffcc},
        {cat: 'TS', minMPH: 39, color: 0x01faf4},
        {cat: 'TD', minMPH: 33, color: 0x5dbaff}
    ];

    //--- class methods ---
    constructor () {

        // allocate the Scene object, request orbitControls, some of 3D axes 10 units high and the stats
        this.gfxScene = new GFX.Scene( {
            cameraPos : [4, 3, 4],
            controls:true,
            datgui:true,
            guiWidth:400,
            displayStats:true});

        this.saffirMat = [];
        this.createSaffirMat();

        this.earth = new THREE.Group();
        this.earthGlobe = new THREE.SphereGeometry(2,32,32);

        this.carto = new Carto();

        window.plotObj = this;
    }

    // class methods

    createGlobe() {
        this.createGlobeMat( this.finishGlobe, this );
    }

    createGlobeMat ( callBack, pThis ) {
        let textureLoader = new THREE.TextureLoader();
        let material = new THREE.MeshPhongMaterial({color: '#ffffff', transparent: false, opacity: 0.75});
        textureLoader.load("images/8081-earthmap8k.jpg", function (texture) {
            material.map = texture;
            material.needsUpdate = true;
            textureLoader.load("images/8081-earthbump8k.jpg", function (bump) {
                material.bumpMap = bump;
                material.bumpScale = 0.05;

                callBack(material, pThis);
            });
        });
    }

    finishGlobe ( material, pThis ) {
        window.plotObj.earthMesh = new THREE.Mesh (pThis.earthGlobe, material );
        pThis.earth.add( window.plotObj.earthMesh );
        pThis.gfxScene.add( pThis.earth );
        pThis.animateScene();
    }

    /**
     * Animate the scene and call rendering.
     */
    animateScene = () => {

        // Tell the browser to call this function when page is visible
        requestAnimationFrame(this.animateScene);

        // tell the hurricane model to update itself and call back to render when it can
        //hurrModel.timeStep();

        window.plotObj.earth.rotation.y += 0.001;

        // Map the 3D scene down to the 2D screen (render the frame)
        this.gfxScene.renderScene();
    }

    /**
     *
     */
    createSaffirMat () {
        for ( let i in HurrPlot.SAFFIR ) {
            this.saffirMat[i] = new THREE.MeshLambertMaterial({color: HurrPlot.SAFFIR[i].color});
        }
    }

    /**
     * Return the Saffir-Simpson category for the specified windspeed, in MPH
     * @param windSpeed
     * @returns {*}
     */
    getSaffirCat (windSpeed) {
        for ( var i in HurrPlot.SAFFIR ) {
            if (windSpeed >= HurrPlot.SAFFIR[i].minMPH)
                break;
        }

        return i;
    }

    /**
     * Plot the current storm track by fetching the set of positions and creating
     * great-circle arcs for each and creating a curve in three.js for them.
     *
     * The procedure is:
     * - iterate over the storm track entries
     * - for each pair of points
     * - calculate the great circle arc, which returns an array of lat/lon [n][2]
     * - generate the transform of that array into scaled 3D-space as an array of Vector3
     * - generate a CatMullCurve using three.js
     * - generate a tube geometry using that curve, returns the resulting geometry
     */
    plotStormTrack ( curStorm ) {
        var gcGen = new GreatCircle();
        var points;
        var startLL = {lat: curStorm.entries[0][StormFile.LAT], lon: curStorm.entries[0][StormFile.LON]};
        var endLL = {};
        var xyz;
        var plot = window.plotObj;
        let tracksGroup = new THREE.Group();
        tracksGroup.trackID = curStorm.atcID;
        var saffirCat = plot.getSaffirCat(curStorm.entries[0][StormFile.MAXWIND]);
        var mat = plot.saffirMat[saffirCat];

        let mesh = plot.roundJoin(startLL.lat, startLL.lon, mat);
        tracksGroup.add( mesh);

        console.log(" LL: " + startLL.lat + ", " + startLL.lon);

        for ( let i = 1; i < curStorm.entries.length; i++) {
            endLL = {lat: curStorm.entries[i][StormFile.LAT], lon: curStorm.entries[i][StormFile.LON]};

            saffirCat = plot.getSaffirCat(curStorm.entries[i][StormFile.MAXWIND]);
            mat = plot.saffirMat[saffirCat];

            mesh = plot.roundJoin(endLL.lat, endLL.lon, mat);
            tracksGroup.add(mesh);
            //console.log(" LL: " + endLL.lat + ", " + endLL.lon);

            points = gcGen.generateArc(startLL, endLL, 10, {offset: 10});

            var pts = points[0];
            var track = [];

            for ( let j in pts ) {
                xyz = this.carto.latLonToXYZ(pts[j][1], pts[j][0], 2.0);
                track.push(xyz);
                //console.log("xyz: " + xyz.x.toFixed(2) + " " + xyz.y.toFixed(2) + " " + xyz.z.toFixed(2));
            }

            var curve = new THREE.CatmullRomCurve3(track);
            var geometry = new THREE.TubeGeometry(curve, track.length, HurrPlot.TRACK_DIA, 32, false);

            var arcMesh = new THREE.Mesh(geometry, mat);
            tracksGroup.add(arcMesh);

            startLL = endLL;
        }
        plot.earth.add(tracksGroup);
    }

    /**
     * Create a sphere to form the "round join" between sections of the track
     */
    roundJoin (lat, lon, mat) {

        var join = new THREE.SphereGeometry(HurrPlot.TRACK_DIA, 32, 32);

        var xyz = this.carto.latLonToXYZ(lat, lon, 2.0);

        var mesh = new THREE.Mesh(join, mat);
        mesh.position.set(xyz.x, xyz.y, xyz.z);
        //this.gfxScene.add(mesh);
        return mesh;
    }

    /**
     * Called by the hurricane model to have the sample data rendered
     * In this case, the wind arrows and eye are already in existence
     * so we just update the location of the eye and set the direction
     * and scale of the arrows
     */
    renderHurricane (eyex, eyeY, sampleData) {

    }

}