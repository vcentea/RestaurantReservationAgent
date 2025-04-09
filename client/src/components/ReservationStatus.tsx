import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { getReservation, retryReservation } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";

// Define a local interface for Reservation to avoid import issues
interface Reservation {
  id: string;
  name: string;
  phoneNumber: string;
  date: string;
  time: string;
  partySize: number;
  specialRequests: string | null;
  status: string;
  statusMessage: string | null;
  statusDetails: string | null;
  finalDateTime: string | null;
  personName: string | null;
  confirmedPartySize: number | null;
  specialInstructions: string | null;
  createdAt: Date | null;
}

type ReservationStatusProps = {
  reservationId: string;
  onRetry: () => void;
  onNewReservation: () => void;
  onStatusChange?: () => void; // Add callback for status changes
};

export default function ReservationStatus({ 
  reservationId, 
  onRetry,
  onNewReservation,
  onStatusChange
}: ReservationStatusProps) {
  const { toast } = useToast();
  const [lastStatus, setLastStatus] = useState<string | null>(null);
  
  // Fetch the reservation with polling
  const { data: reservation, isLoading, refetch } = useQuery({
    queryKey: ['/api/reservations', reservationId],
    queryFn: () => getReservation(reservationId),
    // Simple poll every 3 seconds while active
    refetchInterval: 3000, 
    // Make sure we get fresh data
    staleTime: 0,
    gcTime: 0,
  });
  
  // Retry mutation
  const retryMutation = useMutation({
    mutationFn: retryReservation,
    onSuccess: () => {
      toast({
        title: "Retry initiated",
        description: "Our AI assistant will try calling the restaurant again",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/reservations', reservationId] });
      onRetry();
    },
    onError: (error) => {
      toast({
        title: "Failed to retry",
        description: error instanceof Error ? error.message : "Please try again",
        variant: "destructive"
      });
    }
  });
  
  // Handle retry
  const handleRetry = () => {
    retryMutation.mutate(reservationId);
  };
  
  // Handle manual call
  const handleManualCall = () => {
    if (reservation?.phoneNumber) {
      window.open(`tel:${reservation.phoneNumber}`);
    }
  };
  
  // Format date and time for display
  // Force refresh when status changes
  useEffect(() => {
    if (reservation?.status && reservation.status !== lastStatus) {
      console.log(`Status changed from ${lastStatus} to ${reservation.status}`);
      
      // Status has changed, update the local state
      setLastStatus(reservation.status);
      
      // If the status is not pending anymore and was previously pending,
      // manually trigger a notification
      if (lastStatus === 'pending' && reservation.status !== 'pending') {
        toast({
          title: reservation.status === 'success' ? "Reservation Confirmed!" : "Reservation Status Updated",
          description: reservation.statusMessage || "The restaurant has responded to your reservation request.",
          variant: reservation.status === 'success' ? 'default' : 'destructive'
        });
        
        // Call the onStatusChange callback to update reservation history
        if (onStatusChange) {
          onStatusChange();
        }
        
        // Force a refetch to ensure we have the latest data
        setTimeout(() => {
          refetch();
        }, 500);
      } else if (lastStatus === null && reservation.status === 'error') {
        // If this is the first status we're seeing and it's an error,
        // it's likely a premature error before the callback completed.
        // Don't show a toast notification in this case.
        console.log("Received initial error status - this may be temporary until callback completes");
      }
    }
  }, [reservation?.status, lastStatus, toast, refetch, onStatusChange]);

  // We no longer need this interval as useQuery's refetchInterval handles polling
  // Just kept for reference
  
  const formatDateTime = (date: string, time: string) => {
    try {
      const dateObj = new Date(`${date}T${time}`);
      const options: Intl.DateTimeFormatOptions = { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
      };
      return dateObj.toLocaleDateString('en-US', options);
    } catch (e) {
      return `${date} at ${time}`;
    }
  };
  
  return (
    <div className="bg-white rounded-lg shadow-md p-6 mb-8">
      <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center">
        <span className="material-icons mr-2 text-primary-500">support_agent</span>
        Reservation Status
      </h2>

      {/* Loading/Pending State */}
      {(isLoading || reservation?.status === 'pending') && (
        <div className="py-8 flex flex-col items-center justify-center text-center">
          <div className="mb-4 flex space-x-2 justify-center">
            <div className="w-3 h-3 bg-primary-500 rounded-full animate-[loading_1.4s_infinite_ease-in-out_both]" style={{ animationDelay: '-0.32s' }}></div>
            <div className="w-3 h-3 bg-primary-500 rounded-full animate-[loading_1.4s_infinite_ease-in-out_both]" style={{ animationDelay: '-0.16s' }}></div>
            <div className="w-3 h-3 bg-primary-500 rounded-full animate-[loading_1.4s_infinite_ease-in-out_both]"></div>
          </div>
          <p className="text-gray-600 mb-2">Our AI assistant is calling the restaurant</p>
          <p className="text-sm text-gray-500">This may take a couple of minutes</p>
        </div>
      )}

      {/* Success State */}
      {reservation?.status === 'success' && (
        <div className="py-8">
          <div className="flex flex-col items-center justify-center text-center mb-6">
            <div className="mb-4 w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
              <span className="material-icons text-green-500 text-3xl">check_circle</span>
            </div>
            <h3 className="text-xl font-semibold text-gray-800 mb-1">Reservation Confirmed!</h3>
            <p className="text-gray-600">{reservation.statusMessage}</p>
          </div>
          
          <div className="bg-gray-50 rounded-lg p-4 max-w-md mx-auto">
            <ul className="space-y-3">
              <li className="flex items-start">
                <span className="material-icons text-gray-500 mr-2 text-sm">restaurant</span>
                <div>
                  <p className="text-sm text-gray-500">Restaurant</p>
                  <p className="text-sm font-medium">{reservation.phoneNumber}</p>
                </div>
              </li>
              <li className="flex items-start">
                <span className="material-icons text-gray-500 mr-2 text-sm">event</span>
                <div>
                  <p className="text-sm text-gray-500">Date & Time</p>
                  <p className="text-sm font-medium">
                    {reservation.finalDateTime || formatDateTime(reservation.date, reservation.time)}
                  </p>
                </div>
              </li>
              <li className="flex items-start">
                <span className="material-icons text-gray-500 mr-2 text-sm">person</span>
                <div>
                  <p className="text-sm text-gray-500">Reserved For</p>
                  <p className="text-sm font-medium">{reservation.personName || reservation.name}</p>
                </div>
              </li>
              <li className="flex items-start">
                <span className="material-icons text-gray-500 mr-2 text-sm">people</span>
                <div>
                  <p className="text-sm text-gray-500">Party Size</p>
                  <p className="text-sm font-medium">
                    {reservation.confirmedPartySize || reservation.partySize} {(reservation.confirmedPartySize || reservation.partySize) === 1 ? 'person' : 'people'}
                    {reservation.confirmedPartySize && reservation.confirmedPartySize !== reservation.partySize && 
                      <span className="text-xs text-amber-600 ml-2">(Changed from {reservation.partySize})</span>
                    }
                  </p>
                </div>
              </li>
              {(reservation.specialInstructions || reservation.specialRequests) && (
                <li className="flex items-start">
                  <span className="material-icons text-gray-500 mr-2 text-sm">info</span>
                  <div>
                    <p className="text-sm text-gray-500">Special Instructions</p>
                    <p className="text-sm font-medium">{reservation.specialInstructions || reservation.specialRequests}</p>
                  </div>
                </li>
              )}
            </ul>
            
            <div className="flex justify-center mt-6">
              <Button onClick={onNewReservation} variant="outline">
                <span className="material-icons mr-2 text-sm">add</span>
                Make Another Reservation
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Error State */}
      {reservation?.status === 'error' && (
        <div className="py-8">
          <div className="flex flex-col items-center justify-center text-center mb-6">
            <div className="mb-4 w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
              <span className="material-icons text-red-500 text-3xl">error</span>
            </div>
            <h3 className="text-xl font-semibold text-gray-800 mb-1">Reservation Failed</h3>
            <p className="text-gray-600">{reservation.statusMessage}</p>
          </div>
          
          <div className="bg-gray-50 rounded-lg p-4 max-w-md mx-auto">
            <h4 className="font-medium text-gray-700 mb-2">Error Details:</h4>
            <p className="text-sm text-gray-600 mb-4">
              {reservation.statusDetails}
            </p>
            
            <div className="flex justify-center pt-2">
              <Button 
                onClick={handleRetry}
                variant="outline"
                disabled={retryMutation.isPending}
              >
                <span className="material-icons mr-2 text-sm">refresh</span>
                Try Again
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Restaurant Not Reached State */}
      {reservation?.status === 'not-reached' && (
        <div className="py-8">
          <div className="flex flex-col items-center justify-center text-center mb-6">
            <div className="mb-4 w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center">
              <span className="material-icons text-amber-500 text-3xl">phone_missed</span>
            </div>
            <h3 className="text-xl font-semibold text-gray-800 mb-1">Restaurant Not Reached</h3>
            <p className="text-gray-600">{reservation.statusMessage}</p>
          </div>
          
          <div className="bg-gray-50 rounded-lg p-4 max-w-md mx-auto">
            <h4 className="font-medium text-gray-700 mb-2">What happened:</h4>
            <p className="text-sm text-gray-600 mb-4">
              {reservation.statusDetails}
            </p>
            
            <div className="flex flex-col sm:flex-row justify-center gap-3 pt-2">
              <Button 
                onClick={handleRetry}
                disabled={retryMutation.isPending}
              >
                <span className="material-icons mr-2 text-sm">call</span>
                Retry Call
              </Button>
              
              <Button
                onClick={handleManualCall}
                variant="outline"
              >
                <span className="material-icons mr-2 text-sm">smartphone</span>
                Call Manually
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
