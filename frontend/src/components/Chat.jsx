import { useCallback, useEffect, useRef, useState } from 'react';
import { addContact, blockContact, getMessages, getUsers, unblockContact } from '../api';
import { decryptMessage, deriveConversationKey, encryptFile, encryptMessage } from '../crypto';
import { detectDeepfake } from '../aiDetect';
import { inspectImageSafety, inspectTextSafety } from '../contentSafety';
import socket from '../socket';

function formatTime(timestamp) {
  return new Date(timestamp).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

const EMOJI_GROUPS = [
  { label: 'Faces', emojis: ['😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '🥲', '🥹', '☺️', '😊', '😇', '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘', '😗', '😙', '😚', '😋', '😛', '😜', '🤪', '😝', '🤑', '🤗', '🤭', '🫢', '🫣', '🤫', '🤔', '🫡', '🤐', '🤨', '😐', '😑', '😶', '🫥', '😏', '😒', '🙄', '😬', '😮‍💨', '🤥', '😔', '🥺', '😬', '😴', '🤤', '😷', '🤒', '🤕', '🤢', '🤮', '🥵', '🥶', '🥴', '😵', '🤯', '🥳', '🥸', '😎', '🤓', '🧐'] },
  { label: 'Hands', emojis: ['👋', '🤚', '🖐️', '✋', '🖖', '🫱', '🫲', '🫳', '🫴', '👌', '🤌', '🤏', '✌️', '🤞', '🫰', '🤟', '🤘', '🤙', '👈', '👉', '👆', '👇', '☝️', '🫵', '👍', '👎', '✊', '👊', '🤛', '🤜', '👏', '🙌', '🫶', '👐', '🤲', '🙏', '💅', '💪', '🦾', '🖕', '✍️'] },
  { label: 'Hearts', emojis: ['❤️', '🩷', '🧡', '💛', '💚', '💙', '🩵', '💜', '🤎', '🖤', '🩶', '🤍', '💔', '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💟', '❤️‍🔥', '❤️‍🩹', '💌', '💋'] },
  { label: 'Nature', emojis: ['🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯', '🦁', '🐮', '🐷', '🐸', '🐵', '🐔', '🐧', '🐦', '🦄', '🐝', '🦋', '🐢', '🐬', '🐳', '🌸', '🌼', '🌻', '🌹', '🌷', '🌱', '🌲', '🌈', '☀️', '🌙', '⭐', '✨', '🔥', '🌊', '🍀'] },
  { label: 'Food', emojis: ['🍎', '🍊', '🍋', '🍉', '🍇', '🍓', '🫐', '🍒', '🍑', '🥭', '🍍', '🥥', '🥝', '🍅', '🥑', '🍆', '🥕', '🌽', '🌶️', '🥐', '🍞', '🧀', '🍕', '🍔', '🍟', '🌮', '🍜', '🍣', '🍰', '🎂', '🍪', '🍩', '🍫', '☕', '🧋', '🥤'] },
  { label: 'Activities', emojis: ['⚽', '🏀', '🏈', '⚾', '🎾', '🏐', '🎱', '🏓', '🏸', '🥊', '🎮', '🎲', '🎯', '🎨', '🎤', '🎧', '🎼', '🎹', '🥁', '🎸', '🎬', '🎉', '🎊', '🎁', '🏆', '🥇', '🚀', '✈️', '🚗', '🚲', '⏰', '💡', '💯', '✅', '❌', '💬', '💤', '🔔'] }
];

const STICKERS = [
  { label: 'Party time', emoji: '🥳🎉' }, { label: 'Sending love', emoji: '🥰💖' },
  { label: 'Big hug', emoji: '🫂💛' }, { label: 'You got this', emoji: '💪🔥' },
  { label: 'Good job', emoji: '👏✨' }, { label: 'Thank you', emoji: '🙏💐' },
  { label: 'On my way', emoji: '🚀💨' }, { label: 'Good morning', emoji: '🌞☕' },
  { label: 'Good night', emoji: '🌙💤' }, { label: 'So cute', emoji: '🐻💕' },
  { label: 'Cat love', emoji: '🐱💖' }, { label: 'Happy dance', emoji: '💃🕺' },
  { label: 'Winner', emoji: '🏆🥇' }, { label: 'High five', emoji: '🙌✨' },
  { label: 'Oops', emoji: '🙈😅' }, { label: 'Mind blown', emoji: '🤯💥' },
  { label: 'You are amazing', emoji: '🌟🫵' }, { label: 'Best friends', emoji: '🫶👯' },
  { label: 'Sending flowers', emoji: '💐🌷' }, { label: 'Delicious', emoji: '😋🍕' },
  { label: 'Rainbows', emoji: '🌈🦄' }, { label: 'Lets go', emoji: '🎯🔥' },
  { label: 'Proud of you', emoji: '🥹👏' }, { label: 'Love you', emoji: '💌❤️' },
  { label: 'Chill', emoji: '😎🧋' }, { label: 'Good vibes', emoji: '☀️🌻' },
  { label: 'Bear hug', emoji: '🐻🫂' }, { label: 'Sparkle', emoji: '✨🪄' },
  { label: 'Cheers', emoji: '🥂🎊' }, { label: 'Sweet dreams', emoji: '🌠🌙' }
];

export default function Chat({ user, onLogout }) {
  const [contacts, setContacts] = useState([]);
  const [online, setOnline] = useState([]);
  const [selected, setSelected] = useState(null);
  const [messages, setMessages] = useState([]);
  const [activeMessageActions, setActiveMessageActions] = useState(null);
  const [replyingTo, setReplyingTo] = useState(null);
  const [draft, setDraft] = useState('');
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);
  const [emojiPickerTab, setEmojiPickerTab] = useState('emoji');
  const [contactSearch, setContactSearch] = useState('');
  const [typing, setTyping] = useState(false);
  const [busy, setBusy] = useState(false);
  const [addingContact, setAddingContact] = useState(false);
  const [blocking, setBlocking] = useState(false);
  const [unread, setUnread] = useState({});
  const [notificationPermission, setNotificationPermission] = useState(() =>
    'Notification' in window ? Notification.permission : 'unsupported'
  );
  const [notice, setNotice] = useState(null);
  const [error, setError] = useState('');
  const messagesRef = useRef(null);
  const composerRef = useRef(null);
  const pointerStartRef = useRef(null);
  const suppressMessageClickRef = useRef(false);
  const shouldAutoScrollRef = useRef(true);
  const scrollFrameRef = useRef(null);
  const selectedRef = useRef(selected);
  const contactsRef = useRef(contacts);
  const noticeTimerRef = useRef(null);
  selectedRef.current = selected;
  contactsRef.current = contacts;
  const filteredContacts = contacts.filter((contact) =>
    contact.username.toLowerCase().includes(contactSearch.trim().toLowerCase())
  );
  const exactContactMatch = contacts.some((contact) =>
    contact.username === contactSearch.trim().toLowerCase()
  );
  const canAddSearchedContact = /^[a-z0-9_]{3,24}$/i.test(contactSearch.trim()) && !exactContactMatch;
  const conversationBlocked = Boolean(selected?.blockedByMe || selected?.blockedMe);

  const decryptForDisplay = useCallback(async (items, peer) => {
    const activeItems = items.map((message) => message.unsent
      ? { ...message, body: 'Message unsent' }
      : message);
    const itemsToDecrypt = activeItems.filter((message) => !message.unsent);
    if (itemsToDecrypt.length === 0) return activeItems;
    if (!peer?.publicKey) {
      return activeItems.map((message) => message.unsent
        ? message
        : { ...message, body: '[Contact encryption key unavailable]' });
    }
    const key = await deriveConversationKey(user.identity.privateKey, peer.publicKey);
    const decrypted = await Promise.all(itemsToDecrypt.map(async (message) => {
      const plaintext = await decryptMessage(message.ciphertext, message.iv, key);
      if (plaintext === '[Decryption failed]') {
        return {
          ...message,
          body: '[Unable to decrypt: this message uses a different or unavailable identity key. Check the original browser profile and app address. If its saved identity was lost, this message cannot be recovered.]'
        };
      }
      let body = plaintext;
      let replyTo = null;
      try {
        const envelope = JSON.parse(plaintext);
        if (envelope?.ciphertrustMessage === 1 && typeof envelope.text === 'string') {
          body = envelope.text;
          replyTo = envelope.replyTo || null;
        }
      } catch {
        // Messages sent before reply support contain plain text.
      }
      if (message.type === 'image') {
        try {
          const safety = await inspectImageSafety(body);
          return {
            ...message,
            replyTo,
            body: safety.restricted
              ? '[Image hidden by the on-device adult-content safety check]'
              : body
          };
        } catch {
          return { ...message, replyTo, body: '[Image hidden because its safety check could not run]' };
        }
      }
      const restrictedCategory = message.type === 'text' ? inspectTextSafety(body) : null;
      return {
        ...message,
        replyTo,
        body: restrictedCategory
          ? `[Restricted on this device: ${restrictedCategory} was hidden]`
          : body
      };
    }));
    const decryptedById = new Map(decrypted.map((message) => [message._id, message]));
    return activeItems.map((message) => message.unsent ? message : decryptedById.get(message._id));
  }, [user.identity.privateKey]);

  useEffect(() => {
    shouldAutoScrollRef.current = true;
    let active = true;
    const clearSelectedUnread = () => {
      const current = selectedRef.current;
      if (!document.hidden && current) {
        setUnread((items) => {
          if (!items[current.username]) return items;
          const next = { ...items };
          delete next[current.username];
          return next;
        });
      }
    };
    document.addEventListener('visibilitychange', clearSelectedUnread);
    getUsers().then((items) => { if (active) setContacts(items); }).catch((cause) => setError(cause.message));
    socket.auth = { token: user.token };
    socket.on('online-users', setOnline);
    socket.on('user-online', (name) => setOnline((current) => current.includes(name) ? current : [...current, name]));
    socket.on('user-offline', (name) => setOnline((current) => current.filter((entry) => entry !== name)));
    socket.on('typing', (payload) => {
      if (payload.from === selectedRef.current?.username) {
        setTyping(true);
        window.setTimeout(() => setTyping(false), 1500);
      }
    });
    const registerSocketUser = () => socket.emit('register', user.username);
    socket.on('connect', registerSocketUser);
    socket.on('new-message', async (message) => {
      const peer = contactsRef.current.find((contact) => contact.username === message.from);
      const isOpenConversation = selectedRef.current?.username === message.from && !document.hidden;
      if (isOpenConversation) {
        setUnread((current) => {
          if (!current[message.from]) return current;
          const next = { ...current };
          delete next[message.from];
          return next;
        });
      } else {
        setUnread((current) => ({ ...current, [message.from]: (current[message.from] || 0) + 1 }));
        setNotice({ username: message.from, id: `${message.from}-${message.timestamp}` });
        window.clearTimeout(noticeTimerRef.current);
        noticeTimerRef.current = window.setTimeout(() => setNotice(null), 6000);

        if (document.hidden && 'Notification' in window && Notification.permission === 'granted') {
          const browserNotification = new Notification('New encrypted message', {
            body: `Encrypted message from ${message.from}`,
            icon: '/icon.svg',
            tag: `ciphertrust-${message.from}`
          });
          browserNotification.onclick = () => {
            window.focus();
            const contact = contactsRef.current.find((item) => item.username === message.from);
            if (contact) {
              setSelected(contact);
              setUnread((current) => {
                const next = { ...current };
                delete next[message.from];
                return next;
              });
            }
            browserNotification.close();
          };
        }
      }
      if (selectedRef.current?.username === message.from && peer?.publicKey) {
        decryptForDisplay([message], peer)
          .then((decoded) => setMessages((list) => list.some((item) => item._id === message._id) ? list : [...list, decoded[0]]))
          .catch((cause) => setError(cause.message));
      }
    });
    socket.on('message-sent', (message) => {
      setMessages((current) => current.map((item) => item.clientId === message.clientId
        ? { ...item, ...message, clientId: undefined }
        : item));
    });
    socket.on('message-deleted', (message) => {
      setActiveMessageActions(null);
      setMessages((current) => current.filter((item) => item._id !== message._id));
    });
    socket.on('message-error', (payload) => setError(payload.error));
    socket.on('connect_error', (cause) => setError(`Realtime connection failed: ${cause.message}`));
    const connectTimer = window.setTimeout(() => socket.connect(), 0);
    return () => {
      active = false;
      document.removeEventListener('visibilitychange', clearSelectedUnread);
      window.clearTimeout(noticeTimerRef.current);
      window.clearTimeout(connectTimer);
      socket.removeAllListeners();
      socket.disconnect();
    };
  }, [user.token, user.username, decryptForDisplay]);

  useEffect(() => {
    shouldAutoScrollRef.current = true;
    setActiveMessageActions(null);
    setReplyingTo(null);
    let active = true;
    if (selected) {
      setUnread((current) => {
        if (!current[selected.username]) return current;
        const next = { ...current };
        delete next[selected.username];
        return next;
      });
    }
    if (!selected) {
      setMessages([]);
      return () => { active = false; };
    }
    setMessages([]);
    setError('');
    getMessages(user.username, selected.username)
      .then((items) => decryptForDisplay(items, selected))
      .then((items) => { if (active) setMessages(items); })
      .catch((cause) => { if (active) setError(cause.message); });
    return () => { active = false; };
  }, [selected, user.username, decryptForDisplay]);

  useEffect(() => {
    if (!shouldAutoScrollRef.current || !messagesRef.current) return undefined;
    scrollFrameRef.current = window.requestAnimationFrame(() => {
      const container = messagesRef.current;
      if (container) container.scrollTop = container.scrollHeight;
    });
    return () => window.cancelAnimationFrame(scrollFrameRef.current);
  }, [messages]);

  async function sendText(event) {
    event?.preventDefault();
    if (!draft.trim() || !selected?.publicKey || conversationBlocked || busy) return;
    const restrictedCategory = inspectTextSafety(draft.trim());
    if (restrictedCategory) {
      setError(`This message may contain ${restrictedCategory} and was not sent.`);
      return;
    }
    setBusy(true);
    setError('');
    try {
      if (!socket.connected) throw new Error('Chat server is disconnected. Check your connection and try again.');
      const key = await deriveConversationKey(user.identity.privateKey, selected.publicKey);
      const text = draft.trim();
      const replyTo = replyingTo ? {
        id: replyingTo.id,
        from: replyingTo.from,
        type: replyingTo.type,
        preview: replyingTo.preview
      } : null;
      const encrypted = await encryptMessage(JSON.stringify({
        ciphertrustMessage: 1,
        text,
        replyTo
      }), key);
      const clientId = crypto.randomUUID();
      const timestamp = Date.now();
      socket.emit('send-message', { to: selected.username, ...encrypted, type: 'text', clientId });
      setMessages((current) => [...current, {
        _id: `local-${clientId}`, clientId, from: user.username, to: selected.username,
        body: text, timestamp, type: 'text', replyTo
      }]);
      setDraft('');
      setReplyingTo(null);
      setEmojiPickerOpen(false);
      window.requestAnimationFrame(() => composerRef.current?.focus());
    } catch (cause) {
      setError(cause.message);
    } finally {
      setBusy(false);
    }
  }

  async function sendImage(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !selected?.publicKey || conversationBlocked) return;
    if (file.size > 6 * 1024 * 1024) {
      setError('Images must be smaller than 6 MB so the encrypted message fits the relay limit.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      if (!socket.connected) throw new Error('Chat server is disconnected. Check your connection and try again.');
      const contentSafety = await inspectImageSafety(file);
      if (contentSafety.restricted) throw new Error(`Image blocked: it may contain ${contentSafety.category}.`);
      const analysis = await detectDeepfake(file);
      const key = await deriveConversationKey(user.identity.privateKey, selected.publicKey);
      const encrypted = await encryptFile(file, key);
      const clientId = crypto.randomUUID();
      const timestamp = Date.now();
      const dataUrl = `data:${file.type};base64,${await fileToBase64(file)}`;
      socket.emit('send-message', {
        to: selected.username, ...encrypted, type: 'image',
        aiVerdict: analysis.verdict, aiConfidence: analysis.confidence, clientId
      });
      setMessages((current) => [...current, {
        _id: `local-${clientId}`, clientId, from: user.username, to: selected.username,
        body: dataUrl, timestamp, type: 'image',
        aiVerdict: analysis.verdict, aiConfidence: analysis.confidence
      }]);
    } catch (cause) {
      setError(cause.message);
    } finally {
      setBusy(false);
    }
  }

  async function unsendMessage(message) {
    if (!message._id || message._id.startsWith('local-') || message.unsent || busy) return;
    if (!window.confirm('Unsend this message for everyone?')) return;
    if (!socket.connected) {
      setError('Chat server is disconnected. Reconnect before unsending this message.');
      return;
    }
    setBusy(true);
    setError('');
    socket.timeout(10000).emit('unsend-message', { messageId: message._id }, (timeoutError, result) => {
      if (timeoutError) setError('Unsend timed out. Check your connection and retry.');
      else if (!result?.ok) setError(result?.error || 'Message could not be unsent.');
      else {
        setActiveMessageActions(null);
        setMessages((current) => current.filter((item) => item._id !== message._id));
      }
      setBusy(false);
    });
  }

  function replyToMessage(message) {
    if (message.unsent || !message._id || message._id.startsWith('local-')) return;
    const preview = message.type === 'image'
      ? 'Image'
      : message.body.slice(0, 120);
    setReplyingTo({
      id: message._id,
      from: message.from,
      type: message.type,
      preview
    });
    setActiveMessageActions(null);
    window.requestAnimationFrame(() => composerRef.current?.focus());
  }

  function insertEmoji(emoji) {
    const input = composerRef.current;
    const start = input?.selectionStart ?? draft.length;
    const end = input?.selectionEnd ?? draft.length;
    const nextDraft = `${draft.slice(0, start)}${emoji}${draft.slice(end)}`;
    setDraft(nextDraft);
    window.requestAnimationFrame(() => {
      if (!input) return;
      input.focus();
      const cursor = start + emoji.length;
      input.setSelectionRange(cursor, cursor);
    });
  }

  async function sendSticker(sticker) {
    if (!selected?.publicKey || conversationBlocked || busy) return;
    setBusy(true);
    setError('');
    try {
      if (!socket.connected) throw new Error('Chat server is disconnected. Check your connection and try again.');
      const key = await deriveConversationKey(user.identity.privateKey, selected.publicKey);
      const replyTo = replyingTo ? {
        id: replyingTo.id,
        from: replyingTo.from,
        type: replyingTo.type,
        preview: replyingTo.preview
      } : null;
      const encrypted = await encryptMessage(JSON.stringify({
        ciphertrustMessage: 1,
        text: sticker.emoji,
        replyTo
      }), key);
      const clientId = crypto.randomUUID();
      const timestamp = Date.now();
      socket.emit('send-message', {
        to: selected.username,
        ...encrypted,
        type: 'sticker',
        clientId
      });
      setMessages((current) => [...current, {
        _id: `local-${clientId}`,
        clientId,
        from: user.username,
        to: selected.username,
        body: sticker.emoji,
        timestamp,
        type: 'sticker',
        replyTo
      }]);
      setReplyingTo(null);
      setEmojiPickerOpen(false);
    } catch (cause) {
      setError(cause.message);
    } finally {
      setBusy(false);
    }
  }

  function startMessageSwipe(event) {
    if (event.pointerType !== 'touch' && event.pointerType !== 'pen') return;
    pointerStartRef.current = { x: event.clientX, y: event.clientY };
  }

  function finishMessageSwipe(event, message) {
    const start = pointerStartRef.current;
    pointerStartRef.current = null;
    if (!start || message.unsent || !message._id || message._id.startsWith('local-')) return;
    const deltaX = event.clientX - start.x;
    const deltaY = event.clientY - start.y;
    if (Math.abs(deltaX) < 60 || Math.abs(deltaX) < Math.abs(deltaY) * 1.3) return;
    suppressMessageClickRef.current = true;
    replyToMessage(message);
    window.setTimeout(() => { suppressMessageClickRef.current = false; }, 0);
  }

  async function addContactByUsername(event) {
    event.preventDefault();
    const username = contactSearch.trim().toLowerCase();
    if (!username || addingContact) return;
    setAddingContact(true);
    setError('');
    try {
      const contact = await addContact(username);
      setContacts((current) => current.some((item) => item.username === contact.username)
        ? current
        : [...current, contact].sort((left, right) => left.username.localeCompare(right.username)));
      setSelected(contact);
      setContactSearch('');
    } catch (cause) {
      setError(cause.message);
    } finally {
      setAddingContact(false);
    }
  }

  async function enableNotifications() {
    if (!('Notification' in window)) return;
    const permission = await Notification.requestPermission();
    setNotificationPermission(permission);
  }

  async function toggleBlock() {
    if (!selected || blocking) return;
    const shouldBlock = !selected.blockedByMe;
    if (shouldBlock && !window.confirm(`Block @${selected.username}? New messages and typing indicators will be stopped. Existing messages will remain in chat history.`)) return;

    setBlocking(true);
    setError('');
    try {
      if (shouldBlock) await blockContact(selected.username);
      else await unblockContact(selected.username);
      const updated = { ...selected, blockedByMe: shouldBlock };
      setSelected(updated);
      setContacts((current) => current.map((contact) =>
        contact.username === selected.username ? { ...contact, blockedByMe: shouldBlock } : contact
      ));
      setTyping(false);
    } catch (cause) {
      setError(cause.message);
    } finally {
      setBlocking(false);
    }
  }

  return (
    <div className="chat-shell flex h-[100dvh] min-h-[520px] overflow-hidden p-0 text-gray-100 sm:p-3 lg:p-5">
      <div className="chat-frame flex min-h-0 w-full overflow-hidden sm:rounded-2xl">
      <aside className={`${selected ? 'hidden md:flex' : 'flex'} contacts-panel w-full flex-col border-r border-white/50 md:w-[310px] md:shrink-0 lg:w-[340px]`}>
        <div className="flex items-center justify-between border-b border-white/40 px-5 py-5">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl border border-teal-900/10 bg-white/60 text-teal-800">
              <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden="true"><path d="M7 10V7a5 5 0 0 1 10 0v3m-11 0h12a2 2 0 0 1 2 2v8H4v-8a2 2 0 0 1 2-2Z" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/><circle cx="12" cy="15" r="1" fill="currentColor"/></svg>
            </div>
            <div><p className="font-semibold tracking-tight text-slate-800">Cipher<span className="text-teal-700">Trust</span></p><p className="mt-0.5 text-xs text-slate-500">@{user.username}</p></div>
          </div>
          <button onClick={onLogout} className="rounded-lg border border-teal-950/10 bg-white/25 px-3 py-2 text-xs font-medium text-slate-600 transition hover:bg-white/70 hover:text-slate-900">Log out</button>
        </div>
        {'Notification' in window && notificationPermission === 'default' && (
          <button onClick={enableNotifications} className="mx-4 mt-3 flex items-center justify-center gap-2 rounded-xl border border-teal-900/10 bg-white/30 px-3 py-2 text-xs font-medium text-slate-600 transition hover:bg-white/65">
            <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden="true"><path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9ZM10 21h4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
            Enable browser notifications
          </button>
        )}
        {notificationPermission === 'granted' && <p className="mx-5 mt-3 text-center text-[11px] text-teal-700">Browser notifications are enabled</p>}
        {notificationPermission === 'denied' && <p className="mx-5 mt-3 text-center text-[11px] text-slate-500">Notifications are blocked in browser settings</p>}
        <div className="px-5 pb-3 pt-6">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Your contacts</p>
            <span className="rounded-full bg-white/45 px-2 py-0.5 text-[11px] text-slate-500">{contacts.length}</span>
          </div>
          <label className="relative block">
            <svg viewBox="0 0 24 24" fill="none" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" aria-hidden="true"><circle cx="10.8" cy="10.8" r="6.8" stroke="currentColor" strokeWidth="1.7"/><path d="m16 16 4 4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/></svg>
            <input aria-label="Search or add contacts" value={contactSearch} onChange={(event) => setContactSearch(event.target.value)} placeholder="Search contacts or enter a username" className={`input-field border-white/50 bg-white/45 py-2.5 pl-9 text-sm text-slate-800 placeholder:text-slate-500 focus:border-teal-700/30 focus:ring-teal-700/10 ${canAddSearchedContact ? 'pr-24' : ''}`} />
          </label>
        </div>
        {canAddSearchedContact && <form onSubmit={addContactByUsername} className="mx-5 -mt-1 mb-3 flex justify-end">
          <button aria-label={`Add ${contactSearch.trim()} as a contact`} disabled={addingContact} className="primary-button rounded-lg px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50">
            {addingContact ? 'Adding…' : `+ Add @${contactSearch.trim()}`}
          </button>
        </form>}
        {!selected && error && <p role="alert" className="mx-4 mb-2 rounded-lg border border-red-300/50 bg-red-50/70 px-3 py-2 text-sm text-red-800">{error}</p>}
        <div className="flex-1 overflow-y-auto p-3">
          {filteredContacts.map((contact) => (
            <button key={contact.username} onClick={() => setSelected(contact)} className={`contact-row mb-1 flex w-full items-center gap-3 rounded-xl p-3 text-left transition ${selected?.username === contact.username ? 'contact-row-active' : ''}`}>
              <span className="relative grid h-11 w-11 shrink-0 place-items-center rounded-full border border-white/80 bg-gradient-to-br from-teal-100 to-cyan-100 font-semibold text-teal-900 shadow-sm">{contact.username[0]?.toUpperCase()}<i className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-[#dcece6] ${online.includes(contact.username) ? 'bg-teal-500' : 'bg-slate-400'}`} /></span>
              <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium text-slate-800">{contact.username}</span><span className={`mt-1 block text-xs ${online.includes(contact.username) ? 'text-teal-700' : 'text-slate-500'}`}>{online.includes(contact.username) ? 'Online now' : 'Offline'}</span></span>
              {unread[contact.username] > 0 && <span className="grid h-5 min-w-5 place-items-center rounded-full bg-teal-700 px-1.5 text-[10px] font-semibold text-white">{unread[contact.username] > 99 ? '99+' : unread[contact.username]}</span>}
              {!contact.publicKey && <span className="ml-auto text-[10px] text-amber-700" title="Contact needs to sign in to set up encryption">Key pending</span>}
            </button>
          ))}
          {filteredContacts.length === 0 && <div className="px-3 py-8 text-center"><div className="mx-auto mb-3 grid h-10 w-10 place-items-center rounded-xl bg-white/40 text-slate-500">⌕</div><p className="text-sm text-slate-700">{contacts.length ? 'No matching contacts' : 'Your list is private'}</p><p className="mt-1 text-xs leading-5 text-slate-500">{contacts.length ? 'Try another username.' : 'Add someone by their username to start a conversation.'}</p></div>}
        </div>
        <div className="border-t border-white/50 p-4">
          <div className="flex items-center gap-2 rounded-xl bg-white/35 px-3 py-2.5 text-xs text-slate-600"><span className="text-teal-700">✳</span><span>Contacts are only visible to you.</span></div>
          <p className="mt-3 text-center text-[10px] leading-relaxed text-slate-500">Private messages and on-device safety checks.</p>
        </div>
      </aside>
      <main className={`${selected ? 'flex' : 'hidden md:flex'} chat-main min-w-0 flex-1 flex-col`}>
        {selected ? <>
          <header className="chat-header flex items-center gap-2 border-b border-white/45 px-3 py-4 sm:gap-3 sm:px-7">
            <button className="grid h-9 w-9 place-items-center rounded-xl border border-white/50 bg-white/30 text-slate-600 transition hover:bg-white/70 hover:text-slate-900 md:hidden" onClick={() => setSelected(null)} aria-label="Back to contacts">←</button>
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-white/80 bg-gradient-to-br from-teal-100 to-cyan-100 font-semibold text-teal-900 shadow-sm">{selected.username[0]?.toUpperCase()}</div>
            <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-slate-800">{selected.username}</p><p className={`mt-0.5 flex items-center gap-1.5 text-xs ${online.includes(selected.username) ? 'text-teal-700' : 'text-slate-500'}`}><span className={`h-1.5 w-1.5 rounded-full ${online.includes(selected.username) ? 'bg-teal-500' : 'bg-slate-400'}`} />{online.includes(selected.username) ? 'Online' : 'Offline'}</p></div>
            <button
              onClick={toggleBlock}
              disabled={blocking}
              className={`shrink-0 rounded-full border px-2.5 py-2 text-[11px] font-medium transition disabled:opacity-50 sm:px-3 sm:text-xs ${selected.blockedByMe ? 'border-teal-800/10 bg-white/45 text-teal-800 hover:bg-white/75' : 'border-rose-800/10 bg-white/35 text-rose-700 hover:bg-rose-50/80'}`}
              aria-label={selected.blockedByMe ? `Unblock ${selected.username}` : `Block ${selected.username}`}
            >
              {blocking ? '…' : selected.blockedByMe ? 'Unblock' : 'Block'}
            </button>
            <span className="inline-flex items-center gap-2 rounded-full border border-teal-800/10 bg-white/45 px-3 py-2 text-[11px] font-medium text-teal-800 sm:text-xs"><svg viewBox="0 0 24 24" fill="none" className="h-3.5 w-3.5" aria-hidden="true"><path d="M7 10V7a5 5 0 0 1 10 0v3m-11 0h12a2 2 0 0 1 2 2v8H4v-8a2 2 0 0 1 2-2Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg><span className="hidden sm:inline">End-to-end encrypted</span><span className="sm:hidden">Encrypted</span></span>
          </header>
          <section
            ref={messagesRef}
            onScroll={(event) => {
              const element = event.currentTarget;
              shouldAutoScrollRef.current = element.scrollHeight - element.scrollTop - element.clientHeight < 120;
            }}
            className="chat-messages flex-1 space-y-5 overflow-y-auto p-4 sm:px-7 sm:py-6"
          >
            {messages.length === 0 && <div className="flex h-full min-h-64 flex-col items-center justify-center pb-8 text-center"><div className="mb-4 grid h-14 w-14 place-items-center rounded-2xl border border-white/70 bg-white/40 text-teal-800"><svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" aria-hidden="true"><path d="M7 10V7a5 5 0 0 1 10 0v3m-11 0h12a2 2 0 0 1 2 2v8H4v-8a2 2 0 0 1 2-2Z" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg></div><p className="text-sm font-medium text-slate-700">A private conversation</p><p className="mt-1 max-w-xs text-xs leading-5 text-slate-600">Messages are encrypted on your device. Say hello to {selected.username}.</p></div>}
            {messages.map((message) => {
              const mine = message.from === user.username;
              const canUnsend = mine && !message.unsent && !message._id.startsWith('local-');
              const canShowActions = !message.unsent && !message._id.startsWith('local-');
              const actionsOpen = activeMessageActions === message._id;
              return               <div key={message._id} className={`message-row flex ${mine ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[88%] sm:max-w-[70%] ${canShowActions ? 'cursor-pointer' : ''}`}>
                <div
                  className={`message-bubble rounded-2xl px-4 py-3 ${canShowActions ? 'transition hover:ring-2 hover:ring-teal-700/20' : ''} ${mine ? 'message-mine rounded-br-md text-slate-800' : 'message-theirs rounded-bl-md text-slate-800'}`}
                  onPointerDown={canShowActions ? startMessageSwipe : undefined}
                  onPointerUp={canShowActions ? (event) => finishMessageSwipe(event, message) : undefined}
                  onClick={canShowActions ? () => {
                    if (suppressMessageClickRef.current) {
                      suppressMessageClickRef.current = false;
                      return;
                    }
                    setActiveMessageActions(actionsOpen ? null : message._id);
                  } : undefined}
                  onKeyDown={canShowActions ? (event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      setActiveMessageActions(actionsOpen ? null : message._id);
                    }
                  } : undefined}
                  role={canShowActions ? 'button' : undefined}
                  tabIndex={canShowActions ? 0 : undefined}
                  aria-label={canShowActions ? 'Show message actions; swipe to reply' : undefined}
                  aria-expanded={canShowActions ? actionsOpen : undefined}
                >
                {message.replyTo && <div className="mb-2 rounded-lg border-l-2 border-teal-700/50 bg-white/35 px-2.5 py-1.5 text-xs"><p className="font-medium text-teal-800">{message.replyTo.from === user.username ? 'You' : `@${message.replyTo.from}`}</p><p className="truncate text-slate-600">{message.replyTo.preview}</p></div>}
                {message.type === 'sticker' ? <p className="py-1 text-center text-5xl leading-tight" role="img" aria-label="Sticker">{message.body}</p> :
                  message.type === 'image' && message.body.startsWith('data:image/') ? <img src={message.body} alt="Encrypted shared image" loading="lazy" decoding="async" className="mb-2 max-h-72 max-w-full rounded-lg object-contain" /> :
                    message.type === 'image' ? <p className="text-sm">🔒 {message.body}</p> :
                    <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{message.body}</p>}
                  {message.aiVerdict && <p className="mt-2 rounded-lg border border-teal-950/5 bg-white/35 px-2.5 py-1.5 text-[11px] text-slate-700">Image check: {message.aiVerdict} · {Math.round((message.aiConfidence || 0) * 100)}% confidence</p>}
                  <p className={`mt-1.5 text-right text-[10px] ${mine ? 'text-teal-950/50' : 'text-slate-500'}`}>{formatTime(message.timestamp)}</p>
                </div>
                {canShowActions && actionsOpen && <div className="mt-1 flex justify-end gap-2">
                  <button type="button" onClick={() => replyToMessage(message)} className="rounded-lg border border-teal-200 bg-white/90 px-3 py-1.5 text-xs font-medium text-teal-800 shadow-sm hover:bg-teal-50">Reply</button>
                  {canUnsend && <button type="button" onClick={() => unsendMessage(message)} className="rounded-lg border border-rose-200 bg-white/90 px-3 py-1.5 text-xs font-medium text-rose-700 shadow-sm hover:bg-rose-50 disabled:opacity-50" disabled={busy}>Unsend</button>}
                </div>}
                </div>
              </div>;
            })}
            {typing && <p className="text-sm text-gray-500">{selected.username} is typing…</p>}
          </section>
          {conversationBlocked && <p className="mx-4 mb-2 rounded-xl border border-rose-300/40 bg-rose-50/70 px-3 py-2.5 text-sm text-rose-800 sm:mx-7">{selected.blockedByMe ? `You blocked @${selected.username}. New messages and typing indicators are stopped; existing history remains.` : `@${selected.username} has blocked you. You cannot send messages in this conversation.`}</p>}
          {error && <p role="alert" className="mx-4 mb-2 rounded-xl border border-red-300/50 bg-red-50/70 px-3 py-2.5 text-sm text-red-800 sm:mx-7">{error}</p>}
          {!selected.publicKey && <p className="mx-4 mb-2 rounded-xl border border-amber-300/50 bg-amber-50/70 px-3 py-2.5 text-sm text-amber-800 sm:mx-7">This contact must sign in before you can send encrypted messages.</p>}
          <form onSubmit={sendText} className="composer-panel relative border-t border-white/50 p-3 sm:px-7 sm:py-4">
            {replyingTo && <div className="mb-2 flex items-center justify-between rounded-xl border-l-2 border-teal-700 bg-white/45 px-3 py-2"><div className="min-w-0"><p className="text-xs font-semibold text-teal-800">Replying to {replyingTo.from === user.username ? 'yourself' : `@${replyingTo.from}`}</p><p className="truncate text-xs text-slate-600">{replyingTo.preview}</p></div><button type="button" onClick={() => setReplyingTo(null)} className="ml-3 rounded-md px-2 py-1 text-slate-500 hover:bg-white/70" aria-label="Cancel reply">✕</button></div>}
            {emojiPickerOpen && <div className="absolute bottom-full left-3 z-20 mb-2 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-white/80 bg-white/95 shadow-xl backdrop-blur sm:left-7">
              <div role="tablist" aria-label="Message reactions" className="flex gap-1 border-b border-slate-200 p-2">
                <button type="button" role="tab" aria-selected={emojiPickerTab === 'emoji'} onClick={() => setEmojiPickerTab('emoji')} className={`rounded-lg px-3 py-1.5 text-xs font-medium ${emojiPickerTab === 'emoji' ? 'bg-teal-100 text-teal-900' : 'text-slate-600 hover:bg-slate-100'}`}>Emoji</button>
                <button type="button" role="tab" aria-selected={emojiPickerTab === 'stickers'} onClick={() => setEmojiPickerTab('stickers')} className={`rounded-lg px-3 py-1.5 text-xs font-medium ${emojiPickerTab === 'stickers' ? 'bg-teal-100 text-teal-900' : 'text-slate-600 hover:bg-slate-100'}`}>Stickers</button>
              </div>
              {emojiPickerTab === 'emoji'
                ? <div role="tabpanel" aria-label="Choose an emoji" className="max-h-72 space-y-2 overflow-y-auto p-2">
                  {EMOJI_GROUPS.map((group) => <section key={group.label}>
                    <h3 className="px-1 pb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">{group.label}</h3>
                    <div className="grid grid-cols-8 gap-0.5">
                      {group.emojis.map((emoji, index) => <button key={`${group.label}-${emoji}-${index}`} type="button" onClick={() => insertEmoji(emoji)} className="grid h-8 w-8 place-items-center rounded-lg text-xl transition hover:bg-teal-50 focus:bg-teal-50 focus:outline-none" aria-label={`Insert ${emoji}`}>{emoji}</button>)}
                    </div>
                  </section>)}
                </div>
                : <div role="tabpanel" aria-label="Choose a sticker" className="grid max-h-72 grid-cols-3 gap-2 overflow-y-auto p-2">
                  {STICKERS.map((sticker) => <button key={sticker.label} type="button" onClick={() => sendSticker(sticker)} disabled={busy} aria-label={`Send sticker: ${sticker.label}`} className="flex min-h-20 flex-col items-center justify-center gap-1 rounded-xl border border-slate-100 bg-white/60 p-2 transition hover:border-teal-200 hover:bg-teal-50 disabled:opacity-50">
                    <span className="text-3xl">{sticker.emoji}</span>
                    <span className="text-center text-[10px] leading-tight text-slate-600">{sticker.label}</span>
                  </button>)}
                </div>}
              <div className="flex items-center justify-between border-t border-slate-200 bg-white/75 px-3 py-2">
                <span className="text-[11px] text-slate-500">{draft.trim() ? 'Emoji added to your message' : 'Choose one or more emoji'}</span>
                <button type="button" onClick={() => { setEmojiPickerOpen(false); void sendText(); }} disabled={!draft.trim() || busy || conversationBlocked || !selected.publicKey} className="rounded-lg bg-teal-700 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-40">Done &amp; send</button>
              </div>
            </div>}
            <div className="flex items-center gap-2.5 sm:gap-3">
            <label className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-white/70 bg-white/45 text-slate-600 transition hover:bg-white/80 hover:text-teal-800 ${conversationBlocked ? 'cursor-not-allowed opacity-40' : 'cursor-pointer'}`} title="Send image" aria-label="Send image"><svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden="true"><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/></svg><input type="file" accept="image/*" className="hidden" onChange={sendImage} disabled={busy || !selected.publicKey || conversationBlocked} /></label>
            <button type="button" onClick={() => setEmojiPickerOpen((open) => !open)} aria-label={emojiPickerOpen ? 'Close emoji picker' : 'Open emoji picker'} aria-expanded={emojiPickerOpen} disabled={busy || conversationBlocked || !selected.publicKey} className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-white/70 bg-white/45 text-xl transition hover:bg-white/80 disabled:cursor-not-allowed disabled:opacity-40">😊</button>
            <input ref={composerRef} aria-label="Message" value={draft} onChange={(event) => { setDraft(event.target.value); if (!conversationBlocked) socket.emit('typing', { to: selected.username }); setTyping(false); }} placeholder={conversationBlocked ? 'Messaging is blocked' : busy ? 'Encrypting securely…' : 'Write a message…'} className="input-field min-w-0 flex-1 border-white/70 bg-white/55 text-slate-800 placeholder:text-slate-500 focus:border-teal-700/30 focus:ring-teal-700/10" disabled={!selected.publicKey || conversationBlocked || busy} />
            <button disabled={busy || conversationBlocked || !draft.trim() || !selected.publicKey} className="primary-button inline-flex h-11 items-center gap-2 rounded-xl px-4 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-35"><span className="hidden sm:inline">Send</span><svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden="true"><path d="m21 3-7.2 18-3.7-7.1L3 10.2 21 3Z" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/><path d="M10.1 13.9 15 9" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/></svg></button>
            </div>
            <p className="mt-2 hidden pl-14 text-[10px] text-slate-500 sm:block">Messages are encrypted on this device before sending.</p>
          </form>
        </> : <div className="empty-chat m-auto max-w-sm px-6 text-center"><div className="mx-auto mb-5 grid h-16 w-16 place-items-center rounded-2xl border border-white/70 bg-white/35 text-teal-800"><svg viewBox="0 0 24 24" fill="none" className="h-7 w-7" aria-hidden="true"><path d="M7 10V7a5 5 0 0 1 10 0v3m-11 0h12a2 2 0 0 1 2 2v8H4v-8a2 2 0 0 1 2-2Z" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg></div><h1 className="text-xl font-semibold tracking-tight text-slate-800">Your space, your privacy</h1><p className="mt-2 text-sm leading-relaxed text-slate-600">Choose a contact or add someone by username to begin a protected conversation.</p></div>}
      </main>
      {notice && (!selected || selected.username !== notice.username) && (
        <button
          onClick={() => {
            const contact = contacts.find((item) => item.username === notice.username);
            if (contact) setSelected(contact);
            setNotice(null);
          }}
          className="message-notice fixed right-4 top-4 z-50 flex max-w-[calc(100vw-2rem)] items-center gap-3 rounded-2xl border border-white/70 px-4 py-3 text-left shadow-xl sm:right-6 sm:top-6"
        >
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/70 font-semibold text-teal-800">{notice.username[0]?.toUpperCase()}</span>
          <span><span className="block text-sm font-semibold text-slate-800">New encrypted message</span><span className="mt-0.5 block text-xs text-slate-600">From {notice.username}</span></span>
          <span className="ml-2 text-xs text-slate-500" aria-label="Dismiss notification">✕</span>
        </button>
      )}
      </div>
    </div>
  );
}

async function fileToBase64(file) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = '';
  const chunkSize = 0x8000;
  for (let start = 0; start < bytes.length; start += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(start, start + chunkSize));
  }
  return btoa(binary);
}
