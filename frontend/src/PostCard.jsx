import { useState } from "react";
import { api } from "./api";

function timeAgo(iso) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return new Date(iso).toLocaleDateString();
}

function initials(name) {
  return (name || "?")
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export default function PostCard({ post, currentUserId, onDeleted, onNavigate }) {
  const [likeCount, setLikeCount] = useState(post.likeCount ?? post.likes?.length ?? 0);
  const [likedByMe, setLikedByMe] = useState(post.likedByMe ?? false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const isOwn = post.author?._id === currentUserId;

  async function handleLike() {
    if (busy) return;
    // Optimistic update, rolled back on failure.
    const prevLiked = likedByMe;
    const prevCount = likeCount;
    setLikedByMe(!prevLiked);
    setLikeCount(prevLiked ? prevCount - 1 : prevCount + 1);
    setBusy(true);
    try {
      const res = await api.toggleLike(post._id);
      setLikedByMe(res.likedByMe);
      setLikeCount(res.likeCount);
    } catch {
      setLikedByMe(prevLiked);
      setLikeCount(prevCount);
      setError("Couldn't update like — try again");
      setTimeout(() => setError(""), 2500);
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (busy || !confirm("Delete this post?")) return;
    setBusy(true);
    try {
      await api.deletePost(post._id);
      onDeleted?.(post._id);
    } catch {
      setError("Couldn't delete — try again");
      setBusy(false);
      setTimeout(() => setError(""), 2500);
    }
  }

  return (
    <article className="post-card">
      <div className="avatar">
        {post.author?.avatarUrl ? (
          <img src={post.author.avatarUrl} alt="" className="avatar-img" />
        ) : (
          initials(post.author?.displayName)
        )}
      </div>
      <div className="post-main">
        <div className="post-meta">
          <button
            type="button"
            className="author-link"
            onClick={() => onNavigate?.(post.author?.handle)}
          >
            <span className="name">{post.author?.displayName || "Unknown"}</span>
            <span className="handle">@{post.author?.handle || "unknown"}</span>
          </button>
          <span className="dot">·</span>
          <span className="time">{timeAgo(post.createdAt)}</span>
        </div>
        {post.text && <p className="post-text">{post.text}</p>}
        {post.imageUrl && post.mediaType === "video" && (
          <video className="post-image" src={post.imageUrl} controls playsInline />
        )}
        {post.imageUrl && post.mediaType !== "video" && (
          <img className="post-image" src={post.imageUrl} alt="" />
        )}
        <div className="post-actions">
          <button
            className={likedByMe ? "liked" : ""}
            onClick={handleLike}
            disabled={busy}
            aria-pressed={likedByMe}
          >
            {likedByMe ? "♥" : "♡"} {likeCount > 0 ? likeCount : ""}
          </button>
          {isOwn && (
            <button className="delete" onClick={handleDelete} disabled={busy}>
              Delete
            </button>
          )}
        </div>
        {error && <div className="form-error">{error}</div>}
      </div>
    </article>
  );
}
