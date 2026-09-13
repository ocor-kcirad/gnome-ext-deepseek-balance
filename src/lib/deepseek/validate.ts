import type {BalanceInfo, UserBalance} from './types.js';

const INVALID = 'Unexpected response from DeepSeek API';

export function parseUserBalance(value: unknown): UserBalance {
    if (!isRecord(value)) throw new Error(INVALID);

    const {is_available, balance_infos} = value;
    if (typeof is_available !== 'boolean' || !Array.isArray(balance_infos))
        throw new Error(INVALID);

    return {
        is_available,
        balance_infos: balance_infos.map(parseBalanceInfo),
    };
}

function parseBalanceInfo(value: unknown): BalanceInfo {
    if (!isRecord(value)) throw new Error(INVALID);

    const {currency, total_balance, granted_balance, topped_up_balance} = value;
    if (
        typeof currency !== 'string' ||
        typeof total_balance !== 'string' ||
        typeof granted_balance !== 'string' ||
        typeof topped_up_balance !== 'string'
    )
        throw new Error(INVALID);

    return {currency, total_balance, granted_balance, topped_up_balance};
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}
