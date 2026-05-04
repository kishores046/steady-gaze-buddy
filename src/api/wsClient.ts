/**
 * PHASE 3: STOMP WebSocket Client with JWT Authentication
 * SockJS fallback + auto-reconnect + heartbeat management
 */

import { Client, Message, messageFrame } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import { getStoredTokens, authService } from './authService';
import { ConnectionStatus } from './types';

const WS_URL = process.env.REACT_APP_WS_URL || 'http://localhost:8080/ws/gaze';

type ConnectionCallback = (status: ConnectionStatus) => void;
type MessageCallback = (message: Message) => void;

class StompWebSocketClient {
  private client: Client | null = null;
  private connectionStatus: ConnectionStatus = 'DISCONNECTED';
  private connectionCallbacks: Set<ConnectionCallback> = new Set();
  private messageSubscriptions: Map<string, Set<MessageCallback>> = new Map();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectDelay = 3000;
  private heartbeatIncoming = 10000;
  private heartbeatOutgoing = 10000;
  private isIntentionallyClosed = false;

  /**
   * Subscribe to connection status changes
   */
  onConnectionChange(callback: ConnectionCallback): () => void {
    this.connectionCallbacks.add(callback);
    // Immediately call with current status
    callback(this.connectionStatus);
    
    return () => {
      this.connectionCallbacks.delete(callback);
    };
  }

  /**
   * Set connection status and notify all listeners
   */
  private setConnectionStatus(status: ConnectionStatus): void {
    if (this.connectionStatus !== status) {
      this.connectionStatus = status;
      console.log(`[STOMP] Connection status: ${status}`);
      this.connectionCallbacks.forEach(cb => cb(status));
    }
  }

  /**
   * Connect to STOMP server with JWT in headers
   */
  async connect(): Promise<void> {
    if (this.client?.active) {
      console.warn('[STOMP] Already connected');
      return;
    }

    this.isIntentionallyClosed = false;
    this.setConnectionStatus('CONNECTING');

    try {
      // Ensure token is valid
      if (!authService.isAuthenticated()) {
        throw new Error('Not authenticated - cannot connect to WebSocket');
      }

      const tokens = getStoredTokens();
      if (!tokens) {
        throw new Error('No access token available');
      }

      // Create STOMP client with SockJS transport
      this.client = new Client({
        brokerURL: undefined, // Use webSocketFactory instead
        webSocketFactory: () => {
          return new SockJS(WS_URL) as WebSocket;
        },
        connectHeaders: {
          Authorization: `Bearer ${tokens.accessToken}`,
          'login': '', // Some servers require this
        },
        heartbeatIncoming: this.heartbeatIncoming,
        heartbeatOutgoing: this.heartbeatOutgoing,
        reconnectDelay: this.reconnectDelay,
        splitLargeFrames: true,
        maxWebSocketFrameSize: 128000, // 128KB max frame
        onConnect: this.onStompConnect.bind(this),
        onStompError: this.onStompError.bind(this),
        onWebSocketClose: this.onWebSocketClose.bind(this),
        onWebSocketError: this.onWebSocketError.bind(this),
      });

      this.client.activate();
    } catch (error) {
      console.error('[STOMP] Connection failed:', error);
      this.setConnectionStatus('ERROR');
      throw error;
    }
  }

  /**
   * Called when STOMP connection is established
   */
  private onStompConnect(): void {
    console.log('[STOMP] Connected');
    this.setConnectionStatus('CONNECTED');
    this.reconnectAttempts = 0;

    // Subscribe to default queues
    this.subscribeToDefaultQueues();
  }

  /**
   * Called on STOMP protocol error
   */
  private onStompError(frame: messageFrame): void {
    console.error('[STOMP] Error frame:', frame.body);
    this.setConnectionStatus('ERROR');
  }

