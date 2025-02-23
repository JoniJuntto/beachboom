import {
  FilesetResolver,
  PoseLandmarker,
  PoseLandmarkerResult,
} from "@mediapipe/tasks-vision";
import { SoccerScene } from "./scene";

const video = document.getElementById("video") as HTMLVideoElement;
const canvas = document.getElementById("output-canvas") as HTMLCanvasElement;
const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;
const startBtn = document.getElementById("startBtn") as HTMLButtonElement;
const stopBtn = document.getElementById("stopBtn") as HTMLButtonElement;
const statusDiv = document.getElementById("status") as HTMLDivElement;
const sceneContainer = document.getElementById(
  "scene-container"
) as HTMLDivElement;

let poseDetector: PoseLandmarker | undefined;
let animationId: number;
let videoStream: MediaStream | undefined;
const soccerScene = new SoccerScene(sceneContainer, video);

interface KeyPoints {
  head: { x: number; y: number };
  leftHand: { x: number; y: number };
  rightHand: { x: number; y: number };
  torso: { x: number; y: number };
}

interface BoundingBox {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  color: string;
}

interface BodyBoundingBoxes {
  leftHand: BoundingBox;
  rightHand: BoundingBox;
  leftLeg: BoundingBox;
  rightLeg: BoundingBox;
  head: BoundingBox;
  torso: BoundingBox;
}

function calculateBodyBoundingBoxes(
  poseLandmarks: any
): BodyBoundingBoxes | null {
  if (!poseLandmarks || poseLandmarks.length === 0) return null;

  const pose = poseLandmarks[0];
  const padding = 0.05; // 5% padding

  function createBox(
    points: Array<{ x: number; y: number }>,
    color: string
  ): BoundingBox {
    const xs = points.map((p) => p.x * 2 - 1);
    const ys = points.map((p) => -(p.y * 2 - 1));

    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);

    const width = maxX - minX;
    const height = maxY - minY;

    return {
      minX: minX - width * padding,
      maxX: maxX + width * padding,
      minY: minY - height * padding,
      maxY: maxY + height * padding,
      color,
    };
  }

  return {
    // Head: points 0-10 (face landmarks)
    head: createBox(pose.slice(0, 11), "yellow"),

    // Left Hand: points 15-17 (left wrist to fingertips)
    leftHand: createBox([pose[15], pose[17], pose[19], pose[21]], "blue"),

    // Right Hand: points 16-18 (right wrist to fingertips)
    rightHand: createBox([pose[16], pose[18], pose[20], pose[22]], "green"),

    // Left Leg: points 23,25,27,29,31 (left hip to foot)
    leftLeg: createBox(
      [pose[23], pose[25], pose[27], pose[29], pose[31]],
      "purple"
    ),

    // Right Leg: points 24,26,28,30,32 (right hip to foot)
    rightLeg: createBox(
      [pose[24], pose[26], pose[28], pose[30], pose[32]],
      "orange"
    ),

    // Torso: points 11,12,23,24 (shoulders and hips)
    torso: createBox([pose[11], pose[12], pose[23], pose[24]], "red"),
  };
}

function drawBoundingBox(ctx: CanvasRenderingContext2D, box: BoundingBox) {
  const canvasX = (x: number) => ((x + 1) / 2) * ctx.canvas.width;
  const canvasY = (y: number) => ((1 - y) / 2) * ctx.canvas.height;

  const x = canvasX(box.minX);
  const y = canvasY(box.maxY);
  const width = canvasX(box.maxX) - canvasX(box.minX);
  const height = canvasY(box.minY) - canvasY(box.maxY);

  ctx.strokeStyle = box.color;
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, width, height);
}

// Initialize MediaPipe Pose
async function initializePose() {
  try {
    const vision = await FilesetResolver.forVisionTasks(
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
    );
    poseDetector = await PoseLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath:
          "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task",
        delegate: "GPU",
      },
      runningMode: "VIDEO",
      numPoses: 1,
    });
    statusDiv.textContent = "Model loaded. Click 'Start Camera' to begin.";
    startBtn.disabled = false;
  } catch (error: any) {
    statusDiv.textContent = `Error loading model: ${error.message}`;
  }
}

