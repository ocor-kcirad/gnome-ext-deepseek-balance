import Soup from 'gi://Soup?version=3.0';

import {requestJson} from '../http.js';
import type {UserBalance} from './types.js';

const BASE_URL = 'https://api.deepseek.com';

export class DeepSeekClient {
    private readonly session = new Soup.Session();

    constructor(private readonly getApiKey: () => Promise<string | null>) {}

    async getBalance(): Promise<UserBalance> {
        const apiKey = (await this.getApiKey())?.trim() ?? '';

        if (!apiKey)
            throw new Error(
                'No API key configured. Add one in the extension preferences.',
            );

        return requestJson<UserBalance>(
            this.session,
            `${BASE_URL}/user/balance`,
            {
                headers: {Authorization: `Bearer ${apiKey}`},
            },
        );
    }

    abort(): void {
        this.session.abort();
    }
}
