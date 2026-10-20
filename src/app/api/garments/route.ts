import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { v4 as uuidv4 } from "uuid";


export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category");
    const subcategory = searchParams.get("subcategory");
    const occasion = searchParams.get("occasion");
    const search = searchParams.get("search");
    const color = searchParams.get("color");
    const gender = searchParams.get("gender");
    const vtoOnly = searchParams.get("vtoOnly");
    const sort = searchParams.get("sort");

    const db = getDb();
    let query = "SELECT * FROM garments WHERE 1=1";
    const params: unknown[] = [];

    if (category && category !== "all") {
      query += " AND category = ?";
      params.push(category);
    }

    if (subcategory && subcategory !== "all") {
      query += " AND subcategory = ?";
      params.push(subcategory);
    }

    if (occasion && occasion !== "all") {
      query += " AND (occasion_tag LIKE ? OR occasion_tag = 'All' OR occasion_tag IS NULL)";
      params.push(`%${occasion}%`);
    }

    if (gender && gender !== "all") {
      query += " AND (gender_target = ? OR gender_target = 'unisex')";
      params.push(gender);
    }

    if (color && color !== "all") {
      query += " AND color LIKE ?";
      params.push(`%${color}%`);
    }

    if (vtoOnly === "true") {
      query += " AND (is_vto_compatible = 1 OR is_vto_compatible IS NULL)";
    }

    if (search && search.trim() !== "") {
      const s = search.trim();
      query += " AND (name LIKE ? OR description LIKE ? OR occasion_tag LIKE ? OR subcategory LIKE ?)";
      params.push(`%${s}%`, `%${s}%`, `%${s}%`, `%${s}%`);
    }

    if (sort === "price_asc") {
      query += " ORDER BY price ASC, name ASC";
    } else if (sort === "price_desc") {
      query += " ORDER BY price DESC, name ASC";
    } else {
      query += " ORDER BY category ASC, name ASC";
    }

    const garments = db.prepare(query).all(...params);
    return NextResponse.json({ garments });
  } catch (error: unknown) {
    console.error("[GET /api/garments] Error:", error);
    return NextResponse.json({ error: "Failed to load garments." }, { status: 500 });
  }
}


export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, category, imageUrl, color, description, price, currency = "INR", genderTarget = "unisex" } = body;

    if (!name || !category || !imageUrl) {
      return NextResponse.json({ error: "Name, category, and garment image are required." }, { status: 400 });
    }

    const id = `garm_user_${uuidv4().substring(0, 8)}`;
    const db = getDb();

    db.prepare(`
      INSERT INTO garments (id, name, category, image_url, color, description, price, currency, gender_target, style_tag, occasion_tag, is_demo)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Custom User Garment', 'User Upload', 0)
    `).run(
      id,
      name,
      category,
      imageUrl,
      color || "Multi / Custom",
      description || "User uploaded custom garment",
      price ? Number(price) : null,
      currency,
      genderTarget
    );

    const newGarment = db.prepare("SELECT * FROM garments WHERE id = ?").get(id);
    return NextResponse.json({ success: true, garment: newGarment });
  } catch (error: unknown) {
    console.error("[POST /api/garments] Error:", error);
    return NextResponse.json({ error: "Failed to save garment." }, { status: 500 });
  }
}
