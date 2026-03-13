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

  // Full animated city background with roads, vehicles, GPS pins, city blocks
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let animId: number;
    let W = 0, H = 0;

    // Roads (horizontal and vertical lines)
    interface Road { x1: number; y1: number; x2: number; y2: number; }
    let roads: Road[] = [];

    // Moving vehicles on roads
    interface Vehicle { x: number; y: number; speed: number; road: number; progress: number; color: string; size: number; }
    let vehicles: Vehicle[] = [];

    // GPS pin markers that pulse
    interface GpsPin { x: number; y: number; pulse: number; pulseDir: number; color: string; }
    let pins: GpsPin[] = [];

    // City blocks (darker rectangles)
    interface Block { x: number; y: number; w: number; h: number; alpha: number; }
    let blocks: Block[] = [];

    // Floating particles (network dots)
    interface Particle { x: number; y: number; vx: number; vy: number; size: number; alpha: number; }
    let particles: Particle[] = [];

    function initScene() {
      W = canvas!.width;
      H = canvas!.height;
      roads = [];
      vehicles = [];
      pins = [];
      blocks = [];
      particles = [];

      // Create grid of roads
      const gridSpacing = 120;
      // Horizontal roads
      for (let y = gridSpacing; y < H; y += gridSpacing) {
        roads.push({ x1: 0, y1: y, x2: W, y2: y });
      }
      // Vertical roads
      for (let x = gridSpacing; x < W; x += gridSpacing) {
        roads.push({ x1: x, y1: 0, x2: x, y2: H });
      }

      // Create vehicles on random roads
      const vColors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];
      for (let i = 0; i < Math.min(roads.length, 20); i++) {
        const ri = Math.floor(Math.random() * roads.length);
        vehicles.push({
          x: 0, y: 0,
          speed: 0.2 + Math.random() * 0.8,
          road: ri,
          progress: Math.random(),
          color: vColors[Math.floor(Math.random() * vColors.length)],
          size: 3 + Math.random() * 3,
        });
      }

      // City blocks between roads
      const hRoads = roads.filter(r => r.y1 === r.y2).sort((a, b) => a.y1 - b.y1);
      const vRoads = roads.filter(r => r.x1 === r.x2).sort((a, b) => a.x1 - b.x1);
      for (let i = 0; i < hRoads.length - 1; i++) {
        for (let j = 0; j < vRoads.length - 1; j++) {
          if (Math.random() > 0.6) {
            blocks.push({
              x: vRoads[j].x1 + 8,
              y: hRoads[i].y1 + 8,
              w: (vRoads[j + 1].x1 - vRoads[j].x1) - 16,
              h: (hRoads[i + 1].y1 - hRoads[i].y1) - 16,
              alpha: 0.03 + Math.random() * 0.06,
            });
          }
        }
      }

      // GPS pins at road intersections
      const pinCount = Math.min(8, Math.floor(W * H / 80000));
      for (let i = 0; i < pinCount; i++) {
        const hR = hRoads[Math.floor(Math.random() * hRoads.length)];
        const vR = vRoads[Math.floor(Math.random() * vRoads.length)];
        if (hR && vR) {
          pins.push({
            x: vR.x1, y: hR.y1,
            pulse: Math.random() * Math.PI * 2,
            pulseDir: 0.03 + Math.random() * 0.02,
            color: Math.random() > 0.5 ? '#10b981' : '#ef4444',
          });
        }
      }

      // Floating network particles
      for (let i = 0; i < 30; i++) {
        particles.push({
          x: Math.random() * W,
          y: Math.random() * H,
          vx: (Math.random() - 0.5) * 0.4,
          vy: (Math.random() - 0.5) * 0.4,
          size: Math.random() * 1.5 + 0.5,
          alpha: Math.random() * 0.2 + 0.05,
        });
      }
    }

    function resize() {
      canvas!.width = window.innerWidth;
      canvas!.height = window.innerHeight;
      initScene();
    }
    resize();
    window.addEventListener('resize', resize);

    function draw() {
      ctx!.clearRect(0, 0, W, H);

      // Draw city blocks
      blocks.forEach(b => {
        ctx!.fillStyle = `rgba(65, 131, 239, ${b.alpha})`;
        ctx!.fillRect(b.x, b.y, b.w, b.h);
      });

      // Draw roads
      roads.forEach(r => {
        ctx!.beginPath();
        ctx!.moveTo(r.x1, r.y1);
        ctx!.lineTo(r.x2, r.y2);
        ctx!.strokeStyle = 'rgba(65, 131, 239, 0.08)';
        ctx!.lineWidth = 2;
        ctx!.stroke();
        // Center dashes
        ctx!.beginPath();
        ctx!.setLineDash([8, 12]);
        ctx!.moveTo(r.x1, r.y1);
        ctx!.lineTo(r.x2, r.y2);
        ctx!.strokeStyle = 'rgba(65, 131, 239, 0.04)';
        ctx!.lineWidth = 1;
        ctx!.stroke();
        ctx!.setLineDash([]);
      });

      // Move & draw vehicles
      vehicles.forEach(v => {
        const r = roads[v.road];
        if (!r) return;
        v.progress += v.speed * 0.002;
        if (v.progress > 1) v.progress = 0;
        v.x = r.x1 + (r.x2 - r.x1) * v.progress;
        v.y = r.y1 + (r.y2 - r.y1) * v.progress;

        // Glow
        const grd = ctx!.createRadialGradient(v.x, v.y, 0, v.x, v.y, v.size * 4);
        grd.addColorStop(0, v.color + '40');
        grd.addColorStop(1, v.color + '00');
        ctx!.fillStyle = grd;
        ctx!.beginPath();
        ctx!.arc(v.x, v.y, v.size * 4, 0, Math.PI * 2);
        ctx!.fill();

        // Vehicle dot
        ctx!.beginPath();
        ctx!.arc(v.x, v.y, v.size, 0, Math.PI * 2);
        ctx!.fillStyle = v.color;
        ctx!.fill();
      });

      // Draw GPS pins
      pins.forEach(p => {
        p.pulse += p.pulseDir;
        const pulseScale = 0.5 + Math.sin(p.pulse) * 0.5;

        // Pulse ring
        ctx!.beginPath();
        ctx!.arc(p.x, p.y, 8 + pulseScale * 14, 0, Math.PI * 2);
        ctx!.strokeStyle = p.color + Math.round(30 * (1 - pulseScale)).toString(16).padStart(2, '0');
        ctx!.lineWidth = 1.5;
        ctx!.stroke();

        // Pin body
        ctx!.beginPath();
        ctx!.arc(p.x, p.y, 5, 0, Math.PI * 2);
        ctx!.fillStyle = p.color;
        ctx!.fill();
        ctx!.beginPath();
        ctx!.arc(p.x, p.y, 2.5, 0, Math.PI * 2);
        ctx!.fillStyle = '#ffffff40';
        ctx!.fill();
      });

      // Floating particles + connections
      particles.forEach(p => {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0) p.x = W;
        if (p.x > W) p.x = 0;
        if (p.y < 0) p.y = H;
        if (p.y > H) p.y = 0;
        ctx!.beginPath();
        ctx!.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx!.fillStyle = `rgba(65, 131, 239, ${p.alpha})`;
        ctx!.fill();
      });
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 120) {
            ctx!.beginPath();
            ctx!.moveTo(particles[i].x, particles[i].y);
            ctx!.lineTo(particles[j].x, particles[j].y);
            ctx!.strokeStyle = `rgba(65, 131, 239, ${0.08 * (1 - dist / 120)})`;
            ctx!.lineWidth = 0.5;
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
