import GLib from 'gi://GLib';
import type Gio from 'gi://Gio';

import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

import {UsageIndicator} from './indicator.js';
import {ApiKeyStore} from './lib/api-key-store.js';
import {DeepSeekClient} from './lib/deepseek/client.js';
import {DeepSeekBalanceProvider} from './lib/deepseek/provider.js';
import {UsageService} from './lib/usage/service.js';

export default class DeepSeekBalanceExtension extends Extension {
    private settings: Gio.Settings | null = null;
    private store: ApiKeyStore | null = null;
    private client: DeepSeekClient | null = null;
    private service: UsageService | null = null;
    private indicator: UsageIndicator | null = null;
    private serviceId = 0;
    private settingsIds: number[] = [];
    private timeoutId = 0;

    override enable(): void {
        const settings = this.getSettings();
        this.settings = settings;

        const store = new ApiKeyStore();
        this.store = store;
        this.client = new DeepSeekClient(() => store.getApiKey());
        this.service = new UsageService();
        this.service.addProvider(new DeepSeekBalanceProvider(this.client));

        this.indicator = new UsageIndicator(
            this.service,
            `${this.path}/icons`,
            (currency) => settings.set_string('currency', currency),
        );
        this.indicator.setCurrency(settings.get_string('currency'));
        Main.panel.addToStatusArea(this.uuid, this.indicator);

        this.serviceId = this.service.connect((snapshot) =>
            this.indicator?.update(snapshot),
        );

        this.settingsIds.push(
            settings.connect('changed::refresh-interval', () =>
                this.restartTimer(),
            ),
            settings.connect('changed::currency', () =>
                this.indicator?.setCurrency(settings.get_string('currency')),
            ),
        );

        this.service.refresh();
        this.restartTimer();
    }

    override disable(): void {
        if (this.timeoutId !== 0) {
            GLib.source_remove(this.timeoutId);
            this.timeoutId = 0;
        }

        for (const id of this.settingsIds) this.settings?.disconnect(id);
        this.settingsIds = [];

        if (this.service) this.service.disconnect(this.serviceId);
        this.serviceId = 0;

        this.indicator?.destroy();
        this.indicator = null;

        this.client?.abort();
        this.client = null;

        this.service = null;
        this.store = null;
        this.settings = null;
    }

    private restartTimer(): void {
        if (this.timeoutId !== 0) {
            GLib.source_remove(this.timeoutId);
            this.timeoutId = 0;
        }

        const interval = this.settings?.get_int('refresh-interval') ?? 300;
        this.timeoutId = GLib.timeout_add_seconds(
            GLib.PRIORITY_DEFAULT,
            interval,
            () => {
                this.service?.refresh();
                return GLib.SOURCE_CONTINUE;
            },
        );
    }
}
