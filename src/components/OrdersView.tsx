import React, { useEffect, useState } from 'react';
import { PackageCheck, Star, Truck, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { apiFetch } from '../lib/api';
import { SafeImage } from './SafeImage';
import type { Order, OrderItem, User } from '../types';

interface OrdersViewProps {
  currentUser: User | null;
  onRequireAuth: () => void;
  onNotifyToast: (msg: string) => void;
  refreshSignal: number;
}

const STAGES: Array<Order['status']> = ['Placed', 'Authenticated', 'Shipped', 'Delivered'];

export const OrdersView: React.FC<OrdersViewProps> = ({
  currentUser,
  onRequireAuth,
  onNotifyToast,
  refreshSignal,
}) => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [reviewTarget, setReviewTarget] = useState<{ orderId: string; item: OrderItem } | null>(null);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadOrders = () => {
    if (!currentUser) return;
    apiFetch<{ orders: Order[] }>('/api/orders')
      .then((res) => setOrders(res.orders || []))
      .catch(() => setOrders([]));
  };

  useEffect(() => {
    loadOrders();
  }, [currentUser, refreshSignal]);

  if (!currentUser) {
    return (
      <section className="mx-auto max-w-4xl px-4 py-16 text-center">
        <h2 className="font-serif-editorial text-3xl font-semibold text-[#3B281E]">
          Order Tracking &amp; Provenance Ledger
        </h2>
        <p className="mt-2 text-sm text-[#6E5B4F]">
          Sign in to track shipments, authentication milestones, and submit verified reviews.
        </p>
        <button
          type="button"
          onClick={onRequireAuth}
          className="mt-6 bg-[#6D2932] px-6 py-3 text-xs font-medium uppercase tracking-widest text-[#F9F6F0] cursor-pointer"
        >
          Sign In to View Orders
        </button>
      </section>
    );
  }

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewTarget) return;
    setSubmitting(true);
    try {
      await apiFetch('/api/reviews', {
        method: 'POST',
        body: JSON.stringify({
          orderId: reviewTarget.orderId,
          productId: reviewTarget.item.product_id,
          rating,
          comment,
        }),
      });
      onNotifyToast('Verified review published to the storefront.');
      setReviewTarget(null);
      setComment('');
      setRating(5);
      loadOrders();
    } catch (err) {
      onNotifyToast(err instanceof Error ? err.message : 'Failed to submit review');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="border-b border-[#D8CEBA] pb-5">
        <p className="text-xs font-medium uppercase tracking-widest text-[#B08D57]">
          Insured Courier &amp; Authentication
        </p>
        <h1 className="mt-1 font-serif-editorial text-4xl font-semibold text-[#3B281E]">
          Orders &amp; Tracking
        </h1>
      </div>

      {orders.length === 0 ? (
        <div className="mt-8 border border-[#D8CEBA] bg-[#EFE9DD]/50 p-10 text-center">
          <p className="font-serif-editorial text-2xl text-[#3B281E]">No orders placed yet</p>
          <p className="mt-2 text-sm text-[#6E5B4F]">
            Your purchases and real-time shipment milestones will appear here.
          </p>
        </div>
      ) : (
        <div className="mt-8 space-y-6">
          {orders.map((order) => {
            const stageIndex = STAGES.indexOf(order.status);
            return (
              <div key={order.id} className="border border-[#D8CEBA] bg-white p-6">
                <div className="flex flex-col justify-between gap-4 border-b border-[#D8CEBA] pb-4 sm:flex-row sm:items-center">
                  <div>
                    <div className="flex items-center gap-3 text-xs text-[#6E5B4F] tabular-nums">
                      <span className="font-semibold text-[#3B281E]">{order.id}</span>
                      <span aria-hidden="true">·</span>
                      <span>{new Date(order.created_at).toLocaleDateString()}</span>
                      <span aria-hidden="true">·</span>
                      <span>Tracking: {order.tracking_code}</span>
                    </div>
                    <p className="mt-1 text-xs text-[#6E5B4F]">
                      Ship to: {order.shipping_name}, {order.shipping_address}, {order.shipping_city}{' '}
                      {order.shipping_postal} · {order.payment_method}
                    </p>
                  </div>
                  <div className="text-left sm:text-right">
                    <span className="block text-xs uppercase tracking-wider text-[#6E5B4F]">
                      Total Paid
                    </span>
                    <span className="text-xl font-semibold text-[#3B281E] tabular-nums">
                      ${order.total_amount.toLocaleString()}
                    </span>
                  </div>
                </div>

                {/* 4-Stage Milestone Bar */}
                <div className="mt-5 grid grid-cols-4 gap-2 border-b border-[#D8CEBA] pb-5">
                  {STAGES.map((st, idx) => {
                    const reached = stageIndex >= idx;
                    const Icon =
                      idx === 0
                        ? PackageCheck
                        : idx === 1
                        ? ShieldCheck
                        : idx === 2
                        ? Truck
                        : CheckCircle2;
                    return (
                      <div key={st} className="flex flex-col items-center text-center">
                        <div
                          className={`flex h-9 w-9 items-center justify-center border ${
                            reached
                              ? 'border-[#6D2932] bg-[#6D2932] text-[#F9F6F0]'
                              : 'border-[#D8CEBA] bg-[#EFE9DD] text-[#6E5B4F]'
                          }`}
                        >
                          <Icon className="h-4 w-4" />
                        </div>
                        <span
                          className={`mt-1.5 text-xs font-medium ${
                            reached ? 'text-[#3B281E]' : 'text-[#6E5B4F]'
                          }`}
                        >
                          {st}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {/* Line Items */}
                <div className="mt-4 divide-y divide-[#D8CEBA]">
                  {order.items.map((item) => (
                    <div
                      key={item.id}
                      className="flex flex-col justify-between gap-4 py-3 sm:flex-row sm:items-center"
                    >
                      <div className="flex items-center gap-4">
                        <div className="h-16 w-20 shrink-0 overflow-hidden border border-[#D8CEBA] bg-[#EFE9DD]">
                          <SafeImage
                            src={item.image}
                            alt={item.title}
                            className="h-full w-full object-cover"
                          />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-[#3B281E]">{item.title}</p>
                          <p className="text-xs text-[#6E5B4F] tabular-nums">
                            {item.seller_store_name} · Qty {item.quantity} · $
                            {item.unit_price.toLocaleString()}
                          </p>
                        </div>
                      </div>

                      {order.status === 'Delivered' && (
                        <div>
                          {item.has_review ? (
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-[#6E5B4F]">
                              <CheckCircle2 className="h-3.5 w-3.5 text-[#B08D57]" />
                              Verified Review Submitted
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setReviewTarget({ orderId: order.id, item })}
                              className="inline-flex items-center gap-1.5 border border-[#3B281E] px-3.5 py-2 text-xs font-medium text-[#3B281E] hover:bg-[#3B281E] hover:text-[#F9F6F0] cursor-pointer"
                            >
                              <Star className="h-3.5 w-3.5 text-[#B08D57]" />
                              Write Verified Review
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {reviewTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#3B281E]/55 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md border border-[#D8CEBA] bg-[#F9F6F0] p-6 shadow-2xl">
            <h3 className="font-serif-editorial text-2xl font-semibold text-[#3B281E]">
              Verified Purchase Review
            </h3>
            <p className="mt-1 text-xs text-[#6E5B4F]">{reviewTarget.item.title}</p>

            <form onSubmit={handleSubmitReview} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-medium uppercase tracking-wider text-[#6E5B4F]">
                  Rating
                </label>
                <div className="mt-1.5 flex gap-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setRating(star)}
                      className="flex h-10 w-10 items-center justify-center border border-[#D8CEBA] bg-white cursor-pointer"
                    >
                      <Star
                        className={`h-5 w-5 ${
                          star <= rating ? 'fill-[#B08D57] text-[#B08D57]' : 'text-[#D8CEBA]'
                        }`}
                      />
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium uppercase tracking-wider text-[#6E5B4F]">
                  Your Experience
                </label>
                <textarea
                  rows={4}
                  required
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Comment on packaging, garment authenticity, and seller communication..."
                  className="mt-1.5 w-full border border-[#D8CEBA] bg-white p-3 text-sm text-[#3B281E] focus:border-[#6D2932] focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setReviewTarget(null)}
                  className="border border-[#D8CEBA] bg-white px-4 py-2.5 text-xs font-medium text-[#3B281E] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="bg-[#6D2932] px-5 py-2.5 text-xs font-medium uppercase tracking-wider text-[#F9F6F0] cursor-pointer"
                >
                  {submitting ? 'Publishing...' : 'Publish Review'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
};
