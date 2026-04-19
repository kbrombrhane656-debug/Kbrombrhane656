import { useState } from 'react';
import { useAppStore } from '../../data/store';
import { saveCard, removeCard } from '../../services/dbService';
import { Plus, CreditCard, Trash2, X } from 'lucide-react';
import { useTranslation } from '../../i18n';

export const CardsScreen = ({ onClose }: { onClose?: () => void }) => {
  const { cards, user, language } = useAppStore();
  const t = useTranslation(language);
  const [isAdding, setIsAdding] = useState(false);
  
  const [name, setName] = useState('');
  const [balance, setBalance] = useState('');
  const [accountName, setAccountName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [branchName, setBranchName] = useState('');
  const [isVirtual, setIsVirtual] = useState(false);
  const [color, setColor] = useState('#2E90FA');

  const [transferTargetId, setTransferTargetId] = useState<string | null>(null);
  const [transferAmount, setTransferAmount] = useState('');
  const [destCardId, setDestCardId] = useState('');

  const COLORS = ['#F04438', '#12B76A', '#2E90FA', '#F79009', '#875BF7', '#667085', '#101828'];

  const handleSaveCard = async () => {
    if (!name || isNaN(Number(balance)) || !user) return;
    
    await saveCard({
      userId: user.uid,
      name,
      accountName,
      accountNumber,
      branchName,
      isVirtual,
      balance: Number(balance),
      color,
      createdAt: new Date().toISOString()
    });

    setIsAdding(false);
    setName(''); setBalance(''); setAccountName(''); setAccountNumber(''); setBranchName('');
    setIsVirtual(false);
  };

  const handleTransfer = async () => {
    if (!transferTargetId || !destCardId || isNaN(Number(transferAmount)) || !user) return;
    
    const qty = Number(transferAmount);
    if (qty <= 0) return;

    const sourceCard = cards.find(c => c.id === transferTargetId);
    const destCard = cards.find(c => c.id === destCardId);
    if (!sourceCard || !destCard) return;

    if (sourceCard.balance < qty) {
      alert("Insufficient balance on the source card.");
      return;
    }

    // Debit source
    await saveCard({ ...sourceCard, balance: sourceCard.balance - qty }, sourceCard.id);
    // Credit destination
    await saveCard({ ...destCard, balance: destCard.balance + qty }, destCard.id);

    setTransferTargetId(null);
    setTransferAmount('');
    setDestCardId('');
  };

  return (
    <div className="p-5 flex flex-col h-full bg-bg pb-20 overflow-y-auto">
      <div className="flex justify-between items-center mb-6 mt-2">
        <h2 className="text-[18px] font-bold text-primary">{t('bankCards')}</h2>
        <div className="flex gap-2">
          {onClose && (
            <button onClick={onClose} className="p-2 text-secondary h-10 w-10 flex items-center justify-center bg-card rounded-full border border-border">
              <X size={20} />
            </button>
          )}
          <button 
            onClick={() => setIsAdding(!isAdding)}
            className="bg-accent text-white p-2 rounded-full shadow-sm"
          >
            {isAdding ? <X size={20} /> : <Plus size={20} />}
          </button>
        </div>
      </div>

      {isAdding && (
        <div className="bg-card p-5 rounded-[24px] border border-border shadow-sm mb-6 space-y-4 animate-in slide-in-from-top-4 duration-300">
          <label className="flex items-center gap-2 cursor-pointer mb-2">
            <input 
              type="checkbox" 
              checked={isVirtual}
              onChange={(e) => setIsVirtual(e.target.checked)}
              className="w-5 h-5 rounded border-border text-accent focus:ring-accent accent-accent"
            />
            <span className="text-sm font-bold text-primary">This is a Virtual Wallet</span>
          </label>

          <div>
            <label className="block text-[10px] font-bold text-secondary mb-1 uppercase tracking-wider ml-1">{t('cardName')} (Nickname)</label>
            <input type="text" placeholder="e.g. CBE Account" className="w-full bg-bg p-3 rounded-xl border border-border text-[14px]" value={name} onChange={e => setName(e.target.value)} />
          </div>
          
          {!isVirtual && (
            <>
              <div>
                <label className="block text-[10px] font-bold text-secondary mb-1 uppercase tracking-wider ml-1">Account Holder Name</label>
                <input type="text" placeholder="e.g. John Doe" className="w-full bg-bg p-3 rounded-xl border border-border text-[14px]" value={accountName} onChange={e => setAccountName(e.target.value)} />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-secondary mb-1 uppercase tracking-wider ml-1">Account Number</label>
                <input type="text" placeholder="e.g. 1000123456789" className="w-full bg-bg p-3 rounded-xl border border-border text-[14px]" value={accountNumber} onChange={e => setAccountNumber(e.target.value)} />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-secondary mb-1 uppercase tracking-wider ml-1">Branch</label>
                <input type="text" placeholder="e.g. Main Branch" className="w-full bg-bg p-3 rounded-xl border border-border text-[14px]" value={branchName} onChange={e => setBranchName(e.target.value)} />
              </div>
            </>
          )}

          <div>
            <label className="block text-[10px] font-bold text-secondary mb-1 uppercase tracking-wider ml-1">{t('initialBalance')}</label>
            <input type="number" placeholder="0.00" className="w-full bg-bg p-3 rounded-xl border border-border text-[14px]" value={balance} onChange={e => setBalance(e.target.value)} />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-secondary mb-1 uppercase tracking-wider ml-1">{t('color')}</label>
            <div className="flex gap-3 mt-1">
              {COLORS.map(c => (
                <button 
                  key={c} 
                  onClick={() => setColor(c)}
                  className={`w-8 h-8 rounded-full border-2 transition-transform ${color === c ? 'scale-110 border-primary' : 'border-transparent'}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>
          <button onClick={handleSaveCard} className="w-full bg-primary text-white py-4 rounded-xl font-bold shadow-lg shadow-primary/20">{t('saveCard')}</button>
        </div>
      )}

      <div className="space-y-4">
        {cards.length === 0 && !isAdding && (
          <div className="text-center py-10 text-secondary bg-card rounded-2xl border border-border border-dashed">
            <CreditCard size={32} className="mx-auto mb-2 opacity-30" />
            <p className="text-sm font-medium">{t('noCards')}</p>
          </div>
        )}
        
        {cards.map(card => (
          <div key={card.id} className="bg-card p-5 rounded-[20px] border border-border shadow-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 -mr-16 -mt-16 rounded-full opacity-10" style={{ backgroundColor: card.color }} />
            
            <div className="flex justify-between items-start relative z-10">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-xl text-white shadow-md" style={{ backgroundColor: card.color }}>
                  <CreditCard size={24} />
                </div>
                <div>
                  <h3 className="font-bold text-primary flex items-center gap-2">
                    {card.name}
                    {card.isVirtual && <span className="bg-accent/10 focus:ring-accent accent-accent text-accent text-[9px] px-2 py-0.5 rounded-full uppercase tracking-widest border border-accent/20">Virtual</span>}
                  </h3>
                  <p className="text-[10px] text-secondary font-medium uppercase tracking-widest">{t('totalBalance')}</p>
                </div>
              </div>
              <button onClick={() => removeCard(card.id)} className="text-secondary/50 hover:text-expense p-2 transition-colors">
                <Trash2 size={16} />
              </button>
            </div>
            
            <div className="mt-6 flex flex-col gap-1 relative z-10">
               {card.accountNumber && (
                 <div className="text-[14px] font-mono text-secondary/80 flex items-center gap-2">
                   <span>{card.accountNumber.match(/.{1,4}/g)?.join(' ') || card.accountNumber}</span>
                 </div>
               )}
               <div className="flex items-baseline gap-2">
                 <span className="text-3xl font-black text-primary">{card.balance.toLocaleString()}</span>
                 <span className="text-[12px] font-bold text-secondary">ETB</span>
               </div>
               
               {card.accountName && (
                 <div className="text-[11px] font-medium text-secondary mt-1 uppercase tracking-wide">
                   {card.accountName} {card.branchName ? `• ${card.branchName}` : ''}
                 </div>
               )}
            </div>

            <div className="mt-4 flex gap-2 overflow-x-auto pb-1 hide-scrollbar relative z-10">
               {!card.isVirtual && (
                 <button 
                   onClick={() => setTransferTargetId(card.id)}
                   className="bg-primary hover:bg-primary/90 text-white px-3 py-1.5 rounded-lg text-[11px] font-bold shadow-md whitespace-nowrap transition-colors active:scale-95"
                 >
                   + Transfer to Visual Card
                 </button>
               )}
            </div>
          </div>
        ))}
      </div>

      {transferTargetId && (
        <div className="absolute inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-card w-full max-w-sm rounded-3xl p-6 shadow-2xl animate-in slide-in-from-bottom-10 sm:slide-in-from-bottom-0 sm:zoom-in-95">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-bold text-primary text-lg">Transfer Funds</h3>
              <button 
                onClick={() => setTransferTargetId(null)}
                className="bg-border/50 p-2 rounded-full text-secondary hover:text-primary transition-colors"
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4 mb-6">
               <div>
                  <label className="block text-[10px] font-bold text-secondary mb-1 uppercase tracking-wider ml-1">Destination Visual Wallet</label>
                  <select 
                    value={destCardId} 
                    onChange={e => setDestCardId(e.target.value)} 
                    className="w-full bg-bg p-3 rounded-xl border border-border text-[14px]"
                  >
                    <option value="">Select a visual wallet</option>
                    {cards.filter(c => c.isVirtual && c.id !== transferTargetId).map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
               </div>
               <div>
                  <label className="block text-[10px] font-bold text-secondary mb-1 uppercase tracking-wider ml-1">Amount to Transfer</label>
                  <input 
                    type="number" 
                    placeholder="0.00" 
                    className="w-full bg-bg p-3 rounded-xl border border-border text-[14px]" 
                    value={transferAmount} 
                    onChange={e => setTransferAmount(e.target.value)} 
                  />
               </div>
            </div>

            <button 
               onClick={handleTransfer} 
               disabled={!destCardId || !transferAmount}
               className="w-full bg-primary disabled:opacity-50 text-white rounded-xl py-4 font-bold active:scale-95 transition-all shadow-md"
            >
               Confirm Transfer
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
