import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ThemeProvider } from "../components/theme/theme-provider";

export const metadata: Metadata = {
  title: {
    default: "UniCRM · 中小企业一体化 CRM",
    template: "%s · UniCRM",
  },
  description:
    "面向中小企业的 SaaS CRM：客户 / 线索 / 商机 / 跟进 + AI Agent 编码任务日志。整合两套开源源码的统一骨架。",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

// 在 hydration 前同步应用已保存的主题，避免首屏闪烁
const themeInitScript = `(function(){try{var t=localStorage.getItem('ucrm-theme');if(t!=='light'&&t!=='parchment'&&t!=='dark'){t='light';}var m=document.documentElement;m.setAttribute('data-theme',t);m.style.colorScheme=t==='dark'?'dark':'light';}catch(e){}})();`;

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