  /**
   * Called when WebSocket closes
   */
  private onWebSocketClose(): void {
    console.log('[STOMP] WebSocket closed');
    
    if (this.isIntentionallyClosed) {
      this.setConnectionStatus('DISCONNECTED');
    } else {
      this.setConnectionStatus('RECONNECTING');
    }
  }

  /**
   * Called on WebSocket error
   */
  private onWebSocketError(error: Event): void {
    console.error('[STOMP] WebSocket error:', error);
    this.setConnectionStatus('ERROR');
  }

  /**
   * Subscribe to default system queues
   */
  private subscribeToDefaultQueues(): void {
    this.subscribe('/user/queue/ack', (message) => {
      this.handleMessage('/user/queue/ack', message);
    });

    this.subscribe('/user/queue/result', (message) => {
      this.handleMessage('/user/queue/result', message);
    });

    this.subscribe('/user/queue/errors', (message) => {
      this.handleMessage('/user/queue/errors', message);
    });
  }

  /**
   * Subscribe to a destination
   */
  subscribe(destination: string, callback: MessageCallback): () => void {
    if (!this.client?.connected) {
      console.warn(`[STOMP] Not connected, cannot subscribe to ${destination}`);
      return () => {};
    }

    // Add callback to subscriptions map
    if (!this.messageSubscriptions.has(destination)) {
      this.messageSubscriptions.set(destination, new Set());
    }
    this.messageSubscriptions.get(destination)!.add(callback);

    // Create STOMP subscription
    const subscription = this.client.subscribe(destination, (message) => {
      callback(message);
    });

    // Return unsubscribe function
    return () => {
      this.messageSubscriptions.get(destination)?.delete(callback);
      subscription.unsubscribe();
    };
  }

  /**
   * Dispatch message to all listeners
   */
  private handleMessage(destination: string, message: Message): void {
    const callbacks = this.messageSubscriptions.get(destination);
    if (callbacks) {
      callbacks.forEach(cb => {
        try {
          cb(message);
        } catch (error) {
          console.error(`[STOMP] Error in message handler for ${destination}:`, error);
        }
      });
    }
  }

  /**
   * Publish message to destination
   */
  publish(
    destination: string,
    body: Record<string, any> | string,
    skipContentLengthHeader = false
  ): void {
    if (!this.client?.connected) {
      console.warn('[STOMP] Not connected, cannot publish to', destination);
      return;
    }

    const bodyString = typeof body === 'string' ? body : JSON.stringify(body);

    try {
      this.client.publish({
        destination,
        body: bodyString,
        skipContentLengthHeader,
        headers: {
          'content-type': 'application/json',
        },
      });
    } catch (error) {
      console.error('[STOMP] Publish error:', error);
    }
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.client?.active === true && this.connectionStatus === 'CONNECTED';
  }

  /**
   * Get current connection status
   */
  getStatus(): ConnectionStatus {
    return this.connectionStatus;
  }

  /**
   * Disconnect gracefully
   */
  disconnect(): void {
    this.isIntentionallyClosed = true;
    
    if (this.client?.connected) {
      this.client.deactivate();
    }
    
    this.messageSubscriptions.clear();
    this.setConnectionStatus('DISCONNECTED');
    console.log('[STOMP] Disconnected');
  }

  /**
   * Force reconnect (reset reconnect counter and try again)
   */
  async forceReconnect(): Promise<void> {
    this.disconnect();
    await new Promise(resolve => setTimeout(resolve, 500));
    await this.connect();
  }

  /**
   * Get reconnect stats
   */
  getReconnectStats(): { attempts: number; delay: number; maxAttempts: number } {
    return {
      attempts: this.reconnectAttempts,
      delay: this.reconnectDelay,
      maxAttempts: this.maxReconnectAttempts,
    };
  }

  /**
   * Get subscription count
   */
  getSubscriptionCount(): number {
    return this.messageSubscriptions.size;
  }
}

// Singleton instance
export const stompClient = new StompWebSocketClient();

export default stompClient;
