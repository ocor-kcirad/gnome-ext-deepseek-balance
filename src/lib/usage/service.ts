import type {UsageProvider} from './provider.js';
import type {UsageListener, UsageSnapshot} from './types.js';

const EMPTY_SNAPSHOT: UsageSnapshot = {
    balance: null,
    updatedAt: null,
    error: null,
};

export class UsageService {
    private readonly providers: UsageProvider[] = [];
    private readonly listeners = new Set<UsageListener>();
    private snapshot: UsageSnapshot = EMPTY_SNAPSHOT;
    private refreshing = false;

    addProvider(provider: UsageProvider): void {
        this.providers.push(provider);
    }

    getSnapshot(): UsageSnapshot {
        return this.snapshot;
    }

    connect(listener: UsageListener): () => void {
        this.listeners.add(listener);
        return () => {
            this.listeners.delete(listener);
        };
    }

    async refresh(): Promise<void> {
        if (this.refreshing || this.providers.length === 0) return;

        this.refreshing = true;

        try {
            const results = await Promise.allSettled(
                this.providers.map(provider => provider.fetch())
            );
            const next: UsageSnapshot = {...this.snapshot, updatedAt: Date.now(), error: null};
            const errors: string[] = [];

            for (const result of results) {
                if (result.status === 'fulfilled') Object.assign(next, result.value);
                else errors.push(errorMessage(result.reason));
            }

            next.error = errors.length > 0 ? errors.join('; ') : null;
            this.snapshot = next;
        } finally {
            this.refreshing = false;
        }

        this.emit();
    }

    private emit(): void {
        for (const listener of this.listeners) listener(this.snapshot);
    }
}

function errorMessage(reason: unknown): string {
    return reason instanceof Error ? reason.message : String(reason);
}
