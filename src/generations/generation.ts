export interface Generation {
  id: string;
  prompt: string;
  result: string;
  cached: boolean;
  createdAt: Date;
}

export interface HistoryCursor {
  // ISO string, not Date: pg would send a Date in the process time zone.
  createdAt: string;
  id: string;
}

export interface NewGeneration {
  userId: string;
  prompt: string;
  result: string;
  cached: boolean;
}
