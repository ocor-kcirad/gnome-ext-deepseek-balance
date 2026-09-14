import Gio from 'gi://Gio';
import Secret from 'gi://Secret';

// Promisify once at module scope so it runs before any method is called.
// @girs types these as promises, but GJS only returns promises once promisified.
Gio._promisify(Secret, 'password_lookup', 'password_lookup_finish');
Gio._promisify(Secret, 'password_store', 'password_store_finish');
Gio._promisify(Secret, 'password_clear', 'password_clear_finish');

const ATTRIBUTES = {purpose: 'deepseek-api-key'};
const LABEL = 'DeepSeek Balance API key';

let schema: Secret.Schema | null = null;

function getSchema(): Secret.Schema {
    return (schema ??= Secret.Schema.new(
        'org.gnome.shell.extensions.gnome-deepseek-balance',
        Secret.SchemaFlags.NONE,
        {
            purpose: Secret.SchemaAttributeType.STRING,
        },
    ));
}

export class ApiKeyStore {
    private service: Secret.Service | null | undefined;

    async getApiKey(): Promise<string | null> {
        await this.ensureService();

        const apiKey = await Secret.password_lookup(
            getSchema(),
            ATTRIBUTES,
            null,
        );
        return apiKey ? apiKey : null;
    }

    async setApiKey(apiKey: string): Promise<void> {
        await this.ensureService();

        await Secret.password_store(
            getSchema(),
            ATTRIBUTES,
            Secret.COLLECTION_DEFAULT,
            LABEL,
            apiKey,
            null,
        );
    }

    async clearApiKey(): Promise<void> {
        await this.ensureService();

        await Secret.password_clear(getSchema(), ATTRIBUTES, null);
    }

    private async ensureService(): Promise<void> {
        if (this.service === undefined) {
            this.service = await new Promise<Secret.Service | null>(
                (resolve) => {
                    Secret.Service.get(
                        Secret.ServiceFlags.NONE,
                        null,
                        (_source, result) => {
                            try {
                                resolve(Secret.Service.get_finish(result));
                            } catch {
                                resolve(null);
                            }
                        },
                    );
                },
            );
        }

        if (this.service === null)
            throw new Error('No system keyring (Secret Service) available.');
    }
}
