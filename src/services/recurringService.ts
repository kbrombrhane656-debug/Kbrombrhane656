import { Transaction } from '../domain/models';
import { saveTransaction } from './dbService';

export const processRecurringTransactions = async (transactions: Transaction[], userId: string) => {
  const now = new Date();
  
  // Find all transactions that are recurring and have a nextRecurringDate in the past or present
  // Also ensuring they are active (defaults to true if undefined)
  const recurringParents = transactions.filter(t => 
    t.recurringFrequency && 
    t.recurringFrequency !== 'none' && 
    t.nextRecurringDate && 
    new Date(t.nextRecurringDate) <= now &&
    t.isRecurringActive !== false
  );

  for (const parent of recurringParents) {
    if (!parent.nextRecurringDate) continue;
    
    let nextDate = new Date(parent.nextRecurringDate);
    let generationCount = 0;
    const MAX_GENERATIONS = 50; // Prevent infinite loops if date is way off
    const endDate = parent.recurringEndDate ? new Date(parent.recurringEndDate) : null;

    let generatedAny = false;

    while (nextDate <= now && generationCount < MAX_GENERATIONS && (!endDate || nextDate <= endDate)) {
      // Create new transaction instance
      await saveTransaction({
        userId,
        amount: parent.amount,
        type: parent.type,
        category: parent.category,
        note: parent.note ? `${parent.note} (Auto)` : '(Auto)',
        date: nextDate.toISOString(),
        createdAt: new Date().toISOString(),
        cardId: parent.cardId,
        productId: parent.productId,
        // New instances are NOT recurring themselves
        recurringFrequency: 'none',
      });

      // Calculate next date
      if (parent.recurringFrequency === 'daily') {
        nextDate.setDate(nextDate.getDate() + 1);
      } else if (parent.recurringFrequency === 'weekly') {
        nextDate.setDate(nextDate.getDate() + 7);
      } else if (parent.recurringFrequency === 'monthly') {
        nextDate.setMonth(nextDate.getMonth() + 1);
      } else if (parent.recurringFrequency === 'yearly') {
        nextDate.setFullYear(nextDate.getFullYear() + 1);
      }
      
      generationCount++;
      generatedAny = true;
    }

    // Update parent's nextRecurringDate or mark inactive if past end date
    if (generatedAny) {
      if (endDate && nextDate > endDate) {
        await saveTransaction({
          ...parent,
          nextRecurringDate: nextDate.toISOString(),
          isRecurringActive: false
        }, parent.id);
      } else {
        await saveTransaction({
          ...parent,
          nextRecurringDate: nextDate.toISOString()
        }, parent.id);
      }
    } else if (endDate && nextDate > endDate) {
       // Cleanup case: next date was ALREADY past the end date somehow
       await saveTransaction({
        ...parent,
        isRecurringActive: false
      }, parent.id);
    }
  }
};
