import { NextResponse } from "next/server";
import { handle, requireUser } from "@/lib/auth";

export const GET = handle(async () => {
  const user = await requireUser();
  return NextResponse.json({ user });
});
