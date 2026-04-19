import { collection, doc, setDoc, deleteDoc, onSnapshot, query, where, getDoc, runTransaction } from 'firebase/firestore';
import { db } from '../firebase';
import { Transaction, Category, UserProfile, Budget, Partner, Loan, Product, StockMovement, Employee, BankCard } from '../domain/models';
import { useAppStore } from '../data/store';

export const subscribeToUserData = (userId: string) => {
  const transactionsQuery = query(collection(db, 'transactions'), where('userId', '==', userId));
  const categoriesQuery = query(collection(db, 'categories'), where('userId', '==', userId));
  const budgetsQuery = query(collection(db, 'budgets'), where('userId', '==', userId));
  const partnersQuery = query(collection(db, 'partners'), where('userId', '==', userId));
  const loansQuery = query(collection(db, 'loans'), where('userId', '==', userId));
  const productsQuery = query(collection(db, 'products'), where('userId', '==', userId));
  const stockMovementsQuery = query(collection(db, 'stockMovements'), where('userId', '==', userId));
  const employeesQuery = query(collection(db, 'employees'), where('userId', '==', userId));
  const cardsQuery = query(collection(db, 'cards'), where('userId', '==', userId));

  const unsubTransactions = onSnapshot(transactionsQuery, (snapshot) => {
    const transactions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Transaction));
    useAppStore.getState().setTransactions(transactions);
  });

  const unsubCategories = onSnapshot(categoriesQuery, (snapshot) => {
    const categories = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Category));
    useAppStore.getState().setCategories(categories);
  });

  const unsubBudgets = onSnapshot(budgetsQuery, (snapshot) => {
    const budgets = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Budget));
    useAppStore.getState().setBudgets(budgets);
  });

  const unsubPartners = onSnapshot(partnersQuery, (snapshot) => {
    const partners = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Partner));
    useAppStore.getState().setPartners(partners);
  });

  const unsubLoans = onSnapshot(loansQuery, (snapshot) => {
    const loans = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Loan));
    useAppStore.getState().setLoans(loans);
  });

  const unsubProducts = onSnapshot(productsQuery, (snapshot) => {
    const products = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product));
    useAppStore.getState().setProducts(products);
  });

  const unsubStockMovements = onSnapshot(stockMovementsQuery, (snapshot) => {
    const stockMovements = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as StockMovement));
    useAppStore.getState().setStockMovements(stockMovements);
  });

  const unsubEmployees = onSnapshot(employeesQuery, (snapshot) => {
    const employees = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Employee));
    useAppStore.getState().setEmployees(employees);
  });

  const unsubCards = onSnapshot(cardsQuery, (snapshot) => {
    const cards = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as BankCard));
    useAppStore.getState().setCards(cards);
  });

  return () => {
    unsubTransactions();
    unsubCategories();
    unsubBudgets();
    unsubPartners();
    unsubLoans();
    unsubProducts();
    unsubStockMovements();
    unsubEmployees();
    unsubCards();
  };
};

export const fetchUser = async (uid: string) => {
  const userDoc = await getDoc(doc(db, 'users', uid));
  if (userDoc.exists()) {
    useAppStore.getState().setUser(userDoc.data() as UserProfile);
  }
};

const cleanObj = <T extends object>(obj: T): T => {
  const cleaned = { ...obj };
  Object.keys(cleaned).forEach(key => cleaned[key as keyof T] === undefined && delete cleaned[key as keyof T]);
  return cleaned;
};

const executeWithErrorHandling = async <T,>(operation: () => Promise<T>, operationType: string, path: string | null = null): Promise<T> => {
  try {
    return await operation();
  } catch (error: any) {
    console.error(`Firestore ${operationType} Error:`, error);
    if (error?.code === 'permission-denied') {
       useAppStore.getState().setGlobalError(
         JSON.stringify({
            error: error.message,
            operationType,
            path,
            authInfo: {
              userId: useAppStore.getState().user?.uid || 'anonymous',
              email: useAppStore.getState().user?.email || '',
            }
         })
       );
    }
    throw error;
  }
};

export const saveTransaction = async (transaction: Omit<Transaction, 'id'>, id?: string) => {
  const docRef = id ? doc(db, 'transactions', id) : doc(collection(db, 'transactions'));
  const newTransaction = { ...transaction, id: docRef.id };
  
  return executeWithErrorHandling(async () => {
    // Use a Firestore transaction to ensure consistence across cards and products
    await runTransaction(db, async (txn) => {
      // 1. Transaction update
      txn.set(docRef, cleanObj(newTransaction));

      // 2. Card Balance update
      if (newTransaction.cardId) {
        const cardRef = doc(db, 'cards', newTransaction.cardId);
        const cardSnap = await txn.get(cardRef);
        if (cardSnap.exists()) {
          const cardData = cardSnap.data() as BankCard;
          const amount = newTransaction.amount;
          const multiplier = (newTransaction.type === 'income' || newTransaction.type === 'loan_received' || newTransaction.type === 'payment_received') ? 1 : -1;
          txn.update(cardRef, { balance: cardData.balance + (amount * multiplier) });
        }
      }

      // 3. Product Inventory update
      if (newTransaction.productId) {
        const prodRef = doc(db, 'products', newTransaction.productId);
        const prodSnap = await txn.get(prodRef);
        if (prodSnap.exists()) {
          const prodData = prodSnap.data() as Product;
          const isSalesType = newTransaction.type === 'income' || newTransaction.type === 'payment_received';
          const stockDelta = isSalesType ? -1 : 1; 
          
          const newStock = prodData.stock + (stockDelta * 1);
          txn.update(prodRef, { stock: Math.max(0, newStock) });

          // Record stock movement
          const moveRef = doc(collection(db, 'stockMovements'));
          txn.set(moveRef, cleanObj({
            id: moveRef.id,
            userId: newTransaction.userId,
            productId: newTransaction.productId,
            type: stockDelta > 0 ? 'IN' : 'OUT',
            quantity: 1,
            date: newTransaction.date,
            reason: `Auto-linked from transaction: ${newTransaction.category}`,
            createdAt: new Date().toISOString()
          }));
        }
      }
    });

    return newTransaction;
  }, id ? 'update' : 'create', `transactions/${docRef.id}`);
};

