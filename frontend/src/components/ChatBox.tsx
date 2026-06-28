import { useEffect, useRef, useState } from 'react';
import { IMAGE_MESSAGE_PREVIEW, CHAT_RETENTION_NOTICE } from '@visor-protect/shared';
import type { AuthShop } from '../lib/auth';
import {
  formatChatTime,
  getConversationTitle,
  sendChatMessage,
} from '../lib/chat';
import { uploadChatImage } from '../lib/uploadImage';
import { useChat } from '../hooks/useChat';
import { ImagePreview } from './ImagePreview';
import { ChatExportButton } from './ChatExportButton';

interface ChatBoxProps {
  currentShopId: string;
  availableShops: AuthShop[];
}

export function ChatBox({ currentShopId, availableShops }: ChatBoxProps) {
  const [draft, setDraft] = useState('');
  const [showNewChat, setShowNewChat] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [imageConsent, setImageConsent] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    conversations,
    activeConversationId,
    messages,
    loadingConversations,
    loadingMessages,
    error,
    openConversation,
    startDirectChat,
  } = useChat({ currentShopId, enabled: true });

  const activeConversation = conversations.find((item) => item.id === activeConversationId);
  const otherShops = availableShops.filter((shop) => shop.id !== currentShopId);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, activeConversationId]);

  const handleSend = (event: React.FormEvent) => {
    event.preventDefault();
    const text = draft.trim();
    if (!text || !activeConversationId) {
      return;
    }

    sendChatMessage(activeConversationId, { text });
    setDraft('');
  };

  const handleStartChat = async (targetShopId: string) => {
    setShowNewChat(false);
    try {
      await startDirectChat(targetShopId);
    } catch {
      /* error handled in hook */
    }
  };

  const handleAttachClick = () => {
    if (!imageConsent) {
      setUploadError('Aceite o aviso de privacidade LGPD antes de enviar imagens.');
      return;
    }
    fileInputRef.current?.click();
  };

  const handleFileSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (!file || !activeConversationId) {
      return;
    }

    setUploadingImage(true);
    setUploadError(null);

    try {
      const uploaded = await uploadChatImage(file);
      sendChatMessage(activeConversationId, {
        text: draft.trim() || undefined,
        imageUrl: uploaded.url,
      });
      setDraft('');
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Erro ao enviar imagem');
    } finally {
      setUploadingImage(false);
    }
  };

  return (
    <aside className="flex h-full min-h-[520px] flex-col rounded-2xl border border-slate-700/80 bg-slate-900/95 overflow-hidden">
      <header className="border-b border-slate-800 px-4 py-3 bg-slate-900">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-bold text-emerald-300">Chat entre Comércios</h2>
            <p className="text-[10px] text-slate-500">Mensagens privadas entre estabelecimentos</p>
            <p className="text-[10px] text-slate-500/90 mt-1 leading-snug" role="note">
              {CHAT_RETENTION_NOTICE}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowNewChat((open) => !open)}
            className="rounded-lg bg-slate-800 px-2 py-1 text-[10px] font-semibold text-slate-200 hover:bg-slate-700"
          >
            + Novo
          </button>
        </div>

        <label className="mt-2 flex items-start gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={imageConsent}
            onChange={(e) => {
              setImageConsent(e.target.checked);
              if (e.target.checked) {
                setUploadError(null);
              }
            }}
            className="mt-0.5"
          />
          <span className="text-[10px] text-slate-400 leading-snug">
            Confirmo que as imagens cumprem a LGPD: apenas evidência de segurança, sem dados
            pessoais desnecessários nem divulgação fora da rede Visor Protect.
          </span>
        </label>

        <ChatExportButton shopId={currentShopId} />

        {showNewChat && (
          <div className="mt-2 space-y-1 rounded-lg border border-slate-700 bg-slate-950 p-2">
            {otherShops.length === 0 ? (
              <p className="text-[10px] text-slate-500">Não há outros comércios disponíveis</p>
            ) : (
              otherShops.map((shop) => (
                <button
                  key={shop.id}
                  type="button"
                  onClick={() => void handleStartChat(shop.id)}
                  className="block w-full rounded-md px-2 py-1.5 text-left text-xs text-slate-200 hover:bg-slate-800"
                >
                  {shop.name}
                  <span className="block text-[10px] text-slate-500">{shop.city}</span>
                </button>
              ))
            )}
          </div>
        )}
      </header>

      <div className="flex flex-1 min-h-0">
        <div className="w-[38%] border-r border-slate-800 overflow-y-auto">
          {loadingConversations && (
            <p className="p-3 text-[10px] text-slate-500">Carregando...</p>
          )}

          {!loadingConversations && conversations.length === 0 && (
            <p className="p-3 text-[10px] text-slate-500">
              Sem conversas. Inicie um chat com outro comércio.
            </p>
          )}

          {conversations.map((conversation) => {
            const isActive = conversation.id === activeConversationId;
            const preview =
              conversation.last_message?.type === 'image'
                ? IMAGE_MESSAGE_PREVIEW
                : conversation.last_message?.content ?? 'Sem mensagens';

            return (
              <button
                key={conversation.id}
                type="button"
                onClick={() => void openConversation(conversation.id)}
                className={`block w-full border-b border-slate-800/60 px-3 py-2.5 text-left transition-colors ${
                  isActive ? 'bg-slate-800/80' : 'hover:bg-slate-800/40'
                }`}
              >
                <p className="truncate text-xs font-semibold text-slate-100">
                  {getConversationTitle(conversation, currentShopId)}
                </p>
                <p className="truncate text-[10px] text-slate-500 mt-0.5">{preview}</p>
              </button>
            );
          })}
        </div>

        <div className="flex flex-1 flex-col min-w-0">
          {!activeConversation ? (
            <div className="flex flex-1 items-center justify-center p-4">
              <p className="text-xs text-slate-500 text-center">
                Selecione uma conversa para ver o histórico
              </p>
            </div>
          ) : (
            <>
              <div className="border-b border-slate-800 px-3 py-2">
                <p className="text-xs font-semibold text-white truncate">
                  {getConversationTitle(activeConversation, currentShopId)}
                </p>
              </div>

              <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
                {loadingMessages && (
                  <p className="text-[10px] text-slate-500">Carregando histórico...</p>
                )}

                {messages.map((message) => {
                  const isOwn = message.sender_shop_id === currentShopId;
                  const isRead = message.read_by.some((id) => id !== message.sender_shop_id);

                  return (
                    <div
                      key={message.id}
                      className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[85%] rounded-2xl px-3 py-2 ${
                          isOwn
                            ? 'bg-emerald-700/80 text-white rounded-br-sm'
                            : 'bg-slate-800 text-slate-100 rounded-bl-sm'
                        }`}
                      >
                        {!isOwn && (
                          <p className="text-[10px] font-semibold text-emerald-300 mb-0.5">
                            {message.sender_shop_name}
                          </p>
                        )}

                        {message.type === 'image' && message.image_url && (
                          <ImagePreview
                            src={message.image_url}
                            caption={message.content}
                            alt="Evidência compartilhada no chat"
                          />
                        )}

                        {message.type === 'text' && message.content && (
                          <p className="text-xs whitespace-pre-wrap break-words">{message.content}</p>
                        )}

                        <div className="mt-1 flex items-center justify-end gap-1">
                          <span className="text-[9px] opacity-70">
                            {formatChatTime(message.created_at)}
                          </span>
                          {isOwn && isRead && (
                            <span className="text-[9px] text-emerald-200" title="Lido">
                              ✓✓
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>

              <form onSubmit={handleSend} className="border-t border-slate-800 p-2 flex gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(event) => void handleFileSelected(event)}
                />
                <button
                  type="button"
                  onClick={handleAttachClick}
                  disabled={uploadingImage || !activeConversationId}
                  className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-300 hover:bg-slate-800 disabled:opacity-40"
                  title="Anexar imagem"
                  aria-label="Anexar imagem"
                >
                  {uploadingImage ? '…' : '📎'}
                </button>
                <input
                  type="text"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="Digite uma mensagem ou anexe uma imagem..."
                  maxLength={2000}
                  className="flex-1 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white placeholder:text-slate-500"
                />
                <button
                  type="submit"
                  disabled={!draft.trim()}
                  className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-500 disabled:opacity-40"
                >
                  Enviar
                </button>
              </form>
            </>
          )}
        </div>
      </div>

      {(error || uploadError) && (
        <p className="border-t border-red-900/40 bg-red-950/30 px-3 py-1.5 text-[10px] text-red-400">
          {uploadError ?? error}
        </p>
      )}
    </aside>
  );
}
