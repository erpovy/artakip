import fs from "fs";
import path from "path";

const TARGET_LINUX_DIR = "/home/artovyco/artakip.artovy.com";

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath);
    } else if (fullPath.endsWith(".js") || fullPath.endsWith(".json")) {
      let content = fs.readFileSync(fullPath, "utf8");
      let changed = false;

      if (/ArtovyAPPS/i.test(content)) {
        // 1) Double-escaped Windows paths in JSON / JS strings: D:\\ArtovyAPPS\\Artakip\\...
        content = content.replace(
          /[Dd]:\\\\ArtovyAPPS\\\\Artakip([\\A-Za-z0-9_.\-[\]/#?=&%]*)/g,
          (_match, subPath) => TARGET_LINUX_DIR + subPath.replace(/\\\\/g, "/")
        );
        // 2) Single-backslash Windows paths in String.raw`D:\ArtovyAPPS\Artakip\...`
        content = content.replace(
          /[Dd]:\\ArtovyAPPS\\Artakip([\\A-Za-z0-9_.\-[\]/#?=&%]*)/g,
          (_match, subPath) => TARGET_LINUX_DIR + subPath.replace(/\\/g, "/")
        );
        // 3) Forward-slash Windows paths: D:/ArtovyAPPS/Artakip/...
        content = content.replace(
          /[Dd]:\/ArtovyAPPS\/Artakip/g,
          TARGET_LINUX_DIR
        );
        changed = true;
      }

      if (fullPath.endsWith("required-server-files.json") && content.includes(".next\\\\")) {
        content = content.replace(/\\\\/g, "/");
        changed = true;
      }

      if (changed) {
        fs.writeFileSync(fullPath, content, "utf8");
      }
    }
  }
}

walk(".next");
console.log("Normalized .next paths for Linux cPanel:", TARGET_LINUX_DIR);
