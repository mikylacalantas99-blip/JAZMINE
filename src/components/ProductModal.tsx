import React, { useEffect, useState } from 'react';
import {
  X,
  Heart,
  MessageSquare,
  Repeat,
  ShoppingBag,
  Award,
  Star,
  Flag,
  MapPin,
} from 'lucide-react';
import { apiFetch } from '../lib/api';
import { SafeImage } from './SafeImage';
import type { Product, Review, User } from '../types';

interface ProductModalProps {
  product: Product | null;
  currentUser: User | null;
  isWishlisted: boolean;
  onClose: () => void;
  onAddToCart: (product: Product) => void;
  onToggleWishlist: (productId: string) => void;
  onStartNegotiation: (product: Product) => void;
  onProposeBarter: (product: Product) => void;
  onRequireAuth: () => void;
  onNotifyToast: (msg: string) => void;
}

export const ProductModal: React.FC<ProductModalProps> = ({
  product,
  currentUser,
  isWishlisted,
  onClose,
  onAddToCart,
  onToggleWishlist,
  onStartNegotiation,
  onProposeBarter,
  onRequireAuth,
  onNotifyToast,
}) => {
  const [activePhotoIndex, setActivePhotoIndex] = useState(0);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [showReportForm, setShowReportForm] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [submittingReport, setSubmittingReport] = useState(false);

  useEffect(() => {
    setActivePhotoIndex(0);
    setShowReportForm(false);
    setReportReason('');
    if (!product) return;
    apiFetch<{ product: Product; reviews: Review[] }>(`/api/products/${product.id}`)
      .then((res) => setReviews(res.reviews || []))
      .catch(() => setReviews([]));
  }, [product]);

  if (!product) return null;

  const isOwnListing = currentUser?.id === product.seller_id;
  const isSoldOut = product.stock <= 0 || product.status === 'sold_out';
  const savingsPct =
    product.original_price > product.price
      ? Math.round(((product.original_price - product.price) / product.original_price) * 100)
      : 0;

  const handleReportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) {
      onRequireAuth();
      return;
    }
    if (!reportReason.trim()) return;
    setSubmittingReport(true);
    try {
      await apiFetch('/api/reports', {
        method: 'POST',
        body: JSON.stringify({
          targetType: 'product',
          targetId: product.id,
          reason: reportReason.trim(),
        }),
      });
      setShowReportForm(false);
      setReportReason('');
      onNotifyToast('Report submitted to JAZMINE Moderation Desk.');
    } catch (err) {
      onNotifyToast(err instanceof Error ? err.message : 'Could not submit report');
    } finally {
      setSubmittingReport(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#3B281E]/60 p-0 backdrop-blur-xs md:p-6">
      <div className="relative flex max-h-screen w-full max-w-5xl flex-col overflow-y-auto border border-[#D8CEBA] bg-[#F9F6F0] shadow-2xl md:max-h-[90vh]">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close product details"
          className="fixed right-3 top-3 z-20 flex h-11 w-11 items-center justify-center border border-[#D8CEBA] bg-[#F9F6F0]/95 text-[#3B281E] hover:border-[#6D2932] md:absolute cursor-pointer"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="grid grid-cols-1 lg:grid-cols-12">
          {/* Left: Multi-Photo Gallery */}
          <div className="bg-[#EFE9DD] p-4 sm:p-6 lg:col-span-7">
            <div className="aspect-[4/3] w-full overflow-hidden border border-[#D8CEBA] bg-[#E6DEC8]">
              <SafeImage
                src={product.images[activePhotoIndex] || product.images[0]}
                alt={product.title}
                className="h-full w-full object-cover"
              />
            </div>

            {product.images.length > 1 && (
              <div className="mt-3 flex gap-3 overflow-x-auto pb-1">
                {product.images.map((img, idx) => (
                  <button
                    key={`${img}-${idx}`}
                    type="button"
                    onClick={() => setActivePhotoIndex(idx)}
                    className={`h-20 w-24 shrink-0 overflow-hidden border transition-all cursor-pointer ${
                      activePhotoIndex === idx
                        ? 'border-[#6D2932] ring-1 ring-[#6D2932]'
                        : 'border-[#D8CEBA] opacity-75 hover:opacity-100'
                    }`}
                  >
                    <SafeImage
                      src={img}
                      alt={`${product.title} view ${idx + 1}`}
                      className="h-full w-full object-cover"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Right: Contiguous Purchase Module */}
          <div className="flex flex-col justify-between p-6 sm:p-8 lg:col-span-5">
            <div>
              <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-[#6E5B4F]">
                <span>{product.brand}</span>
                <span aria-hidden="true">·</span>
                <span>{product.category}</span>
              </div>

              <h2 className="mt-2 font-serif-editorial text-3xl font-semibold leading-tight text-[#3B281E]">
                {product.title}
              </h2>

              <div className="mt-4 flex items-baseline gap-3 border-b border-[#D8CEBA] pb-4">
                <span className="text-2xl font-semibold text-[#3B281E] tabular-nums">
                  ${product.price.toLocaleString()}
                </span>
                {product.original_price > product.price && (
                  <>
                    <span className="text-sm text-[#6E5B4F] line-through tabular-nums">
                      ${product.original_price.toLocaleString()}
                    </span>
                    <span className="text-xs font-medium text-[#6D2932] tabular-nums">
                      {savingsPct}% below retail
                    </span>
                  </>
                )}
              </div>

              <div className="mt-4 grid grid-cols-3 gap-3 border-b border-[#D8CEBA] pb-4 text-xs">
                <div>
                  <span className="block text-[#6E5B4F]">Size</span>
                  <span className="mt-0.5 block font-semibold text-[#3B281E]">{product.size}</span>
                </div>
                <div>
                  <span className="block text-[#6E5B4F]">Condition</span>
                  <span className="mt-0.5 block font-semibold text-[#3B281E]">
                    {product.condition}
                  </span>
                </div>
                <div>
                  <span className="block text-[#6E5B4F]">Availability</span>
                  <span
                    className={`mt-0.5 block font-semibold tabular-nums ${
                      isSoldOut ? 'text-[#6D2932]' : 'text-[#3B281E]'
                    }`}
                  >
                    {isSoldOut ? 'Sold Out' : `${product.stock} in archive`}
                  </span>
                </div>
              </div>

              <p className="mt-4 text-sm leading-relaxed text-[#3B281E]/90">
                {product.description}
              </p>

              {product.allow_barter && (
                <div className="mt-4 border border-[#D8CEBA] bg-[#EFE9DD] p-3.5">
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#6D2932]">
                    <Repeat className="h-3.5 w-3.5" />
                    <span>Open to Barter Exchange</span>
                  </div>
                  {product.barter_preferences && (
                    <p className="mt-1 text-xs leading-relaxed text-[#6E5B4F]">
                      {product.barter_preferences}
                    </p>
                  )}
                </div>
              )}

              {/* Seller Storefront Summary */}
              <div className="mt-5 border border-[#D8CEBA] bg-[#EFE9DD]/60 p-4">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-[#3B281E]">
                      {product.seller_store_name}
                    </p>
                    <div className="mt-0.5 flex items-center gap-1.5 text-xs text-[#6E5B4F]">
                      <MapPin className="h-3 w-3 text-[#B08D57]" />
                      <span>{product.seller_location || 'Private Atelier'}</span>
                    </div>
                  </div>
                  {product.review_count > 0 && (
                    <div className="flex items-center gap-1 text-xs font-medium text-[#3B281E] tabular-nums">
                      <Star className="h-3.5 w-3.5 fill-[#B08D57] text-[#B08D57]" />
                      <span>{product.rating_avg}</span>
                      <span className="text-[#6E5B4F]">({product.review_count})</span>
                    </div>
                  )}
                </div>
                {product.seller_badges.length > 0 && (
                  <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#6E5B4F]">
                    {product.seller_badges.map((badge) => (
                      <span key={badge} className="inline-flex items-center gap-1 text-[#3B281E]">
                        <Award className="h-3.5 w-3.5 text-[#B08D57]" />
                        {badge}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="mt-6 space-y-2.5">
              <div className="flex gap-2.5">
                <button
                  type="button"
                  disabled={isSoldOut || isOwnListing}
                  onClick={() => {
                    onAddToCart(product);
                    onNotifyToast(`Added ${product.title} to your shopping bag.`);
                  }}
                  className="flex flex-1 items-center justify-center gap-2 bg-[#6D2932] px-5 py-3.5 text-xs font-medium uppercase tracking-widest text-[#F9F6F0] transition-colors hover:bg-[#561E26] disabled:cursor-not-allowed disabled:bg-[#D8CEBA] disabled:text-[#6E5B4F] cursor-pointer"
                >
                  <ShoppingBag className="h-4 w-4" />
                  {isOwnListing ? 'Your Listing' : isSoldOut ? 'Sold Out' : 'Add to Bag'}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if (!currentUser) {
                      onRequireAuth();
                      return;
                    }
                    onToggleWishlist(product.id);
                  }}
                  aria-label="Save to wishlist"
                  className={`flex h-12 w-12 items-center justify-center border transition-colors cursor-pointer ${
                    isWishlisted
                      ? 'border-[#6D2932] bg-[#6D2932] text-[#F9F6F0]'
                      : 'border-[#D8CEBA] bg-white text-[#3B281E] hover:border-[#6D2932]'
                  }`}
                >
                  <Heart className={`h-4 w-4 ${isWishlisted ? 'fill-current' : ''}`} />
                </button>
              </div>

              {!isOwnListing && (
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => {
                      if (!currentUser) {
                        onRequireAuth();
                        return;
                      }
                      onStartNegotiation(product);
                    }}
                    className="flex items-center justify-center gap-2 border border-[#3B281E] bg-transparent px-3 py-2.5 text-xs font-medium text-[#3B281E] transition-colors hover:bg-[#3B281E] hover:text-[#F9F6F0] cursor-pointer"
                  >
                    <MessageSquare className="h-3.5 w-3.5" />
                    Negotiate Price
                  </button>

                  {product.allow_barter && (
                    <button
                      type="button"
                      disabled={isSoldOut}
                      onClick={() => {
                        if (!currentUser) {
                          onRequireAuth();
                          return;
                        }
                        onProposeBarter(product);
                      }}
                      className="flex items-center justify-center gap-2 border border-[#B08D57] bg-[#EFE9DD] px-3 py-2.5 text-xs font-medium text-[#3B281E] transition-colors hover:bg-[#E6DEC8] disabled:opacity-50 cursor-pointer"
                    >
                      <Repeat className="h-3.5 w-3.5 text-[#6D2932]" />
                      Propose Barter
                    </button>
                  )}
                </div>
              )}

              <div className="pt-1 text-right">
                <button
                  type="button"
                  onClick={() => setShowReportForm((v) => !v)}
                  className="inline-flex items-center gap-1 text-xs text-[#6E5B4F] hover:text-[#6D2932] cursor-pointer"
                >
                  <Flag className="h-3 w-3" />
                  Report Listing
                </button>
              </div>

              {showReportForm && (
                <form onSubmit={handleReportSubmit} className="border border-[#D8CEBA] bg-white p-3">
                  <textarea
                    rows={2}
                    required
                    value={reportReason}
                    onChange={(e) => setReportReason(e.target.value)}
                    placeholder="Describe authenticity concern or policy issue..."
                    className="w-full border border-[#D8CEBA] p-2 text-xs text-[#3B281E] focus:border-[#6D2932] focus:outline-none"
                  />
                  <div className="mt-2 flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setShowReportForm(false)}
                      className="px-3 py-1.5 text-xs text-[#6E5B4F] cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={submittingReport}
                      className="bg-[#3B281E] px-3 py-1.5 text-xs font-medium text-[#F9F6F0] cursor-pointer"
                    >
                      Submit Report
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>

        {/* Verified Transaction Reviews */}
        <div className="border-t border-[#D8CEBA] bg-[#F9F6F0] px-6 py-6 sm:px-8">
          <h3 className="font-serif-editorial text-2xl font-semibold text-[#3B281E]">
            Verified Collector Reviews
          </h3>
          {reviews.length === 0 ? (
            <p className="mt-2 text-sm text-[#6E5B4F]">
              No reviews yet for this specific archive piece. All JAZMINE reviews are tied to delivered orders.
            </p>
          ) : (
            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
              {reviews.map((rev) => (
                <div key={rev.id} className="border border-[#D8CEBA] bg-white p-4">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-[#3B281E]">{rev.reviewer_name}</span>
                    <div className="flex items-center gap-0.5 text-[#B08D57]">
                      {Array.from({ length: rev.rating }).map((_, i) => (
                        <Star key={i} className="h-3.5 w-3.5 fill-current" />
                      ))}
                    </div>
                  </div>
                  <p className="mt-2 text-sm leading-relaxed text-[#3B281E]/90">{rev.comment}</p>
                  <p className="mt-2 text-xs text-[#6E5B4F]">
                    Verified Purchase · {new Date(rev.created_at).toLocaleDateString()}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
