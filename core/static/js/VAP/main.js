function invertColor(color) {
	return new THREE.Color(1.0-color.r, 1.0-color.g, 1.0-color.b);
}

function drawPlainGrid( white_theme=false ) {
	if (white_theme)
		var grid = new THREE.GridHelper(200, 20, '#000', '#000');
	else
		var grid = new THREE.GridHelper(200, 20, '#5BB', '#FFF');
	grid.position.y-=0.2;
	return grid;
}

function drawAxes() {
	var axes = new THREE.AxesHelper( 100 );
	return axes;
}


function getColorScheme( clusters, white_theme=false ) {
	var clusters_unique = Array.from(new Set(clusters));
	var len = clusters_unique.length;
	var results = {};
	if (len==1){
		if (white_theme)
			results[clusters_unique[0]] = new THREE.Color(0.8,0.8,0.8);
		else
			results[clusters_unique[0]] = new THREE.Color(1,1,1);
	}
	else
		if ( len == 2 ) {
			results[clusters_unique[0]] = new THREE.Color(1,0,0);
			results[clusters_unique[1]] = new THREE.Color(0,0,1);
		} else {
			var parts = Math.round(Math.log(len)/Math.log(3)+0.5);
			var base = parts - 1;
			if (base == 0)
				base = 1;
			for( var i = 0; i < len; i++ ) {
				if (white_theme)
					results[clusters_unique[i]] = new THREE.Color( (~~(i/(parts*parts)))%parts/base*0.8 , (~~(i/parts))%parts/base*0.8 , i%parts/base*0.8 );
				else
					results[clusters_unique[i]] = new THREE.Color( 1-(~~(i/(parts*parts)))%parts/base , 1-(~~(i/parts))%parts/base , 1-i%parts/base );
			}
		}
	return results;
}

function sendAjaxPredicRequest(selectedObject, otherData, sceneObj){
	data = { formt: 'rebuild', data: JSON.stringify(selectedObject.dataObject[1])};
	allData = Object.assign.apply({}, [data, otherData]);
	$.ajax({
				type:"POST",
				url: "",
				data : allData,
				success : function(results_dict) {
					scene.changeCluster(selectedObject, results_dict['results'][0]);
					console.log(results_dict['clustertype']);
				},
				failure: function(data) {
					alert('There was an error. Sorry');
				}
			})
}

class Scene {

	constructor(mainDiv, defaultRadius, numberOfSegements, theme='black') {
			this.mainDiv = mainDiv;
			mainDiv.sceneObject = this;

			this.selectedObject = null;

			// init renderer
			this.renderer = new THREE.WebGLRenderer( { antialias: true } );
			this.renderer.setPixelRatio( window.devicePixelRatio );
			this.renderer.setSize( mainDiv.clientWidth, mainDiv.clientHeight );
			mainDiv.appendChild( this.renderer.domElement );

			// init scene
			this.scene = new THREE.Scene();

			this.groupOfGrid = new THREE.Group();
			this.scene.add(this.groupOfGrid);

			this.groupOfSpheres = new THREE.Group();
			this.scene.add(this.groupOfSpheres);

			// init camera
			this.camera = new THREE.PerspectiveCamera( 50, mainDiv.clientWidth / mainDiv.clientHeight, 1, 1000 );
			this.camera.position.set(100, 100, 100);
			this.camera.lookAt( this.scene.position );

			this.controls = new THREE.OrbitControls( this.camera, this.renderer.domElement );
			this.controls.enableRotate = true;
			this.controls.saveState();

			this.clusters = undefined;
			
			this.raycaster = new THREE.Raycaster();
			this.mouseVector = new THREE.Vector3();
			this.dragControls = null;
			this.dragEnabled = false;
			this.grid = undefined;
            this.groupOfGrid.add(drawAxes());

			//this.drawAxes();

            // init lights
            this.initLight();

            //mainDiv.addEventListener( 'resize', this.onResize, false );
			mainDiv.addEventListener( "click", function(event){this.sceneObject.onMouseClick(event);}, false );
			this.changeTheme(theme);

			this.height = 10;
			this.defaultSpRad = defaultRadius;
			this.width = 10;
			this.proectionSubSpace = [0,1,2];
			this.dimNames=[];
			this.index = '';
            this.normData = [];
			this.realData = [];
			this.auxData = [];
			this.clusters = [0];
			this.auxNames = [];
			this.numberOfSegements = numberOfSegements;
			this.outputTable = null;
			this.sphereGeometry = new THREE.SphereGeometry( this.defaultSpRad, this.numberOfSegements, this.numberOfSegements);
            this.createGui();

	}
	
