var playlistList = [];
var libraryPresentationList = [];
var playlistPresentationList = [];


function connect() {
    var wsUri = "ws://10.1.1.33:50000/remote";
    websocket = new WebSocket(wsUri);
    websocket.onopen = function(evt) { onOpen(evt) };
    websocket.onclose = function(evt) { onClose(evt) };
    websocket.onmessage = function(evt) { onMessage(evt) };
    websocket.onerror = function(evt) { onError(evt) };
}

function onOpen(evt) {
    websocket.send('{"action":"authenticate","protocol":"700","password":"control"}');
    console.log('Connected');
}

function onClose(evt) {
    console.log('Closed');
}

function onMessage(evt) {
    var message = evt.data;
    var obj = JSON.parse(message);
    console.log("Message: "+message);

    if (obj.action == "authenticate" && obj.authenticated == "1") {
        refreshLibrary();
    } else if (obj.action == "presentationCurrent") {
        console.log("Received Presentation");


        createPresentation(obj);
    } else if (obj.action == "libraryRequest") {
        $(obj.library).each (
            function () {
                getPresentation(this);
            }
        );
        getPlaylists();
    } else if (obj.action == "playlistRequestAll") {
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
    } else if (obj.action == "presentationTriggerIndex") {
        console.log("changedSlide");
        // Get the presentation location
        var location = obj.presentationPath;
        // Check if presentation is a Playlist or Library presentation
        if (location.charAt(0) == '0') {
            // Playlist
        } else {
            var data = "";
            $(".playlists").children("div").children("div").children("a").children("div").removeClass("selected");
            $(".libraries").children("div").children("a").children("div").addClass("highlighted");

            $(libraryPresentationList).each (
                function () {
                    if (this.presentationPath == location) {
                        data += '<div class="presentation">'+
                                    '<div class="presentation-header padded">'+this.presentation.presentationName+'</div>'+
                                    '<div class="presentation-content padded">';
                                    var count = 1;
                                    $(this.presentation.presentationSlideGroups).each (
                                        function () {
                                            var colorArray = this.groupColor.split(" ");
                                            $(this.groupSlides).each (
                                                function () {
                                                    data += '<div class="slide-container"><a onclick="triggerSlide(this);"><div id="'+location+'" class="slide" style="border-color: rgb('+getRGBValue(colorArray[0])+','+getRGBValue(colorArray[1])+','+getRGBValue(colorArray[2])+');"><img src="data:image/png;base64,'+this.slideImage+'" draggable="false"/><div class="slide-number" style="background-color: rgb('+getRGBValue(colorArray[0])+','+getRGBValue(colorArray[1])+','+getRGBValue(colorArray[2])+');">'+count+'</div></div></a></div>';
                                                    count ++;
                                                }
                                            );
                                        }
                                    );

                        data +='</div></div>';
                    }
                }
            );

            $("#presentations").empty();
            $("#presentations").append(data);
            console.log("setting slide "+obj.slideIndex);
            setCurrentSlide(obj.slideIndex+1, location);
        }
    }
}

function onError(evt) {
    console.log('Error');
}

function createPlaylistGroup(obj) {
    var groupData = "";
    groupData += '<div class="playlist-group">'+
                    '<a onclick="togglePlaylistVisibility(this)"><i class="collapser fas fa-caret-right"></i></a>'+
                    '<div class="item lib group"><img src="img/playlistgroup.png" />Services</div>';
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
    var playlistData = '<a onclick="displayPlaylist(this);"><div class="item lib playlist"><img src="img/playlist.png" /><div class="name">'+obj.playlistName+'</div></div></a>';
    playlistList.push(obj);
    return playlistData;
}

function createPresentation(obj) {
    if (obj.presentationPath.charAt(0) == '0') {
        playlistPresentationList.push(obj);
    } else {
        libraryPresentationList.push(obj);
    }
}

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

function setCurrentSlide(index, location) {
    $(".slide-container").removeClass("selected");
    $(".slide-number").each(
        function () {
            if ($(this).text() == index) {
                $(this).parent().parent().parent().addClass("selected");
            }
        }
    );

    $(libraryPresentationList).each (
        function () {
            if (this.presentationPath == location) {
                $(this.presentation.presentationSlideGroups).each (
                    function () {
                        console.log(this);
                        var image = new Image();
                        image.src = 'data:image/png;base64,'+this.groupSlides[index-1].slideImage;
                        $('#live').empty();
                        $('#live').append(image);
                    }
                );
            }
        }
    );
}

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
}

function getPlaylists() {
    websocket.send('{"action":"playlistRequestAll"}');
}

