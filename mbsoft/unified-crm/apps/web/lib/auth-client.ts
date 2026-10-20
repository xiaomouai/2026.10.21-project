import { createAuthClient } from "better-auth/react";

/** 客户端认证助手（登录/注册表单使用） */
// 不固定开发端口：登录页可能通过 localhost、127.0.0.1 或反向代理访问。
export const authClient = createAuthClient({
  baseURL: typeof window === "undefined" ? "http://localhost:81" : window.location.origin,
});
