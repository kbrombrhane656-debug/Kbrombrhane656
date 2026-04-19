import { useState, useMemo } from 'react';
import { useAppStore } from '../../data/store';
import { savePartner, saveLoan, saveTransaction, saveEmployee } from '../../services/dbService';
import { Plus, Users, ArrowUpRight, ArrowDownRight, UserCheck, KeySquare, Calendar, Filter, ChevronDown, ChevronUp, Info, ListTodo } from 'lucide-react';
import { format, addMonths } from 'date-fns';
import { useTranslation } from '../../i18n';
import { generateAmortizationSchedule, calculateLoanTotals } from '../../services/loanUtils';

export const PeopleScreen = () => {
  const { partners, loans, employees, user, activeEmployeeId, setActiveEmployeeId, language } = useAppStore();
  const t = useTranslation(language);
  const [activeTab, setActiveTab] = useState<'partners' | 'loans' | 'employees'>('loans');
  const [isAdding, setIsAdding] = useState(false);

  // Partner State
  const [partnerName, setPartnerName] = useState('');
  const [partnerType, setPartnerType] = useState<'customer'|'supplier'>('customer');
  const [partnerPhone, setPartnerPhone] = useState('');

  // Loan State
  const [loanType, setLoanType] = useState<'given'|'received'>('given');
  const [loanAmount, setLoanAmount] = useState('');
  const [loanPartnerId, setLoanPartnerId] = useState('');
  const [loanMonthly, setLoanMonthly] = useState('');
  const [isBankLoan, setIsBankLoan] = useState(false);
  const [loanInterest, setLoanInterest] = useState('');
  const [loanTaxRate, setLoanTaxRate] = useState('');
  const [loanPenalty, setLoanPenalty] = useState('');
  const [loanDueDate, setLoanDueDate] = useState('');
  const [loanBankName, setLoanBankName] = useState('');
  const [loanAccount, setLoanAccount] = useState('');
  const [loanPurpose, setLoanPurpose] = useState('');
  const [loanDuration, setLoanDuration] = useState('');

  // Loan Payment State
  const [recordingPaymentFor, setRecordingPaymentFor] = useState<string | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');

  // Employee State
  const [employeeName, setEmployeeName] = useState('');
  const [employeeRole, setEmployeeRole] = useState<'admin'|'staff'|'viewer'>('staff');
  const [employeePin, setEmployeePin] = useState('');
  const [employeeConfirmPin, setEmployeeConfirmPin] = useState('');

  // User switcher
  const [switcherPin, setSwitcherPin] = useState('');
  const [switchingToEmployee, setSwitchingToEmployee] = useState<string | null>(null);

  // Loan Filtering & View State
  const [filterType, setFilterType] = useState<'all' | 'given' | 'received'>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'paid_off'>('active');
  const [filterBank, setFilterBank] = useState(false);
  const [expandedLoanId, setExpandedLoanId] = useState<string | null>(null);
  const [showAmortization, setShowAmortization] = useState(false);

  const filteredLoans = useMemo(() => {
    return loans.filter(l => {
      const matchType = filterType === 'all' || l.type === filterType;
      const matchStatus = filterStatus === 'all' || l.status === filterStatus;
      const matchBank = !filterBank || l.isBankLoan;
      return matchType && matchStatus && matchBank;
    });
  }, [loans, filterType, filterStatus, filterBank]);

  const handleSavePartner = async () => {
    if (!partnerName || !user) return;
    await savePartner({
      userId: user.uid,
      name: partnerName,
      type: partnerType,
      phone: partnerPhone,
      createdAt: new Date().toISOString()
    });
    setIsAdding(false);
    setPartnerName(''); setPartnerPhone('');
  };

  const handleSaveLoan = async () => {
    if (!loanAmount || !user) return;
    
    let nextPaymentDate = undefined;
    if (loanMonthly) {
      nextPaymentDate = addMonths(new Date(), 1).toISOString();
    }

    const loan = await saveLoan({
      userId: user.uid,
      type: loanType,
      amount: Number(loanAmount),
      remainingAmount: Number(loanAmount),
      partnerId: loanPartnerId || undefined,
      startDate: new Date().toISOString(),
      monthlyPayment: Number(loanMonthly) || undefined,
      interest: Number(loanInterest) || undefined,
      durationMonths: Number(loanDuration) || undefined,
      nextPaymentDate,
      taxRate: Number(loanTaxRate) || undefined,
      penaltyFee: Number(loanPenalty) || undefined,
      dueDate: loanDueDate || undefined,
      bankName: loanBankName || undefined,
      accountNumber: loanAccount || undefined,
      loanPurpose: loanPurpose || undefined,
      isBankLoan,
      paymentHistory: [],
      status: 'active',
      createdAt: new Date().toISOString()
    });

    // Automatically log a transaction so it affects the balance
    await saveTransaction({
      userId: user.uid,
      amount: Number(loanAmount),
      type: loanType === 'given' ? 'loan_given' : 'loan_received',
      category: 'Loan Principal',
      note: `Loan ${loanType} ${loanPartnerId ? 'for partner' : ''} ${loanBankName ? `via ${loanBankName}` : ''}`,
      date: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      loanId: loan.id,
      partnerId: loanPartnerId || undefined,
    });

    setIsAdding(false);
    resetLoanForm();
  };

  const resetLoanForm = () => {
    setLoanAmount(''); setLoanPartnerId(''); setLoanMonthly('');
    setIsBankLoan(false); setLoanInterest(''); setLoanTaxRate('');
    setLoanPenalty(''); setLoanDueDate(''); setLoanBankName('');
    setLoanAccount(''); setLoanPurpose(''); setLoanDuration('');
  };

  const handleRecordPayment = async (loanId: string) => {
    const loan = loans.find(l => l.id === loanId);
    if (!loan || !paymentAmount || !user) return;

    const amount = Number(paymentAmount);
    const newRemaining = Math.max(0, loan.remainingAmount - amount);
    
    let nextPaymentDate = loan.nextPaymentDate;
    if (loan.monthlyPayment && newRemaining > 0) {
      if (nextPaymentDate) {
        nextPaymentDate = addMonths(new Date(nextPaymentDate), 1).toISOString();
      } else {
        nextPaymentDate = addMonths(new Date(), 1).toISOString();
      }
    } else if (newRemaining === 0) {
      nextPaymentDate = undefined;
    }

    const history = loan.paymentHistory || [];
    
    await saveLoan({
      ...loan,
      remainingAmount: newRemaining,
      status: newRemaining === 0 ? 'paid_off' : 'active',
      nextPaymentDate,
      paymentHistory: [...history, { date: new Date().toISOString(), amount }]
    }, loan.id);

    await saveTransaction({
      userId: user.uid,
      amount: amount,
      type: loan.type === 'given' ? 'payment_received' : 'payment_given',
      category: 'Loan Payment',
      note: `Payment for loan ${loan.id}`,
      date: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      loanId: loan.id,
      partnerId: loan.partnerId,
    });

    setRecordingPaymentFor(null);
    setPaymentAmount('');
  };

  const handleSaveEmployee = async () => {
    if (!employeeName || !user) return;
    if (employeePin && employeePin !== employeeConfirmPin) {
      alert("PINs do not match!");
      return;
    }
    await saveEmployee({
      userId: user.uid,
      name: employeeName,
      role: employeeRole,
      status: 'active',
      pin: employeePin || undefined,
      createdAt: new Date().toISOString()
    });
    setIsAdding(false);
    setEmployeeName('');
    setEmployeePin('');
    setEmployeeConfirmPin('');
  };

  const attemptSwitch = () => {
    if (!switchingToEmployee) {
      setActiveEmployeeId(null);
      setSwitcherPin('');
      return;
    }
    const emp = employees.find(e => e.id === switchingToEmployee);
    if (emp && (!emp.pin || emp.pin === switcherPin)) {
      setActiveEmployeeId(emp.id);
      setSwitchingToEmployee(null);
      setSwitcherPin('');
    } else {
      alert("Invalid PIN or employee not found");
      setSwitcherPin('');
    }
  };

  const totalGiven = loans.filter(l => l.type === 'given' && l.status === 'active').reduce((sum, l) => sum + l.remainingAmount, 0);
  const totalReceived = loans.filter(l => l.type === 'received' && l.status === 'active').reduce((sum, l) => sum + l.remainingAmount, 0);

  return (
    <div className="p-5 flex flex-col h-full bg-bg pb-20 overflow-y-auto">
      <div className="flex justify-between items-center mb-6 mt-2">
        <h2 className="text-[18px] font-bold text-primary">{t('peopleDebts')}</h2>
        <button 
          onClick={() => setIsAdding(!isAdding)}
          className="bg-accent text-white p-2 rounded-full shadow-sm"
        >
          <Plus size={20} />
        </button>
      </div>

      <div className="flex bg-border/50 p-1 rounded-[16px] mb-6">
        <button onClick={() => setActiveTab('partners')} className={`flex-1 py-1.5 text-[12px] font-semibold rounded-[12px] capitalize transition-colors ${activeTab === 'partners' ? 'bg-card text-primary shadow-sm' : 'text-secondary'}`}>{t('partners')}</button>
        <button onClick={() => setActiveTab('loans')} className={`flex-1 py-1.5 text-[12px] font-semibold rounded-[12px] capitalize transition-colors ${activeTab === 'loans' ? 'bg-card text-primary shadow-sm' : 'text-secondary'}`}>{t('loans')}</button>
        <button onClick={() => setActiveTab('employees')} className={`flex-1 py-1.5 text-[12px] font-semibold rounded-[12px] capitalize transition-colors ${activeTab === 'employees' ? 'bg-card text-primary shadow-sm' : 'text-secondary'}`}>{t('employees')}</button>
      </div>

      {/* Switcher Block */}
      {activeTab === 'employees' && (
        <div className="bg-primary text-white p-4 justify-between items-center rounded-xl mb-4 text-sm flex gap-2">
           <div>{t('operatingAs')} <strong>{activeEmployeeId ? employees.find(e => e.id === activeEmployeeId)?.name : t('businessOwner')}</strong></div>
           {activeEmployeeId ? (
              <button onClick={() => setActiveEmployeeId(null)} className="bg-white/20 px-3 py-1 rounded">{t('reset')}</button>
           ) : null}
        </div>
      )}

      {isAdding && activeTab === 'partners' && (
        <div className="bg-card p-5 rounded-[16px] border border-border shadow-sm mb-6 space-y-4">
          <h3 className="font-bold text-[14px]">{t('newPartner')}</h3>
          <div className="flex gap-2">
            <button className={`flex-1 py-2 rounded-lg text-sm font-semibold border ${partnerType === 'customer' ? 'bg-primary text-white border-primary' : 'bg-bg text-secondary border-border'}`} onClick={() => setPartnerType('customer')}>{t('customer')}</button>
            <button className={`flex-1 py-2 rounded-lg text-sm font-semibold border ${partnerType === 'supplier' ? 'bg-primary text-white border-primary' : 'bg-bg text-secondary border-border'}`} onClick={() => setPartnerType('supplier')}>{t('supplier')}</button>
          </div>
          <input type="text" placeholder={t('name')} className="w-full bg-bg p-3 rounded-lg border border-border text-[14px]" value={partnerName} onChange={e => setPartnerName(e.target.value)} />
          <input type="tel" placeholder={t('phoneOptional')} className="w-full bg-bg p-3 rounded-lg border border-border text-[14px]" value={partnerPhone} onChange={e => setPartnerPhone(e.target.value)} />
          <button onClick={handleSavePartner} className="w-full bg-primary text-white py-3 rounded-lg font-bold">{t('savePartner')}</button>
        </div>
      )}

      {isAdding && activeTab === 'loans' && (
        <div className="bg-card p-5 rounded-[16px] border border-border shadow-sm mb-6 space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="font-bold text-[14px]">{t('logDebtLoan')}</h3>
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-secondary font-medium">{t('bankLoan')}</span>
              <button 
                onClick={() => setIsBankLoan(!isBankLoan)}
                className={`w-8 h-4 rounded-full transition-colors relative ${isBankLoan ? 'bg-accent' : 'bg-border'}`}
              >
                <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all ${isBankLoan ? 'right-0.5' : 'left-0.5'}`} />
              </button>
            </div>
          </div>

          <div className="flex gap-2">
            <button className={`flex-1 py-1.5 rounded-lg text-sm font-semibold border ${loanType === 'given' ? 'bg-primary text-white border-primary' : 'bg-bg text-secondary border-border'}`} onClick={() => setLoanType('given')}>{t('iLentMoney')}</button>
            <button className={`flex-1 py-1.5 rounded-lg text-sm font-semibold border ${loanType === 'received' ? 'bg-primary text-white border-primary' : 'bg-bg text-secondary border-border'}`} onClick={() => setLoanType('received')}>{t('iBorrowed')}</button>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <input type="number" placeholder={t('totalAmount')} className="col-span-2 w-full bg-bg p-3 rounded-lg border border-border text-[14px]" value={loanAmount} onChange={e => setLoanAmount(e.target.value)} />
            <input type="number" placeholder={t('expectedMonthlyOptional')} className="w-full bg-bg p-3 rounded-lg border border-border text-[14px]" value={loanMonthly} onChange={e => setLoanMonthly(e.target.value)} />
            <input type="number" placeholder={t('loanDuration')} className="w-full bg-bg p-3 rounded-lg border border-border text-[14px]" value={loanDuration} title="Months" onChange={e => setLoanDuration(e.target.value)} />
            <input type="number" placeholder={t('interestRate')} className="w-full bg-bg p-3 rounded-lg border border-border text-[14px]" value={loanInterest} onChange={e => setLoanInterest(e.target.value)} />
            <input type="number" placeholder={t('taxRate')} className="w-full bg-bg p-3 rounded-lg border border-border text-[14px]" value={loanTaxRate} onChange={e => setLoanTaxRate(e.target.value)} />
          </div>

          {isBankLoan && (
            <div className="grid grid-cols-2 gap-2 p-3 bg-bg rounded-lg border border-border border-dashed space-y-0.5">
              <input type="text" placeholder={t('bankName')} className="w-full bg-card p-2 rounded border border-border text-[12px]" value={loanBankName} onChange={e => setLoanBankName(e.target.value)} />
              <input type="text" placeholder={t('accountNumber')} className="w-full bg-card p-2 rounded border border-border text-[12px]" value={loanAccount} onChange={e => setLoanAccount(e.target.value)} />
              <input type="number" placeholder={t('penaltyFee')} className="w-full bg-card p-2 rounded border border-border text-[12px]" value={loanPenalty} onChange={e => setLoanPenalty(e.target.value)} />
              <div className="col-span-1 flex flex-col gap-1">
                <label className="text-[10px] text-secondary font-medium ml-1">{t('dueDate')}</label>
                <input type="date" className="w-full bg-card p-2 rounded border border-border text-[12px]" value={loanDueDate} onChange={e => setLoanDueDate(e.target.value)} />
              </div>
            </div>
          )}

          <input type="text" placeholder={t('loanPurpose')} className="w-full bg-bg p-3 rounded-lg border border-border text-[14px]" value={loanPurpose} onChange={e => setLoanPurpose(e.target.value)} />

          <select className="w-full bg-bg p-3 rounded-lg border border-border text-[14px]" value={loanPartnerId} onChange={e => setLoanPartnerId(e.target.value)}>
            <option value="">{t('selectPartner')} (Optional)</option>
            {partners.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <button onClick={handleSaveLoan} className="w-full bg-primary text-white py-3 rounded-lg font-bold">{t('saveLoan')}</button>
        </div>
      )}

      {isAdding && activeTab === 'employees' && (
        <div className="bg-card p-5 rounded-[16px] border border-border shadow-sm mb-6 space-y-4">
          <h3 className="font-bold text-[14px]">{t('newEmployee')}</h3>
          <input type="text" placeholder={t('employeeName')} className="w-full bg-bg p-3 rounded-lg border border-border text-[14px]" value={employeeName} onChange={e => setEmployeeName(e.target.value)} />
          <select className="w-full bg-bg p-3 rounded-lg border border-border text-[14px]" value={employeeRole} onChange={e => setEmployeeRole(e.target.value as any)}>
            <option value="staff">{t('staffRole')}</option>
            <option value="admin">{t('adminRole')}</option>
            <option value="viewer">{t('viewerRole')}</option>
          </select>
          <div className="flex gap-2">
              <input type="password" maxLength={4} placeholder={t('setPin')} className="flex-1 bg-bg p-3 rounded-lg border border-border text-[14px] tracking-widest text-center" value={employeePin} onChange={e => setEmployeePin(e.target.value.replace(/\D/g, ''))} />
              <input type="password" maxLength={4} placeholder={t('confirmPin')} className="flex-1 bg-bg p-3 rounded-lg border border-border text-[14px] tracking-widest text-center" value={employeeConfirmPin} onChange={e => setEmployeeConfirmPin(e.target.value.replace(/\D/g, ''))} />
          </div>
          <button onClick={handleSaveEmployee} className="w-full bg-primary text-white py-3 rounded-lg font-bold">{t('saveEmployee')}</button>
        </div>
      )}

      {activeTab === 'partners' && (
        <div className="space-y-3">
          {partners.map(p => (
            <div key={p.id} className="bg-card p-4 rounded-[12px] border border-border flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-border flex items-center justify-center text-secondary">
                <Users size={20} />
              </div>
              <div>
                <h3 className="font-bold text-primary">{p.name}</h3>
                <p className="text-[12px] text-secondary capitalize">{p.type} {p.phone && `• ${p.phone}`}</p>
              </div>
            </div>
          ))}
          {partners.length === 0 && !isAdding && (
            <div className="text-center py-10 text-secondary bg-card rounded-xl border border-border">{t('noPartners')}</div>
          )}
        </div>
      )}

      {activeTab === 'loans' && (
        <div>
          <div className="flex flex-col gap-3 mb-6">
            <div className="flex gap-3">
              <div className="bg-[#ECFDF3] border border-[#ABEFC6] p-4 rounded-[16px] flex-1">
                <p className="text-[11px] text-[#067647] font-semibold mb-1 flex items-center gap-1"><ArrowUpRight size={14}/> {t('othersOweMe')}</p>
                <h4 className="text-[16px] font-bold text-[#067647]">{totalGiven.toLocaleString()} ETB</h4>
              </div>
              <div className="bg-[#FEF3F2] border border-[#FECDCA] p-4 rounded-[16px] flex-1">
                <p className="text-[11px] text-[#B42318] font-semibold mb-1 flex items-center gap-1"><ArrowDownRight size={14}/> {t('iOweOthers')}</p>
                <h4 className="text-[16px] font-bold text-[#B42318]">{totalReceived.toLocaleString()} ETB</h4>
              </div>
            </div>

            {/* Filters */}
            <div className="bg-card border border-border p-3 rounded-xl space-y-3">
              <div className="flex items-center gap-2 text-[12px] font-bold text-secondary uppercase px-1">
                <Filter size={14} /> {t('filters')}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <select className="bg-bg border border-border p-2 rounded-lg text-xs font-semibold outline-none" value={filterType} onChange={e => setFilterType(e.target.value as any)}>
                  <option value="all">{t('allLoans')}</option>
                  <option value="given">{t('lentTo')}</option>
                  <option value="received">{t('borrowedFrom')}</option>
                </select>
                <select className="bg-bg border border-border p-2 rounded-lg text-xs font-semibold outline-none" value={filterStatus} onChange={e => setFilterStatus(e.target.value as any)}>
                  <option value="all">{t('status')}</option>
                  <option value="active">{t('active')}</option>
                  <option value="paid_off">{t('paid_off')}</option>
                </select>
                <button 
                  onClick={() => setFilterBank(!filterBank)}
                  className={`col-span-2 text-left py-2 px-3 rounded-lg border text-xs font-semibold flex items-center justify-between transition-colors ${filterBank ? 'bg-primary/5 border-primary text-primary' : 'bg-bg border-border text-secondary'}`}
                >
                  <span className="flex items-center gap-2">🏦 {t('bankLoansOnly')}</span>
                  <div className={`w-8 h-4 rounded-full transition-colors relative ${filterBank ? 'bg-primary' : 'bg-border'}`}>
                    <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all ${filterBank ? 'right-0.5' : 'left-0.5'}`} />
                  </div>
                </button>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            {filteredLoans.map(l => {
              const schedule = generateAmortizationSchedule(l);
              const totals = calculateLoanTotals(l);
              const isExpanded = expandedLoanId === l.id;

              return (
                <div key={l.id} className="bg-card p-4 rounded-[12px] border border-border transition-all duration-300">
                  <div className="flex justify-between mb-2">
                    <div className="flex flex-col">
                      <span className={`text-[12px] font-bold uppercase ${l.type === 'given' ? 'text-profit' : 'text-expense'}`}>
                        {l.type === 'given' ? t('lentTo') : t('borrowedFrom')} {l.partnerId ? partners.find(p => p.id === l.partnerId)?.name : 'Someone'}
                      </span>
                      {l.isBankLoan && <span className="text-[10px] text-accent font-bold uppercase">🏦 {t('bankLoan')}</span>}
                    </div>
                    <div className="flex flex-col items-end">
                      <span className="text-[11px] text-secondary">{new Date(l.startDate).toLocaleDateString()}</span>
                      <span className={`text-[9px] font-bold px-1.5 rounded uppercase mt-0.5 ${l.status === 'paid_off' ? 'bg-profit/10 text-profit' : 'bg-accent/10 text-accent'}`}>
                        {l.status === 'paid_off' ? t('paid_off') : t('active')}
                      </span>
                    </div>
                  </div>
                  <h4 className="font-bold text-[18px] text-primary">{l.remainingAmount.toLocaleString()} / {l.amount.toLocaleString()} ETB</h4>
                  
                  <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1">
                    {l.nextPaymentDate && (
                      <div className={`text-[12px] font-medium flex items-center gap-1 ${new Date(l.nextPaymentDate) < new Date() ? 'text-expense' : 'text-accent'}`}>
                        <Calendar size={14}/> {t('nextDue')} {format(new Date(l.nextPaymentDate), 'MMM d, yyyy')}
                        {new Date(l.nextPaymentDate) < new Date() && <span className="text-[10px] bg-expense/10 px-1 rounded ml-1 animate-pulse font-bold">LATE</span>}
                      </div>
                    )}
                    {l.interest && (
                      <div className="text-[11px] text-secondary flex items-center gap-1">
                        <span className="opacity-60">{t('interestRate')}:</span> {l.interest}%
                      </div>
                    )}
                  </div>

                  {l.interest && l.interest > 0 && (
                    <div className="mt-3 flex gap-4 p-2.5 bg-accent/5 rounded-xl border border-accent/10">
                       <div className="flex-1">
                         <p className="text-[9px] text-secondary uppercase font-bold tracking-wider">{t('totalInterest')}</p>
                         <p className="text-[14px] font-bold text-accent">{totals.totalInterest.toLocaleString()} ETB</p>
                       </div>
                       <div className="flex-1">
                         <p className="text-[9px] text-secondary uppercase font-bold tracking-wider">{t('totalRepayment')}</p>
                         <p className="text-[14px] font-bold text-primary">{totals.totalRepayment.toLocaleString()} ETB</p>
                       </div>
                    </div>
                  )}

                  {(l.bankName || l.loanPurpose || l.penaltyFee || l.dueDate) && (
                    <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] text-secondary border-t border-border pt-2 border-dashed">
                      {l.bankName && <div className="col-span-2 font-medium text-primary"><span className="opacity-60">{t('bankName')}:</span> {l.bankName} {l.accountNumber && `(${l.accountNumber})`}</div>}
                      {l.loanPurpose && <div className="col-span-2"><span className="opacity-60">{t('loanPurpose')}:</span> {l.loanPurpose}</div>}
                      {l.dueDate && <div><span className="opacity-60">{t('dueDate')}:</span> {new Date(l.dueDate).toLocaleDateString()}</div>}
                      {l.penaltyFee && <div className="text-expense font-bold"><span className="opacity-60">{t('penaltyFee')}:</span> {l.penaltyFee.toLocaleString()} ETB</div>}
                    </div>
                  )}

                  {isExpanded && (
                    <div className="mt-4 pt-4 border-t border-border animate-in fade-in slide-in-from-top-2 duration-200">
                      <div className="grid grid-cols-2 gap-3 mb-4">
                        <div className="bg-bg p-2 rounded border border-border">
                          <p className="text-[10px] uppercase font-bold text-secondary opacity-60 mb-0.5">{t('totalInterest')}</p>
                          <p className="text-[13px] font-bold text-primary">{totals.totalInterest.toLocaleString()} ETB</p>
                        </div>
                        <div className="bg-bg p-2 rounded border border-border">
                          <p className="text-[10px] uppercase font-bold text-secondary opacity-60 mb-0.5">{t('totalRepayment')}</p>
                          <p className="text-[13px] font-bold text-primary">{totals.totalRepayment.toLocaleString()} ETB</p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between mb-2">
                        <h5 className="text-[12px] font-bold flex items-center gap-1 opacity-70"><ListTodo size={14}/> {showAmortization ? t('amortizationSchedule') : t('repaymentSchedule')}</h5>
                        <button 
                          onClick={(e) => { e.stopPropagation(); setShowAmortization(!showAmortization); }}
                          className="text-[10px] font-bold text-accent bg-accent/5 px-2 py-1 rounded"
                        >
                          {showAmortization ? t('viewSimple') : t('viewFullAmortization')}
                        </button>
                      </div>

                      <div className="overflow-x-auto rounded-lg border border-border">
                        <table className="w-full text-[11px] text-left">
                          <thead className="bg-bg text-secondary border-b border-border">
                            <tr>
                              <th className="p-2 font-bold uppercase italic opacity-60">{t('paymentDate')}</th>
                              <th className="p-2 font-bold uppercase italic opacity-60">{t('amountDue')}</th>
                              {showAmortization ? (
                                <>
                                  <th className="p-2 font-bold uppercase italic opacity-60">Principal</th>
                                  <th className="p-2 font-bold uppercase italic opacity-60">Interest</th>
                                  <th className="p-2 font-bold uppercase italic opacity-60">Balance</th>
                                </>
                              ) : (
                                <th className="p-2 font-bold uppercase italic opacity-60">{t('amountPaid')}</th>
                              )}
                            </tr>
                          </thead>
                          <tbody>
                            {schedule.map((row) => (
                              <tr key={row.paymentNumber} className="border-b border-border last:border-0 hover:bg-bg/50">
                                <td className="p-2 font-medium">{format(new Date(row.date), 'MMM d, yyyy')}</td>
                                <td className="p-2 font-mono">{row.amountDue.toLocaleString()}</td>
                                {showAmortization ? (
                                  <>
                                    <td className="p-2 font-mono text-profit">{row.principalPart.toLocaleString()}</td>
                                    <td className="p-2 font-mono text-accent">{row.interestPart.toLocaleString()}</td>
                                    <td className="p-2 font-mono text-secondary">{row.remainingBalance.toLocaleString()}</td>
                                  </>
                                ) : (
                                  <td className={`p-2 font-mono font-bold ${row.amountPaid > 0 ? 'text-profit' : 'text-secondary opacity-40'}`}>
                                    {row.amountPaid.toLocaleString()}
                                  </td>
                                )}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                  
                  <div className="mt-3 pt-3 border-t border-border flex justify-between items-center gap-2">
                     <div className="flex gap-2">
                        {recordingPaymentFor === l.id ? (
                           <div className="flex gap-2 relative z-10">
                              <input autoFocus type="number" placeholder={t('paymentAmount')} className="w-[120px] bg-bg py-1 px-2 text-sm rounded border border-border" value={paymentAmount} onChange={e => setPaymentAmount(e.target.value)} />
                              <button onClick={() => handleRecordPayment(l.id)} className="bg-primary text-white text-[11px] font-bold px-3 py-1 rounded">{t('confirm')}</button>
                              <button onClick={() => setRecordingPaymentFor(null)} className="text-secondary text-[11px] font-bold px-2 py-1 rounded">{t('cancel')}</button>
                           </div>
                        ) : (
                          <button onClick={() => setRecordingPaymentFor(l.id)} className="text-primary text-[12px] font-bold bg-border px-3 py-1.5 rounded-lg">{t('recordPayment')}</button>
                        )}
                        <button 
                          onClick={() => { setExpandedLoanId(isExpanded ? null : l.id); setShowAmortization(false); }}
                          className={`p-1.5 rounded-lg border transition-colors ${isExpanded ? 'bg-primary border-primary text-white' : 'bg-transparent border-border text-secondary'}`}
                        >
                          {isExpanded ? <ChevronUp size={20}/> : <ChevronDown size={20}/>}
                        </button>
                     </div>
                     <div className="text-[11px] text-secondary">
                        {l.paymentHistory?.length || 0} {t('paymentsMade')}
                     </div>
                  </div>

                  {l.paymentHistory && l.paymentHistory.length > 0 && !isExpanded && (
                     <div className="mt-3 text-[11px] bg-bg p-2 rounded">
                       <p className="font-bold mb-1 opacity-70">{t('paymentHistory')}</p>
                       {l.paymentHistory.slice(-3).map((ph, i) => (
                         <div key={i} className="flex justify-between items-center text-secondary border-b border-border/50 pb-1 mb-1 last:border-0 last:mb-0 last:pb-0">
                           <span>{format(new Date(ph.date), 'MMM d, yyyy')}</span>
                           <span>-{ph.amount.toLocaleString()} ETB</span>
                         </div>
                       ))}
                     </div>
                  )}
                </div>
              );
            })}
            {filteredLoans.length === 0 && !isAdding && (
              <div className="text-center py-10 text-secondary bg-card rounded-xl border border-border">{t('noLoans')}</div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'employees' && (
        <div className="space-y-3">
          {switchingToEmployee && (
            <div className="bg-[#FEF3F2] border border-[#FECDCA] p-4 rounded-xl flex items-center gap-3">
               <input autoFocus type="password" maxLength={4} placeholder={t('enterPinSwitch')} className="w-full max-w-[150px] bg-white border border-[#FECDCA] text-sm p-2 rounded text-center tracking-widest" value={switcherPin} onChange={e => setSwitcherPin(e.target.value.replace(/\D/g, ''))}/>
               <button onClick={attemptSwitch} className="bg-[#B42318] text-white text-xs font-bold py-2 px-4 rounded">{t('confirm')}</button>
               <button onClick={() => setSwitchingToEmployee(null)} className="text-xs font-bold text-secondary">{t('cancel')}</button>
            </div>
          )}

          {employees.map(e => (
            <div key={e.id} className="bg-card p-4 rounded-[12px] border border-border flex items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-border flex items-center justify-center text-secondary">
                  <UserCheck size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-primary">{e.name} {activeEmployeeId === e.id && '(Active)'}</h3>
                  <p className="text-[12px] text-secondary capitalize">{t('role')} {e.role} {e.pin ? `• ${t('pinSet')}` : ''}</p>
                </div>
              </div>
              {activeEmployeeId !== e.id && !switchingToEmployee && (
                 <button onClick={() => {
                   if (!e.pin) { setActiveEmployeeId(e.id); } 
                   else { setSwitchingToEmployee(e.id); }
                 }} className="text-xs bg-bg font-bold py-1 px-3 rounded text-secondary border border-border">{t('login')}</button>
              )}
            </div>
          ))}
          {(!employees || employees.length === 0) && !isAdding && (
            <div className="text-center py-10 text-secondary bg-card rounded-xl border border-border">{t('noEmployees')}</div>
          )}
        </div>
      )}
    </div>
  );
};
