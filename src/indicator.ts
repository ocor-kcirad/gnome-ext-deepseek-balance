import Clutter from 'gi://Clutter';
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

export class UsageIndicator extends PanelMenu.Button {
    private readonly panelLabel: St.Label;
    private readonly statusItem: PopupMenu.PopupMenuItem;
    private readonly totalItem: PopupMenu.PopupMenuItem;
    private readonly grantedItem: PopupMenu.PopupMenuItem;
    private readonly toppedUpItem: PopupMenu.PopupMenuItem;
    private readonly updatedItem: PopupMenu.PopupMenuItem;

    constructor(private readonly service: UsageService) {
        super(0.0, 'DeepSeek Usage');

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

        const refreshItem = new PopupMenu.PopupMenuItem('Refresh now');
        refreshItem.connect('activate', () => {
            this.service.refresh();
        });
        this.popupMenu.addMenuItem(refreshItem);

        this.update(this.service.getSnapshot());
    }

    private get popupMenu(): PopupMenu.PopupMenu {
        return this.menu as PopupMenu.PopupMenu;
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
