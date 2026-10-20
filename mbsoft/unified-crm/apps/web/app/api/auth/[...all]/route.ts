import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "../../../../lib/auth";

/** better-auth 标准端点挂载：/api/auth/* */
export const { GET, POST } = toNextJsHandler(auth);
