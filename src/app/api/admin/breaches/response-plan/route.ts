import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { NextResponse } from "next/server";

import { apiError, requireRoles } from "@/server/security";

import type { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    await requireRoles(request, ["superadmin"]);
    const content = await readFile(join(process.cwd(), "docs", "BREACH-RESPONSE-PLAN.md"), "utf8");
    return new NextResponse(content, {
      headers: { "Content-Type": "text/markdown; charset=utf-8", "Cache-Control": "no-store" },
    });
  } catch (error) {
    return apiError(error);
  }
}
