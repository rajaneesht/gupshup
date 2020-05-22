'use strict';

//version1.0 - Rajaneesh

var isChannelReady = false;
var isInitiator = true; //rajaneesh has changed it to true .it was false earlier. Any one can be initiator
var isStarted = false;
var localStream;
var pc;
var remoteStream;
var turnReady;

//alert("Welcome to Rajaneesh meeting room");

var pcConfig = {
  'iceServers': [{
    'urls': 'stun:stun.l.google.com:19302'
  }]
};


// var pc_config = webrtcDetectedBrowser === 'firefox' ?
//   {'iceServers':[{'url':'stun:23.21.150.121'}]} : // number IP
//   {'iceServers': [{'url': 'stun:stun.l.google.com:19302'}
// ]
// };

// Set up audio and video regardless of what devices are present.
var sdpConstraints = {
  offerToReceiveAudio: true,
  offerToReceiveVideo: true
};

var room = 'foo';

/////////////////////////////////////////////

document.getElementById("btnJoinRoom").addEventListener("click", joinRoom);
document.getElementById("btnCallRemoteRoom").addEventListener("click", initialiseCamAndconnectPeers);
document.getElementById("btnHangUp").addEventListener("click", hangup);
//document.getElementById("btnRemoteHangUp").addEventListener("click", handleRemoteHangup);
//document.getElementById("btnLeaveRoom").addEventListener("click", sayBye);



var socket = io.connect();

  socket.on('created', function(room , clientId) {
    console.log('Created room ' + room);
    isInitiator = true;
    //alert('You are the first member , room created ' + clientId);
    updateRoolList(clientId,room);
  });

  socket.on('full', function(room) {
    console.log('Room ' + room + ' is full');
  });

  socket.on('join', function (room){
    console.log('Another peer made a request to join room ' + room);
    console.log('This peer is the initiator of room ' + room + '!');
    isChannelReady = true;

  });

  socket.on('joined', function(room , clientId) {
    console.log('joined: ' + room);
    isChannelReady = true;
    //alert('joined: ' + room);
    //alert('You joined already created room ' + clientId );
    updateRoolList(clientId,room);
  });

  socket.on('log', function(array) {
    console.log.apply(console, array);
    //alert(array);
  });

// mimics server side push message received at front end
// update list to contain only the last 5 elements
function updateRoolList(clientId , room){

  var newtext = "Room: " + room + " , Client : " + clientId ;
  // Fetch li elements in $('#lst')
  // truncate last one
  //$('#lst li').last().remove()

  // insert new text to top of li list (ideally, I want to pass the new text to insert to this function)
  $('#lst').prepend("<li>"+newtext+"</li>");

  //alert('Got called')
}

  ////////////////////////////////////////////////

  function sendMessage(message) {
    console.log('Client sending message: ', message);
    socket.emit('message', message);
  }

  // This client receives a message
  socket.on('message', function(message) {
    console.log('Client received message:', message);

    if (message === 'got user media') {
      maybeStart();
    } 
    else if (message.type === 'offer') {
      if (!isInitiator && !isStarted) {
        maybeStart();
      }
      pc.setRemoteDescription(new RTCSessionDescription(message));
      doAnswer();
    } 
    else if (message.type === 'answer' && isStarted) {
      pc.setRemoteDescription(new RTCSessionDescription(message));
    } 
    else if (message.type === 'candidate' && isStarted) {
      var candidate = new RTCIceCandidate({
        sdpMLineIndex: message.label,
        candidate: message.candidate
      });
      pc.addIceCandidate(candidate);
    } 
    else if (message === 'bye' && isStarted) {
      handleRemoteHangup();
    }
  });

  ////////////////////////////////////////////////////


  console.log('location.hostname = ', location.hostname);
  var localVideo = document.querySelector('#localVideo');
  var remoteVideo = document.querySelector('#remoteVideo');

  var constraints = {
    video: true
  };


  console.log('Getting user media with constraints', constraints);

  if (location.hostname !== 'localhost') {
    console.log('requestTurn...');
    requestTurn(     
      'https://computeengineondemand.appspot.com/turn?username=41784574&key=4080218913'
    );
  }
  
  function joinRoom() {
    
    room  = document.querySelector('#roomID').value;   
  
     ///////////////////////////////////////////// 
  
    // Could prompt for room name:
    //room = prompt('Enter room name:');
    //room = document.querySelector('#roomID');    
  
    if (room !== '') {
      socket.emit('create or join', room);
      console.log('Attempting to create or  join room', room);
      document.getElementById("msg").innerHTML = "<p>" + "You are now in " + room + " room  </p>" ;
      alert("Attempting to create or join room " , room);
    }
    else{
      alert("Provide room ID");
    }

  }
  
  function initialiseCamAndconnectPeers() {

  navigator.mediaDevices.getUserMedia({
    audio: true,    
    video: true
  })
  .then(gotStream)
  .catch(function(e) {
    alert('getUserMedia() error: ' + e.name);
  });

}


