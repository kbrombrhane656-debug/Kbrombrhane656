import { useState, useMemo } from 'react';
import { useAppStore } from '../../data/store';
import { ChevronLeft, Filter, ArrowUpRight, ArrowDownRight, RefreshCw } from 'lucide-react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { useTranslation, translations } from '../../i18n';

export const StockHistoryScreen = () => {
  const { stockMovements, products, language } = useAppStore();
  const t = useTranslation(language);
  const [filterType, setFilterType] = useState<'ALL' | 'IN' | 'OUT' | 'ADJUST'>('ALL');
  const [sortBy, setSortBy] = useState<'date_desc' | 'date_asc'>('date_desc');
  const [search, setSearch] = useState('');

  const enrichedMovements = useMemo(() => {
    return stockMovements.map(m => ({
      ...m,
      productName: products.find(p => p.id === m.productId)?.name || 'Unknown Product'
    }));
  }, [stockMovements, products]);

  const filteredMovements = useMemo(() => {
    let result = enrichedMovements;
    
    if (filterType !== 'ALL') {
      result = result.filter(m => m.type === filterType);
    }
    
    if (search) {
       result = result.filter(m => m.productName.toLowerCase().includes(search.toLowerCase()) || (m.reason && m.reason.toLowerCase().includes(search.toLowerCase())));
    }

    result.sort((a, b) => {
      if (sortBy === 'date_desc') return new Date(b.date).getTime() - new Date(a.date).getTime();
      return new Date(a.date).getTime() - new Date(b.date).getTime();
    });

    return result;
  }, [enrichedMovements, filterType, sortBy, search]);

  return (
    <div className="flex flex-col h-full bg-bg">
      <header className="px-5 py-4 flex items-center gap-3 bg-card border-b border-border z-10 sticky top-0">
        <Link to="/inventory" className="text-secondary p-1">
          <ChevronLeft size={24} />
        </Link>
        <h2 className="text-[18px] font-bold text-primary">{t('stockHistory')}</h2>
      </header>

      <div className="p-5 flex-1 overflow-y-auto">
        <div className="mb-4 space-y-3">
          <input 
            type="text" 
            placeholder={t('searchProductsReasons')} 
            className="w-full bg-card p-3 rounded-lg border border-border text-sm" 
            value={search} 
            onChange={e => setSearch(e.target.value)} 
          />
          <div className="flex gap-2">
            <select 
              className="flex-1 bg-card p-2 rounded-lg border border-border text-xs text-secondary font-bold"
              value={filterType} 
              onChange={e => setFilterType(e.target.value as any)}
            >
              <option value="ALL">{t('allTypes')}</option>
              <option value="IN">{t('inAdded')}</option>
              <option value="OUT">{t('outRemoved')}</option>
              <option value="ADJUST">{t('adjustCorrected')}</option>
            </select>
            <select 
              className="flex-1 bg-card p-2 rounded-lg border border-border text-xs text-secondary font-bold"
              value={sortBy} 
              onChange={e => setSortBy(e.target.value as any)}
            >
              <option value="date_desc">{t('newestFirst')}</option>
              <option value="date_asc">{t('oldestFirst')}</option>
            </select>
          </div>
        </div>

        <div className="space-y-3">
          {filteredMovements.map(m => (
            <div key={m.id} className="bg-card p-4 rounded-xl border border-border flex flex-col gap-2">
               <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-bold text-primary text-sm">{m.productName}</h4>
                    <span className="text-[10px] text-secondary">{format(new Date(m.date), 'MMM d, yyyy h:mm a')}</span>
                  </div>
                  <div className={`flex items-center gap-1 font-bold text-sm ${m.type === 'IN' ? 'text-profit' : m.type === 'OUT' ? 'text-expense' : 'text-[#F79009]'}`}>
                    {m.type === 'IN' && <ArrowUpRight size={16}/>}
                    {m.type === 'OUT' && <ArrowDownRight size={16}/>}
                    {m.type === 'ADJUST' && <RefreshCw size={14} className="mr-1"/>}
                    {m.type === 'IN' ? '+' : '-'}{m.quantity}
                  </div>
               </div>
               
               <div className="flex justify-between items-center text-[10px] uppercase tracking-wider font-bold">
                  <span className={`px-2 py-0.5 rounded-full ${m.type === 'IN' ? 'bg-[#ECFDF3] text-[#067647]' : m.type === 'OUT' ? 'bg-[#FEF3F2] text-[#B42318]' : 'bg-[#FFFAEB] text-[#B54708]'}`}>
                    {m.type}
                  </span>
                  {m.reason && <span className="text-secondary truncate max-w-[200px]">{m.reason}</span>}
               </div>
            </div>
          ))}
          {filteredMovements.length === 0 && (
            <div className="text-center py-10 text-secondary bg-card rounded-xl border border-border">
              <History className="mx-auto mb-2 opacity-50" size={32} />
              <p>{t('noMovementHistory')}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
