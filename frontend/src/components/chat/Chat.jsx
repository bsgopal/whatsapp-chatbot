import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import { chatAPI } from '../../api';
import { useSocket } from '../../hooks/useSocket';
import toast from 'react-hot-toast';

function StatusPill({ status }) {
  const map = {
    failed: 'bg-rose-500/10 text-rose-300 border-rose-500/20',
    read: 'bg-sky/10 text-sky border-sky/20',
    delivered: 'bg-em/10 text-em border-em/20',
    sent: 'bg-stone-500/10 text-stone-2 border-stone-500/20',
  };

  return (
    <span className={`inline-flex rounded-full border px-2 py-1 text-2xs font-semibold ${map[status] || map.sent}`}>
      {status || 'sent'}
    </span>
  );
}

function BotStageBadge({ stage }) {
  if (!stage || stage === 'idle') return null;
  return (
    <span className="inline-flex rounded-full border border-violet/20 bg-violet/10 px-2 py-1 text-2xs font-semibold text-violet">
      Bot: {stage.replaceAll('_', ' ')}
    </span>
  );
}

function QuickReply({ label, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-full border border-em/20 bg-em/5 px-3 py-1.5 text-2xs font-semibold text-em transition-colors hover:bg-em/10"
    >
      {label}
    </button>
  );
}

