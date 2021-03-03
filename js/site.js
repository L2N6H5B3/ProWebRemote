// Variables

// Connection
var host = "10.1.1.33";
var port = "50000";
var pass = "control";

// User Preference
var continuousPlaylist = true;
var retrieveEntireLibrary = false;
var forceSlides = false;
var followProPresenter = true;
var useCookies = true;
var mustAuthenticate = true;
var changeHost = true;

// Application
var authenticated = false;
var retryConnection = true;
var libraryList = [];
var playlistList = [];
var audioPlaylistList = [];
var libraryPresentationList = [];
var libraryPresentationNameList = [];
var playlistHeaderList = [];
var playlistPresentationList = [];
var playlistMediaList = [];
var libraryRequests = [];
var playlistRequests = [];
var refreshRequests = [];
var audioRequests = [];
var messageList = [];
var initialPresentationLocation;
var slideView = 1;
var slideCols = 3;
var data;
var wsUri;
var remoteWebSocket;
var resetTimeout;
var serverIsWindows;
var playlistTriggerIndex = false;
var refresh = true;
var inputTyping = false;
var stageMessageTyping = false;
var presentationDisplayRequest = [];
var previousPresentationRequest = false;

// End Variables


// WebSocket Functions

function connect() {
    // Hide authenticate segment
    $("#authenticate").hide();
    // Display connecting to host text
    $("#connecting-to").text("Connecting to " + host);
    // Fade-in the loader and text
    $("#connecting-loader").fadeIn();
    // Show disconnected status
    $("#status").attr("class", "disconnected");
    // Set WebSocket uri
    wsUri = "ws://" + host + ":" + port;
    remoteWebSocket = new WebSocket(wsUri + "/remote");
    remoteWebSocket.onopen = function () { onOpen(); };
    remoteWebSocket.onclose = function () { onClose(); };
    remoteWebSocket.onmessage = function (evt) { onMessage(evt); };
    remoteWebSocket.onerror = function (evt) { onError(evt); };
}

function onOpen() {
    if (!authenticated) {
        remoteWebSocket.send('{"action":"authenticate","protocol":"701","password":"' + pass + '"}');
    }
}

function onMessage(evt) {
    var obj = JSON.parse(evt.data);
    // console.log(evt.data);

    if (obj.action == "authenticate" && obj.authenticated == "1" && authenticated == false) {
        // If the data is stale
        if (refresh) {
            // Get the libraries and library contents, playlists and playlist contents
            getLibrary();
            // Get the audio playlists and playlist contents
            getAudioPlaylists();
            // Get clocks
            getClocks();
            // Get stage layouts
            getStageLayouts();
            // Set data to fresh
            refresh = false;
        }
        // Set as authenticated
        authenticated = true;
        // Set retry connection to enabled
        retryConnection = true;
        // Set loading data status
        $("#connecting-to").text("Loading Data");
        // Show connected status
        $("#status").attr("class", "connected");
        // Prevent disconnect auto-refresh
        clearTimeout(resetTimeout);
        // Start receiving clock times from ProPresenter
        startReceivingClockData();
    } else if (obj.action == "libraryRequest") {
        // Check if this is a Windows ProPresenter instance
        if (obj.library[0].includes(":")) {
            serverIsWindows = true;
        } else {
            serverIsWindows = false;
        }
        // Show downloading status
        $("#status").attr("class", "downloading-library");
        // Empty the library area
        $("#library-content").empty();
        // Empty the library list
        libraryList = [];
        // Empty the library presentation list
        libraryPresentationList = [];
        // Empty the library presentation name list
        libraryPresentationNameList = [];
        // Empty the library request list
        libraryRequests = [];
        // Create a variable to hold the libraries
        data = "";
        // For each item in the libraries
        obj.library.forEach(function(item) {
            // Add the library if required
            data += createLibrary(item);
            // If set to only get names from ProPresenter libraries
            if (!retrieveEntireLibrary) {
                // Create a presentation name element for the library
                createPresentationName(item);
            } else {
                // Add this library item location to the requests array
                libraryRequests.push(item);
                // Get the presentation file from the library
                getPresentation(item);
            }
        });
        // Add the libraries to the library content area
        $("#library-content").append(data);
        // Show connected status
        $("#status").attr("class", "connected");
        // Get playlists
        getPlaylists();
    } else if (obj.action == "playlistRequestAll") {
        // Show downloading status
        $("#status").attr("class", "downloading-playlist");
        // Empty the playlist area
        $("#playlist-content").empty();
        // Empty the playlist list
        playlistList = [];
        // Empty the playlist presentation list
        playlistPresentationList = [];
        // Empty the playlist header list
        playlistHeaderList = [];
        // Empty the playlist media list
        playlistMediaList = [];
        // Empty the playlist request list
        playlistRequests = [];
        // Create a variable to hold the playlists
        data = "";
        // For each playlist
        $(obj.playlistAll).each(
            function () {
                // Check if this object is a playlist group or playlist
                if (this.playlistType == "playlistTypeGroup") {
                    // Create a new playlist group
                    data += createPlaylistGroup(this);
                } else if (this.playlistType == "playlistTypePlaylist") {
                    // Create a new playlist
                    data += createPlaylist(this);
                }
            }
        );
        // Add the playlists to the playlist content area
        $("#playlist-content").append(data);
    } else if (obj.action == "audioRequest") {
        // Show downloading status
        $("#status").attr("class", "downloading-audio");
        // Empty the audio area
        $("#audio-content").empty();
        // Empty the audio playlist list
        audioPlaylistList = [];
        // Empty the audio request list
        audioRequests = [];
        // Create a variable to hold the audio playlists
        data = "";
        // For each audio playlist
        $(obj.audioPlaylist).each(
            function() {
                // Check if this object is a audio playlist group or audio playlist
                if (this.playlistType == "playlistTypeGroup") {
                    // Create a new audio playlist group
                    data += createAudioPlaylistGroup(this);
                } else if (this.playlistType == "playlistTypePlaylist") {
                    // Create a new audio playlist
                    data += createAudioPlaylist(this);
                }
            }
        );
        // Add the audio playlists to the audio playlist content area
        $("#audio-content").append(data);
        // Show connected status
        $("#status").attr("class", "connected");
        // Get the current audio status and song
        getAudioStatus();
    } else if (obj.action == "clockRequest") {
        // Empty the clock area
        $("#timer-content").empty();
        // Create a variable to hold the clocks
        data = "";
        // For each clock in the list
        obj.clockInfo.forEach(function(item, index) {
            // Create the clock
            data += createClock(item, index);
        });
        // Add the clocks to the timer content area
        $("#timer-content").append(data);
        // Prevent input fields from conflicting with slide progression
        preventInputInterference();
        // Get messages
        getMessages();
    } else if (obj.action == "messageRequest") {
        // Empty the message area
        $("#messages").empty();
        // Empty the message list
        messageList = [];
        // Create a variable to hold the messages
        data = "";
        // For each message in the list
        obj.messages.forEach(function(item, index) {
            // Create message
            data += createMessage(item, index);
            // Add the message to the message list
            messageList.push(item.messageComponents);
        });
        // Add the messages to the message content area
        $("#messages").append(data);
        // Get the message components
        var messageComponentData = createMessageComponents(0);
        // Empty the message component area
        $("#message-content").empty();
        // Add the data to the message component area
        $("#message-content").append(messageComponentData);
        // Add the message index data
        $("#message-content").attr("data-message-index", "0");
        // Prevent input fields from conflicting with slide progression
        preventInputInterference();
    } else if (obj.action == "stageDisplaySets") {
        // Create stage display screens
        createStageScreens(obj);
    } else if (obj.action == "presentationCurrent") {
        // If this presentation has images, process normally
        if (obj.presentation.presentationSlideGroups[0].groupSlides[0].slideImage != "") {
            // Create presentation
            createPresentation(obj);
        } else {
            // Compare presentations
            comparePresentations(obj);
        }
        
    } else if (obj.action == "presentationSlideIndex") {
        // Check if the slide index is not -1
        if (obj.slideIndex != -1) {
            // Display the current ProPresenter presentation
            displayPresentation(obj);
        }
    } else if (obj.action == "presentationTriggerIndex") {
        // Display the current ProPresenter presentation
        displayPresentation(obj);
        // If the presentation is destined for the announcements layer
        if (obj.presentationDestination == 1) {
            // Set clear announcements to active
            $("#clear-announcements").addClass("activated");
        }
        // If the ProPresenter version does not support this feature
        else {
            // Set clear slide to active
            $("#clear-slide").addClass("activated");
            // Set clear all to active
            $("#clear-all").addClass("activated");
        }
        if (serverIsWindows) {
            if (obj.presentationPath.charAt(0) == '0') {
                console.log("IsPlaylistTrigger");
                playlistTriggerIndex = true;
            } else {
                playlistTriggerIndex = false;
            }
        }
        // Request the presentation (text only) to check for changes
        getCurrentPresentationNoImage();
    } else if (obj.action == "audioTriggered") {
        // Set the current song
        setAudioSong(obj);
    } else if (obj.action == "audioPlayPause") {
        // Set the audio status
        setAudioStatus(obj.audioPlayPause);
        // Get the current song
        getCurrentAudio();
    } else if (obj.action == "audioCurrentSong") {
        // Set the current song
        setAudioSong(obj);
    } else if (obj.action == "audioIsPlaying") {
        // Set audio status
        setAudioStatus(obj.audioIsPlaying);
    } else if (obj.action == "clockStartStop") {
        // Set clock state
        setClockState(obj);
    } else if (obj.action == "clockCurrentTimes") {
        // Set clock current times
        setClockTimes(obj);
    } else if (obj.action == "clockNameChanged") {
        // Set clock name
        setClockName(obj);
    } else if (obj.action == "clockTypeChanged") {
        // Set clock type
        setClockTypePP(obj);
    } else if (obj.action == "clockIsPMChanged") {
        // Set clock format
        setClockFormat(obj);
    } else if (obj.action == "clockDurationChanged") {
        // Set clock duration
        setClockDuration(obj);
    } else if (obj.action == "clockEndTimeChanged") {
        // Set clock end time
        setClockEndTime(obj);
    } else if (obj.action == "clockOverrunChanged") {
        // Set clock overrun
        setClockOverrun(obj);
    } else if (obj.action == "clearAll") {
        // Set clear all
        setClearAll();
    } else if (obj.action == "clearAudio") {
        // Set clear audio
        setClearAudio();
    } else if (obj.action == "clearAnnouncements") {
        // Set clear announcements
        setClearAnnouncements();
    }
}

function onError(evt) {
    authenticated = false;
    console.error('Socket encountered error: ', evt.message, 'Closing socket');
    remoteWebSocket.close();
}

function onClose() {
    authenticated = false;
    // Show disconnected status
    $("#status").attr("class", "disconnected");
    // If retry connection is enabled
    if (retryConnection) {
        // Retry connection every second
        setTimeout(function() {
            connect();
        }, 1000);
    }

    // Refresh library after 5 minutes of disconnection
    resetTimeout = setTimeout(function() {
        refresh = true;
    }, 300000);
}

//  End WebSocket Functions


// Cookie Functions

function setCookie(cname, cvalue, exdays) {
    var d = new Date();
    d.setTime(d.getTime() + (exdays * 24 * 60 * 60 * 1000));
    var expires = "expires=" + d.toUTCString();
    document.cookie = cname + "=" + cvalue + ";" + expires + ";path=/";
}

function getCookie(cname) {
    var name = cname + "=";
    var decodedCookie = decodeURIComponent(document.cookie);
    var ca = decodedCookie.split(';');
    for (var i = 0; i < ca.length; i++) {
        var c = ca[i];
        while (c.charAt(0) == ' ') {
            c = c.substring(1);
        }
        if (c.indexOf(name) == 0) {
            return c.substring(name.length, c.length);
        }
    }
    return "";
}

function checkCookie(cname) {
    var name = getCookie(cname);
    if (name != "") {
        return true;
    } else {
        return false;
    }
}

// End Cookie Functions


// Settings Functions

function getContinuousPlaylistCookie() {
    if (checkCookie("continuousPlaylist") && useCookies) {
        continuousPlaylist = (getCookie("continuousPlaylist") == "true");
        document.getElementById("continuousPlaylist-checkbox").checked = (getCookie("continuousPlaylist") == "true");
    } else {
        document.getElementById("continuousPlaylist-checkbox").checked = continuousPlaylist;
    }
}

function setContinuousPlaylistCookie(boolean) {
    setCookie("continuousPlaylist", boolean, 90);
}

function getRetrieveEntireLibraryCookie() {
    if (checkCookie("retrieveEntireLibrary") && useCookies) {
        retrieveEntireLibrary = (getCookie("retrieveEntireLibrary") == "true");
        document.getElementById("retrieveEntireLibrary-checkbox").checked = (getCookie("retrieveEntireLibrary") == "true");
    } else {
        document.getElementById("retrieveEntireLibrary-checkbox").checked = retrieveEntireLibrary;
    }
}

function setRetrieveEntireLibraryCookie(boolean) {
    setCookie("retrieveEntireLibrary", boolean, 90);
}

function getForceSlidesCookie() {
    if (checkCookie("forceSlides") && useCookies) {
        forceSlides = (getCookie("forceSlides") == "true");
        document.getElementById("forceSlides-checkbox").checked = (getCookie("forceSlides") == "true");
    } else {
        document.getElementById("forceSlides-checkbox").checked = forceSlides;
    }
}

function setForceSlidesCookie(boolean) {
    setCookie("forceSlides", boolean, 90);
}

function getFollowProPresenterCookie() {
    if (checkCookie("followProPresenter") && useCookies) {
        followProPresenter = (getCookie("followProPresenter") == "true");
        document.getElementById("followProPresenter-checkbox").checked = (getCookie("followProPresenter") == "true");
    } else {
        document.getElementById("followProPresenter-checkbox").checked = followProPresenter;
    }
}

function setFollowProPresenterCookie(boolean) {
    setCookie("followProPresenter", boolean, 90);
}

function getUseCookiesCookie() {
    if (checkCookie("useCookies") && useCookies) {
        useCookies = (getCookie("useCookies") == "true");
        document.getElementById("useCookies-checkbox").checked = (getCookie("useCookies") == "true");
    } else {
        document.getElementById("useCookies-checkbox").checked = useCookies;
    }
}

function setUseCookiesCookie(boolean) {
    setCookie("useCookies", boolean, 90);
}

function getSlideViewCookie() {
    if (checkCookie("slideView") && useCookies) {
        slideView = parseInt(getCookie("slideView"));
    }
    setSlideView(slideView);
}

function setSlideViewCookie(int) {
    setCookie("slideView", int, 90);
}

function getSlideColsCookie() {
    if (checkCookie("slideCols") && useCookies) {
        slideCols = parseInt(getCookie("slideCols"));
        document.getElementById("slide-cols").value = (parseInt(document.getElementById("slide-cols").max)+1) - parseInt(getCookie("slideCols"));
    } else {
        document.getElementById("slide-cols").value = (parseInt(document.getElementById("slide-cols").max)+1) - slideCols;
    }
}

function setSlideColsCookie(int) {
    setCookie("slideCols", int, 90);
}

// End Settings Functions


// Build Functions

function createLibrary(obj) {
    // Variable to hold the unique status of the library in the array
    var unique = true;
    // Variable to hold the split string of the presentation path
    var pathSplit = obj.split("/");
    // Variable to hold the name of the library, retrieved from the presentation path
    var libraryName = "";
    // Variable to hold the data of the library
    var libraryData = "";
    // Iterate through each item in the split path to retrieve the library name
    pathSplit.forEach(function(item, index) {
        if (item == "Libraries") {
            libraryName = pathSplit[index + 1];
        }
    });
    // Check if the library is unique and can be added in the array
    libraryList.forEach(function(item) {
        if (item == libraryName) {
            unique = false;
        }
    });
    // If the library is unique
    if (unique) {
        // Add the library name to the library list
        libraryList.push(libraryName);
        // Create the library data
        var libraryData = '<a onclick="displayLibrary(this);"><div class="item lib library"><img src="img/library.png" /><div class="name">' + libraryName + '</div></div></a>';
    }
    return libraryData;
}

