import { useState, useEffect } from "react";
import type { Reservation } from "@shared/schema";

type ReservationHistoryProps = {
  reservations: Reservation[];
};

export default function ReservationHistory({ reservations }: ReservationHistoryProps) {
  const [isVisible, setIsVisible] = useState(false);
  
  useEffect(() => {
    setIsVisible(reservations.length > 0);
  }, [reservations]);
  
  if (!isVisible) return null;
  
  // Format date for display
  const formatDate = (date: Date | string | null) => {
    if (!date) return "";
    
    const d = typeof date === "string" ? new Date(date) : date;
    
    // If less than 24 hours ago, show "Today, HH:MM AM/PM"
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    
    const isToday = now.toDateString() === d.toDateString();
    const isYesterday = yesterday.toDateString() === d.toDateString();
    
    if (isToday) {
      return `Today, ${d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
    } else if (isYesterday) {
      return `Yesterday, ${d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
    } else {
      return d.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
      });
    }
  };
  
  // Get status icon based on reservation status
  const getStatusIcon = (status: string) => {
    switch (status) {
      case "success":
        return <span className="material-icons text-green-500">check_circle</span>;
      case "error":
        return <span className="material-icons text-red-500">error</span>;
      case "not-reached":
        return <span className="material-icons text-amber-500">phone_missed</span>;
      case "pending":
        return <span className="material-icons text-blue-500">pending</span>;
      default:
        return <span className="material-icons text-gray-500">help</span>;
    }
  };
  
  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center">
        <span className="material-icons mr-2 text-primary-500">history</span>
        Recent Reservation Attempts
      </h2>
      
      <div className="overflow-hidden">
        <ul className="divide-y divide-gray-200">
          {reservations.map((reservation) => (
            <li key={reservation.id} className="py-4 flex items-start">
              <div className="flex-shrink-0 mt-1">
                {getStatusIcon(reservation.status)}
              </div>
              <div className="ml-3 flex-1">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-gray-900">
                    Reservation for {reservation.partySize} {reservation.partySize === 1 ? "person" : "people"}
                  </p>
                  <p className="text-xs text-gray-500">{formatDate(reservation.createdAt!)}</p>
                </div>
                <div className="mt-1">
                  <p className="text-xs text-gray-500">Restaurant: {reservation.phoneNumber}</p>
                  <p className="text-xs text-gray-500">
                    {new Date(`${reservation.date}T${reservation.time}`).toLocaleDateString('en-US', { 
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric'
                    })} at {
                      new Date(`${reservation.date}T${reservation.time}`).toLocaleTimeString('en-US', { 
                        hour: 'numeric',
                        minute: '2-digit'
                      })
                    } for {reservation.name}
                  </p>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