async function detectPose() {
  if (!poseDetector || !video.videoWidth) {
    animationId = requestAnimationFrame(detectPose);
    return;
  }

  if (video.paused || video.ended) {
    console.warn("Video is paused or ended. Stopping pose detection.");
    statusDiv.textContent = "Video paused or ended.";
    cancelAnimationFrame(animationId);
    return;
  }

  if (video.videoWidth === 0 || video.videoHeight === 0) {
    console.warn("Video dimensions are zero.  Waiting for valid dimensions.");
    statusDiv.textContent = "Waiting for valid video dimensions...";
    animationId = requestAnimationFrame(detectPose); // Try again later
    return;
  }

  try {
    const startTimeMs = performance.now();
    const results: PoseLandmarkerResult = await poseDetector.detectForVideo(
      video,
      startTimeMs
    );

    if (results.landmarks && results.landmarks.length > 0) {
      const bodyBoxes = calculateBodyBoundingBoxes(results.landmarks);
      if (bodyBoxes) {
        console.log("Body Part Coordinates:", bodyBoxes);
      }
      drawResults(results.landmarks);
    } else {
      console.warn("No pose landmarks detected.");
    }

    animationId = requestAnimationFrame(detectPose);
  } catch (error: any) {
    console.error("Error during pose detection:", error);
    statusDiv.textContent = `Error during pose detection: ${error.message}`;
    cancelAnimationFrame(animationId);
  }
}

function drawResults(poseLandmarks: any) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

  if (!poseLandmarks || poseLandmarks.length === 0) {
    console.warn("No pose results to draw.");
    return;
  }

  // We only expect one pose in this example.
  console.log("Pose Landmarker Results CHECK HERE:", poseLandmarks);
  const pose = poseLandmarks[0]; // Get the first pose's landmarks

  if (!pose || pose.length === 0) {
    console.warn("No landmarks in pose result.");
    return;
  }

  // Draw landmarks
  for (const landmark of pose) {
    ctx.fillStyle = "red";
    ctx.beginPath();
    ctx.arc(
      landmark.x * canvas.width,
      landmark.y * canvas.height,
      4,
      0,
      2 * Math.PI
    );
    ctx.fill();
  }

  // Define connections for skeleton
  const connections = [
    // Torso
    [11, 12],
    [12, 24],
    [24, 23],
    [23, 11],
    // Right arm
    [12, 14],
    [14, 16],
    // Left arm
    [11, 13],
    [13, 15],
    // Right leg
    [24, 26],
    [26, 28],
    // Left leg
    [23, 25],
    [25, 27],
    // Face
    [0, 1],
    [1, 2],
    [2, 3],
    [3, 7],
    [7, 8],
    [8, 9],
    [9, 10],
    [10, 0],
  ];

  // Draw connections
  ctx.strokeStyle = "rgb(0, 255, 0)";
  ctx.lineWidth = 2;

  for (const [start, end] of connections) {
    const startPoint = pose[start];
    const endPoint = pose[end];

    ctx.beginPath();
    ctx.moveTo(startPoint.x * canvas.width, startPoint.y * canvas.height);
    ctx.lineTo(endPoint.x * canvas.width, endPoint.y * canvas.height);
    ctx.stroke();
  }

  // After drawing the skeleton, add bounding boxes if we have valid landmarks
  if (poseLandmarks && poseLandmarks.length > 0) {
    const bodyBoxes = calculateBodyBoundingBoxes(poseLandmarks);
    if (bodyBoxes) {
      Object.values(bodyBoxes).forEach((box) => {
        drawBoundingBox(ctx, box);
      });

      // Update 3D scene with body boxes
      soccerScene.updateColliderBoxes(bodyBoxes);
    }
  }

  // Render the 3D scene
  soccerScene.render();
}

// Start camera and pose detection
startBtn.addEventListener("click", async () => {
  try {
    videoStream = await navigator.mediaDevices.getUserMedia({
      video: { width: 640, height: 480 },
    });
    video.srcObject = videoStream;
    await video.play();

    startBtn.disabled = true;
    stopBtn.disabled = false;
    statusDiv.textContent = "Processing...";

    //  *IMPORTANT*:  Call detectPose *AFTER* a short delay to ensure
    //  poseDetector is ready.  A more robust solution would involve
    //  a promise or event from initializePose.
    setTimeout(detectPose, 500); // Adjust the delay as needed
  } catch (error: any) {
    statusDiv.textContent = `Error accessing camera: ${error.message}`;
  }
});

// Stop camera and pose detection
stopBtn.addEventListener("click", () => {
  if (videoStream) {
    videoStream.getTracks().forEach((track) => track.stop());
  }
  if (animationId) {
    cancelAnimationFrame(animationId);
  }
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  startBtn.disabled = false;
  stopBtn.disabled = true;
  statusDiv.textContent = "Stopped. Click 'Start Camera' to begin again.";
});

// Initialize on page load
initializePose();
