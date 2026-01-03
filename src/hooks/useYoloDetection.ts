// ---- FLOWSTATE: YOLO Object Detection Hook ----
// Uses DETR via Hugging Face Transformers to detect distracting objects (phones, food, etc.)

import { useEffect, useState, useRef, useCallback } from "react";
import { pipeline, env } from "@huggingface/transformers";

// Configure transformers.js
env.allowLocalModels = false;
env.useBrowserCache = true;

// Detection configuration
const DETECTION_INTERVAL_MS = 2000; // Check every 2 seconds
const CONFIDENCE_THRESHOLD = 0.3; // Lower threshold for better detection

// Objects we consider distracting
const DISTRACTING_OBJECTS = [
  'cell phone', 'mobile phone', 'phone', 'remote',
  'book', 'pizza', 'donut', 'cake', 'sandwich', 'hot dog', 'apple', 'orange', 'banana',
  'cup', 'bottle', 'wine glass', 'bowl', 'fork', 'knife', 'spoon',
  'tv', 'laptop', 'mouse', 'keyboard',
  'scissors', 'teddy bear', 'sports ball', 'frisbee',
  'handbag', 'backpack', 'suitcase'
];

// Objects that indicate phone specifically
const PHONE_LABELS = ['cell phone', 'mobile phone', 'phone', 'remote'];

// Objects that indicate desk clutter (food, multiple items)
const CLUTTER_LABELS = [
  'pizza', 'donut', 'cake', 'sandwich', 'hot dog', 'apple', 'orange', 'banana',
  'cup', 'bottle', 'wine glass', 'bowl', 'fork', 'knife', 'spoon'
];

interface DetectionResult {
  label: string;
  score: number;
  box: {
    xmin: number;
    ymin: number;
    xmax: number;
    ymax: number;
  };
}

interface DetectionState {
  phoneDetected: boolean;
  deskCluttered: boolean;
  distractingItems: string[];
  allDetections: DetectionResult[];
  isLoading: boolean;
  isModelLoaded: boolean;
  error: string | null;
}

type ObjectDetectionPipeline = (
  image: string,
  options?: { threshold?: number }
) => Promise<DetectionResult[]>;

export function useYoloDetection(
  videoRef: React.RefObject<HTMLVideoElement | null>, 
  isActive: boolean
) {
  const [state, setState] = useState<DetectionState>({
    phoneDetected: false,
    deskCluttered: false,
    distractingItems: [],
    allDetections: [],
    isLoading: false,
    isModelLoaded: false,
    error: null,
  });

  const detectorRef = useRef<ObjectDetectionPipeline | null>(null);
  const intervalRef = useRef<number | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isInitializingRef = useRef(false);

  // Initialize YOLO model
  const initializeModel = useCallback(async () => {
    if (detectorRef.current || isInitializingRef.current) return true;
    
    isInitializingRef.current = true;
    
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));
      console.log("[YOLO] Loading object detection model (yolos-tiny)...");
      
      // Use a lighter, faster model that works better in browser
      // No WebGPU - use default WASM backend for reliability
      const detector = await pipeline(
        'object-detection',
        'Xenova/yolos-tiny',
        { 
          device: 'wasm',
          progress_callback: (progress: { status: string; progress?: number }) => {
            if (progress.status === 'progress' && progress.progress) {
              console.log(`[YOLO] Loading: ${Math.round(progress.progress)}%`);
            }
          }
        }
      );
      
      console.log("[YOLO] Model loaded successfully");
      
      detectorRef.current = detector as ObjectDetectionPipeline;
      
      // Create canvas for frame capture
      canvasRef.current = document.createElement('canvas');
      
      setState(prev => ({ ...prev, isLoading: false, isModelLoaded: true }));
      isInitializingRef.current = false;
      return true;
    } catch (error) {
      console.error("[YOLO] Model loading failed:", error);
      setState(prev => ({ 
        ...prev, 
        isLoading: false, 
        error: `Failed to load detection model: ${error instanceof Error ? error.message : 'Unknown error'}` 
      }));
      isInitializingRef.current = false;
      return false;
    }
  }, []);

  // Capture frame from video
  const captureFrame = useCallback((): string | null => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    if (!video || !canvas || video.readyState < 2) return null;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    
    // Use larger resolution for better detection
    canvas.width = 640;
    canvas.height = 480;
    ctx.drawImage(video, 0, 0, 640, 480);
    
    return canvas.toDataURL('image/jpeg', 0.8);
  }, [videoRef]);

  // Run detection on current frame
  const detectObjects = useCallback(async () => {
    const detector = detectorRef.current;
    if (!detector || !isActive) return;
    
    try {
      const frameData = captureFrame();
      if (!frameData) return;
      
      const results = await detector(frameData, {
        threshold: CONFIDENCE_THRESHOLD,
      });
      
      if (!Array.isArray(results)) return;
      
      // Store all detections for debugging
      const allDetections: DetectionResult[] = results
        .filter((r): r is DetectionResult => 
          typeof r === 'object' && 
          r !== null && 
          'label' in r && 
          'score' in r
        )
        .map(r => ({
          label: String(r.label).toLowerCase(),
          score: Number(r.score),
          box: r.box || { xmin: 0, ymin: 0, xmax: 0, ymax: 0 },
        }));
      
      // Filter for high confidence detections
      const detectedLabels = allDetections
        .filter(r => r.score >= CONFIDENCE_THRESHOLD)
        .map(r => r.label);
      
      // Check for phone
      const phoneDetected = detectedLabels.some(label => 
        PHONE_LABELS.some(phoneLabel => label.includes(phoneLabel))
      );
      
      // Check for clutter (2+ items or food items)
      const clutterItems = detectedLabels.filter(label =>
        CLUTTER_LABELS.some(clutterLabel => label.includes(clutterLabel))
      );
      const deskCluttered = clutterItems.length >= 2 || 
        detectedLabels.some(label => ['pizza', 'donut', 'cake', 'sandwich'].some(food => label.includes(food)));
      
      // Get unique distracting items
      const distractingItems = [...new Set(
        detectedLabels.filter(label =>
          DISTRACTING_OBJECTS.some(obj => label.includes(obj))
        )
      )];
      
      setState(prev => ({
        ...prev,
        phoneDetected,
        deskCluttered,
        distractingItems,
        allDetections,
      }));
      
      if (distractingItems.length > 0) {
        console.log("[YOLO] Detected:", distractingItems, "Confidence scores:", 
          allDetections.filter(d => distractingItems.includes(d.label)).map(d => `${d.label}: ${(d.score * 100).toFixed(1)}%`)
        );
      }
      
    } catch (error) {
      console.error("[YOLO] Detection error:", error);
    }
  }, [captureFrame, isActive]);

  // Start/stop detection loop based on isActive
  useEffect(() => {
    if (isActive && !detectorRef.current && !state.isLoading && !isInitializingRef.current) {
      initializeModel();
    }
    
    if (isActive && detectorRef.current) {
      // Start detection interval
      intervalRef.current = window.setInterval(detectObjects, DETECTION_INTERVAL_MS);
      
      // Run initial detection
      detectObjects();
    }
    
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isActive, initializeModel, detectObjects, state.isLoading]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  return {
    phoneDetected: state.phoneDetected,
    deskCluttered: state.deskCluttered,
    distractingItems: state.distractingItems,
    allDetections: state.allDetections,
    isModelLoading: state.isLoading,
    isModelLoaded: state.isModelLoaded,
    error: state.error,
  };
}