	saveParameters(){
		return {'camerapos': this.camera.position, 'camerarot': this.camera.rotation, 'subspace': this.proectionSubSpace, 'sphrad': this.defaultSpRad};
	}
	
	loadParameters(parametersDict){
		if ('camerapos' in parametersDict)
			this.camera.position.x = parametersDict['camerapos'].x;
			this.camera.position.y = parametersDict['camerapos'].y;
			this.camera.position.z = parametersDict['camerapos'].z;
		
		if ('camerarot' in parametersDict)
			this.camera.rotation.order = parametersDict['camerarot']._order;
			this.camera.rotation.x = parametersDict['camerarot']._x;
			this.camera.rotation.y = parametersDict['camerarot']._y;
			this.camera.rotation.z = parametersDict['camerarot']._z;
		
		if ('subspace' in parametersDict)
			this.proectionSubSpace = parametersDict['subspace'];
		
		if ('sphrad' in parametersDict)
			this.changeRad(parametersDict['sphrad']);
		
	}

    initLight() {
        //Create a new ambient light
        var light = new THREE.AmbientLight( 0x888888 );
        this.scene.add( light );

        //Create a new directional light
        var light = new THREE.DirectionalLight( 0xfdfcf0, 1 );
        light.position.set(20,10,20);
        this.scene.add( light );
    }

    createGui() {
        this.dims_gui = new dat.GUI({ autoPlace: false, width: 300 });
		//
		//this.dims_gui = new dat.GUI();
        this.dims_gui.domElement.id = 'gui';
        document.getElementById("gui_container").appendChild(this.dims_gui.domElement);
    }

	setDimNames(dims){
		this.dimNames = dims;
	}

	setClusters(clusters){
		this.clusters = clusters;
	}

	setIndex(idx) {
		this.index = idx;
	}

	setSource(fdid){
		this.fdid = fdid;
	}
	
    setDataArray(normData) {
        this.normData = normData;
    }

	setRealData(realData) {
		this.realData = realData;
	}

	setRealStats(stats) {
		this.realStats = stats;
	}

	setAuxiliaryColumns(auxNames) {
		this.auxNames = auxNames;
	}

	setAuxiliaryData(auxData) {
		this.auxData = auxData;
	}

	createSphere(normData, realData, cluster, auxData) {
		var material = new THREE.MeshPhongMaterial( {color: this.clusters_color_scheme[cluster]} );
		var sphere = new THREE.Mesh(this.sphereGeometry, material);
		sphere.position.x = normData[1][this.proectionSubSpace[0]];
		sphere.position.y = normData[1][this.proectionSubSpace[1]];
		sphere.position.z = normData[1][this.proectionSubSpace[2]];
		normData[2] = cluster;
		sphere.dataObject = normData;
		sphere.realData = realData;
		sphere.auxData = auxData;
		this.groupOfSpheres.add(sphere);
		return sphere;
	}

	changeCluster(sphere, newCluster){
		scene.unSelectObject(sphere);
		sphere.dataObject[2] = newCluster;
		sphere.material.color = this.clusters_color_scheme[newCluster];
		scene.selectObject(sphere);
	}

