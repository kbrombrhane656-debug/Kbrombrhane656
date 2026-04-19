import { useState } from 'react';
import { useAppStore } from '../../data/store';
import { useTranslation } from '../../i18n';
import { RefreshCw, Play, Pause, Trash2, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { saveTransaction, removeTransaction } from '../../services/dbService';

export const RecurringScreen = () => {
  const { transactions, language } = useAppStore();
  const t = useTranslation(language);

  const [filter, setFilter] = useState<'all' | 'active' | 'paused'>('all');

  const recurringTransactions = transactions.filter(t => t.recurringFrequency && t.recurringFrequency !== 'none');
  
  const filteredTransactions = recurringTransactions.filter(t => {
    if (filter === 'active') return t.isRecurringActive;
    if (filter === 'paused') return !t.isRecurringActive;
    return true;
  });

  const toggleStatus = async (transaction: any) => {
    await saveTransaction({
      ...transaction,
      isRecurringActive: !transaction.isRecurringActive
    }, transaction.id);
  };

  return (
    <div className="p-5 flex flex-col h-full bg-bg pb-20 overflow-y-auto">
      <div className="flex items-center gap-4 mb-6 mt-2">
        <Link to="/" className="text-secondary p-2 bg-card rounded-full border border-border shadow-sm">
          <ArrowLeft size={20} />
        </Link>
        <h2 className="text-[18px] font-bold text-primary">Recurring Transactions</h2>
      </div>

      <div className="flex gap-2 mb-6 bg-card p-1.5 rounded-xl border border-border">
        {(['all', 'active', 'paused'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`flex-1 py-1.5 text-[12px] font-bold rounded-lg capitalize transition-colors ${filter === f ? 'bg-primary text-white shadow-sm' : 'text-secondary hover:text-primary'}`}
          >
            {f}
          </button>
        ))}
      </div>

      <div className="space-y-4">
        {filteredTransactions.map(tData => (
          <div key={tData.id} className="bg-card p-4 rounded-xl border border-border flex flex-col gap-3">
             <div className="flex justify-between items-start">
               <div>
                  <h3 className="font-bold text-[15px]">{tData.category}</h3>
                  <div className="text-[12px] text-secondary mt-1 flex items-center gap-2">
                     <RefreshCw size={12} className={tData.isRecurringActive ? 'text-accent' : 'text-secondary opacity-50'} />
                     <span className="capitalize">{tData.recurringFrequency}</span>
                     {tData.recurringEndDate && ` • Until ${new Date(tData.recurringEndDate).toLocaleDateString()}`}
                  </div>
               </div>
               <div className={`font-bold text-[16px] ${tData.type === 'income' ? 'text-profit' : 'text-expense'}`}>
                  {tData.type === 'income' ? '+' : '-'}{tData.amount.toLocaleString()}
               </div>
             </div>

             <div className="flex justify-between items-center pt-3 border-t border-border mt-1">
               <div className="text-[11px] font-semibold flex items-center gap-2">
                 <span className={`px-2 py-1 rounded-md ${tData.isRecurringActive ? 'bg-[#ECFDF3] text-[#067647]' : 'bg-border text-secondary'}`}>
                   {tData.isRecurringActive ? 'Active' : 'Paused'}
                 </span>
               </div>
               <div className="flex items-center gap-2">
                 <button 
                   onClick={() => toggleStatus(tData)}
                   className="p-2 bg-bg rounded-lg border border-border text-secondary hover:text-primary transition-colors flex items-center gap-2 text-[12px] font-bold"
                 >
                   {tData.isRecurringActive ? <><Pause size={14}/> Pause</> : <><Play size={14}/> Resume</>}
                 </button>
                 <button 
                   onClick={() => {
                     if (window.confirm('Stop recurring and remove original transaction?')) {
                        removeTransaction(tData.id);
                     }
                   }}
                   className="p-2 bg-bg rounded-lg border border-border text-expense/80 hover:text-expense transition-colors"
                 >
                   <Trash2 size={16} />
                 </button>
               </div>
             </div>
          </div>
        ))}
        {filteredTransactions.length === 0 && (
          <div className="text-center py-10 bg-card rounded-xl border border-border">
            <RefreshCw size={32} className="mx-auto text-secondary/50 mb-3" />
            <p className="text-secondary text-[14px]">No {filter !== 'all' ? filter : 'recurring'} transactions found.</p>
          </div>
        )}
      </div>
    </div>
  );
};
