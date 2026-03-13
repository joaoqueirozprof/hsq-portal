import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/auth';
import api from '@/api/client';

const steps = [
  {
    icon: '👋',
    title: 'Bem-vindo ao HSQ Rastreamento!',
    desc: 'Estamos felizes em ter voce conosco. Vamos conhecer as funcionalidades do portal.',
  },
  {
    icon: '📍',
    title: 'Rastreamento em Tempo Real',
    desc: 'Acompanhe seus veiculos no mapa com atualizacoes em tempo real, historico de rotas e alertas.',
  },
  {
    icon: '🚀',
    title: 'Tudo Pronto!',
    desc: 'Voce ja pode comecar a usar o portal. Clique em "Concluir" para acessar o painel.',
  },
];

export default function OnboardingPage() {
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const navigate = useNavigate();
  const { updateUser } = useAuthStore();

  async function complete() {
    setLoading(true);
    try {
      await api.post('/auth/complete-onboarding');
      updateUser({ onboardingCompleted: true, isFirstLogin: false });
      setShowSuccess(true);
      setTimeout(() => navigate('/dashboard'), 2500);
    } catch {
      navigate('/dashboard');
    }
  }

  if (showSuccess) {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
      }}>
        <div style={{
          width: 80, height: 80, borderRadius: '50%',
          background: 'rgba(34,197,94,0.15)', border: '2px solid rgba(34,197,94,0.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 36, animation: 'successPop 0.4s ease-out',
        }}>✓</div>
        <h2 style={{ color: 'var(--text-primary)', fontSize: 22, marginTop: 20 }}>Configuracao Concluida!</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: 14, marginTop: 8 }}>Redirecionando para o painel...</p>
        <style>{`@keyframes successPop { 0% { transform: scale(0.5); opacity: 0; } 70% { transform: scale(1.1); } 100% { transform: scale(1); opacity: 1; } }`}</style>
      </div>
    );
  }

  const current = steps[step];
  const isLast = step === steps.length - 1;

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
    }}>
      <div className="card" style={{ maxWidth: 480, width: '100%', padding: '48px 36px', textAlign: 'center' }}>
        <div style={{
          width: 80, height: 80, borderRadius: '50%', margin: '0 auto 24px',
          background: 'rgba(65, 131, 239, 0.15)', border: '2px solid rgba(65, 131, 239, 0.3)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 36,
        }}>{current.icon}</div>

        <h2 style={{ color: 'var(--text-primary)', fontSize: 22, marginBottom: 12 }}>{current.title}</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: 14, lineHeight: 1.6, marginBottom: 36 }}>{current.desc}</p>

        <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
          {step > 0 && (
            <button className="btn btn-secondary" onClick={() => setStep(step - 1)}>
              Voltar
            </button>
          )}
          {isLast ? (
            <button className="btn btn-primary" onClick={complete} disabled={loading} style={{ minWidth: 140 }}>
              {loading ? <><span className="spinner" /> Concluindo...</> : 'Concluir'}
            </button>
          ) : (
            <button className="btn btn-primary" onClick={() => setStep(step + 1)} style={{ minWidth: 140 }}>
              Proximo
            </button>
          )}
        </div>

        {/* Step dots */}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 32 }}>
          {steps.map((_, i) => (
            <div key={i} style={{
              width: 8, height: 8, borderRadius: '50%',
              background: i === step ? 'var(--accent-blue)' : 'var(--border)',
              transition: 'background 0.3s',
            }} />
          ))}
        </div>
      </div>
    </div>
  );
}
