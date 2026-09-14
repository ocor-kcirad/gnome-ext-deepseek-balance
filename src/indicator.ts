import Clutter from 'gi://Clutter';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import St from 'gi://St';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
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
        GObject.registerClass({GTypeName: 'DeepSeekBalanceIndicator'}, this);
    }

    private readonly panelLabel: St.Label;
    private readonly statusItem: PopupMenu.PopupMenuItem;
    private statusIcon!: St.Icon;
    private totalValueLabel!: St.Label;
    private readonly updatedItem!: PopupMenu.PopupMenuItem;
    private currencyButton!: St.Button;
    private currencyLabel!: St.Label;

    private readonly linkIcon: St.Icon;
    private readonly stSettings = St.Settings.get();
    private readonly colorSchemeId: number;
    private readonly _updatedTimerId: number;
    private currency = '';
    private snapshot: UsageSnapshot = {
        balance: null,
        updatedAt: null,
        error: null,
    };

    constructor(
        private readonly service: UsageService,
        private readonly iconsDir: string,
        private readonly onCurrencyChange: (currency: string) => void,
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

        this.statusItem = this.buildStatusItem();
        this.popupMenu.addMenuItem(this.statusItem);
        this.popupMenu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        this.popupMenu.box.add_child(this.buildTotalBox());
        this.popupMenu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        this.updatedItem = this.buildUpdatedItem();
        this.popupMenu.addMenuItem(this.updatedItem);

        this._updatedTimerId = GLib.timeout_add_seconds(
            GLib.PRIORITY_DEFAULT,
            30,
            () => {
                this.updateUpdatedLabel();
                return GLib.SOURCE_CONTINUE;
            },
        );

        this.update(this.service.getSnapshot());
    }

    private openUsagePage(): void {
        try {
            Gio.AppInfo.launch_default_for_uri(USAGE_URL, null);
        } catch (error) {
            logError(error as object, 'Failed to open the DeepSeek usage page');
            Main.notify(
                'DeepSeek Balance',
                'Could not open the DeepSeek usage page.',
            );
        }
    }

    private buildStatusItem(): PopupMenu.PopupMenuItem {
        const item = new PopupMenu.PopupMenuItem('Status:');
        item.label.x_expand = true;
        item.track_hover = true;

        this.statusIcon = new St.Icon({
            icon_name: STATUS_ICON,
            icon_size: 16,
            style_class: 'deepseek-status-icon',
        });
        item.add_child(this.statusIcon);

        const linkButton = new St.Button({
            style_class: 'deepseek-action-button deepseek-icon-button',
        });
        linkButton.set_child(this.linkIcon);
        linkButton.connect('clicked', () => {
            this.openUsagePage();
        });
        item.add_child(linkButton);

        return item;
    }

    private buildTotalBox(): St.BoxLayout {
        const totalBox = new St.BoxLayout({
            orientation: Clutter.Orientation.VERTICAL,
            x_expand: true,
            reactive: true,
            style_class: 'deepseek-total',
        });

        const headingRow = new St.BoxLayout({
            x_expand: true,
            reactive: true,
            style_class: 'deepseek-total-heading-row',
        });
        headingRow.add_child(
            new St.Label({
                text: 'Total Balance:',
                x_expand: true,
                reactive: true,
                style_class: 'deepseek-total-heading',
            }),
        );

        this.currencyLabel = new St.Label({
            text: '',
            y_align: Clutter.ActorAlign.CENTER,
        });
        const currencyButton = new St.Button({
            visible: false,
            style_class:
                'deepseek-action-button deepseek-icon-button deepseek-currency-toggle',
        });
        currencyButton.set_child(this.currencyLabel);
        this.currencyButton = currencyButton;
        currencyButton.set_accessible_name('Switch currency');
        currencyButton.connect('clicked', () => {
            this.cycleCurrency();
        });
        headingRow.add_child(currencyButton);
        totalBox.add_child(headingRow);

        this.totalValueLabel = new St.Label({
            text: '—',
            x_expand: true,
            x_align: Clutter.ActorAlign.CENTER,
            style_class: 'deepseek-total-value',
            reactive: true,
        });
        totalBox.add_child(this.totalValueLabel);

        return totalBox;
    }

    private buildUpdatedItem(): PopupMenu.PopupMenuItem {
        const item = new PopupMenu.PopupMenuItem('No updates yet');
        item.label.x_expand = true;
        item.label.x_align = Clutter.ActorAlign.CENTER;
        item.label.add_style_class_name('deepseek-updated');
        item.set_accessible_name('Refresh balance');
        item.connect('activate', () => {
            this.service.refresh();
        });
        return item;
    }

    private get popupMenu(): PopupMenu.PopupMenu {
        return this.menu as PopupMenu.PopupMenu;
    }

    private updateIcons(): void {
        const scheme =
            this.stSettings.color_scheme === St.SystemColorScheme.PREFER_LIGHT
                ? 'light'
                : 'dark';
        const iconPath = `${this.iconsDir}/balance-${scheme}.svg`;
        this.linkIcon.set_gicon(
            Gio.icon_new_for_string(iconPath) as unknown as St.Icon['gicon'],
        );
    }

    private updateUpdatedLabel(): void {
        const {updatedAt} = this.snapshot;
        this.updatedItem.label.set_text(
            updatedAt === null
                ? 'No updates yet'
                : `Updated ${formatRelativeTime(updatedAt)}`,
        );
    }

    override destroy(): void {
        if (this._updatedTimerId) GLib.Source.remove(this._updatedTimerId);
        this.stSettings.disconnect(this.colorSchemeId);
        super.destroy();
    }

    setCurrency(currency: string): void {
        if (this.currency === currency) return;

        this.currency = currency;
        this.update(this.snapshot);
    }

    private cycleCurrency(): void {
        const infos = this.snapshot.balance?.balance_infos ?? [];
        const next = nextCurrency(infos, selectBalance(infos, this.currency));
        if (!next) return;

        this.onCurrencyChange(next);
        this.setCurrency(next);
    }

    private updateCurrencyToggle(
        infos: BalanceInfo[],
        info: BalanceInfo | null,
    ): void {
        const multiple = infos.length > 1;
        this.currencyButton.visible = multiple;
        if (!multiple || !info) return;

        this.currencyLabel.set_text(info.currency);

        const next = nextCurrency(infos, info);
        if (next)
            this.currencyButton.set_accessible_name(`Show balance in ${next}`);
    }

    update(snapshot: UsageSnapshot): void {
        this.snapshot = snapshot;
        const {balance, error} = snapshot;
        const infos = balance?.balance_infos ?? [];
        const info = selectBalance(infos, this.currency);

        this.panelLabel.set_text(panelText(info, error));
        const {state, text} = statusState(balance, info, error);
        this.statusIcon.set_style_class_name(
            `deepseek-status-icon deepseek-status-${state}`,
        );
        this.statusIcon.set_accessible_name(text);
        this.totalValueLabel.set_text(
            info ? formatAmount(info.currency, info.total_balance) : '—',
        );
        this.updateCurrencyToggle(infos, info);
        this.updateUpdatedLabel();
    }
}

function selectBalance(
    infos: BalanceInfo[],
    preferred: string,
): BalanceInfo | null {
    if (preferred) {
        const match = infos.find((info) => info.currency === preferred);
        if (match) return match;
    }

    return infos.length > 0 ? infos[0] : null;
}

function nextCurrency(
    infos: BalanceInfo[],
    current: BalanceInfo | null,
): string | null {
    if (infos.length < 2) return null;

    const currencies = infos.map((info) => info.currency);
    const index = current ? currencies.indexOf(current.currency) : -1;
    return currencies[(index + 1) % currencies.length];
}

function panelText(info: BalanceInfo | null, error: string | null): string {
    if (info)
        return error
            ? `⚠ ${formatAmount(info.currency, info.total_balance)}`
            : formatAmount(info.currency, info.total_balance);
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
    info: BalanceInfo | null,
    error: string | null,
): {state: StatusState; text: string} {
    if (error) return {state: 'error', text: `Error: ${error}`};
    if (!balance || !info) return {state: 'nodata', text: 'No data'};
    return balance.is_available
        ? {state: 'available', text: 'Available'}
        : {state: 'insufficient', text: 'Insufficient balance'};
}

function formatRelativeTime(updatedAt: number): string {
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
