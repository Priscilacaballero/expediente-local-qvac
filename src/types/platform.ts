import type { UseCaseDefinition, UseCaseId, WorkspaceRole } from "../platform/use-cases.js";

export type WorkspaceContext = {
  id: string;
  useCase: UseCaseId;
  role: WorkspaceRole;
  caseId?: string;
  lastAction?: string;
  localInference: { provider: "QVAC local"; ready: boolean; externalInference: false };
  createdAt: string;
  updatedAt: string;
};

export type PlatformActivity = {
  id: string;
  workspaceId: string | null;
  useCase: UseCaseId;
  action: string;
  result: string;
  humanReview: "not_required" | "pending" | "completed";
  createdAt: string;
};

export type PlatformOverview = {
  useCases: UseCaseDefinition[];
  architecture: typeof import("../platform/use-cases.js").ARCHITECTURE;
  status: { provider: "QVAC local"; model: string; ready: boolean; online: boolean; synthetic: true; humanReview: string };
  workspace: WorkspaceContext | null;
  activity: PlatformActivity[];
};
