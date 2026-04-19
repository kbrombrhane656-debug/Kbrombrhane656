import { useState, useEffect } from 'react';
import { useAppStore } from '../../data/store';
import { generateInsights } from '../../services/ai/insight_engine';
import { isToday, isThisWeek, parseISO } from 'date-fns';
import { logout } from '../../firebase';
import { LogOut, Settings, X, User, Moon, Sun, Globe, ChevronRight, Users, CreditCard, RefreshCw, Package } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useTranslation } from '../../i18n';
import { differenceInDays, isAfter } from 'date-fns';

export const DashboardScreen = () => {
  const { user, transactions, categories, loans, products, stockMovements, language, setLanguage, cards } = useAppStore();
  const { insights, healthScore } = generateInsights(transactions, loans, products, stockMovements);
  const t = useTranslation(language);

  // Reminders / Alerts logic
  const upcomingAlerts = loans
    .filter(l => l.status === 'active' && l.nextPaymentDate && l.type === 'received')
    .map(l => {
      const days = differenceInDays(new Date(l.nextPaymentDate!), new Date());
      return { ...l, daysRemaining: days };
    })
    .filter(l => l.daysRemaining <= 7) // Alert if due within 7 days
    .sort((a, b) => a.daysRemaining - b.daysRemaining);

  const upcomingRecurring = transactions
    .filter(t => t.recurringFrequency && t.recurringFrequency !== 'none' && t.type === 'expense' && t.isRecurringActive !== false && t.nextRecurringDate)
    .map(t => {
      const days = differenceInDays(new Date(t.nextRecurringDate!), new Date());
      return { ...t, daysRemaining: days };
    })
    .filter(t => t.daysRemaining >= 0 && t.daysRemaining <= 7)
    .sort((a, b) => a.daysRemaining - b.daysRemaining);

  const lowStockAlerts = products.filter(p => p.stock <= (p.lowStockThreshold || 5));

  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);

  useEffect(() => {
    setIsDarkMode(document.documentElement.classList.contains('dark'));
  }, []);

  const toggleDarkMode = () => {
    const next = !isDarkMode;
    setIsDarkMode(next);
    if (next) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  // Financial Pressure Engine
  const activeLoans = loans.filter(l => l.status === 'active' && l.type === 'received');
  const loanMonthlyObligations = activeLoans.reduce((sum, l) => sum + (l.monthlyPayment || 0), 0);

  const recurringParents = transactions.filter(t => t.recurringFrequency && t.recurringFrequency !== 'none' && t.type === 'expense');
  const recurringMonthlyObligations = recurringParents.reduce((sum, t) => {
    if (t.recurringFrequency === 'daily') return sum + (t.amount * 30);
    if (t.recurringFrequency === 'weekly') return sum + (t.amount * 4.33);
    if (t.recurringFrequency === 'monthly') return sum + t.amount;
    if (t.recurringFrequency === 'yearly') return sum + (t.amount / 12);
    return sum;
  }, 0);

  const totalMonthlyObligations = loanMonthlyObligations + recurringMonthlyObligations;

  const transactionBalance = transactions.reduce((sum, t) => ['income', 'loan_received', 'payment_received'].includes(t.type) ? sum + t.amount : sum - t.amount, 0);
  const virtualCardBalance = cards.filter(c => c.isVirtual).reduce((sum, c) => sum + c.balance, 0);
  const realCardBalance = cards.filter(c => !c.isVirtual).reduce((sum, c) => sum + c.balance, 0);
  const totalBalance = transactionBalance + virtualCardBalance + realCardBalance;
  
  const safeMoney = Math.max(0, totalBalance - totalMonthlyObligations);
  
  const todayTransactions = transactions.filter(t => isToday(parseISO(t.date)));
  const todayIncome = todayTransactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
  const todayExpense = todayTransactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
  const todayProfit = todayIncome - todayExpense;

  const weekTransactions = transactions.filter(t => isThisWeek(parseISO(t.date)));
  const weekIncome = weekTransactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
  const weekExpense = weekTransactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
  const weekProfit = weekIncome - weekExpense;

  const getCategoryIcon = (categoryName: string) => {
    const cat = categories.find(c => c.name === categoryName);
    return cat?.icon || '';
  };

  const getHealthColor = () => {
    if (healthScore >= 80) return 'text-[#12B76A]';
    if (healthScore >= 50) return 'text-[#F79009]';
    return 'text-[#F04438]';
  };

  return (
    <div className="pb-24 h-full overflow-y-auto w-full relative">
      <header className="px-5 py-4 flex justify-between items-center relative z-10">
        <div>
          <p className="text-[12px] text-secondary">{t('greeting')}</p>
          <h2 className="text-[18px] font-bold text-primary">{user?.displayName || t('businessOwner')}</h2>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setShowProfileMenu(true)} 
            className="relative hover:opacity-80 transition-opacity rounded-full border-2 border-transparent focus:border-accent outline-none"
          >
            {user?.photoURL ? (
              <img src={user.photoURL} alt="Profile" className="w-10 h-10 rounded-full bg-border object-cover" referrerPolicy="no-referrer" />
            ) : (
              <div className="w-10 h-10 rounded-full bg-accent/10 border border-accent/20 flex items-center justify-center text-accent font-bold">
                {user?.displayName ? user.displayName.charAt(0).toUpperCase() : <User size={20} />}
              </div>
            )}
          </button>
        </div>
      </header>

      <section className="mx-5 my-3 bg-primary text-white rounded-[20px] p-6 relative overflow-hidden">
        <div className="absolute -right-10 -bottom-10 w-32 h-32 bg-white/5 rounded-full pointer-events-none"></div>
        <div className="flex justify-between items-start">
          <div>
            <div className="text-[12px] opacity-70 tracking-[0.5px] uppercase mb-1">{t('totalBalance')}</div>
            <div className="text-[32px] font-bold my-1">{totalBalance.toLocaleString()} ETB</div>
            {realCardBalance > 0 && (
              <div className="text-[10px] opacity-60 flex items-center gap-1">
                🏦 {realCardBalance.toLocaleString()} ETB in bank accounts
              </div>
            )}
            {virtualCardBalance > 0 && (
              <div className="text-[10px] opacity-60 flex items-center gap-1">
                💳 {virtualCardBalance.toLocaleString()} ETB in visual wallets
              </div>
            )}
            <div className="text-[12px] text-[#A6F4C5] font-medium flex items-center gap-1 mt-2">
              🛡️ {t('safeMoney')}: {safeMoney.toLocaleString()} ETB
            </div>
          </div>
          <div className="flex flex-col items-center justify-center bg-white/10 rounded-xl p-3 border border-white/10">
            <div className={`text-[20px] font-black ${getHealthColor()}`}>{healthScore}</div>
            <div className="text-[9px] uppercase tracking-wider opacity-80 mt-1">{t('health')}</div>
          </div>
        </div>
        
        {totalMonthlyObligations > 0 && (
          <div className="mt-5 pt-3 border-t border-white/20 flex justify-between items-center text-sm">
            <span className="opacity-80">{t('monthlyObligations')}:</span>
            <span className="font-semibold text-[#FECDCA]">{totalMonthlyObligations.toLocaleString()} ETB</span>
          </div>
        )}
      </section>

      {(upcomingAlerts.length > 0 || lowStockAlerts.length > 0 || upcomingRecurring.length > 0) && (
        <section className="mx-5 my-4">
          <div className="bg-[#FEF3F2] border-2 border-[#FECDCA] rounded-2xl p-4 shadow-sm">
             <h3 className="text-[#B42318] font-bold text-sm flex items-center gap-2 mb-3">
               🔔 Action Required Alerts
             </h3>
             <div className="space-y-3">
               {upcomingAlerts.map(l => (
                 <div key={`loan-${l.id}`} className="bg-white/60 p-3 rounded-xl flex items-center justify-between border border-[#FECDCA]/50">
                    <div className="flex flex-col">
                      <span className="text-[12px] font-bold text-[#B42318]">
                        {l.bankName || t('borrowedFrom')} • {l.monthlyPayment?.toLocaleString() || l.amount.toLocaleString()} ETB
                      </span>
                      <span className="text-[10px] text-[#B42318]/70">
                        {l.daysRemaining < 0 
                          ? `${t('overdue')} (${Math.abs(l.daysRemaining)} ${t('days')})` 
                          : l.daysRemaining === 0 
                            ? t('dueToday') 
                            : `${t('dueSoon')} (${l.daysRemaining} ${t('days')})`
                        }
                      </span>
                    </div>
                    <Link to="/people" className="bg-[#B42318] text-white text-[10px] font-bold px-3 py-1.5 rounded-lg active:scale-95 transition-transform">
                      {t('payNow')}
                    </Link>
                 </div>
               ))}
               {upcomingRecurring.map(tData => (
                 <div key={`rec-${tData.id}`} className="bg-white/60 p-3 rounded-xl flex items-center justify-between border border-[#FECDCA]/50">
                    <div className="flex flex-col">
                      <span className="text-[12px] font-bold text-[#B42318]">
                        🔄 {tData.note || tData.category} • {tData.amount.toLocaleString()} ETB
                      </span>
                      <span className="text-[10px] text-[#B42318]/70">
                        {tData.daysRemaining === 0 
                          ? 'Due Today' 
                          : `Due in ${tData.daysRemaining} days (${new Date(tData.nextRecurringDate!).toLocaleDateString()})`
                        }
                      </span>
                    </div>
                    <Link to="/recurring" className="bg-[#B42318] text-white text-[10px] font-bold px-3 py-1.5 rounded-lg active:scale-95 transition-transform">
                      Manage
                    </Link>
                 </div>
               ))}
               {lowStockAlerts.map(p => (
                 <div key={`stock-${p.id}`} className="bg-white/60 p-3 rounded-xl flex items-center justify-between border border-[#FECDCA]/50">
                    <div className="flex flex-col">
                      <span className="text-[12px] font-bold text-[#B42318]">
                        📦 Low Stock: {p.name}
                      </span>
                      <span className="text-[10px] text-[#B42318]/70">
                        Only {p.stock} units remaining
                      </span>
                    </div>
                    <Link to="/inventory" className="bg-[#B42318] text-white text-[10px] font-bold px-3 py-1.5 rounded-lg active:scale-95 transition-transform">
                      Restock
                    </Link>
                 </div>
               ))}
             </div>
          </div>
        </section>
      )}

      <section className="flex gap-3 mx-5 my-5">
        <div className="bg-card border border-border p-3 rounded-[16px] flex-1">
          <p className="text-[11px] text-secondary mb-1">{t('todayProfit')}</p>
          <h4 className={`text-[14px] font-semibold ${todayProfit >= 0 ? 'text-profit' : 'text-expense'}`}>
            {todayProfit >= 0 ? '+' : ''}{todayProfit.toLocaleString()} ETB
          </h4>
        </div>
        <div className="bg-card border border-border p-3 rounded-[16px] flex-1">
          <p className="text-[11px] text-secondary mb-1">{t('weeklyProfit')}</p>
          <h4 className={`text-[14px] font-semibold ${weekProfit >= 0 ? 'text-profit' : 'text-expense'}`}>
            {weekProfit >= 0 ? '+' : ''}{weekProfit.toLocaleString()} ETB
          </h4>
        </div>
      </section>

      {insights.length > 0 && (
        <section className="mx-5 my-3">
          <div className="space-y-3">
            {insights.map(insight => (
              <div 
                key={insight.id} 
                className={`p-4 rounded-[16px] border flex gap-3 ${
                  insight.type === 'warning' ? 'bg-[#FEF3F2] border-[#FECDCA]' :
                  insight.type === 'success' ? 'bg-[#ECFDF3] border-[#ABEFC6]' :
                  'bg-[#EFF8FF] border-[#B2DDFF]'
                }`}
              >
                <div className="text-[20px]">
                  {insight.type === 'warning' ? '⚠️' : insight.type === 'success' ? '✅' : '💡'}
                </div>
                <div>
                  <h5 className={`text-[13px] mb-[2px] font-semibold ${
                    insight.type === 'warning' ? 'text-[#B42318]' :
                    insight.type === 'success' ? 'text-[#067647]' :
                    'text-[#175CD3]'
                  }`}>{t('gabeyaCoach')}</h5>
                  <p className={`text-[12px] leading-[1.4] ${
                    insight.type === 'warning' ? 'text-[#B42318]' :
                    insight.type === 'success' ? 'text-[#087443]' :
                    'text-[#175CD3]'
                  }`}>{insight.message}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section>
        <div className="mx-5 mt-5 mb-3 text-[14px] font-semibold flex justify-between items-center text-primary">
          <span>{t('recentActivity')}</span>
        </div>
        <div className="px-5 space-y-2">
          {transactions.slice().sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 5).map((t) => (
            <div key={t.id} className="bg-card p-3 rounded-[12px] flex items-center justify-between border border-border">
              <div className="flex items-start gap-3">
                <div className="text-[20px] bg-bg w-10 h-10 flex items-center justify-center rounded-xl">{getCategoryIcon(t.category)}</div>
                <div>
                  <h6 className="text-[13px] font-medium mb-[2px] text-primary">{t.category}</h6>
                  <span className="text-[11px] text-secondary flex items-center gap-1 mb-1">{new Date(t.date).toLocaleDateString()} {t.note && `• ${t.note}`}</span>
                  <div className="flex gap-2">
                    {t.cardId && cards.find(c => c.id === t.cardId) && (
                      <span className="inline-flex items-center gap-1 bg-primary/5 text-primary text-[9px] font-bold px-1.5 py-0.5 rounded uppercase">
                        <CreditCard size={10} /> {cards.find(c => c.id === t.cardId)?.name}
                      </span>
                    )}
                    {t.productId && products.find(p => p.id === t.productId) && (
                      <span className="inline-flex items-center gap-1 bg-accent/5 text-accent text-[9px] font-bold px-1.5 py-0.5 rounded uppercase">
                        <Package size={10} /> {products.find(p => p.id === t.productId)?.name}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className={`font-semibold text-[13px] ${t.type === 'income' ? 'text-profit' : 'text-expense'}`}>
                {t.type === 'income' ? '+' : '-'}{t.amount.toLocaleString()}
              </div>
            </div>
          ))}
          {transactions.length === 0 && (
            <div className="p-8 text-center text-secondary text-sm bg-card rounded-[12px] border border-border">
              {t('noTransactions')}
            </div>
          )}
        </div>
      </section>

      {/* Profile Settings Slide-out / Modal */}
      {showProfileMenu && (
        <div className="absolute inset-0 bg-black/60 flex items-end sm:items-center justify-center z-50 p-0 sm:p-5">
          <div className="bg-bg w-full sm:max-w-sm rounded-[24px] rounded-b-none sm:rounded-b-[24px] p-6 shadow-xl animate-in slide-in-from-bottom-5 sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-bold text-primary">{t('settingsProfile')}</h3>
              <button 
                onClick={() => setShowProfileMenu(false)} 
                className="text-secondary hover:text-primary bg-card p-1.5 rounded-full border border-border transition-colors"
               >
                <X size={20}/>
               </button>
            </div>

            <div className="flex items-center gap-4 mb-6 pb-6 border-b border-border">
              {user?.photoURL ? (
                <img src={user.photoURL} alt="Profile" className="w-12 h-12 rounded-full border border-border object-cover" referrerPolicy="no-referrer" />
              ) : (
                <div className="w-12 h-12 rounded-full bg-accent/10 border border-accent/20 flex items-center justify-center text-accent">
                  <User size={24} />
                </div>
              )}
              <div>
                <h4 className="font-bold text-primary text-[16px]">{user?.displayName || t('businessOwner')}</h4>
                <p className="text-[12px] text-secondary">{user?.email}</p>
              </div>
            </div>

            <div className="space-y-3">
              {/* Dark Mode Toggle */}
              <button onClick={toggleDarkMode} className="w-full flex items-center justify-between p-4 bg-card rounded-xl border border-border active:scale-[0.98] transition-all">
                <div className="flex items-center gap-3 text-primary font-semibold text-[14px]">
                    {isDarkMode ? <Sun size={18} className="text-secondary" /> : <Moon size={18} className="text-secondary" />}
                    {t('darkMode')}
                </div>
                <div className={`w-10 h-6 rounded-full transition-colors flex items-center px-1 ${isDarkMode ? 'bg-primary' : 'bg-border'}`}>
                  <div className={`w-4 h-4 rounded-full bg-white transition-transform ${isDarkMode ? 'translate-x-4' : 'translate-x-0'}`} />
                </div>
              </button>

              {/* Language Selector */}
              <div className="w-full flex items-center justify-between p-4 bg-card rounded-xl border border-border relative">
                <div className="flex items-center gap-3 text-primary font-semibold text-[14px]">
                    <Globe size={18} className="text-secondary" />
                    {t('language')}
                </div>
                <div className="relative">
                  <select 
                    value={language} 
                    onChange={e => setLanguage(e.target.value)}
                    className="bg-transparent text-[13px] font-bold text-accent outline-none text-right appearance-none cursor-pointer pr-4"
                  >
                    <option value="English">🇬🇧 English</option>
                    <option value="Amharic">🇪🇹 Amharic</option>
                    <option value="Tigrigna">🇪🇹 Tigrigna</option>
                  </select>
                  <ChevronRight size={14} className="text-accent absolute right-0 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>

              {/* Settings Links */}
              <Link to="/categories" onClick={() => setShowProfileMenu(false)} className="w-full flex items-center justify-between p-4 bg-card rounded-xl border border-border active:scale-[0.98] transition-all">
                <div className="flex items-center gap-3 text-primary font-semibold text-[14px]">
                    <Settings size={18} className="text-secondary" />
                    {t('categoriesSettings')}
                </div>
                <ChevronRight size={16} className="text-secondary" />
              </Link>

               <button onClick={() => { setShowProfileMenu(false); }} className="w-full flex items-center justify-between p-4 bg-card rounded-xl border border-border active:scale-[0.98] transition-all">
                <div className="flex items-center gap-3 text-primary font-semibold text-[14px]">
                    <Users size={18} className="text-secondary" />
                    {t('customerSettings')}
                </div>
                <ChevronRight size={16} className="text-secondary" />
              </button>

              <Link to="/cards" onClick={() => setShowProfileMenu(false)} className="w-full flex items-center justify-between p-4 bg-card rounded-xl border border-border active:scale-[0.98] transition-all">
                <div className="flex items-center gap-3 text-primary font-semibold text-[14px]">
                    <CreditCard size={18} className="text-secondary" />
                    {t('bankCards')}
                </div>
                <ChevronRight size={16} className="text-secondary" />
              </Link>

              <Link to="/recurring" onClick={() => setShowProfileMenu(false)} className="w-full flex items-center justify-between p-4 bg-card rounded-xl border border-border active:scale-[0.98] transition-all">
                <div className="flex items-center gap-3 text-primary font-semibold text-[14px]">
                    <RefreshCw size={18} className="text-secondary" />
                    Recurring Transactions
                </div>
                <ChevronRight size={16} className="text-secondary" />
              </Link>

              {/* Log Out */}
              <button 
                onClick={logout} 
                className="w-full flex items-center justify-center gap-2 p-4 bg-[#FEF3F2] border border-[#FECDCA] rounded-xl mt-6 active:scale-[0.98] transition-all shadow-sm"
              >
                    <LogOut size={18} className="text-[#B42318]" />
                    <span className="text-[#B42318] font-bold text-[14px]">{t('logOutSecurely')}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
