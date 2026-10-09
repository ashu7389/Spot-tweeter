import { useEffect, useRef, useState } from "react";
import { api } from "./api";
import PostCard from "./PostCard.jsx";

const MAX_AVATAR_BYTES = 5 * 1024 * 1024;

function initials(name) {
  return (name || "?")
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function joinedLabel(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

function EditProfileForm({ user, onSaved, onCancel }) {
  const [displayName, setDisplayName] = useState(user.displayName);
  const [bio, setBio] = useState(user.bio || "");
  const [location, setLocation] = useState(user.location || "");
  const [age, setAge] = useState(user.age ?? "");
  const [workDone, setWorkDone] = useState((user.workDone || []).join("\n"));
  const [currentProjects, setCurrentProjects] = useState((user.currentProjects || []).join("\n"));
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(user.avatarUrl || "");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const fileInput = useRef(null);

  function handleAvatarChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Avatar must be an image");
      return;
    }
    if (file.size > MAX_AVATAR_BYTES) {
      setError("Avatar image must be under 5MB");
      return;
    }
    setError("");
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!displayName.trim()) {
      setError("Display name can't be empty");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const formData = new FormData();
      formData.append("displayName", displayName.trim());
      formData.append("bio", bio.trim());
      formData.append("location", location.trim());
      formData.append("age", age === "" ? "" : String(age));
      formData.append("workDone", workDone);
      formData.append("currentProjects", currentProjects);
      if (avatarFile) formData.append("avatar", avatarFile);
      const result = await api.updateProfile(formData);
      onSaved(result.user);
    } catch (err) {
      setError(err.message || "Couldn't save changes");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="edit-profile-form" onSubmit={handleSubmit}>
      <div className="edit-avatar-row">
        <div className="avatar avatar-lg">
          {avatarPreview ? (
            <img src={avatarPreview} alt="" className="avatar-img" />
          ) : (
            initials(displayName)
          )}
        </div>
        <button type="button" onClick={() => fileInput.current?.click()}>
          Change photo
        </button>
        <input
          ref={fileInput}
          type="file"
          accept="image/jpeg,image/png,image/gif,image/webp"
          onChange={handleAvatarChange}
          hidden
        />
      </div>

      <label className="field-label">Display name</label>
      <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} maxLength={50} />

      <label className="field-label">Bio</label>
      <textarea value={bio} onChange={(e) => setBio(e.target.value)} maxLength={160} rows={3} />
      <div className="char-count">{160 - bio.length}</div>

      <div className="field-row">
        <div>
          <label className="field-label">Location</label>
          <input value={location} onChange={(e) => setLocation(e.target.value)} maxLength={80} />
        </div>
        <div>
          <label className="field-label">Age</label>
          <input
            type="number"
            min={13}
            max={120}
            value={age}
            onChange={(e) => setAge(e.target.value)}
          />
        </div>
      </div>

      <label className="field-label">Work done (one per line)</label>
      <textarea
        value={workDone}
        onChange={(e) => setWorkDone(e.target.value)}
        rows={4}
        placeholder={"Editor — Midnight Run (2024)\nSound design — Harbor Light (2023)"}
      />

      <label className="field-label">Current projects (one per line)</label>
      <textarea
        value={currentProjects}
        onChange={(e) => setCurrentProjects(e.target.value)}
        rows={3}
        placeholder="Colorist — Untitled Feature (in post)"
      />

      {error && <div className="form-error">{error}</div>}

      <div className="edit-actions">
        <button type="button" className="secondary" onClick={onCancel} disabled={saving}>
          Cancel
        </button>
        <button type="submit" className="post-btn" disabled={saving}>
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
    </form>
  );
}

function RecommendationForm({ handle, onSubmitted }) {
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!text.trim()) return;
    setSaving(true);
    setError("");
    try {
      const result = await api.writeRecommendation(handle, text.trim());
      onSubmitted(result.recommendation);
      setText("");
    } catch (err) {
      setError(err.message || "Couldn't save your recommendation");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="recommendation-form" onSubmit={handleSubmit}>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        maxLength={500}
        rows={3}
        placeholder="Write a recommendation…"
      />
      {error && <div className="form-error">{error}</div>}
      <button type="submit" className="post-btn" disabled={saving || !text.trim()}>
        {saving ? "Saving…" : "Submit"}
      </button>
    </form>
  );
}

