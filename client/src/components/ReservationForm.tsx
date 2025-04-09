import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { insertReservationSchema } from "@shared/schema";
import { createReservation } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";

// Extended schema with validation
const formSchema = insertReservationSchema.extend({
  phoneNumber: z.string()
    .min(7, "Phone number must be at least 7 digits")
    .regex(/^\+?[0-9\s\-\(\)]+$/, "Please enter a valid phone number"),
  date: z.string().min(1, "Date is required"),
  time: z.string().min(1, "Time is required"),
  partySize: z.preprocess(
    (val) => parseInt(val as string, 10),
    z.number().min(1, "Party size must be at least 1").max(20, "Party size cannot exceed 20")
  ),
  name: z.string().min(2, "Name must be at least 2 characters")
});

type ReservationFormProps = {
  onReservationCreated: (reservation: any) => void;
};

export default function ReservationForm({ onReservationCreated }: ReservationFormProps) {
  const { toast } = useToast();
  
  // Initialize form
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      phoneNumber: "",
      date: "",
      time: "",
      partySize: 2,
      name: "",
      specialRequests: ""
    }
  });
  
  // Mutation for creating a reservation
  const createReservationMutation = useMutation({
    mutationFn: createReservation,
    onSuccess: (data) => {
      toast({
        title: "Reservation initiated",
        description: "Our AI assistant will now call the restaurant",
      });
      onReservationCreated(data);
    },
    onError: (error) => {
      toast({
        title: "Failed to create reservation",
        description: error instanceof Error ? error.message : "Please try again",
        variant: "destructive"
      });
    }
  });
  
  // Form submission handler
  const onSubmit = (data: z.infer<typeof formSchema>) => {
    createReservationMutation.mutate(data);
  };
  
  // Set min date to today
  const today = new Date().toISOString().split('T')[0];
  
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="bg-white rounded-lg shadow-md p-6 mb-8">
        <div className="space-y-6">
          {/* Restaurant Details Section */}
          <div>
            <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center">
              <span className="material-icons mr-2 text-primary-500">restaurant</span>
              Restaurant Details
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="col-span-1">
                <FormField
                  control={form.control}
                  name="phoneNumber"
                  render={({ field }) => (
                    <FormItem className="space-y-1">
                      <FormLabel className="text-sm font-medium text-gray-700">
                        Restaurant Phone Number <span className="text-red-500">*</span>
                      </FormLabel>
                      <div className="relative">
                        <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <span className="material-icons text-gray-400 text-sm">call</span>
                        </span>
                        <FormControl>
                          <Input
                            type="tel"
                            placeholder="+1 (555) 123-4567"
                            className="pl-10"
                            {...field}
                          />
                        </FormControl>
                      </div>
                      <p className="text-xs text-gray-500">Include country and area code</p>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>
          </div>

          {/* Reservation Details Section */}
          <div>
            <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center">
              <span className="material-icons mr-2 text-primary-500">event</span>
              Reservation Details
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="col-span-1">
                <FormField
                  control={form.control}
                  name="date"
                  render={({ field }) => (
                    <FormItem className="space-y-1">
                      <FormLabel className="text-sm font-medium text-gray-700">
                        Date <span className="text-red-500">*</span>
                      </FormLabel>
                      <div className="relative">
                        <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <span className="material-icons text-gray-400 text-sm">calendar_today</span>
                        </span>
                        <FormControl>
                          <Input
                            type="date"
                            className="pl-10"
                            min={today}
                            {...field}
                          />
                        </FormControl>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <div className="col-span-1">
                <FormField
                  control={form.control}
                  name="time"
                  render={({ field }) => (
                    <FormItem className="space-y-1">
                      <FormLabel className="text-sm font-medium text-gray-700">
                        Time <span className="text-red-500">*</span>
                      </FormLabel>
                      <div className="relative">
                        <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <span className="material-icons text-gray-400 text-sm">schedule</span>
                        </span>
                        <FormControl>
                          <Input
                            type="time"
                            className="pl-10"
                            {...field}
                          />
                        </FormControl>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <div className="col-span-1">
                <FormField
                  control={form.control}
                  name="partySize"
                  render={({ field }) => (
                    <FormItem className="space-y-1">
                      <FormLabel className="text-sm font-medium text-gray-700">
                        Party Size <span className="text-red-500">*</span>
                      </FormLabel>
                      <div className="relative">
                        <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <span className="material-icons text-gray-400 text-sm">people</span>
                        </span>
                        <FormControl>
                          <Input
                            type="number"
                            className="pl-10"
                            min={1}
                            max={20}
                            placeholder="2"
                            {...field}
                          />
                        </FormControl>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <div className="col-span-1">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem className="space-y-1">
                      <FormLabel className="text-sm font-medium text-gray-700">
                        Reservation Name <span className="text-red-500">*</span>
                      </FormLabel>
                      <div className="relative">
                        <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <span className="material-icons text-gray-400 text-sm">person</span>
                        </span>
                        <FormControl>
                          <Input
                            type="text"
                            className="pl-10"
                            placeholder="John Doe"
                            {...field}
                          />
                        </FormControl>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <div className="col-span-1 md:col-span-2">
                <FormField
                  control={form.control}
                  name="specialRequests"
                  render={({ field }) => (
                    <FormItem className="space-y-1">
                      <FormLabel className="text-sm font-medium text-gray-700">
                        Special Requests <span className="text-gray-400">(optional)</span>
                      </FormLabel>
                      <div className="relative">
                        <span className="absolute top-3 left-3 flex items-start pointer-events-none">
                          <span className="material-icons text-gray-400 text-sm">notes</span>
                        </span>
                        <FormControl>
                          <Textarea
                            className="pl-10"
                            placeholder="Window seat, high chair, etc."
                            rows={2}
                            {...field}
                          />
                        </FormControl>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>
          </div>

          {/* Form Controls */}
          <div className="pt-3 flex justify-end">
            <Button 
              type="submit" 
              className="inline-flex justify-center items-center px-6 py-3 text-base" 
              disabled={createReservationMutation.isPending}
            >
              {createReservationMutation.isPending ? (
                <>Processing...</>
              ) : (
                <>
                  <span className="material-icons mr-2">phone_in_talk</span>
                  Make Reservation
                </>
              )}
            </Button>
          </div>
        </div>
      </form>
    </Form>
  );
}
