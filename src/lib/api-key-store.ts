import Gio from 'gi://Gio';
import Secret from 'gi://Secret';

// @girs types these as promises, but GJS only returns promises once promisified.
Gio._promisify(Secret, 'password_lookup', 'password_lookup_finish');
Gio._promisify(Secret, 'password_store', 'password_store_finish');
Gio._promisify(Secret, 'password_clear', 'password_clear_finish');

const SCHEMA = Secret.Schema.new(
    'org.gnome.shell.extensions.gnome-deepseek-balance',
    Secret.SchemaFlags.NONE,
    {
        purpose: Secret.SchemaAttributeType.STRING,
    },
);

const ATTRIBUTES = {purpose: 'deepseek-api-key'};
const LABEL = 'DeepSeek Balance API key';

export class ApiKeyStore {
    private service: Secret.Service | null | undefined;

    async getApiKey(): Promise<string | null> {
        this.ensureService();

        const apiKey = await Secret.password_lookup(SCHEMA, ATTRIBUTES, null);
        return apiKey ? apiKey : null;
    }

    async setApiKey(apiKey: string): Promise<void> {
        this.ensureService();

        await Secret.password_store(
            SCHEMA,
            ATTRIBUTES,
            Secret.COLLECTION_DEFAULT,
            LABEL,
            apiKey,
            null,
        );
    }

    async clearApiKey(): Promise<void> {
        this.ensureService();

        await Secret.password_clear(SCHEMA, ATTRIBUTES, null);
    }

    private ensureService(): void {
        if (this.service === undefined) {
            try {
                this.service = Secret.Service.get_sync(
                    Secret.ServiceFlags.NONE,
                    null,
                );
            } catch {
                this.service = null;
            }
        }

        if (this.service === null)
            throw new Error('No system keyring (Secret Service) available.');
    }
}
