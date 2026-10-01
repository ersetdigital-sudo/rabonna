import { NextResponse } from "next/server";
import { getAdminDb } from "@/lib/admin-auth";

export async function GET(req: Request) {
  // Log notifikasi memuat nomor HP customer — tidak boleh terbuka.
  const supabase = await getAdminDb();
  if (!supabase) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const limit = Math.min(Number(url.searchParams.get("limit") || "50"), 100);

  const { data, error } = await supabase
    .from("notification_logs")
    .select("id, order_number, phone, status, error, diff_days, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ logs: data || [] });
}
