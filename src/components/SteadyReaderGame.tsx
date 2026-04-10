import { useState, useEffect, useRef, useCallback } from "react";
import CameraPreview from "./CameraPreview";
import Mascot from "./Mascot";
import type { GazeDataPoint, SessionData } from "@/types/gaze";
import type { useEyeTracking } from "@/hooks/useEyeTracking";

interface SteadyReaderGameProps {
  onComplete: (data: SessionData) => void;
  eyeTracking: ReturnType<typeof useEyeTracking>;
}

const STORY_TEXT =
  "Once upon a time, in a small village, lived a curious boy named Raj. He loved exploring the forest near his home. One sunny day, Raj found a mysterious golden key hidden under an old oak tree. The key sparkled in the sunlight and felt warm in his hand. Raj wondered what door it could open. He decided to search for the lock that matched this special key. His adventure was just beginning, and he felt excited about the mysteries that awaited him in the forest. The birds sang cheerful songs as Raj walked deeper into the woods. He noticed colorful flowers and tall mushrooms along the path.";

const STORY_WORDS = STORY_TEXT.split(" ");
const DURATION = 60;
const TARGET_POINTS = 300;
const CAPTURE_INTERVAL = 200;

const ENCOURAGEMENTS = [
  { time: 45, msg: "You're doing great! 🌟" },
  { time: 30, msg: "Keep reading! 📖" },
  { time: 15, msg: "Almost there! 💪" },
  { time: 5, msg: "Excellent work! 🎉" },
];

