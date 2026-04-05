import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import useAuthStore from '../../context/authStore';
import toast from 'react-hot-toast';

export default function LoginPage() {
  const { login, isLoading } = useAuthStore();
  const [form, setForm] = useState({ phone: '', password: '' });
  const [showPass, setShowPass] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    // basic client-side check
    const digits = form.phone.replace(/\D/g, '');
    if (digits.length < 10) {
      toast.error('Enter a valid 10-digit mobile number');
      return;
    }
    const res = await login(form.phone, form.password);
    if (!res.success) toast.error(res.message);
  };

  return (
    <div
      className="min-h-screen bg-ink-0 flex items-center justify-center p-4"
      style={{
        backgroundImage:
          'radial-gradient(ellipse 60% 50% at 30% 30%, rgba(0,230,118,.04) 0%, transparent 60%), radial-gradient(ellipse 50% 60% at 80% 80%, rgba(56,189,248,.03) 0%, transparent 60%)',
      }}
    >
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        {/* Logo */}
        <div className="flex items-center gap-3 mb-8 justify-center">
          <div
            className="w-12 h-12 rounded-xl bg-gradient-to-br from-em to-teal flex items-center justify-center text-2xl"
            style={{
              animation: 'gemPulse 4s ease-in-out infinite',
              boxShadow: '0 0 0 1px rgba(0,230,118,.35), 0 4px 20px rgba(0,230,118,.18)',
            }}
          >
            📱
          </div>
          <div>
            <div className="font-display font-extrabold text-xl text-white leading-tight">
              WA Appt OS
            </div>
            <div className="text-2xs font-mono text-em tracking-widest">ENTERPRISE PLATFORM</div>
          </div>
        </div>

        {/* Card */}
        <div className="card p-8">
          <h1 className="font-display font-extrabold text-2xl text-white mb-1">Welcome back</h1>
          <p className="text-sm text-stone-2 mb-6">Sign in with your mobile number</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Mobile number */}
            <div>
              <label className="label">Mobile Number</label>
              <div className="flex">
                {/* country code badge */}
                <span className="flex items-center px-3 bg-ink-5 border border-r-0 border-ink-6 rounded-l-lg text-sm text-mist-2 font-mono flex-shrink-0">
                  🇮🇳 +91
                </span>
                <input
                  type="tel"
                  inputMode="numeric"
                  maxLength={10}
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value.replace(/\D/g, '').slice(0, 10) })}
                  className="input rounded-l-none flex-1"
                  placeholder="9345578103"
                  required
                  autoFocus
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="label">Password</label>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'}
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  className="input pr-10"
                  placeholder="••••••••"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-2 hover:text-white transition-colors text-sm"
                  tabIndex={-1}
                >
                  {showPass ? '🙈' : '👁'}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="btn-em w-full justify-center py-3 text-sm mt-2"
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                  Signing in...
                </span>
              ) : (
                'Sign In →'
              )}
            </button>
          </form>

          <p className="text-sm text-stone-2 text-center mt-5">
            New business?{' '}
            <Link to="/register" className="text-em hover:underline font-semibold">
              Register free
            </Link>
          </p>
        </div>

        {/* Credentials hint for developer */}
        <div className="mt-4 p-3 rounded-lg bg-ink-4/50 border border-ink-6">
          <p className="text-2xs text-stone-2 text-center mb-2 font-mono uppercase tracking-wider">
            Admin Credentials
          </p>
          <div className="flex items-center justify-between">
            <div className="text-2xs font-mono text-mist-2">
              <div>📱 <span className="text-em">9345578103</span></div>
              <div>🔑 <span className="text-em">Gopal@123</span></div>
            </div>
            <button
              onClick={() => setForm({ phone: '9345578103', password: 'Gopal@123' })}
              className="text-2xs px-3 py-1.5 bg-em/10 border border-em/30 text-em rounded-lg hover:bg-em/20 transition-colors font-semibold"
            >
              Fill →
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
