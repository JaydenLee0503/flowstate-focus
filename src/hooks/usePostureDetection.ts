// ---- FLOWSTATE: MediaPipe Posture Detection Hook ----
// Uses Face Mesh to detect head tilt as a proxy for posture/attention.
// Falls back to simulated logic if MediaPipe fails or camera is denied.

import { useEffect, useState, useRef, useCallback } from "react";
import { FaceLandmarker, FilesetResolver, FaceLandmarkerResult } from "@mediapipe/tasks-vision";

// ---- Configuration ----
const POSTURE_THRESHOLD = 0.6; // Below this = distracted
const UPDATE_INTERVAL_MS = 500; // How often to process frames
const HEAD_TILT_MAX_DEGREES = 30; // Max tilt before score = 0

// ---- Types ----
interface PostureState {
  postureScore: number;
  isDistracted: boolean;
  isUsingCamera: boolean;
  isCameraAvailable: boolean;
  isLoading: boolean;
  error: string | null;
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

// ---- Head Tilt Calculation ----
// Uses nose tip and forehead landmarks to calculate vertical head tilt
function calculateHeadTilt(landmarks: { x: number; y: number; z: number }[]): number {
  // Key landmarks: nose tip (1), forehead center (10), chin (152)
  const noseTip = landmarks[1];
  const forehead = landmarks[10];
  const chin = landmarks[152];

  if (!noseTip || !forehead || !chin) return 0;

  // Calculate vertical alignment - how much the head is tilted forward/backward
  // When looking straight, nose should be roughly aligned between forehead and chin
  const idealNoseY = (forehead.y + chin.y) / 2;
  const tiltOffset = Math.abs(noseTip.y - idealNoseY);
  
  // Also check horizontal head rotation using nose position
  const idealNoseX = (forehead.x + chin.x) / 2;
  const rotationOffset = Math.abs(noseTip.x - idealNoseX);

  // Combine offsets (weighted average)
  const combinedOffset = tiltOffset * 0.6 + rotationOffset * 0.4;
  
  // Convert to degrees (approximate)
  const tiltDegrees = combinedOffset * 180;
  
  return Math.min(tiltDegrees, HEAD_TILT_MAX_DEGREES);
}

// ---- Normalize Tilt to Posture Score ----
function tiltToPostureScore(tiltDegrees: number): number {
  // 0 degrees = perfect posture (score 1)
  // HEAD_TILT_MAX_DEGREES = poor posture (score 0)
  const normalized = 1 - (tiltDegrees / HEAD_TILT_MAX_DEGREES);
  return Math.max(0, Math.min(1, normalized));
}

// ---- Main Hook ----
export function usePostureDetection() {
  const [state, setState] = useState<PostureState>({
    postureScore: 1,
    isDistracted: false,
    isUsingCamera: false,
    isCameraAvailable: false,
    isLoading: false,
    error: null,
  });

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const faceLandmarkerRef = useRef<FaceLandmarker | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const lastProcessTimeRef = useRef<number>(0);
  const streamRef = useRef<MediaStream | null>(null);

  // Fallback to simulation when camera is not in use
  const fallback = useSimulatedFallback(!state.isUsingCamera);

  // ---- Initialize MediaPipe ----
  const initializeMediaPipe = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));

      // Load MediaPipe Vision WASM
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
      });

      faceLandmarkerRef.current = faceLandmarker;
      setState(prev => ({ ...prev, isLoading: false }));
      
      return true;
    } catch (error) {
      console.error("[PostureDetection] MediaPipe init failed:", error);
      setState(prev => ({ 
        ...prev, 
        isLoading: false, 
        error: "Failed to initialize posture detection" 
      }));
      return false;
    }
  }, []);

  // ---- Start Camera ----
  const startCamera = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));

      // Initialize MediaPipe if not already done
      if (!faceLandmarkerRef.current) {
        const success = await initializeMediaPipe();
        if (!success) return false;
      }

      // Request camera access
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { 
          width: { ideal: 320 }, // Low resolution for performance
          height: { ideal: 240 },
          facingMode: "user",
        },
      });

      streamRef.current = stream;

      // Create hidden video element
      const video = document.createElement("video");
      video.srcObject = stream;
      video.autoplay = true;
      video.playsInline = true;
      video.muted = true;
      video.style.display = "none"; // Hidden - no UI display
      document.body.appendChild(video);
      videoRef.current = video;

      await video.play();

      setState(prev => ({ 
        ...prev, 
        isLoading: false, 
        isUsingCamera: true, 
        isCameraAvailable: true 
      }));

      // Start processing loop
      processFrame();
      
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
    const faceLandmarker = faceLandmarkerRef.current;

    if (!video || !faceLandmarker || video.readyState < 2) {
      animationFrameRef.current = requestAnimationFrame(processFrame);
      return;
    }

    const now = performance.now();
    
    // Throttle processing to UPDATE_INTERVAL_MS
    if (now - lastProcessTimeRef.current >= UPDATE_INTERVAL_MS) {
      lastProcessTimeRef.current = now;

      try {
        const result: FaceLandmarkerResult = faceLandmarker.detectForVideo(video, now);
        
        if (result.faceLandmarks && result.faceLandmarks.length > 0) {
          const landmarks = result.faceLandmarks[0];
          const tiltDegrees = calculateHeadTilt(landmarks);
          const score = tiltToPostureScore(tiltDegrees);
          
          setState(prev => ({
            ...prev,
            postureScore: score,
            isDistracted: score < POSTURE_THRESHOLD,
          }));
        }
      } catch (error) {
        console.error("[PostureDetection] Frame processing error:", error);
      }
    }

    animationFrameRef.current = requestAnimationFrame(processFrame);
  }, []);

  // ---- Stop Camera ----
  const stopCamera = useCallback(() => {
    // Cancel animation frame
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    // Stop media stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    // Remove video element
    if (videoRef.current) {
      videoRef.current.remove();
      videoRef.current = null;
    }

    setState(prev => ({ 
      ...prev, 
      isUsingCamera: false,
      postureScore: 1,
      isDistracted: false,
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
    };
  }, [stopCamera]);

  // ---- Return Values ----
  // If camera is active, use real detection; otherwise use fallback
  return {
    postureScore: state.isUsingCamera ? state.postureScore : fallback.postureScore,
    isDistracted: state.isUsingCamera ? state.isDistracted : fallback.isDistracted,
    isUsingCamera: state.isUsingCamera,
    isCameraAvailable: state.isCameraAvailable,
    isLoading: state.isLoading,
    error: state.error,
    startCamera,
    stopCamera,
  };
}

// ---- END MediaPipe Posture Detection Hook ----
