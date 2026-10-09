import { useEffect, useState } from "react";
import { api } from "./api";
import PostCard from "./PostCard.jsx";
import Composer from "./Composer.jsx";

export default function Feed({ user, onNavigate }) {
  const [posts, setPosts] = useState([]);
  const [cursor, setCursor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [hasMore, setHasMore] = useState(true);

  async function loadInitial() {
    setLoading(true);
    setError("");
    try {
      const data = await api.getFeed();
      setPosts(data.posts);
      setCursor(data.nextCursor);
      setHasMore(Boolean(data.nextCursor));
    } catch {
      setError("Couldn't load the feed — check your connection and try again");
    } finally {
      setLoading(false);
    }
  }

  async function loadMore() {
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const data = await api.getFeed(cursor);
      // De-dupe defensively: a post created between page loads could land
      // on both sides of a cursor boundary.
      setPosts((prev) => {
        const seen = new Set(prev.map((p) => p._id));
        return [...prev, ...data.posts.filter((p) => !seen.has(p._id))];
      });
      setCursor(data.nextCursor);
      setHasMore(Boolean(data.nextCursor));
    } catch {
      setError("Couldn't load more posts");
    } finally {
      setLoadingMore(false);
    }
  }

  useEffect(() => {
    loadInitial();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handlePosted(newPost) {
    setPosts((prev) => [{ ...newPost, likedByMe: false }, ...prev]);
  }

  function handleDeleted(id) {
    setPosts((prev) => prev.filter((p) => p._id !== id));
  }

  return (
    <div>
      <Composer user={user} onPosted={handlePosted} />

      {loading && <div className="feed-loading">Loading feed…</div>}

      {!loading && error && posts.length === 0 && (
        <div className="feed-error">
          {error}
          <div style={{ marginTop: 10 }}>
            <button className="load-more" onClick={loadInitial}>
              Retry
            </button>
          </div>
        </div>
      )}

      {!loading && !error && posts.length === 0 && (
        <div className="feed-empty">No posts yet — be the first to say something.</div>
      )}

      {posts.map((post) => (
        <PostCard
          key={post._id}
          post={post}
          currentUserId={user?.id}
          onDeleted={handleDeleted}
          onNavigate={onNavigate}
        />
      ))}

      {!loading && posts.length > 0 && hasMore && (
        <button className="load-more" onClick={loadMore} disabled={loadingMore}>
          {loadingMore ? "Loading…" : "Show more"}
        </button>
      )}

      {!loading && posts.length > 0 && !hasMore && (
        <div className="feed-end">You're all caught up</div>
      )}
    </div>
  );
}
