import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import useAuthStore from '../../context/authStore';
import toast from 'react-hot-toast';

const CATEGORIES = ['salon','medical','automotive','education','fitness','spa','dental','legal','other'];

export default function RegisterPage() {
  const { register, isLoading } = useAuthStore();
  const [form, setForm] = useState({
    name: '',
    phone: '',          // PRIMARY — mandatory login field
    email: '',          // optional
    password: '',
    businessName: '',
    businessCategory: 'salon',
  });

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    const digits = form.phone.replace(/\D/g, '');
    if (digits.length !== 10) {
      toast.error('Enter a valid 10-digit mobile number');
      return;
    }
    if (form.password.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }
    const res = await register(form);
    if (!res.success) toast.error(res.message);
    else toast.success('Account created! Welcome 🎉');
  };

  return (
    <div
      className="min-h-screen bg-ink-0 flex items-center justify-center p-4"
      style={{
        backgroundImage:
          'radial-gradient(ellipse 60% 50% at 70% 20%, rgba(37,99,235,.04) 0%, transparent 60%)',
      }}
    >
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-lg"
      >
        {/* Logo */}
        <div className="flex items-center gap-3 mb-8 justify-center">
          <div
            className="w-12 h-12 rounded-xl bg-gradient-to-br from-em to-teal flex items-center justify-center text-2xl"
            style={{ boxShadow: '0 0 0 1px rgba(37,99,235,.35), 0 4px 20px rgba(37,99,235,.18)' }}
          >
            📱
          </div>
          <div>
            <div className="font-display font-extrabold text-xl text-slate-900">WA Appt OS</div>
            <div className="text-2xs font-mono text-em tracking-widest">14-DAY FREE TRIAL</div>
          </div>
        </div>

        <div className="card p-8">
          <h1 className="font-display font-extrabold text-2xl text-slate-900 mb-1">Create account</h1>
          <p className="text-sm text-stone-2 mb-6">
            Your mobile number will be used to log in
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Name */}
            <div>
              <label className="label">Your Name *</label>
              <input
                className="input"
                placeholder="GK"
                value={form.name}
                onChange={(e) => set('name', e.target.value)}
                required
              />
            </div>

            {/* Phone — PRIMARY */}
            <div>
              <label className="label">
                Mobile Number *{' '}
                <span className="text-em font-mono normal-case tracking-normal">(used to login)</span>
              </label>
              <div className="flex">
                <span className="flex items-center px-3 bg-ink-5 border border-r-0 border-ink-6 rounded-l-lg text-sm text-mist-2 font-mono flex-shrink-0">
                  🇮🇳 +91
                </span>
                <input
                  type="tel"
                  inputMode="numeric"
                  maxLength={10}
                  className="input rounded-l-none flex-1"
                  placeholder="9345578103"
                  value={form.phone}
                  onChange={(e) => set('phone', e.target.value.replace(/\D/g, '').slice(0, 10))}
                  required
                />
              </div>
            </div>

            {/* Email — optional */}
            <div>
              <label className="label">
                Email{' '}
                <span className="text-stone-1 normal-case tracking-normal">(optional)</span>
              </label>
              <input
                type="email"
                className="input"
                placeholder="you@domain.com"
                value={form.email}
                onChange={(e) => set('email', e.target.value)}
              />
            </div>

            {/* Password */}
            <div>
              <label className="label">Password *</label>
              <input
                type="password"
                className="input"
                placeholder="Min 8 characters"
                value={form.password}
                onChange={(e) => set('password', e.target.value)}
                required
                minLength={8}
              />
            </div>

            {/* Business section */}
            <div className="border-t border-ink-6 pt-4">
              <p className="text-2xs font-bold text-stone-2 uppercase tracking-wider mb-3">
                Business Details
              </p>
              <div className="space-y-4">
                <div>
                  <label className="label">Business Name *</label>
                  <input
                    className="input"
                    placeholder="Priya's Beauty Salon"
                    value={form.businessName}
                    onChange={(e) => set('businessName', e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="label">Category</label>
                  <select
                    className="input"
                    value={form.businessCategory}
                    onChange={(e) => set('businessCategory', e.target.value)}
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c.charAt(0).toUpperCase() + c.slice(1)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="btn-em w-full justify-center py-3 mt-2"
            >
              {isLoading ? 'Creating account...' : 'Start Free Trial →'}
            </button>
          </form>

          <p className="text-sm text-stone-2 text-center mt-5">
            Already have an account?{' '}
            <Link to="/login" className="text-em hover:underline font-semibold">
              Sign in
            </Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
}

