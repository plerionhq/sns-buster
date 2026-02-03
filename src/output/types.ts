export interface ActionSummaryResult {
  status: number;
  success: boolean;
  error?: string;
  requestId?: string;
}

export interface ActionSummary {
  unsigned: ActionSummaryResult;
  signed?: ActionSummaryResult;
}

export interface RunSummary {
  topicArn: string;
  region: string;
  timestamp: string;
  mode: 'read' | 'safe' | 'all';
  credentialsAvailable: boolean;
  results: Record<string, ActionSummary>;
  summary: {
    total: number;
    unsigned: {
      success: number;
      failed: number;
    };
    signed: {
      success: number;
      failed: number;
    };
  };
}
