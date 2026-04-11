import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useSearchParams } from 'react-router-dom';
import useAuthStore from '../../context/authStore';
import { authAPI } from '../../api';
import toast from 'react-hot-toast';

const LICENSE_MESSAGES = {
  license_expired: 'Your client license has expired. Please send a renewal request below.',
  license_pending: 'Your client license is still pending approval from the platform owner.',
  license_suspended: 'Your client license is suspended. Please contact the platform owner.',
};

export default function LoginPageV2() {
  const { login, isLoading } = useAuthStore();
  const [searchParams] = useSearchParams();
  const [form, setForm] = useState({ phone: '', password: '' });
  const [showPass, setShowPass] = useState(false);
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [isRequesting, setIsRequesting] = useState(false);
  const [requestForm, setRequestForm] = useState({
    shopName: '',
    ownerName: '',
    phone: '',
    email: '',
    preferredPlan: 'starter',
    message: '',
  });

  useEffect(() => {
    const licenseState = searchParams.get('license');
    if (licenseState && LICENSE_MESSAGES[licenseState]) {
      toast.error(LICENSE_MESSAGES[licenseState], { id: `license-${licenseState}` });
      setShowRequestForm(true);
    }
  }, [searchParams]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const digits = form.phone.replace(/\D/g, '');
    if (digits.length !== 10) {
      toast.error('Enter a valid 10-digit mobile number');
      return;
    }

    const res = await login(form.phone, form.password);
    if (!res.success) toast.error(res.message);
  };

  const handleRequestLicense = async (e) => {
    e.preventDefault();
    const digits = requestForm.phone.replace(/\D/g, '');
    if (digits.length !== 10) {
      toast.error('Enter a valid 10-digit contact number');
      return;
    }

    try {
      setIsRequesting(true);
      await authAPI.requestLicense({
        ...requestForm,
        phone: digits,
      });
      toast.success('License request sent to the platform owner');
      setRequestForm({
        shopName: '',
        ownerName: '',
        phone: '',
        email: '',
        preferredPlan: 'starter',
        message: '',
      });
      setShowRequestForm(false);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to send license request');
    } finally {
      setIsRequesting(false);
    }
  };

  const setRequestField = (key, value) => {
    setRequestForm((current) => ({ ...current, [key]: value }));
  };

  return (
    <div
      className="min-h-screen bg-ink-0 flex items-center justify-center p-4"
      style={{
        backgroundImage:
          'radial-gradient(ellipse 60% 50% at 30% 30%, rgba(37,99,235,.04) 0%, transparent 60%), radial-gradient(ellipse 50% 60% at 80% 80%, rgba(56,189,248,.03) 0%, transparent 60%)',
      }}
    >
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-5xl grid gap-6 lg:grid-cols-[1fr_0.95fr] items-start"
      >
        <div className="w-full max-w-md mx-auto lg:max-w-none">
          <div className="flex items-center gap-3 mb-8 justify-center lg:justify-start">
            <div
              className="w-12 h-12 rounded-xl bg-gradient-to-br from-em to-teal flex items-center justify-center text-2xl"
              style={{
                animation: 'gemPulse 4s ease-in-out infinite',
                boxShadow: '0 0 0 1px rgba(37,99,235,.35), 0 4px 20px rgba(37,99,235,.18)',
              }}
            >
              {'📱'}
            </div>
            <div>
              <div className="font-display font-extrabold text-xl text-slate-900 leading-tight">
                WA Appt OS
              </div>
              <div className="text-2xs font-mono text-em tracking-widest">ENTERPRISE PLATFORM</div>
            </div>
          </div>

<div className="card p-8 min-h-[520px]">
            <h1 className="font-display font-extrabold text-2xl text-slate-900 mb-1">Welcome back</h1>
            <p className="text-sm text-stone-2 mb-6">Sign in with your assigned admin mobile number.</p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="label">Admin Login Mobile</label>
                <div className="flex">
                  <span className="flex items-center px-3 bg-ink-5 border border-r-0 border-ink-6 rounded-l-lg text-sm text-mist-2 font-mono flex-shrink-0">
                    {'🇮🇳 +91'}
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

              <div>
                <label className="label">Password</label>
                <div className="relative">
                  <input
                    type={showPass ? 'text' : 'password'}
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    className="input pr-10"
                    placeholder="12345678"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(!showPass)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-2 hover:text-slate-900 transition-colors text-sm"
                    tabIndex={-1}
                  >
                    {showPass ? 'Hide' : 'Show'}
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
                  'Sign In'
                )}
              </button>
            </form>

            <div className="mt-5 rounded-2xl border border-amber/20 bg-amber/5 p-4">
              <div className="text-xs font-semibold text-slate-900">Need a license or renewal?</div>
              <div className="mt-1 text-xs text-stone-2">
                If your shop is new or your license expired, send a request directly to the platform owner.
              </div>
              <button
                type="button"
                className="btn-ghost mt-4"
                onClick={() => setShowRequestForm((current) => !current)}
              >
                {showRequestForm ? 'Hide License Request' : 'Request License'}
              </button>
            </div>
          </div>

          <div className="mt-4 p-3 rounded-lg bg-ink-4/50 border border-ink-6">
            <p className="text-2xs text-stone-2 text-center mb-2 font-mono uppercase tracking-wider">
              Owner Credentials
            </p>
            <div className="flex items-center justify-between">
              <div className="text-2xs font-mono text-mist-2">
                <div>Phone: <span className="text-em">9345578103</span></div>
                <div>Password: <span className="text-em">123456</span></div>
              </div>
              <button
                onClick={() => setForm({ phone: '9345578103', password: '123456' })}
                className="text-2xs px-3 py-1.5 bg-em/10 border border-em/30 text-em rounded-lg hover:bg-em/20 transition-colors font-semibold"
              >
                Fill
              </button>
            </div>
          </div>
        </div>

        <div className="card p-8">
          <div className="text-2xs font-mono uppercase tracking-[0.2em] text-em">License Workflow</div>
          <h2 className="mt-2 font-display font-extrabold text-2xl text-slate-900">Client Access Request</h2>
          <p className="mt-2 text-sm text-stone-2">
            Submit your shop details here. The platform owner can generate your license, create your admin login, and activate your workspace without deleting any previous data.
          </p>

          {showRequestForm ? (
            <form className="mt-6 space-y-4" onSubmit={handleRequestLicense}>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="label">Shop Name</label>
                  <input
                    className="input"
                    value={requestForm.shopName}
                    onChange={(e) => setRequestField('shopName', e.target.value)}
                    placeholder="GK Salon"
                    required
                  />
                </div>
                <div>
                  <label className="label">Owner Name</label>
                  <input
                    className="input"
                    value={requestForm.ownerName}
                    onChange={(e) => setRequestField('ownerName', e.target.value)}
                    placeholder="Gopal Krishna"
                    required
                  />
                </div>
                <div>
                  <label className="label">Contact Phone</label>
                  <input
                    className="input"
                    value={requestForm.phone}
                    onChange={(e) => setRequestField('phone', e.target.value.replace(/\D/g, '').slice(0, 10))}
                    placeholder="9345578103"
                    required
                  />
                </div>
                <div>
                  <label className="label">Email</label>
                  <input
                    type="email"
                    className="input"
                    value={requestForm.email}
                    onChange={(e) => setRequestField('email', e.target.value)}
                    placeholder="owner@shop.com"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="label">Preferred Plan</label>
                  <select
                    className="input"
                    value={requestForm.preferredPlan}
                    onChange={(e) => setRequestField('preferredPlan', e.target.value)}
                  >
                    <option value="starter">Starter</option>
                    <option value="pro">Pro</option>
                    <option value="enterprise">Enterprise</option>
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className="label">Request Message</label>
                  <textarea
                    className="input resize-none"
                    rows={4}
                    value={requestForm.message}
                    onChange={(e) => setRequestField('message', e.target.value)}
                    placeholder="We need a new license for our branch / please renew our expired shop access."
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isRequesting}
                className="btn-em w-full justify-center py-3 text-sm"
              >
                {isRequesting ? 'Sending request...' : 'Send License Request'}
              </button>
            </form>
          ) : (
            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              {[
                'Platform owner creates the client workspace and admin login credentials.',
                'License key, validity, and shop details are activated from the owner dashboard.',
                'After login, your shop settings and chatbot replies can be customized manually.',
              ].map((item, index) => (
                <div key={index} className="rounded-2xl border border-ink-6 bg-ink-3 p-4 text-sm text-stone-2">
                  <div className="text-2xs font-mono uppercase tracking-[0.18em] text-em">Step {index + 1}</div>
                  <div className="mt-2">{item}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
