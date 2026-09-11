export interface BalanceInfo {
    currency: string;
    total_balance: string;
    granted_balance: string;
    topped_up_balance: string;
}

export interface UserBalance {
    is_available: boolean;
    balance_infos: BalanceInfo[];
}
