import type { GameManifest } from "@ai-arcade/shared";

export type AssetSummary = {
  id: string;
  originalName: string;
  mimeType: string;
  size: number;
  publicUrl: string;
};

export type IntentPlan = {
  genre: string;
  mode?: "avoid-collect" | "memory-match" | "runner" | "garden-sequence";
  coreMechanics: string[];
  artStyle: string;
  playerGoal: string;
  winCondition: string;
  loseCondition: string;
  controls: string[];
  entities: string[];
  mood: string;
  seed: number;
};

export type GameDesignSpec = {
  title: string;
  description: string;
  tags: string[];
  coverPrompt: string;
  gameplayLoop: string;
  controls: string[];
  scoring: string;
  difficulty: "easy" | "medium" | "hard";
  runtimeRequirements: string[];
  theme: {
    background: string;
    primary: string;
    accent: string;
    danger: string;
  };
  durationSeconds: number;
};

export type GameSourceFiles = {
  indexHtml: string;
  gameJs: string;
  styleCss: string;
};

export type SafetyReview = {
  passed: boolean;
  findings: string[];
  files: GameSourceFiles;
};

export type PackagedArtifact = {
  gameId: string;
  version: number;
  title: string;
  description: string;
  tags: string[];
  coverUrl: string;
  bucket: string;
  prefix: string;
  artifactBaseUrl: string;
  manifestUrl: string;
  manifest: GameManifest;
  files: Array<{
    path:
      | "index.html"
      | "game.js"
      | "style.css"
      | "manifest.json"
      | "cover.svg";
    body: string;
    contentType: string;
  }>;
};

export type PublishedArtifact = {
  gameId: string;
  versionId: string;
  manifestUrl: string;
  artifactBaseUrl: string;
};
