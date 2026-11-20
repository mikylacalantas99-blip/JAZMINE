import React, { useEffect, useState } from 'react';
import { Repeat, ArrowRightLeft, Check, X, Upload } from 'lucide-react';
import { apiFetch, compressImageFile } from '../lib/api';
import { SafeImage } from './SafeImage';
import type { BarterOffer, Product, User } from '../types';

interface BarterRoomProps {
  currentUser: User | null;
  products: Product[];
  initialTarget: Product | null;
  onClearInitialTarget: () => void;
  onRequireAuth: () => void;
  onRefreshData: () => void;
  onNotifyToast: (msg: string) => void;
  refreshSignal: number;
}

export const BarterRoom: React.FC<BarterRoomProps> = ({
  currentUser,
  products,
  initialTarget,
  onClearInitialTarget,
  onRequireAuth,
  onRefreshData,
  onNotifyToast,
  refreshSignal,
}) => {
  const [offers, setOffers] = useState<BarterOffer[]>([]);
  const [targetProduct, setTargetProduct] = useState<Product | null>(initialTarget);
  const [offeredProductId, setOfferedProductId] = useState<string>('');
  const [customTitle, setCustomTitle] = useState('');
  const [customImage, setCustomImage] = useState('/src/assets/images/product_silk_scarf_1795191632718.jpg');
  const [cashTopup, setCashTopup] = useState('0');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const barterCatalog = products.filter(
    (p) => p.allow_barter && p.status === 'active' && p.stock > 0
  );
  const myListings = currentUser
    ? products.filter((p) => p.seller_id === currentUser.id && p.status === 'active' && p.stock > 0)
    : [];

  useEffect(() => {
    if (initialTarget) setTargetProduct(initialTarget);
  }, [initialTarget]);

  const loadOffers = () => {
    if (!currentUser) {
      setOffers([]);
      return;
    }
    apiFetch<{ offers: BarterOffer[] }>('/api/barters')
      .then((res) => setOffers(res.offers || []))
      .catch(() => setOffers([]));
  };

  useEffect(() => {
    loadOffers();
  }, [currentUser, refreshSignal]);

  const handleUploadCustomPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await compressImageFile(file, 720);
      setCustomImage(dataUrl);
    } catch {
      onNotifyToast('Could not process image file.');
    }
  };

  const handleSubmitBarter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) {
      onRequireAuth();
      return;
    }
    if (!targetProduct) return;

    setSubmitting(true);
    try {
      await apiFetch('/api/barters', {
        method: 'POST',
        body: JSON.stringify({
          requestedProductId: targetProduct.id,
          offeredProductId: offeredProductId || null,
          offeredItemTitle: offeredProductId ? undefined : customTitle,
          offeredItemImage: offeredProductId ? undefined : customImage,
          cashTopup: Number(cashTopup || 0),
          message,
        }),
      });
      onNotifyToast('Barter proposal sent to the archive owner.');
      setTargetProduct(null);
      onClearInitialTarget();
      setOfferedProductId('');
      setCustomTitle('');
      setCashTopup('0');
      setMessage('');
      loadOffers();
    } catch (err) {
      onNotifyToast(err instanceof Error ? err.message : 'Failed to send barter offer');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDecision = async (barterId: string, status: 'accepted' | 'declined') => {
    try {
      await apiFetch(`/api/barters/${barterId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      onNotifyToast(
        status === 'accepted'
          ? 'Barter accepted! Inventory has been updated.'
          : 'Barter proposal declined.'
      );
      loadOffers();
      onRefreshData();
    } catch (err) {
      onNotifyToast(err instanceof Error ? err.message : 'Could not update barter');
    }
  };

  return (
    <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="border-b border-[#D8CEBA] pb-6">
        <p className="text-xs font-medium uppercase tracking-widest text-[#B08D57]">
          Circular Heritage Exchange
        </p>
        <div className="mt-2 flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <h1 className="font-serif-editorial text-4xl font-semibold text-[#3B281E]">
              The Barter Room
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[#6E5B4F]">
              Propose direct piece-for-piece trades with fellow collectors and independent storefronts,
              with optional cash balance adjustments. Accepted trades reserve both items automatically.
            </p>
          </div>
          <div className="text-xs text-[#6E5B4F] tabular-nums">
            {barterCatalog.length} pieces open to exchange
          </div>
        </div>
      </div>

      {/* Active Proposals Section */}
      {currentUser && (
        <div className="mt-8">
          <h2 className="font-serif-editorial text-2xl font-semibold text-[#3B281E]">
            Your Active Barter Ledger ({offers.length})
          </h2>
          {offers.length === 0 ? (
            <div className="mt-3 border border-[#D8CEBA] bg-[#EFE9DD]/50 p-6 text-sm text-[#6E5B4F]">
              No active trade proposals yet. Select any barter-eligible piece below to initiate an exchange.
            </div>
          ) : (
            <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
              {offers.map((offer) => {
                const isRecipient = offer.recipient_id === currentUser.id;
                return (
                  <div
                    key={offer.id}
                    className="flex flex-col justify-between border border-[#D8CEBA] bg-white p-5"
                  >
                    <div className="flex items-center justify-between border-b border-[#D8CEBA] pb-3 text-xs">
                      <span className="font-medium text-[#6E5B4F]">
                        {isRecipient
                          ? `Incoming from ${offer.proposer_name}`
                          : `Sent to ${offer.recipient_store_name}`}
                      </span>
                      <span
                        className={`font-semibold uppercase tracking-wider ${
                          offer.status === 'accepted'
                            ? 'text-[#3B281E]'
                            : offer.status === 'declined'
                            ? 'text-[#6E5B4F]'
                            : 'text-[#6D2932]'
                        }`}
                      >
                        {offer.status}
                      </span>
                    </div>

                    <div className="mt-4 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                      <div className="flex items-center gap-3">
                        <div className="h-16 w-16 shrink-0 overflow-hidden border border-[#D8CEBA] bg-[#EFE9DD]">
                          <SafeImage
                            src={offer.offered_item_image}
                            alt={offer.offered_item_title}
                            className="h-full w-full object-cover"
                          />
                        </div>
                        <div className="min-w-0">
                          <span className="block text-[11px] uppercase tracking-wider text-[#6E5B4F]">
                            Offered
                          </span>
                          <p className="truncate text-sm font-semibold text-[#3B281E]">
                            {offer.offered_item_title}
                          </p>
                          {offer.cash_topup > 0 && (
                            <span className="text-xs font-medium text-[#6D2932] tabular-nums">
                              + ${offer.cash_topup.toLocaleString()} balance
                            </span>
                          )}
                        </div>
                      </div>

                      <ArrowRightLeft className="h-4 w-4 text-[#B08D57]" />

                      <div className="flex items-center gap-3">
                        <div className="h-16 w-16 shrink-0 overflow-hidden border border-[#D8CEBA] bg-[#EFE9DD]">
                          <SafeImage
                            src={offer.requested_product_image}
                            alt={offer.requested_product_title}
                            className="h-full w-full object-cover"
                          />
                        </div>
                        <div className="min-w-0">
                          <span className="block text-[11px] uppercase tracking-wider text-[#6E5B4F]">
                            Requested
                          </span>
                          <p className="truncate text-sm font-semibold text-[#3B281E]">
                            {offer.requested_product_title}
                          </p>
                          <span className="text-xs text-[#6E5B4F] tabular-nums">
                            Est. ${offer.requested_product_price.toLocaleString()}
                          </span>
                        </div>
                      </div>
                    </div>

                    {offer.message && (
                      <p className="mt-3 border-t border-[#D8CEBA]/60 pt-3 text-xs italic text-[#6E5B4F]">
                        &ldquo;{offer.message}&rdquo;
                      </p>
                    )}

                    {isRecipient && offer.status === 'pending' && (
                      <div className="mt-4 flex gap-2.5">
                        <button
                          type="button"
                          onClick={() => handleDecision(offer.id, 'accepted')}
                          className="flex flex-1 items-center justify-center gap-1.5 bg-[#6D2932] py-2.5 text-xs font-medium uppercase tracking-wider text-[#F9F6F0] hover:bg-[#561E26] cursor-pointer"
                        >
                          <Check className="h-3.5 w-3.5" />
                          Accept Trade
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDecision(offer.id, 'declined')}
                          className="flex flex-1 items-center justify-center gap-1.5 border border-[#D8CEBA] bg-[#EFE9DD] py-2.5 text-xs font-medium uppercase tracking-wider text-[#3B281E] hover:bg-[#E6DEC8] cursor-pointer"
                        >
                          <X className="h-3.5 w-3.5" />
                          Decline
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Barter-Eligible Catalog */}
      <div className="mt-10">
        <h2 className="font-serif-editorial text-2xl font-semibold text-[#3B281E]">
          Pieces Open to Barter
        </h2>
        <div className="mt-4 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {barterCatalog.map((item) => {
            const isOwn = currentUser?.id === item.seller_id;
            return (
              <div
                key={item.id}
                className="flex flex-col justify-between border border-[#D8CEBA] bg-white transition-transform duration-200 hover:-translate-y-0.5"
              >
                <div>
                  <div className="aspect-[4/3] overflow-hidden bg-[#EFE9DD]">
                    <SafeImage
                      src={item.images[0]}
                      alt={item.title}
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <div className="p-5">
                    <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-[#6E5B4F]">
                      <span>{item.brand}</span>
                      <span aria-hidden="true">·</span>
                      <span>{item.size}</span>
                    </div>
                    <h3 className="mt-1 font-serif-editorial text-xl font-semibold text-[#3B281E]">
                      {item.title}
                    </h3>
                    <p className="mt-1 text-sm font-medium text-[#3B281E] tabular-nums">
                      Archive Value: ${item.price.toLocaleString()}
                    </p>
                    <p className="mt-2.5 text-xs leading-relaxed text-[#6E5B4F]">
                      <strong className="text-[#3B281E]">Seeking:</strong>{' '}
                      {item.barter_preferences || 'Open to curated wardrobe trades.'}
                    </p>
                  </div>
                </div>
                <div className="border-t border-[#D8CEBA] px-5 py-3.5">
                  <button
                    type="button"
                    disabled={isOwn}
                    onClick={() => {
                      if (!currentUser) {
                        onRequireAuth();
                        return;
                      }
                      setTargetProduct(item);
                    }}
                    className="flex w-full items-center justify-center gap-2 bg-[#3B281E] py-2.5 text-xs font-medium uppercase tracking-widest text-[#F9F6F0] transition-colors hover:bg-[#6D2932] disabled:bg-[#D8CEBA] disabled:text-[#6E5B4F] cursor-pointer"
                  >
                    <Repeat className="h-3.5 w-3.5" />
                    {isOwn ? 'Your Listing' : 'Propose Barter'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Propose Barter Modal */}
      {targetProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#3B281E]/60 p-4 backdrop-blur-xs">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto border border-[#D8CEBA] bg-[#F9F6F0] p-6 shadow-2xl">
            <div className="flex items-start justify-between border-b border-[#D8CEBA] pb-4">
              <div>
                <p className="text-xs uppercase tracking-widest text-[#B08D57]">
                  Propose Exchange
                </p>
                <h3 className="mt-1 font-serif-editorial text-2xl font-semibold text-[#3B281E]">
                  For: {targetProduct.title}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setTargetProduct(null);
                  onClearInitialTarget();
                }}
                aria-label="Close barter modal"
                className="flex h-10 w-10 items-center justify-center text-[#6E5B4F] hover:text-[#3B281E] cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitBarter} className="mt-5 space-y-4">
              {myListings.length > 0 && (
                <div>
                  <label className="block text-xs font-medium uppercase tracking-wider text-[#6E5B4F]">
                    Select From Your Store Inventory (Optional)
                  </label>
                  <select
                    value={offeredProductId}
                    onChange={(e) => setOfferedProductId(e.target.value)}
                    className="mt-1.5 w-full border border-[#D8CEBA] bg-white px-3 py-2.5 text-sm text-[#3B281E] focus:border-[#6D2932] focus:outline-none"
                  >
                    <option value="">-- Or describe a piece from your personal wardrobe --</option>
                    {myListings.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.title} (${p.price})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {!offeredProductId && (
                <>
                  <div>
                    <label className="block text-xs font-medium uppercase tracking-wider text-[#6E5B4F]">
                      Your Offered Piece Title
                    </label>
                    <input
                      type="text"
                      required
                      value={customTitle}
                      onChange={(e) => setCustomTitle(e.target.value)}
                      placeholder="e.g. Vintage Celine Box Bag in Chestnut"
                      className="mt-1.5 w-full border border-[#D8CEBA] bg-white px-3.5 py-2.5 text-sm text-[#3B281E] focus:border-[#6D2932] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium uppercase tracking-wider text-[#6E5B4F]">
                      Piece Photo
                    </label>
                    <div className="mt-1.5 flex items-center gap-3">
                      <div className="h-14 w-16 overflow-hidden border border-[#D8CEBA] bg-[#EFE9DD]">
                        <SafeImage
                          src={customImage}
                          alt="Offered item preview"
                          className="h-full w-full object-cover"
                        />
                      </div>
                      <label className="inline-flex items-center gap-2 border border-[#D8CEBA] bg-white px-3 py-2 text-xs font-medium text-[#3B281E] hover:border-[#6D2932] cursor-pointer">
                        <Upload className="h-3.5 w-3.5" />
                        Upload Photo
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleUploadCustomPhoto}
                          className="hidden"
                        />
                      </label>
                    </div>
                  </div>
                </>
              )}

              <div>
                <label className="block text-xs font-medium uppercase tracking-wider text-[#6E5B4F]">
                  Optional Cash Top-Up ($)
                </label>
                <input
                  type="number"
                  min={0}
                  value={cashTopup}
                  onChange={(e) => setCashTopup(e.target.value)}
                  className="mt-1.5 w-full border border-[#D8CEBA] bg-white px-3.5 py-2.5 text-sm text-[#3B281E] tabular-nums focus:border-[#6D2932] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium uppercase tracking-wider text-[#6E5B4F]">
                  Note to {targetProduct.seller_store_name}
                </label>
                <textarea
                  rows={3}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Share condition notes, sizing, or provenance..."
                  className="mt-1.5 w-full border border-[#D8CEBA] bg-white px-3.5 py-2.5 text-sm text-[#3B281E] focus:border-[#6D2932] focus:outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-[#6D2932] py-3 text-xs font-medium uppercase tracking-widest text-[#F9F6F0] hover:bg-[#561E26] disabled:opacity-60 cursor-pointer"
              >
                {submitting ? 'Sending Proposal...' : 'Submit Barter Proposal'}
              </button>
            </form>
          </div>
        </div>
      )}
    </section>
  );
};
