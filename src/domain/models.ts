export type TransactionType = 'income' | 'expense' | 'loan_given' | 'loan_received' | 'payment_received' | 'payment_given';
export type RecurringFrequency = 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly';

export interface Transaction {
  id: string;
  userId: string;
  amount: number;
  type: TransactionType;
  category: string;
  note?: string;
  date: string;
  createdAt: string;
  recurringFrequency?: RecurringFrequency;
  nextRecurringDate?: string;
  recurringEndDate?: string;
  isRecurringActive?: boolean;
  partnerId?: string;
  loanId?: string;
  cardId?: string;
  productId?: string;
}

export interface Category {
  id: string;
  userId: string;
  name: string;
  type: 'income' | 'expense' | 'both' | 'system';
  icon?: string;
  color?: string;
  createdAt: string;
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string;
  createdAt: string;
  businessType?: string;
  setupCompleted?: boolean;
}

export interface Budget {
  id: string;
  userId: string;
  category: string;
  amount: number;
  month: string;
  createdAt: string;
}

export interface Partner {
  id: string;
  userId: string;
  name: string;
  type: 'customer' | 'supplier' | 'both';
  phone?: string;
  createdAt: string;
}

export interface LoanPayment {
  date: string;
  amount: number;
}

export interface Loan {
  id: string;
  userId: string;
  partnerId?: string;
  type: 'given' | 'received';
  amount: number;
  remainingAmount: number;
  monthlyPayment?: number;
  interest?: number;
  startDate: string;
  durationMonths?: number;
  createdAt: string;
  status: 'active' | 'paid_off';
  paymentHistory?: LoanPayment[];
  nextPaymentDate?: string;
  taxRate?: number;
  taxAmount?: number;
  penaltyFee?: number;
  dueDate?: string;
  bankName?: string;
  accountNumber?: string;
  loanPurpose?: string;
  isBankLoan?: boolean;
}

export interface Product {
  id: string;
  userId: string;
  name: string;
  sku?: string;
  category?: string;
  warehouseLocation?: string;
  lowStockThreshold?: number;
  price: number;
  cost: number;
  stock: number;
  createdAt: string;
}

export interface StockMovement {
  id: string;
  userId: string;
  productId: string;
  type: 'IN' | 'OUT' | 'ADJUST';
  quantity: number;
  date: string;
  reason?: string;
  createdAt: string;
}

export interface Employee {
  id: string;
  userId: string;
  name: string;
  role: 'admin' | 'staff' | 'viewer';
  pin?: string;
  status: 'active' | 'inactive';
  createdAt: string;
}

export interface BankCard {
  id: string;
  userId: string;
  name: string;
  accountName?: string;
  accountNumber?: string;
  branchName?: string;
  isVirtual?: boolean;
  balance: number;
  color?: string;
  createdAt: string;
}
