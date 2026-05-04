/**
 * PHASE 4: Session Manager
 * Handles session lifecycle + STOMP communication
 */

import { stompClient } from './wsClient';
import { useGazeStore } from '../store/gazeStore';
import { SessionStartPayload, SessionEndPayload } from './types';

export class SessionManager {
  /**
   * Start a gaze tracking session
   */
  static async startSession(
    taskId: string,
    metadata: Record<string, any> = {}
  ): Promise<string> {
    if (!stompClient.isConnected()) {
      throw new Error('WebSocket not connected - cannot start session');
    }

    // Start session in store
    useGazeStore.getState().startSession(taskId, metadata);
    const session = useGazeStore.getState().session;

    if (!session) {
      throw new Error('Failed to initialize session in store');
    }

    // Prepare payload
    const payload: SessionStartPayload = {
      sessionId: session.sessionId,
      taskId,
      metadata: {
        userId: metadata.userId || 'anonymous',
        timestamp: Date.now(),
        ...metadata,
      },
    };

    // Send to server
    try {
      stompClient.publish('/app/gaze.session.start', payload);
      console.log('[SessionManager] Session started:', session.sessionId);
      return session.sessionId;
    } catch (error) {
      console.error('[SessionManager] Failed to start session:', error);
      useGazeStore.getState().endSession();
      throw error;
    }
  }

  /**
   * End the current gaze tracking session
   */
  static async endSession(): Promise<void> {
    if (!stompClient.isConnected()) {
      console.warn('[SessionManager] WebSocket not connected, ending session locally only');
    }

    const session = useGazeStore.getState().endSession();
    if (!session) {
      console.warn('[SessionManager] No active session to end');
      return;
    }

    const metrics = useGazeStore.getState().metrics;

    // Prepare payload
    const payload: SessionEndPayload = {
      sessionId: session.sessionId,
      frameCount: session.frameCount,
      featureCount: session.featureCount,
      durationMs: Date.now() - session.startTime,
      metrics: {
        avgFixationDuration: metrics.latencyMs,
        readingPace: metrics.framesPerSecond,
      },
    };

    // Send to server (best effort)
    if (stompClient.isConnected()) {
      try {
        stompClient.publish('/app/gaze.session.end', payload);
        console.log('[SessionManager] Session ended:', session.sessionId);
      } catch (error) {
        console.error('[SessionManager] Failed to send session end:', error);
      }
    }
  }

  /**
   * Get current session ID
   */
  static getCurrentSessionId(): string | null {
    return useGazeStore.getState().session?.sessionId || null;
  }

  /**
   * Check if session is active
   */
  static isSessionActive(): boolean {
    return useGazeStore.getState().isSessionActive();
  }

  /**
   * Get session summary
   */
  static getSessionSummary() {
    const session = useGazeStore.getState().session;
    const metrics = useGazeStore.getState().metrics;

    if (!session) return null;

    return {
      sessionId: session.sessionId,
      taskId: session.taskId,
      duration: Date.now() - session.startTime,
      frameCount: session.frameCount,
      featureCount: session.featureCount,
      framesPerSecond: metrics.framesPerSecond,
      acksReceived: metrics.acksReceived,
      framesDropped: metrics.framesDropped,
      averageLatency: metrics.latencyMs,
      rateLimited: metrics.rateLimited,
    };
  }
}

export default SessionManager;
