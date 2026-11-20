import React, { useState } from 'react';
import { X, ShieldCheck, Store, ShoppingBag } from 'lucide-react';
import { apiFetch, setAuthToken } from '../lib/api';
import type { User } from '../types';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAuthenticated: (user: User, token: string) => void;
}

const DEMO_ACCOUNTS = [
  {
    label: 'Claire Montgomery',
    role: 'Buyer',
    email: 'claire.montgomery@jazmine.atelier',
    password: 'Atelier2026!',
    note: 'Collector · Saved Wishlist & Orders',
  },
  {
    label: 'Henri Laurent',
    role: 'Seller',
    email: 'henri.laurent@jazmine.atelier',
    password: 'Atelier2026!',
    note: 'Maison Laurent Archive · Paris',
  },
  {
    label: 'Beatrice Vance',
    role: 'Seller',
    email: 'beatrice.vance@jazmine.atelier',
    password: 'Atelier2026!',
    note: 'Vance Estate Wardrobe · Boston',
  },
  {
    label: 'Mikyla Calantas',
    role: 'Admin',
    email: 'mikylacalantas99@gmail.com',
    password: 'AdminJazmine2026!',
    note: 'Curatorial & Moderation Desk',
  },
];

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, onAuthenticated }) => {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<'buyer' | 'seller'>('buyer');
  const [storeName, setStoreName] = useState('');
  const [storeLocation, setStoreLocation] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const submitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (mode === 'login') {
        const res = await apiFetch<{ user: User; token: string }>('/api/auth/login', {
          method: 'POST',
          body: JSON.stringify({ email, password }),
        });
        setAuthToken(res.token);
        onAuthenticated(res.user, res.token);
        onClose();
      } else {
        const res = await apiFetch<{ user: User; token: string }>('/api/auth/register', {
          method: 'POST',
          body: JSON.stringify({
            email,
            password,
            name,
            role,
            storeName: role === 'seller' ? storeName : undefined,
            storeLocation,
          }),
        });
        setAuthToken(res.token);
        onAuthenticated(res.user, res.token);
        onClose();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  const quickLogin = async (demoEmail: string, demoPassword: string) => {
    setError('');
    setLoading(true);
    try {
      const res = await apiFetch<{ user: User; token: string }>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: demoEmail, password: demoPassword }),
      });
      setAuthToken(res.token);
      onAuthenticated(res.user, res.token);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-in failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#3B281E]/55 p-4 backdrop-blur-xs">
      <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto border border-[#D8CEBA] bg-[#F9F6F0] p-6 shadow-2xl md:p-8">
        <div className="flex items-start justify-between gap-4 border-b border-[#D8CEBA] pb-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-widest text-[#B08D57]">
              JAZMINE Membership
            </p>
            <h2 className="mt-1 font-serif-editorial text-3xl font-semibold text-[#3B281E]">
              {mode === 'login' ? 'Enter the Atelier' : 'Create Your Account'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close authentication modal"
            className="flex h-11 w-11 items-center justify-center text-[#6E5B4F] hover:text-[#3B281E] cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-5 grid grid-cols-2 border border-[#D8CEBA] bg-[#EFE9DD] p-1">
          <button
            type="button"
            onClick={() => {
              setMode('login');
              setError('');
            }}
            className={`py-2.5 text-xs font-medium uppercase tracking-wider transition-colors cursor-pointer ${
              mode === 'login'
                ? 'bg-[#3B281E] text-[#F9F6F0]'
                : 'text-[#6E5B4F] hover:text-[#3B281E]'
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('register');
              setError('');
            }}
            className={`py-2.5 text-xs font-medium uppercase tracking-wider transition-colors cursor-pointer ${
              mode === 'register'
                ? 'bg-[#3B281E] text-[#F9F6F0]'
                : 'text-[#6E5B4F] hover:text-[#3B281E]'
            }`}
          >
            Register
          </button>
        </div>

        {error && (
          <div className="mt-4 border border-[#6D2932]/40 bg-[#6D2932]/10 px-4 py-3 text-sm text-[#6D2932]">
            {error}
          </div>
        )}

        <form onSubmit={submitForm} className="mt-5 space-y-4">
          {mode === 'register' && (
            <>
              <div>
                <label className="block text-xs font-medium uppercase tracking-wider text-[#6E5B4F]">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Eleanor Ashworth"
                  className="mt-1.5 w-full border border-[#D8CEBA] bg-white px-3.5 py-2.5 text-sm text-[#3B281E] focus:border-[#6D2932] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium uppercase tracking-wider text-[#6E5B4F]">
                  Account Role
                </label>
                <div className="mt-1.5 grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setRole('buyer')}
                    className={`flex items-center justify-center gap-2 border px-3 py-2.5 text-xs font-medium transition-colors cursor-pointer ${
                      role === 'buyer'
                        ? 'border-[#6D2932] bg-[#6D2932] text-[#F9F6F0]'
                        : 'border-[#D8CEBA] bg-[#EFE9DD] text-[#3B281E]'
                    }`}
                  >
                    <ShoppingBag className="h-4 w-4" />
                    Buyer &amp; Collector
                  </button>
                  <button
                    type="button"
                    onClick={() => setRole('seller')}
                    className={`flex items-center justify-center gap-2 border px-3 py-2.5 text-xs font-medium transition-colors cursor-pointer ${
                      role === 'seller'
                        ? 'border-[#6D2932] bg-[#6D2932] text-[#F9F6F0]'
                        : 'border-[#D8CEBA] bg-[#EFE9DD] text-[#3B281E]'
                    }`}
                  >
                    <Store className="h-4 w-4" />
                    Seller Storefront
                  </button>
                </div>
              </div>

              {role === 'seller' && (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-medium uppercase tracking-wider text-[#6E5B4F]">
                      Storefront Name
                    </label>
                    <input
                      type="text"
                      value={storeName}
                      onChange={(e) => setStoreName(e.target.value)}
                      placeholder="Atelier Ashworth"
                      className="mt-1.5 w-full border border-[#D8CEBA] bg-white px-3.5 py-2.5 text-sm text-[#3B281E] focus:border-[#6D2932] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium uppercase tracking-wider text-[#6E5B4F]">
                      City / Salon
                    </label>
                    <input
                      type="text"
                      value={storeLocation}
                      onChange={(e) => setStoreLocation(e.target.value)}
                      placeholder="London · Mayfair"
                      className="mt-1.5 w-full border border-[#D8CEBA] bg-white px-3.5 py-2.5 text-sm text-[#3B281E] focus:border-[#6D2932] focus:outline-none"
                    />
                  </div>
                </div>
              )}
            </>
          )}

          <div>
            <label className="block text-xs font-medium uppercase tracking-wider text-[#6E5B4F]">
              Email Address
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@domain.com"
              className="mt-1.5 w-full border border-[#D8CEBA] bg-white px-3.5 py-2.5 text-sm text-[#3B281E] focus:border-[#6D2932] focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-medium uppercase tracking-wider text-[#6E5B4F]">
              Password
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Minimum 6 characters"
              className="mt-1.5 w-full border border-[#D8CEBA] bg-white px-3.5 py-2.5 text-sm text-[#3B281E] focus:border-[#6D2932] focus:outline-none"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#6D2932] py-3 text-xs font-medium uppercase tracking-widest text-[#F9F6F0] transition-colors hover:bg-[#561E26] disabled:opacity-60 cursor-pointer"
          >
            {loading ? 'Authenticating...' : mode === 'login' ? 'Sign In' : 'Create Account'}
          </button>
        </form>

        <div className="mt-6 border-t border-[#D8CEBA] pt-5">
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-[#6E5B4F]">
            <ShieldCheck className="h-4 w-4 text-[#B08D57]" />
            <span>Instant Role Access (Pre-Seeded Profiles)</span>
          </div>
          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {DEMO_ACCOUNTS.map((acc) => (
              <button
                key={acc.email}
                type="button"
                disabled={loading}
                onClick={() => quickLogin(acc.email, acc.password)}
                className="flex flex-col items-start border border-[#D8CEBA] bg-[#EFE9DD]/70 p-3 text-left transition-colors hover:border-[#6D2932] hover:bg-[#EFE9DD] cursor-pointer"
              >
                <div className="flex w-full items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-[#3B281E]">{acc.label}</span>
                  <span className="text-xs font-medium text-[#6D2932]">{acc.role}</span>
                </div>
                <span className="mt-0.5 text-xs text-[#6E5B4F]">{acc.note}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
