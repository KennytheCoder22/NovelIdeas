// PATCHED openLibraryFromTags.ts

// Only the final return logic inside buildSwipeTermsQueryFromTagCounts is modified.

// --- REPLACE the final return section with this ---

if (!positiveList.length) {
  return "";
}

const subjectTerms = [];
const looseTerms = [];

for (const term of positiveList) {
  const t = String(term).trim();

  if (/^subject:/i.test(t)) {
    subjectTerms.push(t.replace(/^subject:/i, "").replace(/^"+|"+$/g, ""));
  } else {
    looseTerms.push(t.replace(/^"+|"+$/g, ""));
  }
}

if (!subjectTerms.length) {
  subjectTerms.push("fiction");
}

const primary = subjectTerms[0];

const expansionPool = Array.from(new Set([
  ...subjectTerms.slice(1),
  ...looseTerms,
]));

const expansion = expansionPool.slice(0, 3);

let query = `subject:${primary}`;

if (expansion.length > 0) {
  const orBlock = expansion
    .map((t) => {
      if (/^(horror|thriller|fantasy|mystery|romance|dystopian|science fiction)$/i.test(t)) {
        return `subject:${t}`;
      }
      return t;
    })
    .join(" OR ");

  query += ` (${orBlock})`;
}

return query.trim();
