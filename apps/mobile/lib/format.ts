import { format, formatDistanceToNow, isToday, isYesterday } from 'date-fns';

export const formatNaira = (amount: number, hideDecimals = false): string => {
  const formatted = new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    minimumFractionDigits: hideDecimals ? 0 : 2,
    maximumFractionDigits: hideDecimals ? 0 : 2,
  }).format(amount);
  return formatted;
};

export const formatUSD = (amount: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
};

export const formatCrypto = (amount: number, decimals = 8): string => {
  return amount.toFixed(decimals).replace(/\.?0+$/, '');
};

export const formatCompactNumber = (num: number): string => {
  if (num >= 1_000_000_000) return `${(num / 1_000_000_000).toFixed(1)}B`;
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
  return num.toString();
};

export const maskBalance = (amount: number, currency: string): string => {
  if (currency === 'NGN') return '₦ *****';
  if (currency === 'USD') return '$ *****';
  return '*****';
};

export const formatTransactionDate = (dateStr: string): string => {
  const date = new Date(dateStr);
  if (isToday(date)) return `Today, ${format(date, 'h:mm a')}`;
  if (isYesterday(date)) return `Yesterday, ${format(date, 'h:mm a')}`;
  return format(date, 'MMM d, yyyy · h:mm a');
};

export const formatTransactionDateShort = (dateStr: string): string => {
  const date = new Date(dateStr);
  if (isToday(date)) return format(date, 'h:mm a');
  if (isYesterday(date)) return 'Yesterday';
  return format(date, 'MMM d');
};

export const formatTimeAgo = (dateStr: string): string => {
  return formatDistanceToNow(new Date(dateStr), { addSuffix: true });
};

export const formatAccountNumber = (num: string): string => {
  return num.replace(/(\d{3})(\d{3})(\d{4})/, '$1 $2 $3');
};

export const formatPhone = (phone: string): string => {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('234')) {
    const local = digits.slice(3);
    return `+234 ${local.slice(0, 3)} ${local.slice(3, 6)} ${local.slice(6)}`;
  }
  return phone;
};

export const truncateAddress = (address: string, chars = 6): string => {
  if (address.length <= chars * 2) return address;
  return `${address.slice(0, chars)}...${address.slice(-chars)}`;
};

export const capitalize = (str: string): string => {
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
};

export const getInitials = (name: string): string => {
  const parts = name.trim().split(' ');
  if (parts.length === 1) return (parts[0]?.[0] ?? '').toUpperCase();
  return ((parts[0]?.[0] ?? '') + (parts[parts.length - 1]?.[0] ?? '')).toUpperCase();
};
