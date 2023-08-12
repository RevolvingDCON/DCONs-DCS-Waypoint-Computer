const dgram = require('dgram');
const net = require('net');
const fs = require('fs');
const originalFetch = require('isomorphic-fetch');
const fetch = require('fetch-retry')(originalFetch);
const formatcoords = require('formatcoords');
const { app, BrowserWindow, screen, shell, ipcMain, Menu, ipcRenderer, dialog } = require('electron');
const path = require('path');
const DcsBiosApi = require('dcs-bios-api');
const plane_sequences = require('./local_modules/plane_sequences');
const BufferReader = require('buffer-utils/lib/BufferReader');
const copydir = require('copy-dir');
const package = require('./package.json');
const {uIOhook, UiohookKey} = require('uiohook-napi');

const procLocked = app.requestSingleInstanceLock();

global.storage = {};
global.config = {
	dcs_saved_games_path:path.resolve(process.env.USERPROFILE+'/Saved Games/DCS.openbeta'),
	numpad_depress_delay:80,
	enter_depress_delay:250,
	next_press_delay:10,
	overlay_enabled:1,
	
	position_update_rate:100,
	radar_object_delay:0.005,
};

const { overlayWindow:OW } = require('electron-overlay-window');
const exec = require('child_process').exec;

var activeWindows = {};
var waitFor=(t)=>new Promise((x)=>setTimeout(x,t));
var waitUntil = function(x){
	return new Promise(function(cb){
		var iv = setInterval(function(){
			// if(config.debug)console.log("waitUntil", x);
			if(x()){
				clearInterval(iv);
				cb();
			}
		});
	});
};
const timeout=(t)=>new Promise((r,re)=>{setTimeout(()=>re(new Error('timed out')),t)});

var current_data = {};
var quitting = 0;
var dcs;

// app.disableHardwareAcceleration();

var createWindow = function(name, options) {
	console.log("Created Window: "+name+" - "+config.menu);

	const win = new BrowserWindow(options);
	activeWindows[name] = win;

	win.on("closed", function(){
		console.log("Deleted Window: "+name);
		delete activeWindows[name];
	});

	win.webContents.on("new-window", function(e, url){
		e.preventDefault();
		shell.openExternal(url);
	});

	return win;
};

var quit = function() {
	quitting = true;
	for(var i in activeWindows){
		activeWindows[i].close();
	}

	process.exit(1);
}

