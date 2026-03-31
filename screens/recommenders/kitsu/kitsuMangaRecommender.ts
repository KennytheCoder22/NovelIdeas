// TasteDNA-patched Kitsu
import { buildIntentProfile } from "../intent/buildIntentProfile";
import { buildQueryBrief } from "../intent/buildQueryBrief";
// ...keep rest of original file, but replace buildKitsuQueries:

function buildKitsuQueries(input){
  const intent = buildIntentProfile(input);
  const brief = buildQueryBrief(intent);
  const anchors = [...(brief.thematicAnchors||[]), ...(brief.genreAnchors||[]), brief.toneAnchor||""].filter(Boolean);
  const q = new Set(["manga"]);
  anchors.forEach(a=>{
    const v=a.toLowerCase();
    if(v.includes("psychological")||v.includes("mystery")) q.add("psychological");
    if(v.includes("speculative")||v.includes("science")) q.add("science fiction");
    if(v.includes("adventure")||v.includes("survival")) q.add("adventure");
    if(v.includes("dark")) q.add("horror");
  });
  return Array.from(q).slice(0,6);
}
