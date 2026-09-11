import Adw from 'gi://Adw';
import Gio from 'gi://Gio';

import {ExtensionPreferences} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

export default class GnomeDeepseekUsagePrefs extends ExtensionPreferences {
    override fillPreferencesWindow(window: Adw.PreferencesWindow): void {
        const settings = this.getSettings();

        const page = new Adw.PreferencesPage();
        const group = new Adw.PreferencesGroup({
            title: 'DeepSeek',
            description: 'Configure how the extension retrieves your DeepSeek balance.',
        });
        page.add(group);

        const apiKeyRow = new Adw.PasswordEntryRow({
            title: 'API key',
            show_apply_button: true,
        });
        settings.bind('api-key', apiKeyRow, 'text', Gio.SettingsBindFlags.DEFAULT);
        group.add(apiKeyRow);

        const intervalRow = Adw.SpinRow.new_with_range(60, 3600, 30);
        intervalRow.title = 'Refresh interval';
        intervalRow.subtitle = 'Seconds between automatic balance updates';
        settings.bind('refresh-interval', intervalRow, 'value', Gio.SettingsBindFlags.DEFAULT);
        group.add(intervalRow);

        window.add(page);
    }
}
