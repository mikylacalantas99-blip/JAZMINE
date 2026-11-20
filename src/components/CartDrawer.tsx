import React, { useState } from 'react';
import { X, Minus, Plus, Trash2, Lock, CheckCircle2 } from 'lucide-react';
import { apiFetch } from '../lib/api';
import { SafeImage } from './SafeImage';
import type { CartItem, User } from '../types';

interface CartDrawerProps {
  isOpen: boolean;
  items: CartItem[];
  currentUser: User | null;
  onClose: () => void;
  onUpdateQty: (productId: string, delta: number) => void;
  onRemoveItem: (productId: string) => void;
  onClearCart: () => void;
  onRequireAuth: () => void;
  onOrderSuccess: (orderId: string) => void;
}

export const CartDrawer: React.FC<CartDrawerProps> = ({
  isOpen,
  items,
  currentUser,
  onClose,
  onUpdateQty,
  onRemoveItem,
  onClearCart,
  onRequireAuth,
  onOrderSuccess,
}) => {
  const [step, setStep] = useState<'bag' | 'checkout' | 'confirmed'>('bag');
  const [shippingName, setShippingName] = useState(currentUser?.name || '');
  const [shippingAddress, setShippingAddress] = useState('');
  const [shippingCity, setShippingCity] = useState('');
  const [shippingPostal, setShippingPostal] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Heritage Escrow Card');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [confirmedInfo, setConfirmedInfo] = useState<{
    orderId: string;
    trackingCode: string;
    totalAmount: number;
  } | null>(null);

  if (!isOpen) return null;

  const subtotal = items.reduce(
    (sum, entry) => sum + (entry.agreedPrice ?? entry.product.price) * entry.quantity,
    0
  );

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) {
      onRequireAuth();
      return;
    }
    setError('');
    setLoading(true);
    try {
      const payload = {
        items: items.map((entry) => ({
          productId: entry.product.id,
          quantity: entry.quantity,
          agreedPrice: entry.agreedPrice,
        })),
        shippingName: shippingName || currentUser.name,
        shippingAddress,
        shippingCity,
        shippingPostal,
        paymentMethod,
      };
      const res = await apiFetch<{ orderId: string; trackingCode: string; totalAmount: number }>(
        '/api/orders/checkout',
        {
          method: 'POST',
          body: JSON.stringify(payload),
        }
      );
      setConfirmedInfo(res);
      setStep('confirmed');
      onClearCart();
      onOrderSuccess(res.orderId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Checkout failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-[#3B281E]/50 backdrop-blur-xs">
      <div className="flex h-full w-full max-w-md flex-col border-l border-[#D8CEBA] bg-[#F9F6F0] shadow-2xl">
        <div className="flex items-center justify-between border-b border-[#D8CEBA] px-6 py-4">
          <div>
            <p className="text-xs uppercase tracking-widest text-[#B08D57]">JAZMINE Atelier</p>
            <h2 className="font-serif-editorial text-2xl font-semibold text-[#3B281E]">
              {step === 'bag'
                ? `Shopping Bag (${items.reduce((s, i) => s + i.quantity, 0)})`
                : step === 'checkout'
                ? 'Insured Checkout'
                : 'Order Confirmed'}
            </h2>
          </div>
          <button
            type="button"
            onClick={() => {
              setStep('bag');
              onClose();
            }}
            aria-label="Close shopping bag"
            className="flex h-11 w-11 items-center justify-center text-[#6E5B4F] hover:text-[#3B281E] cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {step === 'confirmed' && confirmedInfo ? (
            <div className="space-y-4 border border-[#D8CEBA] bg-white p-6 text-center">
              <CheckCircle2 className="mx-auto h-10 w-10 text-[#6D2932]" />
              <h3 className="font-serif-editorial text-2xl font-semibold text-[#3B281E]">
                Order {confirmedInfo.orderId} Placed
              </h3>
              <p className="text-sm text-[#6E5B4F]">
                Your archival pieces have been reserved and inventory automatically updated.
              </p>
              <div className="border-t border-b border-[#D8CEBA] py-3 text-xs text-[#3B281E] tabular-nums">
                <div>Tracking Code: <strong>{confirmedInfo.trackingCode}</strong></div>
                <div className="mt-1">Total Charged: <strong>${confirmedInfo.totalAmount.toLocaleString()}</strong></div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setStep('bag');
                  onClose();
                }}
                className="w-full bg-[#3B281E] py-3 text-xs font-medium uppercase tracking-widest text-[#F9F6F0] cursor-pointer"
              >
                Track in Orders
              </button>
            </div>
          ) : items.length === 0 ? (
            <div className="flex h-64 flex-col items-center justify-center border border-[#D8CEBA] bg-[#EFE9DD]/50 p-6 text-center">
              <p className="font-serif-editorial text-2xl text-[#3B281E]">Your bag is empty</p>
              <p className="mt-2 text-sm text-[#6E5B4F]">
                Explore pre-loved outerwear, leather goods, and heirloom accessories.
              </p>
            </div>
          ) : step === 'bag' ? (
            <div className="space-y-4">
              {items.map((entry) => {
                const unitPrice = entry.agreedPrice ?? entry.product.price;
                return (
                  <div
                    key={entry.product.id}
                    className="flex gap-4 border-b border-[#D8CEBA] pb-4"
                  >
                    <div className="h-24 w-24 shrink-0 overflow-hidden border border-[#D8CEBA] bg-[#EFE9DD]">
                      <SafeImage
                        src={entry.product.images[0]}
                        alt={entry.product.title}
                        className="h-full w-full object-cover"
                      />
                    </div>
                    <div className="flex flex-1 flex-col justify-between">
                      <div>
                        <p className="text-xs uppercase tracking-wider text-[#6E5B4F]">
                          {entry.product.brand}
                        </p>
                        <h4 className="text-sm font-semibold text-[#3B281E]">
                          {entry.product.title}
                        </h4>
                        <div className="mt-1 flex items-center gap-2 text-sm tabular-nums">
                          <span className="font-semibold text-[#3B281E]">
                            ${unitPrice.toLocaleString()}
                          </span>
                          {entry.agreedPrice && entry.agreedPrice < entry.product.price && (
                            <span className="text-xs text-[#6D2932]">
                              Negotiated (was ${entry.product.price})
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="mt-2 flex items-center justify-between">
                        <div className="flex items-center border border-[#D8CEBA] bg-white">
                          <button
                            type="button"
                            onClick={() => onUpdateQty(entry.product.id, -1)}
                            aria-label="Decrease quantity"
                            className="flex h-8 w-8 items-center justify-center text-[#3B281E] hover:bg-[#EFE9DD] cursor-pointer"
                          >
                            <Minus className="h-3 w-3" />
                          </button>
                          <span className="w-8 text-center text-xs font-medium tabular-nums">
                            {entry.quantity}
                          </span>
                          <button
                            type="button"
                            disabled={entry.quantity >= entry.product.stock}
                            onClick={() => onUpdateQty(entry.product.id, 1)}
                            aria-label="Increase quantity"
                            className="flex h-8 w-8 items-center justify-center text-[#3B281E] hover:bg-[#EFE9DD] disabled:opacity-40 cursor-pointer"
                          >
                            <Plus className="h-3 w-3" />
                          </button>
                        </div>
                        <button
                          type="button"
                          onClick={() => onRemoveItem(entry.product.id)}
                          aria-label="Remove item"
                          className="flex h-8 w-8 items-center justify-center text-[#6E5B4F] hover:text-[#6D2932] cursor-pointer"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <form id="jazmine-checkout-form" onSubmit={handleCheckout} className="space-y-4">
              {error && (
                <div className="border border-[#6D2932]/40 bg-[#6D2932]/10 p-3 text-xs text-[#6D2932]">
                  {error}
                </div>
              )}
              <div>
                <label className="block text-xs font-medium uppercase tracking-wider text-[#6E5B4F]">
                  Recipient Full Name
                </label>
                <input
                  type="text"
                  required
                  value={shippingName}
                  onChange={(e) => setShippingName(e.target.value)}
                  placeholder="Claire Montgomery"
                  className="mt-1 w-full border border-[#D8CEBA] bg-white px-3 py-2.5 text-sm text-[#3B281E] focus:border-[#6D2932] focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium uppercase tracking-wider text-[#6E5B4F]">
                  Street Address
                </label>
                <input
                  type="text"
                  required
                  value={shippingAddress}
                  onChange={(e) => setShippingAddress(e.target.value)}
                  placeholder="740 Park Avenue, Apt 4B"
                  className="mt-1 w-full border border-[#D8CEBA] bg-white px-3 py-2.5 text-sm text-[#3B281E] focus:border-[#6D2932] focus:outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium uppercase tracking-wider text-[#6E5B4F]">
                    City
                  </label>
                  <input
                    type="text"
                    required
                    value={shippingCity}
                    onChange={(e) => setShippingCity(e.target.value)}
                    placeholder="New York"
                    className="mt-1 w-full border border-[#D8CEBA] bg-white px-3 py-2.5 text-sm text-[#3B281E] focus:border-[#6D2932] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium uppercase tracking-wider text-[#6E5B4F]">
                    Postal Code
                  </label>
                  <input
                    type="text"
                    required
                    value={shippingPostal}
                    onChange={(e) => setShippingPostal(e.target.value)}
                    placeholder="10021"
                    className="mt-1 w-full border border-[#D8CEBA] bg-white px-3 py-2.5 text-sm text-[#3B281E] focus:border-[#6D2932] focus:outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium uppercase tracking-wider text-[#6E5B4F]">
                  Payment Method
                </label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="mt-1 w-full border border-[#D8CEBA] bg-white px-3 py-2.5 text-sm text-[#3B281E] focus:border-[#6D2932] focus:outline-none"
                >
                  <option value="Heritage Escrow Card">Heritage Escrow Card (Protected)</option>
                  <option value="Atelier Wire / Bank Transfer">Atelier Wire / Bank Transfer</option>
                  <option value="Cash on Delivery">Cash on Insured Delivery</option>
                </select>
              </div>
            </form>
          )}
        </div>

        {items.length > 0 && step !== 'confirmed' && (
          <div className="border-t border-[#D8CEBA] bg-[#EFE9DD] p-6">
            <div className="flex items-center justify-between text-sm text-[#6E5B4F]">
              <span>Insured Atelier Courier</span>
              <span>Complimentary</span>
            </div>
            <div className="mt-2 flex items-center justify-between text-base font-semibold text-[#3B281E] tabular-nums">
              <span>Total</span>
              <span>${subtotal.toLocaleString()}</span>
            </div>

            {step === 'bag' ? (
              <button
                type="button"
                onClick={() => {
                  if (!currentUser) {
                    onRequireAuth();
                    return;
                  }
                  if (!shippingName && currentUser) setShippingName(currentUser.name);
                  setStep('checkout');
                }}
                className="mt-4 flex w-full items-center justify-center gap-2 bg-[#6D2932] py-3.5 text-xs font-medium uppercase tracking-widest text-[#F9F6F0] transition-colors hover:bg-[#561E26] cursor-pointer"
              >
                <Lock className="h-3.5 w-3.5" />
                Proceed to Checkout
              </button>
            ) : (
              <div className="mt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => setStep('bag')}
                  className="border border-[#D8CEBA] bg-white px-4 py-3 text-xs font-medium uppercase tracking-wider text-[#3B281E] cursor-pointer"
                >
                  Back
                </button>
                <button
                  type="submit"
                  form="jazmine-checkout-form"
                  disabled={loading}
                  className="flex-1 bg-[#6D2932] py-3 text-xs font-medium uppercase tracking-widest text-[#F9F6F0] hover:bg-[#561E26] disabled:opacity-60 cursor-pointer"
                >
                  {loading ? 'Processing Order...' : `Confirm $${subtotal.toLocaleString()}`}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
