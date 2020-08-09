// Variables

var playlistList = [];
var audioPlaylistList = [];
var libraryPresentationList = [];
var playlistPresentationList = [];
var slideSizeEm = 17;
var authenticated = false;

// End Variables

// Websocket Functions

function connect() {
    var wsUri = "ws://127.0.0.1:50000/remote";
    websocket = new WebSocket(wsUri);
    websocket.onopen = function(evt) { onOpen(evt) };
    websocket.onclose = function(evt) { onClose(evt) };
    websocket.onmessage = function(evt) { onMessage(evt) };
    websocket.onerror = function(evt) { onError(evt) };
}

function onOpen(evt) {
    if (!authenticated) {
        websocket.send('{"action":"authenticate","protocol":"700","password":"control"}');
        console.log('Connected');
    }
}

function onClose(evt) {
    console.log('Closed');
    authenticated = false;
}

function onMessage(evt) {
    var obj = JSON.parse(evt.data);
    // console.log("Message: "+evt.data);

    if (obj.action == "authenticate" && obj.authenticated == "1" && authenticated == false) {
        getLibrary();
        getAudioPlaylists();
        authenticated = true;
    } else if (obj.action == "presentationCurrent") {
        createPresentation(obj);
    } else if (obj.action == "libraryRequest") {
        $(obj.library).each (
            function () {
                getPresentation(this);
            }
        );
        getPlaylists();

    } else if (obj.action == "playlistRequestAll") {
        // Empty the playlist area
        $("#playlist-content").empty();
        var data = "";
        $(obj.playlistAll).each (
            function () {
                if (this.playlistType == "playlistTypeGroup") {
                    data += createPlaylistGroup(this);
                } else if (this.playlistType == "playlistTypePlaylist") {
                    data += createPlaylist(this);
                }
            }
        );
        $("#playlist-content").append(data);
    } else if (obj.action == "audioRequest") {
        // Empty the audio area
        $("#audio-content").empty();
        var data = "";
        $(obj.audioPlaylist).each (
            function () {
                if (this.playlistType == "playlistTypeGroup") {
                    data += createAudioPlaylistGroup(this);
                } else if (this.playlistType == "playlistTypePlaylist") {
                    data += createAudioPlaylist(this);
                }
            }
        );
        $("#audio-content").append(data);
    } else if (obj.action == "audioPlayPause") {
        setAudioStatus(obj.audioPlayPause);
    } else if (obj.action == "presentationTriggerIndex") {
        displayPresentation(obj);
    }
}

function onError(evt) {
    console.log('Error');
    authenticated = false;
}

//  End Websocket Functions


// Playlist Build Functions

function createPlaylistGroup(obj) {
    var groupData = "";
    groupData += '<div class="playlist-group">'+
                    '<a onclick="togglePlaylistVisibility(this)" class="expander"><i class="collapser fas fa-caret-right"></i></a>'+
                    '<div class="item lib group"><img src="img/playlistgroup.png" />'+obj.playlistName+'</div>';
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
    var playlistData = '<a onclick="displayPlaylist(this);"><div class="item lib playlist"><img src="img/playlist.png"/><div class="name">'+obj.playlistName+'</div></div></a>';
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
                    '<a onclick="togglePlaylistVisibility(this)" class="expander"><i class="collapser fas fa-caret-right"></i></a>'+
                    '<div class="item lib group"><img src="img/playlistgroup.png" />'+obj.playlistName+'</div>';
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
    var playlistData = '<a onclick="displayAudioPlaylist(this);"><div class="item lib playlist"><img src="img/audio.png"/><div class="name">'+obj.playlistName+'</div></div></a>';
    audioPlaylistList.push(obj);
    $(obj.playlist).each (
        function () {
            getPresentation(this.playlistItemLocation);
        }
    );
    return playlistData;
}

// End Playlist Build Functions


// Presentation Build Functions

