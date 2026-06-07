export interface UserSession {
  userId: string;
  username: string;
  deviceId: string;
  accessToken: string;
  tCurrent: string;
  tVersion: number;
  k2Encrypted: string;
  sessionSecretEncrypted: string;
  k2Raw: string;
  sessionSecretRaw: string;
  activationCodeHash: string;
  nidHash: string;
  browserFingerprint: string;
  isLoggedIn: boolean;
}

export interface LoginCredentials {
  username: string;
  password: string;
}

export interface TransactionPayload {
  receiverUsername: string;
  amount: string;
  currency?: string;
}

export interface Transaction {
  transaction_id: string;
  direction: "sent" | "received";
  counterparty_username: string;
  amount: string;
  currency: string;
  status: string;
  completed_at: string | null;
}

export interface TransactionHistoryResponse {
  transactions: Transaction[];
  total: number;
  page: number;
  pages: number;
}

export interface BalanceResponse {
  balance: string;
  currency: string;
  daily_limit: string;
  daily_used: string;
  daily_remaining: string;
}

export interface AppNotification {
  id: string;
  type: "transaction_received" | "transaction_failed" | "account_suspended" | "daily_limit_warning";
  title: string;
  message: string;
  is_read: boolean;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export interface NotificationListResponse {
  notifications: AppNotification[];
  total_unread: number;
}

export interface ApiError {
  error: string;
  detail?: string;
}
