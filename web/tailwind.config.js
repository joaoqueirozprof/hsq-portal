/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: { 400:'#60a5fa', 500:'#3b82f6', 600:'#2563eb', 700:'#1d4ed8' },
        success: { 400:'#4ade80', 500:'#22c55e', 600:'#16a34a' },
        warning: { 400:'#facc15', 500:'#eab308', 600:'#ca8a04' },
        danger:  { 400:'#f87171', 500:'#ef4444', 600:'#dc2626', 700:'#b91c1c' },
        accent:  { 400:'#fb923c', 500:'#f97316', 600:'#ea580c' },
        dark: {
          50:'#f8fafc', 100:'#f1f5f9', 200:'#e2e8f0', 300:'#cbd5e1',
          400:'#94a3b8', 500:'#64748b', 600:'#475569', 700:'#334155',
          800:'#1e293b', 900:'#0f172a', 950:'#0a0f1e'
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Space Grotesk', 'Inter', 'sans-serif'],
        mono: ['Space Mono', 'monospace'],
      },
      boxShadow: {
        'glow-blue': '0 0 20px rgba(37,99,235,0.3)',
        'glow-green': '0 0 20px rgba(34,197,94,0.25)',
      }
    },
  },
  plugins: [],
};
