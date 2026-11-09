import os from "os";

// CloudLinux / cPanel paylaşımlı sunucularda 64+ çekirdek algılanıp EAGAIN (thread limit)
// hatası alınmasını önlemek için derleme sırasında CPU sayısını 1 olarak sınırla.
const singleCpu = os.cpus().slice(0, 1);
os.cpus = () => singleCpu;
if (os.availableParallelism) {
  os.availableParallelism = () => 1;
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  reactStrictMode: true,
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  experimental: {
    cpus: 1,
    workerThreads: false,
    webpackBuildWorker: false,
    instrumentationHook: true,
    serverComponentsExternalPackages: ["bullmq", "ioredis"],
  },
  webpack: (config) => {
    config.parallelism = 1;
    if (config.optimization) {
      config.optimization.minimize = false;
    }
    return config;
  },
};

export default nextConfig;
