import Clutter from 'gi://Clutter';
import Gio from 'gi://Gio';
import GObject from 'gi://GObject';
import St from 'gi://St';

import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';

import type {BalanceInfo, UserBalance} from './lib/deepseek/types.js';
import type {UsageService} from './lib/usage/service.js';
import type {UsageSnapshot} from './lib/usage/types.js';

const CURRENCY_SYMBOLS: Record<string, string> = {
    CNY: '¥',
    USD: '$',
};

const USAGE_URL = 'https://platform.deepseek.com/usage';

export class UsageIndicator extends PanelMenu.Button {
    static {
        GObject.registerClass({GTypeName: 'DeepSeekUsageIndicator'}, this);
    }

    private readonly panelLabel: St.Label;
    private readonly statusItem: PopupMenu.PopupMenuItem;
    private readonly totalItem: PopupMenu.PopupMenuItem;
    private readonly grantedItem: PopupMenu.PopupMenuItem;
    private readonly toppedUpItem: PopupMenu.PopupMenuItem;
    private readonly updatedItem: PopupMenu.PopupMenuItem;

    private readonly linkIcon: St.Icon;
    private readonly stSettings = St.Settings.get();
    private readonly colorSchemeId: number;

    constructor(
        private readonly service: UsageService,
        private readonly iconsDir: string
    ) {
        super(0.0, 'DeepSeek Usage');

        this.linkIcon = new St.Icon({icon_size: 16});
        this.updateLinkIcon();
        this.colorSchemeId = this.stSettings.connect('notify::color-scheme', () => {
            this.updateLinkIcon();
        });

        this.panelLabel = new St.Label({
            text: 'DeepSeek',
            y_align: Clutter.ActorAlign.CENTER,
        });
        this.add_child(this.panelLabel);

        this.statusItem = this.addInfoItem('Status: —');
        this.totalItem = this.addInfoItem('Total balance: —');
        this.grantedItem = this.addInfoItem('Granted balance: —');
        this.toppedUpItem = this.addInfoItem('Topped-up balance: —');

        this.popupMenu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        this.updatedItem = this.addInfoItem('Updated: never');

        const actionsItem = new PopupMenu.PopupMenuItem('', {reactive: false, can_focus: false});
        actionsItem.label.hide();
        actionsItem.add_style_class_name('deepseek-actions');

        const actionsBox = new St.BoxLayout({x_expand: true});
        actionsItem.add_child(actionsBox);

        const refreshButton = new St.Button({
            label: 'Refresh now',
            x_expand: true,
            style_class: 'deepseek-action-button',
        });
        refreshButton.connect('clicked', () => {
            this.service.refresh();
        });
        actionsBox.add_child(refreshButton);

        const linkButton = new St.Button({
            child: this.linkIcon,
            style_class: 'deepseek-action-button deepseek-link-button',
        });
        linkButton.connect('clicked', () => {
            Gio.AppInfo.launch_default_for_uri(USAGE_URL, null);
        });
        actionsBox.add_child(linkButton);

        this.popupMenu.addMenuItem(actionsItem);

        this.update(this.service.getSnapshot());
    }

    private get popupMenu(): PopupMenu.PopupMenu {
        return this.menu as PopupMenu.PopupMenu;
    }

    private updateLinkIcon(): void {
        const file =
            this.stSettings.color_scheme === St.SystemColorScheme.PREFER_LIGHT
                ? 'deepseek-light.svg'
                : 'deepseek-dark.svg';
        this.linkIcon.set_gicon(
            Gio.icon_new_for_string(`${this.iconsDir}/${file}`) as unknown as St.Icon['gicon']
        );
    }

    override destroy(): void {
        this.stSettings.disconnect(this.colorSchemeId);
        super.destroy();
    }

    private addInfoItem(text: string): PopupMenu.PopupMenuItem {
        const item = new PopupMenu.PopupMenuItem(text);
        item.setSensitive(false);
        this.popupMenu.addMenuItem(item);
        return item;
    }

    update(snapshot: UsageSnapshot): void {
        const {balance, error} = snapshot;
        const info = selectBalance(balance?.balance_infos ?? []);

        this.panelLabel.set_text(
            info ? formatAmount(info.currency, info.total_balance) : error ? '⚠ DeepSeek' : 'DeepSeek'
        );
        this.statusItem.label.set_text(`Status: ${statusText(balance, error)}`);
        this.totalItem.label.set_text(`Total balance: ${amountText(info, 'total_balance')}`);
        this.grantedItem.label.set_text(`Granted balance: ${amountText(info, 'granted_balance')}`);
        this.toppedUpItem.label.set_text(`Topped-up balance: ${amountText(info, 'topped_up_balance')}`);
        this.updatedItem.label.set_text(`Updated: ${formatUpdated(snapshot.updatedAt)}`);
    }
}

function selectBalance(infos: BalanceInfo[]): BalanceInfo | null {
    return infos.length > 0 ? infos[0] : null;
}

function amountText(
    info: BalanceInfo | null,
    field: 'total_balance' | 'granted_balance' | 'topped_up_balance'
): string {
    return info ? formatAmount(info.currency, info[field]) : '—';
}

function formatAmount(currency: string, amount: string): string {
    const symbol = CURRENCY_SYMBOLS[currency] ?? `${currency} `;
    return `${symbol}${amount}`;
}

function statusText(balance: UserBalance | null, error: string | null): string {
    if (error) return error;
    if (!balance) return 'No data';
    return balance.is_available ? 'Available' : 'Insufficient balance';
}

function formatUpdated(updatedAt: number | null): string {
    if (!updatedAt) return 'never';
    return new Date(updatedAt).toLocaleString();
}
