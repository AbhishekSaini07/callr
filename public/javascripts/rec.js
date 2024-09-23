var start = document.querySelector(".start-btn");
var stop = document.querySelector(".stop-btn");
var recordingsList = document.getElementById("recordings-list");
var cameraVideo = document.getElementById("cameraVideo");
var data = [];
var cameraIncluded = false;
var recorder;
var combinedStream;
var selectedCamera, selectedMicrophone;
var microphoneStream;
// Populate camera and microphone options on modal open
start.addEventListener("click", async () => {
  await populateDevices();
  document.getElementById("cameraModal").style.display = "block";
});
async function getMicrophoneName() {
  try {
      // Request access to the default audio input device
      currentMicrophoneStream = await navigator.mediaDevices.getUserMedia({
          audio: true, // Request audio input
      });

      // Get the audio tracks from the stream
      const audioTracks = currentMicrophoneStream.getAudioTracks();

      if (audioTracks.length > 0) {
          const audioTrack = audioTracks[0]; // Get the first audio track
          const settings = audioTrack.getSettings(); // Get the settings of the audio track

          // Print the microphone name in the span
          document.getElementById('mic').innerHTML = settings.label || 'Microphone name not available';
      } else {
          document.getElementById('mic').innerHTML = 'No audio tracks found.';
      }
  } catch (error) {
      console.error('Error accessing microphone:', error);
      document.getElementById('mic').innerHTML = 'Error accessing microphone.';
  }
}

// Function to handle device changes
async function handleDeviceChange() {
  // Stop the current stream
  if (currentMicrophoneStream) {
      currentMicrophoneStream.getTracks().forEach(track => track.stop());
  }
  // Re-fetch the microphone name
  await getMicrophoneName();
}

// Set up the event listener for device changes
navigator.mediaDevices.ondevicechange = handleDeviceChange;

// Call the function when needed

// Function to populate camera and microphone options
async function populateDevices() {
  const devices = await navigator.mediaDevices.enumerateDevices();
  const cameraSelect = document.getElementById("cameraSelect");
  const microphoneSelect = document.getElementById("microphoneSelect");

  cameraSelect.innerHTML = "";
  microphoneSelect.innerHTML = "";

  const microphoneLabels = new Set(); // To store unique microphone labels

  devices.forEach((device) => {
    // Check if the device is a camera
    if (device.kind === "videoinput") {
      const option = document.createElement("option");
      option.value = device.deviceId;
      option.textContent = device.label || `Camera ${cameraSelect.length + 1}`;
      cameraSelect.appendChild(option);
    } 
    // Check if the device is a microphone
    else if (device.kind === "audioinput") {
      if (!microphoneLabels.has(device.label) && device.label) { // Ensure valid labels
        microphoneLabels.add(device.label); // Add to set to avoid duplicates
        const option = document.createElement("option");
        option.value = device.deviceId;
        option.textContent = device.label || `Microphone ${microphoneSelect.length + 1}`;
        microphoneSelect.appendChild(option);
      }
    }
  });
}


// Handle camera inclusion
document.getElementById("includeCamera").addEventListener("click", async () => {
  cameraIncluded = true;
  selectedCamera = document.getElementById("cameraSelect").value;
  selectedMicrophone = document.getElementById("microphoneSelect").value;
  await requestPermissions();
  document.getElementById("cameraModal").style.display = "none";
  startRecording();
});

document.getElementById("excludeCamera").addEventListener("click", async () => {
  cameraIncluded = false;
  selectedMicrophone = document.getElementById("microphoneSelect").value;
  await requestPermissions();
  document.getElementById("cameraModal").style.display = "none";
  startRecording();
});

