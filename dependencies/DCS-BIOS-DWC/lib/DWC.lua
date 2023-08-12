-- Credit to Doge#4634 for original upstream concept.

local udpServer = nil
local socket = require("socket")
local JSON = loadfile("Scripts\\JSON.lua")()

local data

-- Check if servers actually export this data
local hasExportStart = LuaExportStart
local hasLuaExportAfterNextFrame = LuaExportAfterNextFrame

-- CAMERA_UPDATE_RATE
local cameraUpdateRate = 100

-- OBJECT_UPDATE_RATE
local objectUpdateRate = 0.005

function LuaExportStart()
    if hasExportStart ~= nil then
        success, err = pcall(hasExportStart)
        if not success then
            log.write("DWC", log.ERROR, "Error in LuaExportStart "..tostring(err))
        end
    end
    
	udpServer = socket.udp()
	udpServer:settimeout(0)
end

local cameraDataTime = 0;
function LuaExportAfterNextFrame()

	-- every 100ms send positional data
	if (socket.gettime()*1000) < cameraDataTime then
		return
	end

	cameraDataTime = (socket.gettime()*1000) + cameraUpdateRate

    if hasLuaExportAfterNextFrame ~= nil then
        success, err = pcall(hasLuaExportAfterNextFrame)

        if not success then
            log.write("DWC", log.ERROR, "Error in LuaExportAfterNextFrame "..tostring(err))
        end
    end

  	local pos = LoGetCameraPosition()
	local self = LoGetSelfData()

	local x = pos['p']['x']
	local y = pos['p']['y']
	local z = pos['p']['z']

	local latlon = LoLoCoordinatesToGeoCoordinates(x, z)
	local alt = LoGetAltitude(x, z)

	local tbl = {
		["object"] = self,
		["camera"] = {
			["pos"] = {
				["lon"] = latlon.longitude,
				["lat"] = latlon.latitude,
				["alt"] = alt,
				["x"] = x,
				["y"] = y,
				["z"] = z
			},
			["matrix"] = pos
		}
	}

	local str = JSON:encode(tbl);

	if pcall(function()
		socket.try(udpServer:sendto('{"me":'..str..'}', "127.0.0.1", 44044))
	end) then

	else
        log.write("DWC", log.ERROR, "Error in LuaExportAfterNextFrame "..tostring(err))
	end
end

 -- Bank: -0.000094224233180285,
 --  Coalition: 'Enemies',
 --  CoalitionID: 2,
 --  Country: 16,
 --  Flags: {
 --    AI_ON: false,
 --    Born: true,
 --    Human: false,
 --    IRJamming: false,
 --    Invisible: false,
 --    Jamming: false,
 --    RadarActive: false,
 --    Static: true
 --  },
 --  GroupName: 'New Static Object #036',
 --  Heading: 2.181661605835,
 --  LatLongAlt: { Alt: 50.887277651545, Lat: 42.189770082889, Long: 42.506296284564 }

local currentWorldObjects
local currentWorldObjectsTbl
local currentWorldObjectsCount = 0
local currentWorldObjectsIndex = 0

function LuaExportActivityNextEvent(t)
	local tNext = t

	if currentWorldObjects == nil then
		currentWorldObjectsTbl = {}
		currentWorldObjectsCount = 0
		currentWorldObjectsIndex = 0

		currentWorldObjects = LoGetWorldObjects()

		for k,v in pairs(currentWorldObjects) do
			v["id"] = k
			v["index"] = currentWorldObjectsCount

			currentWorldObjectsCount = currentWorldObjectsCount + 1
			table.insert(currentWorldObjectsTbl,v);
		end
	end

	local str = '{"object":'..JSON:encode(currentWorldObjectsTbl[currentWorldObjectsIndex])..'}'

	if pcall(function()
		socket.try(udpServer:sendto(str, "127.0.0.1", 44044))
	end) then

	else
        log.write("DWC", log.ERROR, "Error in LuaExportActivityNextEvent "..tostring(err))
	end

	currentWorldObjectsIndex = currentWorldObjectsIndex + 1

	if currentWorldObjectsCount == currentWorldObjectsIndex then
		currentWorldObjects = nil
	end

	tNext = tNext + objectUpdateRate;

	return tNext;
end