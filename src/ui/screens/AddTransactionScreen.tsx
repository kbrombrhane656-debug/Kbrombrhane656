import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { saveTransaction, saveCategory } from '../../services/dbService';
import { useAppStore } from '../../data/store';
import { TransactionType, RecurringFrequency } from '../../domain/models';
import { format } from 'date-fns';
import { Delete, ChevronDown, ChevronUp, Plus, CreditCard, Package, Camera, Loader2, Sparkles } from 'lucide-react';
import { useTranslation, translations } from '../../i18n';
import { GoogleGenAI, Type } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export const AddTransactionScreen = () => {
  const navigate = useNavigate();
  const { user, categories, partners, activeEmployeeId, employees, language, cards, products } = useAppStore();
  const t = useTranslation(language);
  
  const [type, setType] = useState<TransactionType>('expense');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  
  // Scanning State
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isScanning, setIsScanning] = useState(false);

  // Advanced details (hidden by default for fast entry)
  const [showDetails, setShowDetails] = useState(false);
  const [note, setNote] = useState('');
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [recurring, setRecurring] = useState<RecurringFrequency>('none');
  const [recurringDayOfMonth, setRecurringDayOfMonth] = useState<number>(new Date().getDate());
  const [recurringEndDate, setRecurringEndDate] = useState('');
  const [isRecurringActive, setIsRecurringActive] = useState(true);
  const [selectedCardId, setSelectedCardId] = useState('');
  const [selectedProductId, setSelectedProductId] = useState('');

  // Auto-select a virtual card if available
  useEffect(() => {
    const defaultVirtual = cards.find(c => c.isVirtual);
    if (defaultVirtual && !selectedCardId) {
      setSelectedCardId(defaultVirtual.id);
    }
  }, [cards]);

  // Custom Category Modal
  const [showNewCatModal, setShowNewCatModal] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatType, setNewCatType] = useState<'income'|'expense'|'both'>(type);
  const [newCatIcon, setNewCatIcon] = useState('💰');
  const [newCatColor, setNewCatColor] = useState('#2E90FA');

  const COLORS = ['#F04438', '#12B76A', '#2E90FA', '#F79009', '#875BF7', '#667085'];
  const EMOJIS = ['💰', '🛒', '🚗', '🏠', '🍔', '📦', '📱', '🔧', '🎓', '🏥', '🎉', '💡'];

  // PIN Modal
  const [showPinModal, setShowPinModal] = useState(false);
  const [pinEntry, setPinEntry] = useState('');

  const activeEmployee = employees.find(e => e.id === activeEmployeeId);

  const availableCategories = categories.filter(c => c.type === type || c.type === 'both');
  
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsScanning(true);
    try {
      // Convert file to Base64
      const reader = new FileReader();
      reader.readAsDataURL(file);
      await new Promise((resolve) => (reader.onload = resolve));
      const base64Data = (reader.result as string).split(',')[1];
      const mimeType = file.type;

      // Extract transaction data using Gemini API
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: [
          {
            inlineData: {
              data: base64Data,
              mimeType: mimeType,
            },
          },
          'Analyze this receipt/invoice. Extract the total amount, suggest a category name (e.g. Food, Electronics, Supplies), and provide a short note about the purchase.',
        ],
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              amount: { type: Type.NUMBER, description: 'The total numeric amount of the transaction.' },
              category: { type: Type.STRING, description: 'The most appropriate category name.' },
              note: { type: Type.STRING, description: 'A short description or vendor name.' },
              type: { type: Type.STRING, description: 'Either "income" or "expense" based on the document type.' }
            },
            required: ['amount', 'category', 'type'],
          },
        },
      });

      const parsedJSON = JSON.parse(response.text.trim());
      
      if (parsedJSON.amount) setAmount(parsedJSON.amount.toString());
      if (parsedJSON.note) setNote(parsedJSON.note);
      if (parsedJSON.type === 'income' || parsedJSON.type === 'expense') setType(parsedJSON.type as TransactionType);
      
      // Attempt to auto-match category or set note fallback
      const catMatch = categories.find(c => c.name.toLowerCase().includes(parsedJSON.category.toLowerCase()));
      if (catMatch) {
         setCategory(catMatch.name);
      } else {
         if (parsedJSON.category) setNote(prev => prev ? `${prev} - ${parsedJSON.category}` : parsedJSON.category);
      }
      
      // Auto-expand advanced details so user can see what was extracted (like Note)
      if (parsedJSON.note || (!catMatch && parsedJSON.category)) setShowDetails(true);

    } catch (e) {
      console.error("Receipt Parse Error:", e);
      alert("Failed to scan receipt. Please enter manually.");
    } finally {
      setIsScanning(false);
      // reset file input
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const uniqueCategories = [];
  const seenNames = new Set();
  for (const c of availableCategories) {
    if (!seenNames.has(c.name)) {
      seenNames.add(c.name);
      uniqueCategories.push(c);
    }
  }
  
  const displayCategories = uniqueCategories.length > 0 
    ? uniqueCategories 
    : (type === 'income' ? ['Sales', 'Other'] : ['Stock', 'Transport', 'Rent', 'Food', 'Other']).map(name => ({ id: name, name, icon: '', color: '' }));

  useEffect(() => {
    if (displayCategories.length > 0 && !displayCategories.find(c => c.name === category)) {
      setCategory(displayCategories[0].name);
    }
  }, [type, categories]);

  const handleKeypad = (val: string) => {
    if (val === 'back') {
      setAmount(prev => prev.slice(0, -1));
    } else if (val === '.') {
      if (!amount.includes('.')) setAmount(prev => prev + val);
    } else {
      if (amount === '0') setAmount(val);
      else if (amount.replace('.', '').length < 9) setAmount(prev => prev + val);
    }
  };

  const executeSaveTransaction = async () => {
    if (!amount || isNaN(Number(amount)) || !user || !category || !date) return;

    let nextRecurringDate = undefined;
    if (recurring !== 'none') {
      const d = new Date(date);
      if (recurring === 'daily') d.setDate(d.getDate() + 1);
      else if (recurring === 'weekly') d.setDate(d.getDate() + 7);
      else if (recurring === 'monthly') {
        let currentMonth = d.getMonth();
        let currentYear = d.getFullYear();
        let targetMonth = currentMonth + 1;
        if (targetMonth > 11) { targetMonth = 0; currentYear += 1; }
        const lastDay = new Date(currentYear, targetMonth + 1, 0).getDate();
        const targetDay = Math.min(recurringDayOfMonth, lastDay);
        d.setFullYear(currentYear, targetMonth, targetDay);
      }
      else if (recurring === 'yearly') d.setFullYear(d.getFullYear() + 1);
      nextRecurringDate = d.toISOString();
    }

    await saveTransaction({
      userId: user.uid,
      amount: Number(amount),
      type,
      category,
      note,
      date: new Date(date).toISOString(),
      createdAt: new Date().toISOString(),
      recurringFrequency: recurring,
      nextRecurringDate,
      recurringEndDate: recurringEndDate ? new Date(recurringEndDate).toISOString() : undefined,
      isRecurringActive: recurring !== 'none' ? isRecurringActive : undefined,
      cardId: selectedCardId || undefined,
      productId: selectedProductId || undefined,
    });

    navigate('/');
  };

  const handleSave = () => {
    if (!amount || isNaN(Number(amount)) || !category) return;
    
    // If operating as staff, require PIN
    if (activeEmployee && activeEmployee.role === 'staff') {
      if (!activeEmployee.pin) {
        alert('Staff pin not set. Please contact an admin.');
        return;
      }
      setShowPinModal(true);
    } else {
      executeSaveTransaction();
    }
  };

  const handleVerifyPin = () => {
    if (pinEntry === activeEmployee?.pin) {
      setShowPinModal(false);
      executeSaveTransaction();
    } else {
      alert("Invalid PIN");
      setPinEntry('');
    }
  };

  const handleCreateCategory = async () => {
    if (!user || !newCatName) return;
    const cat = await saveCategory({
      userId: user.uid,
      name: newCatName,
      type: newCatType,
      icon: newCatIcon,
      color: newCatColor,
      createdAt: new Date().toISOString()
    });
    // Set type to match newly created category if it's strictly income or expense
    if (newCatType === 'income' || newCatType === 'expense') {
        setType(newCatType);
    }
    setCategory(cat.name);
    setShowNewCatModal(false);
    setNewCatName('');
  };

  return (
    <div className="flex flex-col h-full bg-bg relative">
      <div className="flex bg-card p-2 rounded-[16px] mx-5 mt-5 mb-4 shadow-sm border border-border">
        <button 
          className={`flex-1 py-3 text-[14px] font-bold rounded-[12px] transition-all ${type === 'expense' ? 'bg-expense text-white shadow-md' : 'text-secondary bg-transparent hover:bg-border/50'}`}
          onClick={() => setType('expense')}
        >
          {t('expense')}
        </button>
        <button 
          className={`flex-1 py-3 text-[14px] font-bold rounded-[12px] transition-all ${type === 'income' ? 'bg-profit text-white shadow-md' : 'text-secondary bg-transparent hover:bg-border/50'}`}
          onClick={() => setType('income')}
        >
          {t('income')}
        </button>
      </div>

      <div className="mx-5 mb-6">
        <input 
          type="file" 
          accept="image/*" 
          capture="environment" 
          className="hidden" 
          ref={fileInputRef}
          onChange={handleFileUpload}
        />
        <button 
          onClick={() => fileInputRef.current?.click()}
          disabled={isScanning}
          className="w-full flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-accent/10 to-accent/5 border border-accent/20 rounded-xl text-accent font-bold text-[14px] active:scale-[0.98] transition-all"
        >
          {isScanning ? (
            <><Loader2 size={18} className="animate-spin" /> Analyzing Receipt...</>
          ) : (
            <><Camera size={18} /> Scan Receipt with AI ✨</>
          )}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-5 pb-24 flex flex-col">
        {/* Massive Amount Display */}
        <div className="flex flex-col items-center justify-center mb-8 min-h-[100px]">
          <span className="text-[14px] font-bold text-secondary uppercase tracking-wider mb-2">{t('amount')}</span>
          <div className="text-[48px] font-black text-primary tracking-tight flex items-center gap-2">
            <span className="text-3xl text-secondary">ETB</span>
            {amount || '0'}
          </div>
        </div>

        {/* Category Row (Fast Select) */}
        <div className="mb-6">
          <div className="flex justify-between items-end mb-3">
            <span className="text-[12px] font-bold text-secondary uppercase tracking-widest">{t('category')}</span>
            <Link to="/categories" className="text-[12px] font-bold text-accent">{t('manage')}</Link>
          </div>
          <div className="flex overflow-x-auto gap-3 pb-2 -mx-5 px-5 hide-scrollbar">
            {displayCategories.map(c => (
              <button
                key={c.id}
                onClick={() => setCategory(c.name)}
                className={`whitespace-nowrap px-4 py-3 rounded-[16px] text-[14px] font-semibold transition-all flex items-center gap-2 border ${category === c.name ? `bg-primary text-white border-primary shadow-md` : 'bg-card text-secondary border-border'}`}
              >
                {c.icon && <span>{c.icon}</span>}
                {c.name}
              </button>
            ))}
            <button
                onClick={() => setShowNewCatModal(true)}
                className={`whitespace-nowrap px-4 py-3 rounded-[16px] text-[14px] font-bold text-accent bg-accent/10 border border-accent/20 flex items-center gap-2`}
              >
                <Plus size={16} /> {t('new')}
            </button>
          </div>
        </div>

        {/* Advanced Options Toggle */}
        <div className="mb-6">
          <button 
            onClick={() => setShowDetails(!showDetails)}
            className="flex items-center gap-2 text-[13px] font-bold text-secondary uppercase py-2 w-full border-b border-border"
          >
            {showDetails ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            {t('advancedDetails')} {note || recurring !== 'none' ? `(${t('active')})` : ''}
          </button>
          
          {showDetails && (
            <div className="mt-4 space-y-4 animate-in slide-in-from-top-2 fade-in duration-200">
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block text-[10px] font-bold text-secondary mb-1 uppercase tracking-wide">{t('date')}</label>
                  <input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full bg-card text-[14px] text-primary py-3 px-4 rounded-[12px] border border-border" />
                </div>
                <div className="flex-1">
                  <label className="block text-[10px] font-bold text-secondary mb-1 uppercase tracking-wide">{t('recurring')}</label>
                  <select value={recurring} onChange={e => setRecurring(e.target.value as RecurringFrequency)} className="w-full bg-card text-[14px] text-primary py-3 px-4 rounded-[12px] border border-border">
                    <option value="none">{t('none')}</option>
                    <option value="daily">{t('daily')}</option>
                    <option value="weekly">{t('weekly')}</option>
                    <option value="monthly">{t('monthly')}</option>
                    <option value="yearly">{t('yearly')}</option>
                  </select>
                </div>
              </div>
              
              {recurring !== 'none' && (
                <div className="space-y-4 p-3 bg-card border border-border rounded-[12px]">
                   {recurring === 'monthly' && (
                     <div>
                        <label className="block text-[10px] font-bold text-secondary mb-1 uppercase tracking-wide">Day of Month</label>
                        <select 
                          value={recurringDayOfMonth} 
                          onChange={e => setRecurringDayOfMonth(parseInt(e.target.value))} 
                          className="w-full bg-bg text-[14px] text-primary py-2 px-3 rounded-lg border border-border"
                        >
                          {Array.from({length: 31}, (_, i) => i + 1).map(day => (
                            <option key={day} value={day}>{day}{day === 1 ? 'st' : day === 2 ? 'nd' : day === 3 ? 'rd' : 'th'}</option>
                          ))}
                        </select>
                     </div>
                   )}
                   <div className="flex gap-4">
                     <div className="flex-1">
                      <label className="block text-[10px] font-bold text-secondary mb-1 uppercase tracking-wide">{t('durationMonthsOptional')}</label>
                      <input 
                        type="number" 
                        placeholder="e.g. 6"
                        className="w-full bg-bg text-[14px] text-primary py-2 px-3 rounded-lg border border-border" 
                        onChange={e => {
                          const months = parseInt(e.target.value);
                          if (!isNaN(months)) {
                            const d = new Date(date);
                            d.setMonth(d.getMonth() + months);
                            setRecurringEndDate(format(d, 'yyyy-MM-dd'));
                          }
                        }}
                      />
                     </div>
                     <div className="flex-1">
                      <label className="block text-[10px] font-bold text-secondary mb-1 uppercase tracking-wide">{t('endDateOptional')}</label>
                      <input type="date" value={recurringEndDate} onChange={e => setRecurringEndDate(e.target.value)} className="w-full bg-bg text-[14px] text-primary py-2 px-3 rounded-lg border border-border" />
                     </div>
                   </div>
                   <div className="flex items-center">
                    <label className="flex items-center gap-2 text-[13px] font-semibold">
                      <input type="checkbox" checked={isRecurringActive} onChange={e => setIsRecurringActive(e.target.checked)} className="w-5 h-5 rounded text-accent focus:ring-accent" />
                      {t('active')}
                    </label>
                   </div>
                </div>
              )}

              <div>
                <label className="block text-[10px] font-bold text-secondary mb-1 uppercase tracking-wide">{t('selectCard')} (Virtual Wallets Only)</label>
                <div className="flex overflow-x-auto gap-2 py-1 -mx-5 px-5 hide-scrollbar">
                  <button
                    onClick={() => setSelectedCardId('')}
                    className={`whitespace-nowrap px-3 py-2 rounded-lg text-[12px] font-semibold border ${!selectedCardId ? 'bg-primary text-white border-primary' : 'bg-card text-secondary border-border'}`}
                  >
                    🏦 {t('none')}
                  </button>
                  {cards.filter(c => c.isVirtual).map(card => (
                    <button
                      key={card.id}
                      onClick={() => setSelectedCardId(card.id)}
                      className={`whitespace-nowrap px-3 py-2 rounded-lg text-[12px] font-bold border flex items-center gap-2 ${selectedCardId === card.id ? 'bg-primary text-white border-primary shadow-sm' : 'bg-card text-secondary border-border'}`}
                      style={selectedCardId === card.id ? { backgroundColor: card.color } : {}}
                    >
                      <CreditCard size={14} />
                      {card.name} ({card.balance.toLocaleString()} ETB)
                    </button>
                  ))}
                  {cards.filter(c => c.isVirtual).length === 0 && (
                    <div className="text-[11px] text-secondary/60 flex items-center bg-card border border-border border-dashed px-3 rounded-lg">
                      No visual cards found. Transfer from bank first.
                    </div>
                  )}
                  <Link to="/cards" className="whitespace-nowrap px-3 py-2 rounded-lg text-[12px] font-bold text-accent bg-accent/5 border border-dashed border-accent/20 flex items-center gap-1">
                    <Plus size={14} /> {t('new')}
                  </Link>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-secondary mb-1 uppercase tracking-wide">{t('linkToProduct')}</label>
                <div className="flex overflow-x-auto gap-2 py-1 -mx-5 px-5 hide-scrollbar">
                  <button
                    onClick={() => setSelectedProductId('')}
                    className={`whitespace-nowrap px-3 py-2 rounded-lg text-[12px] font-semibold border ${!selectedProductId ? 'bg-primary text-white border-primary' : 'bg-card text-secondary border-border'}`}
                  >
                    📦 {t('none')}
                  </button>
                  {products.map(prod => (
                    <button
                      key={prod.id}
                      onClick={() => setSelectedProductId(prod.id)}
                      className={`whitespace-nowrap px-3 py-2 rounded-lg text-[12px] font-bold border flex items-center gap-2 ${selectedProductId === prod.id ? 'bg-primary text-white border-primary shadow-sm' : 'bg-card text-secondary border-border'}`}
                    >
                      <Package size={14} />
                      {prod.name}
                    </button>
                  ))}
                  <Link to="/inventory" className="whitespace-nowrap px-3 py-2 rounded-lg text-[12px] font-bold text-accent bg-accent/5 border border-dashed border-accent/20 flex items-center gap-1">
                    <Plus size={14} /> {t('new')}
                  </Link>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-secondary mb-1 uppercase tracking-wide">{t('linkPartner')}</label>
                <select className="w-full bg-card text-[14px] text-primary py-3 px-4 rounded-[12px] border border-border" onChange={e => setNote(prev => prev.includes('Partner:') ? prev : `${prev ? prev + ' • ' : ''}Partner: ${e.target.value}`)}>
                  <option value="">{t('selectPartner')}</option>
                  {partners.map(p => <option key={p.id} value={p.name}>{p.name} ({p.type})</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-secondary mb-1 uppercase tracking-wide">{t('note')}</label>
                <input type="text" value={note} onChange={e => setNote(e.target.value)} className="w-full bg-card text-[14px] text-primary py-3 px-4 rounded-[12px] border border-border" placeholder="..." />
              </div>
            </div>
          )}
        </div>

        {/* Custom Numeric Keypad */}
        <div className="mt-auto grid grid-cols-3 gap-2 mb-4">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(key => (
            <button key={key} onClick={() => handleKeypad(key)} className="bg-card text-primary text-[28px] font-medium py-4 rounded-[16px] shadow-sm active:scale-95 active:bg-border transition-all">
              {key}
            </button>
          ))}
          <button onClick={() => handleKeypad('.')} className="bg-card text-primary text-[28px] font-medium py-4 rounded-[16px] shadow-sm active:scale-95 active:bg-border transition-all">.</button>
          <button onClick={() => handleKeypad('0')} className="bg-card text-primary text-[28px] font-medium py-4 rounded-[16px] shadow-sm active:scale-95 active:bg-border transition-all">0</button>
          <button onClick={() => handleKeypad('back')} className="bg-card text-secondary flex items-center justify-center py-4 rounded-[16px] shadow-sm active:scale-95 active:bg-border transition-all">
            <Delete size={28} />
          </button>
        </div>

        <button 
          onClick={handleSave}
          disabled={!amount || isNaN(Number(amount))}
          className="w-full bg-accent text-white font-bold text-[18px] py-4 rounded-[20px] shadow-[0_8px_20px_rgba(46,125,50,0.3)] disabled:opacity-50 disabled:shadow-none active:scale-95 transition-all flex items-center justify-center gap-2"
        >
          {t('saveTransaction')}
        </button>
      </div>

      {showNewCatModal && (
        <div className="absolute inset-0 bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-5 z-50">
          <div className="bg-bg w-full max-w-sm rounded-[24px] rounded-b-none sm:rounded-b-[24px] p-6 shadow-xl animate-in slide-in-from-bottom-5 sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-200 h-[80vh] sm:h-auto overflow-y-auto">
            <h3 className="text-lg font-bold mb-4">{t('newCategory')}</h3>
            
            <div className="space-y-4 mb-6">
                <div>
                    <label className="block text-[12px] font-bold text-secondary mb-2 uppercase">{t('type')}</label>
                    <div className="flex bg-border/50 p-1 rounded-[12px]">
                        {['expense', 'income', 'both'].map(tType => (
                        <button 
                            key={tType}
                            className={`flex-1 py-1.5 text-[12px] font-semibold rounded-[8px] capitalize transition-colors ${newCatType === tType ? 'bg-card text-primary shadow-sm' : 'text-secondary'}`}
                            onClick={() => setNewCatType(tType as any)}
                        >
                            {t(tType as keyof typeof translations.English)}
                        </button>
                        ))}
                    </div>
                </div>

                <div>
                    <label className="block text-[12px] font-bold text-secondary mb-2 uppercase">{t('name')}</label>
                    <input autoFocus type="text" value={newCatName} onChange={e => setNewCatName(e.target.value)} className="w-full bg-card p-3 rounded-xl border border-border" placeholder="..." />
                </div>

                <div>
                    <label className="block text-[12px] font-bold text-secondary mb-2 uppercase">{t('icon')}</label>
                    <div className="flex flex-wrap gap-2">
                        {EMOJIS.map(e => (
                        <button 
                            key={e} 
                            onClick={() => setNewCatIcon(e)}
                            className={`text-[20px] p-2 rounded-[8px] transition-colors ${newCatIcon === e ? 'bg-border' : 'hover:bg-bg border border-transparent'}`}
                        >
                            {e}
                        </button>
                        ))}
                    </div>
                </div>

                <div>
                    <label className="block text-[12px] font-bold text-secondary mb-2 uppercase">{t('color')}</label>
                    <div className="flex flex-wrap gap-3">
                        {COLORS.map(c => (
                        <button 
                            key={c} 
                            onClick={() => setNewCatColor(c)}
                            className={`w-8 h-8 rounded-full border-2 transition-transform ${newCatColor === c ? 'scale-110 border-primary' : 'border-transparent'}`}
                            style={{ backgroundColor: c }}
                        />
                        ))}
                    </div>
                </div>
            </div>

            <div className="flex gap-3">
              <button onClick={() => setShowNewCatModal(false)} className="flex-1 bg-border text-primary font-bold py-3 rounded-xl text-[14px]">{t('cancel')}</button>
              <button onClick={handleCreateCategory} disabled={!newCatName} className="flex-1 bg-accent text-white font-bold py-3 rounded-xl disabled:opacity-50 text-[14px]">{t('create')}</button>
            </div>
          </div>
        </div>
      )}

      {showPinModal && (
        <div className="absolute inset-0 bg-black/60 flex items-center justify-center p-5 z-50">
          <div className="bg-bg w-full max-w-sm rounded-[24px] p-6 shadow-xl animate-in zoom-in-95 duration-200">
            <h3 className="text-lg font-bold mb-2">{t('staffAuthorization')}</h3>
            <p className="text-[13px] text-secondary mb-6">{t('enterPinMessage')}</p>
            <div className="mb-6">
              <input type="password" placeholder="PIN" maxLength={4} value={pinEntry} onChange={e => setPinEntry(e.target.value.replace(/\D/g, ''))} className="w-full bg-card p-4 rounded-xl border border-border text-center text-2xl tracking-[0.5em] font-bold" />
            </div>
            <div className="flex gap-3">
              <button onClick={() => {setShowPinModal(false); setPinEntry('');}} className="flex-1 bg-border text-primary font-bold py-3 rounded-xl">{t('cancel')}</button>
              <button onClick={handleVerifyPin} disabled={pinEntry.length !== 4} className="flex-1 bg-accent text-white font-bold py-3 rounded-xl disabled:opacity-50">{t('verify')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
