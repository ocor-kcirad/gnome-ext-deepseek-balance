import Clutter from 'gi://Clutter';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import St from 'gi://St';

import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';

import {Tooltip} from './lib/tooltip.js';
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
        GObject.registerClass({GTypeName: 'DeepSeekBalanceIndicator'}, this);
    }

    private readonly panelLabel: St.Label;
    private readonly statusIcon: St.Icon;
    private readonly statusTooltip: Tooltip;
    private readonly totalValueLabel: St.Label;
    private readonly updatedItem: PopupMenu.PopupMenuItem;

    private readonly linkIcon: St.Icon;
    private readonly stSettings = St.Settings.get();
    private readonly colorSchemeId: number;
    private readonly updatedTimerId: number;
    private snapshot: UsageSnapshot = {
        balance: null,
        updatedAt: null,
        error: null,
    };

    constructor(
        private readonly service: UsageService,
        private readonly iconsDir: string,
    ) {
        super(0.0, 'DeepSeek Balance');

        this.linkIcon = new St.Icon({icon_size: 16});
        this.updateIcons();
        this.colorSchemeId = this.stSettings.connect(
            'notify::color-scheme',
            () => {
                this.updateIcons();
            },
        );

        this.panelLabel = new St.Label({
            text: 'DeepSeek',
            y_align: Clutter.ActorAlign.CENTER,
        });
        this.add_child(this.panelLabel);

        const statusItem = new PopupMenu.PopupMenuItem('Status:');
        statusItem.label.x_expand = true;
        statusItem.track_hover = true;
        this.statusIcon = new St.Icon({
            icon_name: STATUS_ICON,
            icon_size: 16,
            style_class: 'deepseek-status-icon',
        });
        statusItem.add_child(this.statusIcon);

        const linkButton = new St.Button({
            child: this.linkIcon,
            style_class: 'deepseek-action-button deepseek-icon-button',
        });
        linkButton.connect('clicked', () => {
            Gio.AppInfo.launch_default_for_uri(USAGE_URL, null);
        });
        statusItem.add_child(linkButton);

        this.statusTooltip = new Tooltip(statusItem);
        this.popupMenu.addMenuItem(statusItem);
        this.popupMenu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        const totalBox = new St.BoxLayout({
            vertical: true,
            x_expand: true,
            reactive: true,
            style_class: 'deepseek-total',
        });
        totalBox.add_child(
            new St.Label({
                text: 'Total Balance:',
                x_expand: true,
                reactive: true,
                style_class: 'deepseek-total-heading',
            }),
        );
        this.totalValueLabel = new St.Label({
            text: '—',
            x_expand: true,
            x_align: Clutter.ActorAlign.CENTER,
            style_class: 'deepseek-total-value',
            reactive: true,
        });
        totalBox.add_child(this.totalValueLabel);
        this.popupMenu.box.add_child(totalBox);

        this.popupMenu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        this.updatedItem = new PopupMenu.PopupMenuItem('Updated never');
        this.updatedItem.label.x_expand = true;
        this.updatedItem.label.x_align = Clutter.ActorAlign.CENTER;
        this.updatedItem.label.add_style_class_name('deepseek-updated');
        this.updatedItem.set_accessible_name('Refresh balance');
        this.updatedItem.connect('activate', () => {
            this.service.refresh();
        });
        this.popupMenu.addMenuItem(this.updatedItem);

        this.updatedTimerId = GLib.timeout_add_seconds(
            GLib.PRIORITY_DEFAULT,
            30,
            () => {
                this.updateUpdatedLabel();
                return GLib.SOURCE_CONTINUE;
            },
        );

        this.update(this.service.getSnapshot());
    }

    private get popupMenu(): PopupMenu.PopupMenu {
        return this.menu as PopupMenu.PopupMenu;
    }

    private updateIcons(): void {
        const scheme =
            this.stSettings.color_scheme === St.SystemColorScheme.PREFER_LIGHT
                ? 'light'
                : 'dark';
        const iconPath = `${this.iconsDir}/deepseek-${scheme}.svg`;
        this.linkIcon.set_gicon(
            Gio.icon_new_for_string(iconPath) as unknown as St.Icon['gicon'],
        );
    }

    private updateUpdatedLabel(): void {
        this.updatedItem.label.set_text(
            `Updated ${formatRelativeTime(this.snapshot.updatedAt)}`,
        );
    }

    override destroy(): void {
        if (this.updatedTimerId) GLib.source_remove(this.updatedTimerId);
        this.stSettings.disconnect(this.colorSchemeId);
        this.statusTooltip.destroy();
        super.destroy();
    }

    update(snapshot: UsageSnapshot): void {
        this.snapshot = snapshot;
        const {balance, error} = snapshot;
        const info = selectBalance(balance?.balance_infos ?? []);

        this.panelLabel.set_text(panelText(info, error));
        const {state, text} = statusState(balance, error);
        this.statusIcon.set_style_class_name(
            `deepseek-status-icon deepseek-status-${state}`,
        );
        this.statusIcon.set_accessible_name(text);
        this.statusTooltip.set_text(text);
        this.totalValueLabel.set_text(
            info ? formatAmount(info.currency, info.total_balance) : '—',
        );
        this.updateUpdatedLabel();
    }
}

function selectBalance(infos: BalanceInfo[]): BalanceInfo | null {
    return infos.length > 0 ? infos[0] : null;
}

function panelText(info: BalanceInfo | null, error: string | null): string {
    if (info) return formatAmount(info.currency, info.total_balance);
    if (error) return '⚠ DeepSeek';
    return 'DeepSeek';
}

function formatAmount(currency: string, amount: string): string {
    const symbol = CURRENCY_SYMBOLS[currency] ?? `${currency} `;
    return `${symbol}${amount}`;
}

type StatusState = 'available' | 'insufficient' | 'nodata' | 'error';

const STATUS_ICON = 'media-record-symbolic';

function statusState(
    balance: UserBalance | null,
    error: string | null,
): {state: StatusState; text: string} {
    if (error) return {state: 'error', text: `Error: ${error}`};
    if (!balance) return {state: 'nodata', text: 'No data'};
    return balance.is_available
        ? {state: 'available', text: 'Available'}
        : {state: 'insufficient', text: 'Insufficient balance'};
}

function formatRelativeTime(updatedAt: number | null): string {
    if (!updatedAt) return 'never';

    const seconds = Math.max(0, Math.floor((Date.now() - updatedAt) / 1000));

    if (seconds < 5) return 'just now';
    if (seconds < 60) return `${seconds} ${seconds === 1 ? 'sec' : 'secs'} ago`;

    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes} ${minutes === 1 ? 'min' : 'mins'} ago`;

    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} ${hours === 1 ? 'hr' : 'hrs'} ago`;

    const days = Math.floor(hours / 24);
    if (days < 7) return `${days} ${days === 1 ? 'day' : 'days'} ago`;

    const weeks = Math.floor(days / 7);
    if (weeks < 5) return `${weeks} ${weeks === 1 ? 'wk' : 'wks'} ago`;

    const months = Math.floor(days / 30);
    if (months < 12) return `${months} ${months === 1 ? 'mo' : 'mos'} ago`;

    const years = Math.floor(days / 365);
    return `${years} ${years === 1 ? 'yr' : 'yrs'} ago`;
}
