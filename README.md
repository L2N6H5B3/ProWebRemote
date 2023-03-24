# ProWebRemote
ProWebRemote is a pure HTML/CSS/JS remote control application for ProPresenter 7, styled to look almost identical to ProPresenter 7 on macOS.

![alt text](https://raw.githubusercontent.com/L2N6H5B3/ProWebRemote/master/Screenshot.png)

## Installation
ProWebRemote can be either run directly from `index.html` or can be hosted on a webserver that does not use HTTPS.
Ensure that prior to running that the _IP_, _Port_, and _Password_ have been changed in `config.js`, located in the `js/` folder. 

## Usage
ProWebRemote is designed to pull in all Library Presentations, Playlist Presentations, Audio Playlists, Timers, and Messages from ProPresenter 7 upon launch.  While the interface is not 100% identical to ProPresenter 7, the general design is close enough to understand and utilise with no extra learning required.

There are several features available under **Settings** (in the top right) to enhance the experience of ProWebRemote:
* **Continuous Playlists** functions identically in ProWebRemote as it does in ProPresenter, allowing the entire playlist to scroll within the presentation slides area.
* **Pull Entire Library On Load** allows ProWebRemote to retrieve the entire Library of presentations, rather than just retrieving the names of the presentations.  This feature will significantly speed up the usage of library presentations (this has no impact on playlist presentations as they are always retrieved on demand), but may cause ProPresenter to crash if there are a significantly large amount of library presentations, or if there are presentations that have out-of-date cues.
* **Force Next/Previous Slide** will force the slide progression of the current presentation if the previous presentation was from a different location (Library/Playlist), and the current presentation was selected remotely.  Without this feature enabled, ProPresenter will default to the previous presentation on next/previous slide.
* **Save Browser Cookies** saves your preferences on the current device you're using as browser cookies.  If you disable this, ProWebRemote will default to the defined settings in `site.js`.  _**NOTE:** Save Browser Cookies does not work when launching ProWebRemote directly from the `index.html` file, due to a restriction with local files being allowed to use cookies._
* **Restart ProWebRemote** is used to allow an easy refresh of the web app if features are not responding correctly.  Please note that this will remove any configuration settings if **Save Browser Cookies** is not enabled.

## Troubleshooting
ProWebRemote is not connecting to ProPresenter 7
* If the library or playlists don't match up (e.g. a presentation has been edited or the playlist has changed), use the small refresh icon at the top right of the libraries/playlists section to force a refresh.
* Features were mainly developed on the Chromium platform (Google Chrome / Chromium Open Source Project) and may not work correctly in other browsers; though ProWebRemote has been tested on Safari on iOS 9.3.5.
* ProWebRemote must be run from either the index.html file or hosted on a non-HTTPS server as ProPresenter 7 uses WebSocket (WS) and not WebSocketSecure (WSS) for remote communication. HTTPS only supports WSS, and will not run a WS connection due to security requirements.
* Ensure that the password provided to ProWebRemote matches the Remote password in ProPresenter 7