	changeTheme(newTheme){
		if (newTheme=='white'){
			this.white_theme = true;
			this.select_linecube_color = new THREE.Color(0,0,0);
			this.scene.background = new THREE.Color( 0xffffff );
		}
		else{
			this.white_theme = false;
			this.select_linecube_color = new THREE.Color(1,1,1);
			this.scene.background = new THREE.Color( 0x333333 );
		}
		if (this.grid !== undefined)
		{
			this.groupOfGrid.remove(this.grid);
		}
		this.grid = drawPlainGrid(this.white_theme);
		this.groupOfGrid.add(this.grid);
		this.clusters_color_scheme = getColorScheme(this.clusters, this.white_theme);
		for ( var i = 0; i < this.groupOfSpheres.children.length; i++ ) {
			this.groupOfSpheres.children[i].material.color = this.clusters_color_scheme[this.groupOfSpheres.children[i].dataObject[2]].clone();
		}		
	}
	
	activateDragControl(){
		this.dragControls = new THREE.DragControls(this.groupOfSpheres.children, this.camera, this.renderer.domElement );
		this.dragControls.scene = this;
		this.dragControls.addEventListener( 'dragstart', function ( event ) { 
			event.target.scene.controls.enabled = false; 
		} );
		this.dragControls.addEventListener( 'dragend', function ( event ) { 
			event.target.scene.controls.enabled = true; 
		} );
		this.dragControls.addEventListener( 'drag', this.onSphereMove);
		this.dragControls.activate();
		this.dragEnabled = true;
	}
	
	deactivateDragControl(){
		this.dragControls.deactivate();
		this.dragEnabled = false;
	}

	onSphereMove(event) {
		var obj = event.object;
		if (obj.position.x<0)
			obj.position.x = 0;
		else
			if (obj.position.x>100)
				obj.position.x=100;
		if (obj.position.y<0)
			obj.position.y = 0;
		else
			if (obj.position.y>100)
				obj.position.y=100;
		if (obj.position.z<0)
			obj.position.z = 0;
		else
			if (obj.position.z>100)
				obj.position.z=100;
		if (event.target.scene.selectedObject == obj){
			obj.selectedCircut.position.x = obj.position.x;
			obj.selectedCircut.position.y = obj.position.y;
			obj.selectedCircut.position.z = obj.position.z;
		}
		var x = event.target.scene.proectionSubSpace[0];
		var y = event.target.scene.proectionSubSpace[1];
		var z = event.target.scene.proectionSubSpace[2];
		var min = event.target.scene.realStats[1][0];
		var max = event.target.scene.realStats[1][1];
		obj.dataObject[1][x] = obj.position.x;
		obj.dataObject[1][y] = obj.position.y;
		obj.dataObject[1][z] = obj.position.z;
		obj.realData[1][x] = obj.position.x * (max[x] - min[x]) / 100 + min[x];
		obj.realData[1][y] = obj.position.y * (max[y] - min[y]) / 100 + min[y];
		obj.realData[1][z] = obj.position.z * (max[z] - min[z]) / 100 + min[z];
		event.target.scene.printDataDialog(obj);
	}
	
	animate() {
		this.renderer.render( this.scene, this.camera );
	}

	onResize() {

		this.camera.aspect = this.mainDiv.clientWidth / this.mainDiv.clientHeight;
		this.camera.updateProjectionMatrix();
		this.renderer.setSize( this.mainDiv.clientWidth, this.mainDiv.clientHeight );

	}
	
