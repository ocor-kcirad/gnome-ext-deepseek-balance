import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk';

import {ExtensionPreferences} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

import {ApiKeyStore} from './lib/api-key-store.js';

export default class GnomeDeepseekUsagePrefs extends ExtensionPreferences {
    override fillPreferencesWindow(window: Adw.PreferencesWindow): void {
        const settings = this.getSettings();
        const store = new ApiKeyStore();

        const page = new Adw.PreferencesPage();
        const group = new Adw.PreferencesGroup({
            title: 'DeepSeek',
            description: 'Your API key is stored in your system keyring, not by this extension.',
        });
        page.add(group);

        const apiKeyRow = new Adw.PasswordEntryRow({
            title: 'API key',
            show_apply_button: true,
        });
        group.add(apiKeyRow);

        store
            .getApiKey()
            .then(apiKey => {
                apiKeyRow.text = apiKey ?? '';
            })
            .catch(error => {
                window.add_toast(
                    new Adw.Toast({title: `Could not read API key: ${errorMessage(error)}`})
                );
            });

        apiKeyRow.connect('apply', () => {
            const apiKey = apiKeyRow.text.trim();
            const action = apiKey ? store.setApiKey(apiKey) : store.clearApiKey();

            action.catch(error => {
                window.add_toast(
                    new Adw.Toast({title: `Could not save API key: ${errorMessage(error)}`})
                );
            });
        });

        const removeRow = new Adw.ActionRow({
            title: 'Remove stored API key',
            subtitle:
                'Deletes the key from your system keyring. Uninstalling the extension does not remove it.',
        });
        const removeButton = new Gtk.Button({
            label: 'Remove',
            valign: Gtk.Align.CENTER,
        });
        removeButton.add_css_class('destructive-action');
        removeButton.connect('clicked', () => {
            store
                .clearApiKey()
                .then(() => {
                    apiKeyRow.text = '';
                    window.add_toast(new Adw.Toast({title: 'Stored API key removed'}));
                })
                .catch(error => {
                    window.add_toast(
                        new Adw.Toast({title: `Could not remove API key: ${errorMessage(error)}`})
                    );
                });
        });
        removeRow.add_suffix(removeButton);
        group.add(removeRow);

        const intervalRow = Adw.SpinRow.new_with_range(60, 3600, 30);
        intervalRow.title = 'Refresh interval';
        intervalRow.subtitle = 'Seconds between automatic balance updates';
        settings.bind('refresh-interval', intervalRow, 'value', Gio.SettingsBindFlags.DEFAULT);
        group.add(intervalRow);

        window.connect('close-request', () => {
            apiKeyRow.text = '';
            return false;
        });

        window.add(page);
    }
}

function errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}
