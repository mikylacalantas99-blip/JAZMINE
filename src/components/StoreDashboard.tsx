import React, { useEffect, useState } from 'react';
import {
  Plus,
  Store,
  Award,
  Upload,
  Trash2,
  X,
  Package,
  Minus,
  CheckCircle2,
  Sparkles,
} from 'lucide-react';
import { apiFetch, compressImageFile } from '../lib/api';
import { SafeImage } from './SafeImage';
import type { Order, Product, User } from '../types';

interface StoreDashboardProps {
  currentUser: User | null;
  onRequireAuth: () => void;
  onUserUpdated: (user: User, token: string) => void;
  onRefreshProducts: () => void;
  onNotifyToast: (msg: string) => void;
  refreshSignal: number;
}

const CATEGORIES = ['Outerwear', 'Handbags', 'Accessories', 'Footwear', 'Tailoring', 'Jewelry'];
const CONDITIONS = ['Archival Mint', 'Excellent Pre-Loved', 'Gently Worn'];

const PRESET_STUDIO_IMAGES = [
  '/src/assets/images/product_camel_coat_1795191633356.jpg',
  '/src/assets/images/product_burgundy_bag_1795191632794.jpg',
  '/src/assets/images/product_silk_scarf_1795191632718.jpg',
  '/src/assets/images/product_loafer_shoes_1795191633185.jpg',
  '/src/assets/images/product_tweed_blazer_1795191633154.jpg',
  '/src/assets/images/product_pearl_earrings_1795191633463.jpg',
];