	printDataDialog(sphereToPrint){

				if (this.dims_gui.__folders['Multidimensional Coordinates']) {
					this.dims_gui.removeFolder(this.dims_folder);
				}
				if (this.dims_gui.__folders['Auxiliary Data']) {
					this.dims_gui.removeFolder(this.dims_aux_folder);
				}
				// Set DAT.GUI Controllers
                var gui_data = {};
                this.gui_data = gui_data;
                var aux_gui_data = {};

                gui_data[this.index] = sphereToPrint.dataObject[ 0 ];

                // Set GUI fields for all coordinates (real data values)
                for( var i = 0; i < sphereToPrint.realData[ 1 ].length; i++ ) {
                    gui_data[this.dimNames[ i ]] = sphereToPrint.realData[ 1 ][ i ];
                }

                for ( var j = 0; j < sphereToPrint.auxData[ 1 ].length; j++ ) {
                	aux_gui_data[this.auxNames[ j ]] = sphereToPrint.auxData[ 1 ][ j ];
				}

                // Create DAT.GUI object
                this.createGui();

                // Create new Folder
                if (!this.dims_gui.__folders['Multidimensional Coordinates']) {
                    this.dims_folder = this.dims_gui.addFolder('Multidimensional Coordinates');
                }

                // Add dataset index field to dat.gui.Controller
                this.dims_folder.add( gui_data, this.index );

                // Add sliders with real data values
                var counter = 0;
                for ( var key in gui_data ) {
                    if ( key != this.index ) {
                        var min = 0;
                        var max = 0;
                        for ( var k = 0; k < this.realStats[ 0 ].length; k++ ) {
                            if ( this.realStats[0][k] == 'Min' )
                                min = this.realStats[1][k][counter];
                            if ( this.realStats[0][k] == 'Max' )
                                max = this.realStats[1][k][counter];
                        }
                        this.dims_folder.add( gui_data, key, min, max ).listen();
                        counter++;
                    }
                }
				
                this.dims_folder.open();

                // Create Auxiliary Data Folder
				if (!this.dims_gui.__folders['Auxiliary Data']) {
                    this.dims_aux_folder = this.dims_gui.addFolder('Auxiliary Data');
                }

                for ( var key in aux_gui_data ) {
					this.dims_aux_folder.add( aux_gui_data, key );
                }

                this.dims_folder.open();
				this.dims_aux_folder.open();


                this.csrf = document.getElementsByName("csrfmiddlewaretoken")[0].getAttribute("value");

                var obj = {
                    coordinates: sphereToPrint.dataObject[1],
					selectedObject: sphereToPrint,
					scene: this,
                    Recalculate:function() {
						sendAjaxPredicRequest(sphereToPrint, {csrfmiddlewaretoken: this.scene.csrf, fdid: this.scene.fdid}, this.scene);
                    }
                };

                this.dims_folder.add(obj,'Recalculate');


                for (var i = 0; i < this.dims_folder.__controllers.length - 1; i++) {
                    var current_controller = this.dims_folder.__controllers[ i ];
                    current_controller.selectedObject = sphereToPrint;
                    current_controller.dimNames = this.dimNames;
                    current_controller.subSpace = this.proectionSubSpace;
                    current_controller.realStats = this.realStats;

                    current_controller.onChange(function(value) {
                        //console.log(value);
                    });

                    current_controller.onFinishChange(function(value) {
                        //console.log(this.realStats);
                        //console.log(this.selectedObject);
                        var currDimName = this.property;
                        //console.log("Current dimension is " + currDimName);
                        var currDimNum = this.dimNames.indexOf(currDimName);
                        //console.log("Current dimension number is " + currDimNum);
                        var initialValue = this.initialValue;
                        //console.log("Initial value is " + initialValue);
                        //console.log("New value is " + value);
                        var normValue = this.selectedObject.dataObject[1][currDimNum];
                        //console.log("Current norm value is " + normValue);
                        var min = this.realStats[1][1][currDimNum];
                        var max = this.realStats[1][2][currDimNum];
                        var newNormValue = (( value - min ) / ( max - min )) * 100;
                        //console.log("New norm value is " + newNormValue);
                        this.selectedObject.dataObject[1][currDimNum] = newNormValue;
                        //console.log(this.selectedObject.dataObject[1]);
                        var sphere = this.selectedObject;
                        sphere.position.set(sphere.dataObject[1][this.subSpace[0]],
                                            sphere.dataObject[1][this.subSpace[1]],
                                            sphere.dataObject[1][this.subSpace[2]]);
                    });
                }
	}

