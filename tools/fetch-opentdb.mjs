// Downloads all verified Open Trivia DB questions (CC BY-SA 4.0) into
// app/data-seed/opentdb.json. Usage: node tools/fetch-opentdb.mjs
// The API allows one request per 5 seconds, so this takes ~10 minutes.
import fs from 'node:fs';

const OUT = new URL('../app/data-seed/opentdb.json', import.meta.url);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const dec = (s) => decodeURIComponent(s);

async function get(url, tries = 6) {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(20000) });
      if (res.status === 429) { await sleep(10000); continue; }
      return await res.json();
    } catch {
      await sleep(6000);
    }
  }
  throw new Error(`failed: ${url}`);
}

const { trivia_categories: cats } = await get('https://opentdb.com/api_category.php');
const { token } = await get('https://opentdb.com/api_token.php?command=request');
const all = [];
for (const c of cats) {
  let got = 0;
  for (;;) {
    await sleep(5500);
    const res = await get(`https://opentdb.com/api.php?amount=50&category=${c.id}&encode=url3986&token=${token}`);
    if (res.response_code === 5) { await sleep(6000); continue; } // rate limited
    if (res.response_code !== 0 || !res.results.length) {
      // code 4 = token exhausted for this category; try smaller batches until empty
      if (res.response_code === 4 || res.response_code === 1) {
        const small = await get(`https://opentdb.com/api.php?amount=10&category=${c.id}&encode=url3986&token=${token}`);
        if (small.response_code === 0 && small.results.length) { res.results = small.results; } else break;
      } else break;
    }
    for (const q of res.results) {
      all.push({
        cat: c.id,
        type: q.type,
        difficulty: q.difficulty,
        q: dec(q.question),
        correct: dec(q.correct_answer),
        wrong: q.incorrect_answers.map(dec),
      });
      got++;
    }
  }
  console.log(`${c.name}: ${got}`);
}
fs.writeFileSync(OUT, JSON.stringify(all));
console.log(`total ${all.length}`);
