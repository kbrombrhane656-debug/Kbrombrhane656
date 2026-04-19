import { useState } from 'react';
import { loginWithGoogle } from '../../firebase';
import { Wallet, Loader2 } from 'lucide-react';
import { useTranslation } from '../../i18n';
import { useAppStore } from '../../data/store';

export const LoginScreen = () => {
  const { language } = useAppStore();
  const t = useTranslation(language);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async () => {
    setIsLoading(true);
    setError(null);
    try {
      await loginWithGoogle();
    } catch (err: any) {
      console.error('Login error:', err);
      setError(err.message || 'Failed to sign in. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-bg p-5">
      <div className="bg-card p-8 rounded-[24px] border border-border w-full max-w-md text-center shadow-sm animate-in fade-in zoom-in duration-300">
        <div className="bg-[#ECFDF3] text-accent p-4 rounded-full inline-block mb-6 border border-[#ABEFC6] shadow-sm">
          <Wallet size={40} />
        </div>
        <h1 className="text-[28px] font-black text-primary mb-2 tracking-tight">GabeyaTrack</h1>
        <p className="text-[15px] text-secondary mb-8 leading-relaxed">
          {t('gabeyaTrackDescription')}
        </p>
        
        {error && (
          <div className="mb-6 p-3 bg-red-50 border border-red-100 rounded-xl text-red-600 text-[13px] font-medium">
            {error}
          </div>
        )}

        <button 
          onClick={handleLogin}
          disabled={isLoading}
          className="w-full bg-primary text-white font-bold py-4 rounded-[16px] hover:bg-primary/95 active:scale-[0.98] transition-all text-[15px] flex items-center justify-center gap-2 shadow-lg shadow-primary/10 disabled:opacity-70"
        >
          {isLoading ? (
            <Loader2 className="animate-spin" size={20} />
          ) : (
            <>
              <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-5 h-5 mr-1" referrerPolicy="no-referrer" />
              {t('continueWithGoogle')}
            </>
          )}
        </button>
        
        <p className="mt-8 text-[12px] text-secondary opacity-60">
          Secure sign in powered by Google
        </p>
      </div>
    </div>
  );
};