	onMouseClick(event) {
		event.preventDefault();

		this.intersects = this.getIntersects( event.offsetX, event.offsetY );
		if ( this.intersects.length > 0 ) {
			var res = this.intersects.filter( function ( res ) {

				return res && res.object;

			} )[ 0 ];

			if ( res && res.object ) {
			    // If True, unselect selected object
				if ((res.object == this.selectedObject) && !this.dragEnabled) {
					this.unSelectObject(this.selectedObject);
					this.selectedObject = null;
					if (this.dims_gui.__folders['Multidimensional Coordinates']) {
						this.dims_gui.removeFolder(this.dims_folder);
					}
					if (this.dims_gui.__folders['Auxiliary Data']) {
						this.dims_gui.removeFolder(this.dims_aux_folder);
					}
					return true;
				}
				
				// If true, unselect old object, select the new one
                if (this.selectedObject != null) {
                    this.unSelectObject(this.selectedObject);
                        if (this.dims_gui.__folders['Multidimensional Coordinates']) {
                            this.dims_gui.removeFolder(this.dims_folder);
                        }
						if (this.dims_gui.__folders['Auxiliary Data']) {
							this.dims_gui.removeFolder(this.dims_aux_folder);
						}
                }
				
                this.selectedObject = res.object;
                this.selectObject(this.selectedObject);
				
				this.printDataDialog(res.object);

			} else {
				if (this.dims_gui.__folders['Multidimensional Coordinates']) {
					this.dims_gui.removeFolder(this.dims_folder);
				}
				if (this.dims_gui.__folders['Auxiliary Data']) {
					this.dims_gui.removeFolder(this.dims_aux_folder);
				}
			}

		}
	}

	getDimNumber(dimName) {
		return this.dimNames.indexOf(dimName);
	}

	selectObject(obj){
		var geometry = new THREE.BoxBufferGeometry( 2*obj.geometry.parameters.radius, 2*obj.geometry.parameters.radius, 2*obj.geometry.parameters.radius );
		var edgesCube = new THREE.EdgesGeometry( geometry );
		var edgesCube = new THREE.EdgesGeometry( geometry );
		var lineCube = new THREE.LineSegments( edgesCube, new THREE.LineBasicMaterial( { color: this.select_linecube_color } ) );
		obj.selectedCircut = lineCube;
		lineCube.position.x = obj.position.x;
		lineCube.position.y = obj.position.y;
		lineCube.position.z = obj.position.z;
		this.selectedObject.material.color.set( invertColor(this.selectedObject.material.color) );
		this.scene.add(lineCube);
	}

	unSelectObject(obj){
		this.scene.remove(obj.selectedCircut);
		obj.selectedCircut = null;
		this.selectedObject.material.color.set( invertColor(this.selectedObject.material.color) );
	}

	getIntersects(x, y) {

		x = ( x / this.mainDiv.clientWidth ) * 2 - 1;
		y = - ( y / this.mainDiv.clientHeight ) * 2 + 1;
		this.mouseVector.set( x, y );
		this.raycaster.setFromCamera( this.mouseVector, this.camera );
		return this.raycaster.intersectObject( this.groupOfSpheres, true );

	}

	changeRad(newRad){
		var oldGroup = this.groupOfSpheres;
		this.scene.remove(this.groupOfSpheres);
		this.groupOfSpheres = new THREE.Group();
		this.sphereGeometry = new THREE.SphereGeometry( newRad, this.numberOfSegements, this.numberOfSegements );
		this.defaultSpRad = newRad;
		var i = 0;
		for (i=0; i < oldGroup.children.length; ++i) {
			if (this.selectedObject === oldGroup.children[i]){
				this.unSelectObject(this.selectedObject);
				this.selectedObject = this.createSphere(oldGroup.children[i].dataObject, oldGroup.children[i].realData, oldGroup.children[i].dataObject[2], oldGroup.children[i].auxData);
				this.selectObject(this.selectedObject);
			}
			else {
                var newSphere = this.createSphere(oldGroup.children[i].dataObject, oldGroup.children[i].realData, oldGroup.children[i].dataObject[2], oldGroup.children[i].auxData);
            }
		}
        this.scene.add(this.groupOfSpheres);
	}

	moveSpheres() {
		if (this.selectedObject!=null)
			this.unSelectObject(this.selectedObject);
		for ( var i = 0; i < this.groupOfSpheres.children.length; i++ ) {
			var sphere = this.groupOfSpheres.children[i];
			sphere.position.x = sphere.dataObject[1][this.proectionSubSpace[0]];
			sphere.position.y = sphere.dataObject[1][this.proectionSubSpace[1]];
			sphere.position.z = sphere.dataObject[1][this.proectionSubSpace[2]];
		}
		if (this.selectedObject!=null)
			this.selectObject(this.selectedObject);
	}

