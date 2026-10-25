import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { AnimatePresence, motion } from "framer-motion";
import {
  Check,
  MessageCircle,
  Send,
  UserPlus,
  UsersRound,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

function displayName(person: { name: string | null; username: string | null }) {
  return person.name?.trim() || person.username || "studywithfun user";
}

function initials(value: string) {
  return value.slice(0, 1).toUpperCase();
}

function timeLabel(value: Date | string) {
  const date = new Date(value);
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export function FriendsWorkspace({ currentUserId }: { currentUserId: number }) {
  const utils = trpc.useUtils();
  const [search, setSearch] = useState("");
  const [selectedFriendId, setSelectedFriendId] = useState<number | null>(null);
  const [messageText, setMessageText] = useState("");
  const normalizedSearch = search.trim();
  const validSearch = /^[a-zA-Z0-9_]{2,24}$/.test(normalizedSearch);
  const bottomRef = useRef<HTMLDivElement>(null);
  const friendsQuery = trpc.friends.list.useQuery();
  const requestsQuery = trpc.friends.requests.useQuery();
  const searchQuery = trpc.friends.search.useQuery(
    { query: normalizedSearch },
    { enabled: validSearch }
  );
  const sendRequest = trpc.friends.sendRequest.useMutation();
  const respond = trpc.friends.respond.useMutation();
  const removeFriend = trpc.friends.remove.useMutation();
  const friends = friendsQuery.data ?? [];
  const incoming = requestsQuery.data?.incoming ?? [];
  const outgoing = requestsQuery.data?.outgoing ?? [];
  const selectedFriend =
    friends.find(friend => friend.id === selectedFriendId) ?? null;
  const messagesQuery = trpc.friends.messages.list.useQuery(
    { friendId: selectedFriendId ?? 0 },
    { enabled: selectedFriendId !== null, refetchInterval: 3000 }
  );
  const sendMessage = trpc.friends.messages.send.useMutation();
  const messages = messagesQuery.data ?? [];
  const outgoingIds = useMemo(
    () => new Set(outgoing.map(item => item.user.id)),
    [outgoing]
  );
  const incomingByUser = useMemo(
    () => new Map(incoming.map(item => [item.user.id, item])),
    [incoming]
  );
  const friendIds = useMemo(
    () => new Set(friends.map(friend => friend.id)),
    [friends]
  );

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, selectedFriendId]);

  const refreshPeople = async () => {
    await Promise.all([
      utils.friends.list.invalidate(),
      utils.friends.requests.invalidate(),
      utils.friends.search.invalidate(),
    ]);
  };

  const requestFriend = async (userId: number) => {
    try {
      await sendRequest.mutateAsync({ userId });
      await refreshPeople();
      toast.success("Friend request sent.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not send request."
      );
    }
  };

  const respondToRequest = async (requestId: number, accept: boolean) => {
    try {
      await respond.mutateAsync({ requestId, accept });
      await refreshPeople();
      toast.success(accept ? "You’re friends now." : "Request declined.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not update request."
      );
    }
  };

  const unfriend = async (userId: number) => {
    const friend = friends.find(person => person.id === userId);
    if (
      !friend ||
      !window.confirm(`Remove ${displayName(friend)} from your friends?`)
    )
      return;
    try {
      await removeFriend.mutateAsync({ userId });
      if (selectedFriendId === userId) setSelectedFriendId(null);
      await refreshPeople();
      toast.success("Friend removed.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not remove friend."
      );
    }
  };

  const submitMessage = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const body = messageText.trim();
    if (!selectedFriend || !body) return;
    try {
      await sendMessage.mutateAsync({ friendId: selectedFriend.id, body });
      setMessageText("");
      await messagesQuery.refetch();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not send message."
      );
    }
  };

  return (
    <motion.section
      className="friends-page"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28 }}
    >
      <header className="friends-intro">
        <div>
          <span className="eyebrow">
            <span className="live-dot" /> STUDY TOGETHER
          </span>
          <h1>Friends</h1>
          <p>
            Find study partners and keep your conversations private between
            friends.
          </p>
        </div>
        <span className="materials-count">
          <UsersRound size={15} /> {friends.length}{" "}
          {friends.length === 1 ? "friend" : "friends"}
        </span>
      </header>

      <div className="friends-layout">
        <aside className="friends-directory">
          <section className="panel friend-search-panel">
            <div className="section-title-wrap">
              <span className="section-kicker">
                <UserPlus size={13} /> FIND PEOPLE
              </span>
              <h2>Search by username</h2>
            </div>
            <label className="friend-search-input">
              <UsersRound size={15} />
              <input
                aria-label="Search users by username"
                maxLength={24}
                autoCapitalize="none"
                value={search}
                onChange={event => setSearch(event.target.value)}
                placeholder="Type at least 2 characters"
              />
            </label>
            {!validSearch ? (
              <p className="friends-search-hint">
                Search with 2–24 letters, numbers, or underscores. Only a small
                set of matches is shown.
              </p>
            ) : searchQuery.isLoading ? (
              <p className="friends-search-hint">Looking for people…</p>
            ) : searchQuery.data?.length ? (
              <div className="friend-search-results">
                {searchQuery.data.map(person => {
                  const pendingRequest = incomingByUser.get(person.id);
                  const isFriend = friendIds.has(person.id);
                  const alreadySent = outgoingIds.has(person.id);
                  return (
                    <article className="friend-person-row" key={person.id}>
                      <span
                        className={`user-avatar avatar-${person.profileColor ?? "sage"}`}
                      >
                        {initials(displayName(person))}
                      </span>
                      <div className="friend-person-copy">
                        <strong>{displayName(person)}</strong>
                        <span>@{person.username}</span>
                      </div>
                      {isFriend ? (
                        <span className="friend-state">Friend</span>
                      ) : pendingRequest ? (
                        <button
                          type="button"
                          className="friend-mini-action"
                          onClick={() =>
                            void respondToRequest(pendingRequest.id, true)
                          }
                        >
                          Accept
                        </button>
                      ) : alreadySent ? (
                        <span className="friend-state">Sent</span>
                      ) : (
                        <button
                          type="button"
                          className="friend-mini-action"
                          aria-label={`Send friend request to ${person.username}`}
                          onClick={() => void requestFriend(person.id)}
                        >
                          <UserPlus size={15} />
                        </button>
                      )}
                    </article>
                  );
                })}
              </div>
            ) : (
              <p className="friends-search-hint">No matching accounts yet.</p>
            )}
          </section>

          <section className="panel friend-inbox-panel">
            <div className="section-title-wrap">
              <span className="section-kicker">
                <MessageCircle size={13} /> REQUESTS
              </span>
              <h2>
                Friend requests{" "}
                <span className="heading-count">{incoming.length}</span>
              </h2>
            </div>
            {incoming.length ? (
              <div className="friend-request-list">
                {incoming.map(request => (
                  <article className="friend-person-row" key={request.id}>
                    <span
                      className={`user-avatar avatar-${request.user.profileColor ?? "sage"}`}
                    >
                      {initials(displayName(request.user))}
                    </span>
                    <div className="friend-person-copy">
                      <strong>{displayName(request.user)}</strong>
                      <span>@{request.user.username}</span>
                    </div>
                    <button
                      type="button"
                      className="friend-mini-action"
                      aria-label={`Accept request from ${request.user.username}`}
                      onClick={() => void respondToRequest(request.id, true)}
                    >
                      <Check size={15} />
                    </button>
                    <button
                      type="button"
                      className="friend-mini-action friend-decline-action"
                      aria-label={`Decline request from ${request.user.username}`}
                      onClick={() => void respondToRequest(request.id, false)}
                    >
                      <X size={15} />
                    </button>
                  </article>
                ))}
              </div>
            ) : (
              <p className="friends-search-hint">No new requests.</p>
            )}
          </section>

          <section className="panel friend-list-panel">
            <div className="section-title-wrap">
              <span className="section-kicker">
                <UsersRound size={13} /> YOUR PEOPLE
              </span>
              <h2>
                Friends <span className="heading-count">{friends.length}</span>
              </h2>
            </div>
            {friends.length ? (
              <div className="friends-list">
                {friends.map(friend => (
                  <button
                    type="button"
                    key={friend.id}
                    className={`friend-list-item ${selectedFriendId === friend.id ? "selected" : ""}`}
                    onClick={() => setSelectedFriendId(friend.id)}
                  >
                    <span
                      className={`user-avatar avatar-${friend.profileColor ?? "sage"}`}
                    >
                      {initials(displayName(friend))}
                    </span>
                    <span className="friend-person-copy">
                      <strong>{displayName(friend)}</strong>
                      <span>@{friend.username}</span>
                    </span>
                    <MessageCircle size={15} />
                  </button>
                ))}
              </div>
            ) : (
              <p className="friends-search-hint">
                Add a study partner to start a private chat.
              </p>
            )}
            {outgoing.length > 0 && (
              <p className="friends-outgoing">
                {outgoing.length} outgoing{" "}
                {outgoing.length === 1 ? "request" : "requests"} pending
              </p>
            )}
          </section>
        </aside>

        <section className="panel friend-chat-panel" aria-label="Private chat">
          {selectedFriend ? (
            <>
              <header className="friend-chat-heading">
                <span
                  className={`user-avatar avatar-${selectedFriend.profileColor ?? "sage"}`}
                >
                  {initials(displayName(selectedFriend))}
                </span>
                <div className="friend-person-copy">
                  <strong>{displayName(selectedFriend)}</strong>
                  <span>@{selectedFriend.username} · private chat</span>
                </div>
                <button
                  type="button"
                  className="friend-remove-button"
                  onClick={() => void unfriend(selectedFriend.id)}
                >
                  Remove friend
                </button>
              </header>
              <div className="friend-chat-messages" aria-live="polite">
                {messagesQuery.isLoading ? (
                  <p className="friend-chat-empty">Opening conversation…</p>
                ) : messages.length ? (
                  <AnimatePresence initial={false}>
                    {messages.map(message => {
                      const mine = message.senderId === currentUserId;
                      return (
                        <motion.article
                          key={message.id}
                          className={`chat-bubble ${mine ? "mine" : "theirs"}`}
                          initial={{ opacity: 0, y: 5 }}
                          animate={{ opacity: 1, y: 0 }}
                        >
                          <p>{message.body}</p>
                          <time>{timeLabel(message.createdAt)}</time>
                        </motion.article>
                      );
                    })}
                  </AnimatePresence>
                ) : (
                  <div className="friend-chat-empty">
                    <MessageCircle size={22} />
                    <strong>Start a conversation</strong>
                    <span>
                      Messages in this chat are visible only to you and your
                      friend.
                    </span>
                  </div>
                )}
                <div ref={bottomRef} />
              </div>
              <form className="friend-chat-compose" onSubmit={submitMessage}>
                <textarea
                  aria-label="Write a private message"
                  maxLength={3000}
                  rows={2}
                  value={messageText}
                  onChange={event => setMessageText(event.target.value)}
                  placeholder={`Message ${displayName(selectedFriend)}…`}
                />
                <Button
                  type="submit"
                  className="primary-button"
                  disabled={!messageText.trim() || sendMessage.isPending}
                  aria-label="Send message"
                >
                  <Send size={16} />
                  <span>Send</span>
                </Button>
              </form>
            </>
          ) : (
            <div className="friend-chat-placeholder">
              <span>
                <MessageCircle size={25} />
              </span>
              <strong>Choose a friend to chat</strong>
              <p>
                Search for people or select someone from your friends list to
                open a private conversation.
              </p>
            </div>
          )}
        </section>
      </div>
    </motion.section>
  );
}
