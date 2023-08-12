# DCONs-DCS-Waypoint-Computer
> **Disclaimer: I built this in early 2022 with no plans to release it, after leaving it on ice for over a year I've decided to make it public. The release of this software is in the same state as I left it in as of May 2022. (with some fixes for release) I am now going continue public development of the tool until it is in a complete state.**

A simple, clean and easy to use interface for transfering waypoints to aircraft in DCS through a custom radar or the ingame map. Also share waypoints with your friends in real time.

# How does it work?
### Basic usage
Getting into a supported aircraft in DCS will configure the tool for that aircraft. Pressing `Toggle Map Helper` will enable a small cursor in the center of the screen. On the ingame map, place the cursor over an area you want to designate to a waypoint then press `Add Waypoint`, this will add a waypoint to the list.

When you are happy with your waypoints, press `Send To Plane` and it will start the sequence. If you are unhappy with the sequence or something goes wrong, you can press `Stop Sequence` to stop everything.

<img src="https://i.imgur.com/4IAUFXa.png" width="300"/>

**Note: Waypoints are saved every time you open and close the tool.**

### Advanced usage (radar)
On the Radar page, right clicking anywhere on the world map will give you a small menu. On this menu you can pick from a few options depending on your selection. If you simply have clicked on the ground you can mark that location as a waypoint. If you have selected friendly units, you can mark all of their locations as waypoints.

<img src="https://i.imgur.com/e71BMd8.png" width="300"/> <img src="https://i.imgur.com/nrODWOo.png" width="300"/>

**Note: The radar will not show the location of enemy units or players.**

# Datalink / Tool Multiplayer
Datalink allows you to connect upto 32 users in real-time, share your waypoints and plan missions together.

Note: I am currently hosting a master server on `dcs.dcon.rocks:27069` and it is currently set as the default datalink host. You can host your own datalink dedicated server if you want using the server version of this tool.

### Creating a datalink
Enter the name and password you want for your datalink in the respective fields, pressing `Create Datalink` will create a datalink that your friends can join.

### Joining a datalink
Enter the name and password of the datalink and then press `Join Datalink`. This will connect you to the datalink where you can now see eachother and share waypoints.

<img src="https://i.imgur.com/ZMro1t1.png" width="270"/> <img src="https://i.imgur.com/V3uCiSB.png" width="270"/> <img src="https://i.imgur.com/0nIQ1RB.png" width="270"/>

# Aircraft
Supported:<br>
* F/A-18C<br>

In development:<br>
* A-10 (all varients)<br>
* AH-64D Apache<br>
* AV-8B Harrier<br>
* F-15E<br>
* F-16<br>
* Ka-50<br>
* Mirage 2000

# Installation (client)
Extract the tool from the zip to anywhere, run `DCONs_Waypoint_Computer.exe` before launching DCS **(you only need to do this for the first time)** that's all you need to do.
This will create `config.json` and `storage.json`

# Config
`dcs_saved_games_path` - the path to your DCS saved games location. This should automatically be found by the tool on launch.<br>
`numpad_depress_delay` - The time between each button up. (typically you don't want to edit this unless you know what you're doing)<br>
`enter_depress_delay` - The time between the enter button delay. **Increase this if your FPS is low or you might run into errors**<br>
`next_press_delay` - Time between button presses.<br>
`overlay_enabled` - Debug option to disable the map overlay. **If you have a blackscreen in DCS, set this to `false`**<br>

**Note: You can change most of these to 0 if you're playing on a highend machine, no two setups are the same so best you figure out what works for you.**

### Default config:
```
numpad_depress_delay:80,
enter_depress_delay:250,
next_press_delay:10,
overlay_enabled:1,

position_update_rate:100,
radar_object_delay:0.005
```

# Installation (server)
As of right now, serverside options are limited. You can edit the port in the server `config.json` then run `DCONs_Waypoint_Computer_Server.exe`. Giving people your server IP+Port to enter into the host field of their datalink will allow them to create and join datalinks on your server.

**Note: This is an advanced setup, if you don't already understand networking / port forwarding etc, this isn't for you.**

### Errors
If you get the `Please add the DCS Saved Games path to config.json` error, it's self explanatory, the tool failed to find your install path and you'll need to add it maually. Typically this happens when you've set custom paths for your DCS install.

# FAQ
### How is this any different than "DCSTheWay"?
I didn't want to focus on building waypoints from the ingame map, I wanted to focus on building full flight plans and being able to share those flight plans with people. DCSTheWay originally inspired this project but this project was not intended to compete with that mod. I spoke directly with the owner of DCSTheWay in May 2022 and showed the tool to him then and explained I had no plans to release it at that time.

### Why release this now?
The project was in a stable state for over a year. I gave it to multiple members of the community all who wanted to see it go public so they could share waypoints with their friends. I didn't want it sitting there doing nothing anymore.

### Why doesn't it work for me?
You can submit an issue in the [Issues tab](https://github.com/RevolvingDCON/DCONs-DCS-Waypoint-Computer/issues "Issues Tab") and I'll take a look, there's a lot of things that could go wrong.

# Todo
### The obvious
* Add full support for all aircraft. Most of them are in working condition but critical testing is still needed.
* Add a full flight plan save system
* Add drawing / planning tools to the radar with full networking support

# Beta
A beta version of this tool exists, if you want access to pre-release versions message me on discord: `Revolving DCON - @rdcn`

# Contributing
Feel free to help out or add features via submitting pull requests, if the change is approved, your credit will be added to the info page as a contributor.
