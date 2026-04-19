import { Transaction, Loan, Product, StockMovement } from '../../domain/models';
import { isToday, differenceInDays, parseISO, subDays, startOfDay, format } from 'date-fns';

export interface Insight {
  id: string;
  type: 'warning' | 'success' | 'info';
  message: string;
}

export interface InsightResult {
  insights: Insight[];
  healthScore: number;
}

export const generateInsights = (
  transactions: Transaction[], 
  loans: Loan[], 
  products: Product[],
  stockMovements: StockMovement[]
): InsightResult => {
  const insights: Insight[] = [];
  let healthScore = 50; // Starting baseline
  
  const today = startOfDay(new Date());
  const todayTransactions = transactions.filter(t => isToday(parseISO(t.date)));
  
  const todayIncome = todayTransactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
  const todayExpense = todayTransactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
  const todayProfit = todayIncome - todayExpense;

  const currentMonthIncome = transactions.filter(t => t.type === 'income' && differenceInDays(today, parseISO(t.date)) <= 30).reduce((sum, t) => sum + t.amount, 0);
  if (currentMonthIncome > 0) healthScore += 10;

  // 1. LOSS DETECTION
  if (todayExpense > todayIncome && todayExpense > 0) {
    insights.push({
      id: 'loss-detection',
      type: 'warning',
      message: '⚠️ You are losing money today. Try to minimize further expenses.'
    });
  }

  // 2. PROFIT POSITIVE
  if (todayProfit > 0) {
    insights.push({
      id: 'profit-positive',
      type: 'success',
      message: `✅ Good job! You've made a profit of ${todayProfit.toLocaleString()} ETB today.`
    });
    healthScore += 10;
  }

  // 3. REFINED TREND DROP
  let consecutiveLossDays = 0;
  for (let i = 0; i < 3; i++) {
    const d = subDays(today, i);
    const dayTx = transactions.filter(t => {
      const txDate = startOfDay(parseISO(t.date));
      return txDate.getTime() === d.getTime();
    });
    const inc = dayTx.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
    const exp = dayTx.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
    if (exp > inc && exp > 0) {
      consecutiveLossDays++;
    } else {
      break;
    }
  }
  
  if (consecutiveLossDays >= 3) {
    insights.push({
      id: 'trend-drop',
      type: 'warning',
      message: '⚠️ Your profit has dropped for 3 consecutive days. Review your recent expenses.'
    });
    healthScore -= 15;
  }

  // 4. REFINED EXPENSE SPIKE (Compare today's category expense to its 30-day average)
  const last30DaysTx = transactions.filter(t => differenceInDays(today, parseISO(t.date)) <= 30 && !isToday(parseISO(t.date)));
  const expensesByCategory = todayTransactions.filter(t => t.type === 'expense').reduce((acc, t) => {
    acc[t.category] = (acc[t.category] || 0) + t.amount;
    return acc;
  }, {} as Record<string, number>);

  for (const [category, amount] of Object.entries(expensesByCategory)) {
    const pastCategoryTx = last30DaysTx.filter(t => t.type === 'expense' && t.category === category);
    const pastTotal = pastCategoryTx.reduce((sum, t) => sum + t.amount, 0);
    const pastDaysWithExpense = new Set(pastCategoryTx.map(t => startOfDay(parseISO(t.date)).getTime())).size;
    const avgDailyExpense = pastDaysWithExpense > 0 ? pastTotal / pastDaysWithExpense : 0;

    if (avgDailyExpense > 0 && amount > avgDailyExpense * 1.5 && amount > 100) {
      insights.push({
        id: `expense-spike-${category}`,
        type: 'warning',
        message: `📉 Your ${category} expenses are 50% higher than usual today.`
      });
      healthScore -= 5;
    }
  }

  // 5. SALES TRENDS & OPPORTUNITIES (Identify best day for sales)
  const incomeTx = transactions.filter(t => t.type === 'income');
  if (incomeTx.length > 5) {
    const salesByDay: Record<string, number> = {};
    const countsByDay: Record<string, number> = {};
    
    incomeTx.forEach(t => {
      const dayName = format(parseISO(t.date), 'EEEE');
      salesByDay[dayName] = (salesByDay[dayName] || 0) + t.amount;
      countsByDay[dayName] = (countsByDay[dayName] || 0) + 1;
    });

    let bestDay = '';
    let maxAvgSales = 0;
    let totalAvgSales = 0;
    let daysCounted = 0;

    for (const day in salesByDay) {
      const avg = salesByDay[day] / countsByDay[day];
      totalAvgSales += avg;
      daysCounted++;
      if (avg > maxAvgSales) {
        maxAvgSales = avg;
        bestDay = day;
      }
    }

    const overallAvg = daysCounted > 0 ? totalAvgSales / daysCounted : 0;

    // If the best day is significantly better than average (e.g., 20% higher)
    if (bestDay && maxAvgSales > overallAvg * 1.2 && overallAvg > 0) {
      const percentage = Math.round(((maxAvgSales - overallAvg) / overallAvg) * 100);
      const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const bestDayIndex = daysOfWeek.indexOf(bestDay);
      const stockDay = daysOfWeek[(bestDayIndex - 1 + 7) % 7];

      insights.push({
        id: 'sales-opportunity',
        type: 'info',
        message: `💡 Sales are ${percentage}% higher on ${bestDay}s. Consider increasing your stock levels by ${stockDay} morning.`
      });
      healthScore += 5;
    }
  }

  // 6. LOW STOCK ALERTS (Fast selling items)
  const OUT_OF_STOCK_THRESHOLD = 5;
  const lowStockProducts = products.filter(p => p.stock <= OUT_OF_STOCK_THRESHOLD);
  if (lowStockProducts.length > 0) {
    const fastSellingLowStock = lowStockProducts.filter(p => {
      const recentOuts = stockMovements.filter(m => m.productId === p.id && m.type === 'OUT' && differenceInDays(today, parseISO(m.date)) <= 30);
      const outSum = recentOuts.reduce((sum, m) => sum + m.quantity, 0);
      return outSum > OUT_OF_STOCK_THRESHOLD; 
    });

    if (fastSellingLowStock.length > 0) {
      insights.push({
        id: 'restock-fast-selling',
        type: 'warning',
        message: `📦 Restock fast-selling items: ${fastSellingLowStock.map(p => p.name).join(', ')} (Low stock and selling fast).`
      });
      healthScore -= 10;
    }
  }

  // 7. LOAN PRESSURE ALERTS & RECURRING OVERLOAD (PHASE 6)
  const activeLoansReceived = loans.filter(l => l.type === 'received' && l.status === 'active');
  const loanMonthlyObligations = activeLoansReceived.reduce((sum, l) => sum + (l.monthlyPayment || 0), 0);
  
  const recurringParents = transactions.filter(t => t.recurringFrequency && t.recurringFrequency !== 'none' && t.type === 'expense');
  const estimatedRecurringMonthly = recurringParents.reduce((sum, t) => {
    if (t.recurringFrequency === 'daily') return sum + (t.amount * 30);
    if (t.recurringFrequency === 'weekly') return sum + (t.amount * 4.33);
    if (t.recurringFrequency === 'monthly') return sum + t.amount;
    if (t.recurringFrequency === 'yearly') return sum + (t.amount / 12);
    return sum;
  }, 0);

  const totalMonthlyBurn = loanMonthlyObligations + estimatedRecurringMonthly;

  if (totalMonthlyBurn > 0 && currentMonthIncome > 0) {
    if (totalMonthlyBurn > (currentMonthIncome * 0.4)) {
      insights.push({
        id: 'recurring-overload',
        type: 'warning',
        message: `🚨 Critical: Your monthly obligations (${totalMonthlyBurn.toLocaleString()} ETB) are exceeding 40% of your average income. Please reduce overhead.`
      });
      healthScore -= 30; // Heavy penalty for structural risk
    } else {
      insights.push({
        id: 'burn-target',
        type: 'info',
        message: `🎯 Target: Earn at least ${totalMonthlyBurn.toLocaleString()} ETB more this month to strictly cover overhead.`
      });
    }
  }

  // 8. UPCOMING RECURRING EXPENSES
  const upcomingRecurring = recurringParents.filter(t => {
    if (!t.nextRecurringDate) return false;
    const diff = differenceInDays(parseISO(t.nextRecurringDate), today);
    return diff >= 0 && diff <= 3;
  });

  if (upcomingRecurring.length > 0) {
    const totalUpcoming = upcomingRecurring.reduce((sum, t) => sum + t.amount, 0);
    insights.push({
      id: 'upcoming-recurring',
      type: 'info',
      message: `📅 Reminder: You have ${upcomingRecurring.length} recurring expenses (${totalUpcoming.toLocaleString()} ETB) due in the next 3 days.`
    });
  }

  healthScore = Math.max(0, Math.min(100, Math.round(healthScore)));
  return { insights, healthScore };
};
