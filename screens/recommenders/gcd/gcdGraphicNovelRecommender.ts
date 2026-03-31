// TasteDNA-patched GCD
import { buildIntentProfile } from "../intent/buildIntentProfile";
import { buildQueryBrief } from "../intent/buildQueryBrief";
// ...keep rest of original file, but replace buildGcdSearchTerms:

function buildGcdSearchTerms(input){
  const intent = buildIntentProfile(input);
  const brief = buildQueryBrief(intent);
  const anchors = [...(brief.thematicAnchors||[]), ...(brief.genreAnchors||[]), brief.toneAnchor||""].filter(Boolean);
  const out=new Set(["graphic novel","comic"]);
  anchors.forEach(a=>{
    const v=a.toLowerCase();
    if(v.includes("psychological")||v.includes("mystery")) out.add("mystery");
    if(v.includes("speculative")||v.includes("science")) out.add("science fiction");
    if(v.includes("superhero")) out.add("superhero");
    if(v.includes("adventure")||v.includes("survival")) out.add("adventure");
    if(v.includes("dark")) out.add("horror");
  });
  return Array.from(out);
}
