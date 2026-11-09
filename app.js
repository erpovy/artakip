/**
 * Plesk / cPanel / CyberPanel / aaPanel (CloudLinux) Başlangıç Dosyası (Application Startup File)
 * CloudLinux NPROC / Thread limitini aşmamak için tüm havuz boyutları 1 ile sınırlandırılır.
 */
process.env.UV_THREADPOOL_SIZE = "1";
process.env.RAYON_NUM_THREADS = "1";
process.env.TOKIO_WORKER_THREADS = "1";
process.env.OMP_NUM_THREADS = "1";
process.env.NODE_ENV = "production";

const os = require("os");
const firstCpu = os.cpus().slice(0, 1);
os.cpus = () => firstCpu;
if (typeof os.availableParallelism === "function") {
  os.availableParallelism = () => 1;
}

const { createServer } = require("http");
const { parse } = require("url");
const next = require("next");

const dev = false;
const hostname = "0.0.0.0";
const port = parseInt(process.env.PORT || "3000", 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error("Error occurred handling", req.url, err);
      res.statusCode = 500;
      res.end("Internal Server Error");
    }
  }).listen(port, hostname, () => {
    console.log(`> Artakip hazır: http://${hostname}:${port}`);
  });
});
