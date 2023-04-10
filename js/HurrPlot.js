/*
 * Hurricane Plot setup.
 *
 * @author rkwright / www.geofx.com
 *
 * Copyright 2018, All rights reserved.
 *
 */

//<script src="gfx/gfx-scene.js"></script>

//'use strict';
class HurrPlot  {

    // ----- Constants ------
    static REVISION = '1.1.0';

    static TRACK_DIA = 0.002;
    static GLOBE_DIAM = 2.0;
    static GEOM_SEGMENTS = 8;
    static GLOBE_SEGMENTS = 32;
    static MAX_RENDER_TIME = 0.5;

    static SAFFIR =  [
        {cat: '5', minMPH: 157, color: 0xff6060},
        {cat: '4', minMPH: 130, color: 0xff8f20},
        {cat: '3', minMPH: 111, color: 0xffc140},
        {cat: '2', minMPH: 96, color: 0xffe775},
        {cat: '1', minMPH: 74, color: 0xffffcc},
        {cat: 'TS', minMPH: 39, color: 0x01faf4},
        {cat: 'TD', minMPH: 33, color: 0x5dbaff}
    ];

    static ROTATION_RATE = 0.002;

    //--- Class Methods ---
    constructor ( hurrModel ) {

        this.hurrModel = hurrModel;

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
        this.earthGlobe = new THREE.SphereGeometry(HurrPlot.GLOBE_DIAM,
                                                   HurrPlot.GLOBE_SEGMENTS, HurrPlot.GLOBE_SEGMENTS);
        this.rotationRate =  0.0;

        this.carto = new Carto();

        this.arrowMesh = this.createArrowMesh();

        window.plotObj = this;
    }

    /**
     * Create the
     */
    createGlobe() {
        this.createGlobeMat( this.finishGlobe, this );
    }

