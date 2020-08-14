// Variables

// Connection
var host = "192.168.1.163";
var port = "50000";
var pass = "control";

// User Preference
var retrieveEntireLibrary = true;
var continuousPlaylist = true;
var useCookies = true;

// Application
var libraryList;
var playlistList = [];
var audioPlaylistList = [];
var libraryPresentationList = [];
var libraryPresentationNameList = [];
var playlistPresentationList = [];
var slideSizeEm = 17;
var authenticated = false;
var wsUri = "ws://"+host+":"+port+"/remote";
var resetTimeout;
var refresh = true;
var inputTyping = false;
var presentationDisplayRequest = null;

// End Variables

// Websocket Functions

function connect() {
    $(".disconnected").show();
    websocket = new WebSocket(wsUri);
    websocket.onopen = function(evt) { onOpen(evt) };
    websocket.onclose = function(evt) { onClose(evt) };
    websocket.onmessage = function(evt) { onMessage(evt) };
    websocket.onerror = function(evt) { onError(evt) };
}

function onOpen(evt) {
    if (!authenticated) {
        websocket.send('{"action":"authenticate","protocol":"700","password":"'+pass+'"}');
        console.log('Connected');
    }
}

function onMessage(evt) {
    var obj = JSON.parse(evt.data);
    console.log("Message: "+evt.data);

    if (obj.action == "authenticate" && obj.authenticated == "1" && authenticated == false) {
        // If the data is stale
        if (refresh) {
            // Get the libraries and library contents, playlists and playlist contents
            getLibrary();
            // Get the audio playlists and playlist contents
            getAudioPlaylists();
            // Get clocks
            getClocks();
            // Get messages
            getMessages();
            // Get stage layouts
            getStageLayouts();
            // Set data to fresh
            refresh = false;
        }
        // Set as authenticated
        authenticated = true;
        // Remove disconnected status
        $(".disconnected").hide();
        // Show connected status
        $(".connected").show();
        // Prevent disconnect auto-refresh
        clearTimeout(resetTimeout);
        // Start receiving clock times from ProPresenter
        startReceivingClockData();
    } else if (obj.action == "presentationCurrent") {
        // Create presentation
        createPresentation(obj);
    } else if (obj.action == "libraryRequest") {
        // Empty the library area
        $("#library-content").empty();
        // Empty the library list
        libraryList = [];
        // Empty the library presentation list
        libraryPresentationList = [];
        // Empty the library presentation name list
        libraryPresentationNameList = [];
        // Create a variable to hold the libraries
        var data = "";
        // For each item in the libraries
        obj.library.forEach(function (item, index) {
            // Add the library if required
            data += createLibrary(item);
            // If set to only get names from ProPresenter libraries
            if (!retrieveEntireLibrary) {
                // Create a presentation name element for the library
                createPresentationName(item);
            } else {
                // Get the presentation file from the library
                getPresentation(item);
            }
        });
        // Add the libraries to the library content area
        $("#library-content").append(data);
        // Get playlists
        getPlaylists();
    } else if (obj.action == "playlistRequestAll") {
        // Empty the playlist area
        $("#playlist-content").empty();
        // Empty the playlist list
        var playlistList = [];
        // Empty the playlist presentation list
        var playlistPresentationList = [];
        // Create a variable to hold the playlists
        var data = "";
        // For each playlist
        $(obj.playlistAll).each (
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
        // Empty the audio area
        $("#audio-content").empty();
        // Empty the audio playlist list
        var audioPlaylistList = [];
        // Create a variable to hold the audio playlists
        var data = "";
        // For each audio playlist
        $(obj.audioPlaylist).each (
            function () {
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
        // Get the current audio status and song
        getAudioStatus();
    } else if (obj.action == "clockRequest") {
        // Empty the clock area
        $("#timer-content").empty();
        // Create a variable to hold the clocks
        var data = "";
        // For each clock in the data
        obj.clockInfo.forEach(function (item, index) {
            console.log(item, index);
            data += createClock(item, index);
        });
        // Add the clocks to the timer content area
        $("#timer-content").append(data);
        // Prevent input fields from conflicting with slide progression
        preventInputInterference();
    } else if (obj.action == "messsageRequest") {
        // Create
        createMessages(obj);
        preventInputInterference();
    } else if (obj.action == "stageDisplaySets") {
        // Create stage display screens
        createStageScreens(obj);
    } else if (obj.action == "presentationTriggerIndex") {
        // Display the current ProPresenter presentation
        displayPresentation(obj);
        // Set clear slide to active
        $("#clear-slide").addClass("activated");
        // Set clear media to active
        $("#clear-media").addClass("activated");
        // Set clear all to active
        $("#clear-all").addClass("activated");
    }else if (obj.action == "audioPlayPause") {
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
    }
}

function onError(evt) {
    authenticated = false;
    console.error('Socket encountered error: ', evt.message, 'Closing socket');
    websocket.close();
}

function onClose(evt) {
    authenticated = false;
    // Remove connected status
    $(".connected").hide();
    // Show disconnected status
    $(".disconnected").show();
    // Retry connection every second
    setTimeout(function() {
      connect();
    }, 1000);

    // Refresh library after 5 minutes of disconnection
    resetTimeout = setTimeout(function() {
        refresh = true;
    }, 300000);
}

//  End Websocket Functions


// Cookie Functions

function setCookie(cname, cvalue, exdays) {
  var d = new Date();
  d.setTime(d.getTime() + (exdays*24*60*60*1000));
  var expires = "expires="+ d.toUTCString();
  document.cookie = cname + "=" + cvalue + ";" + expires + ";path=/";
}

function getCookie(cname) {
  var name = cname + "=";
  var decodedCookie = decodeURIComponent(document.cookie);
  var ca = decodedCookie.split(';');
  for(var i = 0; i <ca.length; i++) {
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

function getRetrieveEntireLibraryCookie() {
    if (checkCookie("retrieveEntireLibrary")) {
        console.log("REL Cookie Exists");
        retrieveEntireLibrary = (getCookie("retrieveEntireLibrary") == "true");
        document.getElementById("retrieveEntireLibrary-checkbox").checked = (getCookie("retrieveEntireLibrary") == "true");
    }
}

function setRetrieveEntireLibraryCookie(boolean) {
    setCookie("retrieveEntireLibrary", boolean, 90);
}

function getContinuousPlaylistCookie() {
    if (checkCookie("continuousPlaylist")) {
        console.log("CP Cookie Exists");
        continuousPlaylist = (getCookie("continuousPlaylist") == "true");
        document.getElementById("continuousPlaylist-checkbox").checked = (getCookie("continuousPlaylist") == "true");
    }
}

function setContinuousPlaylistCookie(boolean) {
    setCookie("continuousPlaylist", boolean, 90);
}

function getUseCookiesCookie() {
    if (checkCookie("useCookies")) {
        console.log("UC Cookie Exists");
        useCookies = (getCookie("useCookies") == "true");
        document.getElementById("useCookies-checkbox").checked = (getCookie("useCookies") == "true");
    }
}

function setUseCookiesCookie(boolean) {
    setCookie("useCookies", boolean, 90);
}

function getSlideSizeCookie() {
    var presentationSlideSize = getCookie("presentationSlideSize");
    console.log(presentationSlideSize)
    // if (accessMode == true) {
    //     retrieveEntireLibrary = accessMode
    // }
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
    pathSplit.forEach(function (item, index) {
      if (item == "Libraries") {
          libraryName = pathSplit[index+1];
      }
    });
    // Check if the library is unique and can be added in the array
    libraryList.forEach(function (item) {
        if (item == libraryName) {
            unique = false;
        }
    });
    // If the library is unique
    if (unique) {
        // Add the library name to the library list
        libraryList.push(libraryName);
        // Create the library data
        var libraryData = '<a onclick="displayLibrary(this);"><div class="item lib library"><img src="img/library.png" /><div class="name">'+libraryName+'</div></div></a>';
    }
    return libraryData;
}

function createPlaylistGroup(obj) {
    var groupData = "";
    groupData += '<div class="playlist-group">'+
                    '<a onclick="togglePlaylistVisibility(this)" class="expander"><i class="collapser fas fa-caret-right"></i><div class="item lib group"><img src="img/playlistgroup.png" />'+obj.playlistName+'</div></a>';
    $(obj.playlist).each (
        function () {
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
    var playlistData = '<a onclick="displayPlaylist(this);"><div class="item lib playlist presentation"><img src="img/playlist.png"/><div class="name">'+obj.playlistName+'</div></div></a>';
    playlistList.push(obj);
    $(obj.playlist).each (
        function () {
            getPresentation(this.playlistItemLocation);
        }
    );
    return playlistData;
}

function createAudioPlaylistGroup(obj) {
    var groupData = "";
    groupData += '<div class="playlist-group">'+
                    '<a onclick="togglePlaylistVisibility(this)" class="expander"><i class="collapser fas fa-caret-right"></i><div class="item lib group"><img src="img/playlistgroup.png" />'+obj.playlistName+'</div></a>';
    $(obj.playlist).each (
        function () {
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
    var playlistData = '<a onclick="displayAudioPlaylist(this);"><div class="item lib playlist audio"><img src="img/audio.png"/><div class="name">'+obj.playlistName+'</div></div></a>';
    audioPlaylistList.push(obj);
    $(obj.playlist).each (
        function () {
            getPresentation(this.playlistItemLocation);
        }
    );
    return playlistData;
}

function createClock(obj, clockIndex) {
    var clockdata = "";
    clockData = '<div id="clock-'+clockIndex+'" class="timer-container type-'+obj.clockType+'">'
        + '<div class="timer-expand"><a onclick="toggleClockVisibility(this)" class="expander expanded"><i class="collapser fas fa-caret-down"></i></a></div>'
        + '<div class="timer-name"><input id="clock-'+clockIndex+'-name" onchange="updateClock('+clockIndex+');" type="text" class="text-input collapse-hide" value="'+obj.clockName+'"/><div id="clock-'+clockIndex+'-name-text" class="timer-name-text collapse-show"></div></div>'
        + '<div id="clock-'+clockIndex+'-type" class="timer-type collapse-hide">'+createClockTypeOptions(obj.clockType, clockIndex)+'</div>'
        + '<div class="timer-timeOptions collapse-hide type-0"><div><div class="element-title">Duration</div><input id="clock-'+clockIndex+'-duration" onchange="updateClock('+clockIndex+');" type="text" class="text-input" value="'+getClockSmallFormat(obj.clockDuration)+'"/></div><div></div></div>'
        + '<div class="timer-timeOptions collapse-hide type-1"><div><div class="element-title">Time</div><input id="clock-'+clockIndex+'-time" onchange="updateClock('+clockIndex+');" type="text" class="text-input" value="'+getClockSmallFormat(obj.clockEndTime)+'"/></div><div><div class="element-title">Format</div><select id="clock-'+clockIndex+'-format" onchange="updateClock('+clockIndex+');" class="text-input">'+createClockFormatOptions(obj.clockFormat.clockTimePeriodFormat)+'</select></div></div>'
        + '<div class="timer-timeOptions collapse-hide type-2"><div><div class="element-title">Start</div><input id="clock-'+clockIndex+'-start" onchange="updateClock('+clockIndex+');" type="text" class="text-input" value="'+getClockSmallFormat(obj.clockDuration)+'"/></div><div><div class="element-title">End</div><input id="clock-'+clockIndex+'-end" onchange="updateClock('+clockIndex+');" type="text" class="text-input" placeholder="No Limit" value="'+getClockEndTimeFormat(obj.clockEndTime)+'"/></div></div>'
        + '<div class="timer-overrun collapse-hide"><div class="element-title">Overrun</div><input id="clock-'+clockIndex+'-overrun" onchange="updateClock('+clockIndex+');" type="checkbox" class="checkbox text-input" '+getClockOverrun(obj.clockOverrun)+'/></div>'
        + '<div class="timer-reset"><a onclick="resetClock('+clockIndex+');"><div class="option-button"><img src="img/reset.png" /></div></a></div>'
        + '<div id="clock-'+clockIndex+'-currentTime" class="timer-currentTime">'+getClockSmallFormat(obj.clockTime)+'</div>'
        + '<div class="timer-state"><a onclick="toggleClockState('+clockIndex+');"><div id="clock-'+clockIndex+'-state" class="option-button">Start</div></a></div></div>';

    // If the clock is active
    if (obj.clockState == true) {
        // Start receiving clock times from ProPresenter
        startReceivingClockData();
    }

    return clockData;
}

function createClockTypeOptions(clockType, clockIndex) {
    var clockTypeData = "";
    switch(clockType) {
        case 0:
            clockTypeData += '<a id="'+clockType+'" onclick="expandTypeList(this);"><div class="type-selected type-0"><img class="selected-img type-0" src="img/timer-countdown.png"><img class="selected-img type-1" src="img/timer-counttotime.png"><img class="selected-img type-2" src="img/timer-elapsedtime.png"><div class="selected-indicator"><i class="fas fa-angle-up"></i><i class="fas fa-angle-down"></i></div></div></a>'
                + '<div class="type-dropdown">'
                + '<a onclick="setClockType(this);"><div id="type-0" class="dropdown-row selected"><div class="row-indicator"><i class="fas fa-check"></i></div><img class="row-img" src="img/timer-countdown.png"><div class="row-name">Countdown</div></div></a>'
                + '<a onclick="setClockType(this);"><div id="type-1" class="dropdown-row"><div class="row-indicator"><i class="fas fa-check"></i></div><img class="row-img" src="img/timer-counttotime.png"><div class="row-name">Countdown to Time</div></div></a>'
                + '<a onclick="setClockType(this);"><div id="type-2" class="dropdown-row"><div class="row-indicator"><i class="fas fa-check"></i></div><img class="row-img" src="img/timer-elapsedtime.png"><div class="row-name">Elapsed Time</div></div></a>'
                + '</div>';
            break; '';
        case 1:
            clockTypeData += '<a id="'+clockType+'" onclick="expandTypeList(this);"><div class="type-selected type-1"><img class="selected-img type-0" src="img/timer-countdown.png"><img class="selected-img type-1" src="img/timer-counttotime.png"><img class="selected-img type-2" src="img/timer-elapsedtime.png"><div class="selected-indicator"><i class="fas fa-angle-up"></i><i class="fas fa-angle-down"></i></div></div></a>'
                + '<div class="type-dropdown">'
                + '<a onclick="setClockType(this);"><div id="type-0" class="dropdown-row"><div class="row-indicator"><i class="fas fa-check"></i></div><img class="row-img" src="img/timer-countdown.png"><div class="row-name">Countdown</div></div></a>'
                + '<a onclick="setClockType(this);"><div id="type-1" class="dropdown-row selected"><div class="row-indicator"><i class="fas fa-check"></i></div><img class="row-img" src="img/timer-counttotime.png"><div class="row-name">Countdown to Time</div></div></a>'
                + '<a onclick="setClockType(this);"><div id="type-2" class="dropdown-row"><div class="row-indicator"><i class="fas fa-check"></i></div><img class="row-img" src="img/timer-elapsedtime.png"><div class="row-name">Elapsed Time</div></div></a>'
                + '</div>';
            break;
        default:
            clockTypeData += '<a id="'+clockType+'" onclick="expandTypeList(this);"><div class="type-selected type-2"><img class="selected-img type-0" src="img/timer-countdown.png"><img class="selected-img type-1" src="img/timer-counttotime.png"><img class="selected-img type-2" src="img/timer-elapsedtime.png"><div class="selected-indicator"><i class="fas fa-angle-up"></i><i class="fas fa-angle-down"></i></div></div></a>'
                + '<div class="type-dropdown">'
                + '<a onclick="setClockType(this);"><div id="type-0" class="dropdown-row"><div class="row-indicator"><i class="fas fa-check"></i></div><img class="row-img" src="img/timer-countdown.png"><div class="row-name">Countdown</div></div></a>'
                + '<a onclick="setClockType(this);"><div id="type-1" class="dropdown-row"><div class="row-indicator"><i class="fas fa-check"></i></div><img class="row-img" src="img/timer-counttotime.png"><div class="row-name">Countdown to Time</div></div></a>'
                + '<a onclick="setClockType(this);"><div id="type-2" class="dropdown-row selected"><div class="row-indicator"><i class="fas fa-check"></i></div><img class="row-img" src="img/timer-elapsedtime.png"><div class="row-name">Elapsed Time</div></div></a>'
                + '</div>';
            break;
    }
    return clockTypeData;
}

function createClockFormatOptions(formatType) {
    switch(formatType) {
        case 0:
            return '<option value="0" selected>AM</option><option value="1">PM</option><option value="2">24Hr</option>';
        case 1:
            return '<option value="0">AM</option><option value="1" selected>PM</option><option value="2">24Hr</option>';
        default:
            return '<option value="0">AM</option><option value="1">PM</option><option value="2" selected>24Hr</option>';
    }
}

function createMessages(obj) {
    obj.messages.forEach(
        function (item) {

        }
    );

}

function createStageScreens(obj) {
    var screenData = "";
    obj.stageScreens.forEach(
        function (item) {
            var selectedLayout = item.stageLayoutSelectedLayoutUUID;
            screenData += '<div class="stage-screen"><div class="screen-name">'+item.stageScreenName+'</div><div class="stage-layout"><select onchange="setStageLayout(this)" name="stage-layout" id="'+item.stageScreenUUID+'">';
            obj.stageLayouts.forEach(
                function (item) {
                    if (item.stageLayoutUUID == selectedLayout) {
                        screenData += '<option value="'+item.stageLayoutUUID+'" selected>'+item.stageLayoutName+'</option>';
                    } else {
                        screenData += '<option value="'+item.stageLayoutUUID+'">'+item.stageLayoutName+'</option>';
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
    pathSplit.forEach(function (item, index) {
      if (item == "Libraries") {
          presentationName = pathSplit[index+2].replace(".pro", "");
      }
    });
    // Check if the presentation is unique and can be added in the array
    libraryPresentationNameList.forEach(function (item) {
        if (item.presentationName == presentationName) {
            unique = false;
        }
    });
    // If the presentation is unique
    if (unique) {
        // Create object with presentation name and path
        var presentationObj = {presentationName:presentationName, presentationPath:obj}
        // Add the new presentation object to the library presentation name list
        libraryPresentationNameList.push(presentationObj);
    }
}

// End Build Functions


// Presentation Build Functions

function createPresentation(obj) {
    // Variable to hold the correct index
    var count = 0;
    // Variable to hold the unique status of the presentation
    var unique = true;
    // Set the correct index for grouped slides
    $(obj.presentation.presentationSlideGroups).each(
        function () {
            $(this.groupSlides).each(
                function () {
                    // Set the current count as the slide index
                    this.slideIndex = count;
                    count ++;
                }
            );
        }
    );
    // Add this presentation to either the playlist or library presentation list
    if (obj.presentationPath.charAt(0) == '0') {
        // Check if the presentation is unique and can be added in the array
        $(playlistPresentationList).each(
            function () {
                if (this.presentationPath == obj.presentationPath) {
                    unique = false;
                }
            }
        );
        if (unique) {
            playlistPresentationList.push(obj);
        }
    } else {
        // Check if the presentation is unique and can be added in the array
        $(libraryPresentationList).each(
            function () {
                if (this.presentationPath == obj.presentationPath) {
                    unique = false;
                }
            }
        );
        if (unique) {
            libraryPresentationList.push(obj);
        }
    }
    // If set to only get names from ProPresenter libraries
    if (!retrieveEntireLibrary) {
        // Display this presentation if requested
        if (presentationDisplayRequest == obj.presentationPath) {
            // Set the presentation display request to none
            presentationDisplayRequest = null;
            // Display the presentation
            displayPresentation(obj);
        }
    }
}

// End Presentation Build Functions


// Clear Functions

function clearAll() {
    $('#live').empty();
    $(".presentation-content").children(".selected").removeClass("selected");
    websocket.send('{"action":"clearAll"}');
    $("#clear-all").removeClass("activated");
    $("#clear-slide").removeClass("activated");
    $("#clear-media").removeClass("activated");
    $("#clear-audio").removeClass("activated");
    $("#clear-props").removeClass("activated");
    $(".playing-audio").empty();
    $("#audio-status").addClass("disabled");
    $("#audio-items").children("a").children("div").removeClass("highlighted");
}

function clearAudio() {
    websocket.send('{"action":"clearAudio"}');
    $("#clear-audio").removeClass("activated");
    $(".playing-audio").empty();
    $("#audio-status").addClass("disabled");
    $("#audio-items").children("a").children("div").removeClass("highlighted");
    if ($(".icons div.activated").length < 1) {
        $("#clear-all").removeClass("activated");
    }
}

function clearMessages() {
    websocket.send('{"action":"clearMessages"}');
    $("#clear-messages").removeClass("activated");
    if ($(".icons div.activated").length < 1) {
        $("#clear-all").removeClass("activated");
    }
}

function clearProps() {
    websocket.send('{"action":"clearProps"}');
    $("#clear-props").removeClass("activated");
    if ($(".icons div.activated").length < 1) {
        $("#clear-all").removeClass("activated");
    }
}

function clearAnnouncements() {
    websocket.send('{"action":"clearAnnouncements"}');
    $("#clear-announcements").removeClass("activated");
    if ($(".icons div.activated").length < 1) {
        $("#clear-all").removeClass("activated");
    }
}

function clearSlide() {
    $('#live').empty();
    websocket.send('{"action":"clearText"}');
    $("#clear-slide").removeClass("activated");
    if ($(".icons div.activated").length < 1) {
        $("#clear-all").removeClass("activated");
    }
}

function clearMedia() {
    websocket.send('{"action":"clearVideo"}');
    $("#clear-media").removeClass("activated");
    if ($(".icons div.activated").length < 1) {
        $("#clear-all").removeClass("activated");
    }
}

// End Clear Functions


// Set Data Functions

function setCurrentSlide(index, location) {
    // Remove selected from any previous slides
    $(".slide-container").removeClass("selected");
    // Add selected to the current indexed slide
    $(".slide-number").each(
        function () {
            if ($(this).text() == index && $(this).parent().parent().parent().attr("id") == location) {
                $(this).parent().parent().parent().parent().addClass("selected");
                if (!isElementInViewport(document.getElementById("slide"+index+"."+location))) {
                    document.getElementById("slide"+index+"."+location).scrollIntoView();
                    var presentationContainer = document.getElementById("presentations");
                    if (presentationContainer.scrollTop + presentationContainer.clientHeight < presentationContainer.scrollHeight) {
                        document.getElementById("presentations").scrollTop = document.getElementById("presentations").scrollTop - 10;
                    }
                }
            }
        }
    );
    // Check if this is a playlist or library presentation
    if (location.charAt(0) == '0') {
        // Set the current live slide image
        $(playlistPresentationList).each (
            function () {
                if (this.presentationPath == location) {
                    $(this.presentation.presentationSlideGroups).each (
                        function () {
                            $(this.groupSlides).each (
                                function () {
                                    if (this.slideIndex == index-1) {
                                        var image = new Image();
                                        image.src = 'data:image/png;base64,'+this.slideImage;
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
        $(libraryPresentationList).each (
            function () {
                if (this.presentationPath == location) {
                    $(this.presentation.presentationSlideGroups).each (
                        function () {
                            $(this.groupSlides).each (
                                function () {
                                    if (this.slideIndex == index-1) {
                                        var image = new Image();
                                        image.src = 'data:image/png;base64,'+this.slideImage;
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

// End Set Data Functions


// Get Data Functions

function getCurrentPresentation() {
    websocket.send('{"action":"presentationCurrent", "presentationSlideQuality": 25}');
}

function getCurrentAudio() {
    websocket.send('{"action":"audioCurrentSong"}');
}

function getAudioStatus() {
    websocket.send('{"action":"audioIsPlaying"}');
}

function getClocks() {
    websocket.send('{"action":"clockRequest"}');
}

function getMessages() {
    websocket.send('{"action":"messageRequest"}');
}

function getStageLayouts() {
    websocket.send('{"action":"stageDisplaySets"}');
}

function getPresentation(location) {
    console.log('{"action": "presentationRequest","presentationPath": "'+location+'"}');
    // Send the request to ProPresenter
    websocket.send('{"action": "presentationRequest","presentationPath": "'+location+'"}');
}

function getLibrary() {
    websocket.send('{"action":"libraryRequest"}');
    libraryPresentationList = [];
    $("#library-items").empty();
    $("#left-count").empty();
    $("#presentations").empty();
}

function getPlaylists() {
    websocket.send('{"action":"playlistRequestAll"}');
    playlistPresentationList = [];
    playlistList = [];
    $("#playlist-items").empty();
}

function getAudioPlaylists() {
    websocket.send('{"action":"audioRequest"}');
    audioPlaylistList = [];
    $("#audio-items").empty();
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
}

function toggleUseCookies(obj) {
    setUseCookiesCookie(obj.checked);
    useCookies = obj.checked;
}

function toggleAudioPlayPause() {
    websocket.send('{"action":"audioPlayPause"}');
}

function toggleTimelinePlayPause() {
    websocket.send('{"action":"timelinePlayPause","presentationPath":""}');
}

function togglePlaylistVisibility(obj) {
    if($(obj).hasClass("expanded")) {
        $(obj).parent().children("a").children(".playlist").each(
            function () {
                $(this).hide();
            }
        );
        $(obj).removeClass("expanded")
        $(obj).children("i").removeClass("fa-caret-down");
        $(obj).children("i").addClass("fa-caret-right");
    } else {
        $(obj).parent().children("a").children(".playlist").each(
            function () {
                $(this).show();
            }
        );
        $(obj).addClass("expanded")
        $(obj).children("i").removeClass("fa-caret-right");
        $(obj).children("i").addClass("fa-caret-down");
    }
}

function toggleClockVisibility(obj) {
    if($(obj).hasClass("expanded")) {
        var index = $(obj).parent().parent().attr("id");
        console.log("Index "+index);
        $("#"+index+"-name-text").text($("#"+index+"-name").val());
        $(obj).parent().parent().addClass("collapse");
        $(obj).removeClass("expanded")
        $(obj).children("i").removeClass("fa-caret-down");
        $(obj).children("i").addClass("fa-caret-right");
    } else {
        $(obj).parent().parent().removeClass("collapse");
        $(obj).addClass("expanded")
        $(obj).children("i").removeClass("fa-caret-right");
        $(obj).children("i").addClass("fa-caret-down");
    }
}

function toggleClockState(int) {
    if ($("#clock-"+int+"-state").text() == "Start") {
        // Start receiving clock times from ProPresenter
        startReceivingClockData();
        websocket.send('{"action":"clockStart","clockIndex":"'+int+'"}');
    } else {
        websocket.send('{"action":"clockStop","clockIndex":"'+int+'"}');
    }
}

function expandTypeList(obj) {
    $(obj).parent("div").children(".type-dropdown").show();
    // Create a element click handler to allow the opening of the custom dropdown
    window.addEventListener('click', function(e){
        if (document.getElementById(obj.parentNode.id).contains(e.target)){
            console.log("clickedInside");
        } else {
            $(obj).parent("div").children(".type-dropdown").hide();
        }
    });
}

// End Toggle Data Functions


// Update Clock Functions

function updateClock(clockIndex) {
    // Get the clock name
    var clockName = document.getElementById("clock-"+clockIndex+"-name").value;
    // Get the clock type
    var clockType = document.getElementById("clock-"+clockIndex+"-type").firstElementChild.id;
    // Get the clock overrun setting
    var clockOverrun = document.getElementById("clock-"+clockIndex+"-overrun").checked;
    // Send the request according to the clock type
    if (clockType == 0) {
        // Get the clock duration / start time / count to time
        var clockDuration = document.getElementById("clock-"+clockIndex+"-duration").value;
        // Send the change to ProPresenter
        websocket.send('{"action":"clockUpdate","clockIndex":"'+clockIndex+'","clockType":"0","clockName":"'+clockName+'","clockTime":"'+clockDuration+'","clockOverrun":"'+clockOverrun+'"}');
    } else if (clockType == 1) {
        // Get the clock count to time
        var clockTime = document.getElementById("clock-"+clockIndex+"-time").value;
        // Get the clock format
        var clockFormat = document.getElementById("clock-"+clockIndex+"-format").value;
        // Send the change to ProPresenter
        websocket.send('{"action":"clockUpdate","clockIndex":"'+clockIndex+'","clockType":"1","clockName":"'+clockName+'","clockElapsedTime":"'+clockTime+'","clockOverrun":"'+clockOverrun+'","clockTimePeriodFormat":"'+clockFormat+'"}');
    } else {
        // Get the clock start time
        var clockStart = document.getElementById("clock-"+clockIndex+"-start").value;
        // Get the clock end time
        var clockEndTime = getClockEndTimeFormat(document.getElementById("clock-"+clockIndex+"-end").value);
        // Send the change to ProPresenter
        websocket.send('{"action":"clockUpdate","clockIndex":"'+clockIndex+'","clockType":"2","clockName":"'+clockName+'","clockTime":"'+clockStart+'","clockOverrun":"'+clockOverrun+'","clockElapsedTime":"'+clockEndTime+'"}');
    }
}

// End Update Clock Functions


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
        $("#audio-status").removeClass("disabled");
        $("#clear-audio").addClass("activated");
        $("#clear-all").addClass("activated");
    } else {
        $("#clear-audio").removeClass("activated");
        $(".playing-audio").empty();
        $("#audio-status").addClass("disabled");
        $("#audio-items").children("a").children("div").removeClass("highlighted");
        if ($(".icons div.activated").length < 1) {
            $("#clear-all").removeClass("activated");
        }
    }

}

function setAudioSong(obj) {
    $(".playing-audio").text(obj.audioName);
}

function clearStageMessage() {
    document.getElementById("stage-message").value = "";
    websocket.send('{"action":"stageDisplayHideMessage"}');
}

function hideStageMessage() {
    websocket.send('{"action":"stageDisplayHideMessage"}');
}

function showStageMessage() {
    var message = document.getElementById("stage-message").value;
    websocket.send('{"action":"stageDisplaySendMessage","stageDisplayMessage":"'+message+'"}');
}

function setStageLayout(obj) {
    // Send the change stage layout request to ProPresenter
    websocket.send('{"action":"stageDisplayChangeLayout","stageLayoutUUID":"'+$(obj).val()+'","stageScreenUUID":"'+$(obj).attr("id")+'"}');
}

function stopAllClocks() {
    // Stop receiving clock times from ProPresenter
    stopReceivingClockData();
    // Send the stop all clocks command
    websocket.send('{"action":"clockStopAll"}');
}

function resetAllClocks() {
    // Start receiving clock times from ProPresenter
    startReceivingClockData();
    // Send the reset all clocks command
    websocket.send('{"action":"clockResetAll"}');
}

function startAllClocks() {
    // Start receiving clock times from ProPresenter
    startReceivingClockData();
    // Send the start all clocks command
    websocket.send('{"action":"clockStartAll"}');
}

function startReceivingClockData() {
    // Send the start receiving clock times command
    websocket.send('{"action":"clockStartSendingCurrentTime"}');
}

function stopReceivingClockData() {
    // Send the stop receiving clock times command
    websocket.send('{"action":"clockStopSendingCurrentTime"}');
}

function resetClock(index, type) {
    // Start receiving clock times from ProPresenter
    startReceivingClockData();
    // Send the reset clock command
    websocket.send('{"action":"clockReset","clockIndex":"'+index+'"}');
}


function setClockName(obj) {
    // Set the clock name in the input
    document.getElementById("clock-"+obj.clockIndex+"-name").value = obj.clockName;
    // Set the clock name in the div
    document.getElementById("clock-"+obj.clockIndex+"-name-text").innerHTML = obj.clockName;
}

function setClockType(obj) {
    // Array of supported clock types
    var types = ["type-0","type-1","type-2"];
    // Get the clock type
    var type = $(obj).children("div").attr("id");
    // Get the clock index
    var clockIndex = $(obj).parent().parent().attr("id").split("-")[1];
    // Remove the selected class from all rows of the current dropdown
    $(obj).parent().children("a").children(".dropdown-row").removeClass("selected");
    // Set the current element as selected
    $(obj).children("div").addClass("selected");
    // Set the parent div ID to the type
    $(obj).parent().parent().children("a").attr("id", type.split("-")[1]);
    // Show options specific to the clock type
    $(obj).parent().parent().parent().removeClass(types).addClass(type);
    // Hide all open dropdowns
    $(".type-dropdown").hide();
    // Send the updated type to ProPresenter
    updateClock(clockIndex);
}

function setClockTypePP(obj) {
    // Array of supported clock types
    var types = ["type-0","type-1","type-2"];
    // Remove all clock types
    $("#clock-"+obj.clockIndex).removeClass(types);
    // Add the clock type
    $("#clock-"+obj.clockIndex).addClass("type-"+obj.clockType);
}

function setClockFormat(obj) {
    document.getElementById("clock-"+obj.clockIndex+"-format").value = obj.clockFormat.clockTimePeriodFormat;
}

function setClockDuration(obj) {
    document.getElementById("clock-"+obj.clockIndex+"-duration").value = getClockSmallFormat(obj.clockDuration);
    document.getElementById("clock-"+obj.clockIndex+"-start").value = getClockSmallFormat(obj.clockDuration);
}

function setClockEndTime(obj) {
    document.getElementById("clock-"+obj.clockIndex+"-time").value = getClockSmallFormat(obj.clockEndTime);
    document.getElementById("clock-"+obj.clockIndex+"-end").value = getClockEndTimeFormat(obj.clockEndTime);
}

function setClockOverrun(obj) {
    document.getElementById("clock-"+obj.clockIndex+"-overrun").checked = obj.clockOverrun;
}

function setClockTimes(obj) {
    obj.clockTimes.forEach(
        function (item, index) {
            document.getElementById("clock-"+index+"-currentTime").innerHTML = getClockSmallFormat(item);
        }
    );
}

function setClockState(obj) {
    document.getElementById("clock-"+obj.clockIndex+"-currentTime").innerHTML = getClockSmallFormat(obj.clockTime);
    if (obj.clockState == true) {
        document.getElementById("clock-"+obj.clockIndex+"-state").innerHTML = "Stop";
    } else {
        document.getElementById("clock-"+obj.clockIndex+"-state").innerHTML = "Start";
    }
}

function triggerSlide(obj) {
    var location = ($(obj).attr("id"));
    var index = $(obj).children("div").children("div").children(".slide-number").text() - 1;
    if (location.charAt(0) == '0') {
        console.log('{"action":"presentationTriggerIndex","slideIndex":"'+index+'","presentationPath":"'+location+'"}');
        websocket.send('{"action":"presentationTriggerIndex","slideIndex":"'+index+'","presentationPath":"'+location+'"}');
        $("#playlist-items").children("a").children("div").removeClass("selected");
        $("#playlist-items").children("a").children("div").removeClass("highlighted");
    } else {
        websocket.send('{"action":"presentationTriggerIndex","slideIndex":"'+index+'","presentationPath":"'+location.replace(/\//g, "\\/")+'"}');
        $("#library-items").children("a").children("div").removeClass("selected");
        $("#library-items").children("a").children("div").removeClass("highlighted");
    }

    $(".item.con").each (
        function () {
            if ($(this).attr("id") == location) {
                $(this).addClass("highlighted");
            }
        }
    );

    $("#clear-slide").addClass("activated");
    $("#clear-all").addClass("activated");
}

function triggerAudio(obj) {
    var location = ($(obj).children("div").attr("id"));
    if (location.charAt(0) == '0') {
        websocket.send('{"action":"audioStartCue","audioChildPath":"'+location+'"}');
        $("#audio-items").children("a").children("div").removeClass("selected");
        $("#audio-items").children("a").children("div").removeClass("highlighted");
    }

    $(".item.con").each (
        function () {
            if ($(this).attr("id") == location) {
                $(this).addClass("highlighted");
            }
        }
    );

    $(".item.lib.playlist.audio").each(
        function () {
            if ($(this).hasClass("selected")) {
                $(this).removeClass("selected")
                $(this).addClass("highlighted")
            }
        }
    );
}

// End Page Actions Functions


// Page Display Functions

function displayTimerOptions() {
    if($("#timerOptions:visible").length == 0) {
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
    if($("#messageOptions:visible").length == 0) {
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
    if($("#stageOptions:visible").length == 0) {
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
    if($("#settings:visible").length == 0) {
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
    $(".message-name").removeClass("selected").removeClass("highlighted");
    $(obj).children("div").addClass("selected");
}

function displayLibrary(obj) {
    // Get the current library name
    var current = $(obj).children("div").children(".name").text();
    // Create variable to hold library items
    var data = "";
    // Reset the item count
    $("#left-count").empty();
    // If set to only get names from ProPresenter libraries
    if (!retrieveEntireLibrary) {
        // Set the library item count
        if (libraryPresentationNameList.length == 1) {
            $("#left-count").append(libraryPresentationNameList.length+" Item");
        } else {
            $("#left-count").append(libraryPresentationNameList.length+" Items");
        }
        // Sort the presentations in the library by name
        libraryPresentationNameList.sort(SortPresentationByName);
        // For each Presentation Name in the array
        libraryPresentationNameList.forEach(function (item) {
            // Variable to hold the split string of the presentation path
            var pathSplit = item.presentationPath.split("/");
            // Iterate through each item in the split path to retrieve the library name
            pathSplit.forEach(function (element, index) {
              if (element == "Libraries") {
                  // If this presentation is from this library, add the data
                  if (pathSplit[index+1] == current) {
                      data += '<a onclick="displayPresentation(this);"><div id="'+item.presentationPath+'" class="item con"><img src="img/presentation.png" /><div class="name">'+item.presentationName+'</div></div></a>';
                  }
              }
            });
        });
    } else {
        // Set the library item count
        if (libraryPresentationList.length == 1) {
            $("#left-count").append(libraryPresentationList.length+" Item");
        } else {
            $("#left-count").append(libraryPresentationList.length+" Items");
        }
        // Sort the presentations in the library by name
        libraryPresentationList.sort(SortPresentationByName);
        // For each Presentation in the array
        libraryPresentationList.forEach(function (item) {
            // Variable to hold the split string of the presentation path
            var pathSplit = item.presentationPath.split("/");
            // Iterate through each item in the split path to retrieve the library name
            pathSplit.forEach(function (element, index) {
              if (element == "Libraries") {
                  // If this presentation is from this library, add the data
                  if (pathSplit[index+1] == current) {
                      data += '<a onclick="displayPresentation(this);"><div id="'+item.presentationPath+'" class="item con"><img src="img/presentation.png" /><div class="name">'+item.presentation.presentationName+'</div></div></a>';
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
    $(".playlists").children("div").children("div").children("a").children("div").removeClass("selected");
    $(".playlists").children("div").children("div").children("a").children("div").removeClass("highlighted");
    // Set the library as selected
    $(obj).children("div").addClass("selected");
}

function displayPlaylist(obj) {
    // Get the current playlist name
    var current = $(obj).children("div").children(".name").text();
    // Create variable to hold playlist items
    var data = "";
    // Sort presentations in the playlist presentation list
    playlistPresentationList.sort(SortPresentationByPath);
    // Find the playlist in the array
    $(playlistList).each (
        function () {
            if (this.playlistName == current) {
                // Reset the item count
                $("#left-count").empty();
                // Get the new item count
                if (this.playlist.length == 1) {
                    $("#left-count").append((this.playlist).length+" Item");
                } else {
                    $("#left-count").append((this.playlist).length+" Items");
                }
                // Add the presentations in the playlist
                $(this.playlist).each (
                    function () {
                        data += '<a onclick="displayPresentation(this);"><div id="'+this.playlistItemLocation+'" class="item con"><img src="img/presentation.png" /><div class="name">'+this.playlistItemName+'</div></div></a>'
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
    $(obj).parent().children("a").children("div").removeClass("selected");
    $(obj).parent().children("a").children("div").removeClass("highlighted");
    // Remove selected and highlighted from libraries
    $(".libraries").children("div").children("a").children("div").removeClass("selected");
    $(".libraries").children("div").children("a").children("div").removeClass("highlighted");
    // Set the playlist as selected
    $(obj).children("div").addClass("selected");
}

function displayAudioPlaylist(obj) {
    // Get the current playlist name
    var current = $(obj).children("div").children(".name").text();
    // Create variable to hold playlist items
    var data = "";
    // Reset the item count
    $("#right-count").empty();
    // Find the playlist in the array
    $(audioPlaylistList).each (
        function () {
            if (this.playlistName == current) {

                // Get the new item count
                if (this.playlist.length == 1) {
                    $("#right-count").append((this.playlist).length+" Item");
                } else {
                    $("#right-count").append((this.playlist).length+" Items");
                }
                // Add the presentations in the playlist
                $(this.playlist).each (
                    function () {
                        data += '<a onclick="triggerAudio(this);"><div id="'+this.playlistItemLocation+'" class="item con"><img src="img/clearaudio.png" /><div class="name">'+this.playlistItemName+'</div></div></a>'
                    }
                );
            }
        }
    );
    // Empty the content area
    $("#audio-items").empty();
    // Add the content to the content area
    $("#audio-items").append(data);

    // Remove selected and highlighted from playlists
    $(obj).parent().children("a").children("div").removeClass("selected");
    $(obj).parent().children("a").children("div").removeClass("highlighted");
    // Set the playlist as selected
    $(obj).children("div").addClass("selected");
}

function displayPresentation(obj) {
    // Create variable to hold presentation data
    var data = "";
    // Create the location variable
    var location = "";
    // Check the request origin
    if ($(obj).attr("onclick") == null) {
        // Use the presentationPath as the location
        location = obj.presentationPath;
    } else {
        // Get the current presentation location from the ID
        location = $(obj).children("div").attr("id");
    }
    // Remove selected from libraries and playlists
    $(".libraries").children("div").children("div").children("a").children("div").removeClass("selected").removeClass("highlighted");
    $(".playlists").children("div").children("div").children("a").children("div").removeClass("selected").removeClass("highlighted");
    $("#library-items").children("a").children("div").removeClass("selected").removeClass("highlighted");
    $("#playlist-items").children("a").children("div").removeClass("selected").removeClass("highlighted");

    // if (document.getElementById("presentation."+location)) {
    //     console.log("Presentation already loaded");
    // } else {
    //
    // }


    // Check if the presentation is a playlist or a library presentation
    if (location.charAt(0) == '0') {

        // Create a variable to hold the playlist location
        var playlistLocation = "";
        // Iterate through each playlist in the array
        $(playlistList).each(
            function () {
                // Get the playlist name
                var playlistName = this.playlistName;
                // Get the current playlist
                var currentPlaylist = this;
                // Iterate through each element in the playlist
                $(this.playlist).each (
                    function () {
                        if (this.playlistItemLocation == location) {
                            // Set the playlist location
                            playlistLocation = currentPlaylist.playlistLocation
                            $(".playlist").children(".name").each(
                                function () {
                                    if (playlistName == $(this).text()){


                                        var playlistGroupAnchor = $(this).parent().parent().parent().children(".expander");
                                        $(playlistGroupAnchor).parent().children("a").children(".playlist").each(
                                            function () {
                                                $(this).show();
                                            }
                                        );
                                        $(playlistGroupAnchor).addClass("expanded");
                                        $(playlistGroupAnchor).children("i").removeClass("fa-caret-right");
                                        $(playlistGroupAnchor).children("i").addClass("fa-caret-down");
                                        displayPlaylist($(this).parent().parent());
                                        // Add highlighted to playlist
                                        $(this).parent().addClass("highlighted");
                                    }
                                }
                            );
                        }
                    }
                );
            }
        );


        // For each Presentation in the playlist presentation array
        $(playlistPresentationList).each (
            function () {
                // If continuous playlists are enabled
                if (continuousPlaylist) {

                    // If the presentation path matches the path of the selected presentation, set it as highlighted
                    if (this.presentationPath == location) {
                        $("#playlist-items").children("a").each (
                            function () {
                                if ($(this).children("div").attr("id") == location) {
                                    $(this).children("div").addClass("highlighted");
                                }
                            }
                        );
                    }

                    // If this presentation is part of the selected presentation's playlist
                    if (this.presentationPath.split(":")[0] == playlistLocation) {
                        var presentationPath = this.presentationPath;
                        data += '<div id="presentation.'+this.presentationPath+'" class="presentation">'+
                                    '<div class="presentation-header padded">'+this.presentation.presentationName+'</div>'+
                                    '<div class="presentation-content padded">';
                        var count = 1;
                        $(this.presentation.presentationSlideGroups).each (
                            function () {
                                var colorArray = this.groupColor.split(" ");
                                var groupName = this.groupName;
                                $(this.groupSlides).each (
                                    function () {
                                        data += '<div id="slide'+count+'.'+presentationPath+'" class="slide-container"><a id="'+presentationPath+'" onclick="triggerSlide(this);"><div class="slide" style="border-color: rgb('+getRGBValue(colorArray[0])+','+getRGBValue(colorArray[1])+','+getRGBValue(colorArray[2])+');"><img src="data:image/png;base64,'+this.slideImage+'" draggable="false"/><div class="slide-info" style="background-color: rgb('+getRGBValue(colorArray[0])+','+getRGBValue(colorArray[1])+','+getRGBValue(colorArray[2])+');"><div class="slide-number">'+count+'</div><div class="slide-name">'+this.slideLabel+'</div></div></div></a></div>';
                                        count ++;
                                    }
                                );
                            }
                        );
                        data +='</div></div>';
                    }

                } else {

                    if (this.presentationPath == location) {
                        $("#playlist-items").children("a").each (
                            function () {
                                if ($(this).children("div").attr("id") == location) {
                                    $(this).children("div").addClass("highlighted");
                                }
                            }
                        );
                        data += '<div id="presentation.'+location+'" class="presentation">'+
                                    '<div class="presentation-header padded">'+this.presentation.presentationName+'</div>'+
                                    '<div class="presentation-content padded">';
                        var count = 1;
                        $(this.presentation.presentationSlideGroups).each (
                            function () {
                                var colorArray = this.groupColor.split(" ");
                                var groupName = this.groupName;
                                $(this.groupSlides).each (
                                    function () {
                                        data += '<div id="slide'+count+'.'+location+'" class="slide-container"><a id="'+location+'" onclick="triggerSlide(this);"><div class="slide" style="border-color: rgb('+getRGBValue(colorArray[0])+','+getRGBValue(colorArray[1])+','+getRGBValue(colorArray[2])+');"><img src="data:image/png;base64,'+this.slideImage+'" draggable="false"/><div class="slide-info" style="background-color: rgb('+getRGBValue(colorArray[0])+','+getRGBValue(colorArray[1])+','+getRGBValue(colorArray[2])+');"><div class="slide-number">'+count+'</div><div class="slide-name">'+this.slideLabel+'</div></div></div></a></div>';
                                        count ++;
                                    }
                                );
                            }
                        );

                        data +='</div></div>';
                    }
                }
            }
        );
    } else {
        // Get the library
        var library;
        // Iterate through each library
        $(".libraries").children("div").children("a").each (
            function () {
                var libraryName = $(this).text();
                // Split the string of the presentation path
                var pathSplit = location.split("/");
                // Iterate through each item in the split path to retrieve the library name
                pathSplit.forEach(
                    function (pathElement, index) {
                        if (pathElement == "Libraries") {
                            // If this presentation is from this library
                            if (pathSplit[index+1] == libraryName) {
                                // Highlight the library
                                $(".library").children(".name").each(
                                    function () {
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
                function (item) {
                    // If the presentation exists
                    if (item.presentationPath == location) {
                        // Do not retrieve it
                        retrieve = false;
                    }
                }
            );
            // If we should retrieve the presentation
            if (retrieve) {
                // Get the presentation from the library
                getPresentation(location);
                // Set the presentation display request to this presentation
                presentationDisplayRequest = location;
            }
        }

        // For each Presentation in the array
        $(libraryPresentationList).each (
            function () {
                if (this.presentationPath == location) {
                    $("#library-items").children("a").each (
                        function () {
                            if ($(this).children("div").attr("id") == location) {
                                $(this).children("div").addClass("highlighted");
                            }
                        }
                    );
                    data += '<div id="presentation.'+location+'" class="presentation">'+
                                '<div class="presentation-header padded">'+this.presentation.presentationName+'</div>'+
                                '<div class="presentation-content padded">';
                    var count = 1;
                    $(this.presentation.presentationSlideGroups).each (
                        function () {
                            var colorArray = this.groupColor.split(" ");
                            var groupName = this.groupName;
                            $(this.groupSlides).each (
                                function () {
                                    data += '<div id="slide'+count+'.'+location+'" class="slide-container"><a id="'+location+'" onclick="triggerSlide(this);"><div class="slide" style="border-color: rgb('+getRGBValue(colorArray[0])+','+getRGBValue(colorArray[1])+','+getRGBValue(colorArray[2])+');"><img src="data:image/png;base64,'+this.slideImage+'" draggable="false"/><div class="slide-info" style="background-color: rgb('+getRGBValue(colorArray[0])+','+getRGBValue(colorArray[1])+','+getRGBValue(colorArray[2])+');"><div class="slide-number">'+count+'</div><div class="slide-name">'+this.slideLabel+'</div></div></div></a></div>';
                                    count ++;
                                }
                            );
                        }
                    );

                    data +='</div></div>';
                }
            }
        );
    }
    // Add the data to the presentations section
    $("#presentations").empty();
    $("#presentations").append(data);
    // Set the slide size
    setSlideSize(slideSizeEm);
    // Set the current slide
    setCurrentSlide(obj.slideIndex+1, location);
    // Remove selected and highlighted from all items
    $(obj).parent().children("a").children("div").removeClass("selected").removeClass("highlighted");
    // Set the current item as selected
    $(obj).children("div").addClass("selected");
}

// End Page Display Functions


// Utility Functions

function getRGBValue(int) {
    return 255 * int;
}

function setSlideSize(int) {
    $(".slide img").width(int + "em");
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
        function () {
            if (ms > 0) {
                ms -= 1;
            } else {
                ms = 100;
            }
            var msString = ms.toString();
            if (msString.length < 2) {
                console.log(msString.length);
                msString = "0"+msString;
            }
            time = $(obj).text().split(".")[0];
            $(obj).text(time+"."+msString);
        },
        10
    );
    setTimeout(
        function () {
            clearInterval(millisecondCount);
        },
        1000
    );
}

function webMessages() {
    window.open("http://"+host+":"+port+"/html/pages/messages", '_blank');
}

function preventInputInterference() {
    $("input").focus(
        function () {
            inputTyping = true;
        }
    );
    $("input").focusout(
        function () {
            inputTyping = false;
        }
    );
}

function isElementInViewport (el) {
    // Special bonus for those using jQuery
    if (typeof jQuery === "function" && el instanceof jQuery) {
        el = el[0];
    }
    var rect = el.getBoundingClientRect();
    return (
        (rect.top-65) >= 0 &&
        rect.left >= 0 &&
        (rect.bottom-25) <= (window.innerHeight || document.documentElement.clientHeight) && /* or $(window).height() */
        rect.right <= (window.innerWidth || document.documentElement.clientWidth) /* or $(window).width() */
    );
}

// End Utility Functions


// Initialisation Functions

function initialise() {

    getRetrieveEntireLibraryCookie();

    getContinuousPlaylistCookie();

    getUseCookiesCookie();

    // Add listener for action keys
    window.addEventListener('keydown', function(e) {
        if (!inputTyping) {
            // When spacebar or right arrow is detected
            if(e.keyCode == 32 || e.keyCode == 39 && e.target == document.body) {
                // Prevent the default action
                e.preventDefault();
                // Trigger the next slide
                websocket.send('{"action":"presentationTriggerNext"}');
            }
            // When left arrow is detected
            if(e.keyCode == 37 && e.target == document.body) {
                // Prevent the default action
                e.preventDefault();
                // Trigger the previous slide
                websocket.send('{"action":"presentationTriggerPrevious"}');
            }
        }
    });

    // Make images non-draggable
    $("img").attr('draggable', false);

    // Add listener for slide size slider
    document.getElementById("slide-size").addEventListener('input',
        function (s) {
            // Get proper size
            var size = parseInt(this.value)+8;
            // Check if size is large enough to enlargen at a higher rate
            if (size > 26) {
                size = size + (size-26);
            }
            // Add the slide size to variable
            slideSizeEm = size;
            // Set slide size
            setSlideSize(slideSizeEm);
            setSlideSizeCookie("presentationSlideSize", slideSizeEm, 180);
        }, false
    );
    // Prevent typing into inputs from affecting the slide progression
    preventInputInterference();


}

$(document).ready(function() {
    initialise();
    connect();
});

// End Initialisation Functions
