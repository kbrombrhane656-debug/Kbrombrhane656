import { useState } from 'react';
import { useAppStore } from '../../data/store';
import { isToday, isThisWeek, isThisMonth, parseISO, subMonths, format, startOfMonth, endOfMonth, isWithinInterval, startOfDay, endOfDay } from 'date-fns';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { Link } from 'react-router-dom';
import { Target, Download, Calendar, FileText } from 'lucide-react';
import { useTranslation, translations } from '../../i18n';

export const ReportsScreen = () => {
  const { transactions, language } = useAppStore();
  const t = useTranslation(language);

  const [activeTab, setActiveTab] = useState<'overview' | 'custom'>('overview');
  const [startDate, setStartDate] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  const calculateTotals = (filterFn: (date: Date) => boolean) => {
    const filtered = transactions.filter(t => filterFn(parseISO(t.date)));
    const income = filtered.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
    const expense = filtered.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
    return { income, expense, profit: income - expense };
  };

  const handleExportCSV = () => {
    const headers = ['Date', 'Type', 'Amount', 'Category', 'Note', 'Card ID', 'Product ID'];
    const rows = transactions.map(tData => [
      new Date(tData.date).toLocaleDateString(),
      tData.type,
      tData.amount,
      tData.category,
      tData.note ? `"${tData.note.replace(/"/g, '""')}"` : '',
      tData.cardId || '',
      tData.productId || ''
    ]);
    
    const csvContent = [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `GabeyaTrack_Report_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const today = calculateTotals(isToday);
  const week = calculateTotals(isThisWeek);
  const month = calculateTotals(isThisMonth);

  const customFilterFn = (date: Date) => {
    try {
      if (!startDate || !endDate) return true;
      return isWithinInterval(date, { 
        start: startOfDay(parseISO(startDate)), 
        end: endOfDay(parseISO(endDate)) 
      });
    } catch {
      return false;
    }
  };

  const customTotals = calculateTotals(customFilterFn);
  const customTransactions = transactions
    .filter(t => customFilterFn(parseISO(t.date)))
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const getMonthlyData = () => {
    const data = [];
    const now = new Date();
    for (let i = 11; i >= 0; i--) {
      const d = subMonths(now, i);
      const start = startOfMonth(d);
      const end = endOfMonth(d);
      
      const monthExpenses = transactions
        .filter(t => t.type === 'expense' && isWithinInterval(parseISO(t.date), { start, end }))
        .reduce((sum, t) => sum + t.amount, 0);
        
      data.push({
        name: format(d, 'MMM'),
        expense: monthExpenses
      });
    }
    return data;
  };

  const chartData = getMonthlyData();

  const recurringExpenses = transactions.filter(t => t.recurringFrequency && t.recurringFrequency !== 'none' && t.type === 'expense' && t.isRecurringActive !== false);
  const recurringCategories: Record<string, number> = {};
  recurringExpenses.forEach(t => {
     let monthlyAmount = 0;
     if (t.recurringFrequency === 'daily') monthlyAmount = t.amount * 30;
     else if (t.recurringFrequency === 'weekly') monthlyAmount = t.amount * 4.33;
     else if (t.recurringFrequency === 'monthly') monthlyAmount = t.amount;
     else if (t.recurringFrequency === 'yearly') monthlyAmount = t.amount / 12;
     
     recurringCategories[t.category] = (recurringCategories[t.category] || 0) + monthlyAmount;
  });
  
  const recurringData = Object.entries(recurringCategories)
    .map(([name, amount]) => ({ name, amount: Math.round(amount) }))
    .sort((a, b) => b.amount - a.amount);
    
  const recurringTotal = recurringData.reduce((sum, item) => sum + item.amount, 0);

  const ReportCard = ({ title, data }: { title: string, data: { income: number, expense: number, profit: number } }) => (
    <div className="bg-card p-5 rounded-[16px] border border-border mb-4">
      <h3 className="text-[14px] font-bold text-primary mb-4">{title}</h3>
      <div className="space-y-3">
        <div className="flex justify-between items-center">
          <span className="text-secondary text-[13px]">{t('income')}</span>
          <span className="text-profit font-semibold text-[13px]">+{data.income.toLocaleString()}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-secondary text-[13px]">{t('expense')}</span>
          <span className="text-expense font-semibold text-[13px]">-{data.expense.toLocaleString()}</span>
        </div>
        <div className="pt-3 border-t border-border flex justify-between items-center">
          <span className="text-primary font-medium text-[13px]">{t('profit')}</span>
          <span className={`font-bold text-[14px] ${data.profit >= 0 ? 'text-profit' : 'text-expense'}`}>
            {data.profit >= 0 ? '+' : ''}{data.profit.toLocaleString()}
          </span>
        </div>
      </div>
    </div>
  );

  return (
    <div className="p-5 overflow-y-auto h-full pb-24">
      <div className="flex justify-between items-center mb-6 mt-2">
        <h2 className="text-[18px] font-bold text-primary">{t('reports')}</h2>
        <div className="flex gap-2">
          <button onClick={handleExportCSV} className="flex items-center gap-2 bg-card text-secondary border border-border px-3 py-1.5 rounded-full text-[12px] font-semibold hover:bg-border/50 transition-colors">
            <Download size={14} />
            Export CSV
          </button>
          <Link to="/budgets" className="flex items-center gap-2 bg-accent text-white px-3 py-1.5 rounded-full text-[12px] font-semibold hover:opacity-90 transition-opacity">
            <Target size={14} />
            {t('budgets')}
          </Link>
        </div>
      </div>
      
      <div className="flex bg-border/50 p-1 rounded-[16px] mb-6">
        <button
          onClick={() => setActiveTab('overview')}
          className={`flex-1 py-2 text-[13px] font-semibold rounded-[12px] transition-colors ${activeTab === 'overview' ? 'bg-card text-primary shadow-sm' : 'text-secondary'}`}
        >
          Overview
        </button>
        <button
          onClick={() => setActiveTab('custom')}
          className={`flex-1 py-2 text-[13px] font-semibold rounded-[12px] transition-colors ${activeTab === 'custom' ? 'bg-card text-primary shadow-sm' : 'text-secondary'}`}
        >
          Custom Range
        </button>
      </div>

      {activeTab === 'overview' ? (
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
          <ReportCard title={t('thisMonth')} data={month} />
          
          <div className="bg-card p-5 rounded-[16px] border border-border mb-4">
            <h3 className="text-[14px] font-bold text-primary mb-4">{t('yearlyExpenses')}</h3>
            <div className="h-48 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#EAECF0" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#667085' }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#667085' }} tickFormatter={(value) => `${value >= 1000 ? (value/1000).toFixed(0) + 'k' : value}`} />
                  <Tooltip 
                    cursor={{ fill: '#F8F9FB' }}
                    contentStyle={{ borderRadius: '8px', border: '1px solid #EAECF0', fontSize: '12px', fontWeight: 'bold', color: '#101828' }}
                    itemStyle={{ color: '#F04438' }}
                    formatter={(value: number) => [`${value.toLocaleString()} ETB`, t('expense')]}
                  />
                  <Bar dataKey="expense" fill="#F04438" radius={[4, 4, 0, 0]} maxBarSize={40} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {recurringData.length > 0 && (
            <div className="bg-card p-5 rounded-[16px] border border-border mb-4">
              <h3 className="text-[14px] font-bold text-primary mb-1">Fixed Costs Breakdown</h3>
              <p className="text-[12px] text-secondary mb-4">Estimated Monthly Recurring Expenses</p>
              <div className="space-y-3">
                {recurringData.map((item, idx) => (
                  <div key={idx} className="flex flex-col gap-1">
                    <div className="flex justify-between items-center">
                      <span className="text-[13px] font-semibold text-primary">{item.name}</span>
                      <span className="text-[13px] font-bold text-expense">{item.amount.toLocaleString()} ETB/mo</span>
                    </div>
                    <div className="h-2 w-full bg-bg rounded-full overflow-hidden">
                      <div className="h-full bg-[#F04438]" style={{ width: `${Math.max(1, (item.amount / recurringTotal) * 100)}%` }}></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <ReportCard title={t('thisWeek')} data={week} />
          <ReportCard title={t('today')} data={today} />
        </div>
      ) : (
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="flex gap-3 mb-4">
            <div className="flex-1 flex flex-col gap-1">
              <label className="text-[11px] font-semibold text-secondary uppercase tracking-wider">Start Date</label>
              <input 
                type="date" 
                value={startDate} 
                onChange={e => setStartDate(e.target.value)} 
                className="w-full bg-card border border-border p-2 rounded-xl text-[13px] text-primary focus:outline-none focus:ring-1 focus:ring-accent" 
              />
            </div>
            <div className="flex-1 flex flex-col gap-1">
              <label className="text-[11px] font-semibold text-secondary uppercase tracking-wider">End Date</label>
              <input 
                type="date" 
                value={endDate} 
                onChange={e => setEndDate(e.target.value)} 
                className="w-full bg-card border border-border p-2 rounded-xl text-[13px] text-primary focus:outline-none focus:ring-1 focus:ring-accent" 
              />
            </div>
          </div>
          
          <ReportCard title="Custom Range Summary" data={customTotals} />

          <div className="mt-6">
            <h3 className="text-[14px] font-bold text-primary mb-3">Filtered Content History</h3>
            <div className="space-y-2">
              {customTransactions.map(tData => (
                <div key={tData.id} className="bg-card p-3 rounded-[12px] border border-border flex justify-between items-center">
                  <div>
                    <div className="text-[13px] font-medium text-primary mb-[2px]">{tData.category}</div>
                    <div className="text-[11px] text-secondary">
                      {format(parseISO(tData.date), 'MMM d, yyyy')} {tData.note && `• ${tData.note}`}
                    </div>
                  </div>
                  <div className={`font-semibold text-[14px] ${tData.type === 'income' ? 'text-profit' : 'text-expense'}`}>
                    {tData.type === 'income' ? '+' : '-'}{tData.amount.toLocaleString()}
                  </div>
                </div>
              ))}
              {customTransactions.length === 0 && (
                <div className="text-center text-secondary py-10 text-[13px] bg-card rounded-[12px] border border-border">
                  No transactions found for this period.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
