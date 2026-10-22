import { aiHandlers } from "../../../../lib/server/ai/handlers";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function POST(request: Request) { return aiHandlers.speech(request); }
