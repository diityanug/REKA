import {
  CurrencyType,
  TransactionType,
  AccountType,
  Wallet,
  Pocket,
  Category,
  Transaction,
  TransactionItem,
  AllocationItem,
  AllocationPlan,
  AppExportData,
} from '../services/database';
import { ExtractedReceiptData } from '../services/receiptScanner';

export type TabType = 'overview' | 'accounts' | 'history' | 'analytics';
export type FilterType = 'all' | 'expense' | 'income';
export type ReturnModalType = 'none' | 'manual' | 'review' | 'accountDetail';

export {
  CurrencyType,
  TransactionType,
  AccountType,
  Wallet,
  Pocket,
  Category,
  Transaction,
  TransactionItem,
  AllocationItem,
  AllocationPlan,
  ExtractedReceiptData,
  AppExportData,
};
