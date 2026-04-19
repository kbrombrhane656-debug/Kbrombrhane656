/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useRef } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './firebase';
import { useAppStore } from './data/store';
import { subscribeToUserData, saveUser, fetchUser } from './services/dbService';
import { processRecurringTransactions } from './services/recurringService';

import { Layout } from './ui/Layout';
import { LoginScreen } from './ui/screens/LoginScreen';
import { OnboardingScreen } from './ui/screens/OnboardingScreen';
import { DashboardScreen } from './ui/screens/DashboardScreen';
import { AddTransactionScreen } from './ui/screens/AddTransactionScreen';
import { HistoryScreen } from './ui/screens/HistoryScreen';
import { ReportsScreen } from './ui/screens/ReportsScreen';
import { VoiceCoachScreen } from './ui/screens/VoiceCoachScreen';
import { CategoriesScreen } from './ui/screens/CategoriesScreen';
import { BudgetsScreen } from './ui/screens/BudgetsScreen';
import { InventoryScreen } from './ui/screens/InventoryScreen';
import { StockHistoryScreen } from './ui/screens/StockHistoryScreen';
import { PeopleScreen } from './ui/screens/PeopleScreen';
import { CardsScreen } from './ui/screens/CardsScreen';
import { RecurringScreen } from './ui/screens/RecurringScreen';

export default function App() {
  const { user, isAuthReady, transactions, setUser, setAuthReady } = useAppStore();
  const processedRecurring = useRef(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        // Fetch full profile to get setupCompleted
        await fetchUser(firebaseUser.uid);
        const currentState = useAppStore.getState().user;
        
        if (!currentState) {
          const userProfile = {
            uid: firebaseUser.uid,
            email: firebaseUser.email || '',
            displayName: firebaseUser.displayName || '',
            photoURL: firebaseUser.photoURL || '',
            createdAt: new Date().toISOString(),
          };
          setUser(userProfile);
          await saveUser(userProfile);
        }
      } else {
        setUser(null);
      }
      setAuthReady(true);
    });

    return () => unsubscribe();
  }, [setUser, setAuthReady]);

  useEffect(() => {
    if (user) {
      processedRecurring.current = false;
      const unsubscribe = subscribeToUserData(user.uid);
      return () => unsubscribe();
    }
  }, [user]);

  useEffect(() => {
    if (user && transactions.length > 0 && !processedRecurring.current) {
      processedRecurring.current = true;
      processRecurringTransactions(transactions, user.uid);
    }
  }, [user, transactions]);

  if (!isAuthReady) {
    return <div className="flex items-center justify-center h-screen bg-gray-50 text-emerald-600">Loading...</div>;
  }

  if (!user) {
    return <LoginScreen />;
  }

  return (
    <BrowserRouter>
      <Routes>
        {!user.setupCompleted ? (
          <>
            <Route path="/onboarding" element={<OnboardingScreen />} />
            <Route path="*" element={<Navigate to="/onboarding" replace />} />
          </>
        ) : (
          <Route path="/" element={<Layout />}>
            <Route index element={<DashboardScreen />} />
            <Route path="history" element={<HistoryScreen />} />
            <Route path="add" element={<AddTransactionScreen />} />
            <Route path="reports" element={<ReportsScreen />} />
            <Route path="coach" element={<VoiceCoachScreen />} />
            <Route path="categories" element={<CategoriesScreen />} />
            <Route path="budgets" element={<BudgetsScreen />} />
            <Route path="inventory" element={<InventoryScreen />} />
            <Route path="inventory/history" element={<StockHistoryScreen />} />
            <Route path="people" element={<PeopleScreen />} />
            <Route path="cards" element={<CardsScreen />} />
            <Route path="recurring" element={<RecurringScreen />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        )}
      </Routes>
    </BrowserRouter>
  );
}
