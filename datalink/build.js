const { spawn } = require('child_process');
const rcedit = require('rcedit');
const path = require('path');
const fs = require('fs-extra');
const {glob} = require('glob');
const package = require('./package.json');
const archiver = require('archiver');
const copydir = require('copy-dir');

var fullName = "DCONs_Waypoint_Computer_Server";
const exeName = fullName+".exe";
fullName = fullName+'-'+package.version;

var args = process.argv.splice(2);

(async function(){
	var files = glob.sync('./build/'+fullName.split('-')[0]+'-*');
	for(var file of files){
		await fs.remove(file);
	}
	
	process.env.PKG_CACHE_PATH = path.resolve('./.pkg-cache');

	const pkgTarget = 'node18-win-x64';
	const pkg = require("pkg");
	const pkgFetch = await require('pkg-fetch');
	const [nodeRange, platform, arch] = pkgTarget.split('-');
	await pkgFetch.need({nodeRange,platform,arch});
	
	var cacheExe = path.resolve((await glob.sync('./.pkg-cache/**/*x64'))[0]);
	console.log("cacheExe", cacheExe);

	console.log('Swapping out rcinfo');
	await rcedit(cacheExe,{
	    icon:path.resolve('../icon.ico'),
	    'file-version': package.version,
        'product-version': package.version,
        'version-string': {
			CompanyName: package.author,
			ProductVersion: package.version,
			ProductName: package.package,
			FileDescription: package.name,
			InternalName: exeName,
			OriginalFilename: exeName,
        },
	});

	console.log('Renaming');
	// intentionally create a race condition to trick PKG into hotloading
	// the edited base binary with edited rcinfo to bypass windows integrity checks
	var newName = cacheExe.replace('fetched','built');
	fs.renameSync(cacheExe,newName);

	console.log('Compiling server');
	await new Promise(async function(cb){
		const child = spawn(`pkg --target win index.js -o "./temp/${exeName}" --no-refresh`, {
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

	console.log('Copying config');
	fs.copyFileSync('./config.json', './temp/config.json');

	await copydir.sync('./temp','../build/'+fullName);

	if(args.includes('-a')){
		console.log('Archiving');
		await new Promise(function(cb){
			var output = fs.createWriteStream('../build/'+fullName+'.zip');
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
			archive.directory('../build/'+fullName, fullName);
			archive.finalize();
		});
	}

	await fs.remove('./temp/');
})();