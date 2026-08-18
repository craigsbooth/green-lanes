import { readFileSync, writeFileSync } from "fs";
const mapping = JSON.parse(readFileSync("src/data/tw2-mapping.json","utf-8"));
const guids = [...new Set(Object.values(mapping).map(m => m.guid).filter(Boolean))];
console.log("Unique GUIDs:", guids.length);

const consoleScript = `(async function() {
  const guids = ${JSON.stringify(guids)};
  console.log("Fetching comments from " + guids.length + " route detail pages...");
  const allComments = {};
  let done = 0;
  let found = 0;
  for (const guid of guids) {
    done++;
    if (done % 10 === 0) console.log("Progress: " + done + "/" + guids.length + " (" + found + " with comments)");
    try {
      const r = await fetch("/route/details/" + guid);
      if (!r.ok) continue;
      const html = await r.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, "text/html");
      const commentEls = doc.querySelectorAll('[itemprop="commentText"]');
      if (commentEls.length > 0) {
        const comments = [];
        commentEls.forEach((el, idx) => {
          const authorEl = doc.querySelectorAll('[itemprop="author"]')[idx];
          const dateEl = doc.querySelectorAll('[itemprop="datePublished"]')[idx];
          comments.push({
            author: authorEl ? authorEl.textContent.trim() : "Unknown",
            date: dateEl ? dateEl.getAttribute("content") || dateEl.textContent.trim() : "",
            text: el.textContent.trim()
          });
        });
        if (comments.length > 0) {
          allComments[guid] = comments;
          found++;
        }
      }
    } catch(e) { console.log("Error on " + guid + ": " + e.message); }
    await new Promise(r => setTimeout(r, 300));
  }
  console.log("Done! Comments found for " + found + " routes.");
  const blob = new Blob([JSON.stringify(allComments, null, 2)], {type: "application/json"});
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "tw2-comments.json";
  a.click();
})();`;

const html = `<!DOCTYPE html>
<html><head><title>TW2 Comment Fetcher</title></head>
<body style="font-family:system-ui;max-width:800px;margin:40px auto;padding:20px">
<h1>Fetch TW2 Comments</h1>
<p>This fetches comments by loading each route detail page and extracting them from the HTML.</p>
<ol>
<li>Go to <a href="https://www.trailwise2.co.uk/route/map" target="_blank">TW2</a> (logged in)</li>
<li>Open DevTools (F12) &gt; Console</li>
<li>Click Copy, paste in console, press Enter</li>
<li>Wait ~1 minute (${guids.length} pages at 300ms each)</li>
<li>Move <code>tw2-comments.json</code> to the project folder</li>
</ol>
<textarea id="s" rows="20" style="width:100%;font-family:monospace;font-size:11px;padding:10px" readonly>${consoleScript.replace(/</g,"&lt;").replace(/>/g,"&gt;")}</textarea>
<br><button onclick="navigator.clipboard.writeText(document.getElementById('s').value);this.textContent='Copied!'" style="margin-top:10px;padding:8px 16px;background:#2d6a4f;color:white;border:none;border-radius:6px;cursor:pointer">Copy to Clipboard</button>
</body></html>`;

writeFileSync("scripts/fetch-tw2-comments.html", html);
console.log("Written scripts/fetch-tw2-comments.html");
