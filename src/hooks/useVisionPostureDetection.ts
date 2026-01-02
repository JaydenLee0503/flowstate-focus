import { useState, useRef, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface PostureState {
  postureScore: number;
  isDistracted: boolean;
  analysis: string;
  isCameraOn: boolean;
  isLoading: boolean;
  error: string | null;
}

const ANALYSIS_INTERVAL = 3000; // Analyze every 3 seconds to avoid rate limits

export function useVisionPostureDetection() {
  const [state, setState] = useState<PostureState>({
    postureScore: 0.8,
    isDistracted: false,
    analysis: '',
    isCameraOn: false,
    isLoading: false,
    error: null,
  });

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const captureFrame = useCallback((): string | null => {
    const video = videoRef.current;
    let canvas = canvasRef.current;
    
    if (!video || !video.videoWidth || !video.videoHeight) {
      return null;
    }

    // Create canvas if not exists
    if (!canvas) {
      canvas = document.createElement('canvas');
      canvasRef.current = canvas;
    }

    // Resize to reduce payload (320x240 is enough for posture detection)
    canvas.width = 320;
    canvas.height = 240;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    // Convert to base64 JPEG (smaller than PNG)
    const dataUrl = canvas.toDataURL('image/jpeg', 0.6);
    return dataUrl.split(',')[1]; // Remove data:image/jpeg;base64, prefix
  }, []);

  const analyzePosture = useCallback(async () => {
    const imageBase64 = captureFrame();
    if (!imageBase64) return;

    try {
      const { data, error } = await supabase.functions.invoke('analyze-posture', {
        body: { imageBase64 }
      });

      if (error) {
        console.error('Posture analysis error:', error);
        return;
      }

      setState(prev => ({
        ...prev,
        postureScore: data.postureScore ?? prev.postureScore,
        isDistracted: data.isDistracted ?? prev.isDistracted,
        analysis: data.analysis ?? prev.analysis,
      }));
    } catch (err) {
      console.error('Failed to analyze posture:', err);
    }
  }, [captureFrame]);

  const startCamera = useCallback(async () => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: 'user' }
      });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      setState(prev => ({ ...prev, isCameraOn: true, isLoading: false }));

      // Start periodic analysis
      intervalRef.current = setInterval(analyzePosture, ANALYSIS_INTERVAL);
      
      // Run first analysis after video is ready
      setTimeout(analyzePosture, 1000);

    } catch (err) {
      console.error('Camera access error:', err);
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: err instanceof Error ? err.message : 'Camera access denied',
      }));
    }
  }, [analyzePosture]);

  const stopCamera = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setState(prev => ({
      ...prev,
      isCameraOn: false,
      postureScore: 0.8,
      isDistracted: false,
      analysis: '',
    }));
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  return {
    ...state,
    videoRef,
    startCamera,
    stopCamera,
  };
}
