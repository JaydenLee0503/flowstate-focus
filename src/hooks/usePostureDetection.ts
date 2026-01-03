// ---- FLOWSTATE: MediaPipe Holistic Posture Detection Hook ----
// Uses Face Landmarker + Pose Landmarker for comprehensive posture analysis
// Falls back to simulated logic if MediaPipe fails or camera is denied.

import { useEffect, useState, useRef, useCallback } from "react";
import { 
  FaceLandmarker, 
  PoseLandmarker,
  FilesetResolver, 
  FaceLandmarkerResult,
  PoseLandmarkerResult,
  DrawingUtils
} from "@mediapipe/tasks-vision";

// ---- Configuration ----
const POSTURE_THRESHOLD = 0.6; // Below this = distracted
const UPDATE_INTERVAL_MS = 100; // Process frames more frequently for smooth rendering
const HEAD_TILT_MAX_DEGREES = 30;
const SHOULDER_TILT_MAX_DEGREES = 15;

// ---- Types ----
interface PostureState {
  postureScore: number;
  isDistracted: boolean;
  isUsingCamera: boolean;
  isCameraAvailable: boolean;
  isLoading: boolean;
  error: string | null;
  faceDetected: boolean;
  poseDetected: boolean;
}

interface PostureMetrics {
  headTilt: number;
  shoulderTilt: number;
  headPosition: 'centered' | 'left' | 'right' | 'up' | 'down';
  shoulderAlignment: 'good' | 'hunched' | 'tilted';
}

// ---- Simulated Fallback Logic ----
function useSimulatedFallback(enabled: boolean) {
  const [postureScore, setPostureScore] = useState(1);
  const [isDistracted, setIsDistracted] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    
    const interval = setInterval(() => {
      setPostureScore((prev) => {
        const next = Math.max(0, Math.min(1, prev - Math.random() * 0.15));
        setIsDistracted(next < POSTURE_THRESHOLD);
        return next;
      });
    }, 4000);

    return () => clearInterval(interval);
  }, [enabled]);

  return { postureScore, isDistracted };
}

// ---- Head Tilt Calculation from Face Landmarks ----
function calculateHeadTilt(landmarks: { x: number; y: number; z: number }[]): number {
  const noseTip = landmarks[1];
  const forehead = landmarks[10];
  const chin = landmarks[152];
  const leftEye = landmarks[33];
  const rightEye = landmarks[263];

  if (!noseTip || !forehead || !chin || !leftEye || !rightEye) return 0;

  // Calculate vertical tilt (looking up/down)
  const idealNoseY = (forehead.y + chin.y) / 2;
  const verticalTilt = Math.abs(noseTip.y - idealNoseY);
  
  // Calculate horizontal rotation (looking left/right)
  const eyeMidpointX = (leftEye.x + rightEye.x) / 2;
  const horizontalRotation = Math.abs(noseTip.x - eyeMidpointX);

  // Calculate roll (head tilting sideways)
  const eyeSlope = Math.abs(leftEye.y - rightEye.y);
  
  // Combine all factors
  const combinedOffset = verticalTilt * 0.4 + horizontalRotation * 0.3 + eyeSlope * 0.3;
  const tiltDegrees = combinedOffset * 180;
  
  return Math.min(tiltDegrees, HEAD_TILT_MAX_DEGREES);
}

// ---- Shoulder Tilt Calculation from Pose Landmarks ----
function calculateShoulderTilt(landmarks: { x: number; y: number; z: number; visibility?: number }[]): number {
  // Pose landmark indices: 11 = left shoulder, 12 = right shoulder
  const leftShoulder = landmarks[11];
  const rightShoulder = landmarks[12];
  
  if (!leftShoulder || !rightShoulder) return 0;
  
  // Check visibility - only calculate if shoulders are visible
  const leftVisible = (leftShoulder.visibility ?? 0) > 0.5;
  const rightVisible = (rightShoulder.visibility ?? 0) > 0.5;
  
  if (!leftVisible || !rightVisible) return 0;
  
  // Calculate shoulder tilt (should be level for good posture)
  const shoulderTilt = Math.abs(leftShoulder.y - rightShoulder.y);
  const tiltDegrees = shoulderTilt * 90; // Convert to approximate degrees
  
  return Math.min(tiltDegrees, SHOULDER_TILT_MAX_DEGREES);
}

