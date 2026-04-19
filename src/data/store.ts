import { create } from 'zustand';
import { Transaction, Category, UserProfile, Budget, Partner, Loan, Product, StockMovement, Employee, BankCard } from '../domain/models';

interface AppState {
  user: UserProfile | null;
  transactions: Transaction[];
  categories: Category[];
  budgets: Budget[];
  partners: Partner[];
  loans: Loan[];
  products: Product[];
  stockMovements: StockMovement[];
  employees: Employee[];
  cards: BankCard[];
  isAuthReady: boolean;
  activeEmployeeId: string | null;
  language: string;
  globalError: string | null;
  setUser: (user: UserProfile | null) => void;
  setTransactions: (transactions: Transaction[]) => void;
  setCategories: (categories: Category[]) => void;
  setBudgets: (budgets: Budget[]) => void;
  setPartners: (partners: Partner[]) => void;
  setLoans: (loans: Loan[]) => void;
  setProducts: (products: Product[]) => void;
  setStockMovements: (stockMovements: StockMovement[]) => void;
  setEmployees: (employees: Employee[]) => void;
  setCards: (cards: BankCard[]) => void;
  setAuthReady: (ready: boolean) => void;
  setActiveEmployeeId: (id: string | null) => void;
  setLanguage: (lang: string) => void;
  setGlobalError: (error: string | null) => void;
}

export const useAppStore = create<AppState>((set) => ({
  user: null,
  transactions: [],
  categories: [],
  budgets: [],
  partners: [],
  loans: [],
  products: [],
  stockMovements: [],
  employees: [],
  cards: [],
  isAuthReady: false,
  activeEmployeeId: null,
  language: 'English',
  globalError: null,
  setUser: (user) => set({ user }),
  setTransactions: (transactions) => set({ transactions }),
  setCategories: (categories) => set({ categories }),
  setBudgets: (budgets) => set({ budgets }),
  setPartners: (partners) => set({ partners }),
  setLoans: (loans) => set({ loans }),
  setProducts: (products) => set({ products }),
  setStockMovements: (stockMovements) => set({ stockMovements }),
  setEmployees: (employees) => set({ employees }),
  setCards: (cards) => set({ cards }),
  setAuthReady: (ready) => set({ isAuthReady: ready }),
  setActiveEmployeeId: (id) => set({ activeEmployeeId: id }),
  setLanguage: (lang) => set({ language: lang }),
  setGlobalError: (error) => set({ globalError: error }),
}));
