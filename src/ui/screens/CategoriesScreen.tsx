import { useState } from 'react';
import { useAppStore } from '../../data/store';
import { saveCategory, removeCategory } from '../../services/dbService';
import { Trash2, Edit2, Plus, X } from 'lucide-react';
import { useTranslation, translations } from '../../i18n';

const COLORS = ['#F04438', '#12B76A', '#2E90FA', '#F79009', '#875BF7', '#667085'];
const EMOJIS = ['💰', '🛒', '🚗', '🏠', '🍔', '📦', '📱', '🔧', '🎓', '🏥', '🎉', '💡'];

export const CategoriesScreen = () => {
  const { categories, user, language } = useAppStore();
  const t = useTranslation(language);
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  const [name, setName] = useState('');
  const [type, setType] = useState<'income' | 'expense' | 'both'>('expense');
  const [icon, setIcon] = useState(EMOJIS[0]);
  const [color, setColor] = useState(COLORS[0]);

  const resetForm = () => {
    setName('');
    setType('expense');
    setIcon(EMOJIS[0]);
    setColor(COLORS[0]);
    setIsAdding(false);
    setEditingId(null);
  };

  const handleEdit = (cat: any) => {
    setName(cat.name);
    setType(cat.type);
    setIcon(cat.icon || EMOJIS[0]);
    setColor(cat.color || COLORS[0]);
    setEditingId(cat.id);
    setIsAdding(true);
  };

  const handleSave = async () => {
    if (!name.trim() || !user) return;

    await saveCategory({
      userId: user.uid,
      name: name.trim(),
      type,
      icon,
      color,
      createdAt: new Date().toISOString(),
    }, editingId || undefined);

    resetForm();
  };

  return (
    <div className="p-5 flex flex-col h-full bg-bg pb-24 overflow-y-auto">
      <div className="flex justify-between items-center mb-6 mt-2">
        <h2 className="text-[18px] font-bold text-primary">{t('categories')}</h2>
        {!isAdding && (
          <button 
            onClick={() => setIsAdding(true)}
            className="bg-accent text-white p-2 rounded-full shadow-sm hover:opacity-90 transition-opacity"
          >
            <Plus size={20} />
          </button>
        )}
      </div>

      {isAdding ? (
        <div className="bg-card p-5 rounded-[16px] border border-border shadow-sm mb-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-[14px]">{editingId ? t('editCategory') : t('newCategory')}</h3>
            <button onClick={resetForm} className="text-secondary hover:text-primary"><X size={20} /></button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-[10px] font-bold text-secondary mb-2 uppercase">{t('type')}</label>
              <div className="flex bg-border/50 p-1 rounded-[12px]">
                {['expense', 'income', 'both'].map(tType => (
                  <button 
                    key={tType}
                    className={`flex-1 py-1.5 text-[12px] font-semibold rounded-[8px] capitalize transition-colors ${type === tType ? 'bg-card text-primary shadow-sm' : 'text-secondary'}`}
                    onClick={() => setType(tType as any)}
                  >
                    {t(tType as keyof typeof translations.English)}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-secondary mb-2 uppercase">{t('name')}</label>
              <input 
                type="text" 
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-bg text-[14px] text-primary py-2 px-3 rounded-[8px] border border-border focus:outline-none focus:border-accent"
                placeholder="..."
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-secondary mb-2 uppercase">{t('icon')}</label>
              <div className="flex flex-wrap gap-2">
                {EMOJIS.map(e => (
                  <button 
                    key={e} 
                    onClick={() => setIcon(e)}
                    className={`text-[20px] p-2 rounded-[8px] transition-colors ${icon === e ? 'bg-border' : 'hover:bg-bg'}`}
                  >
                    {e}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-secondary mb-2 uppercase">{t('color')}</label>
              <div className="flex flex-wrap gap-2">
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

            <button 
              onClick={handleSave}
              disabled={!name.trim()}
              className="w-full bg-primary text-white font-semibold py-3 rounded-[12px] hover:opacity-90 transition-opacity mt-2 text-[13px]"
            >
              {t('saveCategory')}
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {categories.length === 0 && (
            <div className="text-center text-secondary py-10 text-[13px] bg-card rounded-[12px] border border-border">
              {t('noCategoriesLabel')}
            </div>
          )}
          {categories.map(cat => (
            <div key={cat.id} className="bg-card p-3 rounded-[12px] border border-border flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div 
                  className="w-10 h-10 rounded-full flex items-center justify-center text-[18px]"
                  style={{ backgroundColor: `${cat.color}20`, color: cat.color }}
                >
                  {cat.icon || '📁'}
                </div>
                <div>
                  <h6 className="text-[14px] font-semibold text-primary">{cat.name}</h6>
                  <span className="text-[11px] text-secondary capitalize">{t(cat.type as any)}</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => handleEdit(cat)} className="text-secondary hover:text-primary p-2">
                  <Edit2 size={16} />
                </button>
                <button onClick={() => removeCategory(cat.id)} className="text-secondary hover:text-expense p-2">
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