// ---- Calculate Posture Score from Pose Landmarks ----
function calculatePosePosture(landmarks: { x: number; y: number; z: number; visibility?: number }[]): number {
  // Key landmarks for posture
  const nose = landmarks[0];
  const leftShoulder = landmarks[11];
  const rightShoulder = landmarks[12];
  const leftEar = landmarks[7];
  const rightEar = landmarks[8];
  
  if (!nose || !leftShoulder || !rightShoulder) return 0.5;
  
  let score = 1.0;
  
  // 1. Check shoulder alignment (should be level)
  const shoulderTilt = Math.abs(leftShoulder.y - rightShoulder.y);
  if (shoulderTilt > 0.05) score -= shoulderTilt * 2;
  
  // 2. Check if head is forward (ears should be above shoulders)
  if (leftEar && rightEar) {
    const earMidpointX = (leftEar.x + rightEar.x) / 2;
    const shoulderMidpointX = (leftShoulder.x + rightShoulder.x) / 2;
    const headForward = Math.abs(earMidpointX - shoulderMidpointX);
    if (headForward > 0.1) score -= headForward;
  }
  
  // 3. Check if person is centered in frame
  const noseOffCenter = Math.abs(nose.x - 0.5);
  if (noseOffCenter > 0.3) score -= (noseOffCenter - 0.3) * 0.5;
  
  // 4. Check vertical position (not slouching down in frame)
  if (nose.y > 0.6) score -= (nose.y - 0.6) * 0.5;
  
  return Math.max(0, Math.min(1, score));
}

// ---- Normalize Scores ----
function tiltToPostureScore(tiltDegrees: number, maxDegrees: number): number {
  const normalized = 1 - (tiltDegrees / maxDegrees);
  return Math.max(0, Math.min(1, normalized));
}