const SteadyReaderGame = ({ onComplete, eyeTracking }: SteadyReaderGameProps) => {
  const [timeLeft, setTimeLeft] = useState(DURATION);
  const [started, setStarted] = useState(false);
  const [scrollOffset, setScrollOffset] = useState(0);
  const [mascotMsg, setMascotMsg] = useState("Let's read a story! 📖");
  const [pointsCollected, setPointsCollected] = useState(0);
  const [noFaceWarning, setNoFaceWarning] = useState(false);
  const gazeDataRef = useRef<GazeDataPoint[]>([]);
  const startTimeRef = useRef(0);
  const textRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef(0);
  const trackingIntervalRef = useRef<number>(0);

  // Timer
  useEffect(() => {
    if (!started || timeLeft <= 0) return;
    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [started, timeLeft]);

  // End game
  useEffect(() => {
    if (started && timeLeft === 0) {
      if (trackingIntervalRef.current) clearInterval(trackingIntervalRef.current);

      const session: SessionData = {
        startTime: startTimeRef.current,
        endTime: Date.now(),
        gazePoints: gazeDataRef.current,
        totalPointsTarget: TARGET_POINTS,
        duration: DURATION,
      };
      try {
        localStorage.setItem("dyslexia_session_latest", JSON.stringify(session));
      } catch { /* ignore */ }
      onComplete(session);
    }
  }, [timeLeft, started, onComplete]);

  // Mascot messages
  useEffect(() => {
    if (!started) return;
    const enc = ENCOURAGEMENTS.find((e) => e.time === timeLeft);
    if (enc) setMascotMsg(enc.msg);
  }, [timeLeft, started]);

  // Text scroll animation
  useEffect(() => {
    if (!started || timeLeft <= 0) return;
    const frame = setInterval(() => {
      scrollRef.current += 1.5;
      setScrollOffset(scrollRef.current);
    }, 33);
    return () => clearInterval(frame);
  }, [started, timeLeft]);

  // Real gaze tracking at 5 FPS
  useEffect(() => {
    if (!started || timeLeft <= 0) return;

    const interval = setInterval(async () => {
      const result = await eyeTracking.detectFace();
      const elapsed = Date.now() - startTimeRef.current;
      const wordIndex = Math.floor((scrollRef.current / 10) % STORY_WORDS.length);

      if (result) {
        setNoFaceWarning(false);
        const point: GazeDataPoint = {
          timestamp: elapsed,
          gazeX: result.gazeX,
          gazeY: result.gazeY,
          leftIrisX: result.leftIrisX,
          leftIrisY: result.leftIrisY,
          rightIrisX: result.rightIrisX,
          rightIrisY: result.rightIrisY,
          textScrollOffset: scrollRef.current,
          currentWord: STORY_WORDS[wordIndex] || "",
          faceDetected: true,
          confidence: result.confidence,
        };
        gazeDataRef.current.push(point);
        setPointsCollected(gazeDataRef.current.length);
      } else {
        setNoFaceWarning(true);
        // Record no-face point
        const point: GazeDataPoint = {
          timestamp: elapsed,
          gazeX: 0,
          gazeY: 0,
          leftIrisX: 0,
          leftIrisY: 0,
          rightIrisX: 0,
          rightIrisY: 0,
          textScrollOffset: scrollRef.current,
          currentWord: "",
          faceDetected: false,
          confidence: 0,
        };
        gazeDataRef.current.push(point);
        setPointsCollected(gazeDataRef.current.length);
      }
    }, CAPTURE_INTERVAL);

    trackingIntervalRef.current = interval as unknown as number;
    return () => clearInterval(interval);
  }, [started, timeLeft, eyeTracking]);

  const handleStart = useCallback(() => {
    startTimeRef.current = Date.now();
    scrollRef.current = 0;
    gazeDataRef.current = [];
    setStarted(true);
  }, []);

  const timerColor =
    timeLeft > 30 ? "text-success" : timeLeft > 10 ? "text-warning" : "text-destructive";

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  if (!started) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 gap-6">
        <div className="text-center space-y-3 animate-fade-in-up">
          <h1 className="text-3xl sm:text-4xl font-bold text-primary font-display">
            📖 Steady Reader 📖
          </h1>
          <p className="text-lg text-muted-foreground max-w-md">
            Read the story that scrolls across the screen. Keep your eyes on the words!
          </p>
        </div>

        {/* Camera check */}
        <div className="flex items-center gap-3">
          <CameraPreview videoElement={eyeTracking.videoRef.current} faceDetected={eyeTracking.faceDetected} />
          <span className="text-sm text-muted-foreground">
            {eyeTracking.modelLoaded ? "✅ Eye tracking ready" : "⏳ Loading model..."}
          </span>
        </div>

        <Mascot message="Ready to read a fun story?" />
        <button
          onClick={handleStart}
          className="px-8 py-4 bg-primary text-primary-foreground rounded-2xl text-xl font-bold shadow-lg hover:scale-105 transition-all duration-300 min-h-[56px]"
        >
          Start Reading! 📚
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cream flex flex-col relative overflow-hidden">
      {/* Top bar */}
      <div className="flex items-center justify-between p-3 sm:p-4 bg-card/80 backdrop-blur-sm shadow-sm z-10">
        <div className="flex items-center gap-3">
          <CameraPreview videoElement={eyeTracking.videoRef.current} faceDetected={eyeTracking.faceDetected} />
          {noFaceWarning && (
            <span className="text-sm text-destructive font-bold animate-pulse">
              Move closer! 📷
            </span>
          )}
        </div>
        <div className={`text-2xl sm:text-3xl font-bold font-display ${timerColor} transition-colors duration-300`}>
          ⏱️ {formatTime(timeLeft)}
        </div>
      </div>

      {/* Story area */}
      <div className="flex-1 flex items-center justify-center px-4 sm:px-8">
        <div className="w-full max-w-[70%] overflow-hidden relative">
          <div
            ref={textRef}
            className="whitespace-nowrap text-foreground font-body leading-relaxed"
            style={{
              fontSize: "clamp(18px, 4vw, 22px)",
              lineHeight: 1.5,
              transform: `translateX(-${scrollOffset}px)`,
              transition: "transform 33ms linear",
            }}
          >
            {STORY_TEXT}
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="flex items-end justify-between p-3 sm:p-4 bg-card/80 backdrop-blur-sm z-10">
        <Mascot message={mascotMsg} />
        <div className="flex flex-col items-end gap-1">
          <span className="text-sm font-bold text-muted-foreground">
            {pointsCollected}/{TARGET_POINTS}
          </span>
          <div className="flex gap-1">
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className={`w-3 h-3 rounded-full transition-all duration-300 ${
                  i < Math.floor((pointsCollected / TARGET_POINTS) * 5)
                    ? "bg-primary"
                    : "bg-muted"
                }`}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SteadyReaderGame;
