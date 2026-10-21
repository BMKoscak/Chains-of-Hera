// Generates ElevenLabs voice-over for every narrator and NPC line in index_7_1.html.
// Run: npm run voices            (skips lines whose text hasn't changed)
//      npm run voices -- --force (regenerates everything)
// Output: voices/<level>/intro_<i>.mp3, outro.mp3, <npcId>_<lines|again>_<i>.mp3, voices/ending_<i>.mp3
import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { createHash } from "crypto";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const HTML = join(ROOT, "index_7_1.html");
const OUT = join(ROOT, "voices");
const MANIFEST = join(OUT, "manifest.json");
const MODEL = "eleven_v4";
const FORCE = process.argv.includes("--force");

const NARRATOR = "JBFqnCBsd6RMkjVDRZzb"; // George - warm storyteller
const CAST = {
  iolaus: "TX3LPaxmHKxFdv7VOQHJ", // Liam - energetic young
  iolaus3: "TX3LPaxmHKxFdv7VOQHJ",
  melia: "EXAVITQu4vr4xnSDxMaL", // Sarah
  nikos: "cgSgspJ2msm6clMCkdW9", // Jessica - playful, bright
  dimos: "iP95p4xoKVk53GoZ742B", // Chris - down-to-earth
  tiresias: "pqHfZKP75CvOlQylNhV4", // Bill - wise, old
  ianthe: "Xb7hH8MSUJpSbSDYk0k2", // Alice
  molorchus: "PabL40IP77ALStcdM4Xw", // Old british
  kleon: "IKne3meq5aSn9XLyUdCD", // Charlie
  lykos: "CwhRBWXzGAHq8TQ4Fs17", // Roger
  ariadne: "pFZP5JQG7iQjIQuC4Bku", // Lily
  charon: "nPczCjzI2devNBz1zQrb", // Brian - deep
  persephone: "hpp4J3VqNfWAUOO0d1Us", // Bella
  hermes: "N2lVS1w4EtoT3dr4eOWO", // Callum - trickster
};

// Return the source of the balanced {...} or [...] starting at src[i], skipping string contents.
function balanced(src, i) {
  const open = src[i], close = open === "{" ? "}" : "]";
  let depth = 0, q = null;
  for (let j = i; j < src.length; j++) {
    const c = src[j];
    if (q) { if (c === "\\") j++; else if (c === q) q = null; continue; }
    if (c === "'" || c === '"' || c === "`") q = c;
    else if (c === open) depth++;
    else if (c === close && --depth === 0) return src.slice(i, j + 1);
  }
  throw new Error("unbalanced literal at " + i);
}

// Evaluate a story literal; LOOK.* references resolve to empty objects.
const evalLit = s => new Function("LOOK", "return (" + s + ")")(new Proxy({}, { get: () => ({}) }));

function collectLines(html) {
  const lines = [];
  const re = /story:\{/g;
  let m;
  while ((m = re.exec(html))) {
    const before = html.slice(0, m.index);
    const lvl = [...before.matchAll(/^\s*(\w+):\{name:/gm)].pop()[1];
    const story = evalLit(balanced(html, m.index + 6));
    story.intro.forEach((text, i) => lines.push({ file: `${lvl}/intro_${i}.mp3`, voice: NARRATOR, text }));
    if (story.outro) lines.push({ file: `${lvl}/outro.mp3`, voice: NARRATOR, text: story.outro });
    for (const n of story.npcs || []) {
      const voice = CAST[n.id];
      if (!voice) throw new Error(`No voice cast for NPC "${n.id}"; add it to CAST`);
      for (const set of ["lines", "again"])
        (n[set] || []).forEach((text, i) => lines.push({ file: `${lvl}/${n.id}_${set}_${i}.mp3`, voice, text }));
    }
  }
  const e = html.indexOf("ENDING:[");
  evalLit(balanced(html, e + 7)).forEach((text, i) => lines.push({ file: `ending_${i}.mp3`, voice: NARRATOR, text }));
  return lines;
}

const hash = l => createHash("sha1").update(`${MODEL}|${l.voice}|${l.text}`).digest("hex").slice(0, 12);

const lines = collectLines(readFileSync(HTML, "utf8"));
const manifest = existsSync(MANIFEST) ? JSON.parse(readFileSync(MANIFEST, "utf8")) : {};
const todo = lines.filter(l => FORCE || manifest[l.file]?.hash !== hash(l) || !existsSync(join(OUT, l.file)));
console.log(`${lines.length} lines total, ${todo.length} to generate (${todo.reduce((s, l) => s + l.text.length, 0)} characters)`);
if (process.argv.includes("--dry")) { for (const l of todo) console.log(l.file); process.exit(0); }

const client = new ElevenLabsClient();
for (const [k, l] of todo.entries()) {
  const path = join(OUT, l.file);
  mkdirSync(dirname(path), { recursive: true });
  const stream = await client.textToSpeech.convert(l.voice, {
    text: l.text,
    modelId: MODEL,
    outputFormat: "mp3_44100_128",
    voiceSettings: { stability: 0.5, similarityBoost: 0.75 },
  });
  writeFileSync(path, Buffer.from(await new Response(stream).arrayBuffer()));
  manifest[l.file] = { hash: hash(l), text: l.text };
  writeFileSync(MANIFEST, JSON.stringify(manifest, null, 1));
  console.log(`[${k + 1}/${todo.length}] ${l.file}`);
}
console.log("Done.");
