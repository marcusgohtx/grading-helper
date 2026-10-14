import { parseRubric } from "@/lib/rubric";
import { createWorkbook } from "@/lib/workbook";

export async function POST(request: Request) {
  try {
    const raw = await request.text();
    if (raw.length > 60000) return Response.json({ error: "The rubric is too long. Use at most 30,000 characters." }, { status: 413 });
    let body: unknown;
    try { body = JSON.parse(raw); } catch { return Response.json({ error: "Send a valid rubric." }, { status: 400 }); }
    if (!body || typeof body !== "object" || !("rubric" in body) || typeof body.rubric !== "string") {
      return Response.json({ error: "Enter your grading criteria in the text box." }, { status: 400 });
    }
    let rubric;
    try { rubric = parseRubric(body.rubric); } catch (error) {
      return Response.json({ error: error instanceof Error ? error.message : "Check your rubric format." }, { status: 400 });
    }
    const bytes = await createWorkbook(rubric);
    return new Response(new Uint8Array(bytes), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": 'attachment; filename="grading-workbook.xlsx"',
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return Response.json({ error: "The workbook could not be generated. Please try again." }, { status: 500 });
  }
}
