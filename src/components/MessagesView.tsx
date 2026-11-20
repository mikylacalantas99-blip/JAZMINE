import React, { useEffect, useRef, useState } from 'react';
import { Send, Tag, Check, X, ShoppingBag, ArrowLeft } from 'lucide-react';
import { apiFetch } from '../lib/api';
import { SafeImage } from './SafeImage';
import type { ChatMessage, Conversation, Product, User } from '../types';

interface MessagesViewProps {
  currentUser: User | null;
  activeConversationId: string | null;
  products: Product[];
  onSelectConversation: (id: string | null) => void;
  onAddNegotiatedToCart: (product: Product, agreedPrice: number) => void;
  onRequireAuth: () => void;
  onNotifyToast: (msg: string) => void;
  refreshSignal: number;
}

export const MessagesView: React.FC<MessagesViewProps> = ({
  currentUser,
  activeConversationId,
  products,
  onSelectConversation,
  onAddNegotiatedToCart,
  onRequireAuth,
  onNotifyToast,
  refreshSignal,
}) => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState('');
  const [offerMode, setOfferMode] = useState(false);
  const [offerAmount, setOfferAmount] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const loadConversations = () => {
    if (!currentUser) return;
    apiFetch<{ conversations: Conversation[] }>('/api/conversations')
      .then((res) => {
        const list = res.conversations || [];
        setConversations(list);
        if (!activeConversationId && list.length > 0 && window.innerWidth >= 768) {
          onSelectConversation(list[0].id);
        }
      })
      .catch(() => setConversations([]));
  };

  const loadMessages = (convId: string) => {
    apiFetch<{ messages: ChatMessage[] }>(`/api/conversations/${convId}/messages`)
      .then((res) => setMessages(res.messages || []))
      .catch(() => setMessages([]));
  };

  useEffect(() => {
    loadConversations();
  }, [currentUser, refreshSignal]);

  useEffect(() => {
    if (activeConversationId && currentUser) {
      loadMessages(activeConversationId);
    } else {
      setMessages([]);
    }
  }, [activeConversationId, currentUser, refreshSignal]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  if (!currentUser) {
    return (
      <section className="mx-auto max-w-4xl px-4 py-16 text-center">
        <h2 className="font-serif-editorial text-3xl font-semibold text-[#3B281E]">
          Private Client Messaging &amp; Price Negotiation
        </h2>
        <p className="mt-2 text-sm text-[#6E5B4F]">
          Sign in to speak directly with archive curators and submit price offers in real time.
        </p>
        <button
          type="button"
          onClick={onRequireAuth}
          className="mt-6 bg-[#6D2932] px-6 py-3 text-xs font-medium uppercase tracking-widest text-[#F9F6F0] cursor-pointer"
        >
          Sign In to View Inbox
        </button>
      </section>
    );
  }

  const activeConv = conversations.find((c) => c.id === activeConversationId) || null;
  const linkedProduct = activeConv?.product_id
    ? products.find((p) => p.id === activeConv.product_id) || null
    : null;

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeConv) return;
    if (!text.trim() && (!offerMode || !offerAmount)) return;
    setSending(true);
    try {
      await apiFetch(`/api/conversations/${activeConv.id}/messages`, {
        method: 'POST',
        body: JSON.stringify({
          body: text.trim() || (offerMode ? `Proposed offer of $${offerAmount}` : ''),
          offerAmount: offerMode && offerAmount ? Number(offerAmount) : undefined,
        }),
      });
      setText('');
      setOfferAmount('');
      setOfferMode(false);
      loadMessages(activeConv.id);
      loadConversations();
    } catch (err) {
      onNotifyToast(err instanceof Error ? err.message : 'Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const handleOfferDecision = async (messageId: string, decision: 'accepted' | 'declined') => {
    try {
      await apiFetch(`/api/messages/${messageId}/offer`, {
        method: 'PATCH',
        body: JSON.stringify({ decision }),
      });
      onNotifyToast(
        decision === 'accepted' ? 'Offer accepted and buyer notified.' : 'Offer declined.'
      );
      if (activeConv) loadMessages(activeConv.id);
    } catch (err) {
      onNotifyToast(err instanceof Error ? err.message : 'Failed to respond to offer');
    }
  };

  return (
    <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="border-b border-[#D8CEBA] pb-4">
        <p className="text-xs font-medium uppercase tracking-widest text-[#B08D57]">
          Real-Time Salon Concierge
        </p>
        <h1 className="mt-1 font-serif-editorial text-4xl font-semibold text-[#3B281E]">
          Messages &amp; Price Negotiation
        </h1>
      </div>

      <div className="mt-6 grid min-h-[540px] grid-cols-1 border border-[#D8CEBA] bg-white md:grid-cols-12">
        {/* Left Conversation List */}
        <div
          className={`border-b border-[#D8CEBA] bg-[#EFE9DD]/40 md:col-span-4 md:border-b-0 md:border-r ${
            activeConv ? 'hidden md:block' : 'block'
          }`}
        >
          {conversations.length === 0 ? (
            <div className="p-6 text-sm text-[#6E5B4F]">
              No active inquiries yet. Open any product and click &ldquo;Negotiate Price&rdquo; to begin.
            </div>
          ) : (
            <div className="divide-y divide-[#D8CEBA]">
              {conversations.map((conv) => {
                const counterpart =
                  conv.buyer_id === currentUser.id ? conv.seller_store_name : conv.buyer_name;
                const isActive = conv.id === activeConversationId;
                return (
                  <button
                    key={conv.id}
                    type="button"
                    onClick={() => onSelectConversation(conv.id)}
                    className={`flex w-full items-start gap-3 p-4 text-left transition-colors cursor-pointer ${
                      isActive ? 'bg-[#EFE9DD]' : 'hover:bg-[#EFE9DD]/60'
                    }`}
                  >
                    <div className="h-12 w-12 shrink-0 overflow-hidden border border-[#D8CEBA] bg-[#E6DEC8]">
                      <SafeImage
                        src={conv.product_image}
                        alt={conv.product_title || counterpart}
                        className="h-full w-full object-cover"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-sm font-semibold text-[#3B281E]">
                          {counterpart}
                        </span>
                        <span className="shrink-0 text-[11px] text-[#6E5B4F]">
                          {new Date(conv.last_message_at).toLocaleDateString()}
                        </span>
                      </div>
                      {conv.product_title && (
                        <p className="truncate text-xs font-medium text-[#6D2932]">
                          {conv.product_title}
                        </p>
                      )}
                      <p className="mt-0.5 truncate text-xs text-[#6E5B4F]">
                        {conv.last_message_preview}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Live Chat Pane */}
        <div
          className={`flex flex-col md:col-span-8 ${
            !activeConv ? 'hidden md:flex' : 'flex'
          }`}
        >
          {!activeConv ? (
            <div className="flex flex-1 items-center justify-center p-8 text-sm text-[#6E5B4F]">
              Select a conversation from the left to view messages and offers.
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between gap-4 border-b border-[#D8CEBA] bg-[#F9F6F0] px-5 py-3.5">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => onSelectConversation(null)}
                    aria-label="Back to conversations"
                    className="flex h-10 w-10 items-center justify-center text-[#3B281E] md:hidden cursor-pointer"
                  >
                    <ArrowLeft className="h-5 w-5" />
                  </button>
                  <div>
                    <p className="text-sm font-semibold text-[#3B281E]">
                      {activeConv.buyer_id === currentUser.id
                        ? activeConv.seller_store_name
                        : activeConv.buyer_name}
                    </p>
                    {activeConv.product_title && (
                      <p className="text-xs text-[#6E5B4F] tabular-nums">
                        {activeConv.product_title} · List ${activeConv.product_price?.toLocaleString()}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex-1 space-y-4 overflow-y-auto bg-[#F9F6F0]/40 p-5 max-h-[400px]">
                {messages.map((m) => {
                  const isMine = m.sender_id === currentUser.id;
                  const canRespondToOffer =
                    m.offer_amount && m.offer_status === 'pending' && !isMine;
                  const buyerCanCheckoutAgreed =
                    m.offer_amount &&
                    m.offer_status === 'accepted' &&
                    activeConv.buyer_id === currentUser.id &&
                    linkedProduct &&
                    linkedProduct.stock > 0;

                  return (
                    <div
                      key={m.id}
                      className={`flex flex-col ${isMine ? 'items-end' : 'items-start'}`}
                    >
                      <div
                        className={`max-w-[82%] border px-4 py-3 text-sm ${
                          isMine
                            ? 'border-[#3B281E] bg-[#3B281E] text-[#F9F6F0]'
                            : 'border-[#D8CEBA] bg-white text-[#3B281E]'
                        }`}
                      >
                        <p className="leading-relaxed">{m.body}</p>

                        {m.offer_amount && (
                          <div
                            className={`mt-3 border-t pt-3 ${
                              isMine ? 'border-[#F9F6F0]/20' : 'border-[#D8CEBA]'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-4 text-xs">
                              <span className="font-semibold uppercase tracking-wider tabular-nums">
                                Price Offer: ${m.offer_amount.toLocaleString()}
                              </span>
                              <span className="uppercase tracking-wider opacity-85">
                                {m.offer_status}
                              </span>
                            </div>

                            {canRespondToOffer && (
                              <div className="mt-2.5 flex gap-2">
                                <button
                                  type="button"
                                  onClick={() => handleOfferDecision(m.id, 'accepted')}
                                  className="inline-flex items-center gap-1 bg-[#6D2932] px-3 py-1.5 text-xs font-medium text-[#F9F6F0] hover:bg-[#561E26] cursor-pointer"
                                >
                                  <Check className="h-3 w-3" />
                                  Accept Offer
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleOfferDecision(m.id, 'declined')}
                                  className="inline-flex items-center gap-1 border border-[#D8CEBA] bg-[#EFE9DD] px-3 py-1.5 text-xs font-medium text-[#3B281E] cursor-pointer"
                                >
                                  <X className="h-3 w-3" />
                                  Decline
                                </button>
                              </div>
                            )}

                            {buyerCanCheckoutAgreed && (
                              <button
                                type="button"
                                onClick={() => {
                                  onAddNegotiatedToCart(linkedProduct, m.offer_amount!);
                                  onNotifyToast(
                                    `Added ${linkedProduct.title} to bag at agreed $${m.offer_amount}.`
                                  );
                                }}
                                className="mt-2.5 inline-flex items-center gap-1.5 bg-[#B08D57] px-3 py-1.5 text-xs font-semibold text-[#3B281E] hover:bg-[#9E7C48] cursor-pointer"
                              >
                                <ShoppingBag className="h-3.5 w-3.5" />
                                Add to Bag at ${m.offer_amount.toLocaleString()}
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                      <span className="mt-1 text-[11px] text-[#6E5B4F]">
                        {m.sender_name} · {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  );
                })}
                <div ref={bottomRef} />
              </div>

              <form onSubmit={handleSend} className="border-t border-[#D8CEBA] bg-white p-4">
                {offerMode && (
                  <div className="mb-3 flex items-center gap-3 border border-[#D8CEBA] bg-[#EFE9DD]/70 p-2.5">
                    <Tag className="h-4 w-4 text-[#6D2932]" />
                    <span className="text-xs font-medium text-[#3B281E]">Offer Price ($):</span>
                    <input
                      type="number"
                      min={1}
                      required={offerMode}
                      value={offerAmount}
                      onChange={(e) => setOfferAmount(e.target.value)}
                      placeholder="e.g. 580"
                      className="w-28 border border-[#D8CEBA] bg-white px-2.5 py-1 text-sm text-[#3B281E] tabular-nums focus:border-[#6D2932] focus:outline-none"
                    />
                  </div>
                )}

                <div className="flex items-center gap-2">
                  {activeConv.buyer_id === currentUser.id && (
                    <button
                      type="button"
                      onClick={() => setOfferMode((v) => !v)}
                      className={`flex h-11 items-center gap-1.5 border px-3 text-xs font-medium whitespace-nowrap cursor-pointer ${
                        offerMode
                          ? 'border-[#6D2932] bg-[#6D2932] text-[#F9F6F0]'
                          : 'border-[#D8CEBA] bg-[#EFE9DD] text-[#3B281E]'
                      }`}
                    >
                      <Tag className="h-3.5 w-3.5" />
                      {offerMode ? 'Offer Attached' : 'Make Offer'}
                    </button>
                  )}

                  <input
                    type="text"
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder="Write a message regarding fit, provenance, or pricing..."
                    className="h-11 flex-1 border border-[#D8CEBA] bg-[#F9F6F0]/50 px-3.5 text-sm text-[#3B281E] focus:border-[#6D2932] focus:outline-none"
                  />

                  <button
                    type="submit"
                    disabled={sending}
                    aria-label="Send message"
                    className="flex h-11 items-center gap-2 bg-[#3B281E] px-4 text-xs font-medium uppercase tracking-wider text-[#F9F6F0] hover:bg-[#6D2932] disabled:opacity-50 cursor-pointer"
                  >
                    <Send className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Send</span>
                  </button>
                </div>
              </form>
            </>
          )}
        </div>
      </div>
    </section>
  );
};
