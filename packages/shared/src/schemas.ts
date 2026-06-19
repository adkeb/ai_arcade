import { z } from "zod";

export const registerSchema = z.object({
  email: z.string().email().max(255),
  username: z.string().trim().min(2).max(80),
  password: z.string().min(8).max(128),
});

export const loginSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(1).max(128),
});

export const createJobSchema = z.object({
  prompt: z.string().trim().min(10).max(2000),
  assetIds: z.array(z.string().min(1)).max(8).default([]),
});

export const telemetrySchema = z.object({
  gameId: z.string().min(1),
  eventType: z.enum([
    "game_load_start",
    "game_load_success",
    "game_load_failed",
    "play_start",
    "play_exit",
    "game_over",
    "restart",
  ]),
  payload: z.record(z.string(), z.unknown()).default({}),
});

export const gameMessageSchema = z.object({
  type: z.enum(["play_start", "game_over", "restart"]),
  payload: z.record(z.string(), z.unknown()).optional(),
});

export const gamesQuerySchema = z.object({
  search: z.string().trim().max(80).optional(),
  tag: z.string().trim().max(40).optional(),
});
