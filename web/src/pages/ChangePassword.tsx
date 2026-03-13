import { useState, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/auth';
import { useToastStore } from '@/store/toast';
import api from '@/api/client';

export default function ChangePasswordPage() {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const { user, updateUser } = useAuthStore();
  const toast = useToastStore((s) => s.show);

  const strength = (() => {
    if (password.length === 0) return { level: 0, label: '', color: '' };
    if (password.length < 6) return { level: 1, label: 'Muito fraca', color: '#ef4444' };
    if (password.length < 8) return { level: 2, label: 'Fraca', color: '#f97316' };
    const hasUpper = /[A-Z]/.test(password);
    const hasNumber = /\d/.test(password);
    const hasSpecial = /[^A-Za-z0-9]/.test(password);
    const score = [hasUpper, hasNumber, hasSpecial].filter(Boolean).length;
    if (score >= 2 && password.length >= 10) return { level: 4, label: 'Forte', color: '#22c55e' };
    if (score >= 1) return { level: 3, label: 'Media', color: '#fbbf24' };
    return { level: 2, label: 'Fraca', color: '#f97316' };
  })();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (password.length < 6) {
      setError('A senha deve ter no minimo 6 caracteres');
      return;
    }
    if (password !== confirm) {
      setError('As senhas nao coincidem');
      return;
    }
    setLoading(true);
    try {
      await api.post('/auth/change-password', { newPassword: password });
      updateUser({ mustChangePassword: false, isFirstLogin: false });
      toast('Senha alterada com sucesso!', 'success');
      navigate('/');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erro ao alterar senha');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div className="card" style={{ maxWidth: 440, width: '100%', padding: '40px 32px' }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{
            width: 64, height: 64, borderRadius: '50%', margin: '0 auto 16px',
            background: 'rgba(65, 131, 239, 0.15)', border: '2px solid rgba(65, 131, 239, 0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28,
          }}>🔐</div>
          <h1 style={{ color: 'var(--text-primary)', fontSize: 22, marginBottom: 4 }}>Criar Nova Senha</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>
            Ola, {user?.name}! Crie uma senha segura para sua conta.
          </p>
        </div>

        {error && <div className="error-msg">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Nova senha</label>
            <input
              className="form-input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Minimo 6 caracteres"
              required
              autoFocus
            />
            {password.length > 0 && (
              <div style={{ marginTop: 8 }}>
                <div style={{
                  height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.1)',
                  overflow: 'hidden',
                }}>
                  <div style={{
                    height: '100%', borderRadius: 2, transition: 'all 0.3s',
                    width: `${strength.level * 25}%`,
                    background: strength.color,
                  }} />
                </div>
                <div style={{ fontSize: 12, color: strength.color, marginTop: 4 }}>
                  {strength.label}
                </div>
              </div>
            )}
          </div>
          <div className="form-group">
            <label>Confirmar nova senha</label>
            <input
              className="form-input"
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Repita a senha"
              required
            />
          </div>
          <button className="btn btn-primary btn-block" type="submit" disabled={loading} style={{ padding: 14 }}>
            {loading ? <><span className="spinner" /> Alterando...</> : 'Alterar Senha'}
          </button>
        </form>
      </div>
    </div>
  );
}
