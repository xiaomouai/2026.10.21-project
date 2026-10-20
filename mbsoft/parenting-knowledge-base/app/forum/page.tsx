import ForumSection from "@/components/ForumSection";
import { db } from "@/lib/store";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default function ForumPage() {
  const user = getCurrentUser();
  const posts = db.getAllPosts();

  return (
    <>
      <h1 style={{ fontSize: 24, marginTop: 18 }}>💬 妈妈论坛</h1>
      <p className="muted">
        真实案例分享、互相支招、经验交流。发帖 +5 积分，优质内容会被收录进教程。
      </p>
      <div style={{ marginTop: 14 }}>
        <ForumSection posts={posts} currentUser={user} />
      </div>
    </>
  );
}