// Function to request permissions for screen, camera, and microphone
// Function to request permissions for screen, camera, microphone, and system audio
async function requestPermissions() {
  try {
    // Get the camera stream if included, without audio
    
      const cameraStream = await navigator.mediaDevices.getUserMedia({
        video: true
      });
      cameraVideo.srcObject = cameraStream; // Set camera stream to the camera video element
      cameraVideo.style.display = "block"; // Show the camera video
    

    // Get the screen recording permissions with system audio
    const screenStream = await navigator.mediaDevices.getDisplayMedia({
      video: { mediaSource: "screen" },
      audio: true, // Capture system audio (device audio)
    });
    microphoneStream = await navigator.mediaDevices.getUserMedia({
      audio: true
    });

    // Create an AudioContext to mix the audio tracks
    const audioContext = new AudioContext();
    const destination = audioContext.createMediaStreamDestination();

    // Create a source for the screenStream's audio
    const screenAudioSource =
      audioContext.createMediaStreamSource(screenStream);
    screenAudioSource.connect(destination);

    // Create a source for the microphoneStream's audio
    const microphoneAudioSource =
      audioContext.createMediaStreamSource(microphoneStream);
    microphoneAudioSource.connect(destination);

    // Create screen audio analyzer
    screenAudioAnalyzer = createAudioVisualizer(
      audioContext,
      screenStream,
      screenAudioVisualizer
    );

    // Create microphone audio analyzer
    micAudioAnalyzer = createAudioVisualizer(
      audioContext,
      microphoneStream,
      micAudioVisualizer
    );

    // Combine the video tracks from the screenStream with the mixed audio track
    combinedStream = new MediaStream([
      ...screenStream.getVideoTracks(), // Get video tracks from screenStream
      ...destination.stream.getAudioTracks(), // Get the mixed audio track
    ]);

    // Set the screen stream to the recording video element
    var recordingVideo = document.querySelector(".recording");
    recordingVideo.srcObject = combinedStream;
    recordingVideo.style.display = "block"; // Show the recording video

    // Automatically stop recording when the screen stream ends
    screenStream.getTracks().forEach((track) => {
      track.onended = () => {
        if (recorder && recorder.state === "recording") {
          stopRecording(); // Call the stop function
        }
      };
    });

    return combinedStream; // Return the combined stream for recording
  } catch (err) {
    console.error("Error getting permissions:", err);
  }
}

function startRecording() {
  if (!combinedStream) {
    console.error("Combined stream not available.");
    return;
  }

  // Create MediaRecorder for the combined screen and microphone stream
  recorder = new MediaRecorder(combinedStream);
  recorder.ondataavailable = (e) => data.push(e.data);
  recorder.start();

  start.disabled = true;
  stop.disabled = false;

  // Enter Picture-in-Picture for camera stream after screen share starts
  if (cameraIncluded) {
    cameraVideo.requestPictureInPicture().catch((err) => {
      console.error("Error entering Picture-in-Picture:", err);
    });
  }
  document.getElementById("rec_off").style.display = "none";
  document.getElementById("rec_on").style.display = "block";
  // Stop recording on Stop button click
  stop.addEventListener("click", stopRecording);
}

function stopRecording() {
  if (recorder) {
    recorder.stop();

    // Handle saving the recording
    recorder.onstop = () => {
      let blobData = new Blob(data, { type: "video/mp4" });
      let url = URL.createObjectURL(blobData);

      let listItem = document.createElement("li");
      let downloadBtn = document.createElement("a");
      downloadBtn.href = url;
      downloadBtn.download = "recording.mp4";
      downloadBtn.textContent = "Download";

      listItem.textContent = "Recording " + new Date().toLocaleTimeString();
      listItem.appendChild(downloadBtn);
      recordingsList.appendChild(listItem);

      // Hide camera and recording video previews
      cameraVideo.style.display = "none"; // Hide the camera video
      document.querySelector(".recording").style.display = "none"; // Hide the recording video

      // Turn off Picture-in-Picture mode
      if (document.pictureInPictureElement) {
        document.exitPictureInPicture().catch((err) => {
          console.error("Error exiting Picture-in-Picture:", err);
        });
      }

      // Reset
      data = [];
      start.disabled = false;
      stop.disabled = true;

      // Stop all streams to remove permissions
      if (cameraVideo.srcObject) {
        cameraVideo.srcObject.getTracks().forEach((track) => track.stop());
      }
      if (document.querySelector(".recording").srcObject) {
        document
          .querySelector(".recording")
          .srcObject.getTracks()
          .forEach((track) => track.stop());
      }
      document.getElementById("rec_off").style.display = "block";
      document.getElementById("rec_on").style.display = "none";
    };
  }
}
// Create a real-time audio visualizer
function createAudioVisualizer(audioContext, stream, canvasElement) {
  const analyser = audioContext.createAnalyser();
  const source = audioContext.createMediaStreamSource(stream);
  source.connect(analyser);

  analyser.fftSize = 256;
  const bufferLength = analyser.frequencyBinCount;
  const dataArray = new Uint8Array(bufferLength);

  const canvasContext = canvasElement.getContext("2d");
  

  function draw() {
    requestAnimationFrame(draw);

    analyser.getByteFrequencyData(dataArray);

    canvasContext.fillStyle = "rgb(0, 0, 0)";
    canvasContext.fillRect(0, 0, canvasElement.width, canvasElement.height);

    const barWidth = (canvasElement.width / bufferLength) * 2.0;
    let barHeight;
    let x = 0;

    for (let i = 0; i < bufferLength; i++) {
      barHeight = dataArray[i];

      canvasContext.fillStyle = `rgb(${barHeight + 120}, 70, 90)`;
      canvasContext.fillRect(
        x,
        canvasElement.height - barHeight / 2,
        barWidth,
        barHeight / 2
      );

      x += barWidth + 1;
    }
  }

  draw();
  return analyser;
}