function createPlaylistGroup(obj) {
    var groupData = "";
    groupData += '<div class="playlist-group">' +
        '<a id="pp-expander-'+obj.playlistLocation+'" onclick="togglePlaylistVisibility(this)" class="expander collapsed"><i class="collapser '+getNested(obj)+' fas fa-caret-right"></i><div class="item lib group '+getNested(obj)+'"><img src="img/playlistgroup.png" />' + obj.playlistName + '</div></a>';
    $(obj.playlist).each(
        function() {
            if (this.playlistType == "playlistTypeGroup") {
                groupData += createPlaylistGroup(this);
            } else if (this.playlistType == "playlistTypePlaylist") {
                groupData += createPlaylist(this);
            }
        }
    );
    groupData += '</div>';
    return groupData;
}

function createPlaylist(obj) {
    var playlistData = '<a class="display-playlist" onclick="displayPlaylist(this);"><div class="item lib playlist presentation '+getNested(obj)+'"><img src="img/playlist.png"/><div class="name" id="pp-'+obj.playlistLocation+'">' + obj.playlistName + '</div></div></a>';
    playlistList.push(obj);
    obj.playlist.forEach(
        function(item) {
            if (item.playlistItemType == "playlistItemTypeHeader") {
                var playlistHeader = { presentationPath: item.playlistItemLocation, presentation: { presentationName: item.playlistItemName } };
                playlistHeaderList.push(playlistHeader);
            } else if (item.playlistItemType == "playlistItemTypeVideo") {
                var playlistVideo = { presentationPath: item.playlistItemLocation, presentation: { presentationName: item.playlistItemName, presentationItemType: item.playlistItemType, presentationThumbnail: item.playlistItemThumbnail } };
                playlistMediaList.push(playlistVideo);
            } else if (item.playlistItemType == "playlistItemTypeAudio") {
                var playlistAudio = { presentationPath: item.playlistItemLocation, presentation: { presentationName: item.playlistItemName, presentationItemType: item.playlistItemType, presentationThumbnail: item.playlistItemThumbnail } };
                playlistMediaList.push(playlistAudio);
            } else {
                // Add this playlist item location to the requests array
                playlistRequests.push({name:item.playlistItemName, location:item.playlistItemLocation});
                // Get the presentation in the playlist from ProPresenter
                getPresentation(item.playlistItemLocation);
            }
        }
    );
    return playlistData;
}

function createAudioPlaylistGroup(obj) {
    var groupData = "";
    groupData += '<div class="playlist-group">' +
        '<a id="ap-expander-'+obj.playlistLocation+'" onclick="togglePlaylistVisibility(this)" class="expander collapsed"><i class="collapser '+getNested(obj)+' fas fa-caret-right"></i><div class="item lib group '+getNested(obj)+'"><img src="img/playlistgroup.png" />' + obj.playlistName + '</div></a>';
    $(obj.playlist).each(
        function() {
            if (this.playlistType == "playlistTypeGroup") {
                groupData += createAudioPlaylistGroup(this);
            } else if (this.playlistType == "playlistTypePlaylist") {
                groupData += createAudioPlaylist(this);
            }
        }
    );
    groupData += '</div>';
    return groupData;
}

function createAudioPlaylist(obj) {
    var playlistData = '<a class="display-playlist" onclick="displayAudioPlaylist(this);"><div class="item lib playlist audio '+getNested(obj)+'"><img src="img/audio.png"/><div class="name" id="ap-'+obj.playlistLocation+'">' + obj.playlistName + '</div></div></a>';
    audioPlaylistList.push(obj);
    return playlistData;
}

function createClock(obj, clockIndex) {
    var clockdata = "";
    clockData = '<div id="clock-' + clockIndex + '" class="timer-container type-' + obj.clockType + '">' +
        '<div class="timer-expand"><a onclick="toggleClockVisibility(this)" class="expander expanded"><i class="collapser fas fa-caret-down"></i></a></div>' +
        '<div class="timer-name"><input id="clock-' + clockIndex + '-name" onchange="updateClock(' + clockIndex + ');" type="text" class="text-input collapse-hide" value="' + obj.clockName + '"/><div id="clock-' + clockIndex + '-name-text" class="timer-name-text collapse-show"></div></div>' +
        '<div id="clock-' + clockIndex + '-type" class="timer-type collapse-hide">' + createClockTypeOptions(obj.clockType, clockIndex) + '</div>' +
        '<div class="timer-timeOptions collapse-hide type-0"><div><div class="element-title">Duration</div><input id="clock-' + clockIndex + '-duration" onchange="updateClock(' + clockIndex + ');" type="text" class="text-input" value="' + getClockSmallFormat(obj.clockDuration) + '"/></div><div></div></div>' +
        '<div class="timer-timeOptions collapse-hide type-1"><div><div class="element-title">Time</div><input id="clock-' + clockIndex + '-time" onchange="updateClock(' + clockIndex + ');" type="text" class="text-input" value="' + getClockSmallFormat(obj.clockEndTime) + '"/></div><div><div class="element-title">Format</div><select id="clock-' + clockIndex + '-format" onchange="updateClock(' + clockIndex + ');" class="text-input">' + createClockFormatOptions(obj.clockFormat.clockTimePeriodFormat) + '</select></div></div>' +
        '<div class="timer-timeOptions collapse-hide type-2"><div><div class="element-title">Start</div><input id="clock-' + clockIndex + '-start" onchange="updateClock(' + clockIndex + ');" type="text" class="text-input" value="' + getClockSmallFormat(obj.clockDuration) + '"/></div><div><div class="element-title">End</div><input id="clock-' + clockIndex + '-end" onchange="updateClock(' + clockIndex + ');" type="text" class="text-input" placeholder="No Limit" value="' + getClockEndTimeFormat(obj.clockEndTime) + '"/></div></div>' +
        '<div class="timer-overrun collapse-hide"><div class="element-title">Overrun</div><input id="clock-' + clockIndex + '-overrun" onchange="updateClock(' + clockIndex + ');" type="checkbox" class="checkbox text-input" ' + getClockOverrun(obj.clockOverrun) + '/></div>' +
        '<div class="timer-reset"><a onclick="resetClock(' + clockIndex + ');"><div class="option-button"><img src="img/reset.png" /></div></a></div>' +
        '<div id="clock-' + clockIndex + '-currentTime" class="timer-currentTime">' + getClockSmallFormat(obj.clockTime) + '</div>' +
        '<div class="timer-state"><a onclick="toggleClockState(' + clockIndex + ');"><div id="clock-' + clockIndex + '-state" class="option-button">Start</div></a></div></div>';

    // If the clock is active
    if (obj.clockState == true) {
        // Start receiving clock times from ProPresenter
        startReceivingClockData();
    }

    return clockData;
}

function createClockTypeOptions(clockType) {
    var clockTypeData = '<a id="' + clockType + '" onclick="expandTypeList(this);"><div class="type-selected type-0"><img class="selected-img type-0" src="img/timer-countdown.png"><div class="row-name type-0">Countdown</div><img class="selected-img type-1" src="img/timer-counttotime.png"><div class="row-name type-1">Countdown to Time</div><img class="selected-img type-2" src="img/timer-elapsedtime.png"><div class="row-name type-2">Elapsed Time</div><div class="selected-indicator"><i class="fas fa-angle-up"></i><i class="fas fa-angle-down"></i></div></div></a>';
    switch (clockType) {
        case 0:
            clockTypeData += '<div class="type-dropdown">' +
                '<a onclick="setClockType(this);"><div id="type-0" class="dropdown-row selected"><div class="row-indicator"><i class="fas fa-check"></i></div><img class="row-img" src="img/timer-countdown.png"><div class="row-name">Countdown</div></div></a>' +
                '<a onclick="setClockType(this);"><div id="type-1" class="dropdown-row"><div class="row-indicator"><i class="fas fa-check"></i></div><img class="row-img" src="img/timer-counttotime.png"><div class="row-name">Countdown to Time</div></div></a>' +
                '<a onclick="setClockType(this);"><div id="type-2" class="dropdown-row"><div class="row-indicator"><i class="fas fa-check"></i></div><img class="row-img" src="img/timer-elapsedtime.png"><div class="row-name">Elapsed Time</div></div></a>' +
                '</div>';
            break;
        case 1:
            clockTypeData += '<div class="type-dropdown">' +
                '<a onclick="setClockType(this);"><div id="type-0" class="dropdown-row"><div class="row-indicator"><i class="fas fa-check"></i></div><img class="row-img" src="img/timer-countdown.png"><div class="row-name">Countdown</div></div></a>' +
                '<a onclick="setClockType(this);"><div id="type-1" class="dropdown-row selected"><div class="row-indicator"><i class="fas fa-check"></i></div><img class="row-img" src="img/timer-counttotime.png"><div class="row-name">Countdown to Time</div></div></a>' +
                '<a onclick="setClockType(this);"><div id="type-2" class="dropdown-row"><div class="row-indicator"><i class="fas fa-check"></i></div><img class="row-img" src="img/timer-elapsedtime.png"><div class="row-name">Elapsed Time</div></div></a>' +
                '</div>';
            break;
        default:
            clockTypeData += '<div class="type-dropdown">' +
                '<a onclick="setClockType(this);"><div id="type-0" class="dropdown-row"><div class="row-indicator"><i class="fas fa-check"></i></div><img class="row-img" src="img/timer-countdown.png"><div class="row-name">Countdown</div></div></a>' +
                '<a onclick="setClockType(this);"><div id="type-1" class="dropdown-row"><div class="row-indicator"><i class="fas fa-check"></i></div><img class="row-img" src="img/timer-counttotime.png"><div class="row-name">Countdown to Time</div></div></a>' +
                '<a onclick="setClockType(this);"><div id="type-2" class="dropdown-row selected"><div class="row-indicator"><i class="fas fa-check"></i></div><img class="row-img" src="img/timer-elapsedtime.png"><div class="row-name">Elapsed Time</div></div></a>' +
                '</div>';
            break;
    }
    return clockTypeData;
}

function createClockFormatOptions(formatType) {
    switch (formatType) {
        case 0:
            return '<option value="0" selected>AM</option><option value="1">PM</option><option value="2">24Hr</option>';
        case 1:
            return '<option value="0">AM</option><option value="1" selected>PM</option><option value="2">24Hr</option>';
        default:
            return '<option value="0">AM</option><option value="1">PM</option><option value="2" selected>24Hr</option>';
    }
}

function createMessage(obj, messageIndex) {
    var messageData;
    if (messageIndex == 0) {
        messageData = '<a onclick="displayMessage(this);">' +
            '<div id="message.'+messageIndex+'" class="message-info selected">' +
            '<div class="message-name">'+obj.messageTitle+'</div>' +
            '<a onclick="hideMessage(this);"><div class="message-clear"><i class="fas fa-times-circle"></i></div></a>' +
            '</div>' +
            '</a>';
    } else {
        messageData = '<a onclick="displayMessage(this);">' +
            '<div id="message.'+messageIndex+'" class="message-info">' +
            '<div class="message-name">'+obj.messageTitle+'</div>' +
            '<a onclick="hideMessage(this);"><div class="message-clear"><i class="fas fa-times-circle"></i></div></a>' +
            '</div>' +
            '</a>';
    }
    return messageData;
}

function createMessageComponents(index) {
    // Get the message components
    var messageComponents = messageList[index];
    // Create a variable to hold the message components
    var messageComponentData = "";
    // Create a variable to hold the message preview segments
    var messagePreviewData = '<div class="message-preview">' +
        '<div class="attribute-name">Preview:</div>' +
        '<div class="attribute-data">';
    // Iterate through the message components
    messageComponents.forEach(
        function(item, index) {
            // If this is a data entry element
            if (item.startsWith("${")) {
                // If this component is a timer
                if (item.endsWith("TIMER}")) {
                    // Create a variable to hold the timer name
                    var timerName = item.replace("${","").replace(": TIMER}","");
                    // Create a variable to hold the timer index
                    var timerIndex;
                    // Iterate through all available timers
                    $(".timer-name").children("input").each(
                        function () {
                            if ($(this).val() == timerName) {
                                timerIndex = parseInt($(this).attr("id").split("-")[1]);
                            }
                        }
                    );

                    var clockDuration = $("#clock-"+timerIndex+"-start").val();
                    var clockEndTime = $("#clock-"+timerIndex+"-time").val();
                    var clockTime = $("#clock-"+timerIndex+"-currentTime").text();

                    var clockType;
                    var clockTimePreview;
                    if ($("#clock-"+timerIndex).hasClass("type-0")) {
                        clockType = 0;
                        clockTypePreview = clockDuration;
                    } else if ($("#clock-"+timerIndex).hasClass("type-1")) {
                        clockType = 1;
                        clockTypePreview = "00:00:00";
                    } else {
                        clockType = 2;
                        clockTypePreview = clockDuration;
                    }

                    var clockOverrun = document.getElementById("clock-"+timerIndex+"-overrun").checked;
                    // Add the message component data
                    messageComponentData += '<div class="message-attribute timer">' +
                        '<div class="attribute-name">'+timerName+'</div>' +
                        '<div id="messageclock-'+timerIndex+'" class="message-timer-container type-'+clockType+'">' +
                        '<div id="messageclock-'+timerIndex+'-type" class="timer-type collapse-hide">'+createClockTypeOptions(clockType, timerIndex)+'</div>' +
                        '<div class="timer-timeOptions collapse-hide type-0"><div><div class="element-title">Duration</div><input id="messageclock-'+timerIndex+ '-duration" onchange="updateMessagePreview(this); updateMessageClock('+timerIndex+');" type="text" class="text-input" value="'+clockDuration+'"/></div></div>' +
                        '<div class="timer-timeOptions collapse-hide type-1"><div><div class="element-title">Time</div><input id="messageclock-'+timerIndex+ '-time" onchange="updateMessagePreview(this); updateMessageClock('+timerIndex+');" type="text" class="text-input" value="'+clockEndTime+'"/></div><div><div class="element-title">Format</div><select id="messageclock-' + timerIndex + '-format" onchange="updateMessageClock(' + timerIndex + ');" class="text-input">' + createClockFormatOptions(parseInt($("#clock-"+timerIndex+"-format").val())) + '</select></div></div>' +
                        '<div class="timer-timeOptions collapse-hide type-2"><div><div class="element-title">Start</div><input id="messageclock-'+timerIndex+ '-start" onchange="updateMessagePreview(this); updateMessageClock('+timerIndex+');" type="text" class="text-input" value="'+ clockDuration+'"/></div><div><div class="element-title">End</div><input id="messageclock-' + timerIndex + '-end" onchange="updateMessageClock(' + timerIndex + ');" type="text" class="text-input" placeholder="No Limit" value="' + clockEndTime + '"/></div></div>' +
                        '<div class="timer-overrun collapse-hide"><input id="messageclock-' + timerIndex + '-overrun" onchange="updateMessageClock('+timerIndex+');" type="checkbox" class="checkbox text-input" '+getClockOverrun(clockOverrun)+'/><div>Overrun</div></div>' +
                        '<div class="message-timer-controls"><div class="timer-reset"><a onclick="resetClock('+timerIndex+');"><div class="option-button"><img src="img/reset.png" /></div></a></div>' +
                        '<div id="messageclock-'+timerIndex+'-currentTime" class="timer-currentTime">'+clockTime+'</div>' +
                        '<div class="timer-state"><a onclick="toggleClockState('+timerIndex+');"><div id="messageclock-'+timerIndex+'-state" class="option-button"><i class="fas fa-play"></i></div></a></div></div></div>' +
                        '</div>';
                    // Add the message Preview data
                    messagePreviewData += '<div id="preview.'+item.replace("${","").replace(": TIMER}","")+'" class="attribute-item">'+clockTypePreview+'</div>';
                } else {
                    // Add the message component data
                    messageComponentData += '<div class="message-attribute">' +
                        '<div class="attribute-name">'+item.replace("${","").replace("}","")+'</div>' +
                        '<input onchange="updateMessagePreview(this)" class="text-input attribute-data" />' +
                        '</div>';
                    // Add the message Preview data
                    messagePreviewData += '<div id="preview.'+item.replace("${","").replace("}","")+'" class="attribute-item">'+item.replace("${","[").replace("TIMER}","]").replace("}","]")+'</div>';
                }
            } else {
                // Add the message Preview data
                messagePreviewData += '<div class="attribute-item">'+item+'</div>';
            }
        }
    );
    messagePreviewData += '</div></div>';
    messageComponentData += messagePreviewData;
    return messageComponentData;
}

