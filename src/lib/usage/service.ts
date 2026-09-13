import {errorMessage} from '../error-message.js';
import type {UsageProvider} from './provider.js';
import type {UsageListener, UsageSnapshot} from './types.js';

const EMPTY_SNAPSHOT: UsageSnapshot = {
    balance: null,
    updatedAt: null,
    error: null,
};

export class UsageService {
    private readonly providers: UsageProvider[] = [];
    private readonly listeners = new Map<number, UsageListener>();
    private snapshot: UsageSnapshot = EMPTY_SNAPSHOT;
    private refreshing = false;
    private pendingRefresh = false;
    private nextListenerId = 1;
    private _destroyed = false;

    addProvider(provider: UsageProvider): void {
        this.providers.push(provider);
    }

    destroy(): void {
        this._destroyed = true;
        this.listeners.clear();
    }

    getSnapshot(): UsageSnapshot {
        return this.snapshot;
    }

    connect(listener: UsageListener): number {
        const id = this.nextListenerId++;
        this.listeners.set(id, listener);
        return id;
    }

    disconnect(id: number): void {
        this.listeners.delete(id);
    }

    async refresh(): Promise<void> {
        if (this.providers.length === 0 || this._destroyed) return;

        if (this.refreshing) {
            this.pendingRefresh = true;
            return;
        }

        this.refreshing = true;

        try {
            const results = await Promise.allSettled(
                this.providers.map((provider) => provider.fetch()),
            );
            if (this._destroyed) return;

            const next: UsageSnapshot = {...this.snapshot, error: null};
            const errors: string[] = [];
            let succeeded = false;

            for (const result of results) {
                if (result.status === 'fulfilled') {
                    Object.assign(next, result.value);
                    succeeded = true;
                } else errors.push(errorMessage(result.reason));
            }

            if (succeeded) next.updatedAt = Date.now();
            next.error = errors.length > 0 ? errors.join('; ') : null;
            this.snapshot = next;
        } finally {
            this.refreshing = false;
        }

        this.emit();

        if (this.pendingRefresh) {
            this.pendingRefresh = false;
            void this.refresh();
        }
    }

    private emit(): void {
        for (const listener of this.listeners.values()) listener(this.snapshot);
    }
}
