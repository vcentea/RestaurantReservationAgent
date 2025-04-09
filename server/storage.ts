import { reservations, type Reservation, type InsertReservation, type ReservationStatus } from "@shared/schema";
import { users, type User, type InsertUser } from "@shared/schema";

// modify the interface with any CRUD methods
// you might need

export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  createReservation(reservation: InsertReservation): Promise<Reservation>;
  getReservation(id: string): Promise<Reservation | undefined>;
  updateReservationStatus(statusUpdate: ReservationStatus): Promise<Reservation | undefined>;
  getRecentReservations(limit?: number): Promise<Reservation[]>;
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private reservationStore: Map<string, Reservation>;
  userCurrentId: number;

  constructor() {
    this.users = new Map();
    this.reservationStore = new Map();
    this.userCurrentId = 1;
  }
  
  // Generate a secure random ID for reservations
  private generateReservationId(): string {
    const timestamp = Date.now().toString(36);
    const randomPart = Math.random().toString(36).substring(2, 15);
    const secondRandomPart = Math.random().toString(36).substring(2, 15);
    return `${timestamp}-${randomPart}-${secondRandomPart}`;
  }

  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.userCurrentId++;
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  async createReservation(insertReservation: InsertReservation): Promise<Reservation> {
    const id = this.generateReservationId();
    const createdAt = new Date();
    
    const reservation: Reservation = {
      ...insertReservation,
      id,
      status: "pending",
      createdAt,
      finalDateTime: null,
      statusMessage: null,
      statusDetails: null,
      personName: null, // Initialize personName as null
      specialRequests: insertReservation.specialRequests || null, // Handle specialRequests explicitly
      confirmedPartySize: null, // Initialize confirmedPartySize as null
      specialInstructions: null // Initialize specialInstructions as null
    };
    
    this.reservationStore.set(id, reservation);
    return reservation;
  }

  async getReservation(id: string): Promise<Reservation | undefined> {
    return this.reservationStore.get(id);
  }

  async updateReservationStatus(statusUpdate: ReservationStatus): Promise<Reservation | undefined> {
    const reservation = await this.getReservation(statusUpdate.id);
    
    if (!reservation) return undefined;
    
    const updatedReservation: Reservation = {
      ...reservation,
      status: statusUpdate.status,
      statusMessage: statusUpdate.statusMessage || reservation.statusMessage,
      statusDetails: statusUpdate.statusDetails || reservation.statusDetails,
      finalDateTime: statusUpdate.finalDateTime || reservation.finalDateTime,
      personName: (statusUpdate as any).personName || reservation.personName, // Handle personName if provided
      confirmedPartySize: (statusUpdate as any).confirmedPartySize || reservation.confirmedPartySize, // Handle confirmedPartySize if provided
      specialInstructions: (statusUpdate as any).specialInstructions || reservation.specialInstructions, // Handle specialInstructions if provided
    };
    
    this.reservationStore.set(statusUpdate.id, updatedReservation);
    return updatedReservation;
  }

  async getRecentReservations(limit: number = 10): Promise<Reservation[]> {
    const reservations = Array.from(this.reservationStore.values());
    return reservations
      .sort((a, b) => new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime())
      .slice(0, limit);
  }
}

export const storage = new MemStorage();
