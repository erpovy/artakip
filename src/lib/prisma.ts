import { PrismaClient } from "@prisma/client";

export type Role = "USER" | "ADMIN";
export const Role = {
  USER: "USER" as Role,
  ADMIN: "ADMIN" as Role,
};

export type Plan = "FREE" | "STARTER" | "PRO" | "AGENCY";
export const Plan = {
  FREE: "FREE" as Plan,
  STARTER: "STARTER" as Plan,
  PRO: "PRO" as Plan,
  AGENCY: "AGENCY" as Plan,
};

export type MonitorType = "HTTP" | "KEYWORD";
export const MonitorType = {
  HTTP: "HTTP" as MonitorType,
  KEYWORD: "KEYWORD" as MonitorType,
};

export type Status = "UP" | "DOWN" | "UNKNOWN";
export const Status = {
  UP: "UP" as Status,
  DOWN: "DOWN" as Status,
  UNKNOWN: "UNKNOWN" as Status,
};

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
