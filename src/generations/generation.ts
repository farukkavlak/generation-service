export interface Generation {
  id: string;
  prompt: string;
  result: string;
  cached: boolean;
  createdAt: Date;
}

export interface HistoryCursor {
  createdAt: string;
  id: string;
}

export interface NewGeneration {
  userId: string;
  prompt: string;
  result: string;
  cached: boolean;
}
