import { aiHandlers } from "../../../../lib/server/ai/handlers";
export const runtime = "nodejs";
export async function POST(request: Request) { return aiHandlers.login(request); }
export async function DELETE(request: Request) { return aiHandlers.logout(request); }
