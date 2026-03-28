export async function GET(_req: Request, { libraryId }: { libraryId: string }) {
  const id = String(libraryId || "").trim().toLowerCase();

  // Stage 3: safe test response only.
  // No storage system yet, no app hydration yet.
  if (id === "test-library") {
    return Response.json({
      libraryId: "test-library",
      branding: {
        libraryName: "Test Library",
      },
    });
  }

  return Response.json(
    {
      error: "Library config not found",
      libraryId: id,
    },
    { status: 404 }
  );
}