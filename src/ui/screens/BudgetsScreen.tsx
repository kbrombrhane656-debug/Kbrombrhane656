import { useState } from 'react';
import { useAppStore } from '../../data/store';
import { saveBudget, removeBudget } from '../../services/dbService';
import { format, startOfMonth, endOfMonth, isWithinInterval, parseISO } from 'date-fns';
import { Plus, Trash2, Edit2, X } from 'lucide-react';
import { useTranslation } from '../../i18n';

export const BudgetsScreen = () => {
  const { budgets, categories, transactions, user, language } = useAppStore();
  const t = useTranslation(language);
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  const [category, setCategory] = useState('');
  const [amount, setAmount] = useState('');

  const currentMonth = format(new Date(), 'yyyy-MM');
  const currentMonthBudgets = budgets.filter(b => b.month === currentMonth);

  const expenseCategories = categories.filter(c => c.type === 'expense' || c.type === 'both');
  const defaultExpenseCategories = ['Stock', 'Transport', 'Rent', 'Food', 'Other'];
  const displayCategories = expenseCategories.length > 0 
    ? Array.from(new Set(expenseCategories.map(c => c.name)))
    : defaultExpenseCategories;

  const resetForm = () => {
    setCategory(displayCategories[0] || '');
    setAmount('');
    setIsAdding(false);
    setEditingId(null);
  };

  const handleEdit = (budget: any) => {
    setCategory(budget.category);
    setAmount(budget.amount.toString());
    setEditingId(budget.id);
    setIsAdding(true);
  };

  const handleSave = async () => {
    if (!amount || isNaN(Number(amount)) || !user || !category) return;

    await saveBudget({
      userId: user.uid,
      category,
      amount: Number(amount),
      month: currentMonth,
      createdAt: new Date().toISOString(),
    }, editingId || undefined);

    resetForm();
  };

  const getSpentAmount = (catName: string) => {
    const start = startOfMonth(new Date());
    const end = endOfMonth(new Date());
    
    return transactions
      .filter(t => t.type === 'expense' && t.category === catName && isWithinInterval(parseISO(t.date), { start, end }))
      .reduce((sum, t) => sum + t.amount, 0);
  };

  return (
    <div className="p-5 flex flex-col h-full bg-bg pb-24 overflow-y-auto">
      <div className="flex justify-between items-center mb-6 mt-2">
        <h2 className="text-[18px] font-bold text-primary">{t('monthlyBudgets')}</h2>
        {!isAdding && (
          <button 
            onClick={() => {
              setCategory(displayCategories[0] || '');
              setIsAdding(true);
            }}
            className="bg-accent text-white p-2 rounded-full shadow-sm hover:opacity-90 transition-opacity"
          >
            <Plus size={20} />
          </button>
        )}
      </div>

      {isAdding ? (
        <div className="bg-card p-5 rounded-[16px] border border-border shadow-sm mb-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-[14px]">{editingId ? t('editBudget') : t('newBudget')}</h3>
            <button onClick={resetForm} className="text-secondary hover:text-primary"><X size={20} /></button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-[10px] font-bold text-secondary mb-2 uppercase">{t('category')}</label>
              <select 
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full bg-bg text-[14px] text-primary py-2 px-3 rounded-[8px] border border-border focus:outline-none focus:border-accent"
              >
                {displayCategories.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-secondary mb-2 uppercase">{t('limitAmountEtb')}</label>
              <input 
                type="number" 
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full bg-bg text-[14px] text-primary py-2 px-3 rounded-[8px] border border-border focus:outline-none focus:border-accent"
                placeholder="0.00"
              />
            </div>

            <button 
              onClick={handleSave}
              disabled={!amount || isNaN(Number(amount))}
              className="w-full bg-primary text-white font-semibold py-3 rounded-[12px] hover:opacity-90 transition-opacity mt-2 text-[13px]"
            >
              {t('saveBudget')}
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {currentMonthBudgets.length === 0 && (
            <div className="text-center text-secondary py-10 text-[13px] bg-card rounded-[12px] border border-border">
              {t('noBudgets')}
            </div>
          )}
          {currentMonthBudgets.map(budget => {
            const spent = getSpentAmount(budget.category);
            const percentage = Math.min(100, Math.round((spent / budget.amount) * 100));
            const isOver = spent > budget.amount;

            return (
              <div key={budget.id} className="bg-card p-4 rounded-[16px] border border-border">
                <div className="flex justify-between items-center mb-2">
                  <h6 className="text-[14px] font-semibold text-primary">{budget.category}</h6>
                  <div className="flex items-center gap-2">
                    <button onClick={() => handleEdit(budget)} className="text-secondary hover:text-primary p-1">
                      <Edit2 size={14} />
                    </button>
                    <button onClick={() => removeBudget(budget.id)} className="text-secondary hover:text-expense p-1">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
                
                <div className="flex justify-between items-end mb-2">
                  <div className="text-[12px] text-secondary">
                    <span className={`font-bold ${isOver ? 'text-expense' : 'text-primary'}`}>{spent.toLocaleString()} ETB</span> 
                    {' '}{t('of')} {budget.amount.toLocaleString()} ETB
                  </div>
                  <div className={`text-[11px] font-bold ${isOver ? 'text-expense' : 'text-secondary'}`}>
                    {percentage}%
                  </div>
                </div>

                <div className="w-full bg-bg rounded-full h-2 overflow-hidden">
                  <div 
                    className={`h-full rounded-full ${isOver ? 'bg-expense' : percentage > 80 ? 'bg-orange-500' : 'bg-profit'}`}
                    style={{ width: `${percentage}%` }}
                  ></div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
