import { NextResponse } from "next/server";
import { getAdminDb } from "@/lib/admin-auth";

/** Kunci app_settings untuk kapasitas produksi per bulan. */
const CAPACITY_KEY = "kapasitas_produksi_bulanan";
const DEFAULT_CAPACITY = 2500;

/** GET — kapasitas produksi per bulan (default 2.500 pcs). */
export async function GET() {
  const supabase = await getAdminDb();
  if (!supabase) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", CAPACITY_KEY)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const parsed = parseInt(data?.value ?? "", 10);

  return NextResponse.json({
    capacity: isNaN(parsed) || parsed < 1 ? DEFAULT_CAPACITY : parsed,
  });
}

/** POST — simpan kapasitas produksi per bulan. */
export async function POST(req: Request) {
  const supabase = await getAdminDb();
  if (!supabase) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const capacity = parseInt(body?.capacity, 10);

  if (isNaN(capacity) || capacity < 1) {
    return NextResponse.json(
      { error: "Kapasitas harus berupa angka lebih dari 0" },
      { status: 400 }
    );
  }

  const { error } = await supabase
    .from("app_settings")
    .upsert({ key: CAPACITY_KEY, value: String(capacity) }, { onConflict: "key" });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, capacity });
}
