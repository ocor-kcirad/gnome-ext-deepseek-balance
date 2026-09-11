import type {UserBalance} from '../deepseek/types.js';

export interface UsageSnapshot {
    balance: UserBalance | null;
    updatedAt: number | null;
    error: string | null;
}

export type UsageListener = (snapshot: UsageSnapshot) => void;