function createStageScreens(obj) {
    var screenData = "";
    obj.stageScreens.forEach(
        function(item) {
            var selectedLayout = item.stageLayoutSelectedLayoutUUID;
            screenData += '<div class="stage-screen"><div class="screen-name">' + item.stageScreenName + '</div><div class="stage-layout"><select onchange="setStageLayout(this)" name="stage-layout" id="' + item.stageScreenUUID + '">';
            obj.stageLayouts.forEach(
                function(item) {
                    if (item.stageLayoutUUID == selectedLayout) {
                        screenData += '<option value="' + item.stageLayoutUUID + '" selected>' + item.stageLayoutName + '</option>';
                    } else {
                        screenData += '<option value="' + item.stageLayoutUUID + '">' + item.stageLayoutName + '</option>';
                    }
                }
            );
            screenData += '</select></div></div>';
        }
    );
    // Add the screen data to stage screens
    document.getElementById("stage-screens").innerHTML = screenData;
}

function createPresentationName(obj) {
    // Variable to hold the unique status of the presentation
    var unique = true;
    // Variable to hold the split string of the presentation path
    var pathSplit = obj.split("/");
    // Variable to hold the name of the presentation, retrieved from the presentation path
    var presentationName = "";
    // Iterate through each item in the split path to retrieve the library name
    pathSplit.forEach(function(item, index) {
        if (item == "Libraries") {
            presentationName = pathSplit[index + 2].replace(".pro", "");
        }
    });
    // Check if the presentation is unique and can be added in the array
    libraryPresentationNameList.forEach(function(item) {
        if (item.presentationName == presentationName) {
            unique = false;
        }
    });
    // If the presentation is unique
    if (unique) {
        // Create object with presentation name and path
        var presentationObj = { presentationName: presentationName, presentationPath: obj };
        // Add the new presentation object to the library presentation name list
        libraryPresentationNameList.push(presentationObj);
    }
}

function createPresentation(obj) {
    // Variable to hold the correct index
    var count = 0;

    // Variable to hold the playlist request
    var playlistRequest;
    // Check if this is a Windows ProPresenter instance 
    if (serverIsWindows & libraryRequests.length == 0) {
        // Find the playlist request by name
        playlistRequest = findRequestByName(playlistRequests, obj.presentation.presentationName);
        // If there is no playlist request
        if (playlistRequest == null) {
            if (playlistTriggerIndex) {
                // set the correct presentation path from the currently existing playlist presentation path
                obj.presentationPath = findPresentationByBottomPath(playlistPresentationList, obj.presentationPath).presentationPath;
            }
        } else {
            // set the correct presentation path
            obj.presentationPath = playlistRequest.location;
        }
    } else {
        // Find the playlist request by presentation path
        playlistRequest = findRequestByPath(playlistRequests, obj.presentationPath);
    }
    
    // Set the correct index for grouped slides
    obj.presentation.presentationSlideGroups.forEach(
        function(presentationSlideGroup) {
            presentationSlideGroup.groupSlides.forEach(
                function(groupSlide) {
                    // Set the current count as the slide index
                    groupSlide.slideIndex = count;
                    count++;
                }
            );
        }
    );

    // Add this presentation to either the playlist or library presentation list
    if (obj.presentationPath.charAt(0) == '0') {
        // Get the presentation from the playlist presentation list
        var item = findPresentationByTopPath(playlistPresentationList, obj.presentationPath);
        
        // If this is a playlist item request
        if (playlistRequest != null) {
            // Check if the presentation is unique and should be added to the end of the array
            if (item == null) {
                // Add presentation to end of array
                playlistPresentationList.push(obj);
                // Remove the request from the array
                removeArrayValue(playlistRequests, playlistRequest);
            }
            if (playlistRequests.length == 0) {
                // Get the current displayed presentation from ProPresenter
                getCurrentPresentation();
                // Show connected status
                $("#status").attr("class", "connected");
                // Fade out loading screen
                $(".loading").fadeOut();
            }
        } else if (refreshRequests.includes(obj.presentationPath)) {
            // Replace presentation currently in array with updated presentation
            replaceArrayValue(playlistPresentationList, item, obj);
            // Refresh presentation if currently displayed
            refreshPresentation(obj.presentationPath);
        } else {
            // Set the initial presentation location
            initialPresentationLocation = obj.presentationPath;
            // Get the current slide index
            getCurrentSlide();
        }
    } else {
        // Get the presentation from the library presentation list 
        item = findPresentationByTopPath(libraryPresentationList, obj.presentationPath);
        // If this is a library item request
        if (libraryRequests.includes(obj.presentationPath)) {
            // Check if the presentation is unique and should be added to the end of the array
            if (item == null) {
                // Add presentation to end of array
                libraryPresentationList.push(obj);
                // Remove the request from the array
                removeArrayValue(libraryRequests, obj.presentationPath);
            }
        } else if (refreshRequests.includes(obj.presentationPath)) {
            // Replace presentation currently in array with updated presentation
            replaceArrayValue(libraryPresentationList, item, obj);
            // Refresh presentation if currently displayed
            refreshPresentation(obj.presentationPath);
        } else {
            // Set the initial presentation location
            initialPresentationLocation = obj.presentationPath;
            // Get the current slide index
            getCurrentSlide();
        }
    }
    // If set to only get names from ProPresenter libraries
    if (!retrieveEntireLibrary) {
        // Display this presentation if requested
        if (presentationDisplayRequest[0] == obj.presentationPath) {
            // Create an object to hold the presentation data
            var presentationObject = { action: "presentationTriggerIndex", presentationPath: presentationDisplayRequest[0], slideIndex: presentationDisplayRequest[1] };
            // Display the presentation
            displayPresentation(presentationObject);
            // Set the presentation display request to empty
            presentationDisplayRequest = [];
            // Show connected status
            $("#status").attr("class", "connected");
        }
    }
}

// End Build Functions


// Clear Functions

function clearAll() {
    remoteWebSocket.send('{"action":"clearAll"}');
    setClearAll();
}

function setClearAll() {
    
    $('#live').empty();
    // Remove selected from any previous slides
    $(".slide-container").removeClass("selected");

    $("#clear-all").removeClass("activated");
    $("#clear-audio").removeClass("activated");
    $("#clear-messages").removeClass("activated");
    $(".message-timer-controls").hide();
    $("#clear-props").removeClass("activated");
    $("#clear-announcements").removeClass("activated");
    $("#clear-slide").removeClass("activated");
    $("#clear-media").removeClass("activated");
    $(".current").empty();
    $("#audio-status").addClass("disabled");
    $("#audio-items").children("a").children("div").removeClass("highlighted");

    $("#audio-status").removeClass("fa-pause");
    $("#audio-status").addClass("fa-play").addClass("disabled");
}

function clearAudio() {
    remoteWebSocket.send('{"action":"clearAudio"}');
    setClearAudio();
}

function setClearAudio() {
    $("#clear-audio").removeClass("activated");
    $(".playing-audio").empty();
    $(".playing-audio").prop('title', "");
    $("#audio-status").addClass("disabled");
    $("#audio-items").children("a").children("div").removeClass("selected");
    $("#audio-items").children("a").children("div").removeClass("highlighted");
    if ($(".icons a.activated").not("#clear-all").length < 1) {
        $("#clear-all").removeClass("activated");
    }
}

function clearMessages() {
    remoteWebSocket.send('{"action":"clearMessages"}');
    $("#clear-messages").removeClass("activated");
    $(".message-timer-controls").hide();
    if ($(".icons a.activated").not("#clear-all").length < 1) {
        $("#clear-all").removeClass("activated");
    }
}

function clearProps() {
    remoteWebSocket.send('{"action":"clearProps"}');
    $("#clear-props").removeClass("activated");
    if ($(".icons a.activated").not("#clear-all").length < 1) {
        $("#clear-all").removeClass("activated");
    }
}

function clearAnnouncements() {
    remoteWebSocket.send('{"action":"clearAnnouncements"}');
    $("#clear-announcements").removeClass("activated");
    if ($(".icons a.activated").not("#clear-all").length < 1) {
        $("#clear-all").removeClass("activated");
    }
}

function setClearAnnouncements() {
    $("#clear-announcements").removeClass("activated");
    if ($(".icons a.activated").not("#clear-all").length < 1) {
        $("#clear-all").removeClass("activated");
    }
    // Remove announcement selected from any previous slides
    $(".slide-container").removeClass("announcement-selected");
}

function clearSlide() {
    $('#live').empty();
    remoteWebSocket.send('{"action":"clearText"}');
    $("#clear-slide").removeClass("activated");
    if ($(".icons a.activated").not("#clear-all").length < 1) {
        $("#clear-all").removeClass("activated");
    }
    // Remove selected from any previous slides
    $(".slide-container").removeClass("selected");
}

function clearMedia() {
    remoteWebSocket.send('{"action":"clearVideo"}');
    $("#clear-media").removeClass("activated");
    $(".playing-timeline").empty();
    if ($(".icons a.activated").not("#clear-all").length < 1) {
        $("#clear-all").removeClass("activated");
    }
}

// End Clear Functions


// Set Data Functions

function setCurrentSlide(index, location, presentationDestination) {
    // Iterate over each slide number
    $(".slide-number").each(
        function() {
            // If this slide number and location match the requested slide
            if ($(this).text() == index && $(this).parent().parent().parent().attr("id") == location) {
                if (presentationDestination != 1) {
                    // Set the slide as selected
                    $(this).parent().parent().parent().parent().addClass("selected");
                    // Remove previously selected from any previous slides
                    $(".slide-container").removeClass("previous-selection");
                    // Set the slide as previously selected
                    $(this).parent().parent().parent().parent().addClass("previous-selection");
                } else {
                    // Set the slide as selected
                    $(this).parent().parent().parent().parent().addClass("announcement-selected");
                }
                
                // If the slide is not currently visible
                if (!isElementInViewport(document.getElementById("slide" + index + "." + location))) {
                    // Scroll to place the slide in view
                    document.getElementById("slide" + index + "." + location).scrollIntoView();
                    // Get the presentation container
                    var presentationContainer = document.getElementById("presentations");
                    // If the presentation container is not scrolled all the way to the bottom
                    if (presentationContainer.scrollTop + presentationContainer.clientHeight < presentationContainer.scrollHeight) {
                        // Scroll the container down by 34 pixels to avoid cutting off slide
                        document.getElementById("presentations").scrollTop = document.getElementById("presentations").scrollTop - 34;
                    }
                }
            }
        }
    );
    if (presentationDestination != 1) {
        // Check if this is a playlist or library presentation
        if (location.charAt(0) == '0') {
            // Set the current live slide image
            $(playlistPresentationList).each(
                function() {
                    if (this.presentationPath == location) {
                        $(this.presentation.presentationSlideGroups).each(
                            function() {
                                $(this.groupSlides).each(
                                    function() {
                                        if (this.slideIndex == index - 1) {
                                            var image = new Image();
                                            image.src = 'data:image/png;base64,' + this.slideImage;
                                            $('#live').empty();
                                            $('#live').append(image);
                                        }
                                    }
                                );
                            }
                        );
                    }
                }
            );
        } else {
            // Set the current live slide image
            $(libraryPresentationList).each(
                function() {
                    if (this.presentationPath == location) {
                        $(this.presentation.presentationSlideGroups).each(
                            function() {
                                $(this.groupSlides).each(
                                    function() {
                                        if (this.slideIndex == index - 1) {
                                            var image = new Image();
                                            image.src = 'data:image/png;base64,' + this.slideImage;
                                            $('#live').empty();
                                            $('#live').append(image);
                                        }
                                    }
                                );
                            }
                        );
                    }
                }
            );
        }
    }
}

function setPresentationDestination(location, presentationDestination) {
    // Check if this is a playlist or library presentation
    if (location.charAt(0) == '0') {
        // Iterate through each playlist presentation
        $(playlistPresentationList).each(
            function() {
                if (this.presentationPath == location) {
                    // Set the new presentation destination
                    this.presentationDestination = presentationDestination;
                }
            }
        );
    } else {
        // Iterate through each playlist presentation
        $(libraryPresentationList).each(
            function() {
                if (this.presentationPath == location) {
                    // Set the new presentation destination
                    this.presentationDestination = presentationDestination;
                }
            }
        );
    }
    if (followProPresenter) {
        // Get current presentation controls
        presentationControls = $(document.getElementById("presentation."+location)).children(".presentation-header").children(".presentation-controls")[0];
        // If current presentation exists
        if (presentationControls != null) {
            // If the presentation does not have an announcement layer icon but is an announcement layer presentation
            if (presentationControls.childElementCount == 0 && presentationDestination == 1) {
                // Add the announcement layer icon
                presentationControls.innerHTML = getPresentationDestination(presentationDestination);
            }
            // If the presentation has an announcement layer icon but is not an announcement layer presentation
            else if (presentationControls.childElementCount == 1 && presentationDestination == 0) {
                // Remove the announcement layer icon
                presentationControls.innerHTML = "";
            }
        }
    }
}

// End Set Data Functions


// Get Data Functions

function getCurrentPresentation() {
    // Send the request to ProPresenter
    remoteWebSocket.send('{"action":"presentationCurrent", "presentationSlideQuality": "300"}');
}

function getCurrentPresentationNoImage() {
    // Send the request to ProPresenter
    remoteWebSocket.send('{"action":"presentationCurrent", "presentationSlideQuality": "0"}');
}

function getCurrentSlide() {
    // Send the request to ProPresenter
    remoteWebSocket.send('{"action":"presentationSlideIndex"}');
}

function getCurrentAudio() {
    // Send the request to ProPresenter
    remoteWebSocket.send('{"action":"audioCurrentSong"}');
}

function getAudioStatus() {
    // Send the request to ProPresenter
    remoteWebSocket.send('{"action":"audioIsPlaying"}');
}

function getClocks() {
    // Send the request to ProPresenter
    remoteWebSocket.send('{"action":"clockRequest"}');
}

function getMessages() {
    // Send the request to ProPresenter
    remoteWebSocket.send('{"action":"messageRequest"}');
}

function getStageLayouts() {
    // Send the request to ProPresenter
    remoteWebSocket.send('{"action":"stageDisplaySets"}');
}

function getPresentation(location) {
    // Send the request to ProPresenter
    remoteWebSocket.send('{"action": "presentationRequest","presentationPath": "' + location + '", "presentationSlideQuality": "300"}');
}

function getLibrary() {
    // Send the request to ProPresenter
    remoteWebSocket.send('{"action":"libraryRequest"}');
    // Empty the library presentation list
    libraryPresentationList = [];
    // Empty the library items area
    $("#library-items").empty();
    // Empty the left count
    $("#left-count").empty();
    // Empty the presentations area
    $("#presentations").empty();
}