	setNewSubSpace(x1, x2, x3){
		this.proectionSubSpace[0] = x1;
		this.proectionSubSpace[1] = x2;
		this.proectionSubSpace[2] = x3;
		this.moveSpheres();
	}

	resetCamera(){
		this.controls.reset();
	}

	dimensionControlElements() {
        var chooseDimArray = [];
		var dimensionsForm = document.getElementById("dimensions_form");
		var XYZSelector = dimensionsForm.getElementsByTagName("select");
        for ( var i = 0; i < XYZSelector.length; i++ ) {
            var currSelector = XYZSelector[ i ];
            for ( var j = 0; j < this.dimNames.length; j++ ) {
				var option = document.createElement("option");
                if ( this.proectionSubSpace[ i ] == j )
					option.selected = true;
                option.value = j.toString();
                option.text = this.dimNames[ j ];
                currSelector.add(option);
            }
            chooseDimArray.push(currSelector);
        }
        var changeDimBtn = document.getElementById("change_dim_btn");
        changeDimBtn.sceneObject = this;
		changeDimBtn.dimsSelectArray = chooseDimArray;
		changeDimBtn.onclick=function(){
			this.sceneObject.setNewSubSpace(parseInt(this.dimsSelectArray[0].value),
											parseInt(this.dimsSelectArray[1].value),
											parseInt(this.dimsSelectArray[2].value));
        };
	}

    // {'parameter1': self.parameter1, 'parameter2': self.parameter2, 'parameter3': self.parameter3}
    getClusterAlgorithm() {
        this.parameters_str = '{"Number of clusters": 10}'; // example json string
        this.parameters_dict = JSON.parse(this.parameters_str);
        var e = document.getElementById("cluster-selector");
        this.algorithm = e.options[e.selectedIndex].value;
        var self = this;
        e.addEventListener('change', function (e) {
            if (document.getElementById("cluster-params")) {
                removeElement("cluster-params");
            }
            var alg = e.target.value;
            var params_div = document.createElement("div");
            params_div.setAttribute("id", "cluster-params");
            params_div.classList.add("form-group");
            document.getElementById("cluster_form").appendChild(params_div);
            switch(alg) {
              case 'K-Means':
                var form = document.createElement("div");
                form.classList.add("form-group");
                params_div.appendChild(form);
                for ( var key in self.parameters_dict ) {
                    if (self.parameters_dict.hasOwnProperty(key)) {
                        var val = self.parameters_dict[key];
                        var label = document.createElement("label");
                        label.setAttribute("for", key);
                        label.textContent = key;
                        var input = document.createElement("input");
                        input.classList.add("form-control-sm");
                        input.setAttribute("type", "text");
                        input.setAttribute("placeholder", val);
                        input.setAttribute("id", key);
                        form.appendChild(label);
                        form.appendChild(input);
                    }
                }
                break;

              case 'DBSCAN':
                  if (document.getElementById("cluster-params")) {
                    removeElement("cluster-params");
                  }
                  break;
            }
        });
    }

    // read algorithm parameters from json file
    setAlgorithmParams() {
        
    }

    radiusControlElement() {
        var changeRadiusBtn = document.getElementById("changeRadiusBtn");
        var radiusRange = document.getElementById("radiusRange");
        changeRadiusBtn.sceneObject = this;
        radiusRange.value = this.defaultSpRad.toString();
		changeRadiusBtn.onclick = function() {
            var radiusRange = document.getElementById("radiusRange");
			this.sceneObject.changeRad(parseFloat(radiusRange.value));
        };
    }

    resetControls() {
        var resetCameraBtn = document.getElementById("resetBtn");
		resetCameraBtn.sceneObject = this;
		resetCameraBtn.onclick = function() {
			this.sceneObject.resetCamera();
			};
    }

