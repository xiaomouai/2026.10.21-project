import { Package } from "./types";

// 会员套餐静态数据（独立模块：客户端组件可直接引用，不拖入服务端存储层）
export const PACKAGES: Package[] = [
  {
    id: "pkg-free",
    name: "免费体验",
    description: "登录即可用：教程标题与摘要可看，正文需激活会员",
    price: 0,
    features: [
      "全部教程标题 + 摘要试读",
      "每日打卡赚积分",
      "论坛发帖互动",
      "AI 育儿助手免费体验 1 次",
    ],
  },
  {
    id: "pkg-month",
    name: "月度会员",
    description: "激活后 30 天内可读全部「普内容」全文（付费教程仍需年卡）",
    price: 29.9,
    features: [
      "普内容全文畅读（30天）",
      "每日打卡赚积分",
      "论坛无限制互动",
      "AI 育儿助手免费体验 1 次",
    ],
    isPopular: true,
  },
  {
    id: "pkg-year",
    name: "年度会员",
    description: "激活后 365 天全站畅读，含全部付费 / 年专属教程",
    price: 199,
    features: [
      "全站内容畅读（含付费教程）",
      "普内容 + 付费内容全解锁",
      "论坛无限制互动",
      "AI 育儿助手不限次问答",
    ],
  },
];

export function getPackageById(id: string): Package | undefined {
  return PACKAGES.find((p) => p.id === id);
}
