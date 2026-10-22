import { aiHandlers } from "../../../../lib/server/ai/handlers";
export const runtime = "nodejs";
export async function POST(request: Request) { return aiHandlers.test(request); }
