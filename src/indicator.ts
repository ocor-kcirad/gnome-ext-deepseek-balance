import Clutter from 'gi://Clutter';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import St from 'gi://St';

import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';

import type {BalanceInfo, UserBalance} from './lib/deepseek/types.js';
import {Tooltip} from './lib/tooltip.js';
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
    private readonly statusIcon: St.Icon;
    private readonly statusTooltip: Tooltip;
    private readonly totalItem: PopupMenu.PopupMenuItem;
    private readonly grantedItem: PopupMenu.PopupMenuItem;
    private readonly toppedUpItem: PopupMenu.PopupMenuItem;
    private readonly updatedLabel: St.Label;

    private readonly refreshIcon: St.Icon;
    private readonly linkIcon: St.Icon;
    private readonly stSettings = St.Settings.get();
    private readonly colorSchemeId: number;
    private readonly updatedTimerId: number;
    private snapshot: UsageSnapshot = {balance: null, updatedAt: null, error: null};

    constructor(
        private readonly service: UsageService,
        private readonly iconsDir: string
    ) {
        super(0.0, 'DeepSeek Usage');

        this.refreshIcon = new St.Icon({icon_size: 16});
        this.linkIcon = new St.Icon({icon_size: 16});
        this.updateIcons();
        this.colorSchemeId = this.stSettings.connect('notify::color-scheme', () => {
            this.updateIcons();
        });

        this.panelLabel = new St.Label({
            text: 'DeepSeek',
            y_align: Clutter.ActorAlign.CENTER,
        });
        this.add_child(this.panelLabel);

        const statusItem = new PopupMenu.PopupMenuItem('', {reactive: true});
        statusItem.label.hide();
        statusItem.track_hover = true;
        this.statusIcon = new St.Icon({
            icon_name: STATUS_ICON,
            icon_size: 16,
            style_class: 'deepseek-status-icon',
        });
        statusItem.add_child(this.statusIcon);
        this.statusTooltip = new Tooltip(statusItem);
        this.popupMenu.addMenuItem(statusItem);

        this.totalItem = this.addInfoItem('Total balance: —');
        this.grantedItem = this.addInfoItem('Granted balance: —');
        this.toppedUpItem = this.addInfoItem('Topped-up balance: —');

        this.popupMenu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        const actionsItem = new PopupMenu.PopupMenuItem('', {reactive: false, can_focus: false});
        actionsItem.label.hide();
        actionsItem.add_style_class_name('deepseek-actions');

        const actionsBox = new St.BoxLayout({x_expand: true});
        actionsItem.add_child(actionsBox);

        this.updatedLabel = new St.Label({
            text: 'Updated never',
            x_expand: true,
            y_align: Clutter.ActorAlign.CENTER,
            style_class: 'deepseek-updated',
        });
        actionsBox.add_child(this.updatedLabel);

        const refreshButton = new St.Button({
            child: this.refreshIcon,
            style_class: 'deepseek-action-button deepseek-icon-button',
        });
        refreshButton.connect('clicked', () => {
            this.service.refresh();
        });
        actionsBox.add_child(refreshButton);

        const linkButton = new St.Button({
            child: this.linkIcon,
            style_class: 'deepseek-action-button deepseek-icon-button',
        });
        linkButton.connect('clicked', () => {
            Gio.AppInfo.launch_default_for_uri(USAGE_URL, null);
        });
        actionsBox.add_child(linkButton);

        this.popupMenu.addMenuItem(actionsItem);

        this.updatedTimerId = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 30, () => {
            this.updateUpdatedLabel();
            return GLib.SOURCE_CONTINUE;
        });

        this.update(this.service.getSnapshot());
    }

    private get popupMenu(): PopupMenu.PopupMenu {
        return this.menu as PopupMenu.PopupMenu;
    }

    private updateIcons(): void {
        const suffix =
            this.stSettings.color_scheme === St.SystemColorScheme.PREFER_LIGHT ? 'light' : 'dark';
        const icons: [St.Icon, string][] = [
            [this.refreshIcon, `refresh-${suffix}.svg`],
            [this.linkIcon, `deepseek-${suffix}.svg`],
        ];
        for (const [icon, file] of icons)
            icon.set_gicon(
                Gio.icon_new_for_string(`${this.iconsDir}/${file}`) as unknown as St.Icon['gicon']
            );
    }

    private updateUpdatedLabel(): void {
        this.updatedLabel.set_text(`Updated ${formatRelativeTime(this.snapshot.updatedAt)}`);
    }

    override destroy(): void {
        if (this.updatedTimerId) GLib.source_remove(this.updatedTimerId);
        this.stSettings.disconnect(this.colorSchemeId);
        this.statusTooltip.destroy();
        super.destroy();
    }

    private addInfoItem(text: string): PopupMenu.PopupMenuItem {
        const item = new PopupMenu.PopupMenuItem(text);
        item.setSensitive(false);
        this.popupMenu.addMenuItem(item);
        return item;
    }

    update(snapshot: UsageSnapshot): void {
        this.snapshot = snapshot;
        const {balance, error} = snapshot;
        const info = selectBalance(balance?.balance_infos ?? []);

        this.panelLabel.set_text(
            info ? formatAmount(info.currency, info.total_balance) : error ? '⚠ DeepSeek' : 'DeepSeek'
        );
        const {state, text} = statusState(balance, error);
        this.statusIcon.set_style_class_name(`deepseek-status-icon deepseek-status-${state}`);
        this.statusIcon.set_accessible_name(text);
        this.statusTooltip.set_text(text);
        this.totalItem.label.set_text(`Total balance: ${amountText(info, 'total_balance')}`);
        this.grantedItem.label.set_text(`Granted balance: ${amountText(info, 'granted_balance')}`);
        this.toppedUpItem.label.set_text(`Topped-up balance: ${amountText(info, 'topped_up_balance')}`);
        this.updateUpdatedLabel();
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

type StatusState = 'available' | 'insufficient' | 'nodata' | 'error';

const STATUS_ICON = 'media-record-symbolic';

function statusState(
    balance: UserBalance | null,
    error: string | null
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