export default function Chat() {
  const qc = useQueryClient();
  const [selectedConv, setSelectedConv] = useState(null);
  const [message, setMessage] = useState('');
  const messagesEndRef = useRef(null);

  const extractContactId = useCallback((payload) => {
    const contact = payload?.contact;
    if (!contact) return null;
    if (typeof contact === 'string') return contact;
    return contact._id || null;
  }, []);

  const { data: convData, refetch: refetchConvs } = useQuery({
    queryKey: ['conversations'],
    queryFn: chatAPI.getConversations,
    select: (response) => response.data.data,
    refetchInterval: 15000,
  });

  const { data: messagesData, refetch: refetchMessages } = useQuery({
    queryKey: ['messages', selectedConv?._id],
    queryFn: () => chatAPI.getMessages(selectedConv._id),
    select: (response) => response.data.data,
    enabled: !!selectedConv?._id,
    refetchInterval: 10000,
  });

  useSocket((event, data) => {
    if (event === 'whatsapp_message' || event === 'new_message') {
      refetchConvs();
      const incomingContactId = extractContactId(data);
      const selectedContactId = selectedConv?._id || selectedConv?.contact?._id;
      if (incomingContactId && selectedContactId && String(selectedContactId) === String(incomingContactId)) {
        refetchMessages();
      }
    }
  });
  

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messagesData]);

  useEffect(() => {
    if (!selectedConv && convData?.length) {
      setSelectedConv(convData[0]);
    }
  }, [convData, selectedConv]);

  const sendMut = useMutation({
    mutationFn: ({ content }) => chatAPI.sendMessage(selectedConv._id, { content }),
    onSuccess: (response) => {
      setMessage('');
      qc.invalidateQueries({ queryKey: ['messages', selectedConv._id] });
      qc.invalidateQueries({ queryKey: ['conversations'] });
      if (response.data.warning) {
        toast.error(response.data.warning);
      }
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Failed to send message');
    },
  });

  const conversations = convData || [];
  const messages = messagesData || [];
  const selectedConversation = useMemo(
    () => conversations.find((conv) => conv._id === selectedConv?._id) || selectedConv,
    [conversations, selectedConv]
  );
  const selectedContact = selectedConversation?.contact || {};

  const sendQuickReply = (content) => {
    sendMut.mutate({ content });
  };

  const quickReplies = [
    'Hi, how can I help you today?',
    'Please type menu to restart the booking bot.',
    'Share your preferred service, date, and time.',
    'A team member will get back to you shortly.',
  ];

  return (
    <div className="h-full flex overflow-hidden">
      <div className="w-80 flex-shrink-0 border-r border-ink-6 bg-ink-2 flex flex-col">
        <div className="border-b border-ink-6 px-4 py-4">
          <div className="text-2xs font-mono uppercase tracking-[0.2em] text-em">Inbox</div>
          <h2 className="mt-1 font-display text-lg font-bold text-slate-900">WhatsApp Conversations</h2>
          <p className="mt-1 text-2xs text-stone-2">{conversations.length} live conversations synced with the bot and staff replies.</p>
        </div>

        <div className="flex-1 overflow-y-auto">
          {conversations.length === 0 ? (
            <div className="p-6 text-center">
              <div className="text-sm text-stone-2">No conversations yet. Incoming WhatsApp messages will appear here.</div>
            </div>
          ) : (
            conversations.map((conv) => {
              const isSelected = selectedConv?._id === conv._id;
              const lastMsg = conv.lastMessage;
              const contact = conv.contact || {};

              return (
                <button
                  type="button"
                  key={conv._id}
                  onClick={() => setSelectedConv(conv)}
                  className={`w-full border-b border-ink-6 px-4 py-3 text-left transition-colors ${isSelected ? 'bg-em/8' : 'hover:bg-ink-4'}`}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-em/40 to-teal/40 text-sm font-bold text-slate-900">
                      {contact?.name?.[0]?.toUpperCase() || '?'}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <div className="truncate text-sm font-semibold text-slate-900">{contact?.name || contact?.phone}</div>
                        {lastMsg?.createdAt ? <div className="text-2xs font-mono text-stone-1">{format(new Date(lastMsg.createdAt), 'HH:mm')}</div> : null}
                      </div>
                      <div className="mt-1 truncate text-2xs text-stone-2">
                        {lastMsg?.direction === 'outbound' ? 'You: ' : ''}
                        {lastMsg?.content || 'No messages yet'}
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <BotStageBadge stage={contact?.botState?.stage} />
                        {conv.unreadCount > 0 ? (
                          <span className="inline-flex rounded-full bg-em px-2 py-1 text-2xs font-bold text-black">
                            {conv.unreadCount} unread
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {selectedConversation ? (
        <div className="flex-1 flex flex-col bg-ink-1">
          <div className="border-b border-ink-6 bg-ink-2 px-5 py-4">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-em/40 to-teal/40 text-sm font-bold text-slate-900">
                  {selectedContact?.name?.[0]?.toUpperCase() || '?'}
                </div>
                <div>
                  <div className="text-base font-bold text-slate-900">{selectedContact?.name || 'Unknown contact'}</div>
                  <div className="mt-1 text-2xs font-mono text-stone-2">{selectedContact?.phone || 'No phone'}</div>
                </div>
              </div>

              <div className="xl:ml-auto flex flex-wrap items-center gap-2">
                <StatusPill status={selectedContact?.status === 'active' ? 'delivered' : 'failed'} />
                <BotStageBadge stage={selectedContact?.botState?.stage} />
                {selectedContact?.preferredService ? <span className="rounded-full border border-em/20 bg-em/5 px-2 py-1 text-2xs text-em">Preferred service saved</span> : null}
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="rounded-2xl border border-ink-6 bg-ink-3 p-3">
                <div className="text-2xs font-mono uppercase tracking-[0.2em] text-stone-2">Messages</div>
                <div className="mt-2 text-lg font-display font-bold text-slate-900">{selectedContact?.totalMessages || 0}</div>
              </div>
              <div className="rounded-2xl border border-ink-6 bg-ink-3 p-3">
                <div className="text-2xs font-mono uppercase tracking-[0.2em] text-stone-2">Appointments</div>
                <div className="mt-2 text-lg font-display font-bold text-slate-900">{selectedContact?.totalAppointments || 0}</div>
              </div>
              <div className="rounded-2xl border border-ink-6 bg-ink-3 p-3">
                <div className="text-2xs font-mono uppercase tracking-[0.2em] text-stone-2">Bot Progress</div>
                <div className="mt-2 text-sm font-semibold text-slate-900">{selectedContact?.botState?.stage ? selectedContact.botState.stage.replaceAll('_', ' ') : 'idle'}</div>
              </div>
            </div>
          </div>

          <div
            className="flex-1 overflow-y-auto px-5 py-4 space-y-3"
            style={{ backgroundImage: 'radial-gradient(ellipse 80% 40% at 50% 0%, rgba(37,99,235,.03) 0%, transparent 50%)' }}
          >
            {messages.map((msg, index) => {
              const isOut = msg.direction === 'outbound';
              return (
                <motion.div
                  key={msg._id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.02 }}
                  className={`flex ${isOut ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`max-w-xs lg:max-w-xl rounded-2xl border px-4 py-3 ${isOut ? 'bg-em/12 border-em/20 rounded-br-sm' : 'bg-ink-4 border-ink-6 rounded-bl-sm'}`}>
                    {msg.type !== 'text' ? <div className="mb-1 text-2xs font-mono uppercase tracking-[0.2em] text-stone-2">{msg.type}</div> : null}
                    <div className="text-sm leading-relaxed text-slate-900 whitespace-pre-line">{msg.content}</div>
                    <div className={`mt-2 flex flex-wrap items-center gap-2 ${isOut ? 'justify-end' : 'justify-start'}`}>
                      <div className="text-2xs font-mono text-stone-1">{format(new Date(msg.createdAt), 'HH:mm')}</div>
                      {isOut ? <StatusPill status={msg.status} /> : null}
                      {msg.sentBy === 'bot' ? <span className="rounded-full border border-violet/20 bg-violet/10 px-2 py-1 text-2xs text-violet">Bot</span> : null}
                    </div>
                    {msg.failedReason ? (
                      <div className="mt-2 rounded-xl border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-2xs text-rose-200 whitespace-pre-line">
                        {msg.failedReason}
                      </div>
                    ) : null}
                  </div>
                </motion.div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>

          <div className="border-t border-ink-6 bg-ink-2 px-5 py-4">
            <div className="mb-3 flex flex-wrap gap-2">
              {quickReplies.map((reply) => (
                <QuickReply key={reply} label={reply} onClick={() => sendQuickReply(reply)} />
              ))}
            </div>

            <div className="flex items-end gap-3">
              <div className="flex-1 rounded-2xl border border-ink-6 bg-ink-3 px-4 py-3 focus-within:border-em/40">
                <textarea
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && !event.shiftKey) {
                      event.preventDefault();
                      if (message.trim()) {
                        sendMut.mutate({ content: message });
                      }
                    }
                  }}
                  rows={2}
                  placeholder="Reply on WhatsApp..."
                  className="w-full resize-none bg-transparent text-sm text-slate-900 placeholder-stone-2 outline-none"
                />
              </div>
              <button
                type="button"
                onClick={() => {
                  if (message.trim()) {
                    sendMut.mutate({ content: message });
                  }
                }}
                disabled={!message.trim() || sendMut.isPending}
                className="btn-em py-3 px-5 disabled:opacity-50"
              >
                {sendMut.isPending ? 'Sending...' : 'Send'}
              </button>
            </div>
            <div className="mt-2 text-2xs text-stone-2">Messages are saved even when WhatsApp delivery fails, so staff can still track the conversation history.</div>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center bg-ink-1">
          <div className="text-center">
            <h3 className="font-display text-2xl font-bold text-slate-900">WhatsApp Inbox</h3>
            <p className="mt-2 text-sm text-stone-2">Select a conversation to view bot progress, message history, and live staff replies.</p>
          </div>
        </div>
      )}
    </div>
  );
}

