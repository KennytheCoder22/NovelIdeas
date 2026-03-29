export async function GET(_req: Request, { libraryId }: { libraryId: string }) {
  const id = String(libraryId || "").trim().toLowerCase();

  // Stage 6C: expanded test response (adds theme + enabledDecks)
  if (id === "test-library") {
    return Response.json({
      libraryId: "test-library",
      branding: {
        libraryName: "Test Library",
        mainTheme: "forest_green",
        highlight: "gold_accent",
        titleTextColor: "white",
      },
      enabledDecks: {
        k2: false,
        "36": true,
        ms_hs: true,
        adult: false,
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
