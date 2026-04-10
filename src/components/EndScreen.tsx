import { useState, useEffect, useMemo } from "react";
import type { SessionData } from "@/types/gaze";
import { runFullAnalysis, type FullAnalysis } from "@/lib/featureExtraction";
import FeatureCard from "./FeatureCard";
import GazePathCanvas from "./GazePathCanvas";

interface EndScreenProps {
  sessionData: SessionData;
  onPlayAgain: () => void;
}

const EndScreen = ({ sessionData, onPlayAgain }: EndScreenProps) => {
  const [loading, setLoading] = useState(true);

  const result: FullAnalysis = useMemo(
    () => runFullAnalysis(sessionData.gazePoints, sessionData.duration),
    [sessionData]
  );

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 3000);
    return () => clearTimeout(timer);
  }, []);

  const handleExportAnalysis = () => {
    const { fixations, saccades, regressions, ...exportData } = result;
    const payload = {
      ...exportData,
      fixationCount: fixations.length,
      saccadeCount: saccades.length,
      regressionCount: regressions.length,
      rawGazeData: sessionData.gazePoints,
    };
    download(payload, `dyslexia-analysis-${Date.now()}.json`);
  };

  const handleExportRaw = () => {
    download(sessionData, `dyslexia-raw-${Date.now()}.json`);
  };

  const download = (data: unknown, filename: string) => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const collected = sessionData.gazePoints.length;
  const target = sessionData.totalPointsTarget;
  const pct = Math.round((collected / target) * 100);
  const concernCount = Object.values(result.analysis).filter((a) => a.status === "concern").length;

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-6">
        <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin-slow" />
        <p className="text-xl font-bold text-foreground animate-pulse font-display">
          ✨ Wonderful reading! Analyzing your pattern... ✨
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center p-4 sm:p-6 gap-6 overflow-y-auto">
      {/* Header */}
      <div className="animate-fade-in-up text-center space-y-2 pt-4">
        <h1 className="text-3xl sm:text-4xl font-bold text-primary font-display">
          Reading Analysis ✅
        </h1>
        <p className="text-lg text-muted-foreground">
          {concernCount === 0
            ? "Everything looks great! 🎉"
            : `${concernCount} area${concernCount > 1 ? "s" : ""} to review 🔍`}
        </p>
      </div>

      {/* Summary stats */}
      <div
        className="bg-card rounded-2xl shadow-lg p-5 w-full max-w-sm space-y-3 animate-fade-in-up"
        style={{ animationDelay: "0.1s" }}
      >
        <div className="flex justify-between items-center">
          <span className="text-muted-foreground">Gaze points</span>
          <span className="font-bold text-foreground">{collected}/{target}</span>
        </div>
        <div className="w-full bg-muted rounded-full h-3">
          <div
            className="bg-success h-3 rounded-full transition-all duration-1000"
            style={{ width: `${Math.min(pct, 100)}%` }}
          />
        </div>
        <div className="flex justify-between items-center">
          <span className="text-muted-foreground">Face detected</span>
          <span className="font-bold text-foreground">{result.faceDetectedPercent.toFixed(0)}%</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-muted-foreground">Avg confidence</span>
          <span className="font-bold text-foreground">{(result.avgConfidence * 100).toFixed(0)}%</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-muted-foreground">Fixations</span>
          <span className="font-bold text-foreground">{result.fixations.length}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-muted-foreground">Regressions</span>
          <span className="font-bold text-foreground">{result.regressions.length}</span>
        </div>
      </div>

      {/* Feature cards */}
      <div
        className="w-full max-w-2xl animate-fade-in-up"
        style={{ animationDelay: "0.2s" }}
      >
        <h2 className="text-xl font-bold text-foreground font-display mb-3">
          📊 Clinical Features
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {(Object.keys(result.analysis) as (keyof typeof result.analysis)[]).map((key) => (
            <FeatureCard key={key} item={result.analysis[key]} />
          ))}
        </div>
      </div>

      {/* Gaze path */}
      <div
        className="w-full max-w-2xl animate-fade-in-up"
        style={{ animationDelay: "0.3s" }}
      >
        <h2 className="text-xl font-bold text-foreground font-display mb-3">
          👁️ Reading Path
        </h2>
        <p className="text-sm text-muted-foreground mb-2">
          Circles = fixations (bigger = longer). Red lines = regressions (backward movements).
        </p>
        <GazePathCanvas
          fixations={result.fixations}
          saccades={result.saccades}
          width={Math.min(600, typeof window !== "undefined" ? window.innerWidth - 48 : 500)}
          height={200}
        />
      </div>

      {/* Actions */}
      <div
        className="flex flex-col sm:flex-row gap-3 mt-2 pb-8 animate-fade-in-up"
        style={{ animationDelay: "0.4s" }}
      >
        <button
          onClick={onPlayAgain}
          className="px-6 py-3 bg-primary text-primary-foreground rounded-2xl text-lg font-bold shadow-lg hover:scale-105 transition-all duration-300 min-h-[48px]"
        >
          🔄 Play Again
        </button>
        <button
          onClick={handleExportAnalysis}
          className="px-6 py-3 bg-secondary text-secondary-foreground rounded-2xl text-lg font-bold shadow-lg hover:scale-105 transition-all duration-300 min-h-[48px]"
        >
          📊 Export Analysis
        </button>
        <button
          onClick={handleExportRaw}
          className="px-6 py-3 bg-muted text-muted-foreground rounded-2xl text-lg font-bold shadow-lg hover:scale-105 transition-all duration-300 min-h-[48px]"
        >
          📥 Export Raw Data
        </button>
      </div>
    </div>
  );
};

export default EndScreen;
