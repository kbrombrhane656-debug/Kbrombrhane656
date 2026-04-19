import { useState } from 'react';
import { useAppStore } from '../../data/store';
import { saveProduct, saveStockMovement } from '../../services/dbService';
import { Plus, Minus, Edit2, Package, History } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useTranslation } from '../../i18n';

export const InventoryScreen = () => {
  const { products, user, language } = useAppStore();
  const t = useTranslation(language);
  const [isAdding, setIsAdding] = useState(false);
  
  // Product state
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [cost, setCost] = useState('');
  const [stock, setStock] = useState('0');
  const [category, setCategory] = useState('');
  const [warehouseLocation, setWarehouseLocation] = useState('');
  const [lowStockThreshold, setLowStockThreshold] = useState('5');

  // Movement state
  const [activeProductId, setActiveProductId] = useState<string | null>(null);
  const [movementType, setMovementType] = useState<'IN' | 'OUT' | 'ADJUST'>('IN');
  const [movementQty, setMovementQty] = useState('');

  const handleSaveProduct = async () => {
    if (!name || isNaN(Number(price)) || !user) return;
    
    await saveProduct({
      userId: user.uid,
      name,
      category,
      warehouseLocation,
      lowStockThreshold: Number(lowStockThreshold) || 5,
      price: Number(price),
      cost: Number(cost) || 0,
      stock: Number(stock) || 0,
      createdAt: new Date().toISOString()
    });

    setIsAdding(false);
    setName(''); setPrice(''); setCost(''); setStock('0'); setCategory(''); setWarehouseLocation(''); setLowStockThreshold('5');
  };

  const handleMovement = async (productId: string, currentStock: number) => {
    if (!movementQty || isNaN(Number(movementQty)) || !user) return;
    const qty = Number(movementQty);
    
    let newStock = currentStock;
    if (movementType === 'IN') newStock = currentStock + qty;
    else if (movementType === 'OUT') newStock = currentStock - qty;
    else if (movementType === 'ADJUST') newStock = qty; // For ADJUST, qty is the absolute new stock value entirely

    if (newStock < 0) return alert(t('notEnoughStock'));

    const logQty = movementType === 'ADJUST' ? Math.abs(newStock - currentStock) : qty;
    const computedMovementType = movementType === 'ADJUST' ? (newStock >= currentStock ? 'IN' : 'OUT') : movementType;

    // Update Product
    await saveProduct({
      ...products.find(p => p.id === productId)!,
      stock: newStock
    }, productId);

    // Record movement
    await saveStockMovement({
      userId: user.uid,
      productId,
      type: movementType === 'ADJUST' ? 'ADJUST' : computedMovementType,
      quantity: logQty,
      date: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      reason: movementType === 'ADJUST' ? `Stock correction from ${currentStock} to ${newStock}` : ''
    });

    setActiveProductId(null);
    setMovementQty('');
  };

  return (
    <div className="p-5 flex flex-col h-full bg-bg pb-20 overflow-y-auto">
      <div className="flex justify-between items-center mb-6 mt-2">
        <h2 className="text-[18px] font-bold text-primary">{t('inventory')}</h2>
        <div className="flex gap-2">
           <Link to="/inventory/history" className="bg-card text-secondary border border-border p-2 rounded-full shadow-sm flex items-center justify-center">
             <History size={20} />
           </Link>
          <button 
            onClick={() => setIsAdding(!isAdding)}
            className="bg-accent text-white p-2 rounded-full shadow-sm"
          >
            {isAdding ? <Minus size={20} /> : <Plus size={20} />}
          </button>
        </div>
      </div>

      {isAdding && (
        <div className="bg-card p-5 rounded-[16px] border border-border shadow-sm mb-6 space-y-4">
          <input type="text" placeholder={t('productName')} className="w-full bg-bg p-3 rounded-lg border border-border text-[14px]" value={name} onChange={e => setName(e.target.value)} />
          <div className="flex gap-3">
             <input type="text" placeholder="Item Category (e.g. Electronics)" className="flex-1 bg-bg p-3 rounded-lg border border-border text-[14px]" value={category} onChange={e => setCategory(e.target.value)} />
             <input type="text" placeholder="Warehouse Location (e.g. Aisle 4)" className="flex-1 bg-bg p-3 rounded-lg border border-border text-[14px]" value={warehouseLocation} onChange={e => setWarehouseLocation(e.target.value)} />
          </div>
          <div className="flex gap-3">
            <input type="number" placeholder={t('sellPrice')} className="flex-1 bg-bg p-3 rounded-lg border border-border text-[14px]" value={price} onChange={e => setPrice(e.target.value)} />
            <input type="number" placeholder={t('costPrice')} className="flex-1 bg-bg p-3 rounded-lg border border-border text-[14px]" value={cost} onChange={e => setCost(e.target.value)} />
          </div>
          <div className="flex gap-3">
            <input type="number" placeholder={t('initialStock')} className="flex-1 bg-bg p-3 rounded-lg border border-border text-[14px]" value={stock} onChange={e => setStock(e.target.value)} />
            <input type="number" placeholder="Low Stock Threshold" className="flex-1 bg-bg p-3 rounded-lg border border-border text-[14px]" value={lowStockThreshold} onChange={e => setLowStockThreshold(e.target.value)} />
          </div>
          <button onClick={handleSaveProduct} className="w-full bg-primary text-white py-3 rounded-lg font-bold">{t('addProduct')}</button>
        </div>
      )}

      <div className="space-y-3">
        {products.length === 0 && !isAdding && (
          <div className="text-center py-10 text-secondary bg-card rounded-xl border border-border">
            <Package size={32} className="mx-auto mb-2 opacity-50" />
            <p>{t('noProducts')}</p>
          </div>
        )}
        
        {products.map(p => (
          <div key={p.id} className="bg-card p-4 rounded-[12px] border border-border shadow-sm">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="font-bold text-primary flex items-center gap-2">
                  {p.name}
                  {(p.warehouseLocation || p.category) && (
                    <span className="bg-accent/10 text-accent text-[9px] px-2 py-0.5 rounded-full uppercase font-bold">
                       {p.category || 'Item'} {p.warehouseLocation ? `• ${p.warehouseLocation}` : ''}
                    </span>
                  )}
                </h3>
                <p className="text-[12px] text-secondary mt-1">{t('price')}: {p.price.toLocaleString()} ETB {p.cost > 0 && `| ${t('cost')}: ${p.cost.toLocaleString()} ETB`}</p>
              </div>
              <div className="text-right flex flex-col items-end">
                <span className={`font-black text-[22px] ${(p.stock <= (p.lowStockThreshold || 5)) ? 'text-expense' : 'text-primary'}`}>{p.stock}</span>
                <p className="text-[9px] text-secondary font-bold uppercase tracking-widest">{t('inStock')}</p>
              </div>
            </div>

            {activeProductId === p.id ? (
              <div className="mt-4 flex gap-2 pt-4 border-t border-border">
                <select className="bg-bg border border-border rounded-lg px-2 text-[13px]" value={movementType} onChange={e => setMovementType(e.target.value as 'IN'|'OUT'|'ADJUST')}>
                  <option value="IN">+ {t('add')}</option>
                  <option value="OUT">- {t('remove')}</option>
                  <option value="ADJUST">! {t('adjust')}</option>
                </select>
                <input type="number" placeholder={movementType === 'ADJUST' ? t('totalAmount') : t('qty')} className="w-20 bg-bg border border-border rounded-lg px-2 text-[13px]" value={movementQty} onChange={e => setMovementQty(e.target.value)} />
                <button onClick={() => handleMovement(p.id, p.stock)} className="bg-accent text-white px-4 rounded-lg text-[13px] font-bold">{t('save')}</button>
                <button onClick={() => setActiveProductId(null)} className="text-secondary px-2">{t('cancel')}</button>
              </div>
            ) : (
              <button onClick={() => setActiveProductId(p.id)} className="mt-3 text-[12px] font-bold text-accent bg-accent/10 px-3 py-1.5 rounded-md">{t('updateStock')}</button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
