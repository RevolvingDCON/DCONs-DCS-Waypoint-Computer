const fs = require('fs-extra');
const fetch = require('fetch-retry')(global.fetch);
const path = require('path');
const copydir = require('copy-dir');
const glob = require('glob');
const { spawn } = require('child_process');
const asar = require('@electron/asar');
const archiver = require('archiver');
const package = require('./package.json');

var args = process.argv.splice(2);
var env = args.includes('-dev')?'dev':'public';

console.log('Build Started');

// clients
(async function(){
	const buildPath = './build/DCON\'s Waypoint Computer-win32-x64';

	var appended_name = '';

	switch(env){
		case 'dev':
			appended_name = '_DEV_DONT_RELEASE';
		break;
	}

	var fullName = 'DCONs_Waypoint_Computer'+appended_name+'-'+package.version;

	var files = glob.sync('./build/'+fullName.split('-')[0]+'-*');
	for(var file of files){
		await fs.remove(file);
	}

	var bios_ignore = ["FA-18","CommonData","Metadata"];
	var bios_remove = [];

	for(var file of fs.readdirSync('./node_modules/dcs-bios-api/docs/json')){
		var skip = 0;
		for(var ignore of bios_ignore){
			if(file.startsWith(ignore)){
				skip = 1;
				// console.log('skipping: '+file);
				break;
			}
		}
		if(!skip)bios_remove.push('node_modules/dcs-bios-api/docs/json/'+file);
	}

	var ignore = [
		".git",
		"datalink",
		"dependencies",
		".gitignore",
		// "/icon.ico",
		"/go.bat",
		"/build.bat",
		"/build.js",
		"/storage.json",
		"/config.json",
		"/keycode_reference.lua",
		"/README.md",
		"/test.html",
		"/social.png",
		"/social.psd",
		"node_modules/logplease/screenshot.png",
		"node_modules/mapbox-gl/dist/mapbox-gl-dev.js",
		"node_modules/mapbox-gl/dist/mapbox-gl-unminified.js",
		"node_modules/mapbox-gl/dist/style-spec",
		"node_modules/mapbox-gl/build",
		"node_modules/mapbox-gl/flow-typed",
		"node_modules/mapbox-gl/src",
		"node_modules/mapbox-gl/dist/mapbox-gl-csp.js",
		"node_modules/mapbox-gl/dist/mapbox-gl-csp-worker.js",
		"node_modules/formatcoords/doc/mercator.jpg",
		"node_modules/web-streams-polyfill",
		...bios_remove
	];

	ignore.push(env != 'dev'?"menu/dev":"menu/public"); // don't include dev menu, will add 200mb to build!
	// console.log("ignore", ignore);
	// return;

	await new Promise(function(cb){
		// cb();
		// return;

		const child = spawn(`electron-packager . --overwrite --ignore=\"(${ignore.join('|')})\" --platform=win32 --arch=x64 --prune=true --icon=icon.ico --out=./build`, {
			shell: true
		});

		child.stdout.on('data', (data) => {
		    console.log(`stdout: ${data}`);
		});
		
		child.stderr.on('data', (data) => {
		    console.error(`stderr: ${data}`);
		});
		
		child.on('close', (code) => {
			cb();
		});
	});

	console.log('Copying Dependencies');
	await copydir.sync('./dependencies',buildPath+'/dependencies');

	console.log('Removing Bloat');
	var files = glob.sync([
		buildPath+'/LICENSES.chromium.html',
		buildPath+'/locales/*',
		buildPath+'/**/webfonts/*.svg',
		buildPath+'/**/webfonts/*.eot',
		buildPath+'/**/webfonts/*.ttf',
		buildPath+'/**/webfonts/*.woff',
		buildPath+'/**/*.map',
		buildPath+'/**/*.mjs',
		buildPath+'/**/*.py',
		buildPath+'/**/*.c',
		buildPath+'/**/*.h',
		buildPath+'/**/*.md',
		buildPath+'/**/*.jsonp',
		buildPath+'/**/*.ts',
		buildPath+'/**/.package-lock.json',
	]);
	for(var file of files){
		if(file.endsWith('en-US.pak'))continue;
		// console.log("Deleting File:", file);
		await fs.remove(file);
	}

	console.log('Renaming');
	await fs.rename(buildPath,'./build/'+fullName);// DCON's Waypoint Computer
	await fs.rename('./build/'+fullName+'/DCON\'s Waypoint Computer.exe','./build/'+fullName+'/DCONs_Waypoint_Computer.exe'); 
	
	if(args.includes('-a')){
		console.log('Archiving');
		await new Promise(function(cb){
			var output = fs.createWriteStream('./build/'+fullName+'.zip');
			const archive = archiver('zip', {
				zlib: {
					level: 9
				}
			});

			output.on('close', function() {
				console.log(archive.pointer() + ' total bytes');
				console.log('archiver has been finalized and the output file descriptor has closed.');
				cb(true);
			});

			output.on('end', function() {
				console.log('Data has been drained');
			});

			archive.on('warning', function(err) {
			  if (err.code === 'ENOENT') {

			  } else {

			    throw err;
			  }
			});

			archive.on('error', function(err) {
				throw err;
				cb(false);
			});

			archive.pipe(output);
			archive.directory('./build/'+fullName, fullName);
			archive.finalize();
		});
	}

	console.log('Build Complete');
})();