export default function Profile({ handle, currentUser, onProfileUpdated, onNavigate }) {
  const [profile, setProfile] = useState(null);
  const [posts, setPosts] = useState([]);
  const [photos, setPhotos] = useState([]);
  const [videos, setVideos] = useState([]);
  const [recommendations, setRecommendations] = useState([]);
  const [cursor, setCursor] = useState(null);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(false);
  const [showRecForm, setShowRecForm] = useState(false);

  const isOwnProfile = currentUser?.handle === handle;

  async function load() {
    setLoading(true);
    setError("");
    try {
      const data = await api.getProfile(handle);
      setProfile(data.user);
      setPosts(data.posts);
      setPhotos(data.photos || []);
      setVideos(data.videos || []);
      setRecommendations(data.recommendations || []);
      setCursor(data.nextCursor);
      setHasMore(Boolean(data.nextCursor));
    } catch (err) {
      setError(err.message || "Couldn't load this profile");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    setEditing(false);
    setShowRecForm(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handle]);

  async function loadMore() {
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const data = await api.getProfile(handle, cursor);
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

  function handleSaved(updatedUser) {
    setProfile(updatedUser);
    setEditing(false);
    onProfileUpdated?.(updatedUser);
  }

  function handleDeleted(id) {
    setPosts((prev) => prev.filter((p) => p._id !== id));
  }

  function handleRecommendationSubmitted(rec) {
    setRecommendations((prev) => {
      const withoutMine = prev.filter((r) => r.author?._id !== rec.author?._id);
      return [rec, ...withoutMine];
    });
    setShowRecForm(false);
  }

  if (loading) return <div className="feed-loading">Loading profile…</div>;

  if (error && !profile) {
    return (
      <div className="feed-error">
        {error}
        <div style={{ marginTop: 10 }}>
          <button className="load-more" onClick={load}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!profile) return null;

  const hasAlreadyRecommended = recommendations.some((r) => r.author?._id === currentUser?.id);

  return (
    <div>
      <div className="profile-header">
        <div className="avatar avatar-lg">
          {profile.avatarUrl ? (
            <img src={profile.avatarUrl} alt="" className="avatar-img" />
          ) : (
            initials(profile.displayName)
          )}
        </div>

        {editing ? (
          <EditProfileForm user={profile} onSaved={handleSaved} onCancel={() => setEditing(false)} />
        ) : (
          <>
            <h2 className="profile-name">{profile.displayName}</h2>
            <div className="profile-handle">@{profile.handle}</div>
            {profile.bio && <p className="profile-bio">{profile.bio}</p>}

            <div className="profile-meta-row">
              {profile.location && <span>📍 {profile.location}</span>}
              {profile.age != null && <span>Age {profile.age}</span>}
              {profile.createdAt && <span>Joined {joinedLabel(profile.createdAt)}</span>}
            </div>

            {isOwnProfile ? (
              <button className="edit-profile-btn" onClick={() => setEditing(true)}>
                Edit profile
              </button>
            ) : (
              currentUser &&
              !hasAlreadyRecommended &&
              !showRecForm && (
                <button className="edit-profile-btn" onClick={() => setShowRecForm(true)}>
                  Write a recommendation
                </button>
              )
            )}

            {!isOwnProfile && showRecForm && (
              <RecommendationForm handle={profile.handle} onSubmitted={handleRecommendationSubmitted} />
            )}
          </>
        )}
      </div>

      {(profile.workDone?.length > 0 || profile.currentProjects?.length > 0) && (
        <div className="profile-section">
          {profile.workDone?.length > 0 && (
            <>
              <h3 className="section-title">Work done</h3>
              <ul className="entry-list">
                {profile.workDone.map((entry, i) => (
                  <li key={i}>{entry}</li>
                ))}
              </ul>
            </>
          )}
          {profile.currentProjects?.length > 0 && (
            <>
              <h3 className="section-title">Current projects</h3>
              <ul className="entry-list">
                {profile.currentProjects.map((entry, i) => (
                  <li key={i}>{entry}</li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}

      {photos.length > 0 && (
        <div className="profile-section">
          <h3 className="section-title">Photographs</h3>
          <div className="media-grid">
            {photos.map((p) => (
              <img key={p._id} src={p.imageUrl} alt="" className="media-grid-item" />
            ))}
          </div>
        </div>
      )}

      {videos.length > 0 && (
        <div className="profile-section">
          <h3 className="section-title">Videos</h3>
          <div className="media-grid">
            {videos.map((v) => (
              <video key={v._id} src={v.imageUrl} className="media-grid-item" controls playsInline />
            ))}
          </div>
        </div>
      )}

      <div className="profile-section">
        <h3 className="section-title">Recommendations ({recommendations.length})</h3>
        {recommendations.length === 0 && (
          <p className="feed-empty" style={{ padding: "12px 0" }}>
            No recommendations yet.
          </p>
        )}
        {recommendations.map((rec) => (
          <div className="recommendation-card" key={rec._id}>
            <button
              type="button"
              className="avatar recommendation-avatar"
              onClick={() => onNavigate?.(rec.author?.handle)}
            >
              {rec.author?.avatarUrl ? (
                <img src={rec.author.avatarUrl} alt="" className="avatar-img" />
              ) : (
                initials(rec.author?.displayName)
              )}
            </button>
            <div>
              <button
                type="button"
                className="author-link"
                onClick={() => onNavigate?.(rec.author?.handle)}
              >
                <span className="name">{rec.author?.displayName}</span>
                <span className="handle">@{rec.author?.handle}</span>
              </button>
              <p className="recommendation-text">{rec.text}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="profile-posts-divider">Posts</div>

      {posts.length === 0 && <div className="feed-empty">No posts yet.</div>}

      {posts.map((post) => (
        <PostCard
          key={post._id}
          post={post}
          currentUserId={currentUser?.id}
          onDeleted={handleDeleted}
          onNavigate={onNavigate}
        />
      ))}

      {posts.length > 0 && hasMore && (
        <button className="load-more" onClick={loadMore} disabled={loadingMore}>
          {loadingMore ? "Loading…" : "Show more"}
        </button>
      )}
    </div>
  );
}
