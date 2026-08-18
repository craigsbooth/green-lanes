import { readFileSync, writeFileSync } from "fs";
const mapping = JSON.parse(readFileSync("src/data/tw2-mapping.json","utf-8"));
const guids = [...new Set(Object.values(mapping).map(m => m.guid).filter(Boolean))];
console.log("Unique GUIDs:", guids.length);

const consoleScript = `(async function() {
  const guids = ${JSON.stringify(guids)};
  console.log("Fetching comments for " + guids.length + " routes...");
  const allComments = {};
  let done = 0;
  for (const guid of guids) {
    done++;
    if (done % 20 === 0) console.log("Progress: " + done + "/" + guids.length);
    try {
      const r = await fetch("/api/talk/Comments?projectid=421f568f-c985-4e83-98c2-4dcdcd0dd7dc" + String.fromCharCode(38) + "threadid=route-" + guid + String.fromCharCode(38) + "page=1" + String.fromCharCode(38) + "pagesize=50");
      if (!r.ok) continue;
      const data = await r.json();
      if (data && data.length > 0) {
        allComments[guid] = data.map(c => ({
          author: c.AuthorName || c.authorName || "Unknown",
          date: c.CreatedDate || c.createdDate || "",
          text: c.Body || c.body || c.Text || c.text || ""
        }));
      }
    } catch(e) {}
    await new Promise(r => setTimeout(r, 150));
  }
  const count = Object.keys(allComments).length;
  console.log("Done! Comments found for " + count + " routes.");
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
<ol>
<li>Go to <a href="https://www.trailwise2.co.uk/route/map" target="_blank">TW2 map</a> (logged in)</li>
<li>Open DevTools (F12) &gt; Console</li>
<li>Click "Copy" below, paste in console, press Enter</li>
<li>Wait ~40 seconds</li>
<li>Move <code>tw2-comments.json</code> to the project folder</li>
</ol>
<textarea id="s" rows="20" style="width:100%;font-family:monospace;font-size:11px;padding:10px" readonly>${consoleScript.replace(/</g,"&lt;").replace(/>/g,"&gt;")}</textarea>
<br><button onclick="navigator.clipboard.writeText(document.getElementById('s').value);this.textContent='Copied!'" style="margin-top:10px;padding:8px 16px;background:#2d6a4f;color:white;border:none;border-radius:6px;cursor:pointer">Copy to Clipboard</button>
</body></html>`;

writeFileSync("scripts/fetch-tw2-comments.html", html);
console.log("Written scripts/fetch-tw2-comments.html");
