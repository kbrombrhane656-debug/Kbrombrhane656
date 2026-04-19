import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../../data/store';
import { saveUser, saveCategory, saveLoan, saveTransaction } from '../../services/dbService';
import { useTranslation, translations } from '../../i18n';

const BUSINESS_TYPES = ['Shop', 'Pharmacy', 'Barber', 'Restaurant', 'Wholesale', 'Other'];

export const OnboardingScreen = () => {
  const { user, language } = useAppStore();
  const t = useTranslation(language);
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [businessType, setBusinessType] = useState(BUSINESS_TYPES[0]);
  
  // Loan state
  const [hasLoan, setHasLoan] = useState(false);
  const [loanAmount, setLoanAmount] = useState('');
  const [loanMonthly, setLoanMonthly] = useState('');
  const [loanDuration, setLoanDuration] = useState('');

  // Recurring Expenses state
  const [expenses, setExpenses] = useState<{name: string, amount: string, freq: 'daily'|'weekly'|'monthly'}[]>([]);

  const addExpense = () => setExpenses([...expenses, { name: '', amount: '', freq: 'monthly' }]);
  
  const updateExpense = (index: number, field: string, value: string) => {
    const next = [...expenses];
    next[index] = { ...next[index], [field]: value };
    setExpenses(next);
  };

  const handleComplete = async () => {
    if (!user) return;

    const updatedUser = {
      ...user,
      businessType,
      setupCompleted: true,
    };

    // 1. Save user profile
    await saveUser(updatedUser);
    useAppStore.getState().setUser(updatedUser);

    // 2. Assign default categories based on business type
    const defCats = [
      { name: 'Sales', type: 'income', icon: '💰', color: '#12B76A' },
      { name: 'Rent', type: 'expense', icon: '🏢', color: '#F04438' },
      { name: 'Utility', type: 'expense', icon: '⚡', color: '#F79009' }
    ];
    if (businessType === 'Shop' || businessType === 'Wholesale') {
      defCats.push({ name: 'Inventory Purchases', type: 'expense', icon: '📦', color: '#667085' });
    } else if (businessType === 'Restaurant') {
      defCats.push({ name: 'Ingredients', type: 'expense', icon: '🥦', color: '#2E90FA' });
    } else if (businessType === 'Pharmacy') {
      defCats.push({ name: 'Medicine Stock', type: 'expense', icon: '💊', color: '#875BF7' });
    }

    for (const cat of defCats) {
      await saveCategory({
        userId: user.uid,
        name: cat.name,
        type: cat.type as any,
        icon: cat.icon,
        color: cat.color,
        createdAt: new Date().toISOString()
      });
    }

    // 3. Save loan if exists
    if (hasLoan && loanAmount && loanMonthly) {
      await saveLoan({
        userId: user.uid,
        type: 'received',
        amount: Number(loanAmount),
        remainingAmount: Number(loanAmount),
        monthlyPayment: Number(loanMonthly),
        durationMonths: loanDuration ? Number(loanDuration) : undefined,
        startDate: new Date().toISOString(),
        status: 'active',
        createdAt: new Date().toISOString()
      });
    }

    // 4. Save recurring expenses
    for (const exp of expenses) {
      if (exp.name && exp.amount) {
        await saveTransaction({
          userId: user.uid,
          amount: Number(exp.amount),
          type: 'expense',
          category: 'Other',
          note: exp.name,
          date: new Date().toISOString(),
          createdAt: new Date().toISOString(),
          recurringFrequency: exp.freq,
          nextRecurringDate: new Date().toISOString() // will be processed immediately basically
        });
      }
    }

    navigate('/');
  };

  return (
    <div className="flex flex-col h-screen bg-bg p-6 max-w-lg mx-auto">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-[20px] font-bold text-primary">{t('setupGabeyaTrack')}</h1>
        <span className="text-secondary text-[14px]">{t('stepOf3').replace('{step}', step.toString())}</span>
      </div>

      {step === 1 && (
        <div className="flex-1">
          <h2 className="text-[18px] font-semibold mb-2 text-primary">{t('whatIsYourBusinessType')}</h2>
          <p className="text-secondary text-[14px] mb-6">{t('weWillCustomize')}</p>
          <div className="grid grid-cols-2 gap-3 mb-8">
            {BUSINESS_TYPES.map(type => {
              const typeKey = type.toLowerCase() as keyof typeof translations.English;
              return (
                <button
                  key={type}
                  onClick={() => setBusinessType(type)}
                  className={`py-4 rounded-[12px] font-semibold transition-all border ${businessType === type ? 'bg-primary text-white border-primary' : 'bg-card text-secondary border-border'}`}
                >
                  {t(typeKey)}
                </button>
              );
            })}
          </div>
          <button 
            onClick={() => setStep(2)}
            className="w-full bg-accent text-white py-4 rounded-[16px] font-semibold text-[16px]"
          >
            {t('next')}
          </button>
        </div>
      )}

      {step === 2 && (
        <div className="flex-1">
          <h2 className="text-[18px] font-semibold mb-2 text-primary">{t('anyExistingLoans')}</h2>
          <p className="text-secondary text-[14px] mb-6">{t('letsTrackObligations')}</p>
          
          <div className="mb-6 flex gap-4">
            <button onClick={() => setHasLoan(false)} className={`flex-1 py-3 rounded-lg font-medium ${!hasLoan ? 'bg-primary text-white' : 'bg-border text-secondary'}`}>{t('noLoansTab')}</button>
            <button onClick={() => setHasLoan(true)} className={`flex-1 py-3 rounded-lg font-medium ${hasLoan ? 'bg-primary text-white' : 'bg-border text-secondary'}`}>{t('haveALoan')}</button>
          </div>

          {hasLoan && (
            <div className="space-y-4">
              <div>
                <label className="text-[12px] font-bold text-secondary uppercase">{t('totalAmount')}</label>
                <input type="number" className="w-full bg-card p-3 rounded-lg border border-border mt-1" value={loanAmount} onChange={e => setLoanAmount(e.target.value)} placeholder="0.00" />
              </div>
              <div>
                <label className="text-[12px] font-bold text-secondary uppercase">{t('paymentAmount')}</label>
                <input type="number" className="w-full bg-card p-3 rounded-lg border border-border mt-1" value={loanMonthly} onChange={e => setLoanMonthly(e.target.value)} placeholder="0.00" />
              </div>
              <div>
                <label className="text-[12px] font-bold text-secondary uppercase">{t('durationMonthsOptional')}</label>
                <input type="number" className="w-full bg-card p-3 rounded-lg border border-border mt-1" value={loanDuration} onChange={e => setLoanDuration(e.target.value)} placeholder="e.g. 12" />
              </div>
            </div>
          )}

          <div className="flex gap-4 mt-8">
            <button onClick={() => setStep(1)} className="flex-1 bg-border text-primary py-4 rounded-[16px] font-semibold text-[16px]">{t('back')}</button>
            <button onClick={() => setStep(3)} className="flex-[2] bg-accent text-white py-4 rounded-[16px] font-semibold text-[16px]">{t('next')}</button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="flex-1">
          <h2 className="text-[18px] font-semibold mb-2 text-primary">{t('recurringExpenses')}</h2>
          <p className="text-secondary text-[14px] mb-6">{t('likeRentSalaries')}</p>

          <div className="space-y-4 mb-6 max-h-[50vh] overflow-y-auto">
            {expenses.map((exp, i) => (
              <div key={i} className="bg-card p-4 rounded-xl border border-border flex flex-col gap-3">
                <input type="text" placeholder={t('expenseName')} className="bg-bg p-2 rounded-lg" value={exp.name} onChange={e => updateExpense(i, 'name', e.target.value)} />
                <div className="flex gap-2">
                  <input type="number" placeholder={t('amount')} className="flex-1 bg-bg p-2 rounded-lg" value={exp.amount} onChange={e => updateExpense(i, 'amount', e.target.value)} />
                  <select className="flex-1 bg-bg p-2 rounded-lg" value={exp.freq} onChange={e => updateExpense(i, 'freq', e.target.value)}>
                    <option value="daily">{t('daily')}</option>
                    <option value="weekly">{t('weekly')}</option>
                    <option value="monthly">{t('monthly')}</option>
                  </select>
                </div>
              </div>
            ))}
            <button onClick={addExpense} className="text-accent text-[14px] font-bold py-2 w-full text-center">{t('addExpense')}</button>
          </div>

          <div className="flex gap-4 mt-auto">
            <button onClick={() => setStep(2)} className="flex-1 bg-border text-primary py-4 rounded-[16px] font-semibold text-[16px]">{t('back')}</button>
            <button onClick={handleComplete} className="flex-[2] bg-profit text-white py-4 rounded-[16px] font-semibold text-[16px]">{t('completeSetup')}</button>
          </div>
        </div>
      )}
    </div>
  );
};
