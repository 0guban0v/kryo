export type TransportMode = "stdio" | "streamable-http";
export type HttpSessionMode = "stateful" | "stateless";
export type GitForgeProvider = "github" | "ghes" | "gitea";
export type GitHubMergeMethod = "merge" | "squash" | "rebase";

export interface FizzyUser {
  id: string;
  name: string;
  role?: string | undefined;
  active?: boolean | undefined;
  email_address?: string | undefined;
  url?: string | undefined;
}

export interface FizzyBoard {
  id: string;
  name: string;
  all_access: boolean;
  auto_postpone_period_in_days?: number | null | undefined;
  created_at: string;
  url: string;
  public_url?: string | undefined;
  creator: FizzyUser;
}

export interface FizzyColumn {
  id: string;
  name: string;
  color: string;
  created_at: string;
}

export interface FizzyCardStep {
  id: string;
  content: string;
  completed: boolean;
}

export interface FizzyCard {
  id: string;
  number: number;
  title: string;
  status: string;
  description?: string | undefined;
  description_html?: string | undefined;
  image_url?: string | null | undefined;
  has_attachments?: boolean | undefined;
  tags: string[];
  closed: boolean;
  postponed?: boolean | undefined;
  golden?: boolean | undefined;
  last_active_at: string;
  created_at: string;
  url: string;
  board: FizzyBoard;
  column?: FizzyColumn | undefined;
  creator: FizzyUser;
  assignees: FizzyUser[];
  has_more_assignees?: boolean | undefined;
  comments_url?: string | undefined;
  reactions_url?: string | undefined;
  steps?: FizzyCardStep[] | undefined;
}

export interface FizzyComment {
  id: string;
  created_at: string;
  updated_at: string;
  body: {
    plain_text: string;
    html: string;
  };
  creator: FizzyUser;
  card: {
    id: string;
    url: string;
  };
  reactions_url: string;
  url: string;
}

export interface FizzyTag {
  id: string;
  title: string;
  created_at: string;
  url: string;
}

export interface FizzyIdentityAccount {
  id: string;
  name: string;
  slug: string;
  created_at: string;
  user: FizzyUser;
}

export interface FizzyIdentity {
  accounts: FizzyIdentityAccount[];
}

export interface CampfireWebhookPayload {
  user: {
    id: string | number;
    name: string;
  };
  room: {
    id: string | number;
    name: string;
    path: string;
  };
  message: {
    id: string | number;
    path: string;
    body: {
      html: string;
      plain: string;
    };
  };
}

export interface CampfireObservedMessage {
  roomId: string;
  roomName: string;
  messageId?: string | undefined;
  body: string;
  senderName: string;
  observedAt: string;
  path?: string | undefined;
  source: "webhook" | "bot" | "api";
}

export interface CampfireRoomSummary {
  id: string;
  name: string;
  path?: string | undefined;
}

export interface GitHubPullRequest {
  number: number;
  title: string;
  body?: string | null | undefined;
  html_url: string;
  state: "open" | "closed";
  merged: boolean;
  head: {
    ref: string;
    sha: string;
  };
  base: {
    ref: string;
  };
}

export interface GitHubStatusContext {
  context: string;
  state: string;
  description?: string | null | undefined;
  target_url?: string | null | undefined;
}

export interface GitHubCheckRun {
  name: string;
  status: string;
  conclusion?: string | null | undefined;
  html_url?: string | null | undefined;
}

export interface GitHubCheckSummary {
  overall: "success" | "pending" | "failure" | "unknown";
  headSha: string;
  combinedState: string;
  statuses: GitHubStatusContext[];
  checkRuns: GitHubCheckRun[];
}

export interface WorkflowResult {
  summary: string;
  markdown: string;
}

export interface NotificationOptions {
  notifyCampfire?: boolean | undefined;
  roomId?: string | undefined;
  roomPath?: string | undefined;
}