// ---- Main Hook ----
// enableProcessing: when false, camera stays on but MediaPipe detection is skipped
// This allows YOLO to use the video feed while reducing CPU/memory load
export function usePostureDetection(enableProcessing: boolean = true) {
  const [state, setState] = useState<PostureState>({
    postureScore: 1,
    isDistracted: false,
    isUsingCamera: false,
    isCameraAvailable: false,
    isLoading: false,
    error: null,
    faceDetected: false,
    poseDetected: false,
  });
  
  const enableProcessingRef = useRef(enableProcessing);
  enableProcessingRef.current = enableProcessing;

  const [metrics, setMetrics] = useState<PostureMetrics>({
    headTilt: 0,
    shoulderTilt: 0,
    headPosition: 'centered',
    shoulderAlignment: 'good',
  });

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const faceLandmarkerRef = useRef<FaceLandmarker | null>(null);
  const poseLandmarkerRef = useRef<PoseLandmarker | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const lastProcessTimeRef = useRef<number>(0);
  const streamRef = useRef<MediaStream | null>(null);
  const drawingUtilsRef = useRef<DrawingUtils | null>(null);
  const isInitializingRef = useRef(false);

  const fallback = useSimulatedFallback(!state.isUsingCamera);

  // ---- Initialize MediaPipe ----
  const initializeMediaPipe = useCallback(async () => {
    // Prevent double initialization
    if (faceLandmarkerRef.current && poseLandmarkerRef.current) {
      console.log("[PostureDetection] Already initialized, skipping...");
      return true;
    }
    if (isInitializingRef.current) {
      console.log("[PostureDetection] Already initializing, skipping...");
      return false;
    }
    
    isInitializingRef.current = true;
    
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));
      console.log("[PostureDetection] Initializing MediaPipe holistic...");

      const vision = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
      );

      // Create Face Landmarker
      const faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
          delegate: "GPU",
        },
        runningMode: "VIDEO",
        numFaces: 1,
        minFaceDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5,
        outputFaceBlendshapes: false,
        outputFacialTransformationMatrixes: false,
      });
      faceLandmarkerRef.current = faceLandmarker;
      console.log("[PostureDetection] Face Landmarker loaded");

      // Create Pose Landmarker
      const poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task",
          delegate: "GPU",
        },
        runningMode: "VIDEO",
        numPoses: 1,
        minPoseDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5,
      });
      poseLandmarkerRef.current = poseLandmarker;
      console.log("[PostureDetection] Pose Landmarker loaded");

      setState(prev => ({ ...prev, isLoading: false }));
      isInitializingRef.current = false;
      return true;
    } catch (error) {
      console.error("[PostureDetection] MediaPipe init failed:", error);
      setState(prev => ({ 
        ...prev, 
        isLoading: false, 
        error: "Failed to initialize posture detection" 
      }));
      isInitializingRef.current = false;
      return false;
    }
  }, []);

  // ---- Start Camera ----
  const startCamera = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));

      // In environment mode we keep the camera on but DO NOT initialize MediaPipe.
      // This avoids loading GPU delegates + heavy models that can destabilize the browser.
      if (enableProcessingRef.current) {
        if (!faceLandmarkerRef.current || !poseLandmarkerRef.current) {
          const success = await initializeMediaPipe();
          if (!success) return false;
        }
      } else {
        console.log("[PostureDetection] Processing disabled - skipping MediaPipe initialization");
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { 
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: "user",
          frameRate: { ideal: 30 },
        },
      });

      streamRef.current = stream;

      // Create video element
      const video = document.createElement("video");
      video.srcObject = stream;
      video.autoplay = true;
      video.playsInline = true;
      video.muted = true;
      videoRef.current = video;

      // Create canvas for drawing landmarks
      const canvas = document.createElement("canvas");
      canvas.width = 640;
      canvas.height = 480;
      canvasRef.current = canvas;

      // Initialize drawing utils
      const ctx = canvas.getContext("2d");
      if (ctx) {
        drawingUtilsRef.current = new DrawingUtils(ctx);
      }

      await video.play();
      console.log("[PostureDetection] Camera started successfully");

      setState(prev => ({ 
        ...prev, 
        isLoading: false, 
        isUsingCamera: true, 
        isCameraAvailable: true 
      }));

      // Start processing loop after a small delay to ensure video is ready.
      // IMPORTANT: Only start the per-frame loop when posture processing is enabled.
      setTimeout(() => {
        if (!enableProcessingRef.current) return;

        const startIfReady = () => {
          if (!enableProcessingRef.current) return;

          if (videoRef.current && videoRef.current.readyState >= 2) {
            processFrame();
            return;
          }

          requestAnimationFrame(startIfReady);
        };

        startIfReady();
      }, 100);

      return true;
    } catch (error) {
      console.error("[PostureDetection] Camera start failed:", error);
      setState(prev => ({ 
        ...prev, 
        isLoading: false, 
        error: "Camera access denied or unavailable",
        isCameraAvailable: false,
      }));
      return false;
    }
  }, [initializeMediaPipe]);

  // ---- Process Video Frame ----
  const processFrame = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const faceLandmarker = faceLandmarkerRef.current;
    const poseLandmarker = poseLandmarkerRef.current;
    const drawingUtils = drawingUtilsRef.current;

    if (!video || video.readyState < 2) {
      animationFrameRef.current = requestAnimationFrame(processFrame);
      return;
    }
    
    // If processing is disabled (environment mode), skip ALL canvas drawing + MediaPipe work.
    // The live preview can use the <video> element directly, and YOLO uses the video feed.
    if (!enableProcessingRef.current) {
      animationFrameRef.current = requestAnimationFrame(processFrame);
      return;
    }
    
    // Can proceed even without landmarkers - just draw video
    if (!faceLandmarker && !poseLandmarker) {
      // Just draw video to canvas for YOLO to use
      if (canvas) {
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        }
      }
      animationFrameRef.current = requestAnimationFrame(processFrame);
      return;
    }

    const now = performance.now();
    
    if (now - lastProcessTimeRef.current >= UPDATE_INTERVAL_MS) {
      lastProcessTimeRef.current = now;

      try {
        // Get face detection results
        const faceResult: FaceLandmarkerResult = faceLandmarker.detectForVideo(video, now);
        
        // Get pose detection results
        const poseResult: PoseLandmarkerResult = poseLandmarker.detectForVideo(video, now);

        let faceScore = 0.5;
        let poseScore = 0.5;
        let faceDetected = false;
        let poseDetected = false;

        // Process face landmarks
        if (faceResult.faceLandmarks && faceResult.faceLandmarks.length > 0) {
          faceDetected = true;
          const faceLandmarks = faceResult.faceLandmarks[0];
          const headTilt = calculateHeadTilt(faceLandmarks);
          faceScore = tiltToPostureScore(headTilt, HEAD_TILT_MAX_DEGREES);
          
          setMetrics(prev => ({
            ...prev,
            headTilt,
            headPosition: headTilt < 10 ? 'centered' : headTilt < 20 ? 'left' : 'right',
          }));
        }

        // Process pose landmarks
        if (poseResult.landmarks && poseResult.landmarks.length > 0) {
          poseDetected = true;
          const poseLandmarks = poseResult.landmarks[0];
          const shoulderTilt = calculateShoulderTilt(poseLandmarks);
          const posePosture = calculatePosePosture(poseLandmarks);
          
          // Combine shoulder tilt and overall pose posture
          const shoulderScore = tiltToPostureScore(shoulderTilt, SHOULDER_TILT_MAX_DEGREES);
          poseScore = (shoulderScore * 0.4 + posePosture * 0.6);
          
          setMetrics(prev => ({
            ...prev,
            shoulderTilt,
            shoulderAlignment: shoulderTilt < 5 ? 'good' : shoulderTilt < 10 ? 'tilted' : 'hunched',
          }));

          // Draw only key landmarks on canvas (reduced for performance)
          if (canvas && drawingUtils) {
            const ctx = canvas.getContext("2d");
            if (ctx) {
              ctx.clearRect(0, 0, canvas.width, canvas.height);
              ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
              
              // Draw only upper body pose connections (shoulders, head)
              // Key indices: 0=nose, 7=left_ear, 8=right_ear, 11=left_shoulder, 12=right_shoulder
              const upperBodyIndices = [0, 7, 8, 11, 12];
              const keyLandmarks = upperBodyIndices
                .map(i => poseLandmarks[i])
                .filter(l => l && (l.visibility ?? 0) > 0.5);
              
              // Draw key landmarks only
              keyLandmarks.forEach(landmark => {
                ctx.beginPath();
                ctx.arc(landmark.x * canvas.width, landmark.y * canvas.height, 5, 0, 2 * Math.PI);
                ctx.fillStyle = "#00FF00";
                ctx.fill();
              });
              
              // Draw shoulder line
              const leftShoulder = poseLandmarks[11];
              const rightShoulder = poseLandmarks[12];
              if (leftShoulder && rightShoulder && 
                  (leftShoulder.visibility ?? 0) > 0.5 && 
                  (rightShoulder.visibility ?? 0) > 0.5) {
                ctx.beginPath();
                ctx.moveTo(leftShoulder.x * canvas.width, leftShoulder.y * canvas.height);
                ctx.lineTo(rightShoulder.x * canvas.width, rightShoulder.y * canvas.height);
                ctx.strokeStyle = "#00FF00";
                ctx.lineWidth = 2;
                ctx.stroke();
              }
              
              // Draw only face oval (not tessellation - much lighter)
              if (faceDetected && faceResult.faceLandmarks[0]) {
                // Just draw a few key face points: nose, eyes
                const faceKeyIndices = [1, 33, 263, 10, 152]; // nose, left_eye, right_eye, forehead, chin
                faceKeyIndices.forEach(i => {
                  const landmark = faceResult.faceLandmarks[0][i];
                  if (landmark) {
                    ctx.beginPath();
                    ctx.arc(landmark.x * canvas.width, landmark.y * canvas.height, 4, 0, 2 * Math.PI);
                    ctx.fillStyle = "#FF6B6B";
                    ctx.fill();
                  }
                });
              }
            }
          }
        }

        // Combine face and pose scores
        // Weight: 40% face (attention), 60% pose (posture)
        let combinedScore: number;
        if (faceDetected && poseDetected) {
          combinedScore = faceScore * 0.4 + poseScore * 0.6;
        } else if (faceDetected) {
          combinedScore = faceScore;
        } else if (poseDetected) {
          combinedScore = poseScore;
        } else {
          combinedScore = 0.5; // Default when nothing detected
        }
        
        setState(prev => ({
          ...prev,
          postureScore: combinedScore,
          isDistracted: combinedScore < POSTURE_THRESHOLD,
          faceDetected,
          poseDetected,
        }));

        if (faceDetected || poseDetected) {
          console.log(`[PostureDetection] Face: ${faceDetected}, Pose: ${poseDetected}, Score: ${combinedScore.toFixed(2)}`);
        }
      } catch (error) {
        console.error("[PostureDetection] Frame processing error:", error);
      }
    }

    animationFrameRef.current = requestAnimationFrame(processFrame);
  }, []);

  // ---- Mode switch behavior ----
  // When processing is OFF (environment mode), fully tear down MediaPipe to avoid
  // crashes from running two heavy vision systems at once.
  useEffect(() => {
    if (!enableProcessing) {
      // Stop the per-frame loop entirely (video keeps playing without it).
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }

      // Release MediaPipe resources (GPU/wasm) if they were loaded.
      try {
        faceLandmarkerRef.current?.close();
      } catch {
        // ignore
      }
      faceLandmarkerRef.current = null;

      try {
        poseLandmarkerRef.current?.close();
      } catch {
        // ignore
      }
      poseLandmarkerRef.current = null;

      drawingUtilsRef.current = null;

      // Reset posture signals in environment mode.
      setState(prev => ({
        ...prev,
        postureScore: 1,
        isDistracted: false,
        faceDetected: false,
        poseDetected: false,
      }));

      return;
    }

    // When toggling back to posture mode while the camera is already running,
    // (re)initialize MediaPipe and restart the processing loop.
    if (
      state.isUsingCamera &&
      (!faceLandmarkerRef.current || !poseLandmarkerRef.current) &&
      !isInitializingRef.current
    ) {
      (async () => {
        const ok = await initializeMediaPipe();
        if (ok) {
          lastProcessTimeRef.current = 0;
          processFrame();
        }
      })();
      return;
    }

    if (state.isUsingCamera && !animationFrameRef.current) {
      processFrame();
    }
  }, [enableProcessing, state.isUsingCamera, initializeMediaPipe, processFrame]);


  // ---- Stop Camera ----
  const stopCamera = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.remove();
      videoRef.current = null;
    }

    if (canvasRef.current) {
      canvasRef.current.remove();
      canvasRef.current = null;
    }

    drawingUtilsRef.current = null;

    setState(prev => ({ 
      ...prev, 
      isUsingCamera: false,
      postureScore: 1,
      isDistracted: false,
      faceDetected: false,
      poseDetected: false,
    }));
  }, []);

  // ---- Cleanup on Unmount ----
  useEffect(() => {
    return () => {
      stopCamera();
      if (faceLandmarkerRef.current) {
        faceLandmarkerRef.current.close();
        faceLandmarkerRef.current = null;
      }
      if (poseLandmarkerRef.current) {
        poseLandmarkerRef.current.close();
        poseLandmarkerRef.current = null;
      }
    };
  }, [stopCamera]);

  return {
    postureScore: state.isUsingCamera ? state.postureScore : fallback.postureScore,
    isDistracted: state.isUsingCamera ? state.isDistracted : fallback.isDistracted,
    isUsingCamera: state.isUsingCamera,
    isCameraAvailable: state.isCameraAvailable,
    isLoading: state.isLoading,
    error: state.error,
    faceDetected: state.faceDetected,
    poseDetected: state.poseDetected,
    metrics,
    videoRef,
    canvasRef,
    startCamera,
    stopCamera,
  };
}
