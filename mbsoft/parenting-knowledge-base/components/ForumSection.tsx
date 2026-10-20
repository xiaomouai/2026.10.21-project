"use client";

import { useState, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Post } from "@/lib/types";

export default function ForumSection({
  posts: initialPosts,
  topicId,
  currentUser,
}: {
  posts: Post[];
  topicId?: string;
  currentUser: any;
}) {
  const [posts, setPosts] = useState<Post[]>(initialPosts);
  const [content, setContent] = useState("");
  const [title, setTitle] = useState("");
  const [replyTo, setReplyTo] = useState<Post | null>(null); // 当前正在回复的帖子
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [likedIds, setLikedIds] = useState<Set<string>>(
    () => new Set(initialPosts.filter((p) => currentUser && p.likedBy.includes(currentUser.id)).map((p) => p.id))
  );
  const composerRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // ---------- 帖子树构建 ----------
  // 所有回复都归挂到根帖下（回复的回复也归到根），展示一层嵌套
  const { roots, repliesByRoot } = useMemo(() => {
    const byId = new Map(posts.map((p) => [p.id, p]));
    const sorted = [...posts].sort((a, b) => a.createdAt.localeCompare(b.createdAt));

    const rootOf = (p: Post): Post => {
      let cur = p;
      while (cur.replyTo) {
        const parent = byId.get(cur.replyTo);
        if (!parent) break;
        cur = parent;
      }
      return cur;
    };

    const rootList = sorted.filter((p) => !p.replyTo);
    const replyMap = new Map<string, Post[]>();
    for (const p of sorted) {
      if (!p.replyTo) continue;
      const root = rootOf(p);
      if (!replyMap.has(root.id)) replyMap.set(root.id, []);
      replyMap.get(root.id)!.push(p);
    }
    return { roots: rootList, repliesByRoot: replyMap };
  }, [posts]);

  // ---------- 交互 ----------
  function startReply(post: Post) {
    if (!currentUser) {
      setError("请先登录后再回复");
      return;
    }
    setError("");
    setReplyTo(post);
    // 滚动到发帖框并聚焦
    requestAnimationFrame(() => {
      composerRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      composerRef.current?.querySelector("textarea")?.focus();
    });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!currentUser) {
      setError("请先登录后再发帖");
      return;
    }
    if (!content.trim()) return;

    setSubmitting(true);
    setError("");
    const res = await fetch("/api/posts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content, title: replyTo ? "" : title, topicId, replyTo: replyTo?.id }),
    });
    const data = await res.json();
    setSubmitting(false);

    if (res.ok) {
      setPosts((prev) => [...prev, data.post]);
      setContent("");
      setTitle("");
      setReplyTo(null);
      router.refresh();
    } else {
      setError(data.error || "发帖失败");
    }
  }

  async function like(postId: string) {
    if (!currentUser) { setError("请先登录"); return; }
    if (likedIds.has(postId)) return; // 已点过赞
    const res = await fetch(`/api/posts/${postId}/like`, { method: "POST" });
    if (res.ok) {
      setLikedIds((prev) => new Set(prev).add(postId));
      setPosts((prev) =>
        prev.map((p) => (p.id === postId ? { ...p, likes: p.likes + 1 } : p))
      );
    }
  }

  function timeAgo(iso: string) {
    const diff = Date.now() - new Date(iso).getTime();
    const h = Math.floor(diff / 3600000);
    if (h < 1) return "刚刚";
    if (h < 24) return `${h}小时前`;
    const d = Math.floor(h / 24);
    return `${d}天前`;
  }

  // ---------- 单条帖子操作行 ----------
  function postActions(post: Post) {
    return (
      <div className="post-actions">
        <button
          className={`like-btn ${likedIds.has(post.id) ? "liked" : ""}`}
          onClick={() => like(post.id)}
        >
          👍 {post.likes}
        </button>
        <button className="like-btn reply-btn" onClick={() => startReply(post)}>
          💬 回复
        </button>
      </div>
    );
  }

  // ---------- 发帖框 ----------
  const composer = (
    <div className="card" ref={composerRef}>
      {currentUser ? (
        <form onSubmit={submit}>
          {/* 回复目标提示条 */}
          {replyTo && (
            <div className="reply-target">
              <span>
                回复 <strong>@{replyTo.nickname}</strong>
                ：{replyTo.content.slice(0, 24)}
                {replyTo.content.length > 24 ? "…" : ""}
              </span>
              <button type="button" onClick={() => setReplyTo(null)} aria-label="取消回复">
                ✕
              </button>
            </div>
          )}
          {!replyTo && (
            <div className="form-group">
              <input
                className="search"
                placeholder="标题（选填，留空为回复）"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                style={{ marginBottom: 8 }}
              />
            </div>
          )}
          <div className="form-group">
            <textarea
              className="post-textarea"
              placeholder={replyTo ? `回复 @${replyTo.nickname}...` : "分享你的经验、提问或补充..."}
              value={content}
              onChange={(e) => setContent(e.target.value)}
            />
          </div>
          {error && <div className="alert alert-error">{error}</div>}
          <div className="row between">
            <button type="submit" className="btn btn-primary btn-sm" disabled={submitting}>
              {submitting ? "发布中..." : replyTo ? "↩️ 发表回复" : "💬 发布"}
            </button>
            <span className="hint">+5积分</span>
          </div>
        </form>
      ) : (
        <div className="alert alert-info">🔒 登录后即可发帖互动</div>
      )}
    </div>
  );

  return (
    <div>
      {composer}

      {/* 帖子列表（根帖 + 嵌套回复） */}
      <div style={{ marginTop: 14 }}>
        {roots.length === 0 ? (
          <div className="card center muted">还没有讨论，来抢沙发～</div>
        ) : (
          roots.map((post) => {
            const replies = repliesByRoot.get(post.id) ?? [];
            return (
              <div key={post.id} className="post">
                <div className="post-head">
                  <div className="avatar" style={{ width: 36, height: 36, fontSize: 13 }}>
                    {post.nickname.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="post-nick">{post.nickname}</div>
                    <div className="post-time">{timeAgo(post.createdAt)}</div>
                  </div>
                </div>
                {post.title && <div className="post-title">{post.title}</div>}
                <div className="post-content">{post.content}</div>
                {postActions(post)}

                {/* 嵌套回复 */}
                {replies.length > 0 && (
                  <div className="reply-list">
                    {replies.map((r) => (
                      <div key={r.id} className="reply-item">
                        <div className="reply-head">
                          <span className="post-nick" style={{ fontSize: 13 }}>{r.nickname}</span>
                          {r.replyToNickname && r.replyTo !== post.id && (
                            <span className="reply-mentions">回复 @{r.replyToNickname}</span>
                          )}
                          <span className="post-time">{timeAgo(r.createdAt)}</span>
                        </div>
                        <div className="post-content" style={{ fontSize: 13 }}>{r.content}</div>
                        {postActions(r)}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
