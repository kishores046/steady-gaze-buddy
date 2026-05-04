/**
 * PHASE 5: useGazeStream Hook
 * 60Hz gaze frame streaming + client-side throttling
 */

import { useRef, useEffect, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { stompClient } from '../api/wsClient';
import { useGazeStore } from '../store/gazeStore';
import { GazeFrameDto } from '../api/types';

interface UseGazeStreamOptions {
  enabled?: boolean;
  targetFps?: number;
  onFrame?: (frame: GazeFrameDto) => void;
  onError?: (error: Error) => void;
}

const DEFAULT_TARGET_FPS = 60;
const FRAME_TIME_MS = 1000 / DEFAULT_TARGET_FPS;

/**
 * Hook for streaming gaze frames to backend at configurable FPS
 * Uses requestAnimationFrame for smooth timing, with fallback to setInterval
 */
export function useGazeStream({
  enabled = false,
  targetFps = DEFAULT_TARGET_FPS,
  onFrame,
  onError,
}: UseGazeStreamOptions = {}) {
  const frameIntervalMs = 1000 / targetFps;
  const rafRef = useRef<number>();
  const lastFrameTimeRef = useRef<number>(0);
  const frameCountRef = useRef<number>(0);
  const isStreamingRef = useRef<boolean>(false);

  const store = useGazeStore();

  /**
   * Create a gaze frame DTO from raw gaze data
   * In production, this would come from your gaze tracking pipeline
   */
  const createGazeFrame = useCallback((): GazeFrameDto => {
    const now = Date.now();
    const sessionStartTime = store.session?.startTime || now;

    return {
      frameId: uuidv4(),
      timestamp: now,
      gazeX: Math.random(), // Replace with actual gaze tracking
      gazeY: Math.random(), // Replace with actual gaze tracking
      confidence: 0.85 + Math.random() * 0.15, // Simulate confidence
      pupilSize: 3.0 + Math.random() * 0.5,
      validFrame: true,
      headRotationX: 0,
      headRotationY: 0,
      headRotationZ: 0,
      velocityX: 0,
      velocityY: 0,
    };
  }, [store.session?.startTime]);

  /**
   * Send frame to backend via STOMP
   */
  const sendFrame = useCallback((frame: GazeFrameDto) => {
    // Guard: check connection
    if (!stompClient.isConnected()) {
      return;
    }

    // Guard: check session
    const sessionId = store.session?.sessionId;
    if (!sessionId) {
      return;
    }

    // Guard: check rate limit
    if (store.metrics.rateLimited) {
      store.incrementDebugMetric('framesDropped');
      return;
    }

    // Publish to STOMP
    try {
      stompClient.publish('/app/gaze.frame', {
        ...frame,
        sessionId,
      });

      store.incrementFrameCount();
      frameCountRef.current++;

      // Callback
      onFrame?.(frame);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      onError?.(err);
      console.error('[useGazeStream] Send error:', err);
    }
  }, [store, onFrame, onError]);

  /**
   * Main streaming loop using requestAnimationFrame
   */
  const frameLoop = useCallback(() => {
    if (!isStreamingRef.current) {
      return;
    }

    const now = performance.now();
    const elapsed = now - lastFrameTimeRef.current;

    // Throttle to target FPS
    if (elapsed >= frameIntervalMs) {
      lastFrameTimeRef.current = now - (elapsed % frameIntervalMs);

      const frame = createGazeFrame();
      sendFrame(frame);
    }

    // Update FPS calculation periodically
    if (frameCountRef.current % 60 === 0) {
      store.calculateFramesPerSecond();
    }

    rafRef.current = requestAnimationFrame(frameLoop);
  }, [frameIntervalMs, createGazeFrame, sendFrame, store]);

  /**
   * Start streaming
   */
  const start = useCallback(async () => {
    if (isStreamingRef.current) {
      console.warn('[useGazeStream] Already streaming');
      return;
    }

    // Verify connection and session
    if (!stompClient.isConnected()) {
      const error = new Error('WebSocket not connected');
      onError?.(error);
      throw error;
    }

    if (!store.session?.sessionId) {
      const error = new Error('No active session');
      onError?.(error);
      throw error;
    }

    isStreamingRef.current = true;
    lastFrameTimeRef.current = performance.now();
    frameCountRef.current = 0;

    console.log('[useGazeStream] Started at', targetFps, 'FPS');
    rafRef.current = requestAnimationFrame(frameLoop);
  }, [frameLoop, targetFps, store.session?.sessionId, onError]);

  /**
   * Stop streaming
   */
  const stop = useCallback(() => {
    if (!isStreamingRef.current) {
      return;
    }

    isStreamingRef.current = false;

    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = undefined;
    }

    store.calculateFramesPerSecond();
    console.log('[useGazeStream] Stopped, sent', frameCountRef.current, 'frames');
  }, [store]);

  /**
   * Cleanup on unmount
   */
  useEffect(() => {
    return () => {
      stop();
    };
  }, [stop]);

  /**
   * Start/stop based on enabled flag
   */
  useEffect(() => {
    if (enabled) {
      start().catch(err => {
        console.error('[useGazeStream] Failed to start:', err);
      });
    } else {
      stop();
    }
  }, [enabled, start, stop]);

  return {
    isStreaming: isStreamingRef.current,
    frameCount: frameCountRef.current,
    start,
    stop,
  };
}

export default useGazeStream;
