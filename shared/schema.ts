import { pgTable, text, serial, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// Restaurant reservations schema
export const reservations = pgTable("reservations", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  phoneNumber: text("phoneNumber").notNull(),
  partySize: integer("partySize").notNull(),
  date: text("date").notNull(),
  time: text("time").notNull(),
  specialRequests: text("specialRequests"),
  status: text("status").notNull().default("pending"), // pending, success, error, not-reached
  createdAt: timestamp("createdAt").defaultNow(),
  finalDateTime: text("finalDateTime"),
  statusMessage: text("statusMessage"),
  statusDetails: text("statusDetails"),
  personName: text("personName"), // Name of person extracted from conversation
  confirmedPartySize: integer("confirmedPartySize"), // Party size confirmed by restaurant
  specialInstructions: text("specialInstructions") // Special instructions from restaurant
});

export const insertReservationSchema = createInsertSchema(reservations).pick({
  name: true,
  phoneNumber: true,
  partySize: true,
  date: true,
  time: true,
  specialRequests: true,
});

export const reservationStatusSchema = z.object({
  id: z.string(),
  status: z.enum(["pending", "success", "error", "not-reached"]),
  statusMessage: z.string().optional(),
  statusDetails: z.string().optional(),
  finalDateTime: z.string().optional(),
  personName: z.string().optional(),
  confirmedPartySize: z.number().optional(),
  specialInstructions: z.string().optional(),
});

export type InsertReservation = z.infer<typeof insertReservationSchema>;
export type Reservation = typeof reservations.$inferSelect;
export type ReservationStatus = z.infer<typeof reservationStatusSchema>;
