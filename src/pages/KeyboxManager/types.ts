export interface HistoryEntry {
  source: string;
  version: string;
  text: string;
  serial: string;
  revoked: boolean;
  softbanned?: boolean;
  timestamp: string;
}

export type StatusType = 'active' | 'softbanned' | 'revoked';
