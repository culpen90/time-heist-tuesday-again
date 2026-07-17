import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";

test("builds a self-contained itch.io HTML package", async () => {
  const output = new URL("../dist-itch/", import.meta.url);
  const html = await readFile(new URL("index.html", output), "utf8");

  assert.match(html, /<title>Time Heist: Tuesday Again<\/title>/);
  assert.match(html, /(?:src|href)="\.\/assets\//);
  assert.doesNotMatch(html, /(?:src|href)="\/(?!\/)/);
  const assets = await readdir(new URL("assets/", output));
  assert.ok(assets.some((name) => name.endsWith(".js")), "JavaScript bundle is missing");
  assert.ok(assets.some((name) => name.endsWith(".css")), "CSS bundle is missing");
  assert.ok(assets.some((name) => name.endsWith(".svg")), "Favicon is missing");
});
