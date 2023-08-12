var crypto = require('crypto');
var {Server} = require('socket.io');
var fs = require('fs');
var path = require('path');
var package = require('./package.json');

const config = JSON.parse(fs.readFileSync(process.cwd()+'/config.json'));
// console.log("config", config);

var sha256=(x)=>{return crypto.createHash('sha256').update(x.toString()).digest('hex')}; 

var parseUser = function(user={}){
 	user = {
		name:user.name.substring(0,32).trim(),
 		color:user.color.substring(0,7),
		ingame_name:user.ingame_name.substring(0,32).trim(),
		plane:user.plane.substring(0,32).trim()
 	};

 	user.id = sha256(user.name);

	return user;
};

(async function(){
	console.log(`started datalink server v${package.version} on port "${config.port}" ready for connections`);
	const io = new Server({

	});

	var datalinks = {};
	var userSockets = {};

	io.on("connection",function(socket){
		var ip = socket.request.connection.remoteAddress;

		console.log(`new connection from "${ip}:${socket.request.connection.remotePort}" assigning id "${socket.id}"`);

		var datalink;
		var datalink_id;
		var auth;
		var user;
		var auth_timer = setTimeout(function(){
			socket.disconnect();
		},5000);

		socket.on("auth_start",function(data,cb){
			// console.log("data", data);
			// console.log("validate", (!data || typeof data != 'object' || !data.user || typeof data.user != 'object' || !data.user.name.toString() || !data.user.color.toString() || !data.auth || typeof data.auth != 'object' || !data.auth.name.toString() || !data.auth.password.toString() || !data.auth.method.toString()));
			console.log(`${socket.id} • authentication start`);

			if(!data || typeof data != 'object' || !data.user || typeof data.user != 'object' || !data.user.name?.toString().trim() || !data.user.plane?.toString().trim() || !data.user.ingame_name?.toString().trim() || !data.user.color?.toString().trim() || !data.auth || typeof data.auth != 'object' || !data.auth.name?.toString().trim() || !data.auth.password?.toString() || !data.auth.version?.toString() || !data.auth.method?.toString()){
				cb({type:"authentication_invalid"});
				console.log(`${socket.id} • error: invalid datalink data`);
				console.log(`${socket.id} • authentication closed`);
				// console.log("data", data);
				return;
			}

			auth = data.auth;

			if(package.version !== auth.version){
				cb({
					type:"version_invalid",
					message:`Version mismatch\nclient: ${auth.version}, server: ${package.version}`
				});
				console.log(`${socket.id} • error: version missmatch`);
				console.log(`${socket.id} • authentication closed`);
				console.log("data", data);
				return;
			}

 			user = parseUser(data.user);

 			auth.name = auth.name.substring(0,32).trim();
 			auth.password = auth.password.substring(0,512);
 			auth.method = auth.method.substring(0,6);

			switch(auth.method){
				case "join":
					console.log(`${socket.id} • connecting to datalink "${auth.name}"`);
					console.log(`${socket.id} • creating user "${user.name}"`);
 					console.log(`"${user.name}" attempting to join "${auth.name}" with password "${auth.password}"`);

					datalink_id = sha256(auth.name+auth.password);
					datalink = datalinks[datalink_id];

					if(!datalink){
						cb({type:"authentication_invalid"});
						
						console.log(`${socket.id} • error: invalid datalink login`);
						console.log(`${socket.id} • authentication closed`);
						return;
					}

					if(datalink.users[user.id]){
						cb({type:"user_exists"});

						console.log(`${socket.id} • error: user duplication`);
						console.log(`${socket.id} • authentication closed`);
						return;
					}

					socket.emit("waypoint_update",datalink.waypoints);

					cb({
						type:"success",
						user,
						auth,
					});
				break;
				case "create":
					console.log(`${socket.id} • attempting to create datalink: "${auth.name}"`);

					datalink_id = sha256(auth.name+auth.password);
					datalink = datalinks[datalink_id];

					if(datalink){
						cb({
							type:"datalink_exists",
						});

						console.log(`${socket.id} • error: duplicate datalink`);
						console.log(`${socket.id} • authentication closed`);
						return;
					}

					datalinks[datalink_id] = {
						id:datalink_id,
						name:auth.name,
						password:auth.password,
						waypoints:[],
						users:[]
					};
					datalink = datalinks[datalink_id];
					
					console.log(`${socket.id} • datalink "${datalink.name}" created using password "${datalink.password}"`);
					socket.emit("waypoint_update",datalink.waypoints);

					// console.log("datalink", datalink);

					cb({
						type:"success",
						user,
						auth
					});

					emit_connected_users();
				break;
				default:
					return;
				break;
			}

			clearTimeout(auth_timer);

			socket.on("waypoint_add",function(data,cb){
				var waypoint = {
					id:sha256(Math.random()),
					...data,
					user
				};
				datalink.waypoints.push(waypoint);

				io.to(datalink.id).emit("waypoint_update",datalink.waypoints);
				
				console.log(`${datalink.name}:${user.name} added waypoint`);

				cb({
					type:"success",
				});
			});

			socket.on("mouse_pos_update",function(data,cb){
				io.to(datalink.id).emit("mouse_pos_update",{
					id:user.id,
					...data
				});
				
				// console.log(`Waypoint: ${waypoint.id} Added`);

				cb({
					type:"success",
				});
			});

			socket.on("waypoint_remove",function(id,cb){
				var index = 0;

				for(var waypoint of datalink.waypoints){
					if(waypoint.id == id)break;
					index++;
				}

				datalink.waypoints.splice(index, 1);
				io.to(datalink.id).emit("waypoint_update",datalink.waypoints);

				console.log(`${datalink.name}:${user.name} added deleted`);

				cb({
					type:"success",
				});
			});

			socket.on("user_page_update",function(page,cb){
				user.page = page;

				io.to(datalink.id).emit("user_page_update",{
					id:user.id,
					page
				});

				console.log(`${datalink.name}:${user.name} changed page "${page}"`);

				cb({
					type:"success",
				});
			});

			socket.on("disconnect",function(reason){
				console.log(`${datalink.name}:${user.name} disconnected`,reason);

				delete userSockets[user.id];
				delete datalink.users[user.id];
				socket.leave(datalink.id);
				io.to(datalink.id).emit("user_leave",user);

				emit_connected_users();

				if(!Object.keys(datalink.users).length){
					console.log(`datalink "${datalink.name}" deleted`);
					delete datalinks[datalink.id];
				}
			});

			console.log(`${socket.id} • "${user.name}" connected to datalink "${datalink.name}"`);

			userSockets[user.id] = socket;

			datalink.users[user.id] = user;
			socket.join(datalink.id);
			io.to(datalink.id).emit("user_join",user);

			emit_connected_users();

			console.log(`${socket.id} • authentication complete`);
		});

		var emit_connected_users = function(){
			var users = Object.values(datalinks[datalink.id].users);
			io.to(datalink.id).emit("users_update",Object.values(datalinks[datalink.id].users));
		};

		socket.on("disconnect",function(reason){
			if(datalink)return;
			console.log(`${socket.id} • socket closed`,reason);
		});
	});

	io.listen(config.port);
})();