    printControls() {
        var display_clusters = document.getElementById("printBtn");
        display_clusters.sceneObject = this;
        display_clusters.onclick = function() {
        	var element = document.getElementById("cluster-table_wrapper");
        	if (element) {
        		element.parentNode.removeChild(element);
			}
			this.sceneObject.printClusters("clusters");
            $('#cluster-table').DataTable();
        };

		var display_all_dataset = document.getElementById("printAllBtn");
		display_all_dataset.sceneObject = this;
        display_all_dataset.onclick = function() {
            var element = document.getElementById("print-table_wrapper");
        	if (element) {
        		element.parentNode.removeChild(element);
			}
			this.sceneObject.printDataset(this.sceneObject.realData, "print", this.sceneObject.realData.length);
            $('#print-table').DataTable();
        };
    }

	createControlElements() {
        this.dimensionControlElements();
        this.radiusControlElement();
        this.resetControls();
        this.printControls();
	}

    // print fragment of the initial dataset
    // nrows = the number of rows
    printDataset(dataset, elementID, num_columns) {
        var initial_dataset = document.getElementById(elementID);
        var table = document.createElement("table");
        table.setAttribute("id", elementID+"-table");
		table.classList.add("table", "table-sm", "table-hover");
        var thead = document.createElement("thead");
        table.appendChild(thead);
		var row = document.createElement("tr");
		thead.appendChild(row);
        var th = null;
		th = document.createElement("th");
		th.innerText = this.index.toString();
		row.appendChild(th);

		for(var i = 0; i < this.dimNames.length; ++i ) {
			th = document.createElement("th");
			th.innerText = this.dimNames[i].toString();
			row.appendChild(th);
		}

        var tbody = document.createElement("tbody");
        table.appendChild(tbody);
        for ( var j = 0; j < num_columns; j++ ) {
			var obj	= dataset[ j ];
			row = document.createElement("tr");
			th = document.createElement("th");
			th.innerText = obj[0];
			row.appendChild(th);

			for(var i = 0; i < obj[1].length; i++ ) {
				var td = document.createElement("td");
				var value = obj[1][i].toLocaleString(undefined, { maximumSignificantDigits: 3 });
				td.innerText = value;
				row.appendChild(td);
			}
			tbody.appendChild(row);
		}
        this.outputTable = table;
        initial_dataset.appendChild(table);
    }

	printClusters(elementID) {
		var root = document.getElementById(elementID);
		var table = document.createElement("table");
        table.setAttribute("id", "cluster-table");
		table.classList.add("table", "table-sm", "table-hover");
        var thead = document.createElement("thead");
        table.appendChild(thead);
		var row = document.createElement("tr");
		thead.appendChild(row);

		var cell = null;
		cell = document.createElement("th");
		cell.innerText = "Cluster";
		row.appendChild(cell);

		cell = document.createElement("th");
		cell.innerText = this.index.toString();
		row.appendChild(cell);

		for(var i = 0; i < this.dimNames.length; i++ ) {
			cell = document.createElement("th");
			cell.innerText = this.dimNames[ i ].toString();
			row.appendChild(cell);
		}

        var tbody = document.createElement("tbody");
        table.appendChild(tbody);

		for ( var j = 0; j < this.groupOfSpheres.children.length; j++ ){
			var obj	= this.groupOfSpheres.children[ j ];
			row = document.createElement("tr");
			tbody.appendChild(row);
			cell = document.createElement("th");
			cell.innerText = obj.dataObject[ 2 ];
			if (this.selectObject == obj)
				cell.bgColor = invertColor(obj.material.color).getHexString();
			else
				cell.bgColor = obj.material.color.getHexString();
			row.appendChild(cell);

			cell = document.createElement("th");
			cell.innerText = obj.realData[ 0 ].toString();
			row.appendChild(cell);

			for(var i = 0; i < obj.realData[1].length; i++ ){
				cell = document.createElement("td");
				var value = obj.realData[1][i].toLocaleString(undefined, { maximumSignificantDigits: 3 });
				cell.innerText = value.toString();
				row.appendChild(cell);
			}
		}
        root.appendChild(table);
	}
}