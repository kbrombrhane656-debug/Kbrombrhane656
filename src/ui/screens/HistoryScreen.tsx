import { useState } from 'react';
import { useAppStore } from '../../data/store';
import { removeTransaction } from '../../services/dbService';
import { Trash2, CreditCard, Package } from 'lucide-react';
import { format, parseISO, isWithinInterval, startOfDay, endOfDay } from 'date-fns';
import { useTranslation, translations } from '../../i18n';

export const HistoryScreen = () => {
  const { transactions, categories, language, cards, products } = useAppStore();
  const t = useTranslation(language);
  const [filter, setFilter] = useState<'all' | 'income' | 'expense'>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const filteredTransactions = transactions
    .filter(t => filter === 'all' || t.type === filter)
    .filter(t => {
      if (!startDate && !endDate) return true;
      try {
        const d = parseISO(t.date);
        let valid = true;
        if (startDate) {
          valid = valid && d.getTime() >= startOfDay(parseISO(startDate)).getTime();
        }
        if (endDate) {
          valid = valid && d.getTime() <= endOfDay(parseISO(endDate)).getTime();
        }
        return valid;
      } catch {
        return true;
      }
    })
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const getCategoryIcon = (categoryName: string) => {
    const cat = categories.find(c => c.name === categoryName);
    return cat?.icon || '';
  };

  return (
    <div className="p-5 h-full overflow-y-auto pb-24">
      <h2 className="text-[18px] font-bold text-primary mb-6 mt-2 text-center">{t('history')}</h2>

      <div className="flex bg-border/50 p-1 rounded-[16px] mb-4">
        {['all', 'income', 'expense'].map(f => (
          <button
            key={f}
            onClick={() => setFilter(f as any)}
            className={`flex-1 py-2 text-[13px] font-semibold rounded-[12px] capitalize transition-colors ${filter === f ? 'bg-card text-primary shadow-sm' : 'text-secondary'}`}
          >
            {t(f as keyof typeof translations.English)}
          </button>
        ))}
      </div>

      <div className="flex gap-3 mb-6 bg-card p-3 rounded-[16px] border border-border">
        <div className="flex-1 flex flex-col gap-1">
          <label className="text-[10px] font-semibold text-secondary uppercase tracking-wider">Start Date</label>
          <input 
            type="date" 
            value={startDate} 
            onChange={e => setStartDate(e.target.value)} 
            className="w-full bg-bg border-none p-2 rounded-xl text-[12px] text-primary focus:outline-none focus:ring-1 focus:ring-accent" 
          />
        </div>
        <div className="flex-1 flex flex-col gap-1">
          <label className="text-[10px] font-semibold text-secondary uppercase tracking-wider">End Date</label>
          <input 
            type="date" 
            value={endDate} 
            onChange={e => setEndDate(e.target.value)} 
            className="w-full bg-bg border-none p-2 rounded-xl text-[12px] text-primary focus:outline-none focus:ring-1 focus:ring-accent" 
          />
        </div>
        {(startDate || endDate) && (
          <div className="flex flex-col justify-end">
            <button 
              onClick={() => { setStartDate(''); setEndDate(''); }}
              className="text-[11px] font-bold text-expense bg-expense/10 px-3 py-2 rounded-xl hover:bg-expense/20 transition-colors h-[34px] flex items-center justify-center mb-[1px]"
            >
              Clear
            </button>
          </div>
        )}
      </div>

      <div className="space-y-2">
        {filteredTransactions.map(tData => (
          <div key={tData.id} className="bg-card p-3 rounded-[12px] border border-border flex justify-between items-start">
            <div className="flex items-start gap-3">
              <div className="text-[20px] bg-bg w-10 h-10 flex items-center justify-center rounded-xl">{getCategoryIcon(tData.category)}</div>
              <div>
                <h6 className="text-[13px] font-medium mb-[2px] text-primary">{tData.category}</h6>
                <div className="text-[11px] text-secondary mb-1">
                  {new Date(tData.date).toLocaleDateString()} {tData.note && `• ${tData.note}`}
                </div>
                <div className="flex gap-2">
                  {tData.cardId && cards.find(c => c.id === tData.cardId) && (
                    <span className="inline-flex items-center gap-1 bg-primary/5 text-primary text-[9px] font-bold px-1.5 py-0.5 rounded uppercase">
                      <CreditCard size={10} /> {cards.find(c => c.id === tData.cardId)?.name}
                    </span>
                  )}
                  {tData.productId && products.find(p => p.id === tData.productId) && (
                    <span className="inline-flex items-center gap-1 bg-accent/5 text-accent text-[9px] font-bold px-1.5 py-0.5 rounded uppercase">
                      <Package size={10} /> {products.find(p => p.id === tData.productId)?.name}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex flex-col items-end gap-2">
              <div className={`font-semibold text-[14px] ${tData.type === 'income' ? 'text-profit' : 'text-expense'}`}>
                {tData.type === 'income' ? '+' : '-'}{tData.amount.toLocaleString()}
              </div>
              <button onClick={() => removeTransaction(tData.id)} className="text-secondary/50 hover:text-expense transition-colors p-1 bg-bg rounded-lg">
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))}
        {filteredTransactions.length === 0 && (
          <div className="text-center text-secondary py-10 text-[13px] bg-card rounded-[12px] border border-border">
            {t('noTransactions')}
          </div>
        )}
      </div>
    </div>
  );
};
