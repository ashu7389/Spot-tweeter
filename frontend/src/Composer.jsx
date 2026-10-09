import { useRef, useState } from "react";
import { api } from "./api";

const MAX_CHARS = 280;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_VIDEO_BYTES = 50 * 1024 * 1024;
const ACCEPTED_TYPES =
  "image/jpeg,image/png,image/gif,image/webp,video/mp4,video/quicktime,video/webm";

function initials(name) {
  return (name || "?")
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export default function Composer({ user, onPosted }) {
  const [text, setText] = useState("");
  const [media, setMedia] = useState(null); // File
  const [mediaKind, setMediaKind] = useState(null); // "image" | "video"
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState("");
  const [posting, setPosting] = useState(false);
  const fileInput = useRef(null);

  const remaining = MAX_CHARS - text.length;
  const canPost = (text.trim().length > 0 || media) && remaining >= 0 && !posting;

  function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    const isImage = file.type.startsWith("image/");
    const isVideo = file.type.startsWith("video/");

    if (!isImage && !isVideo) {
      setError("Please choose an image or video file");
      return;
    }
    if (isImage && file.size > MAX_IMAGE_BYTES) {
      setError("Images must be under 5MB");
      return;
    }
    if (isVideo && file.size > MAX_VIDEO_BYTES) {
      setError("Videos must be under 50MB");
      return;
    }

    setError("");
    setMedia(file);
    setMediaKind(isVideo ? "video" : "image");
    setPreview(URL.createObjectURL(file));
  }

  function clearMedia() {
    setMedia(null);
    setMediaKind(null);
    setPreview(null);
    if (fileInput.current) fileInput.current.value = "";
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!canPost) return;
    setPosting(true);
    setError("");
    try {
      const formData = new FormData();
      formData.append("text", text.trim());
      // Field name stays "image" — that's what the backend's
      // upload.single("image") expects, regardless of whether the
      // file is actually an image or a video.
      if (media) formData.append("image", media);
      const newPost = await api.createPost(formData);
      onPosted(newPost);
      setText("");
      clearMedia();
    } catch (err) {
      setError(err.message || "Couldn't post — try again");
    } finally {
      setPosting(false);
    }
  }

  return (
    <form className="composer" onSubmit={handleSubmit}>
      <div className="avatar">{initials(user?.displayName)}</div>
      <div className="composer-body">
        <textarea
          placeholder="What's happening?"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={3}
        />
        {preview && (
          <div className="composer-preview">
            {mediaKind === "video" ? (
              <video src={preview} controls />
            ) : (
              <img src={preview} alt="Selected upload preview" />
            )}
            <button type="button" onClick={clearMedia} aria-label="Remove media">
              ×
            </button>
          </div>
        )}
        {error && <div className="form-error">{error}</div>}
        <div className="composer-footer">
          <div className="composer-actions">
            <label htmlFor="image-input" title="Add image or video">
              🖼
            </label>
            <input
              id="image-input"
              ref={fileInput}
              type="file"
              accept={ACCEPTED_TYPES}
              onChange={handleFile}
              hidden
            />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span className={`char-count ${remaining < 0 ? "over" : ""}`}>{remaining}</span>
            <button type="submit" className="post-btn" disabled={!canPost}>
              {posting ? "Posting…" : "Post"}
            </button>
          </div>
        </div>
      </div>
    </form>
  );
}