function createPresentation(obj) {
    // Variable to hold the correct index
    var count = 0;
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
        playlistPresentationList.push(obj);
    } else {
        libraryPresentationList.push(obj);
    }
}

// End Presentation Build Functions


// Clear Functions

function clearAll() {
    $('#live').empty();
    websocket.send('{"action":"clearAll"}');
}

function clearSlide() {
    websocket.send('{"action":"clearText"}');
}

function clearMedia() {
    websocket.send('{"action":"clearVideo"}');
}

function clearAudio() {
    websocket.send('{"action":"clearAudio"}');
}

function clearProps() {
    websocket.send('{"action":"clearProps"}');
}

// End Clear Functions


// Set Data Functions

function setCurrentSlide(index, location) {
    // Remove selected from any previous slides
    $(".slide-container").removeClass("selected");
    // Add selected to the current indexed slide
    $(".slide-number").each(
        function () {
            if ($(this).text() == index) {
                $(this).parent().parent().parent().parent().addClass("selected");
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

function getPresentation(obj) {
    // Create the location variable
    var location = "";
    // Check the request origin
    if ($(obj).attr("onclick") == null) {
        // Use the parameter as the location
        location = obj;
    } else {
        // Get the current presentation location
        location = $(obj).children("div").attr("id");
    }
    // Send the request to ProPresenter
    websocket.send('{"action": "presentationRequest","presentationPath": "'+location+'"}');
}

function getLibrary() {
    websocket.send('{"action":"libraryRequest"}');
    libraryPresentationList = [];
}

function getPlaylists() {
    websocket.send('{"action":"playlistRequestAll"}');
    playlistPresentationList = [];
    playlistList = [];
}

function getAudioPlaylists() {
    websocket.send('{"action":"audioRequest"}');
    audioPlaylistList = [];
}

// End Get Data Functions


// Toggle Data Functions

function toggleAudioPlayPause(this) {
    websocket.send('{"action":"audioPlayPause"}');
}

// End Toggle Data Functions


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
        $("#audio-status").removeClass("fa-play");
        $("#audio-status").addClass("fa-pause");
    } else {
        $("#audio-status").removeClass("fa-pause");
        $("#audio-status").addClass("fa-play");
    }
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

function triggerSlide(obj) {
    var location = ($(obj).children("div").attr("id"));
    var index = $(obj).children("div").children("div").children(".slide-number").text() - 1;
    if (location.charAt(0) == '0') {
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
}

// End Page Actions Functions


// Page Display Functions

function displayPlaylist(obj) {
    // Get the current playlist name
    var current = $(obj).children("div").children(".name").text();
    // Create variable to hold playlist items
    var data = "";
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
    // Find the playlist in the array
    $(audioPlaylistList).each (
        function () {
            if (this.playlistName == current) {
                // Reset the item count
                $("#right-count").empty();
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

function displayLibrary(obj) {
    // Create variable to hold library items
    var data = "";
    // Sort the presentations in the library by name
    libraryPresentationList.sort(SortByName);

    // For each Presentation in the array
    $(libraryPresentationList).each (
        function () {
            data += '<a onclick="displayPresentation(this);"><div id="'+this.presentationPath+'" class="item con"><img src="img/presentation.png" /><div class="name">'+this.presentation.presentationName+'</div></div></a>';
        }
    );
    // Reset the item count
    $("#left-count").empty();
    if (libraryPresentationList.length == 1) {
        $("#left-count").append(libraryPresentationList.length+" Item");
    } else {
        $("#left-count").append(libraryPresentationList.length+" Items");
    }

    $("#library-items").empty();
    $("#library-items").append(data);

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
    // Check if the presentation is a playlist or a library presentation
    if (location.charAt(0) == '0') {
        // Remove selected from playlists
        $(".playlists").children("div").children("div").children("a").children("div").removeClass("selected");
        // Iterate through each playlist in the array
        $(playlistList).each(
            function () {
                // Iterate through each element in the playlist
                var playlistName = this.playlistName;
                $(this.playlist).each (
                    function () {
                        if (this.playlistItemLocation == location) {
                            $(".playlist").children(".name").each(
                                function () {
                                    if (playlistName == $(this).text()){
                                        // Add highlighted to playlist
                                        $(this).parent().addClass("highlighted");

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
                                    }
                                }
                            );
                        }
                    }
                );

            }
        );

        // For each Presentation in the array
        $(playlistPresentationList).each (
            function () {
                if (this.presentationPath == location) {
                    $("#playlist-items").children("a").each (
                        function () {
                            if ($(this).children("div").attr("id") == location) {
                                $(this).children("div").addClass("highlighted");
                            }
                        }
                    );
                    data += '<div class="presentation">'+
                                '<div class="presentation-header padded">'+this.presentation.presentationName+'</div>'+
                                '<div class="presentation-content padded">';
                    var count = 1;
                    $(this.presentation.presentationSlideGroups).each (
                        function () {
                            var colorArray = this.groupColor.split(" ");
                            var groupName = this.groupName;
                            $(this.groupSlides).each (
                                function () {
                                    data += '<div class="slide-container"><a onclick="triggerSlide(this);"><div id="'+location+'" class="slide" style="border-color: rgb('+getRGBValue(colorArray[0])+','+getRGBValue(colorArray[1])+','+getRGBValue(colorArray[2])+');"><img src="data:image/png;base64,'+this.slideImage+'" draggable="false"/><div class="slide-info" style="background-color: rgb('+getRGBValue(colorArray[0])+','+getRGBValue(colorArray[1])+','+getRGBValue(colorArray[2])+');"><div class="slide-number">'+count+'</div><div class="slide-name">'+this.slideLabel+'</div></div></div></a></div>';
                                    count ++;
                                }
                            );
                        }
                    );

                    data +='</div></div>';
                }
            }
        );
    } else {
        // Get the library
        var library = $(".libraries").children("div").children("a")[0];
        // Display the library
        displayLibrary(library);
        // Add highlighted to library
        $(".libraries").children("div").children("a").children("div").addClass("highlighted");
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
                    data += '<div class="presentation">'+
                                '<div class="presentation-header padded">'+this.presentation.presentationName+'</div>'+
                                '<div class="presentation-content padded">';
                    var count = 1;
                    $(this.presentation.presentationSlideGroups).each (
                        function () {
                            var colorArray = this.groupColor.split(" ");
                            var groupName = this.groupName;
                            $(this.groupSlides).each (
                                function () {
                                    data += '<div class="slide-container"><a onclick="triggerSlide(this);"><div id="'+location+'" class="slide" style="border-color: rgb('+getRGBValue(colorArray[0])+','+getRGBValue(colorArray[1])+','+getRGBValue(colorArray[2])+');"><img src="data:image/png;base64,'+this.slideImage+'" draggable="false"/><div class="slide-info" style="background-color: rgb('+getRGBValue(colorArray[0])+','+getRGBValue(colorArray[1])+','+getRGBValue(colorArray[2])+');"><div class="slide-number">'+count+'</div><div class="slide-name">'+this.slideLabel+'</div></div></div></a></div>';
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

    $(obj).parent().children("a").children("div").removeClass("selected");
    $(obj).parent().children("a").children("div").removeClass("highlighted");

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

function SortByName(a, b){
  var aName = a.presentation.presentationName.toLowerCase();
  var bName = b.presentation.presentationName.toLowerCase();
  return ((aName < bName) ? -1 : ((aName > bName) ? 1 : 0));
}

// End Utility Functions


// Initialisation Functions

function initialise() {
    // Add listener for action keys
    window.addEventListener('keydown', function(e) {
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
        }, false
    );
}


$(document).ready(function() {
    initialise();
    connect();
});

// End Initialisation Functions
