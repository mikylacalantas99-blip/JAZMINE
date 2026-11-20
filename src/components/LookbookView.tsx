import React, { useEffect, useState } from 'react';
import { Heart, Plus, X, ArrowUpRight, Upload } from 'lucide-react';
import { apiFetch, compressImageFile } from '../lib/api';
import { SafeImage } from './SafeImage';
import type { Lookbook, Product, User } from '../types';

interface LookbookViewProps {
  currentUser: User | null;
  products: Product[];
  onSelectProduct: (product: Product) => void;
  onRequireAuth: () => void;
  onNotifyToast: (msg: string) => void;
}

export const LookbookView: React.FC<LookbookViewProps> = ({
  currentUser,
  products,
  onSelectProduct,
  onRequireAuth,
  onNotifyToast,
}) => {
  const [lookbooks, setLookbooks] = useState<Lookbook[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState('');
  const [season, setSeason] = useState('Autumn Salon');
  const [story, setStory] = useState('');
  const [coverImage, setCoverImage] = useState('/src/assets/images/lookbook_autumn_heritage_1795191632933.jpg');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const loadLookbooks = () => {
    apiFetch<{ lookbooks: Lookbook[] }>('/api/lookbooks')
      .then((res) => setLookbooks(res.lookbooks || []))
      .catch(() => setLookbooks([]));
  };

  useEffect(() => {
    loadLookbooks();
  }, []);

  const handleLike = async (id: string) => {
    try {
      const res = await apiFetch<{ likes_count: number }>(`/api/lookbooks/${id}/like`, {
        method: 'POST',
      });
      setLookbooks((prev) =>
        prev.map((l) => (l.id === id ? { ...l, likes_count: res.likes_count } : l))
      );
    } catch {
      // ignore
    }
  };

  const handleUploadCover = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await compressImageFile(file, 960);
      setCoverImage(dataUrl);
    } catch {
      onNotifyToast('Failed to process cover image');
    }
  };

  const handleCreateLookbook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) {
      onRequireAuth();
      return;
    }
    try {
      await apiFetch('/api/lookbooks', {
        method: 'POST',
        body: JSON.stringify({
          title,
          season,
          story,
          coverImage,
          productIds: selectedIds,
        }),
      });
      setShowCreate(false);
      setTitle('');
      setStory('');
      setSelectedIds([]);
      loadLookbooks();
      onNotifyToast('Outfit spread published to Lookbook.');
    } catch (err) {
      onNotifyToast(err instanceof Error ? err.message : 'Failed to publish lookbook');
    }
  };

  return (
    <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-col justify-between gap-4 border-b border-[#D8CEBA] pb-6 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-medium uppercase tracking-widest text-[#B08D57]">
            Editorial Styling &amp; Outfit Inspiration
          </p>
          <h1 className="mt-1 font-serif-editorial text-4xl font-semibold text-[#3B281E]">
            The Atelier Lookbook
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-[#6E5B4F]">
            Shoppable wardrobe compositions styled by JAZMINE collectors and independent archivists.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            if (!currentUser) {
              onRequireAuth();
              return;
            }
            setShowCreate(true);
          }}
          className="inline-flex items-center gap-2 bg-[#3B281E] px-5 py-3 text-xs font-medium uppercase tracking-widest text-[#F9F6F0] hover:bg-[#6D2932] whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Plus className="h-4 w-4" />
          Publish Outfit Spread
        </button>
      </div>

      <div className="mt-8 space-y-12">
        {lookbooks.map((look, idx) => (
          <article
            key={look.id}
            className="grid grid-cols-1 border border-[#D8CEBA] bg-white lg:grid-cols-12"
          >
            <div
              className={`aspect-[4/3] overflow-hidden bg-[#EFE9DD] lg:col-span-6 lg:aspect-auto ${
                idx % 2 === 1 ? 'lg:order-2' : ''
              }`}
            >
              <SafeImage
                src={look.cover_image}
                alt={look.title}
                className="h-full w-full object-cover"
              />
            </div>

            <div className="flex flex-col justify-between p-6 sm:p-10 lg:col-span-6">
              <div>
                <div className="flex items-center justify-between gap-4 text-xs text-[#6E5B4F]">
                  <span className="uppercase tracking-widest text-[#B08D57]">{look.season}</span>
                  <span>Curated by {look.author_store_name}</span>
                </div>

                <h2 className="mt-2 font-serif-editorial text-3xl font-semibold text-[#3B281E]">
                  {look.title}
                </h2>
                <p className="mt-3 text-sm leading-relaxed text-[#3B281E]/90">{look.story}</p>

                {look.products && look.products.length > 0 && (
                  <div className="mt-6 border-t border-[#D8CEBA] pt-5">
                    <p className="text-xs font-medium uppercase tracking-wider text-[#6E5B4F]">
                      Featured Pieces in This Look
                    </p>
                    <div className="mt-3 space-y-2.5">
                      {look.products.map((prod) => (
                        <button
                          key={prod.id}
                          type="button"
                          onClick={() => onSelectProduct(prod)}
                          className="flex w-full items-center justify-between gap-3 border border-[#D8CEBA] bg-[#F9F6F0]/60 p-2.5 text-left transition-colors hover:border-[#6D2932] hover:bg-white cursor-pointer"
                        >
                          <div className="flex items-center gap-3">
                            <div className="h-12 w-14 shrink-0 overflow-hidden border border-[#D8CEBA] bg-[#EFE9DD]">
                              <SafeImage
                                src={prod.images[0]}
                                alt={prod.title}
                                className="h-full w-full object-cover"
                              />
                            </div>
                            <div>
                              <p className="text-xs font-semibold text-[#3B281E]">{prod.title}</p>
                              <p className="text-xs text-[#6E5B4F] tabular-nums">
                                {prod.brand} · ${prod.price.toLocaleString()}
                              </p>
                            </div>
                          </div>
                          <ArrowUpRight className="h-4 w-4 text-[#6D2932]" />
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-6 flex items-center justify-between border-t border-[#D8CEBA] pt-4">
                <button
                  type="button"
                  onClick={() => handleLike(look.id)}
                  className="inline-flex items-center gap-2 border border-[#D8CEBA] bg-[#EFE9DD]/70 px-4 py-2 text-xs font-medium text-[#3B281E] hover:border-[#6D2932] cursor-pointer"
                >
                  <Heart className="h-3.5 w-3.5 text-[#6D2932]" />
                  <span className="tabular-nums">Appreciate ({look.likes_count})</span>
                </button>
                <span className="text-xs text-[#6E5B4F]">
                  {new Date(look.created_at).toLocaleDateString()}
                </span>
              </div>
            </div>
          </article>
        ))}
      </div>

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#3B281E]/60 p-4 backdrop-blur-xs">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto border border-[#D8CEBA] bg-[#F9F6F0] p-6 shadow-2xl">
            <div className="flex items-start justify-between border-b border-[#D8CEBA] pb-4">
              <div>
                <p className="text-xs uppercase tracking-widest text-[#B08D57]">Style Journal</p>
                <h3 className="mt-1 font-serif-editorial text-2xl font-semibold text-[#3B281E]">
                  Publish Outfit Inspiration
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                aria-label="Close lookbook modal"
                className="flex h-10 w-10 items-center justify-center text-[#6E5B4F] cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateLookbook} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-medium uppercase tracking-wider text-[#6E5B4F]">
                  Editorial Title
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Sunday Gallery Walk"
                  className="mt-1 w-full border border-[#D8CEBA] bg-white px-3 py-2 text-sm text-[#3B281E]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium uppercase tracking-wider text-[#6E5B4F]">
                  Season / Capsule
                </label>
                <input
                  type="text"
                  value={season}
                  onChange={(e) => setSeason(e.target.value)}
                  className="mt-1 w-full border border-[#D8CEBA] bg-white px-3 py-2 text-sm text-[#3B281E]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium uppercase tracking-wider text-[#6E5B4F]">
                  Styling Notes
                </label>
                <textarea
                  rows={3}
                  required
                  value={story}
                  onChange={(e) => setStory(e.target.value)}
                  placeholder="Describe proportions, fabric pairings, and styling intent..."
                  className="mt-1 w-full border border-[#D8CEBA] bg-white p-3 text-sm text-[#3B281E]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium uppercase tracking-wider text-[#6E5B4F]">
                  Cover Photograph
                </label>
                <div className="mt-1.5 flex items-center gap-3">
                  <div className="h-16 w-20 overflow-hidden border border-[#D8CEBA]">
                    <SafeImage src={coverImage} alt="Lookbook cover" className="h-full w-full object-cover" />
                  </div>
                  <label className="inline-flex items-center gap-2 border border-[#D8CEBA] bg-white px-3 py-2 text-xs font-medium text-[#3B281E] cursor-pointer">
                    <Upload className="h-3.5 w-3.5" />
                    Upload Photo
                    <input type="file" accept="image/*" onChange={handleUploadCover} className="hidden" />
                  </label>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium uppercase tracking-wider text-[#6E5B4F]">
                  Tag Shoppable Archive Pieces (up to 4)
                </label>
                <div className="mt-1.5 max-h-40 space-y-1 overflow-y-auto border border-[#D8CEBA] bg-white p-2.5">
                  {products
                    .filter((p) => p.status === 'active')
                    .map((p) => {
                      const checked = selectedIds.includes(p.id);
                      return (
                        <label
                          key={p.id}
                          className="flex items-center gap-2 text-xs text-[#3B281E] cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => {
                              setSelectedIds((prev) =>
                                checked
                                  ? prev.filter((id) => id !== p.id)
                                  : prev.length < 4
                                  ? [...prev, p.id]
                                  : prev
                              );
                            }}
                            className="accent-[#6D2932]"
                          />
                          <span className="truncate">{p.title}</span>
                          <span className="ml-auto text-[#6E5B4F] tabular-nums">${p.price}</span>
                        </label>
                      );
                    })}
                </div>
              </div>
              <button
                type="submit"
                className="w-full bg-[#6D2932] py-3 text-xs font-medium uppercase tracking-widest text-[#F9F6F0] cursor-pointer"
              >
                Publish Spread
              </button>
            </form>
          </div>
        </div>
      )}
    </section>
  );
};
