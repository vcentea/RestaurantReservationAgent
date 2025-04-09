import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import ReservationForm from "@/components/ReservationForm";
import ReservationStatus from "@/components/ReservationStatus";
import ReservationHistory from "@/components/ReservationHistory";
import { getRecentReservations } from "@/lib/api";
import type { Reservation } from "@shared/schema";

export default function Home() {
  const [currentReservation, setCurrentReservation] = useState<Reservation | null>(null);
  
  // Fetch recent reservations with automatic polling
  const { data: reservationHistory = [], refetch: refetchHistory } = useQuery<Reservation[]>({
    queryKey: ['/api/reservations'],
    queryFn: getRecentReservations,
    staleTime: 5000, // Consider data stale after 5 seconds
    refetchInterval: 10000, // Refetch every 10 seconds automatically
  });
  
  // Function to handle successful reservation creation
  const handleReservationCreated = (reservation: Reservation) => {
    setCurrentReservation(reservation);
    refetchHistory();
  };
  
  // Function to handle retry
  const handleRetry = () => {
    refetchHistory();
  };
  
  // Function to reset current reservation and start a new one
  const handleStartNewReservation = () => {
    setCurrentReservation(null);
  };
  
  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      <header className="mb-8 text-center">
        <h1 className="text-3xl font-bold text-primary-700 mb-2">
          Restaurant Reservation Assistant
        </h1>
        <p className="text-gray-600 max-w-xl mx-auto">
          Let our AI assistant call and make a restaurant reservation for you. Just fill in the details below.
        </p>
      </header>

      <main>
        {!currentReservation ? (
          <ReservationForm onReservationCreated={handleReservationCreated} />
        ) : (
          <ReservationStatus 
            reservationId={currentReservation.id} 
            onRetry={handleRetry} 
            onNewReservation={handleStartNewReservation}
            onStatusChange={refetchHistory}
          />
        )}
        
        {reservationHistory.length > 0 && (
          <ReservationHistory reservations={reservationHistory} />
        )}
      </main>
    </div>
  );
}
