export interface Job {
  id: string;
  name: string;
  data: any;
  progress: number;
  delay: number;
  timestamp: number;
  attemptsMade: number;
  stacktrace: string[];
  returnvalue: any;

  // methods
  finish: (result?: any) => Promise<void>;
  fail: (error: Error) => Promise<void>;
  reportProgress: (progress: number) => Promise<void>;
  retry: () => Promise<void>;
  remove: () => Promise<string>;
}

export interface OddsQueuePayload {
  id: string;
  gameStartTime: string;
}
