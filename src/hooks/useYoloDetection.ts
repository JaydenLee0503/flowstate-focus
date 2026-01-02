// ---- FLOWSTATE: YOLO Object Detection Hook ----
// Uses YOLO via Hugging Face Transformers to detect distracting objects (phones, food, etc.)

import { useEffect, useState, useRef, useCallback } from "react";
import { pipeline, env, ObjectDetectionPipeline } from "@huggingface/transformers";

// Configure transformers.js
env.allowLocalModels = false;
env.useBrowserCache = true;

// Detection configuration
const DETECTION_INTERVAL_MS = 2000; // Check every 2 seconds (YOLO is heavier than MediaPipe)
const CONFIDENCE_THRESHOLD = 0.4;

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

interface DetectionState {
  phoneDetected: boolean;
  deskCluttered: boolean;
  distractingItems: string[];
  isLoading: boolean;
  isModelLoaded: boolean;
  error: string | null;
}

export function useYoloDetection(videoRef: React.RefObject<HTMLVideoElement | null>, isActive: boolean) {
  const [state, setState] = useState<DetectionState>({
    phoneDetected: false,
    deskCluttered: false,
    distractingItems: [],
    isLoading: false,
    isModelLoaded: false,
    error: null,
  });

  const detectorRef = useRef<ObjectDetectionPipeline | null>(null);
  const intervalRef = useRef<number | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Initialize YOLO model
  const initializeModel = useCallback(async () => {
    if (detectorRef.current) return true;
    
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));
      console.log("[YOLO] Loading object detection model...");
      
      // Use DETR (Detection Transformer) which is well-supported in transformers.js
      // It's more accurate than YOLOv5 for browser use
      const detector = await pipeline(
        'object-detection',
        'Xenova/detr-resnet-50',
        { device: 'webgpu' }
      );
      
      detectorRef.current = detector as ObjectDetectionPipeline;
      
      // Create canvas for frame capture
      canvasRef.current = document.createElement('canvas');
      
      console.log("[YOLO] Model loaded successfully");
      setState(prev => ({ ...prev, isLoading: false, isModelLoaded: true }));
      return true;
    } catch (error) {
      console.error("[YOLO] Model loading failed:", error);
      setState(prev => ({ 
        ...prev, 
        isLoading: false, 
        error: "Failed to load detection model" 
      }));
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
    
    // Use smaller resolution for faster detection
    canvas.width = 320;
    canvas.height = 240;
    ctx.drawImage(video, 0, 0, 320, 240);
    
    return canvas.toDataURL('image/jpeg', 0.7);
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
      
      // Filter and categorize detected objects
      const detectedLabels = results
        .filter((r: any) => r.score >= CONFIDENCE_THRESHOLD)
        .map((r: any) => r.label.toLowerCase());
      
      // Check for phone
      const phoneDetected = detectedLabels.some(label => 
        PHONE_LABELS.some(phoneLabel => label.includes(phoneLabel))
      );
      
      // Check for clutter (3+ items or food items)
      const clutterItems = detectedLabels.filter(label =>
        CLUTTER_LABELS.some(clutterLabel => label.includes(clutterLabel))
      );
      const deskCluttered = clutterItems.length >= 2 || 
        detectedLabels.some(label => ['pizza', 'donut', 'cake', 'sandwich'].includes(label));
      
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
      }));
      
      if (distractingItems.length > 0) {
        console.log("[YOLO] Detected:", distractingItems);
      }
      
    } catch (error) {
      console.error("[YOLO] Detection error:", error);
    }
  }, [captureFrame, isActive]);

  // Start/stop detection loop based on isActive
  useEffect(() => {
    if (isActive && !detectorRef.current && !state.isLoading) {
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
      // Note: Pipeline doesn't have a dispose method, garbage collection handles it
    };
  }, []);

  return {
    phoneDetected: state.phoneDetected,
    deskCluttered: state.deskCluttered,
    distractingItems: state.distractingItems,
    isModelLoading: state.isLoading,
    isModelLoaded: state.isModelLoaded,
    error: state.error,
  };
}
