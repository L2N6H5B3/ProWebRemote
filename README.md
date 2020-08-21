# ProWebRemote
ProWebRemote is a pure HTML/CSS/JS remote control application for ProPresenter 7.


![alt text](https://raw.githubusercontent.com/L2N6H5B3/ProWebRemote/master/Screenshot.png)

## Installation
ProWebRemote can be either run directly from `index.html` or can be hosted on a webserver that does not use HTTPS.
Ensure that prior to running that the IP, Port, and Password have been changed in `site.js`, located in the `js/` folder. 

## Usage
ProWebRemote is designed to pull in all Library Presentations, Playlist Presentations, and Audio Playlists from ProPresenter 7 upon launch.

## Troubleshooting
ProWebRemote is not connecting to ProPresenter 7
* ProWebRemote must be run from either the index.html file or hosted on a non-HTTPS server as ProPresenter 7 uses WebSocket (not WebSocketSecure), and HTTPS only supports WSS.
* Ensure that the password provided to ProWebRemote matches the Remote password in ProPresenter 7