app.on('ready', async function() {
	if(!procLocked){
		dialog.showMessageBoxSync({
			icon: "./icon.ico",
	        type: "error",
	        title: "One at a time people!",
	        message: "Opening multiple instances of DWC will cause your CPU to spontaneously burst into flames. If you don't have an instance running, please kill any DWC processes that may have failed to close previously. (just search for my face and end those tasks)"
	    });
		process.exit(1);
	}

	// console.log("remotePackage", remotePackage);


	if(!fs.existsSync('./storage.json')){
		await fs.writeFileSync('./storage.json',JSON.stringify(storage, null, 2));
	}
	else
	{
		storage = await JSON.parse(fs.readFileSync('./storage.json'));
	}

	if(!fs.existsSync('./config.json')){
		await fs.writeFileSync('./config.json',JSON.stringify(config, null, 2));
	}
	else
	{
		var tmp = await JSON.parse(fs.readFileSync('./config.json'));
		if(!tmp.dcs_saved_games_path)tmp.dcs_saved_games_path = config.dcs_saved_games_path;
		config = {...config,...tmp};
	}
	config.scripts_path = config.dcs_saved_games_path+'/Scripts';
	if(!config.menu)config.menu = fs.existsSync(__dirname+`/menu/dev`)?'dev':'public';

	console.log('Starting IO');
	console.log('Searching for DCS');
	if(fs.existsSync(config.dcs_saved_games_path) && fs.existsSync(config.scripts_path)){
		console.log('DCS Found');
		var exports_file;
		var line = 'dofile(lfs.writedir()..[[Scripts\\DCS-BIOS-DWC\\BIOS.lua]]);';
		console.log('Searching for Export.lua');
		if(fs.existsSync(config.scripts_path+'/Export.lua')){
			exports_file = fs.readFileSync(config.scripts_path+'/Export.lua');
			console.log('Export.lua found');

			if(exports_file.includes(line)){
				console.log('Export.lua line installed');
			}
			else
			{
				console.log('Export.lua line needed');
				exports_file = fs.writeFileSync(config.scripts_path+'/Export.lua',exports_file+'\n'+line+'\n');3
				console.log('Export.lua line installed');
			}
		}
		else
		{
			console.log('Export.lua not found');
			exports_file = fs.writeFileSync(config.scripts_path+'/Export.lua',line+'\n');
			console.log('Export.lua created');
		}
	}
	else
	{
		console.log('DCS not found!');
	    dialog.showMessageBoxSync({
			icon: "./icon.ico",
	        type: "error",
	        title: "Can't find DCS",
	        message: "Please add the DCS Saved Games path to config.json.\n\nExample: "+path.resolve(process.env.USERPROFILE+'/Saved Games/DCS.openbeta')
	    });
	    process.exit(1);
	}

	// if(!fs.existsSync(config.scripts_path+'/DCS-BIOS-DWC/')){
	// }

	console.log('updating dependencies');
	await copydir.sync('./dependencies/',config.scripts_path);

	var dwc_lua = fs.readFileSync(config.scripts_path+'/DCS-BIOS-DWC/lib/DWC.lua').toString().split('\n');

	for(var i in dwc_lua){
		let line = dwc_lua[i];
		if(line.includes('CAMERA_UPDATE_RATE')){
			let target_parts = dwc_lua[(parseInt(i)+1)].split(' ');
			target_parts[target_parts.length-1] = config.position_update_rate;
			let new_line = target_parts.join(' ');

			dwc_lua[(parseInt(i)+1)] = new_line;
			continue;
		}

		if(line.includes('OBJECT_UPDATE_RATE')){
			let target_parts = dwc_lua[(parseInt(i)+1)].split(' ');
			target_parts[target_parts.length-1] = config.radar_object_delay;
			let new_line = target_parts.join(' ');

			dwc_lua[(parseInt(i)+1)] = new_line;
			continue;
		}
	}

	fs.writeFileSync(config.scripts_path+'/DCS-BIOS-DWC/lib/DWC.lua',dwc_lua.join('\n'));
	console.log('Dependencies updated');
	
	console.log('IO Complete');

	var types4 = {"1":"wsType_OBLOMOK_1","2":"wsType_OBLOMOK_2","3":"wsType_OBLOMOK_3","4":"wsType_OBLOMOK_4","5":"wsType_OBLOMOK_5","6":"wsType_OBLOMOK_6","7":"OBLOMOK_OBSHIWKI_1","8":"OBLOMOK_OBSHIWKI_2","9":"K36","10":"PILOT_K36","11":"PILOT_PARASHUT","12":"FONAR_OTK","13":"wsType_Chaff","14":"wsType_Flare","15":"wsType_ShortMTail","16":"wsType_SmallBomb","17":"PILOT_ACER","18":"PILOT_F14_SEAT","19":"PILOT_PARASHUT_US","20":"A_10_FONAR","21":"F_14A_FONAR","22":"F_15_FONAR","23":"F_16_FONAR","24":"F_18C_FONAR","25":"MIG_23_FONAR","26":"MIG_25_FONAR","27":"MIG_27_FONAR","28":"MIG_29_FONAR","29":"MIG_29K_FONAR","30":"MIG_31_FONAR_P","31":"MIG_31_FONAR_Z","32":"SU_24_FONAR_L","33":"SU_24_FONAR_R","34":"SU_25_FONAR","35":"SU_27_FONAR","36":"SU_30_FONAR","37":"SU_33_FONAR","38":"SU_39_FONAR","39":"TORNADO_FONAR","40":"Mirage_FONAR","41":"F_4_FONAR_P","42":"F_4_FONAR_Z","43":"F_5_FONAR","44":"SU_17_FONAR","45":"SU_34_FONAR_L","46":"SU_34_FONAR_R","47":"MIG_29C_FONAR","48":"MIG_29G_FONAR","49":"SU_25T_FONAR","50":"wsType_Flare_GREEN","51":"wsType_Flare_RED","52":"wsType_Flare_WHITE","53":"wsType_Flare_YELLOW","54":"PILOT_DEAD","55":"PARACHUTE_ON_GROUND"};
	var types = {
		// level 1
		"1":"wsType_Air",
		"2":"wsType_Ground",
		"3":"wsType_Navy",
		"4":"wsType_Weapon",
		"5":"wsType_Static",
		"6":"wsType_Destroyed",
		"200":"wsType_Test1",
		"201":"wsType_Point",

		// level 2
		"wsType_Air":{
			"1":"wsType_Airplane",
			"2":"wsType_Helicopter",
			"3":"wsType_Free_Fall",
		},
		"wsType_Ground":{
			"8":"wsType_Moving",
			"9":"wsType_Standing",
			"17":"wsType_Tank",
			"16":"wsType_SAM",
		},
		"wsType_Navy":{
			"12":"wsType_Ship",
		},
		"wsType_Weapon":{
			"4":"wsType_Missile", 
			"5":"wsType_Bomb", 
			"6":"wsType_Shell", 
			"7":"wsType_NURS", 
			"8":"wsType_Torpedo", 
		},
		"wsType_Static":{
			"13":"wsType_Airdrome",
			"14":"wsType_Explosion",
			"15":"wsType_GContainer",
			"18":"wsType_AirdromePart",
			"19":"wsType_WingPart",
		},

		// level 3
		"wsType_Air_wsType_Airplane":{
			"1":"wsType_Fighter", 
			"2":"wsType_F_Bomber", 
			"3":"wsType_Intercepter", 
			"4":"wsType_Intruder", 
			"5":"wsType_Cruiser", 
			"6":"wsType_Battleplane", 
		},
		"wsType_Air_wsType_Free_Fall":{
			"31":"wsType_Snars", 
			"35":"wsType_Parts", 
			"43":"wsType_FuelTank", 
		},
		"wsType_Weapon_wsType_Missile":{
			"7":"wsType_AA_Missile", 
			"8":"wsType_AS_Missile", 
			"34":"wsType_SA_Missile", 
			"11":"wsType_SS_Missile", 
			"10":"wsType_A_Torpedo", 
			"11":"wsType_S_Torpedo", 
			"100":"wsType_AA_TRAIN_Missile", 
			"101":"wsType_AS_TRAIN_Missile", 
		},
		"wsType_Weapon_wsType_Bomb":{
			"9":"wsType_Bomb_A", 
			"36":"wsType_Bomb_Guided", 
			"37":"wsType_Bomb_BetAB", 
			"38":"wsType_Bomb_Cluster", 
			"39":"wsType_Bomb_Antisubmarine", 
			"40":"wsType_Bomb_ODAB", 
			"41":"wsType_Bomb_Fire", 
			"42":"wsType_Bomb_Nuclear", 
			"49":"wsType_Bomb_Lighter", 
		},
		"wsType_Weapon_wsType_Shell_A":{
			"10":"wsType_Shell_A",
		},
		"wsType_Navy_wsType_Ship":{
			"12":"wsType_AirCarrier",
			"13":"wsType_HCarrier",
			"14":"wsType_ArmedShip",
			"15":"wsType_CivilShip",
			"16":"wsType_Submarine",
		},
		"wsType_Static_wsType_Airdrome":{
			"20":"wsType_RW1", 
			"30":"wsType_RW2", 
			"40":"wsType_Heliport", 
		},
		"wsType_Static_wsType_Explosion":{
			"29":"wsType_GroundExp",
		},
		"wsType_Weapon_wsType_NURS":{
			"32":"wsType_Container", 
			"33":"wsType_Rocket", 
		},
		"wsType_Static_wsType_GContainer":{
			"44":"wsType_Control_Cont", 
			"45":"wsType_Jam_Cont", 
			"46":"wsType_Cannon_Cont", 
			"47":"wsType_Support", 
			"48":"wsType_Snare_Cont", 
			"50":"wsType_Smoke_Cont", 
		},
		"misc":{
			"25":"wsType_NoWeapon", 
			"26":"wsType_Gun", 
			"27":"wsType_Miss", 
			"28":"wsType_ChildMiss", 
			"104":"wsType_MissGun", 
			"100":"wsType_Civil", 
			"101":"wsType_Radar", 
			"102":"wsType_Radar_Miss", 
			"103":"wsType_Radar_MissGun", 
			"105":"wsType_Radar_Gun", 
		}
	};
	Object.values(types["wsType_Ground"]).map((x)=>types["wsType_Ground_"+x] = types["misc"]);
	Object.values(types["wsType_Static"]).map((x)=>types["wsType_Static_"+x] = types["misc"]);

	var parseObject = function(obj){
		if(!obj)return;
		obj.updated = Date.now();

		obj.groupName = obj.GroupName;
		obj.unitName = obj.UnitName;

		switch(obj.Name){
			case 'SA-11 Buk CC 9S470M1':
				obj.name = 'SA-11 Buk CC';
			break;
			case 'SA-11 Buk SR 9S18M1':
				obj.name = 'SA-11 Buk SR';
			break;
			case 'SA-11 Buk LN 9A310M1':
				obj.name = 'SA-11 Buk LN';
			break;
			case 'bofors40':
				obj.name = 'AAA Bofors 40';
			break;
			case 'Ural-375 ZU-23 Insurgent':
				obj.name = 'ZU-23 Ural';
			break;
			case 'CVN_71':
				obj.name = 'CVN-71 Theodore Roosevelt';
			break;
			case 'Stennis':
				obj.name = 'CVN-74 John C. Stennis';
			break;
			case 'Forrestal':
				obj.name = 'CV-59 Forrestal';
			break;
			case 'CVN_73':
				obj.name = 'CVN-73 George Washington';
			break;
			case 'Kub 2P25 ln':
				obj.name = 'SA-6';
			break;
			case 'Kub 1S91 str':
				obj.name = 'SA-6 STR';
			break;
			case 'HQ-7_STR_SP':
				obj.name = 'HQ-7 STR';
			break;
			case 'HQ-7_LN_SP':
				obj.name = 'HQ-7 LN';
			break;
			case 'Hummer':
				obj.name = 'M1025';
			break;
			case 'AAV7':
				obj.name = 'AAV-7A1';
			break;
			case 'BTR_D':
				obj.name = 'BTR-RD';
			break;
			case 'ZSU-23-4 Shilka':
				obj.name = 'ZSU-23';
			break;
			case 'ZU-23 Emplacement Closed':
				obj.name = 'ZSU-23 EC';
			break;
			case 'Strela-1 9P31':
				obj.name = 'SA-9';
			break;
			case 'Soldier stinger':
				obj.name = 'Stinger';
			break;
			case 'KC135MPRS':
				obj.name = 'KC-135 MPRS';
			break;
			case 'KC130':
				obj.name = 'KC-130';
			break;
			case 'LHA_Tarawa':
				obj.name = 'LHA Tarawa';
			break;
			case 'KUZNECOW':
			case 'CV_1143_5':
				obj.name = 'CV Kuznetsov';
			break;
			case 'NEUSTRASH':
				obj.name = 'test';
			break;
			case 'AH-64D_BLK_II':
				obj.name = 'AH-64D Apache';
			break;
			case 'Soldier M4 GRG':
				obj.name = 'Infantry';
			break;
			case 'Ural-4320T':
				obj.name = 'Ural';
			break;
			case 'houseA_arm':
			case 'house1arm':
				obj.name = 'Barracks';
			break;
			case 'FA-18C_hornet':
				obj.name = 'F/A-18C Hornet';
			break;
			case 'F-16C_50':
				obj.name = 'F-16C Blk 50';
			break;
			case 'outpost_road':
				obj.name = 'Outpost';
			break;
			case 'P_27PE':
				obj.name = 'R-27ER';
			break;
			case 'AIM_120C':
				obj.name = 'AIM-120C 5';
			break;
			case 'test':
				obj.name = 'test';
			break;
			default:
				obj.name = obj.Name;
			break;
		}

		// console.log("obj", obj);

		obj.levels = {"level1":0,"level2":0,"level3":0,"level4":0};
		if(obj.Type.level1){
			// console.log("obj", obj);
			try {
				obj.levels.level1 = types[obj.Type.level1];
				obj.levels.level2 = types[obj.levels.level1][obj.Type.level2];
				obj.levels.level3 = types[`${obj.levels.level1}_${obj.levels.level2}`][obj.Type.level3];
				obj.levels.level4 = types4[obj.Type.level4];

				obj.type = obj.levels.level1;
			}
			catch(e){
				// console.warn("Level assign error", e);
			}
		}

		obj.isPlayer = obj.Flags.Human?true:false;

		obj.coalition = obj.CoalitionID;
		obj.flags = obj.Flags;
		obj.pos = {
			heading:obj.Heading||0,
			lat:obj.LatLongAlt.Lat,
			lon:obj.LatLongAlt.Long,
			// alt:Math.round(obj.LatLongAlt.Alt * 3.28084),
			alt:Math.round(obj.LatLongAlt.Alt),
			bank:obj.Bank,
			pitch:obj.Pitch,
			x:obj.Position.x,
			y:obj.Position.y,
			z:obj.Position.z,
		};

		if(obj.groupName && obj.groupName.includes("Downed Pilot"))obj.name = "Downed Soldier";

		delete obj.Name;
		delete obj.UnitName;
		delete obj.GroupName;
		delete obj.Flags;
		delete obj.Bank;
		delete obj.Pitch;
		delete obj.Country;
		delete obj.Coalition;
		delete obj.CoalitionID;
		delete obj.Position;
		delete obj.LatLongAlt;
		delete obj.Heading;

		return obj;
	}

	// var base_waypoint = { x: -281653.671875, y: 38.05700552763, z: 647182.65625 };
	
	var server = dgram.createSocket('udp4');

	// DCS input
	server.on('message', (msg, rinfo) => {
		if(quitting)return;
		var data = JSON.parse(msg);
		// console.log("data", data);
		if(data.object){
			// console.log("packet", data.object.index+': '+data.object.Name);
			if(!data.object.Name)return;
			// if(!current_data.objects)current_data.objects = {};

			data.object = parseObject(data.object);
			// current_data.objects[data.object.id] = data.object;

			// if(data.object.unitName == 'DCON-1-1'){
			// 	console.log(data.object.updated);
			// }

			if(!menuWindow)return;
			menuWindow.webContents.send('objectUpdate',data.object);

			if(!overlayWindow)return;
			overlayWindow.webContents.send('objectUpdate',data.object);
		}

		if(data.me){
			// console.log('got me');
			current_data.me = data.me;
			current_data.me.object = parseObject(current_data.me.object);
			// current_data.me.camera.pos.alt = Math.round(current_data.me.camera.pos.alt*3.28084);
			current_data.me.camera.pos.alt = Math.round(current_data.me.camera.pos.alt);
			// console.log(current_data.me.camera.matrix);
			// console.log("current_data.me.object", current_data.me.object);

			if(quitting || !current_data.me)return;

			if(!overlayWindow)return;
			overlayWindow.webContents.send('updatePos',current_data);

			if(!menuWindow)return;
			menuWindow.webContents.send('updatePos',current_data);
		}
	});

	uIOhook.on('wheel',function(event){
		if(!overlayWindow)return;
		if(event.direction == 3)overlayWindow.webContents.send('mouseWheel',{
			rotation:event.rotation,
			amount:event.amount
		});
	});
	uIOhook.start();

	server.on('error', (err) => {
	    console.log(`server error:`, err);
	    server.close();
	});

	server.on('listening', () => {
	    const address = server.address();
	    console.log(`server listening ${address.address}:${address.port}`);
	});

	var dcs = new DcsBiosApi({
		// logLevel: 'INFO',
		receivePort: 44046,
		emitAllUpdates: false,
		sendPort:44045
		// autoStartListening: true
	});

	server.bind(44044);
	dcs.startListening();

	var overlayWindow = new createWindow("overlay",{
		width: 200,
		height: 200,
		frame: false,
		show: false,
		transparent: true,
		resizable: false,
		ignoreMouseEvents: true,
		fullScreenable:false,
		webPreferences: {
			nodeIntegration: true,
      		contextIsolation: false,
      		enableRemoteModule: false,
		},
	});

	overlayWindow.loadURL(__dirname+`/menu/${config.menu}/overlay.html`);

	OW.attachTo(overlayWindow, 'DCS.openbeta');

	overlayWindowShown = false;
	overlayWindow.setIgnoreMouseEvents(true);

	// overlayWindow.webContents.setFrameRate(1);

	OW.on('attach',function(event){
		if(!config.overlay_enabled)overlayWindow.hide();

		// overlayWindow.webContents.openDevTools({
		// 	mode: 'detach',
		// 	active: true
		// });
	});

	OW.on('blur',function(event){
		overlayWindow.webContents.send('dcsFocus',0);
	});
	OW.on('focus',function(event){
		overlayWindow.webContents.send('dcsFocus',1);
	});

	var menuHeight = 700;
	var menuWidth = 500;

	var menuWindow = new createWindow("menu",{
		width: menuWidth,
		height: menuHeight,
		
		minWidth: menuWidth,
		minHeight: menuHeight,

		frame: false,
		autoHideMenuBar:true,
		show: true,
		transparent: false,
		// background:'#000',
		// resizable: false,
		ignoreMouseEvents: true,
		fullScreenable: false,
		webPreferences: {
			nodeIntegration: true,
      		contextIsolation: false,
      		enableRemoteModule: true,
		},
	});
	// overlayWindow.webContents.setFrameRate(100);

	menuWindow.setAlwaysOnTop(true, 'screen');

	// return;

	// menuWindow.webContents.openDevTools({
	// 	mode: 'detach',
	// 	active: false
	// });

	ipcMain.on('windowManage', function(e,data){
		dcs.sendMessage('CAMERA_MODE 2');

		var currentSize = menuWindow.getSize();

		switch(data){
			case 'minimize':
				menuWindow.minimize();
			break;
			case 'maximize':
				menuWindow.setMinimumSize(menuWidth, menuHeight);
				menuWindow.setSize(currentSize[0],menuHeight);
			break;
			case 'unmaximize':
				menuWindow.setMinimumSize(menuWidth, 36);
				menuWindow.setSize(currentSize[0],36);
			break;
			case 'close':
				menuWindow.close();
				quit();
			break;
		};
	});

	ipcMain.on('overlayTrack', function(e,data){
		if(!overlayWindow)return;
		overlayWindow.webContents.send('track',data);
	});
	ipcMain.on('overlayUntrack', function(e,data){
		if(!overlayWindow)return;
		overlayWindow.webContents.send('untrack',data);
	});

	(function(){
		// dcs.on('update',function(controls){
		// 	for(var control of controls){
		// 		if(control.control.identifier != '_UPDATE_COUNTER')continue;
		// 		console.log("updates", control);
		// 	}
		// });

		// dcs.on('update',function(data){
		// 	console.log("data", data);

		// });

		// dcs.on('update',function(controls){
		// 	// console.log("control.control.identifier", control.control.identifier);
		// 	for(var control of controls){
		// 		if(control.control.identifier != '_UPDATE_COUNTER')continue;
		// 		// console.log("control.control.identifier", control.control.identifier);
		// 		console.log("updates", control);
		// 	}

		// });

		// return;
		// var pending_callback = null;
		// var expected_sequence_name = null;
		// var valid_sequence_names = [
		// 	'UFC_0',
		// 	'UFC_1',
		// 	'UFC_2',
		// 	'UFC_3',
		// 	'UFC_4',
		// 	'UFC_5',
		// 	'UFC_6',
		// 	'UFC_7',
		// 	'UFC_8',
		// 	'UFC_9',
		// 	'UFC_ENT',
		// 	'UFC_OS1',
		// 	'UFC_OS3'
		// ];

		// valid_sequence_names.forEach(function(sequence_name){
		// 	dcs.on(sequence_name, function(value) {
		// 		// console.log("sequence_name", sequence_name, value);
		// 		if(expected_sequence_name == sequence_name && pending_callback){
		// 			// console.log('here');
		// 			pending_callback();
		// 			pending_callback = null;
		// 		}
		//     });
		// });

		var running = 0;
		var abort = 0;
		var states = {};

		var sendMessage = function(action){
			return new Promise(async function(cb){
				// if(action.verify){
				// 	pending_callback = cb;
				// 	expected_sequence_name = action.name;
				// }
				
				await dcs.sendMessage(`${action.name} ${action.value}`);

				// if(!valid_sequence_names.includes(expected_sequence_name) || !action.verify){
				// 	expected_sequence_name = null;
				// 	pending_callback = null;
				cb();
				// }
			});
		}

		ipcMain.on('sequenceRun',async function(e,data){
			running = 1;
			menuWindow.webContents.send('sequenceStart',data);
			// console.log("data", data);

			var sequence;
			var actions = [];
			switch(data.sequence){
				case "lala":

				break;
				default:
					sequence = plane_sequences[data.plane][data.sequence](data.data);
				break;
			}

			var actions = [];

			for(var i in sequence.sequence){
				let seq = sequence.sequence[i];
				// console.log("seq", seq);

				switch(seq.type){
					case 'button':
						if(seq.name)actions.push({type:seq.type,name:seq.name,action:'PRESS_DOWN',value:1,verify:seq.verify});
						if(seq.delay)actions.push({type:'delay',action:'DELAY',delay:seq.delay});
						if(seq.name)actions.push({type:seq.type,name:seq.name,action:'PRESS_UP',value:0,verify:seq.verify});
					break;
					case 'delay':
						actions.push({type:'delay',action:'DELAY',delay:seq.delay});
					break;
				}
			}

			for(var i in actions){
				if(abort)break;

				var action = actions[i];
				// action.delay = 500;

				switch(action.type){
					case 'delay':
						// console.log(`Waiting For: ${action.delay}`);
						await waitFor(action.delay);
					break;
					case 'button':
						// console.log(`Sending: ${action.name} ${action.value}`);
						await sendMessage(action);
						states[action.name] = action.value;
					break;
					default:

					break;
				}
			}

			// console.log("states", states);

			for(var i in states){
				var state = states[i];
				if(!state)continue;

				await sendMessage({type:'button',name:i,action:'PRESS_UP',value:0});
				states[i] = 0;

				// console.log("Unstuck:", i);
			}

			abort = 0;
			running = 0;

			menuWindow.webContents.send('sequenceComplete',data);

			// console.log("actions", actions);
			// console.log("plane_data", plane_data);
		});

		ipcMain.on('sequenceStop',async function(e,data){
			abort = 1;
			await waitUntil(() => {return !running});

			menuWindow.webContents.send('sequenceStopped');
		});
	})();

	ipcMain.on('writeFile',async function(e,data){
		global[data.file] = data.data;
		await fs.writeFileSync('./'+data.file+'.json',JSON.stringify(data.data, null, 2));
	});

	ipcMain.on('toggleMapHelper',function(e,data){
		if(!overlayWindow)return;
		overlayWindow.webContents.send('toggleMapHelper');
	});

	// return;

	var loaded = await menuWindow.loadURL(__dirname+`/menu/${config.menu}/menu.html`);

	menuWindow.webContents.send('loadData',{package,storage,config});

	// security / updating
	(async function(){
		try {
			const res = await fetch('https://raw.githubusercontent.com/RevolvingDCON/DCONs-DCS-Waypoint-Computer/main/package.json');
			var remotePackage = await res.json();
			if(!remotePackage.version)return;

			menuWindow.webContents.send('loadData',{remotePackage});

			var disabledClient = remotePackage.disabledVersions[package.version];
			if(disabledClient){
				if(config.insecure){
					console.log('client disabled but insecure flag is set');
				}
				else
				{
					console.log('CLIENT DISABLED!');
					// for(var i in activeWindows){
					// 	await new Promise(function(cb){
					// 		activeWindows[i].on("closed",function(){
					// 			cb();
					// 		});
					// 		activeWindows[i].close();
					// 	});
					// }

					dialog.showMessageBoxSync(menuWindow,{
				        icon: "./icon.ico",
				        type: "error",
				        title: "CLIENT DISABLED",
				        message: `This version of DCON's Waypoint Computer was disabled.\nReason: ${disabledClient}`
				    });
					process.exit(1);
					return;
				}
			}

			// emergency meeting area
			for(var popup of remotePackage.popups){
				if(!popup.enabled)continue;
				delete popup.enabled;

				var display = 1;
				if(popup.conditions){
					display = 0;
					var conditions = popup.conditions.split('^');
					for(var condition of conditions){
						if(display)break;

						var parts = condition.split(':');
						var name = parts[0];
						var values = parts[1].split('|');

						switch(name){
							case 'v':
								if(values.includes(package.version))display = 1;
							break;
						}
					}
				}
				if(display)dialog.showMessageBoxSync(menuWindow,popup);
			}
		}
		catch(e){
			console.log("e", e);
		}
	})();
});