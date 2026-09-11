import type {UsageSnapshot} from './types.js';

export interface UsageProvider {
    readonly id: string;
    fetch(): Promise<Partial<UsageSnapshot>>;
}