function gotStream(stream) {
  console.log('Adding local stream.');
  localStream = stream;
  localVideo.srcObject = stream;
  sendMessage('got user media');
  if (isInitiator) {
    maybeStart();
  }
}

var sender;
function maybeStart() {
  console.log('>>>>>>> maybeStart() ', isStarted, localStream, isChannelReady);
  if (!isStarted && typeof localStream !== 'undefined' && isChannelReady) {
    console.log('>>>>>> creating peer connection');
    createPeerConnection();
    pc.addStream(localStream);
    isStarted = true;
    console.log('isInitiator', isInitiator);
    if (isInitiator) {
      doCall();
    }
  }
}

window.onbeforeunload = function() {
  sendMessage('bye');
};

/////////////////////////////////////////////////////////

function createPeerConnection() {
  try {
    pc = new RTCPeerConnection(null);
    pc.onicecandidate = handleIceCandidate;
    pc.onaddstream = handleRemoteStreamAdded;
    pc.onremovestream = handleRemoteStreamRemoved;
    // let the "negotiationneeded" event trigger offer generation - added by rajaneesh
    pc.onnegotiationneeded = handleNegotiationNeeded;
    console.log('Created RTCPeerConnnection');

  } catch (e) {
    console.log('Failed to create PeerConnection, exception: ' + e.message);
    alert('Cannot create RTCPeerConnection object.');
    return;
  }
}
// rajaneesh - there is a bug that when 2nd peer connects it does not shows
// to 1st client .I have topress UnShare and Share. 
// Need to see  polite offer concept and even neogitationneeded handler
function handleNegotiationNeeded() {
  console.log('Sending answer to peer during handleNegotiationNeeded');
  if (pc.signalingState != "stable") return;
   pc.createOffer().then(
      setLocalAndSendMessage,
      onCreateSessionDescriptionError
    );
  }


function handleIceCandidate(event) {
  console.log('icecandidate event: ', event);
  if (event.candidate) {
    sendMessage({
      type: 'candidate',
      label: event.candidate.sdpMLineIndex,
      id: event.candidate.sdpMid,
      candidate: event.candidate.candidate
    });
  } else {
    console.log('End of candidates.');
  }
}

function handleCreateOfferError(event) {
  console.log('createOffer() error: ', event);
}

function doCall() {
  console.log('Sending offer to peer');
  pc.createOffer(setLocalAndSendMessage, handleCreateOfferError);
}

function doAnswer() {
  console.log('Sending answer to peer.');
  pc.createAnswer().then(
    setLocalAndSendMessage,
    onCreateSessionDescriptionError
  );
}

function setLocalAndSendMessage(sessionDescription) {
  pc.setLocalDescription(sessionDescription);
  console.log('setLocalAndSendMessage sending message', sessionDescription);
  sendMessage(sessionDescription);
}

function onCreateSessionDescriptionError(error) {
  trace('Failed to create session description: ' + error.toString());
}

function requestTurn(turnURL) {
  var turnExists = false;
  for (var i in pcConfig.iceServers) {
    if (pcConfig.iceServers[i].urls.substr(0, 5) === 'turn:') {
      turnExists = true;
      turnReady = true;
      break;
    }
  }
  if (!turnExists) {
    console.log('Getting TURN server from ', turnURL);
    // No TURN server. Get one from computeengineondemand.appspot.com:
    var xhr = new XMLHttpRequest();
    xhr.onreadystatechange = function() {
      if (xhr.readyState === 4 && xhr.status === 200) {
        var turnServer = JSON.parse(xhr.responseText);
        console.log('Got TURN server: ', turnServer);
        pcConfig.iceServers.push({
          'urls': 'turn:' + turnServer.username + '@' + turnServer.turn,
          'credential': turnServer.password
        });
        turnReady = true;
      }
    };
    xhr.open('GET', turnURL, true);
    xhr.send();
  }
}

function handleRemoteStreamAdded(event) {
  console.log('Remote stream added.');
  remoteStream = event.stream;
  remoteVideo.srcObject = remoteStream;
}

function handleRemoteStreamRemoved(event) {
  console.log('Remote stream removed. Event: ', event);
}

//lie a pausing as it is just - not sure if I should call this
function sayBye() {
  sendMessage('bye');
}

//like a leave room as connection is closed
//new to reestablish
function hangup() {
  console.log('Hanging up.');
  stop();
  sendMessage('bye');
}

function handleRemoteHangup() {
  console.log('Session terminated.');
  stop();
  isInitiator = false;
}

function stop() {
  isStarted = false;
  pc.close();
  pc = null;
}
