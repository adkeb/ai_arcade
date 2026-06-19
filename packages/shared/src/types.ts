export type ApiSuccess<T> = {
  ok: true;
  data: T;
};

export type ApiFailure = {
  ok: false;
  error: {
    code: string;
    message: string;
  };
};

export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;

export type AssetAnalysis = {
  kind: "text" | "json" | "pdf" | "image" | "video" | "binary";
  summary: string;
  textExcerpt?: string;
  metadata: Record<string, string | number | boolean | null>;
  warnings?: string[];
};

export type ArtifactFile = {
  path: string;
  url: string;
  sha256: string;
  contentType: string;
};

export type GameManifest = {
  schemaVersion: "1.0";
  gameId: string;
  version: number;
  title: string;
  description: string;
  runtime: "iframe-html5-canvas";
  entry: "index.html";
  createdByJobId: string | null;
  files: ArtifactFile[];
  assets: ArtifactFile[];
  permissions: {
    network: false;
    storage: false;
    parentMessaging: true;
  };
};

export type ParentGameMessage =
  | { type: "play_start"; payload?: Record<string, unknown> }
  | { type: "game_over"; payload?: Record<string, unknown> }
  | { type: "restart"; payload?: Record<string, unknown> };