function getPlaylists() {
    // Send the request to ProPresenter
    remoteWebSocket.send('{"action":"playlistRequestAll"}');
    // Empty the playlist presentation list
    playlistPresentationList = [];
    // Empty the playlist list
    playlistList = [];
    // Empty the playlist items area
    $("#playlist-items").empty();
}

function getAudioPlaylists() {
    // Send the request to ProPresenter
    remoteWebSocket.send('{"action":"audioRequest"}');
    // Empty the audio playlist list
    audioPlaylistList = [];
    // Empty the audio items area
    $("#audio-items").empty();
    // Empty the right count
    $("#right-count").empty();
}

// End Get Data Functions


// Toggle Data Functions

function toggleRetrieveEntireLibrary(obj) {
    if (useCookies) {
        setRetrieveEntireLibraryCookie(obj.checked);
        retrieveEntireLibrary = obj.checked;
    }
}

function toggleContinuousPlaylist(obj) {
    if (useCookies) {
        setContinuousPlaylistCookie(obj.checked);
        continuousPlaylist = obj.checked;
    }
    // Empty the presentations area
    $("#presentations").empty();
}

function toggleForceSlides(obj) {
    if (useCookies) {
        setForceSlidesCookie(obj.checked);
        forceSlides = obj.checked;
    }
}

function toggleFollowProPresenter(obj) {
    if (useCookies) {
        setFollowProPresenterCookie(obj.checked);
        followProPresenter = obj.checked;
    }
}

function toggleUseCookies(obj) {
    setUseCookiesCookie(obj.checked);
    useCookies = obj.checked;
}

function toggleAudioPlayPause() {
    remoteWebSocket.send('{"action":"audioPlayPause"}');
}

function toggleTimelinePlayPause() {
    remoteWebSocket.send('{"action":"timelinePlayPause","presentationPath":""}');
}

function togglePlaylistVisibility(obj) {
    if ($(obj).hasClass("collapsed")) {
        $(obj).removeClass("collapsed");
        $(obj).children("i").removeClass("fa-caret-right");
        $(obj).children("i").addClass("fa-caret-down");
    } else {
        $(obj).addClass("collapsed");
        $(obj).children("i").removeClass("fa-caret-down");
        $(obj).children("i").addClass("fa-caret-right");
    }
}

function toggleClockVisibility(obj) {
    if ($(obj).hasClass("expanded")) {
        var index = $(obj).parent().parent().attr("id");
        $("#" + index + "-name-text").text($("#" + index + "-name").val());
        $(obj).parent().parent().addClass("collapse");
        $(obj).removeClass("expanded");
        $(obj).children("i").removeClass("fa-caret-down");
        $(obj).children("i").addClass("fa-caret-right");
    } else {
        $(obj).parent().parent().removeClass("collapse");
        $(obj).addClass("expanded");
        $(obj).children("i").removeClass("fa-caret-right");
        $(obj).children("i").addClass("fa-caret-down");
    }
}

function toggleClockState(int) {
    // If the clock is not started
    if ($("#clock-" + int + "-state").text() == "Start") {
        // Start receiving clock times from ProPresenter
        startReceivingClockData();
        // Start the clock
        remoteWebSocket.send('{"action":"clockStart","clockIndex":"' + int + '"}');
    } else {
        // Stop the clock
        remoteWebSocket.send('{"action":"clockStop","clockIndex":"' + int + '"}');
    }
}

function expandTypeList(obj) {
    // Show the dropdown
    $(obj).parent("div").children(".type-dropdown").show();
    // Create a element click handler to allow the opening of the custom dropdown
    window.addEventListener('click', function(e) {
        // If the clicked element is contained within the dropdown
        if (document.getElementById(obj.parentNode.id).contains(e.target)) {} else {
            // Hide the dropdown
            $(obj).parent("div").children(".type-dropdown").hide();
        }
    });
}

// End Toggle Data Functions


// Update Producer Functions

function updateClock(clockIndex) {
    // Get the clock name
    var clockName = document.getElementById("clock-" + clockIndex + "-name").value;
    // Get the clock type
    var clockType = document.getElementById("clock-" + clockIndex + "-type").firstElementChild.id;
    // Get the clock overrun setting
    var clockOverrun = document.getElementById("clock-" + clockIndex + "-overrun").checked;
    // Send the request according to the clock type
    if (clockType == 0) {
        // Get the clock duration / start time / count to time
        var clockDuration = document.getElementById("clock-" + clockIndex + "-duration").value;
        // Send the change to ProPresenter
        remoteWebSocket.send('{"action":"clockUpdate","clockIndex":"' + clockIndex + '","clockType":"0","clockName":"' + clockName + '","clockTime":"' + clockDuration + '","clockOverrun":"' + clockOverrun + '"}');
    } else if (clockType == 1) {
        // Get the clock count to time
        var clockTime = document.getElementById("clock-" + clockIndex + "-time").value;
        // Get the clock format
        var clockFormat = document.getElementById("clock-" + clockIndex + "-format").value;
        // Send the change to ProPresenter
        remoteWebSocket.send('{"action":"clockUpdate","clockIndex":"' + clockIndex + '","clockType":"1","clockName":"' + clockName + '","clockElapsedTime":"' + clockTime + '","clockOverrun":"' + clockOverrun + '","clockTimePeriodFormat":"' + clockFormat + '"}');
    } else {
        // Get the clock start time
        var clockStart = document.getElementById("clock-" + clockIndex + "-start").value;
        // Get the clock end time
        var clockEndTime = getClockEndTimeFormat(document.getElementById("clock-" + clockIndex + "-end").value);
        // Send the change to ProPresenter
        remoteWebSocket.send('{"action":"clockUpdate","clockIndex":"' + clockIndex + '","clockType":"2","clockName":"' + clockName + '","clockTime":"' + clockStart + '","clockOverrun":"' + clockOverrun + '","clockElapsedTime":"' + clockEndTime + '"}');
    }
}

function updateMessageClock(clockIndex) {
    // Get the clock name
    var clockName = document.getElementById("clock-" + clockIndex + "-name").value;
    // Get the clock type
    var clockType = document.getElementById("clock-" + clockIndex + "-type").firstElementChild.id;
    // Get the clock overrun setting
    var clockOverrun = document.getElementById("messageclock-" + clockIndex + "-overrun").checked;
    // Send the request according to the clock type
    if (clockType == 0) {
        // Get the clock duration / start time / count to time
        var clockDuration = document.getElementById("messageclock-" + clockIndex + "-duration").value;
        // Send the change to ProPresenter
        remoteWebSocket.send('{"action":"clockUpdate","clockIndex":"' + clockIndex + '","clockType":"0","clockName":"' + clockName + '","clockTime":"' + clockDuration + '","clockOverrun":"' + clockOverrun + '"}');
    } else if (clockType == 1) {
        // Get the clock count to time
        var clockTime = document.getElementById("messageclock-" + clockIndex + "-time").value;
        // Get the clock format
        var clockFormat = document.getElementById("messageclock-" + clockIndex + "-format").value;
        // Send the change to ProPresenter
        remoteWebSocket.send('{"action":"clockUpdate","clockIndex":"' + clockIndex + '","clockType":"1","clockName":"' + clockName + '","clockElapsedTime":"' + clockTime + '","clockOverrun":"' + clockOverrun + '","clockTimePeriodFormat":"' + clockFormat + '"}');
    } else {
        // Get the clock start time
        var clockStart = document.getElementById("messageclock-" + clockIndex + "-start").value;
        // Get the clock end time
        var clockEndTime = getClockEndTimeFormat(document.getElementById("messageclock-" + clockIndex + "-end").value);
        // Send the change to ProPresenter
        remoteWebSocket.send('{"action":"clockUpdate","clockIndex":"' + clockIndex + '","clockType":"2","clockName":"' + clockName + '","clockTime":"' + clockStart + '","clockOverrun":"' + clockOverrun + '","clockElapsedTime":"' + clockEndTime + '"}');
    }
}

function updateMessagePreview(obj) {
    // Get the message component objects
    var messageComponents = $(obj).closest(".message-attribute");
    // Get the message name
    var previewElementName = $(messageComponents).children(".attribute-name").text();
    // Get the message data
    var previewElementData = $(messageComponents).children(".attribute-data").val();
    // Check if this is a timer element
    if (previewElementData == null) {
        // Get the timer index
        var timerIndex = parseInt($(".message-timer-container").attr("id").split("-")[1]);
        // Get the timer type
        var timerType = parseInt($("#messageclock-"+timerIndex+"-type").children("a").attr("id"));
        // Get the timer data
        switch(timerType){
            case 0:
                previewElementData = document.getElementById("messageclock-"+timerIndex+"-duration").value;
                break;
            case 1:
                previewElementData = "00:00:00";
                break;
            case 2:
                previewElementData = document.getElementById("messageclock-"+timerIndex+"-start").value;
                break;
        }
    }
    // Check if the field is empty
    if (previewElementData == "") {
        // Add the name placeholder
        document.getElementById("preview."+previewElementName).innerHTML = "["+previewElementName+"]";
    } else {
        // Add the data
        document.getElementById("preview."+previewElementName).innerHTML = previewElementData;
    }
}

// End Update Producer Functions


// Page Actions Functions

function focusTimelineControls() {
    $("#audio-controls").hide();
    $("#timeline-controls").show();
    $("#control-slide").attr("src", "img/slideblue.png");
    $("#control-audio").attr("src", "img/clearaudio.png");
}

function focusAudioControls() {
    $("#timeline-controls").hide();
    $("#audio-controls").show();
    $("#control-audio").attr("src", "img/audioblue.png");
    $("#control-slide").attr("src", "img/clearslide.png");
}

function setAudioStatus(obj) {
    if (obj == "Playing") {
        $("#audio-status").removeClass("fa-play").removeClass("disabled");
        $("#audio-status").addClass("fa-pause");
        $("#clear-audio").addClass("activated");
        $("#clear-all").addClass("activated");
    } else if (obj == "Pause") {
        $("#audio-status").removeClass("fa-pause").removeClass("disabled");
        $("#audio-status").addClass("fa-play");
        $("#clear-audio").addClass("activated");
        $("#clear-all").addClass("activated");
        getAudioStatus();
    } else if (obj) {
        getCurrentAudio();
    } else {
        $("#clear-audio").removeClass("activated");
        $(".playing-audio").empty();
        $(".playing-audio").prop('title', "");
        $("#audio-status").addClass("disabled");
        $("#audio-items").children("a").children("div").removeClass("highlighted");
        if ($(".icons a.activated").not("#clear-all").length < 1) {
            $("#clear-all").removeClass("activated");
        }
    }
}

function setAudioSong(obj) {
    // Create variable to hold if audio
    var isAudio = false;
    var playlistLocation;
    var playlistItemLocation;
    // Iterate through each audio playlist
    audioPlaylistList.forEach(
        function(playlist) {
            // Iterate through each audio item
            playlist.playlist.forEach(
                function(playlistItem) {
                    // If the audio item name matches the current playing item
                    if (playlistItem.playlistItemName == obj.audioName) {
                        // Set the current playing item as audio
                        isAudio = true;
                        playlistLocation = playlist.playlistLocation;
                        playlistItemLocation = playlistItem.playlistItemLocation;
                    }
                }
            );
        }
    );

    // If this is an audio file
    if (isAudio) {
        // Set the playing audio name
        $(".playing-audio").text(obj.audioName);
        // Set the playing audio tooltip
        $(".playing-audio").prop('title', obj.audioName+" - "+obj.audioArtist);

        // Remove the disabled class from audio status
        $("#audio-status").removeClass("disabled");
        // Set clear audio to active
        $("#clear-audio").addClass("activated");
        // Set clear all to active
        $("#clear-all").addClass("activated");
        // Check if there is currently an element with selected class
        var currentlySelected = $(".item.con.aud.selected").length > 0;

        // Iterate through each audio playlist item
        $(".item.con.aud").each(
            function () {
                $(this).removeClass("selected").removeClass("highlighted");
                if ($(this).text() == obj.audioName) {
                    if (currentlySelected) {
                        $(this).addClass("selected");
                    } else {
                        $(this).addClass("highlighted");
                    }
                }
            }
        );

        // // Remove selected from audio playlists
        // $(".item.lib.playlist.audio").each(
        //     function() {
        //         if ($(this).hasClass("selected")) {
        //             $(this).removeClass("selected");
        //             $(this).addClass("highlighted");
        //         }
        //     }
        // );

        // Get the playlist object
        playlistObject = document.getElementById("ap-"+playlistLocation);
        // Get the playlist nesting structure
        nesting = playlistLocation.replace(".0","").split(".");
        // Iterate through each level
        nesting.forEach(
            function (value, index) {
                // Set the initial level
                var playlistLevel = value;
                // If this is a lower level
                if (index > 0) {
                    // Add the previous levels
                    for (let i = 0; i < index; i++) {
                        playlistLevel += "."+nesting[i];
                    }
                }
                var expander = document.getElementById("ap-expander-"+playlistLevel);
                // Set the playlist group to expanded
                $(expander).removeClass("collapsed").addClass("expanded");
                $(expander).children("i").removeClass("fa-caret-right");
                $(expander).children("i").addClass("fa-caret-down");
            }

        );

        $(playlistObject).addClass("selected");
        $(playlistObject).addClass("highlighted");
        
        // Display the playlist
        displayAudioPlaylist($(playlistObject).parent().parent());
        // Add highlighted to playlist
        $(playlistObject).parent().addClass("highlighted");

        $(".item.con.aud").each(
            function() {
                if ($(this).attr("id") == playlistItemLocation) {
                    $(this).addClass("selected");
                }
            }
        );

    } else {
        // Set the playing timeline title
        $(".playing-timeline").text(obj.audioName);
        // Set clear media to active
        $("#clear-media").addClass("activated");
        // Set clear all to active
        $("#clear-all").addClass("activated");
    }
}

function showMessage(obj) {
    var messageIndex = parseInt($("#message-content").attr("data-message-index"));
    var messageKeys = [];
    var messageValues = [];
    // Get the message component objects
    var messageComponents = $(".message-attribute");
    // Iterate through all message component objects
    $(messageComponents).each(
        function () {
            var previewElementName = $(this).children(".attribute-name").text();
            var previewElementData = $(this).children(".attribute-data").val();
            // Check if this is a timer element
            if (previewElementData == null) {
                // Get the timer index
                var timerIndex = parseInt($(".message-timer-container").attr("id").split("-")[1]);
                // Get the timer type
                var timerType = parseInt($("#messageclock-"+timerIndex+"-type").children("a").attr("id"));
                // Get the timer data
                switch(timerType){
                    case 0:
                        previewElementData = document.getElementById("messageclock-"+timerIndex+"-duration").value;
                        break;
                    case 1:
                        previewElementData = "00:00:00";
                        break;
                    case 2:
                        previewElementData = document.getElementById("messageclock-"+timerIndex+"-start").value;
                        break;
                }
            }
            // Add the data to the array
            messageKeys.push(previewElementName);
            messageValues.push(previewElementData);
        }
    );
    // Send the request to ProPresenter
    remoteWebSocket.send('{"action":"messageSend","messageIndex":'+messageIndex+',"messageKeys":'+JSON.stringify(messageKeys)+',"messageValues":'+JSON.stringify(messageValues)+'}');
    // Set clear messages to active
    $("#clear-messages").addClass("activated");
    // Set clear all to active
    $("#clear-all").addClass("activated");
    // Show the timer controls area
    $(".message-timer-controls").show();
}

function hideMessage(obj) {
    var messageIndex = $(obj).parent().attr("id").split(".")[1];
    // Set the request to ProPresenter
    remoteWebSocket.send('{"action":"messageHide","messageIndex",'+messageIndex+'}');
}

