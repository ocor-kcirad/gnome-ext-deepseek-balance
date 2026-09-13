import Soup from 'gi://Soup?version=3.0';

import {requestJson} from '../http.js';
import {parseUserBalance} from './validate.js';
import type {UserBalance} from './types.js';

const BASE_URL = 'https://api.deepseek.com';
const REQUEST_TIMEOUT_SECONDS = 30;

export class DeepSeekClient {
    private readonly session = new Soup.Session();
    private aborted = false;

    constructor(private readonly getApiKey: () => Promise<string | null>) {
        this.session.timeout = REQUEST_TIMEOUT_SECONDS;
    }

    async getBalance(): Promise<UserBalance> {
        const apiKey = (await this.getApiKey())?.trim() ?? '';

        if (!apiKey)
            throw new Error(
                'No API key configured. Add one in the extension preferences.',
            );

        const data = await requestJson<unknown>(
            this.session,
            `${BASE_URL}/user/balance`,
            {
                headers: {Authorization: `Bearer ${apiKey}`},
                isCancelled: () => this.aborted,
            },
        );

        return parseUserBalance(data);
    }

    abort(): void {
        this.aborted = true;
        this.session.abort();
    }
}