    createGlobeMat ( callBack, pThis ) {
        let textureLoader = new THREE.TextureLoader();
        let material = new THREE.MeshPhongMaterial({color: '#ffffff', transparent: true, opacity: 0.5});
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

    /**
     *
     * @param material
     * @param pThis
     */
    finishGlobe ( material, pThis ) {
        window.plotObj.earthMesh = new THREE.Mesh (pThis.earthGlobe, material );
        pThis.earth.add( window.plotObj.earthMesh );
        pThis.gfxScene.add( pThis.earth );

        pThis.createArrows();

        pThis.animateScene();
    }

    /**
     * Allows user to control whether globe is spinning or not.
     * @param rotOn
     */
    setRotation ( rotOn ) {
        this.rotationRate = rotOn ? HurrPlot.ROTATION_RATE : 0.0;
    }

    /**
     * Animate the scene and call rendering.
     */
    animateScene = () => {

        // Tell the browser to call this function when page is visible
        requestAnimationFrame(this.animateScene);

        // tell the hurricane model to update itself and call back to render when it can
        if ( hurrModel.modelStep === true ) {
            hurrModel.timeStep();
            hurrModel.modelStep = false;
        }

        window.plotObj.earth.rotation.y += this.rotationRate;

        // Map the 3D scene down to the 2D screen (render the frame)
        this.gfxScene.renderScene();
    }

    /**
     * Create the set of Saffir-colored materials
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
        let i = 0;
        for ( i in HurrPlot.SAFFIR ) {
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
        let plot = window.plotObj;
        let gcGen = new GreatCircle();
        let points;
        let startLL = {lat: curStorm.obs[0].lat, lon: curStorm.obs[0].lon };
        let endLL = {};
        let xyz;

        let trackGroup = new THREE.Group();
        trackGroup.name = curStorm.atcID;

        plot.removeOldTrack( plot );

        let saffirCat = plot.getSaffirCat(curStorm.obs[0].maxWind);
        let mat = plot.saffirMat[saffirCat];
        let mesh = plot.roundJoin(startLL.lat, startLL.lon, mat);
        trackGroup.add( mesh);

        //console.log("***** Storm: " + curStorm.atcID + "  " + curStorm.name + " *****");
        //console.log(" LL: " + startLL.lat + ", " + startLL.lon);

        for ( let i = 1; i < curStorm.obs.length; i++) {
            endLL = {lat: curStorm.obs[i].lat, lon: curStorm.obs[i].lon};

            saffirCat = plot.getSaffirCat(curStorm.obs[i].maxWind);
            mat = plot.saffirMat[saffirCat];

            mesh = plot.roundJoin(endLL.lat, endLL.lon, mat);
            trackGroup.add(mesh);
            //console.log(" LL: " + endLL.lat + ", " + endLL.lon);

            points = gcGen.generateArc(startLL, endLL, 10, {offset: 10});

            let pts = points[0];
            let track = [];

            for ( let j in pts ) {
                xyz = plot.carto.latLonToXYZ(pts[j][1], pts[j][0], HurrPlot.GLOBE_DIAM);
                track.push(xyz);
                //console.log("xyz: " + xyz.x.toFixed(2) + " " + xyz.y.toFixed(2) + " " + xyz.z.toFixed(2));
            }

            let curve = new THREE.CatmullRomCurve3(track);
            let geometry = new THREE.TubeGeometry(curve, track.length,
                                          HurrPlot.TRACK_DIA, HurrPlot.GEOM_SEGMENTS, false);

            let trackMesh = new THREE.Mesh(geometry, mat);
            trackGroup.add(trackMesh);

            startLL = endLL;
        }

        plot.earth.add(trackGroup);
    }

    /**
     * Remove the old track, if any.  We identify it because it's a Group.  A more secure
     * method would be good. Note that we have to both remove the object we added to three.js
     * scene, but we also have to remove our own copy.
     *
     * @param plot
     */
    removeOldTrack( plot ) {
        for ( let k in plot.earth.children ) {
            if (plot.earth.children[k] instanceof THREE.Group) {
                // find the actual track mesh in the scene and remove it
                let obj = plot.gfxScene.scene.getObjectByName( plot.earth.children[k].name);
                if ( obj !== undefined ){
                    plot.gfxScene.scene.remove( obj );
                }
                // then remove the track-mesh we stored
                plot.earth.children.splice( Number(k), 1 );
            }
        }
    }

    /**
     * Create a sphere to form the "round join" between sections of the track
     */
    roundJoin (lat, lon, mat) {

        let join = new THREE.SphereGeometry(HurrPlot.TRACK_DIA*1.5, 32, 32);

        let xyz = this.carto.latLonToXYZ(lat, lon, 2.0);

        let mesh = new THREE.Mesh(join, mat);
        mesh.position.set(xyz.x, xyz.y, xyz.z);

        return mesh;
    }

    /**
     *  Creates an arrow and returns the mesh
     */
    createArrowMesh () {

        const TIPY            = 0.75;	// position in Y of arrow-head tip
        const TIPX            = 0.0;	// position in X of arrow-head tip
        const BASE            = 0.1;	// base of arrow-head in Y
        const HEAD_WIDTH      = 0.3;	// half-width of the arrow-head in X
        const NEG_HEAD_WIDTH  = -0.3;	// half-width of the arrow-head in X
        const SHAFT_WIDTH     = 0.1;	// half-width of the arrow-shaft in X
        const NEG_SHAFT_WIDTH = -0.1;	// half-width of the arrow-shaft in X
        const SHAFT_END       = -0.5;	// end of the arrow-shaft in Y
        const THICKNESS       = 0.1;	// half-thickness of the arrow in Z
        const NEG_THICKNESS   = -0.1;	// half-thickness of the arrow in Z

        // head of the arrow
        let   	vA = { x:NEG_HEAD_WIDTH, y:BASE, z:THICKNESS };
        let		vB = { x:TIPX, y:TIPY, z:THICKNESS };
        let		vC = { x:HEAD_WIDTH, y:BASE, z:THICKNESS };
        let		vD = { x:NEG_HEAD_WIDTH, y:BASE, z:NEG_THICKNESS };
        let		vE = { x:TIPX, y:TIPY, z:NEG_THICKNESS };
        let		vF = { x:HEAD_WIDTH, y:BASE, z:NEG_THICKNESS };

        // the tail, i.e. the box part of the arrow
        let		vG = { x:NEG_SHAFT_WIDTH, y:BASE, z:THICKNESS };
        let		vH = { x:SHAFT_WIDTH, y:BASE, z:THICKNESS };
        let		vI = { x:NEG_SHAFT_WIDTH, y:SHAFT_END, z:THICKNESS };
        let		vJ = { x:SHAFT_WIDTH, y:SHAFT_END, z:THICKNESS };
        let		vK = { x:NEG_SHAFT_WIDTH, y:BASE, z:NEG_THICKNESS };
        let		vL = { x:SHAFT_WIDTH, y:BASE, z:NEG_THICKNESS };
        let		vM = { x:NEG_SHAFT_WIDTH, y:SHAFT_END, z:NEG_THICKNESS };
        let		vN = { x:SHAFT_WIDTH, y:SHAFT_END, z:NEG_THICKNESS };

        let nFaces = 18;
        let nVerticesPerFace = 3;
        let coordsPerVertex = 3;
        let nVerts = nFaces * nVerticesPerFace * coordsPerVertex;

        const arrowVerts = new Float32Array(nVerts);
        const arrowNorms = new Float32Array(nVerts);
        let  counter = { n: 0 };

        // the head of the arrow
        this.triangleFace( vC, vB, vA, arrowVerts, arrowNorms, counter );
        this.triangleFace( vB, vC, vF, arrowVerts, arrowNorms, counter );
        this.triangleFace( vB, vF, vE, arrowVerts, arrowNorms, counter );
        this.triangleFace( vC, vA, vD, arrowVerts, arrowNorms, counter );
        this.triangleFace( vC, vD, vF, arrowVerts, arrowNorms, counter );
        this.triangleFace( vA, vB, vD, arrowVerts, arrowNorms, counter );
        this.triangleFace( vB, vE, vD, arrowVerts, arrowNorms, counter );
        this.triangleFace( vE, vF, vD, arrowVerts, arrowNorms, counter );

        // the tail, i.e. the box part of the arrow
        this.triangleFace( vG, vI, vJ, arrowVerts, arrowNorms, counter );
        this.triangleFace( vG, vJ, vH, arrowVerts, arrowNorms, counter );
        this.triangleFace( vH, vJ, vN, arrowVerts, arrowNorms, counter );
        this.triangleFace( vH, vN, vL, arrowVerts, arrowNorms, counter );
        this.triangleFace( vI, vG, vM, arrowVerts, arrowNorms, counter );
        this.triangleFace( vM, vG, vK, arrowVerts, arrowNorms, counter );
        this.triangleFace( vJ, vI, vM, arrowVerts, arrowNorms, counter );
        this.triangleFace( vJ, vM, vN, arrowVerts, arrowNorms, counter );
        this.triangleFace( vL, vN, vM, arrowVerts, arrowNorms, counter );
        this.triangleFace( vM, vK, vL, arrowVerts, arrowNorms, counter );

        const arrowGeometry = new THREE.BufferGeometry();
        arrowGeometry.addAttribute('position', new THREE.BufferAttribute(arrowVerts, 3));
        arrowGeometry.addAttribute('normal', new THREE.BufferAttribute(arrowNorms, 3 ));

        //const arrowColors = [];
        //for ( let i=0; i<nVerts; i++ ) {
        //    arrowColors.push( 255, 0, 0 );
        //}
        const material = new THREE.MeshLambertMaterial({  color: 0xffffff, flatShading: true });
        let arrowMesh = new THREE.Mesh(arrowGeometry, material);
        arrowMesh.rotateX(Math.HALF_PI);
        let scale3D = { x: 0.01, y: 0.01, z:0.01 }
        arrowMesh.scale.x = scale3D.x;
        arrowMesh.scale.y = scale3D.y;
        arrowMesh.scale.z = scale3D.z;

        return arrowMesh;
    }

    /**
     * Defines single, normalized triangle face
     *
     * @param vA
     * @param vB
     * @param vC
     * @param arrowVerts
     * @param arrowNorms
     * @param counter
     */
    triangleFace ( vA, vB, vC, arrowVerts, arrowNorms,  counter ) {
        let n = counter.n;
        arrowVerts[n++] = vA.x;
        arrowVerts[n++] = vA.y;
        arrowVerts[n++] = vA.z;
        arrowVerts[n++] = vB.x;
        arrowVerts[n++] = vB.y;
        arrowVerts[n++] = vB.z;
        arrowVerts[n++] = vC.x;
        arrowVerts[n++] = vC.y;
        arrowVerts[n++] = vC.z;

        let normal = Math.calcNormal(vA, vB, vC)

        n = counter.n;
        for ( let k=0;k<3; k++ ) {
            arrowNorms[n++] = normal.x;
            arrowNorms[n++] = normal.y;
            arrowNorms[n++] = normal.z;
        }

        counter.n = n;
    }

    /**
     * Create the set of arrows to represent the windfields.
     *
     * @param arrowMesh
     */
     createArrows() {

        this.arrowGroup = new THREE.Group();

        this.arrows = [];
        for ( let  k=0; k<HurrModel.DIMX * 2; k++ ) {
            this.arrows.push( [] );
            for ( let n=0; n<HurrModel.DIMY * 2; n++ ) {
                this.arrows[k][n] = this.arrowMesh.clone();
                this.arrowGroup.add(this.arrows[k][n]);
            }

            this.gfxScene.add( this.arrowGroup );
        }
    }
    /**
     * Called by the hurricane model to have the sample data rendered
     * In this case, the wind arrows and eye are already in existence
     * so we just update the location of the eye and set the direction
     * and scale of the arrows
     */
    renderHurricane ( eyeX, eyeY, metData, dataRect, arrows ) {
        // console.log("eyeX,Y: " + eyeX + "," + eyeY + " dataRect: x,y0: " + dataRect.x0 + "," + dataRect.y0 + " x,y1: " + dataRect.x1 + "," + dataRect.y1 );

        if ( dataRect.x1 === 0 && dataRect.y1 === 0)
            return;


        let arrow;
        let met;
        for ( let j = dataRect.x0; j < dataRect.x1; j++ ) {
            for ( let i = dataRect.y0; i<dataRect.y1; i++ ) {
                met = metData[j][i];

                let xyz = this.carto.latLonToXYZ(met.lat, met.lon, HurrPlot.GLOBE_DIAM);
                arrow = arrows[j - dataRect.x0][i - dataRect.y0];
                arrow.position.set(xyz.x, xyz.y, xyz.z);
            }
        }

        if (this.ballMesh === undefined) {
            let mat = new THREE.MeshLambertMaterial({  color: 0xff0000, flatShading: true });
            let ball = new THREE.SphereGeometry(0.005, 8, 8);
            this.ballMesh = new THREE.Mesh(ball, mat);
            window.plotObj.earth.add(this.ballMesh);
        }

        let xyz = this.carto.latLonToXYZ(eyeY, eyeX, 2.0);
        this.ballMesh.position.set(xyz.x, xyz.y, xyz.z);
    }
}