function clearStageMessage() {
    document.getElementById("stage-message").value = "";
    remoteWebSocket.send('{"action":"stageDisplayHideMessage"}');
}

function hideStageMessage() {
    remoteWebSocket.send('{"action":"stageDisplayHideMessage"}');
}

function showStageMessage() {
    var message = document.getElementById("stage-message").value;
    remoteWebSocket.send('{"action":"stageDisplaySendMessage","stageDisplayMessage":"' + message + '"}');
}

function setStageLayout(obj) {
    // Send the change stage layout request to ProPresenter
    remoteWebSocket.send('{"action":"stageDisplayChangeLayout","stageLayoutUUID":"' + $(obj).val() + '","stageScreenUUID":"' + $(obj).attr("id") + '"}');
}

function deselectItems() {
    // Remove selected from any other playlist item in both presentations and audio
    $(".item.con").each(
        function() {
            if ($(this).hasClass("selected")) {
                $(this).removeClass("selected");
                $(this).addClass("highlighted");
            }
        }
    );
}

function stopAllClocks() {
    // Stop receiving clock times from ProPresenter
    stopReceivingClockData();
    // Send the stop all clocks command
    remoteWebSocket.send('{"action":"clockStopAll"}');
}

function resetAllClocks() {
    // Start receiving clock times from ProPresenter
    startReceivingClockData();
    // Send the reset all clocks command
    remoteWebSocket.send('{"action":"clockResetAll"}');
}

function startAllClocks() {
    // Start receiving clock times from ProPresenter
    startReceivingClockData();
    // Send the start all clocks command
    remoteWebSocket.send('{"action":"clockStartAll"}');
}


// DELETE!!!
function startReceivingClockData() {
    // Send the start receiving clock times command
    remoteWebSocket.send('{"action":"clockStartSendingCurrentTime"}');
}

function stopReceivingClockData() {
    // Send the stop receiving clock times command
    remoteWebSocket.send('{"action":"clockStopSendingCurrentTime"}');
}

function setMessagesClockFormat(obj) {
    document.getElementById("clock-" + obj.clockIndex + "-format").value = obj.clockFormat.clockTimePeriodFormat;
}

function setMessagesClockEndTime(obj) {
    document.getElementById("clock-" + obj.clockIndex + "-time").value = getClockSmallFormat(obj.clockEndTime);
    document.getElementById("clock-" + obj.clockIndex + "-end").value = getClockEndTimeFormat(obj.clockEndTime);
}

function setMessagesClockOverrun(obj) {
    document.getElementById("clock-" + obj.clockIndex + "-overrun").checked = obj.clockOverrun;
}

function setMessagesClockTimes(obj) {
    obj.clockTimes.forEach(
        function(item, index) {
            document.getElementById("clock-" + index + "-currentTime").innerHTML = getClockSmallFormat(item);
        }
    );
}

function setMessagesClockState(obj) {
    document.getElementById("clock-" + obj.clockIndex + "-currentTime").innerHTML = getClockSmallFormat(obj.clockTime);
    if (obj.clockState == true) {
        document.getElementById("clock-" + obj.clockIndex + "-state").innerHTML = "Stop";
    } else {
        document.getElementById("clock-" + obj.clockIndex + "-state").innerHTML = "Start";
    }
}
// DELETE!!!


function resetClock(index) {
    // Start receiving clock times from ProPresenter
    startReceivingClockData();
    // Send the reset clock command
    remoteWebSocket.send('{"action":"clockReset","clockIndex":"' + index + '"}');
}

function setClockName(obj) {
    // Set the clock name in the input
    document.getElementById("clock-" + obj.clockIndex + "-name").value = obj.clockName;
    // Set the clock name in the div
    document.getElementById("clock-" + obj.clockIndex + "-name-text").innerHTML = obj.clockName;
}

function setClockType(obj) {
    // Array of supported clock types
    var types = ["type-0", "type-1", "type-2"];
    // Get the clock type
    var type = $(obj).children("div").attr("id");
    // Get the clock index
    var clockIndex = $(obj).parent().parent().attr("id").split("-")[1];
    // Remove the selected class from all rows of the current dropdown
    $(obj).parent().children("a").children(".dropdown-row").removeClass("selected");
    // Set the current element as selected
    $(obj).children("div").addClass("selected");
    // Set the parent div ID to the type
    $("#clock-"+clockIndex+"-type").children("a").attr("id", type.split("-")[1]);
    // Check if a message clock exists with this id
    if ($("#messageclock-"+clockIndex+"-type") != null) {
        // Set the parent div ID to the type
        $("#messageclock-"+clockIndex+"-type").children("a").attr("id", type.split("-")[1]);
        // Update the message preview
        updateMessagePreview($("#messageclock-"+clockIndex));
    }
    // Show options specific to the clock type
    $(obj).parent().parent().parent().removeClass(types).addClass(type);
    // Hide all open dropdowns
    $(".type-dropdown").hide();
    // Send the updated type to ProPresenter
    updateClock(clockIndex);
}

function setClockTypePP(obj) {
    // Array of supported clock types
    var types = ["type-0", "type-1", "type-2"];
    // Remove all clock types
    $("#clock-" + obj.clockIndex).removeClass(types);
    // Add the clock type
    $("#clock-" + obj.clockIndex).addClass("type-" + obj.clockType);
}

function setClockFormat(obj) {
    document.getElementById("clock-" + obj.clockIndex + "-format").value = obj.clockFormat.clockTimePeriodFormat;
}

function setClockDuration(obj) {
    document.getElementById("clock-" + obj.clockIndex + "-duration").value = getClockSmallFormat(obj.clockDuration);
    document.getElementById("clock-" + obj.clockIndex + "-start").value = getClockSmallFormat(obj.clockDuration);
}

function setClockEndTime(obj) {
    document.getElementById("clock-" + obj.clockIndex + "-time").value = getClockSmallFormat(obj.clockEndTime);
    document.getElementById("clock-" + obj.clockIndex + "-end").value = getClockEndTimeFormat(obj.clockEndTime);
}

function setClockOverrun(obj) {
    document.getElementById("clock-" + obj.clockIndex + "-overrun").checked = obj.clockOverrun;
}

function setClockTimes(obj) {
    obj.clockTimes.forEach(
        function(item, index) {
            document.getElementById("clock-" + index + "-currentTime").innerHTML = getClockSmallFormat(item);
            if (document.getElementById("messageclock-" + index + "-currentTime") != null) {
                document.getElementById("messageclock-" + index + "-currentTime").innerHTML = getClockSmallFormat(item);
            }
        }
    );
}

function setClockState(obj) {
    document.getElementById("clock-" + obj.clockIndex + "-currentTime").innerHTML = getClockSmallFormat(obj.clockTime);
    if (obj.clockState == true) {
        document.getElementById("clock-" + obj.clockIndex + "-state").innerHTML = "Stop";
    } else {
        document.getElementById("clock-" + obj.clockIndex + "-state").innerHTML = "Start";
    }
}

