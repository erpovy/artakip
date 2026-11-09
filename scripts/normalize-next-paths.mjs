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

      if (content.includes("D:\\\\ArtovyAPPS\\\\Artakip")) {
        content = content.replace(
          /D:\\\\ArtovyAPPS\\\\Artakip([\\A-Za-z0-9_.\-[\]]*)/g,
          (_match, subPath) => TARGET_LINUX_DIR + subPath.replace(/\\\\/g, "/")
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