function triggerSlide(obj) {
    console.log("SlideTriggered from ProWebRemote");
    var location = ($(obj).children("div").attr("id"));
    var index = $(obj).children("div").children("div").text() - 1;
    if (location.charAt(0) == '0') {
        // Playlist
        websocket.send('{"action":"presentationTriggerIndex","slideIndex":"'+index+'","presentationPath":"'+location+'"}');
    } else {
        $("#library-items").children("a").children("div").removeClass("selected");
        $("#library-items").children("a").children("div").removeClass("highlighted");
        $(".item.con").each (
            function () {
                if ($(this).attr("id") == location) {
                    $(this).addClass("highlighted");
                }
            }
        );
        websocket.send('{"action":"presentationTriggerIndex","slideIndex":"'+index+'","presentationPath":"'+location.replace(/\//g, "\\/")+'"}');
    }
}

function refreshLibrary() {
    playlistList = [];
    libraryPresentationList = [];
    playlistPresentationList = [];
    getLibrary();
}

function togglePlaylistVisibility(obj) {
    console.log("toggle clicked");

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

function displayPlaylist(obj) {

    // Get the current playlist name
    var current = $(obj).children("div").children(".name").text();
    // Create variable to hold playlist items
    var data = "";
    // Find the playlist in the array
    $(playlistList).each (
        function () {
            if (this.playlistName == current) {
                $("#left-count").empty();
                if (this.playlist.length == 1) {
                    $("#left-count").append((this.playlist).length+" Item");
                } else {
                    $("#left-count").append((this.playlist).length+" Items");
                }
                $(this.playlist).each (
                    function () {
                        data += '<a onclick="getPresentation(this);"><div id="'+this.playlistItemLocation+'" class="item con"><img src="img/presentation.png" /><div class="name">'+this.playlistItemName+'</div></div></a>'
                    }
                );
            }
        }
    );
    $("#playlist-items").empty();
    $("#playlist-items").append(data);

    $("#library-items").hide();
    $("#playlist-items").show();
    $(obj).parent().children("a").children("div").removeClass("selected");
    $(".libraries").children("div").children("a").children("div").removeClass("selected");
    $(obj).children("div").addClass("selected");

}

function displayLibrary(obj) {

    // Create variable to hold library items
    var data = "";
    // For each Presentation in the array
    $(libraryPresentationList).each (
        function () {
            data += '<a onclick="displayPresentation(this);"><div id="'+this.presentationPath+'" class="item con"><img src="img/presentation.png" /><div class="name">'+this.presentation.presentationName+'</div></div></a>';
        }
    );
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
    $(obj).parent().children("a").children("div").removeClass("selected");
    $(obj).parent().children("a").children("div").removeClass("highlighted");
    $(".playlists").children("div").children("div").children("a").children("div").removeClass("selected");
    $(obj).children("div").addClass("selected");

}

function displayPresentation(obj) {


}

function displayPresentation(obj) {
    // Create variable to hold presentation
    var data = "";
    var location = $(obj).children("div").attr("id");
    // Check if the presentation is a playlist or a library presentation
    if (location.charAt(0) == '0') {
        console.log("This is a Playlist Presentation");
        // For each Presentation in the array
        $(playlistPresentationList).each (
            function () {
                if (this.presentationPath == location) {
                    console.log(this);
                }
            }
        );
    } else {
        console.log("This is a Library Presentation");
        $(".playlists").children("div").children("div").children("a").children("div").removeClass("selected");
        $(".libraries").children("div").children("a").children("div").removeClass("selected");
        $(".libraries").children("div").children("a").children("div").addClass("highlighted");
        // For each Presentation in the array
        $(libraryPresentationList).each (
            function () {
                if (this.presentationPath == location) {
                    data += '<div class="presentation">'+
                                '<div class="presentation-header padded">'+this.presentation.presentationName+'</div>'+
                                '<div class="presentation-content padded">';
                    var count = 1;
                    $(this.presentation.presentationSlideGroups).each (
                        function () {
                            var colorArray = this.groupColor.split(" ");
                            $(this.groupSlides).each (
                                function () {
                                    data += '<div class="slide-container"><a onclick="triggerSlide(this);"><div id="'+location+'" class="slide" style="border-color: rgb('+getRGBValue(colorArray[0])+','+getRGBValue(colorArray[1])+','+getRGBValue(colorArray[2])+');"><img src="data:image/png;base64,'+this.slideImage+'" draggable="false"/><div class="slide-number" style="background-color: rgb('+getRGBValue(colorArray[0])+','+getRGBValue(colorArray[1])+','+getRGBValue(colorArray[2])+');">'+count+'</div></div></a></div>';
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

    $("#presentations").empty();
    $("#presentations").append(data);
    $(obj).parent().children("a").children("div").removeClass("selected");
    $(obj).parent().children("a").children("div").removeClass("highlighted");
    $(".playlists").children("div").children("div").children("a").children("div").removeClass("selected");
    $(obj).children("div").addClass("selected");

}

function getRGBValue(int) {
    return 255 * int;
}

function initialise() {
    window.addEventListener('keydown', function(e) {
      if(e.keyCode == 32 || e.keyCode == 39 && e.target == document.body) {
        e.preventDefault();
        websocket.send('{"action":"presentationTriggerNext"}');
      }
      if(e.keyCode == 37 && e.target == document.body) {
        e.preventDefault();
        websocket.send('{"action":"presentationTriggerPrevious"}');
      }
    });
    $("img").attr('draggable', false);
}


$(document).ready(function() {
    initialise();
    connect();

});
