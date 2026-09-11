import type {DeepSeekClient} from './client.js';
import type {UsageProvider} from '../usage/provider.js';
import type {UsageSnapshot} from '../usage/types.js';

export class DeepSeekBalanceProvider implements UsageProvider {
    readonly id = 'deepseek-balance';

    constructor(private readonly client: DeepSeekClient) {}

    async fetch(): Promise<Partial<UsageSnapshot>> {
        const balance = await this.client.getBalance();
        return {balance};
    }
}