export const removeTransaction = async (id: string) => {
  return executeWithErrorHandling(async () => {
    await deleteDoc(doc(db, 'transactions', id));
  }, 'delete', `transactions/${id}`);
};

export const saveCategory = async (category: Omit<Category, 'id'>, id?: string) => {
  const docRef = id ? doc(db, 'categories', id) : doc(collection(db, 'categories'));
  const newCategory = { ...category, id: docRef.id };
  return executeWithErrorHandling(async () => {
    await setDoc(docRef, cleanObj(newCategory));
    return newCategory;
  }, id ? 'update' : 'create', `categories/${docRef.id}`);
};

export const removeCategory = async (id: string) => {
  return executeWithErrorHandling(async () => {
    await deleteDoc(doc(db, 'categories', id));
  }, 'delete', `categories/${id}`);
};

export const saveBudget = async (budget: Omit<Budget, 'id'>, id?: string) => {
  const docRef = id ? doc(db, 'budgets', id) : doc(collection(db, 'budgets'));
  const newBudget = { ...budget, id: docRef.id };
  return executeWithErrorHandling(async () => {
    await setDoc(docRef, cleanObj(newBudget));
    return newBudget;
  }, id ? 'update' : 'create', `budgets/${docRef.id}`);
};

export const removeBudget = async (id: string) => {
  return executeWithErrorHandling(async () => {
    await deleteDoc(doc(db, 'budgets', id));
  }, 'delete', `budgets/${id}`);
};

export const savePartner = async (partner: Omit<Partner, 'id'>, id?: string) => {
  const docRef = id ? doc(db, 'partners', id) : doc(collection(db, 'partners'));
  const newPartner = { ...partner, id: docRef.id };
  return executeWithErrorHandling(async () => {
    await setDoc(docRef, cleanObj(newPartner));
    return newPartner;
  }, id ? 'update' : 'create', `partners/${docRef.id}`);
};

export const saveLoan = async (loan: Omit<Loan, 'id'>, id?: string) => {
  const docRef = id ? doc(db, 'loans', id) : doc(collection(db, 'loans'));
  const newLoan = { ...loan, id: docRef.id };
  return executeWithErrorHandling(async () => {
    await setDoc(docRef, cleanObj(newLoan));
    return newLoan;
  }, id ? 'update' : 'create', `loans/${docRef.id}`);
};

export const saveProduct = async (product: Omit<Product, 'id'>, id?: string) => {
  const docRef = id ? doc(db, 'products', id) : doc(collection(db, 'products'));
  const newProduct = { ...product, id: docRef.id };
  return executeWithErrorHandling(async () => {
    await setDoc(docRef, cleanObj(newProduct));
    return newProduct;
  }, id ? 'update' : 'create', `products/${docRef.id}`);
};

export const saveStockMovement = async (movement: Omit<StockMovement, 'id'>, id?: string) => {
  const docRef = id ? doc(db, 'stockMovements', id) : doc(collection(db, 'stockMovements'));
  const newMovement = { ...movement, id: docRef.id };
  return executeWithErrorHandling(async () => {
    await setDoc(docRef, cleanObj(newMovement));
    return newMovement;
  }, id ? 'update' : 'create', `stockMovements/${docRef.id}`);
};

export const saveEmployee = async (employee: Omit<Employee, 'id'>, id?: string) => {
  const docRef = id ? doc(db, 'employees', id) : doc(collection(db, 'employees'));
  const newEmployee = { ...employee, id: docRef.id };
  return executeWithErrorHandling(async () => {
    await setDoc(docRef, cleanObj(newEmployee));
    return newEmployee;
  }, id ? 'update' : 'create', `employees/${docRef.id}`);
};

export const saveCard = async (card: Omit<BankCard, 'id'>, id?: string) => {
  const docRef = id ? doc(db, 'cards', id) : doc(collection(db, 'cards'));
  const newCard = { ...card, id: docRef.id };
  return executeWithErrorHandling(async () => {
    await setDoc(docRef, cleanObj(newCard));
    return newCard;
  }, id ? 'update' : 'create', `cards/${docRef.id}`);
};

export const removeCard = async (id: string) => {
  return executeWithErrorHandling(async () => {
    await deleteDoc(doc(db, 'cards', id));
  }, 'delete', `cards/${id}`);
};

export const saveUser = async (user: UserProfile) => {
  await setDoc(doc(db, 'users', user.uid), cleanObj(user), { merge: true });
};
