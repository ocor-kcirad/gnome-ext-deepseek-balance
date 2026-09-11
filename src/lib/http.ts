import GLib from 'gi://GLib';
import Soup from 'gi://Soup?version=3.0';

export interface HttpRequestOptions {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
}

export class HttpError extends Error {
    readonly status: number;

    constructor(status: number, message: string) {
        super(message);
        this.name = 'HttpError';
        this.status = status;
    }
}

export async function requestJson<T>(
    session: Soup.Session,
    url: string,
    options: HttpRequestOptions = {},
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
    const text = new TextDecoder().decode(bytes.get_data() ?? new Uint8Array());

    if (status < 200 || status >= 300)
        throw new HttpError(
            status,
            extractErrorMessage(text) ??
                message.get_reason_phrase() ??
                `HTTP ${status}`,
        );

    return JSON.parse(text) as T;
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
