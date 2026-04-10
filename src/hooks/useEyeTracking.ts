import { useRef, useState, useCallback, useEffect } from "react";
import "@tensorflow/tfjs";
import * as faceLandmarksDetection from "@tensorflow-models/face-landmarks-detection";
import type { GazeDataPoint } from "@/types/gaze";

const PROCESS_INTERVAL = 200; // 5 FPS

interface CalibrationOffset {
  x: number;
  y: number;
}

interface UseEyeTrackingOptions {
  enabled: boolean;
  onGazePoint?: (point: GazeDataPoint) => void;
  scrollOffset?: number;
  storyWords?: string[];
}

export function useEyeTracking({ enabled, onGazePoint, scrollOffset = 0, storyWords = [] }: UseEyeTrackingOptions) {
  const detectorRef = useRef<faceLandmarksDetection.FaceLandmarksDetector | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [modelLoaded, setModelLoaded] = useState(false);
  const [modelLoading, setModelLoading] = useState(false);
  const [faceDetected, setFaceDetected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const calibrationRef = useRef<CalibrationOffset>({ x: 0, y: 0 });
  const trackingRef = useRef(false);
  const startTimeRef = useRef(0);
  const gazeDataRef = useRef<GazeDataPoint[]>([]);
  const lastProcessTimeRef = useRef(0);
  const rafRef = useRef<number>(0);

  // Load model
  const loadModel = useCallback(async () => {
    if (detectorRef.current || modelLoading) return;
    setModelLoading(true);
    try {
      const model = faceLandmarksDetection.SupportedModels.MediaPipeFaceMesh;
      const detector = await faceLandmarksDetection.createDetector(model, {
        runtime: "tfjs" as const,
        refineLandmarks: true,
        maxFaces: 1,
      });
      detectorRef.current = detector;
      setModelLoaded(true);
    } catch (err) {
      console.error("Failed to load FaceMesh model:", err);
      setError("Failed to load eye tracking model");
    } finally {
      setModelLoading(false);
    }
  }, [modelLoading]);

  // Start camera
  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: 320, height: 240, frameRate: { ideal: 15 } },
      });
      const video = document.createElement("video");
      video.srcObject = stream;
      video.autoplay = true;
      video.playsInline = true;
      video.muted = true;
      await video.play();
      videoRef.current = video;
      return stream;
    } catch {
      setError("Camera not available");
      return null;
    }
  }, []);

  // Single frame detection
  const detectFace = useCallback(async () => {
    if (!detectorRef.current || !videoRef.current) return null;
    if (videoRef.current.readyState < 2) return null;

    try {
      const faces = await detectorRef.current.estimateFaces(videoRef.current, {
        flipHorizontal: true,
      });

      if (faces.length === 0) {
        setFaceDetected(false);
        return null;
      }

      setFaceDetected(true);
      const face = faces[0];

      // Extract iris landmarks (468 = left iris center, 473 = right iris center)
      const leftIris = face.keypoints[468];
      const rightIris = face.keypoints[473];

      if (!leftIris || !rightIris) return null;

      // Average gaze position
      const rawGazeX = (leftIris.x + rightIris.x) / 2;
      const rawGazeY = (leftIris.y + rightIris.y) / 2;

      // Normalize to 0-1 based on video dimensions
      const videoW = videoRef.current.videoWidth || 320;
      const videoH = videoRef.current.videoHeight || 240;
      const normalizedX = rawGazeX / videoW + calibrationRef.current.x;
      const normalizedY = rawGazeY / videoH + calibrationRef.current.y;

      return {
        gazeX: Math.max(0, Math.min(1, normalizedX)),
        gazeY: Math.max(0, Math.min(1, normalizedY)),
        leftIrisX: leftIris.x,
        leftIrisY: leftIris.y,
        rightIrisX: rightIris.x,
        rightIrisY: rightIris.y,
        confidence: (face as any).box ? 0.95 : 0.85,
      };
    } catch (err) {
      console.error("Face detection error:", err);
      return null;
    }
  }, []);

  // Calibrate at a specific point
  const calibrateAtPoint = useCallback(async (targetX: number, targetY: number) => {
    const result = await detectFace();
    if (!result) return null;
    return {
      targetX,
      targetY,
      detectedX: result.gazeX,
      detectedY: result.gazeY,
      offsetX: targetX - result.gazeX,
      offsetY: targetY - result.gazeY,
    };
  }, [detectFace]);

  // Set calibration offsets
  const setCalibration = useCallback((offsets: { offsetX: number; offsetY: number }[]) => {
    if (offsets.length === 0) return;
    const avgX = offsets.reduce((s, o) => s + o.offsetX, 0) / offsets.length;
    const avgY = offsets.reduce((s, o) => s + o.offsetY, 0) / offsets.length;
    calibrationRef.current = { x: avgX, y: avgY };
  }, []);

  // Start tracking loop
  const startTracking = useCallback(() => {
    startTimeRef.current = Date.now();
    gazeDataRef.current = [];
    trackingRef.current = true;
    lastProcessTimeRef.current = 0;

    const loop = async () => {
      if (!trackingRef.current) return;

      const now = Date.now();
      if (now - lastProcessTimeRef.current >= PROCESS_INTERVAL) {
        lastProcessTimeRef.current = now;
        const result = await detectFace();

        if (result) {
          const elapsed = now - startTimeRef.current;
          const wordIndex = Math.floor((scrollOffset / 10) % Math.max(1, storyWords.length));

          const point: GazeDataPoint = {
            timestamp: elapsed,
            gazeX: result.gazeX,
            gazeY: result.gazeY,
            leftIrisX: result.leftIrisX,
            leftIrisY: result.leftIrisY,
            rightIrisX: result.rightIrisX,
            rightIrisY: result.rightIrisY,
            textScrollOffset: scrollOffset,
            currentWord: storyWords[wordIndex] || "",
            faceDetected: true,
            confidence: result.confidence,
          };

          gazeDataRef.current.push(point);
          onGazePoint?.(point);
        } else {
          // Still record a point with faceDetected=false for continuity
          const elapsed = now - startTimeRef.current;
          const point: GazeDataPoint = {
            timestamp: elapsed,
            gazeX: 0,
            gazeY: 0,
            leftIrisX: 0,
            leftIrisY: 0,
            rightIrisX: 0,
            rightIrisY: 0,
            textScrollOffset: scrollOffset,
            currentWord: "",
            faceDetected: false,
            confidence: 0,
          };
          gazeDataRef.current.push(point);
          onGazePoint?.(point);
        }
      }

      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);
  }, [detectFace, onGazePoint, scrollOffset, storyWords]);

  const stopTracking = useCallback(() => {
    trackingRef.current = false;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      trackingRef.current = false;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (videoRef.current?.srcObject) {
        (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop());
      }
    };
  }, []);

  return {
    modelLoaded,
    modelLoading,
    faceDetected,
    error,
    loadModel,
    startCamera,
    detectFace,
    calibrateAtPoint,
    setCalibration,
    startTracking,
    stopTracking,
    gazeDataRef,
    videoRef,
  };
}
