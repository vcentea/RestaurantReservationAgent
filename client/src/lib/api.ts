import { apiRequest } from "./queryClient";
import type { Reservation, InsertReservation, ReservationStatus } from "@shared/schema";

// API functions for the client
export async function createReservation(reservationData: InsertReservation): Promise<Reservation> {
  const response = await apiRequest("POST", "/api/reservations", reservationData);
  return response.json();
}

export async function getReservation(id: string): Promise<Reservation> {
  const response = await apiRequest("GET", `/api/reservations/${id}`);
  return response.json();
}

export async function getRecentReservations(limit: number = 10): Promise<Reservation[]> {
  const response = await apiRequest("GET", `/api/reservations?limit=${limit}`);
  return response.json();
}

export async function retryReservation(id: string): Promise<{ message: string }> {
  const response = await apiRequest("POST", `/api/reservations/${id}/retry`);
  return response.json();
}

export async function updateReservationStatus(statusUpdate: ReservationStatus): Promise<Reservation> {
  const response = await apiRequest("POST", "/api/call-status", statusUpdate);
  return response.json();
}
