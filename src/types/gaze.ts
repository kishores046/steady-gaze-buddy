export interface GazeDataPoint {
  timestamp: number;
  gazeX: number;
  gazeY: number;
  leftIrisX: number;
  leftIrisY: number;
  rightIrisX: number;
  rightIrisY: number;
  textScrollOffset: number;
  currentWord: string;
  faceDetected: boolean;
  confidence: number;
}

export interface SessionData {
  startTime: number;
  endTime: number;
  gazePoints: GazeDataPoint[];
  totalPointsTarget: number;
  duration: number;
}