function triggerSlide(obj) {
    // Get the slide location
    var location = ($(obj).attr("id"));
    // Get the slide index
    var index = $(obj).children("div").children("div").children(".slide-number").text() - 1;
    // Check if this is a playlist or library presentation
    if (location.charAt(0) == '0') {
        // Sent the request to ProPresenter
        remoteWebSocket.send('{"action":"presentationTriggerIndex","slideIndex":"' + index + '","presentationPath":"' + location + '"}');
        // Check if we should follow ProPresenter
        if (followProPresenter) {
            // Remove selected from all playlist items
            $("#playlist-items").children("a").children("div").removeClass("selected");
            // Remove highlighted from all playlist items
            $("#playlist-items").children("a").children("div").removeClass("highlighted");
        }
    } else {
        // Sent the request to ProPresenter
        remoteWebSocket.send('{"action":"presentationTriggerIndex","slideIndex":"' + index + '","presentationPath":"' + location.replace(/\//g, "\\/") + '"}');
        // Check if we should follow ProPresenter
        if (followProPresenter) {
            // Remove selected from all library items
            $("#library-items").children("a").children("div").removeClass("selected");
            // Remove highlighted from all library items
            $("#library-items").children("a").children("div").removeClass("highlighted");
        }
    }

    // Check if we should follow ProPresenter
    if (followProPresenter) {
        // Iterate through each item in the library / playlist area
        $(".item.con.pres").each(
            function() {
                // If the current item matches the slide presentation location
                if ($(this).attr("id") == location) {
                    // Highlight the current item
                    $(this).addClass("highlighted");
                }
            }
        );
    }

    // Check if this is a media item
    if ($(obj).children("div").hasClass("media")) {
        // Remove selected from any previous slides
        $(".slide-container").removeClass("selected");
        // Remove previously selected from any previous slides
        $(".slide-container").removeClass("previous-selection");
        // Remove active from any previous media
        $(".media").removeClass("active");
        // Set clear slide to inactive
        $("#clear-slide").removeClass("activated");
        // If this is a video media object
        if ($(obj).children("div").hasClass("video")) {
            // Set clear media to active
            $("#clear-media").addClass("activated");
        } else {
            // Set clear audio to active
            $("#clear-audio").addClass("activated");
        }
        // Empty the live preview area
        $('#live').empty();
        // Get preview image src
        var previewImage = $(obj).parent().children(".media-image").children("img");
        // Set live preview image if available
        if (previewImage.length > 0) {
            $('#live').append('<img src="'+$(previewImage).attr("src")+'"/>');
        }
        // Set the media element as active
        $(obj).children("div").addClass("active");
    }

    // Set clear all to active
    $("#clear-all").addClass("activated");
}

// Force Previous Slide
function triggerPreviousSlide() {
    // Get the current slide
    var currentSlide = $(".slide-container.selected");
    // Get the current media
    var currentMedia = $(".media.active");
    // Check if the currently selected item is a presentation or media item
    if (currentSlide.length > 0) {
        // Get the current location
        var currentLocation = $(".slide-container.selected").children("a").attr("id");
        // Get the current slide number
        var currentSlideNumber = parseInt($(currentSlide).find(".slide-number").text());
        // Create variable to determine loop status
        var loop = true;
        // Loop until a slide is found or the slides are exhausted
        while (loop) {
            // If the current slide is at least the first
            if (currentSlideNumber > 1) {
                // Decrease the slide number
                currentSlideNumber--;
                // Create the next slide id
                var nextSlideId = "slide" + currentSlideNumber + "." + currentLocation;
                // If the next slide is not disabled
                if (!$(document.getElementById(nextSlideId)).hasClass("disabled")) {
                    // Trigger the next slide
                    triggerSlide($(document.getElementById(nextSlideId)).children("a"));
                    // Stop the loop
                    loop = false;
                }
            } else {
                // Get the current presentation
                var currentPresentation = $(".slide-container.selected").parent("div").parent("div");
                // Get the current presentation location
                var currentPresentationLocation = $(currentPresentation).attr("id");
                // Get the current presentation number
                var currentPresentationNumber = parseInt(currentPresentationLocation.split(":")[1]);
                // Create variable to determine loop status
                var presentationLoop = true;
                // Loop until a presentation is found or the presentations are exhausted
                while (presentationLoop) {
                    // If the current presentation is at least the first
                    if (currentPresentationNumber > 1) {
                        // Decrease the presentation number
                        currentPresentationNumber--;
                        // Create the next presentation id
                        var nextPresentationId = currentPresentationLocation.split(":")[0] + ":" + currentPresentationNumber;
                        // Get the next presentation
                        var nextPresentation = document.getElementById(nextPresentationId);
                        // If the next presentation exists
                        if (nextPresentation != null) {
                            // Trigger the first available slide of the next presentation
                            triggerSlide($(nextPresentation).children(".presentation-content").children('div:not(.disabled):first').children("a"));
                            // Stop the loop
                            presentationLoop = false;
                        }
                    } else {
                        // Stop the loop
                        presentationLoop = false;
                    }
                }
                // Stop the loop
                loop = false;
            }
        }
    } else if (currentMedia.length > 0) {
        // Get the current presentation
        var currentPresentation = $(".media.active").parent("a").parent("div").parent("div").parent("div");
        // Get the current presentation location
        var currentPresentationLocation = $(currentPresentation).attr("id");
        // Get the current presentation number
        var currentPresentationNumber = parseInt(currentPresentationLocation.split(":")[1]);
        // Create variable to determine loop status
        var presentationLoop = true;
        // Loop until a presentation is found or the presentations are exhausted
        while (presentationLoop) {
            // If the current presentation is at least the first
            if (currentPresentationNumber > 1) {
                // Decrease the presentation number
                currentPresentationNumber--;
                // Create the next presentation id
                var nextPresentationId = currentPresentationLocation.split(":")[0] + ":" + currentPresentationNumber;
                // Get the next presentation
                var nextPresentation = document.getElementById(nextPresentationId);
                // If the next presentation exists
                if (nextPresentation != null) {
                    // Trigger the first available slide of the next presentation
                    triggerSlide($(nextPresentation).children(".presentation-content").children('div:not(.disabled):first').children("a"));
                    // Stop the loop
                    presentationLoop = false;
                }
            } else {
                // Stop the loop
                presentationLoop = false;
            }
        }
    }
}

// Force Next Slide
function triggerNextSlide() {
    // Get the current slide
    var currentSlide = $(".slide-container.selected");
    // Get the current media
    var currentMedia = $(".media.active");
    // Check if the currently selected item is a presentation or media item
    if (currentSlide.length > 0) {
        // Get the current location
        var currentLocation = $(currentSlide).children("a").attr("id");
        // Get the current slide number
        var currentSlideNumber = parseInt($(currentSlide).find(".slide-number").text());
        console.log(currentSlideNumber);
        // Get the total slide count
        var totalSlideCount = parseInt($(document.getElementById("presentation."+currentLocation)).children("div.presentation-content").children("div").length);
        console.log();

        // Check if this is a playlist or library presentation
        if (currentLocation.charAt(0) == '0') {
            var nextPresentation;
                // Create variable to determine loop status
            var loop = true;
            // Loop until a slide is found or the slides are exhausted
            while (loop) {
                // If the current slide is at least the first, but is not the last
                if (currentSlideNumber > 0 && currentSlideNumber < totalSlideCount) {
                    // Increase the slide number
                    currentSlideNumber++;
                    // Create the next slide id
                    var nextSlideId = "slide" + currentSlideNumber + "." + currentLocation;
                    // If the next slide is not disabled
                    if (!$(document.getElementById(nextSlideId)).hasClass("disabled")) {
                        // Trigger the next slide
                        triggerSlide($(document.getElementById(nextSlideId)).children("a"));
                        // Stop the loop
                        loop = false;
                    }
                } else {
                    // Get the current presentation
                    var currentPresentation = $(".slide-container.selected").parent("div").parent("div");
                    // Get the current presentation location
                    var currentPresentationLocation = $(currentPresentation).attr("id");
                    // Get the current presentation number
                    var currentPresentationNumber = parseInt(currentPresentationLocation.split(":")[1]);
                    // Get the total presentation count
                    var totalPresentationCount = parseInt($(currentPresentation).parent("div").children("div").length);
                    // Create variable to determine loop status
                    var presentationLoop = true;
                    // Loop until a presentation is found or the presentations are exhausted
                    while (presentationLoop) {
                        // If the current presentation is at least the first, but is not the last
                        if (currentPresentationNumber > 0 && currentPresentationNumber < totalPresentationCount) {
                            // Increase the presentation number
                            currentPresentationNumber++;
                            // Create the next presentation id
                            var nextPresentationId = currentPresentationLocation.split(":")[0] + ":" + currentPresentationNumber;
                            // Get the next presentation
                            var nextPresentation = document.getElementById(nextPresentationId);
                            // If the next presentation exists
                            if (nextPresentation != null) {
                                // Trigger the first available slide of the next presentation
                                triggerSlide($(nextPresentation).children(".presentation-content").children('div:not(.disabled):first').children("a"));
                                // Stop the loop
                                presentationLoop = false;
                            }
                        } else {
                            // Stop the loop
                            presentationLoop = false;
                        }
                    }
                    // Stop the loop
                    loop = false
                }
            }
        } else {
            // Create variable to determine loop status
            var loop = true;
            // Loop until a slide is found or the slides are exhausted
            while (loop) {
                // If the current slide is at least the first, but is not the last
                if (currentSlideNumber > 0 && currentSlideNumber < totalSlideCount) {
                    // Increase the slide number
                    currentSlideNumber++;
                    // Create the next slide id
                    var nextSlideId = "slide" + currentSlideNumber + "." + currentLocation;
                    // If the next slide is not disabled
                    if (!$(document.getElementById(nextSlideId)).hasClass("disabled")) {
                        // Trigger the next slide
                        triggerSlide($(document.getElementById(nextSlideId)).children("a"));
                        // Stop the loop
                        loop = false;
                    }
                } else {
                    // Stop the loop
                    loop = false;
                }
            }
        }
    } else if (currentMedia.length > 0) {
        // Get the current presentation
        var currentPresentation = $(".media.active").parent("a").parent("div").parent("div").parent("div");
        // Get the current presentation location
        var currentPresentationLocation = $(currentPresentation).attr("id");
        // Get the current presentation number
        var currentPresentationNumber = parseInt(currentPresentationLocation.split(":")[1]);
        // Get the total presentation count
        var totalPresentationCount = parseInt($(currentPresentation).parent("div").children("div").length);
            // Create variable to determine loop status
        var presentationLoop = true;
        // Loop until a presentation is found or the presentations are exhausted
        while (presentationLoop) {
            // If the current presentation is at least the first, but is not the last
            if (currentPresentationNumber > 0 && currentPresentationNumber < totalPresentationCount) {
                // Increase the presentation number
                currentPresentationNumber++;
                // Create the next presentation id
                var nextPresentationId = currentPresentationLocation.split(":")[0] + ":" + currentPresentationNumber;
                // Get the next presentation
                var nextPresentation = document.getElementById(nextPresentationId);
                // If the next presentation exists
                if (nextPresentation != null) {
                    // Trigger the first available slide of the next presentation
                    triggerSlide($(nextPresentation).children(".presentation-content").children('div:not(.disabled):first').children("a"));
                    // Stop the loop
                    presentationLoop = false;
                }
            } else {
                // Stop the loop
                presentationLoop = false;
            }
        }
    }
}

// Start Audio File Playback
function triggerAudio(obj) {
    // Get audio playlist item
    var location = ($(obj).children("div").attr("id"));
    // Get audio playlist location
    var playlistLocation = location.split(":")[0];
    // If this is a playlist item
    if (location.charAt(0) == '0') {
        // Start playing the audio playlist item
        remoteWebSocket.send('{"action":"audioStartCue","audioChildPath":"' + location + '"}');
        // Remove selected from audio playlist items
        $("#audio-items").children("a").children("div").removeClass("selected");
        // Remove highlighted from audio playlist items
        $("#audio-items").children("a").children("div").removeClass("highlighted");

        
    }

    // Deselect all items across page and replace with highlighted if needed
    deselectItems();

    // Remove selected from audio playlists
    $(".item.lib.playlist.audio").each(
        function() {
            if ($(this).hasClass("selected")) {
                $(this).removeClass("selected");
                $(this).addClass("highlighted");
            }
        }
    );
}

// End Page Actions Functions


// Page Display Functions

function displayTimerOptions() {
    if ($("#timerOptions:visible").length == 0) {
        $("#messageOptions").hide();
        $("#stageOptions").hide();
        $("#settings").hide();
        $("#timerOptions").show();
    } else {
        $("#messageOptions").hide();
        $("#stageOptions").hide();
        $("#settings").hide();
        $("#timerOptions").hide();
    }
}

function displayMessageOptions() {
    if ($("#messageOptions:visible").length == 0) {
        $("#timerOptions").hide();
        $("#stageOptions").hide();
        $("#settings").hide();
        $("#messageOptions").show();
    } else {
        $("#timerOptions").hide();
        $("#stageOptions").hide();
        $("#settings").hide();
        $("#messageOptions").hide();
    }
}

function displayStageOptions() {
    if ($("#stageOptions:visible").length == 0) {
        $("#timerOptions").hide();
        $("#messageOptions").hide();
        $("#settings").hide();
        $("#stageOptions").show();
    } else {
        $("#timerOptions").hide();
        $("#messageOptions").hide();
        $("#settings").hide();
        $("#stageOptions").hide();
    }
}

function displaySettings() {
    if ($("#settings:visible").length == 0) {
        $("#timerOptions").hide();
        $("#messageOptions").hide();
        $("#stageOptions").hide();
        $("#settings").show();
    } else {
        $("#timerOptions").hide();
        $("#messageOptions").hide();
        $("#stageOptions").hide();
        $("#settings").hide();
    }
}

function displayMessage(obj) {
    // Remove selected and highlighted classes
    $(".message-info").removeClass("selected").removeClass("highlighted");
    // Add the selected class
    $(obj).parent("div").addClass("selected");
    // Get the message index
    var messageIndex = $(obj).parent().attr("id").split(".")[1];
    // Get the message components
    var messageComponentData = createMessageComponents(messageIndex);
    // Empty the message component area
    $("#message-content").empty();
    // Add the data to the message component area
    $("#message-content").append(messageComponentData);
    // Add the message index data
    $("#message-content").attr("data-message-index", messageIndex);
}

function displayLibrary(obj) {
    // Get the current library name
    var current = $(obj).children("div").children(".name").text();
    // Create variable to hold library items
    data = "";
    // Reset the item count
    $("#left-count").empty();
    // If set to only get names from ProPresenter libraries
    if (!retrieveEntireLibrary) {
        // Set the library item count
        if (libraryPresentationNameList.length == 1) {
            $("#left-count").append(libraryPresentationNameList.length + " Item");
        } else {
            $("#left-count").append(libraryPresentationNameList.length + " Items");
        }
        // Sort the presentations in the library by name
        libraryPresentationNameList.sort(SortPresentationByName);
        // For each Presentation Name in the array
        libraryPresentationNameList.forEach(function(item) {
            // Variable to hold the split string of the presentation path
            var pathSplit = item.presentationPath.split("/");
            // Iterate through each item in the split path to retrieve the library name
            pathSplit.forEach(function(element, index) {
                if (element == "Libraries") {
                    // If this presentation is from this library, add the data
                    if (pathSplit[index + 1] == current) {
                        data += '<a onclick="displayPresentation(this);"><div id="' + item.presentationPath + '" class="item con pres"><img src="img/presentation.png" /><div class="name">' + item.presentationName + '</div></div></a>';
                    }
                }
            });
        });
    } else {
        // Set the library item count
        if (libraryPresentationList.length == 1) {
            $("#left-count").append(libraryPresentationList.length + " Item");
        } else {
            $("#left-count").append(libraryPresentationList.length + " Items");
        }
        // Sort the presentations in the library by name
        libraryPresentationList.sort(SortPresentationByName);
        // For each Presentation in the array
        libraryPresentationList.forEach(function(item) {
            // Variable to hold the split string of the presentation path
            var pathSplit = item.presentationPath.split("/");
            // Iterate through each item in the split path to retrieve the library name
            pathSplit.forEach(function(element, index) {
                if (element == "Libraries") {
                    // If this presentation is from this library, add the data
                    if (pathSplit[index + 1] == current) {
                        data += '<a onclick="displayPresentation(this);"><div id="' + item.presentationPath + '" class="item con pres"><img src="img/presentation.png" /><div class="name">' + item.presentation.presentationName + '</div></div></a>';
                    }
                }
            });
        });
    }
    // Empty the library items area
    $("#library-items").empty();
    // Add the data to the library items area
    $("#library-items").append(data);
    // Show the library items area
    $("#playlist-items").hide();
    $("#library-items").show();
    // Remove selected and highlighted from libraries
    $(obj).parent().children("a").children("div").removeClass("selected");
    $(obj).parent().children("a").children("div").removeClass("highlighted");
    // Remove selected and highlighted from playlists
    $(".playlists div").removeClass("selected");
    $(".playlists div").removeClass("highlighted");
    // Set the library as selected
    $(obj).children("div").addClass("selected");
}

function displayPlaylist(obj) {
    // Get the current playlist name
    var current = $(obj).children("div").children(".name").text();
    // Create variable to hold playlist items
    data = "";
    // Sort presentations in the playlist presentation list
    playlistPresentationList.sort(SortPresentationByPath);
    // Find the playlist in the array
    $(playlistList).each(
        function() {
            if (this.playlistName == current) {
                // Reset the item count
                $("#left-count").empty();
                // Get the new item count
                if (this.playlist.length == 1) {
                    $("#left-count").append((this.playlist).length + " Item");
                } else {
                    $("#left-count").append((this.playlist).length + " Items");
                }
                // Add the presentations in the playlist
                $(this.playlist).each(
                    function() {
                        // Create a variable to store the playlist item location
                        var playlistItemLocation = this.playlistItemLocation;
                        // Create a variable to store the playlist item name
                        var playlistItemName = this.playlistItemName;
                        // Find the playlist item type
                        if (this.playlistItemType == "playlistItemTypeHeader") {
                            data += '<a onclick="displayPresentation(this);"><div id="' + this.playlistItemLocation + '" class="item head"><div class="name">' + this.playlistItemName + '</div></div></a>';
                        } else if (this.playlistItemType == "playlistItemTypeVideo") {
                            data += '<a onclick="displayPresentation(this);"><div id="' + this.playlistItemLocation + '" class="item con pres"><img src="img/media.png" /><div class="name">' + this.playlistItemName + '</div></div></a>';
                        } else if (this.playlistItemType == "playlistItemTypeAudio") {
                            data += '<a onclick="displayPresentation(this);"><div id="' + this.playlistItemLocation + '" class="item con pres"><img src="img/clearaudio.png" /><div class="name">' + this.playlistItemName + '</div></div></a>';
                        } else if (this.playlistItemType == "playlistItemTypePresentation") {
                            // For each presentation in the playlist presentation array
                            $(playlistPresentationList).each(
                                function() {
                                    // If the presentation path matches the playlist item location
                                    if (this.presentationPath == playlistItemLocation) {
                                        // If the presentation destination is main output
                                        if (this.presentation.presentationDestination != 1) {
                                            data += '<a onclick="displayPresentation(this);"><div id="' + playlistItemLocation + '" class="item con pres"><img src="img/presentation.png" /><div class="name">' + playlistItemName + '</div></div></a>';
                                        } 
                                        // The presentation destination must be announcements layer
                                        else {
                                            data += '<a onclick="displayPresentation(this);"><div id="' + playlistItemLocation + '" class="item con pres"><img src="img/presentation.png" /><div class="name">' + playlistItemName + '</div>'+getPresentationDestination(1)+'</div></a>';
                                        }
                                    }
                                }
                            );
                        }
                    }
                );
            }
        }
    );
    // Empty the content area
    $("#playlist-items").empty();
    // Add the content to the content area
    $("#playlist-items").append(data);

    // Hide the library items and show the playlist items
    $("#library-items").hide();
    $("#playlist-items").show();

    // Remove selected and highlighted from playlists
    $(".playlists div.playlist").removeClass("selected");
    $(".playlists div.playlist").removeClass("highlighted");
    // Remove selected and highlighted from libraries
    $(".libraries div").removeClass("selected");
    $(".libraries div").removeClass("highlighted");
    // Set the playlist as selected
    $(obj).children("div").addClass("selected");
}

function displayAudioPlaylist(obj) {
    // Get the current playlist name
    var current = $(obj).children("div").children(".name").text();
    // Create variable to hold playlist items
    data = "";
    // Reset the item count
    $("#right-count").empty();
    // Find the playlist in the array
    audioPlaylistList.forEach(
        function(currentPlaylist) {
            if (currentPlaylist.playlistName == current) {
                // Get the new item count
                if (currentPlaylist.playlist.length == 1) {
                    $("#right-count").append((currentPlaylist.playlist).length + " Item");
                } else {
                    $("#right-count").append((currentPlaylist.playlist).length + " Items");
                }
                // Add the presentations in the playlist
                currentPlaylist.playlist.forEach(
                    function(playlistItem) {
                        data += '<a onclick="triggerAudio(this);"><div id="' + playlistItem.playlistItemLocation + '" class="item con aud"><img src="img/clearaudio.png" /><div class="name">' + playlistItem.playlistItemName + '</div></div></a>';
                    }
                );
            }
        }
    );
    // Empty the content area
    $("#audio-items").empty();
    // Add the content to the content area
    $("#audio-items").append(data);

    // Deselect all items across page and replace with highlighted if needed
    deselectItems();

    // Remove selected and highlighted from playlists
    $(".playlist.audio").removeClass("selected");
    $(".playlist.audio").removeClass("highlighted");
    // Set the playlist as selected
    $(obj).children("div").addClass("selected");
}

function displayPresentation(obj) {
    // Create variable to hold presentation data
    var data = [];
    // Create object from the parameter
    var thisObject = obj;
    // Create the location variable
    var location = "";
    // Create the slide index variable
    var slideIndex = "";
    // Create a variable to hold if presentation request was ProPresenter initiated
    var propresenterRequest = false;
    // Check if item is a header
    header = $(obj).children("div").hasClass("head");
    // Get the current presentation location from the ID
    location = $(obj).children("div").attr("id");
    // Check the request origin
    if ($(obj).attr("onclick") == null) {
        // Set presentation request to propresenter
        propresenterRequest = true;
        if (obj.action == "presentationSlideIndex") {
            // Use the initial presentation location
            location = initialPresentationLocation;
            // Use the provided slide index
            slideIndex = parseInt(obj.slideIndex);
        } else if (obj.action == "presentationTriggerIndex") {
            // Use the presentationPath as the location
            location = obj.presentationPath;
            // Use the provided slide index
            slideIndex = obj.slideIndex;
        }
    }
    // Remove selected and highlighted from libraries and playlists
    $(".libraries").children("div").children("div").children("a").children("div").removeClass("selected").removeClass("highlighted");
    $(".playlists").children("div").children("div").children("a").children("div").removeClass("selected").removeClass("highlighted");
    // Remove selected and highlighted from libary and playlist items
    $("#library-items").children("a").children("div").removeClass("selected").removeClass("highlighted");
    $("#playlist-items").children("a").children("div").removeClass("selected").removeClass("highlighted");

    // Deselect all items across page and replace with highlighted if needed
    deselectItems();

    // Check if we should follow ProPresenter
    if (followProPresenter) {
        // Check if a previous presentation request exists
        if (!previousPresentationRequest) {
            // Set a previous presentation request
            previousPresentationRequest = true;
            // Check if the presentation is a playlist or a library presentation
            if (location.charAt(0) == '0') {
                // Create a variable to hold the playlist location
                var playlistLocation = "";
                // Create a variable to hold the playlist length
                var playlistLength = "";
                // Iterate through each playlist in the array
                playlistList.forEach(
                    function(currentPlaylist) {
                        // Iterate through each element in the playlist
                        currentPlaylist.playlist.forEach(
                            function(playlistItem) {
                                if (playlistItem.playlistItemLocation == location) {
                                    // Set the playlist location
                                    playlistLocation = currentPlaylist.playlistLocation;
                                    // Set the playlist length
                                    playlistLength = currentPlaylist.playlist.length;
                                    // Get the playlist object
                                    playlistObject = document.getElementById("pp-"+playlistLocation);
                                    // Get the playlist nesting structure
                                    nesting = playlistLocation.replace(".0","").split(".");
                                    // Iterate through each level
                                    nesting.forEach(
                                        function (value, index) {
                                            // Set the initial level
                                            var playlistLevel = value;
                                            // If this is a lower level
                                            if (index > 0) {
                                                // Add the previous levels
                                                for (let i = 0; i < index; i++) {
                                                    playlistLevel += "."+nesting[i];
                                                }
                                            }
                                            var expander = document.getElementById("pp-expander-"+playlistLevel);
                                            // Set the playlist group to expanded
                                            $(expander).removeClass("collapsed").addClass("expanded");
                                            $(expander).children("i").removeClass("fa-caret-right");
                                            $(expander).children("i").addClass("fa-caret-down");
                                        }

                                    );
                                    // Display the playlist
                                    displayPlaylist($(playlistObject).parent().parent());
                                    // Add highlighted to playlist
                                    $(playlistObject).parent().addClass("highlighted");
                                }
                            }
                        );
                    }
                );

                // If continuous playlists are enabled
                if (continuousPlaylist) {

                    // For each Presentation in the playlist presentation array
                    $(playlistPresentationList).each(
                        function() {

                            // If the presentation path matches the path of the selected presentation, set it as highlighted
                            if (this.presentationPath == location) {
                                // Iterate through each playlist item
                                $("#playlist-items").children("a").each(
                                    function() {
                                        // If this presentation path matches the selected presentation's presentation path
                                        if ($(this).children("div").attr("id") == location) {
                                            if (propresenterRequest && obj.slideIndex.toString() != "") {
                                                // Set the presentation as highlighted
                                                $(this).children("div").addClass("highlighted");
                                            } else {
                                                // Set the presentation as selected
                                                $(this).children("div").addClass("selected");
                                            }
                                        }
                                    }
                                );
                            }

                            // If this presentation is part of the selected presentation's playlist
                            if (this.presentationPath.split(":")[0] == playlistLocation) {
                                // Get the presentation path
                                var presentationPath = this.presentationPath;

                                // If the presentation is not already displayed
                                if (document.getElementById("presentation." + presentationPath) == null) {
                                    // Get the index of the presentation in the playlist
                                    var presentationIndex = parseInt(this.presentationPath.split(":")[1]);
                                    // Create the presentation container in the presentation data
                                    var presentationData = '<div id="presentation.' + presentationPath + '" class="presentation">' +
                                        '<div class="presentation-header padded">' + this.presentation.presentationName + '<div class="presentation-controls">'+getPresentationDestination(this.presentation.presentationDestination)+'</div></div>' +
                                        '<div class="presentation-content padded">';
                                    // Generate & add the slides to the presentation data
                                    presentationData += generateSlides(this.presentation.presentationSlideGroups, presentationPath);
                                    // Add the close tags to the presentation data
                                    presentationData += '</div></div>';
                                    // Add the presentation data to the array
                                    data.push({ presentationIndex: presentationIndex, presentationData: presentationData });
                                }
                            }

                        }
                    );

                    // Iterate through each header in the playlist header list
                    $(playlistHeaderList).each(
                        function() {
                            // If the presentation path matches the path of the selected presentation, set it as highlighted
                            if (this.presentationPath == location) {
                                // Iterate through each playlist item
                                $("#playlist-items").children("a").each(
                                    function() {
                                        // If this presentation path matches the selected presentation's presentation path
                                        if ($(this).children("div").attr("id") == location) {
                                            // Set the presentation as selected
                                            $(this).children("div").addClass("selected");
                                        }
                                    }
                                );
                            }
                            // If this header is part of the selected presentation's playlist
                            if (this.presentationPath.split(":")[0] == playlistLocation) {
                                // Get the header path
                                var headerPath = this.presentationPath;
                                // If the header is not already displayed
                                if (document.getElementById("header." + headerPath) == null) {
                                    // Get the index of the header in the playlist
                                    var headerIndex = parseInt(this.presentationPath.split(":")[1]);
                                    // Create the presentation container in the presentation data
                                    var headerData = '<div id="header.' + headerPath + '">' +
                                        '<div class="header-header padded">' + this.presentation.presentationName + '</div>' +
                                        '</div>';
                                    // Add the header data to the array
                                    data.push({ presentationIndex: headerIndex, presentationData: headerData });
                                }
                            }
                        }
                    );

                    // Iterate through each media item in the playlist media list
                    playlistMediaList.forEach(
                        function(playlistMedia) {
                            // If the presentation path matches the path of the selected presentation, set it as highlighted
                            if (playlistMedia.presentationPath == location) {
                                // Iterate through each playlist item
                                $("#playlist-items").children("a").each(
                                    function() {
                                        // If this presentation path matches the selected presentation's presentation path
                                        if ($(this).children("div").attr("id") == location) {
                                            if (propresenterRequest && obj.slideIndex.toString() != "") {
                                                // Set the presentation as highlighted
                                                $(this).children("div").addClass("highlighted");
                                            } else {
                                                // Set the presentation as selected
                                                $(this).children("div").addClass("selected");
                                            }
                                        }
                                    }
                                );
                            }
                            // If this media item is part of the selected presentation's playlist
                            if (playlistMedia.presentationPath.split(":")[0] == playlistLocation) {
                                // Get the media item path
                                var mediaPath = playlistMedia.presentationPath;
                                // If the media item is not already displayed
                                if (document.getElementById("presentation." + mediaPath) == null) {
                                    // Get the index of the media item in the playlist
                                    var mediaIndex = parseInt(playlistMedia.presentationPath.split(":")[1]);
                                    // Create the presentation container in the presentation data
                                    var mediaData = '<div id="presentation.' + mediaPath + '">' +
                                        '<div class="presentation-header padded">' + playlistMedia.presentation.presentationName + '<div class="presentation-controls">'+getPresentationDestination(playlistMedia.presentation.presentationDestination)+'</div></div>' +
                                        '<div class="presentation-content padded">' +
                                        '<div id="media.' + mediaPath + '" class="media-container "><div class="media-image">' + getMediaIcon(playlistMedia) + '</div><a id="' + mediaPath + '" onclick="triggerSlide(this);"><div class="media ' + getMediaType(playlistMedia) + '"><i class="far fa-play-circle"></i></div></a><div class="media-name">' + playlistMedia.presentation.presentationName + '</div></div>' +
                                        '</div></div>';
                                    // Add the media data to the array
                                    data.push({ presentationIndex: mediaIndex, presentationData: mediaData });
                                    
                                }
                            }
                        }
                    );

                    if (data.length > 0 && data.length == playlistLength) {
                        // Sort the playlist presentations
                        data.sort(SortPresentationByIndex);
                        // Empty the presentation content area
                        $("#presentations").empty();
                        // For each presentation in the presentation data array
                        data.forEach(
                            function(item) {
                                // Add the presentation data to the presentations section
                                $("#presentations").append(item.presentationData);
                            }
                        );
                    }

                } else {

                    // For each Presentation in the playlist presentation array
                    $(playlistPresentationList).each(
                        function() {

                            // If the presentation path matches the path of the selected presentation, set it as highlighted
                            if (this.presentationPath == location) {
                                // Iterate through each playlist item
                                $("#playlist-items").children("a").each(
                                    function() {
                                        // If this presentation path matches the selected presentation's presentation path
                                        if ($(this).children("div").attr("id") == location) {
                                            if (propresenterRequest && obj.slideIndex.toString() != "") {
                                                // Set the presentation as highlighted
                                                $(this).children("div").addClass("highlighted");
                                            } else {
                                                // Set the presentation as selected
                                                $(this).children("div").addClass("selected");
                                            }
                                        }
                                    }
                                );
                            }

                            // If the presentation path matches the path of the selected presentation, set it as highlighted
                            if (this.presentationPath == location) {
                                // Get the presentation path
                                var presentationPath = this.presentationPath;
                                // If the presentation is not already displayed
                                if (document.getElementById("presentation." + presentationPath) == null) {
                                    // Get the index of the presentation in the playlist
                                    var presentationIndex = parseInt(this.presentationPath.split(":")[1]);
                                    // Create the presentation container in the presentation data
                                    var presentationData = '<div id="presentation.' + presentationPath + '" class="presentation">' +
                                        '<div class="presentation-header padded">' + this.presentation.presentationName + '<div class="presentation-controls">'+getPresentationDestination(this.presentation.presentationDestination)+'</div></div>' +
                                        '<div class="presentation-content padded">';
                                    // Generate & add the slides to the presentation data
                                    presentationData += generateSlides(this.presentation.presentationSlideGroups, presentationPath);
                                    // Add the close tags to the presentation data
                                    presentationData += '</div></div>';
                                    // Empty the presentation content area
                                    $("#presentations").empty();
                                    // Add the presentation data to the presentations section
                                    $("#presentations").append(presentationData);
                                }
                            }
                        }
                    );
                }

            } else {
                // Get the library
                var library;
                // Iterate through each library
                $(".libraries").children("div").children("a").each(
                    function() {
                        var libraryName = $(this).text();
                        // Split the string of the presentation path
                        var pathSplit = location.split("/");
                        // Iterate through each item in the split path to retrieve the library name
                        pathSplit.forEach(
                            function(pathElement, index) {
                                if (pathElement == "Libraries") {
                                    // If this presentation is from this library
                                    if (pathSplit[index + 1] == libraryName) {
                                        // Highlight the library
                                        $(".library").children(".name").each(
                                            function() {
                                                if (libraryName == $(this).text()) {
                                                    // Display the library
                                                    displayLibrary($(this).parent().parent());
                                                    // Add highlighted to library
                                                    $(this).parent().addClass("highlighted");
                                                }
                                            }
                                        );
                                    }
                                }
                            }
                        );
                    }
                );

                // If set to only get names from ProPresenter libraries
                if (!retrieveEntireLibrary) {
                    // Create a variable to hold whether the presentation should be retrieved
                    var retrieve = true;
                    // Check if the presentation currently exists in the list
                    libraryPresentationList.forEach(
                        function(item) {
                            // If the presentation exists
                            if (item.presentationPath == location) {
                                // Do not retrieve it
                                retrieve = false;
                            }
                        }
                    );
                    // If we should retrieve the presentation
                    if (retrieve) {
                        // Show downloading status
                        $("#status").attr("class", "downloading-library");
                        // Add this library item location to the requests array
                        libraryRequests.push(location);
                        // Empty the presentation display request list
                        presentationDisplayRequest = [];
                        // Add the location to the presentation display request list
                        presentationDisplayRequest.push(location);
                        // Add the index to the presentation display request list
                        presentationDisplayRequest.push(slideIndex);
                        // Get the presentation from the library
                        getPresentation(location);
                    }
                }


                // For each Presentation in the array
                $(libraryPresentationList).each(
                    function() {
                        // If the presentation path matches the path of the selected presentation, set it as highlighted
                        if (this.presentationPath == location) {
                            // Iterate through each library item
                            $("#library-items").children("a").each(
                                function() {
                                    // If this presentation path matches the selected presentation's presentation path
                                    if ($(this).children("div").attr("id") == location) {
                                        if (propresenterRequest && obj.slideIndex.toString() != "") {
                                            // Set the presentation as highlighted
                                            $(this).children("div").addClass("highlighted");
                                        } else {
                                            // Set the presentation as selected
                                            $(this).children("div").addClass("selected");
                                        }
                                    }
                                }
                            );
                            // Get the presentation path
                            var presentationPath = this.presentationPath;
                            // If the presentation is not already displayed
                            if (document.getElementById("presentation." + presentationPath) == null) {
                                // Create the presentation container in the presentation data
                                var presentationData = '<div id="presentation.' + presentationPath + '" class="presentation">' +
                                    '<div class="presentation-header padded">' + this.presentation.presentationName + '<div class="presentation-controls">'+getPresentationDestination(this.presentation.presentationDestination)+'</div></div>' +
                                    '<div class="presentation-content padded">';
                                // Generate & add the slides to the presentation data
                                presentationData += generateSlides(this.presentation.presentationSlideGroups, presentationPath);
                                // Add the close tags to the presentation data
                                presentationData += '</div></div>';
                                // Empty the presentation content area
                                $("#presentations").empty();
                                // Add the presentation data to the presentations section
                                $("#presentations").append(presentationData);
                            }
                        }
                    }
                );
            }
            previousPresentationRequest = false;
        }

        // If the presentation exists in the middle segment
        if (document.getElementById("presentation." + location) != null) {
            // Scroll the presentation into view
            document.getElementById("presentation." + location).scrollIntoView();
        }

        // Hide the left menu - MOBILE ONLY
        document.getElementById("sections").style.width = "0";

        // Set the slide view
        setSlideView();

        // Set the slide columns
        setslideCols(slideCols);
    }

    // If the request is from ProPresenter
    if (propresenterRequest) {
        if (obj.presentationDestination != 1) {
            // Remove selected from any previous slides
            $(".slide-container").removeClass("selected");
        } else {
            // Remove announcement selected from any previous slides
            $(".slide-container").removeClass("announcement-selected");
        }
        // Remove active from any previous media
        $(".media").removeClass("active");
        // Set the current slide
        setCurrentSlide(parseInt(obj.slideIndex) + 1, location, obj.presentationDestination);
        // Set Presentation Destination
        setPresentationDestination(location, obj.presentationDestination);
        // If there is a slide index
        if (obj.slideIndex != "") {
            // If this is destined for the announcements layer
            if (obj.presentationDestination == 1) {
                // Set clear announcements to active
                $("#clear-announcements").addClass("activated");
                // Set clear all to active
                $("#clear-all").addClass("activated");
            }
            // If the ProPresenter version does not support this feature
            else {
                // Set clear slide to active
                $("#clear-slide").addClass("activated");
                // Set clear all to active
                $("#clear-all").addClass("activated");
            }
        }
    } else {
        // If this is a header
        if (header) {
            // Scroll the header into view
            document.getElementById("header." + location).scrollIntoView();
        }

        // Remove selected and highlighted from all playlist/library items
        $(obj).parent().children("a").children("div").removeClass("selected").removeClass("highlighted");
        // Set the current playlist/library item as selected
        $(obj).children("div").addClass("selected");
    }
}

function refreshPresentation(presentationPath) {
    presentation = document.getElementById("presentation." + presentationPath);
    // If the presentation is currently displayed
    if (presentation != null) {
        // Create variable to hold the stored presentation
        var item;
        // Check if the presentation is a playlist or a library presentation
        if (presentationPath.charAt(0) == '0') {
            // Get the presentation from the playlist presentation list 
            item = findPresentationByTopPath(playlistPresentationList, presentationPath);
        } else {
            // Get the presentation from the library presentation list 
            item = findPresentationByTopPath(libraryPresentationList, presentationPath);
        }

        presentationData = $(presentation).children(".presentation-content");
        
        // Remove all slides from the presentation
        $(presentationData).empty();
        // Generate and add the slides to the presentation data
        $(presentationData).append(generateSlides(item.presentation.presentationSlideGroups, item.presentationPath));

        // Set the slide view
        setSlideView();

        // Set the slide columns
        setslideCols(slideCols);

        // Get current slide
        getCurrentSlide();
    }
}

// End Page Display Functions


// Utility Functions

function comparePresentations(obj) {    
    var currentSlides = [];
    var savedSlides = [];

    // Iterate through each slide group in the presentation
    obj.presentation.presentationSlideGroups.forEach(
        function(presentationSlideGroup) {
            // Iterate through each slide in the slide group
            presentationSlideGroup.groupSlides.forEach(
                function (groupSlides) {
                    currentSlides.push(presentationSlideGroup.groupName+"|"+presentationSlideGroup.groupColor+"|"+groupSlides.slideText+"|"+groupSlides.slideEnabled);
                }
            );
        }
    );

    // Check if the presentation is a playlist or a library presentation
    if (obj.presentationPath.charAt(0) == '0') {
        // Get the presentation from the playlist presentation list 
        item = findPresentationByTopPath(playlistPresentationList, obj.presentationPath);
        // Iterate through each slide group in the presentation
        item.presentation.presentationSlideGroups.forEach(
            function(presentationSlideGroup) {
                // Iterate through each slide in the slide group
                presentationSlideGroup.groupSlides.forEach(
                    function (groupSlides) {
                        savedSlides.push(presentationSlideGroup.groupName+"|"+presentationSlideGroup.groupColor+"|"+groupSlides.slideText+"|"+groupSlides.slideEnabled);
                    }
                );
            }
        );
    } else {
        // Get the presentation from the library presentation list 
        item = findPresentationByTopPath(libraryPresentationList, obj.presentationPath);
        // Iterate through each slide group in the presentation
        item.presentation.presentationSlideGroups.forEach(
            function(presentationSlideGroup) {
                // Iterate through each slide in the slide group
                presentationSlideGroup.groupSlides.forEach(
                    function (groupSlides) {
                        savedSlides.push(presentationSlideGroup.groupName+"|"+presentationSlideGroup.groupColor+"|"+groupSlides.slideText+"|"+groupSlides.slideEnabled);
                    }
                );
            }
        );
    }
    // Detect changes between the saved and current presentation
    if (currentSlides.length === savedSlides.length && currentSlides.every((v, i) => v === savedSlides[i])) {
        // console.log("No Changes Detected");
    } else {
        console.log("Changes Detected");
        // Add this item location to the requests array
        refreshRequests.push(obj.presentationPath);
        // Re-request the current presentation
        getCurrentPresentation();
    }
}

function generateSlides(presentationSlideGroups, presentationPath) {
    // Create a variable to hold the slide count
    var count = 1;
    // Create a variable to hold the created slides
    var slidesData = "";
    // Iterate through each slide group in the presentation
    presentationSlideGroups.forEach(
        function(presentationSlideGroup) {
            // Get the slide group color
            var colorArray = presentationSlideGroup.groupColor.split(" ");
            // Get the slide group name
            var groupName = presentationSlideGroup.groupName;
            // Iterate through each slide in the slide group
            presentationSlideGroup.groupSlides.forEach(
                function(groupSlide, index) {
                    // Add the slide to the slides data
                    slidesData += '<div class="slide-sizer"><div id="slide' + count + '.' + presentationPath + '" class="slide-container ' + getEnabledValue(groupSlide.slideEnabled) + '"><a id="' + presentationPath + '" onclick="triggerSlide(this);"><div class="slide" style="border-color: rgb(' + getRGBValue(colorArray[0]) + ',' + getRGBValue(colorArray[1]) + ',' + getRGBValue(colorArray[2]) + ');"><div class="slide-text">' + getSlideText(groupSlide.slideText) + '</div><img src="data:image/png;base64,' + groupSlide.slideImage + '" draggable="false"/><div class="slide-info" style="background-color: rgb(' + getRGBValue(colorArray[0]) + ',' + getRGBValue(colorArray[1]) + ',' + getRGBValue(colorArray[2]) + ');"><div class="slide-number">' + count + '</div><div class="slide-name">' + getSlideName(index, groupName) + '</div><div class="slide-label">' + getSlideLabel(groupSlide.slideLabel) + '</div></div></div></a></div></div>';
                    // Increase the slide count
                    count++;
                }
            );
        }
    );
    return slidesData;
}

function checkIOS() {
    var ua = window.navigator.userAgent;
    var iOS = !!ua.match(/iPad/i) || !!ua.match(/iPhone/i);
    var webkit = !!ua.match(/WebKit/i);
    var iOSSafari = iOS && webkit && !ua.match(/CriOS/i);
    // If the window is likely on an iPad
    if (iOSSafari) {
        // Hide the window title
        $('.window-title').hide();
        // Adjust the logo padding
        $('.logo').attr("style", "padding: 20px 10px 8px 10px;");
        // Adjust the logo image height
        $('.logo img').attr("style", "height: 33px;");
        // Adjust the slide columns slider height
        $('#slide-cols').attr("style", "height: 14px;");
    }
}

function getSlideText(slideText) {
    if (slideText != null) {
        return slideText.replace(/[\r\n\x0B\x0C\u0085\u2028\u2029]+/g, "<br>");
    } else {
        return "";
    }
}

function getRGBValue(int) {
    return Math.round(255 * int);
}

function getPresentationDestination(presentationDestination) {
    switch (presentationDestination) {
        case 1:
            return '<img class="announcement-indicator" title="Announcements Layer" src="img/announcement.png"/>';
        default:
            return "";
    }
}

function getMediaIcon(playlistMedia) {
    switch (playlistMedia.presentationItemType) {
        case "playlistItemTypeVideo":
            if (playlistMedia.presentation.presentationThumbnail != "") {
                return '<img src="data:image/png;base64,' + playlistMedia.presentation.presentationThumbnail + '" draggable="false"/>';
            } else {
                return "";
            }
        default:
            return '<i class="fas fa-music"></i>';
    }
}

function getMediaType(playlistMedia) {
    if (playlistMedia.presentation.presentationItemType == "playlistItemTypeVideo") {
        return "video";
    } else {
        return "";
    }
}

function setSlideView(int) {
    // If this is a request including a new view
    if (int != null) {
        // Array of supported view types
        var types = ["view-1", "view-2"];
        // Remove all view types
        $(".slide-display").removeClass(types);
        // Add this view type
        $(".slide-display").addClass("view-"+int);
        // Set the slide view
        slideView = int;
        // Set the slide view cookie
        setSlideViewCookie(int);
    }

    // Show the correct slide view
    switch(slideView) {
        case 1:
            // Show the grid view
            $(".slide").addClass("imgView").removeClass("txtView");
            break;
        case 2:
            // Show the text view
            $(".slide").addClass("txtView").removeClass("imgView");
            break;
    }
}

function setslideCols(int) {
    // Set the style attribute on slide-sizer
    $(".slide-sizer").attr("style", "width: calc(100% / "+int+")");
}

function SortPresentationByName(a, b) {
    // If set to only get names from ProPresenter libraries
    if (!retrieveEntireLibrary) {
        var aName = a.presentationName.toLowerCase();
        var bName = b.presentationName.toLowerCase();
        return ((aName < bName) ? -1 : ((aName > bName) ? 1 : 0));
    } else {
        var aName = a.presentation.presentationName.toLowerCase();
        var bName = b.presentation.presentationName.toLowerCase();
        return ((aName < bName) ? -1 : ((aName > bName) ? 1 : 0));
    }
}

function SortPresentationByPath(a, b) {
    var aName = a.presentationPath.toLowerCase();
    var bName = b.presentationPath.toLowerCase();
    return ((aName < bName) ? -1 : ((aName > bName) ? 1 : 0));
}

function SortPresentationByIndex(a, b) {
    var aIndex = a.presentationIndex;
    var bIndex = b.presentationIndex;
    return ((aIndex < bIndex) ? -1 : ((aIndex > bIndex) ? 1 : 0));
}

function getLocation(obj) {
    // Return the current presentation location
    return $(obj).children("div").attr("id");
}

function getClockSmallFormat(obj) {
    if (obj.length > 6) {
        return obj.split(".")[0];
    } else {
        return obj;
    }
}

function getClockOverrun(obj) {
    if (obj == true) {
        return "checked";
    } else {
        return "";
    }
}

function getClockEndTimeFormat(obj) {
    var endTimeFormatted = getClockSmallFormat(obj);
    if (endTimeFormatted == "00:00:00") {
        return "";
    } else {
        return endTimeFormatted;
    }
}

function clockMilisecondsCountdown(obj) {
    var ms = parseInt($(obj).text().split(".")[1]);
    var millisecondCount = setInterval(
        function() {
            if (ms > 0) {
                ms -= 1;
            } else {
                ms = 100;
            }
            var msString = ms.toString();
            if (msString.length < 2) {
                msString = "0" + msString;
            }
            time = $(obj).text().split(".")[0];
            $(obj).text(time + "." + msString);
        },
        10
    );
    setTimeout(
        function() {
            clearInterval(millisecondCount);
        },
        1000
    );
}

function webMessages() {
    window.open("http://" + host + ":" + port + "/html/pages/messages", '_blank');
}

// Prevent input fields from affecting slide progression
function preventInputInterference() {
    // When an input is in focus
    $("input").focus(
        function() {
            // Set input typing as active
            inputTyping = true;

            if ($(this).attr("id") == "stage-message") {
                // Set stage message typing as active
                stageMessageTyping = true;
            }
        }
    );
    // When an input is out of focus
    $("input").focusout(
        function() {
            // Set input typing as inactive
            inputTyping = false;

            if ($(this).attr("id") == "stage-message") {
                // Set stage message typing as inactive
                stageMessageTyping = false;
            }
        }
    );
}

function isElementInViewport(el) {
    // Special bonus for those using jQuery
    if (typeof jQuery === "function" && el instanceof jQuery) {
        el = el[0];
    }
    var rect = el.getBoundingClientRect();
    return (
        (rect.top) >= 0 &&
        rect.left >= 0 &&
        (rect.bottom) <= ((window.innerHeight || document.documentElement.clientHeight) - 200) && /* or $(window).height() */
        rect.right <= (window.innerWidth || document.documentElement.clientWidth) /* or $(window).width() */
    );
}

function getEnabledValue(enabled) {
    if (enabled) {
        return "";
    } else {
        return "disabled";
    }
}

function getSlideName(index, groupName) {
    if (index == 0) {
        return groupName;
    } else {
        return "";
    }
}

function getSlideLabel(slideLabel) {
    if (serverIsWindows) {
        return slideLabel;
    } else {
        return "";
    }
}

function getNested(obj){
    if (obj.playlistLocation != null) {
        if (obj.playlistLocation.includes(".")) {
            return "sub";
        } else {
            return "";
        }
    } else {
        return "";
    }
}

function findRequestByName(requestArray, presentationName) {
    var foundValue;
    requestArray.forEach(
        function (value) {
            if (presentationName == value.name) {
                foundValue = value;
            }
        }
    );
    return foundValue;
}

function findRequestByPath(requestArray, presentationPath) {
    var foundValue;
    requestArray.forEach(
        function (value) {
            if (presentationPath == value.location) {
                foundValue = value;
            }
        }
    );
    return foundValue;
}

function findPresentationByTopPath(presentationArray, presentationPath) {
    var foundValue;
    presentationArray.forEach(
        function (value) {
            if (presentationPath == value.presentationPath) {
                foundValue = value;
            }
        }
    );
    return foundValue;
}

function findPresentationByBottomPath(presentationArray, presentationPath) {
    var foundValue;
    presentationArray.forEach(
        function (value) {
            if (presentationPath == value.presentation.presentationPath) {
                foundValue = value;
            }
        }
    );
    return foundValue;
}

function replaceArrayValue(arr, a, b) {
    arr.forEach(
        function (value, index) {
            if (value == a) {
                arr[index] = b;
            }
        }
    );
}

function removeArrayValue(arr) {
    var what, a = arguments,
        L = a.length,
        ax;
    while (L > 1 && arr.length) {
        what = a[--L];
        while ((ax = arr.indexOf(what)) !== -1) {
            arr.splice(ax, 1);
        }
    }
    return arr;
}

// End Utility Functions


// Navigation Functions

function openSideMenu() {
    // Increase the width of the side menu to display it
    document.getElementById("sections").style.width = "250px";
    // // Create a element click handler to allow the opening of the custom dropdown
    // window.addEventListener('click', function(e) {
    //     // If the clicked element is contained within the dropdown
    //     if (document.getElementById(obj.parentNode.id).contains(e.target)) {} else {
    //         // Hide the dropdown
    //         $(obj).parent("div").children(".type-dropdown").hide();
    //     }
    // });
}

function closeSideMenu() {
    // Decrease the width of the side menu to display it
    document.getElementById("sections").style.width = "0";
}

// End Navigation Functions


// Initialisation Functions

function authenticate() {
    // Get the host from the input field
    host = document.getElementById("host").value;
    // Get the host from the input field
    pass = document.getElementById("password").value;
    // Try connecting
    connect();
}

function cancelAuthenticate() {
    // Set retry connection to disabled
    retryConnection = false;
    // End the WebSocket connection
    remoteWebSocket.close();
    // Fade-out the loader and text
    $("#connecting-loader").hide();
    // Fade-in authenticate segment
    $("#authenticate").fadeIn("200");
}

function initialise() {

    // Check if device is running iOS
    checkIOS();

    // Get Cookie Values
    getContinuousPlaylistCookie();
    getRetrieveEntireLibraryCookie();
    getForceSlidesCookie();
    getFollowProPresenterCookie();
    getUseCookiesCookie();
    getSlideViewCookie();
    getSlideColsCookie();

    // Add listener for action keys
    window.addEventListener('keydown', function(e) {
        if (!inputTyping) {
            // When spacebar or right arrow is detected
            if (e.keyCode == 32 || e.keyCode == 39 && e.target == document.body) {
                // Prevent the default action
                e.preventDefault();
                if (forceSlides) {
                    triggerNextSlide();
                } else {
                    // Trigger the next slide
                    remoteWebSocket.send('{"action":"presentationTriggerNext"}');
                }
            }
            // When left arrow is detected
            if (e.keyCode == 37 && e.target == document.body) {
                // Prevent the default action
                e.preventDefault();
                if (forceSlides) {
                    triggerPreviousSlide();
                } else {
                    // Trigger the previous slide
                    remoteWebSocket.send('{"action":"presentationTriggerPrevious"}');
                }
            }
        } else if (stageMessageTyping) {
            if (e.keyCode == 13) {
                // Prevent the default action
                e.preventDefault();
                // Show the stage message
                showStageMessage();
            }
        }

        if (e.keyCode == 112) {
            // Prevent the default action
            e.preventDefault();
            // Send the clear all command
            clearAll();
        }
        if (e.keyCode == 113) {
            // Prevent the default action
            e.preventDefault();
            // Send the clear slide command
            clearSlide();
        }
        if (e.keyCode == 114) {
            // Prevent the default action
            e.preventDefault();
            // Send the clear media command
            clearMedia();
        }
        if (e.keyCode == 115) {
            // Prevent the default action
            e.preventDefault();
            // Send the clear props command
            clearProps();
        }
        if (e.keyCode == 116) {
            // Prevent the default action
            e.preventDefault();
            // Send the clear audio command
            clearAudio();
        }
        if (e.keyCode == 117) {
            // Prevent the default action
            e.preventDefault();
            // Send the clear messages command
            clearMessages();
        }
        if (e.keyCode == 118) {
            // Prevent the default action
            e.preventDefault();
            // Send the clear announcements command
            clearAnnouncements();
        }
    });

    // Make images non-draggable
    $("img").attr('draggable', false);

    // Add listener for slide columns slider
    document.getElementById("slide-cols").addEventListener('input',
        function(s) {
            // Get slide columns
            slideCols = (parseInt(document.getElementById("slide-cols").max)+1) - parseInt(this.value);
            // Set slide columns
            setslideCols(slideCols);
            // Set slide columns cookie
            setSlideColsCookie(slideCols);
        }, false
    );
}

// When document is ready
$(document).ready(function() {
    initialise();
    // If user must authenticate
    if (mustAuthenticate) {
        if (changeHost) {
            $(".host-container").show();
        }
        document.getElementById("host").value = host;
        document.getElementById("password").value = pass;
        document.getElementById("host").addEventListener('keypress',
            function (e) {
                if (e.key === 'Enter') {
                    authenticate();
                }
            }
        );
        document.getElementById("password").addEventListener('keypress',
            function (e) {
                if (e.key === 'Enter') {
                    authenticate();
                }
            }
        );
        $("#authenticate").show();
    } else {
        connect();
    }
});

// End Initialisation Functions
