Edit in JSFiddle
JavaScript
Result
async function peer(other, polite, width = 160, height = 120) {
  // This creates all the buttons. You can skip this part
  const create = (container, type) => container.appendChild(document.createElement(type));
  const body = create(document.documentElement, "body");
  const camera = createCheckbox("Camera"), noise = createCheckbox("Noise");
  const both = polite && createCheckbox("Both noise");
  function createCheckbox(textContent) {
    const label = create(body, "label");
    const input = Object.assign(create(label, "input"), {type: "checkbox"});
    Object.assign(create(label, "text"), {textContent});
    return input;
  }
  const div = create(body, "div");
  const log = msg => div.innerHTML += `${msg}<br>`;
  const send = msg => other.postMessage(JSON.parse(JSON.stringify(msg)), "*");

  // This is the main application logic
  try {
    const pc = new RTCPeerConnection();
    const dc = pc.createDataChannel("both", {negotiated: true, id: 0});

    camera.onclick = () => onOff(camera, () => navigator.mediaDevices.getUserMedia({video: true}));
    noise.onclick = () => onOff(noise, whiteNoise);
    both.onclick = () => { dc.send(both.checked); dc.onmessage({data: both.checked}); }
    dc.onmessage = ({data}) => noise.checked == JSON.parse(data) || noise.click();

    async function onOff(button, getMedia) {
      try {
        if (button.checked) {
          if (!button.stream) button.stream = await getMedia();
          button.transceiver = pc.addTransceiver(button.stream.getTracks()[0], {streams: [button.stream]});
        } else {
          button.transceiver.stop();
        }
      } catch (e) {
        log(e);
      }
    }

    pc.ontrack = ({streams: [stream]}) => {
      if (!stream.video) {
        stream.video = Object.assign(create(body, "video"), {width, height, autoplay: true});
      }
      stream.video.srcObject = stream;
    };
    pc.onicecandidate = ({candidate}) => send({candidate});
    
    // The rest is the polite peer negotiation logic, copied from this blog
    
    let makingOffer = false, ignoreOffer = false;

    pc.onnegotiationneeded = async () => {
      try {
        makingOffer = true;
        const offer = await pc.createOffer();
        if (pc.signalingState != "stable") return;
        await pc.setLocalDescription(offer);
        send({description: pc.localDescription});
      } catch (e) {
        log(`ONN ${e}`);
      } finally {
        makingOffer = false;
      }
    };
    window.onmessage = async ({data: {description, candidate}}) => {
      try {
        if (description) {
          const offerCollision = description.type == "offer" &&
                                 (makingOffer || pc.signalingState != "stable");

          ignoreOffer = !polite && offerCollision;
          if (ignoreOffer) {
            return;
          }
          if (offerCollision) {
            await Promise.all([
              pc.setLocalDescription({type: "rollback"}),
              pc.setRemoteDescription(description)
            ]);
          } else {
            await pc.setRemoteDescription(description);
          }
          if (description.type == "offer") {
            await pc.setLocalDescription(await pc.createAnswer());
            send({description: pc.localDescription});
          }
        } else if (candidate) {
          try {
            await pc.addIceCandidate(candidate);
          } catch (e) {
            if (!ignoreOffer) log(e);
          }
        }
      } catch (e) {
        log(e);
      }
    }
  } catch (e) {
    log(e);
  }

  function whiteNoise() {
    const canvas = Object.assign(document.createElement("canvas"), {width, height});
    const ctx = canvas.getContext('2d');
    ctx.fillRect(0, 0, width, height);
    const p = ctx.getImageData(0, 0, width, height);
    requestAnimationFrame(function draw(){
      for (var i = 0; i < p.data.length; i++) {
        p.data[i++] = p.data[i++] = p.data[i++] = Math.random() * 255;
      }
      ctx.putImageData(p, 0, 0);
      requestAnimationFrame(draw);
    });
    return canvas.captureStream();
  }
}

// This runs two instances of the above code. One inside an iframe, the other outside it.
const iframe = document.documentElement.appendChild(document.createElement("iframe"));
iframe.height = 300;
iframe.srcdoc = `<html\><script\>(${peer.toString()})(parent, false);</script\></html\>`;
peer(iframe.contentWindow, true);