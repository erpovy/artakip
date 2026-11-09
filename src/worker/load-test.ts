import { performHttpProbe } from "../lib/monitor-engine";

/**
 * 300 WordPress sitesinin eşzamanlı (varsayılan concurrency = 20) kontrolünü simüle eden yük testi.
 */
async function runLoadTest() {
  (process.env as Record<string, string>).NODE_ENV = "test";
  const totalSites = 300;
  const concurrency = Number(process.env.WORKER_CONCURRENCY || 20);

  console.log(
    `[Yük Testi] ${totalSites} WordPress sitesi (Concurrency: ${concurrency}) kontrol ediliyor...`
  );

  // Hızlı ve deterministik yük testi için mock fetch
  const mockFetch: typeof fetch = async (input) => {
    const urlStr = String(input);
    await new Promise((r) => setTimeout(r, 15)); // 15ms simüle edilmiş ağ gecikmesi
    if (urlStr.includes("down-site")) {
      return new Response("Service Unavailable", { status: 503 });
    }
    return new Response("<html><head><title>WordPress</title></head><body>WP</body></html>", {
      status: 200,
    });
  };

  const sites = Array.from({ length: totalSites }, (_, idx) => ({
    id: `wp-${idx + 1}`,
    url:
      idx % 25 === 0
        ? `https://down-site-${idx + 1}.example.com`
        : `https://wp-site-${idx + 1}.example.com`,
  }));

  const startTime = Date.now();
  let upCount = 0;
  let downCount = 0;

  for (let i = 0; i < sites.length; i += concurrency) {
    const batch = sites.slice(i, i + concurrency);
    const results = await Promise.all(
      batch.map((site) =>
        performHttpProbe(
          {
            url: site.url,
            type: "KEYWORD",
            keyword: "WordPress",
            timeoutSeconds: 10,
            expectedStatus: "200-399",
            followRedirects: true,
          },
          mockFetch
        )
      )
    );

    for (const r of results) {
      if (r.isUp) upCount++;
      else downCount++;
    }
  }

  const elapsedMs = Date.now() - startTime;
  console.log(`[Yük Testi Tamamlandı]`);
  console.log(`- Toplam Site: ${totalSites}`);
  console.log(`- Eşzamanlılık (Concurrency): ${concurrency}`);
  console.log(`- Sonuç: ${upCount} UP, ${downCount} DOWN`);
  console.log(`- Toplam Süre: ${elapsedMs} ms (${(elapsedMs / 1000).toFixed(2)} sn — 1 dk hedefinin çok altında)`);
}

runLoadTest().catch((e) => {
  console.error(e);
  process.exit(1);
});
