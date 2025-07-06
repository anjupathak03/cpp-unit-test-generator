export interface CoverageSnap {
    filePct: number;        // 0–100
    projectPct: number;
    missedLines: number[];  // in target file
  }
  