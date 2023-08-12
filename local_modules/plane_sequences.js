const formatcoords = require('formatcoords');

module.exports = (function(){
	return {
		'F/A-18C Hornet':{
			dropBombs:function(waypoints){ // scrapped bomb automation
				var delay = 200;

				var sequence = [];

				if(!waypoints.length)return [];

				// {device:"37",code:"3022",delay:delay,active:"1",depress:"true"}, // next waypoint
				// {device:"37",code:"3023",delay:delay,active:"1",depress:"true"}, // previous waypoint

				// {device:"37",code:"3024",delay:delay,active:"1",depress:"true"}, // lock

				// {device:"13",code:"3003",delay:delay,active:"1",depress:"true"},

				sequence.push({type:'button',name:'AMPCD_PB_13',delay:delay}); // previous waypoint

				for(var waypoint of waypoints){
					sequence.push({type:'button',name:'AMPCD_PB_12',delay:200}); // next waypoint
			        sequence.push({type:'delay',delay:20}); // pause

					if(waypoint.targeted){
						sequence.push({type:'delay',delay:80}); // pause
						sequence.push({type:'button',name:'AMPCD_PB_14',delay:delay}); // lock
				        sequence.push({type:'delay',delay:100}); // pause
						sequence.push({type:'button',name:'STICK_WEAP_REL_BTN',delay:delay}); // fire
					}
				}

				for(var waypoint of waypoints){
					sequence.push({type:'delay',delay:30});
					sequence.push({type:'button',name:'AMPCD_PB_13'}); // previous waypoint
				}
				sequence.pop();

				return {
					sequence,
					executionTime:(function(){
						var t = 0;
						for(var cmd of sequence){
							t += parseFloat(cmd.delay);
						}
						return t;
					})()
				};
			},
			toggle154TargetingMode:function(){ // scrapped bomb automation
				var delay = 300;

				var sequence = [
					{type:'button',name:'AMPCD_PB_05',delay:delay},
					{type:'button',name:'AMPCD_PB_13',delay:delay},
					{type:'button',name:'AMPCD_PB_05',delay:delay},
					{type:'button',name:'AMPCD_PB_13',delay:delay},
					{type:'button',name:'AMPCD_PB_05',delay:delay},
					{type:'button',name:'AMPCD_PB_13',delay:delay},
					{type:'button',name:'AMPCD_PB_05',delay:delay},
					{type:'button',name:'AMPCD_PB_13',delay:delay},
					{type:'button',name:'AMPCD_PB_03',delay:delay},
					{type:'button',name:'AMPCD_PB_03',delay:delay},
				];

				return {
					sequence,
					executionTime:(function(){
						var t = 0;
						for(var cmd of sequence){
							t += parseFloat(cmd.delay);
						}
						return t;
					})()
				};
			},
			togglePrecise:function(){ // scrapped bomb automation
				var delay = 0;

				var sequence = [
					{type:'button',name:'AMPCD_PB_02',delay:delay},
					{type:'button',name:'AMPCD_PB_10',delay:delay},
					{type:'button',name:'AMPCD_PB_19',delay:delay},
				];

				return {
					sequence,
					executionTime:(function(){
						var t = 0;
						for(var cmd of sequence){
							t += parseFloat(cmd.delay);
						}
						return t;
					})()
				};
			},
			setWaypoints:function(waypoints){
				var ufc_option_delay = 100;
				var ufc_init_delay = 800;

				var next_press_delay = config.next_press_delay;
				var enter_depress_delay = config.enter_depress_delay;
				var numpad_depress_delay = config.numpad_depress_delay;

				// if(!config.debug){ // balance
				// 	ufc_option_delay = 250;
				// 	ufc_init_delay = 1000;
				// 	next_press_delay = 400;
				// 	enter_depress_delay = 250;
				// 	numpad_depress_delay = 250;
				// }

				// console.log("waypoints", waypoints);
				var first_waypoint = 1;
			    var ufc = [
					{type:'button',name:'UFC_0',delay:numpad_depress_delay},
					{type:'button',name:'UFC_1',delay:numpad_depress_delay},
					{type:'button',name:'UFC_2',delay:numpad_depress_delay},
					{type:'button',name:'UFC_3',delay:numpad_depress_delay},
					{type:'button',name:'UFC_4',delay:numpad_depress_delay},
					{type:'button',name:'UFC_5',delay:numpad_depress_delay},
					{type:'button',name:'UFC_6',delay:numpad_depress_delay},
					{type:'button',name:'UFC_7',delay:numpad_depress_delay},
					{type:'button',name:'UFC_8',delay:numpad_depress_delay},
					{type:'button',name:'UFC_9',delay:numpad_depress_delay}
			    ];

				var sequence = [];

				//enter the SUPT menu
				sequence.push({type:'button',name:'AMPCD_PB_18',delay:10});
				sequence.push({type:'button',name:'AMPCD_PB_18',delay:10});

		        //select HSI
		        sequence.push({type:'button',name:'AMPCD_PB_02',delay:10});

		        //select DATA
		        sequence.push({type:'button',name:'AMPCD_PB_10',delay:10});

		        for(waypoint of waypoints){
		        	waypoint.lat = parseFloat(waypoint.lat);
		        	waypoint.lon = parseFloat(waypoint.lon);

					// console.log("waypoint", waypoint);
		        	var dms = formatcoords(waypoint.lat,waypoint.lon);

		        	console.log("dms", dms);
		        	// continue;
		
					waypoint.dcsLat = dms.latValues.degreesInt.toString().padStart(2, '0')+dms.latValues.minutesInt.toString().padStart(2, '0')+dms.latValues.minutes.toString().split('.')[1].substring(0,4).padStart(4, '0');
					waypoint.dcsLon = dms.lonValues.degreesInt.toString().padStart(2, '0')+dms.lonValues.minutesInt.toString().padStart(2, '0')+dms.lonValues.minutes.toString().split('.')[1].substring(0,4).padStart(4, '0');

					// looool
					// waypoint.dcsLat += Math.random(0,0.0001);
					// waypoint.dcsLon += Math.random(0,0.0001);

					// waypoint.dcsLat
					// waypoint.dcsLon

					// console.log("waypoint", waypoint);

					if(!first_waypoint){
						//increment steerpoint
		        		sequence.push({type:'button',name:'AMPCD_PB_12',delay:numpad_depress_delay});
						ufc_init_delay = 300;
			        	// sequence.push({type:'delay',delay:next_press_delay}); // pause
					}

		            //press UFC
			        sequence.push({type:'button',name:'AMPCD_PB_05',delay:ufc_init_delay});
			        // sequence.push({type:'delay',delay:next_press_delay}); // pause

			        // press position 1
			        sequence.push({type:'button',name:'UFC_OS1',delay:ufc_option_delay});
			        // sequence.push({type:'delay',delay:next_press_delay}); // pause

			        //check if latitude is N or S
			        if(dms.north){
				        sequence.push(ufc[2]);
			        }	
			        else
			        {	
				        sequence.push(ufc[8]);
			        }
			        
		            var firstLat = waypoint.dcsLat.substring(0,waypoint.dcsLat.length-4);
		            console.log("firstLat", firstLat);
		            var last4Lat = waypoint.dcsLat.substring(waypoint.dcsLat.length-4);
		            console.log("last4Lat", last4Lat);

			        //start entering first latitude digits
		            for(var char of firstLat){
		            	sequence.push(ufc[parseInt(char)]);
			        	sequence.push({type:'delay',delay:numpad_depress_delay}); // pause
			        }

	                // Press Enter
			        sequence.push({type:'button',name:'UFC_ENT',delay:enter_depress_delay,verify:0});
			        sequence.push({type:'delay',delay:next_press_delay}); // pause

			        //start entering last latitude digits
		            for(var char of last4Lat){
		            	sequence.push(ufc[parseInt(char)]);
			        	sequence.push({type:'delay',delay:numpad_depress_delay}); // pause
			        }

	                // Press Enter
			        sequence.push({type:'button',name:'UFC_ENT',delay:enter_depress_delay,verify:0});
			        sequence.push({type:'delay',delay:next_press_delay}); // pause


			        // check if longitude is E or W
			        if(dms.east){
			        	sequence.push(ufc[6]);
			        }
			        else
			        {	
			        	sequence.push(ufc[4]);
			        }

		            var firstLon = waypoint.dcsLon.substring(0,waypoint.dcsLon.length-4);
		            console.log("firstLon", firstLon);
		            var last4Lon = waypoint.dcsLon.substring(waypoint.dcsLon.length-4);
		            console.log("last4Lon", last4Lon);

			        //start entering first latitude digits
		            for(var char of firstLon){
		            	sequence.push(ufc[parseInt(char)]);
			        	sequence.push({type:'delay',delay:numpad_depress_delay}); // pause
			        }

			        // continue;


	                // Press Enter
			        sequence.push({type:'button',name:'UFC_ENT',delay:enter_depress_delay,verify:0});
			        sequence.push({type:'delay',delay:next_press_delay}); // pause

			        //start entering last latitude digits
		            for(var char of last4Lon){
		            	sequence.push(ufc[parseInt(char)]);
			        	sequence.push({type:'delay',delay:numpad_depress_delay}); // pause
			        }

	                // Press Enter
			        sequence.push({type:'button',name:'UFC_ENT',delay:enter_depress_delay,verify:0});
			        sequence.push({type:'delay',delay:next_press_delay}); // pause

			        // press position 3 to select elevation
			        // sequence.push({type:'delay',delay:next_press_delay}); // pause
			        sequence.push({type:'button',name:'UFC_OS3',delay:ufc_option_delay});

			        if(first_waypoint){
				        // press position 1 to select feet
				        // commands.push({device:"25",code:"3010",delay:"100",active:"1",depress:"true"});
			        }

			        //start entering elevation in feet
		            // console.log("waypoint.alt", waypoint.alt);

			        // sequence.push({type:'delay',delay:next_press_delay}); // pause

		            for(var char of Math.round(waypoint.alt).toString()){
		            	// console.log("char", char);
		            	sequence.push(ufc[parseInt(char)]);
			        	sequence.push({type:'delay',delay:numpad_depress_delay}); // pause
			        }

			        // Press Enter
			        sequence.push({type:'button',name:'UFC_ENT',delay:enter_depress_delay,verify:0});
			        sequence.push({type:'delay',delay:next_press_delay}); // pause

			        first_waypoint = 0;
		        }

		        for(var i in waypoints){
		        	//decrement steerpoint
			        if(parseInt(i))sequence.push({type:'button',name:'AMPCD_PB_13',delay:numpad_depress_delay});
		        	sequence.push({type:'delay',delay:20});
		        }

		        var t = 0;
				for(var seq of sequence){
					t += parseFloat(seq.delay);
				}

		        console.log("execution time:", t);

				return {
					sequence
				};
			}
		}
	}
})();