export const StoreDashboard: React.FC<StoreDashboardProps> = ({
  currentUser,
  onRequireAuth,
  onUserUpdated,
  onRefreshProducts,
  onNotifyToast,
  refreshSignal,
}) => {
  const [myProducts, setMyProducts] = useState<Product[]>([]);
  const [sellerOrders, setSellerOrders] = useState<Order[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingStore, setEditingStore] = useState(false);

  // Store profile state
  const [storeName, setStoreName] = useState(currentUser?.store_name || '');
  const [storeLocation, setStoreLocation] = useState(currentUser?.store_location || '');
  const [storeDescription, setStoreDescription] = useState(currentUser?.store_description || '');

  // New listing form state
  const [title, setTitle] = useState('');
  const [brand, setBrand] = useState('');
  const [category, setCategory] = useState('Outerwear');
  const [size, setSize] = useState('');
  const [condition, setCondition] = useState('Archival Mint');
  const [price, setPrice] = useState('');
  const [originalPrice, setOriginalPrice] = useState('');
  const [stock, setStock] = useState('1');
  const [description, setDescription] = useState('');
  const [allowBarter, setAllowBarter] = useState(true);
  const [barterPreferences, setBarterPreferences] = useState('');
  const [images, setImages] = useState<string[]>([PRESET_STUDIO_IMAGES[0]]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (currentUser) {
      setStoreName(currentUser.store_name || `${currentUser.name}'s Atelier`);
      setStoreLocation(currentUser.store_location || '');
      setStoreDescription(currentUser.store_description || '');
    }
  }, [currentUser]);

  const loadStoreData = () => {
    if (!currentUser || (currentUser.role !== 'seller' && currentUser.role !== 'admin')) return;
    apiFetch<{ products: Product[] }>(
      `/api/products?sellerId=${currentUser.id}&includeAll=true`
    )
      .then((res) => setMyProducts(res.products || []))
      .catch(() => setMyProducts([]));

    apiFetch<{ orders: Order[] }>('/api/orders?scope=seller')
      .then((res) => setSellerOrders(res.orders || []))
      .catch(() => setSellerOrders([]));
  };

  useEffect(() => {
    loadStoreData();
  }, [currentUser, refreshSignal]);

  if (!currentUser) {
    return (
      <section className="mx-auto max-w-4xl px-4 py-16 text-center">
        <h2 className="font-serif-editorial text-3xl font-semibold text-[#3B281E]">
          Personal Storefronts &amp; Inventory Ledger
        </h2>
        <p className="mt-2 text-sm text-[#6E5B4F]">
          Sign in to open your boutique storefront, list multi-photo archival pieces, and manage fulfillment.
        </p>
        <button
          type="button"
          onClick={onRequireAuth}
          className="mt-6 bg-[#6D2932] px-6 py-3 text-xs font-medium uppercase tracking-widest text-[#F9F6F0] cursor-pointer"
        >
          Sign In to My Store
        </button>
      </section>
    );
  }

  if (currentUser.role === 'buyer') {
    const handleUpgradeToSeller = async () => {
      try {
        const res = await apiFetch<{ user: User; token: string }>('/api/auth/profile', {
          method: 'PATCH',
          body: JSON.stringify({
            upgradeToSeller: true,
            store_name: storeName || `${currentUser.name}'s Atelier`,
            store_location: storeLocation || 'Private Wardrobe',
            store_description:
              storeDescription || 'Curated pre-loved wardrobe pieces available for purchase or barter.',
          }),
        });
        onUserUpdated(res.user, res.token);
        onNotifyToast('Your personal storefront is now active!');
      } catch (err) {
        onNotifyToast(err instanceof Error ? err.message : 'Could not activate storefront');
      }
    };

    return (
      <section className="mx-auto max-w-3xl px-4 py-12">
        <div className="border border-[#D8CEBA] bg-white p-8">
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-[#B08D57]">
            <Store className="h-4 w-4" />
            <span>Launch Your Boutique</span>
          </div>
          <h1 className="mt-2 font-serif-editorial text-4xl font-semibold text-[#3B281E]">
            Open Your Personal Storefront
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-[#6E5B4F]">
            Activate your JAZMINE Seller Storefront to publish multi-photo listings, manage inventory
            quantities, negotiate directly with buyers, and participate in The Barter Room.
          </p>

          <div className="mt-6 space-y-4">
            <div>
              <label className="block text-xs font-medium uppercase tracking-wider text-[#6E5B4F]">
                Storefront Name
              </label>
              <input
                type="text"
                value={storeName}
                onChange={(e) => setStoreName(e.target.value)}
                className="mt-1 w-full border border-[#D8CEBA] bg-[#F9F6F0]/40 px-3.5 py-2.5 text-sm text-[#3B281E]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium uppercase tracking-wider text-[#6E5B4F]">
                Location / Salon
              </label>
              <input
                type="text"
                value={storeLocation}
                onChange={(e) => setStoreLocation(e.target.value)}
                placeholder="New York · Upper East Side"
                className="mt-1 w-full border border-[#D8CEBA] bg-[#F9F6F0]/40 px-3.5 py-2.5 text-sm text-[#3B281E]"
              />
            </div>
            <button
              type="button"
              onClick={handleUpgradeToSeller}
              className="w-full bg-[#6D2932] py-3.5 text-xs font-medium uppercase tracking-widest text-[#F9F6F0] hover:bg-[#561E26] cursor-pointer"
            >
              Activate My Storefront
            </button>
          </div>
        </div>
      </section>
    );
  }

  const handleSaveStoreProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await apiFetch<{ user: User; token: string }>('/api/auth/profile', {
        method: 'PATCH',
        body: JSON.stringify({
          store_name: storeName,
          store_location: storeLocation,
          store_description: storeDescription,
        }),
      });
      onUserUpdated(res.user, res.token);
      setEditingStore(false);
      onRefreshProducts();
      onNotifyToast('Storefront details updated.');
    } catch (err) {
      onNotifyToast(err instanceof Error ? err.message : 'Update failed');
    }
  };

  const handleMultiPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    try {
      const compressed = await Promise.all(files.slice(0, 5).map((f) => compressImageFile(f, 900)));
      setImages((prev) => [...prev, ...compressed].slice(0, 6));
    } catch {
      onNotifyToast('Could not process one or more photos.');
    }
  };

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await apiFetch('/api/products', {
        method: 'POST',
        body: JSON.stringify({
          title,
          brand,
          category,
          size: size || 'One Size',
          condition,
          description,
          price: Number(price),
          original_price: Number(originalPrice || price),
          stock: Number(stock || 1),
          allow_barter: allowBarter,
          barter_preferences: barterPreferences,
          images: images.length > 0 ? images : [PRESET_STUDIO_IMAGES[0]],
        }),
      });
      setShowCreateModal(false);
      setTitle('');
      setBrand('');
      setSize('');
      setPrice('');
      setOriginalPrice('');
      setStock('1');
      setDescription('');
      setBarterPreferences('');
      setImages([PRESET_STUDIO_IMAGES[0]]);
      loadStoreData();
      onRefreshProducts();
      onNotifyToast('New piece published to JAZMINE.');
    } catch (err) {
      onNotifyToast(err instanceof Error ? err.message : 'Could not publish piece');
    } finally {
      setSaving(false);
    }
  };

  const handleAdjustStock = async (product: Product, delta: number) => {
    const nextStock = Math.max(0, product.stock + delta);
    try {
      await apiFetch(`/api/products/${product.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ stock: nextStock }),
      });
      loadStoreData();
      onRefreshProducts();
    } catch (err) {
      onNotifyToast(err instanceof Error ? err.message : 'Failed to update stock');
    }
  };

  const handleDeleteProduct = async (productId: string) => {
    try {
      await apiFetch(`/api/products/${productId}`, { method: 'DELETE' });
      loadStoreData();
      onRefreshProducts();
      onNotifyToast('Listing removed from inventory.');
    } catch (err) {
      onNotifyToast(err instanceof Error ? err.message : 'Delete failed');
    }
  };

  const handleAdvanceOrder = async (
    orderId: string,
    nextStatus: 'Authenticated' | 'Shipped' | 'Delivered'
  ) => {
    try {
      await apiFetch(`/api/orders/${orderId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: nextStatus }),
      });
      loadStoreData();
      onNotifyToast(`Order ${orderId} updated to ${nextStatus}.`);
    } catch (err) {
      onNotifyToast(err instanceof Error ? err.message : 'Failed to update order');
    }
  };

  const totalInventoryUnits = myProducts.reduce((s, p) => s + p.stock, 0);
  const totalPortfolioValue = myProducts.reduce((s, p) => s + p.price * p.stock, 0);

  return (
    <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Storefront Banner */}
      <div className="border border-[#D8CEBA] bg-white p-6 sm:p-8">
        <div className="flex flex-col justify-between gap-6 md:flex-row md:items-start">
          <div>
            <div className="flex flex-wrap items-center gap-3 text-xs uppercase tracking-widest text-[#B08D57]">
              <span>Personal Storefront</span>
              {currentUser.store_location && (
                <>
                  <span aria-hidden="true">·</span>
                  <span>{currentUser.store_location}</span>
                </>
              )}
            </div>
            <h1 className="mt-1 font-serif-editorial text-4xl font-semibold text-[#3B281E]">
              {currentUser.store_name || `${currentUser.name}'s Atelier`}
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[#6E5B4F]">
              {currentUser.store_description || 'Curated archive of timeless wardrobe investments.'}
            </p>
            {currentUser.badges.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[#3B281E]">
                {currentUser.badges.map((b) => (
                  <span key={b} className="inline-flex items-center gap-1 font-medium">
                    <Award className="h-3.5 w-3.5 text-[#B08D57]" />
                    {b}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => setEditingStore((v) => !v)}
              className="border border-[#D8CEBA] bg-[#EFE9DD] px-4 py-2.5 text-xs font-medium uppercase tracking-wider text-[#3B281E] hover:border-[#6D2932] cursor-pointer"
            >
              {editingStore ? 'Close Editor' : 'Edit Storefront'}
            </button>
            <button
              type="button"
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center gap-2 bg-[#6D2932] px-5 py-2.5 text-xs font-medium uppercase tracking-widest text-[#F9F6F0] hover:bg-[#561E26] cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              New Listing
            </button>
          </div>
        </div>

        {editingStore && (
          <form
            onSubmit={handleSaveStoreProfile}
            className="mt-6 grid grid-cols-1 gap-4 border-t border-[#D8CEBA] pt-6 md:grid-cols-2"
          >
            <div>
              <label className="block text-xs font-medium uppercase tracking-wider text-[#6E5B4F]">
                Store Name
              </label>
              <input
                type="text"
                required
                value={storeName}
                onChange={(e) => setStoreName(e.target.value)}
                className="mt-1 w-full border border-[#D8CEBA] bg-[#F9F6F0]/40 px-3 py-2 text-sm text-[#3B281E]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium uppercase tracking-wider text-[#6E5B4F]">
                Salon Location
              </label>
              <input
                type="text"
                value={storeLocation}
                onChange={(e) => setStoreLocation(e.target.value)}
                className="mt-1 w-full border border-[#D8CEBA] bg-[#F9F6F0]/40 px-3 py-2 text-sm text-[#3B281E]"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-medium uppercase tracking-wider text-[#6E5B4F]">
                Storefront Story
              </label>
              <textarea
                rows={2}
                value={storeDescription}
                onChange={(e) => setStoreDescription(e.target.value)}
                className="mt-1 w-full border border-[#D8CEBA] bg-[#F9F6F0]/40 px-3 py-2 text-sm text-[#3B281E]"
              />
            </div>
            <div className="md:col-span-2 flex justify-end">
              <button
                type="submit"
                className="bg-[#3B281E] px-5 py-2.5 text-xs font-medium uppercase tracking-wider text-[#F9F6F0] cursor-pointer"
              >
                Save Storefront
              </button>
            </div>
          </form>
        )}

        {/* Store KPI Strip */}
        <div className="mt-6 grid grid-cols-2 gap-4 border-t border-[#D8CEBA] pt-6 sm:grid-cols-4">
          <div>
            <span className="text-xs uppercase tracking-wider text-[#6E5B4F]">Active Listings</span>
            <p className="mt-1 text-2xl font-semibold text-[#3B281E] tabular-nums">
              {myProducts.filter((p) => p.status === 'active').length}
            </p>
          </div>
          <div>
            <span className="text-xs uppercase tracking-wider text-[#6E5B4F]">Stock Units</span>
            <p className="mt-1 text-2xl font-semibold text-[#3B281E] tabular-nums">
              {totalInventoryUnits}
            </p>
          </div>
          <div>
            <span className="text-xs uppercase tracking-wider text-[#6E5B4F]">Archive Value</span>
            <p className="mt-1 text-2xl font-semibold text-[#3B281E] tabular-nums">
              ${totalPortfolioValue.toLocaleString()}
            </p>
          </div>
          <div>
            <span className="text-xs uppercase tracking-wider text-[#6E5B4F]">Client Orders</span>
            <p className="mt-1 text-2xl font-semibold text-[#3B281E] tabular-nums">
              {sellerOrders.length}
            </p>
          </div>
        </div>
      </div>

      {/* Inventory Table */}
      <div className="mt-8 border border-[#D8CEBA] bg-white">
        <div className="border-b border-[#D8CEBA] px-6 py-4">
          <h2 className="font-serif-editorial text-2xl font-semibold text-[#3B281E]">
            Inventory &amp; Stock Control
          </h2>
        </div>

        {myProducts.length === 0 ? (
          <div className="p-8 text-center text-sm text-[#6E5B4F]">
            You have no listings yet. Click &ldquo;New Listing&rdquo; to showcase your first piece.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-[#D8CEBA] bg-[#EFE9DD]/60 text-xs uppercase tracking-wider text-[#6E5B4F]">
                <tr>
                  <th className="px-6 py-3 font-medium">Piece</th>
                  <th className="px-4 py-3 font-medium">Category</th>
                  <th className="px-4 py-3 font-medium">Price</th>
                  <th className="px-4 py-3 font-medium">Stock</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-6 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#D8CEBA]">
                {myProducts.map((p) => (
                  <tr key={p.id} className="hover:bg-[#F9F6F0]/60">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="h-12 w-14 shrink-0 overflow-hidden border border-[#D8CEBA] bg-[#EFE9DD]">
                          <SafeImage
                            src={p.images[0]}
                            alt={p.title}
                            className="h-full w-full object-cover"
                          />
                        </div>
                        <div>
                          <p className="font-semibold text-[#3B281E]">{p.title}</p>
                          <p className="text-xs text-[#6E5B4F]">
                            {p.brand} · {p.size} · {p.images.length} photos
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-xs text-[#6E5B4F]">{p.category}</td>
                    <td className="px-4 py-4 font-semibold text-[#3B281E] tabular-nums">
                      ${p.price.toLocaleString()}
                    </td>
                    <td className="px-4 py-4">
                      <div className="inline-flex items-center border border-[#D8CEBA] bg-white">
                        <button
                          type="button"
                          onClick={() => handleAdjustStock(p, -1)}
                          aria-label="Decrease stock"
                          className="flex h-8 w-8 items-center justify-center text-[#3B281E] hover:bg-[#EFE9DD] cursor-pointer"
                        >
                          <Minus className="h-3 w-3" />
                        </button>
                        <span className="w-9 text-center text-xs font-semibold tabular-nums">
                          {p.stock}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleAdjustStock(p, 1)}
                          aria-label="Increase stock"
                          className="flex h-8 w-8 items-center justify-center text-[#3B281E] hover:bg-[#EFE9DD] cursor-pointer"
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-xs font-medium uppercase tracking-wider">
                      <span
                        className={
                          p.status === 'active'
                            ? 'text-[#3B281E]'
                            : p.status === 'flagged'
                            ? 'text-[#6D2932]'
                            : 'text-[#6E5B4F]'
                        }
                      >
                        {p.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        type="button"
                        onClick={() => handleDeleteProduct(p.id)}
                        aria-label={`Delete ${p.title}`}
                        className="inline-flex h-9 w-9 items-center justify-center text-[#6E5B4F] hover:text-[#6D2932] cursor-pointer"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Seller Incoming Orders Fulfillment */}
      <div className="mt-8 border border-[#D8CEBA] bg-white">
        <div className="border-b border-[#D8CEBA] px-6 py-4">
          <h2 className="font-serif-editorial text-2xl font-semibold text-[#3B281E]">
            Incoming Orders &amp; Dispatch
          </h2>
        </div>

        {sellerOrders.length === 0 ? (
          <div className="p-8 text-center text-sm text-[#6E5B4F]">
            No client orders received yet.
          </div>
        ) : (
          <div className="divide-y divide-[#D8CEBA]">
            {sellerOrders.map((ord) => (
              <div
                key={ord.id}
                className="flex flex-col justify-between gap-4 p-6 md:flex-row md:items-center"
              >
                <div>
                  <div className="flex items-center gap-3 text-xs text-[#6E5B4F] tabular-nums">
                    <span className="font-semibold text-[#3B281E]">{ord.id}</span>
                    <span aria-hidden="true">·</span>
                    <span>Buyer: {ord.buyer_name}</span>
                    <span aria-hidden="true">·</span>
                    <span className="font-semibold text-[#6D2932]">{ord.status}</span>
                  </div>
                  <p className="mt-1 text-sm font-medium text-[#3B281E]">
                    {ord.items.map((it) => `${it.title} (×${it.quantity})`).join(', ')}
                  </p>
                  <p className="mt-0.5 text-xs text-[#6E5B4F]">
                    Ship to: {ord.shipping_address}, {ord.shipping_city} {ord.shipping_postal}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  {ord.status === 'Placed' && (
                    <button
                      type="button"
                      onClick={() => handleAdvanceOrder(ord.id, 'Authenticated')}
                      className="inline-flex items-center gap-1.5 bg-[#3B281E] px-4 py-2 text-xs font-medium text-[#F9F6F0] hover:bg-[#6D2932] cursor-pointer"
                    >
                      <Sparkles className="h-3.5 w-3.5" />
                      Mark Authenticated
                    </button>
                  )}
                  {ord.status === 'Authenticated' && (
                    <button
                      type="button"
                      onClick={() => handleAdvanceOrder(ord.id, 'Shipped')}
                      className="inline-flex items-center gap-1.5 bg-[#3B281E] px-4 py-2 text-xs font-medium text-[#F9F6F0] hover:bg-[#6D2932] cursor-pointer"
                    >
                      <Package className="h-3.5 w-3.5" />
                      Mark Shipped
                    </button>
                  )}
                  {ord.status === 'Shipped' && (
                    <button
                      type="button"
                      onClick={() => handleAdvanceOrder(ord.id, 'Delivered')}
                      className="inline-flex items-center gap-1.5 bg-[#6D2932] px-4 py-2 text-xs font-medium text-[#F9F6F0] hover:bg-[#561E26] cursor-pointer"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Mark Delivered
                    </button>
                  )}
                  {ord.status === 'Delivered' && (
                    <span className="text-xs font-medium uppercase tracking-wider text-[#6E5B4F]">
                      Fulfilled
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create Multi-Photo Listing Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#3B281E]/60 p-4 backdrop-blur-xs">
          <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto border border-[#D8CEBA] bg-[#F9F6F0] p-6 shadow-2xl sm:p-8">
            <div className="flex items-start justify-between border-b border-[#D8CEBA] pb-4">
              <div>
                <p className="text-xs uppercase tracking-widest text-[#B08D57]">
                  Add to Archive
                </p>
                <h2 className="mt-1 font-serif-editorial text-3xl font-semibold text-[#3B281E]">
                  Publish New Listing
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                aria-label="Close modal"
                className="flex h-10 w-10 items-center justify-center text-[#6E5B4F] hover:text-[#3B281E] cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateProduct} className="mt-5 space-y-4">
              {/* Multi-Photo Gallery Builder */}
              <div>
                <label className="block text-xs font-medium uppercase tracking-wider text-[#6E5B4F]">
                  Multi-Photo Gallery (Up to 6 Photos)
                </label>
                <div className="mt-2 flex flex-wrap items-center gap-3">
                  {images.map((img, idx) => (
                    <div
                      key={`${img.slice(0, 30)}-${idx}`}
                      className="relative h-20 w-24 overflow-hidden border border-[#D8CEBA] bg-[#EFE9DD]"
                    >
                      <SafeImage src={img} alt={`Photo ${idx + 1}`} className="h-full w-full object-cover" />
                      <button
                        type="button"
                        onClick={() => setImages((prev) => prev.filter((_, i) => i !== idx))}
                        aria-label="Remove photo"
                        className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center bg-[#3B281E]/80 text-white cursor-pointer"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                  <label className="flex h-20 w-28 flex-col items-center justify-center border border-dashed border-[#B08D57] bg-white text-xs font-medium text-[#3B281E] hover:bg-[#EFE9DD] cursor-pointer">
                    <Upload className="mb-1 h-4 w-4 text-[#6D2932]" />
                    Upload Photos
                    <input
                      type="file"
                      multiple
                      accept="image/*"
                      onChange={handleMultiPhotoUpload}
                      className="hidden"
                    />
                  </label>
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-[#6E5B4F]">
                  <span>Or add studio sample:</span>
                  {PRESET_STUDIO_IMAGES.slice(0, 4).map((preset, i) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() =>
                        setImages((prev) => (prev.length < 6 ? [...prev, preset] : prev))
                      }
                      className="border border-[#D8CEBA] bg-white px-2 py-1 text-[11px] hover:border-[#6D2932] cursor-pointer"
                    >
                      + Studio {i + 1}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-medium uppercase tracking-wider text-[#6E5B4F]">
                    Piece Title
                  </label>
                  <input
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Cashmere Double-Breasted Overcoat"
                    className="mt-1 w-full border border-[#D8CEBA] bg-white px-3 py-2 text-sm text-[#3B281E]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium uppercase tracking-wider text-[#6E5B4F]">
                    Maison / Brand
                  </label>
                  <input
                    type="text"
                    required
                    value={brand}
                    onChange={(e) => setBrand(e.target.value)}
                    placeholder="Loro Piana"
                    className="mt-1 w-full border border-[#D8CEBA] bg-white px-3 py-2 text-sm text-[#3B281E]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                  <label className="block text-xs font-medium uppercase tracking-wider text-[#6E5B4F]">
                    Category
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="mt-1 w-full border border-[#D8CEBA] bg-white px-3 py-2 text-sm text-[#3B281E]"
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium uppercase tracking-wider text-[#6E5B4F]">
                    Condition
                  </label>
                  <select
                    value={condition}
                    onChange={(e) => setCondition(e.target.value)}
                    className="mt-1 w-full border border-[#D8CEBA] bg-white px-3 py-2 text-sm text-[#3B281E]"
                  >
                    {CONDITIONS.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium uppercase tracking-wider text-[#6E5B4F]">
                    Size
                  </label>
                  <input
                    type="text"
                    value={size}
                    onChange={(e) => setSize(e.target.value)}
                    placeholder="IT 42 / M"
                    className="mt-1 w-full border border-[#D8CEBA] bg-white px-3 py-2 text-sm text-[#3B281E]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                  <label className="block text-xs font-medium uppercase tracking-wider text-[#6E5B4F]">
                    Asking Price ($)
                  </label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    placeholder="580"
                    className="mt-1 w-full border border-[#D8CEBA] bg-white px-3 py-2 text-sm text-[#3B281E] tabular-nums"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium uppercase tracking-wider text-[#6E5B4F]">
                    Original Retail ($)
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={originalPrice}
                    onChange={(e) => setOriginalPrice(e.target.value)}
                    placeholder="1650"
                    className="mt-1 w-full border border-[#D8CEBA] bg-white px-3 py-2 text-sm text-[#3B281E] tabular-nums"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium uppercase tracking-wider text-[#6E5B4F]">
                    Stock Quantity
                  </label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={stock}
                    onChange={(e) => setStock(e.target.value)}
                    className="mt-1 w-full border border-[#D8CEBA] bg-white px-3 py-2 text-sm text-[#3B281E] tabular-nums"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium uppercase tracking-wider text-[#6E5B4F]">
                  Provenance &amp; Garment Notes
                </label>
                <textarea
                  rows={3}
                  required
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Detail fabric composition, hardware patina, measurements, and care history..."
                  className="mt-1 w-full border border-[#D8CEBA] bg-white p-3 text-sm text-[#3B281E]"
                />
              </div>

              <div className="border border-[#D8CEBA] bg-[#EFE9DD]/60 p-4">
                <label className="flex items-center gap-2 text-sm font-medium text-[#3B281E] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={allowBarter}
                    onChange={(e) => setAllowBarter(e.target.checked)}
                    className="h-4 w-4 accent-[#6D2932]"
                  />
                  Accept barter exchange proposals in The Barter Room
                </label>
                {allowBarter && (
                  <input
                    type="text"
                    value={barterPreferences}
                    onChange={(e) => setBarterPreferences(e.target.value)}
                    placeholder="What pieces would you consider trading for?"
                    className="mt-2.5 w-full border border-[#D8CEBA] bg-white px-3 py-2 text-xs text-[#3B281E]"
                  />
                )}
              </div>

              <button
                type="submit"
                disabled={saving}
                className="w-full bg-[#6D2932] py-3.5 text-xs font-medium uppercase tracking-widest text-[#F9F6F0] hover:bg-[#561E26] disabled:opacity-60 cursor-pointer"
              >
                {saving ? 'Publishing...' : 'Publish Listing'}
              </button>
            </form>
          </div>
        </div>
      )}
    </section>
  );
};
