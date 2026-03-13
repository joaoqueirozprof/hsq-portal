import { useState, useRef, useEffect, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/auth';
import { useToastStore } from '@/store/toast';
import api from '@/api/client';
import { maskDocument, cleanDocument } from '@/utils/masks';

interface LoginPageProps {
  adminMode?: boolean;
}

export default function LoginPage({ adminMode = false }: LoginPageProps) {
  const [tab, setTab] = useState<'client' | 'admin'>(adminMode ? 'admin' : 'client');
  const [document, setDocument] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotStep, setForgotStep] = useState(1);
  const [forgotDoc, setForgotDoc] = useState('');
  const [forgotCode, setForgotCode] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotMsg, setForgotMsg] = useState('');
  const [forgotError, setForgotError] = useState('');
  const [forgotEmail, setForgotEmail] = useState('');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const navigate = useNavigate();
  const login = useAuthStore((s) => s.login);
  const toast = useToastStore((s) => s.show);

  // Animated background
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let animId: number;
    const particles: Array<{ x: number; y: number; vx: number; vy: number; size: number; alpha: number }> = [];

    function resize() {
      canvas!.width = window.innerWidth;
      canvas!.height = window.innerHeight;
    }
    resize();
    window.addEventListener('resize', resize);

    for (let i = 0; i < 50; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.5,
        vy: (Math.random() - 0.5) * 0.5,
        size: Math.random() * 2 + 1,
        alpha: Math.random() * 0.3 + 0.1,
      });
    }

    function draw() {
      ctx!.clearRect(0, 0, canvas!.width, canvas!.height);
      particles.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0) p.x = canvas!.width;
        if (p.x > canvas!.width) p.x = 0;
        if (p.y < 0) p.y = canvas!.height;
        if (p.y > canvas!.height) p.y = 0;
        ctx!.beginPath();
        ctx!.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx!.fillStyle = `rgba(65, 131, 239, ${p.alpha})`;
        ctx!.fill();
      });
      // Draw connections
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 150) {
            ctx!.beginPath();
            ctx!.moveTo(particles[i].x, particles[i].y);
            ctx!.lineTo(particles[j].x, particles[j].y);
            ctx!.strokeStyle = `rgba(65, 131, 239, ${0.1 * (1 - dist / 150)})`;
            ctx!.stroke();
          }
        }
      }
      animId = requestAnimationFrame(draw);
    }
    draw();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
    };
  }, []);

  async function handleClientLogin(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data } = await api.post('/auth/login', {
        document: cleanDocument(document),
        password,
      });
      login(data.token, data.user, data.traccarEmail);
      navigate('/');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erro ao fazer login');
    } finally {
      setLoading(false);
    }
  }

  async function handleAdminLogin(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data } = await api.post('/auth/admin/login', { email, password });
      login(data.token, { ...data.user, role: 'admin' });
      navigate('/admin');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Credenciais invalidas');
    } finally {
      setLoading(false);
    }
  }

  async function handleForgotStep1(e: FormEvent) {
    e.preventDefault();
    setForgotError('');
    setForgotMsg('');
    setForgotLoading(true);
    try {
      const { data } = await api.post('/auth/forgot-password', {
        document: cleanDocument(forgotDoc),
      });
      if (data.mode === 'code') {
        setForgotStep(2);
        setForgotEmail(data.email || '');
        setForgotMsg(data.message);
      } else {
        setForgotMsg(data.message);
      }
    } catch (err: any) {
      setForgotError(err.response?.data?.error || 'Erro ao processar');
    } finally {
      setForgotLoading(false);
    }
  }

  async function handleForgotStep2(e: FormEvent) {
    e.preventDefault();
    setForgotError('');
    setForgotLoading(true);
    try {
      const { data } = await api.post('/auth/verify-reset-code', {
        document: cleanDocument(forgotDoc),
        code: forgotCode,
      });
      toast(data.message, 'success');
      setForgotOpen(false);
      setForgotStep(1);
      setForgotDoc('');
      setForgotCode('');
    } catch (err: any) {
      setForgotError(err.response?.data?.error || 'Codigo invalido');
    } finally {
      setForgotLoading(false);
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden' }}>
      <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, zIndex: 0 }} />

      <div style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: 440, padding: 20 }}>
        <div className="card" style={{ padding: '40px 32px' }}>
          {/* Logo */}
          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            <img src="/logo-login.png" alt="HSQ" style={{ width: 72, height: 72, borderRadius: 12, marginBottom: 12 }} />
            <h1 style={{ color: 'var(--text-primary)', fontSize: 22, marginBottom: 4 }}>HSQ Rastreamento</h1>
            <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>
              {tab === 'admin' ? 'Painel Administrativo' : 'Portal do Cliente'}
            </p>
          </div>

          {/* Tabs */}
          <div className="tabs">
            <button className={`tab ${tab === 'client' ? 'active' : ''}`} onClick={() => { setTab('client'); setError(''); }}>
              Cliente
            </button>
            <button className={`tab ${tab === 'admin' ? 'active' : ''}`} onClick={() => { setTab('admin'); setError(''); }}>
              Admin
            </button>
          </div>

          {error && <div className="error-msg">{error}</div>}

          {/* Client login form */}
          {tab === 'client' && (
            <form onSubmit={handleClientLogin}>
              <div className="form-group">
                <label>CPF ou CNPJ</label>
                <input
                  className="form-input"
                  type="text"
                  placeholder="000.000.000-00"
                  value={document}
                  onChange={(e) => {
                    const raw = e.target.value.replace(/\D/g, '');
                    setDocument(raw.length <= 11 ? maskDocument(raw, 'CPF') : maskDocument(raw, 'CNPJ'));
                  }}
                  required
                  autoFocus
                />
              </div>
              <div className="form-group">
                <label>Senha</label>
                <div style={{ position: 'relative' }}>
                  <input
                    className="form-input"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Sua senha"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    style={{ paddingRight: 44 }}
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} style={{
                    position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', fontSize: 18,
                  }}>
                    {showPassword ? '🔒' : '👁'}
                  </button>
                </div>
              </div>
              <button className="btn btn-primary btn-block" type="submit" disabled={loading} style={{ padding: 14, fontSize: 15 }}>
                {loading ? <><span className="spinner" /> Entrando...</> : 'Entrar'}
              </button>
              <div style={{ textAlign: 'center', marginTop: 16 }}>
                <button type="button" onClick={() => { setForgotOpen(true); setForgotDoc(document); }} style={{
                  background: 'none', border: 'none', color: 'var(--accent-blue)', cursor: 'pointer', fontSize: 13,
                }}>
                  Esqueci minha senha
                </button>
              </div>
            </form>
          )}

          {/* Admin login form */}
          {tab === 'admin' && (
            <form onSubmit={handleAdminLogin}>
              <div className="form-group">
                <label>Email</label>
                <input
                  className="form-input"
                  type="email"
                  placeholder="admin@hsqrastreamento.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoFocus
                />
              </div>
              <div className="form-group">
                <label>Senha</label>
                <input
                  className="form-input"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Sua senha"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              <button className="btn btn-admin btn-block" type="submit" disabled={loading} style={{ padding: 14, fontSize: 15 }}>
                {loading ? <><span className="spinner" /> Entrando...</> : 'Entrar'}
              </button>
            </form>
          )}
        </div>
      </div>

      {/* Forgot Password Modal */}
      {forgotOpen && (
        <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setForgotOpen(false); }}>
          <div className="modal-content" style={{ maxWidth: 440 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <h2 className="modal-title" style={{ margin: 0 }}>
                {forgotStep === 1 ? 'Recuperar Senha' : 'Verificar Codigo'}
              </h2>
              <button onClick={() => { setForgotOpen(false); setForgotStep(1); setForgotError(''); setForgotMsg(''); }} style={{
                background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', fontSize: 22,
              }}>&times;</button>
            </div>

            {forgotError && <div className="error-msg">{forgotError}</div>}
            {forgotMsg && !forgotError && <div className="success-msg">{forgotMsg}</div>}

            {forgotStep === 1 && (
              <form onSubmit={handleForgotStep1}>
                <div className="form-group">
                  <label>CPF ou CNPJ cadastrado</label>
                  <input
                    className="form-input"
                    value={forgotDoc}
                    onChange={(e) => {
                      const raw = e.target.value.replace(/\D/g, '');
                      setForgotDoc(raw.length <= 11 ? maskDocument(raw, 'CPF') : maskDocument(raw, 'CNPJ'));
                    }}
                    placeholder="000.000.000-00"
                    required
                  />
                </div>
                <button className="btn btn-primary btn-block" type="submit" disabled={forgotLoading}>
                  {forgotLoading ? <><span className="spinner" /> Processando...</> : 'Enviar Codigo'}
                </button>
              </form>
            )}

            {forgotStep === 2 && (
              <form onSubmit={handleForgotStep2}>
                <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 20 }}>
                  Codigo enviado para {forgotEmail}
                </p>
                <div className="form-group">
                  <label>Codigo de 6 digitos</label>
                  <input
                    className="form-input"
                    value={forgotCode}
                    onChange={(e) => setForgotCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="000000"
                    maxLength={6}
                    required
                    style={{ textAlign: 'center', fontSize: 24, letterSpacing: 8 }}
                  />
                </div>
                <button className="btn btn-primary btn-block" type="submit" disabled={forgotLoading}>
                  {forgotLoading ? <><span className="spinner" /> Verificando...</> : 'Verificar e Resetar'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
