import GLib from 'gi://GLib';
import Soup from 'gi://Soup?version=3.0';

export interface HttpRequestOptions {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
    isCancelled?: () => boolean;
}

const MAX_BODY_BYTES = 1 << 20;
const MAX_RETRIES = 2;
const BASE_RETRY_DELAY_MS = 500;
const MAX_RETRY_DELAY_MS = 10_000;

export class HttpError extends Error {
    readonly status: number;
    readonly retryAfterSeconds: number | null;

    constructor(
        status: number,
        message: string,
        retryAfterSeconds: number | null = null,
    ) {
        super(message);
        this.name = 'HttpError';
        this.status = status;
        this.retryAfterSeconds = retryAfterSeconds;
    }
}

export async function requestJson<T>(
    session: Soup.Session,
    url: string,
    options: HttpRequestOptions = {},
): Promise<T> {
    let attempt = 0;

    for (;;) {
        try {
            return await sendRequest<T>(session, url, options);
        } catch (error) {
            const delay = retryDelayMs(error, attempt, options.isCancelled);
            if (delay === null) throw error;

            await sleep(delay);
            if (options.isCancelled?.()) throw error;

            attempt++;
        }
    }
}

async function sendRequest<T>(
    session: Soup.Session,
    url: string,
    options: HttpRequestOptions,
): Promise<T> {
    const message = Soup.Message.new(options.method ?? 'GET', url);

    if (!message) throw new Error(`Invalid URL: ${url}`);

    const headers = message.get_request_headers();
    headers.append('Accept', 'application/json');

    for (const [name, value] of Object.entries(options.headers ?? {}))
        headers.append(name, value);

    if (options.body !== undefined)
        message.set_request_body_from_bytes(
            'application/json',
            new TextEncoder().encode(options.body),
        );

    const bytes = await session.send_and_read_async(
        message,
        GLib.PRIORITY_DEFAULT,
        null,
    );
    const status = message.get_status();

    if (bytes.get_size() > MAX_BODY_BYTES)
        throw new HttpError(status, 'Response body is too large');

    const text = new TextDecoder().decode(bytes.get_data() ?? new Uint8Array());

    if (status < 200 || status >= 300)
        throw new HttpError(
            status,
            extractErrorMessage(text) ??
                message.get_reason_phrase() ??
                `HTTP ${status}`,
            parseRetryAfter(message),
        );

    return JSON.parse(text) as T;
}

function retryDelayMs(
    error: unknown,
    attempt: number,
    isCancelled: (() => boolean) | undefined,
): number | null {
    if (isCancelled?.()) return null;
    if (attempt >= MAX_RETRIES) return null;
    if (!(error instanceof HttpError)) return null;
    if (error.status !== 429 && error.status < 500) return null;

    if (error.retryAfterSeconds !== null)
        return Math.min(error.retryAfterSeconds * 1000, MAX_RETRY_DELAY_MS);

    const backoff = BASE_RETRY_DELAY_MS * 2 ** attempt;
    const jitter = Math.floor(Math.random() * BASE_RETRY_DELAY_MS);
    return Math.min(backoff + jitter, MAX_RETRY_DELAY_MS);
}

function parseRetryAfter(message: Soup.Message): number | null {
    const value = message.get_response_headers().get_one('Retry-After');
    if (!value) return null;

    const seconds = Number.parseInt(value, 10);
    return Number.isFinite(seconds) && seconds >= 0 ? seconds : null;
}

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => {
        GLib.timeout_add(GLib.PRIORITY_DEFAULT, ms, () => {
            resolve();
            return GLib.SOURCE_REMOVE;
        });
    });
}

function extractErrorMessage(text: string): string | null {
    if (!text) return null;

    try {
        const parsed = JSON.parse(text) as {error?: {message?: string}};
        return parsed.error?.message ?? null;
    } catch {
        return text;
    }
}
