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
    static REVISION = '1.0';

    static  fThis = this;

    // Constructor
    constructor () {
        //this.gfxScene = gfxScene;

        this.ready = false;
        //var gThis = this;

        // allocate the Scene object, request orbitControls, some of 3D axes 10 units high and the stats
        this.gfxScene = new GFX.Scene( {
            cameraPos : [4, 3, 4],
            controls:true,
            datgui:true,
            guiWidth:350,
            displayStats:true});

        this.saffirMat = [];
        this.createSaffirMat();

        this.earthMesh;
        this.earthGlobe = new THREE.SphereGeometry(2,32,32);
        //var self = this;

        window.plotObj = this;
    }

    // class methods

    createGlobe() {
        this.createGlobeMat( this.finishGlobe, this );
    }

    createGlobeMat ( callBack, pThis ) {
        var textureLoader = new THREE.TextureLoader();
        var bumpLoader = new THREE.TextureLoader();
        var material = new THREE.MeshPhongMaterial({color: '#ffffff', transparent: true, opacity: 0.75});
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
        window.plotObj.earthMesh = new THREE.Mesh(pThis.earthGlobe, material);
        pThis.gfxScene.add(window.plotObj.earthMesh);
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

        window.plotObj.earthMesh.rotation.y += 0.01;

        // Map the 3D scene down to the 2D screen (render the frame)
        this.gfxScene.renderScene();
    }

    /**
     *
     */
    createSaffirMat () {
        var storm = new StormData();
        for (var i = 0; i < StormData.SAFFIR.length; i++) {
            this.saffirMat[i] = new THREE.MeshLambertMaterial({color: StormData.SAFFIR[i].color});
        }
    }

    //////////////
    /**
     * Create the sphere mesh and wrap it with the image
     */
    createGlobe0 () {
        this.earthGlobe = new THREE.SphereGeometry(2, 32, 32);

        var textureLoader = new THREE.TextureLoader();
        var bumpLoader = new THREE.TextureLoader();
        var mat = new THREE.MeshPhongMaterial({color: '#ffffff', transparent: true, opacity: 0.75});
        textureLoader.load("images/8081-earthmap8k.jpg", function (texture) {
            mat.map = texture;
            mat.needsUpdate = true;
            textureLoader.load("images/8081-earthbump8k.jpg", function (bump) {
                mat.bumpMap = bump;
                mat.bumpScale = 0.05;

                window.plotObj.earthMesh = new THREE.Mesh(globe, mat);
                fThis.gfxScene.add(window.plotObj.earthMesh);
                this.ready = true;
            });
        });
    }
}