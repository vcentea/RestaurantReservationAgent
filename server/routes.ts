import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertReservationSchema, reservationStatusSchema } from "@shared/schema";
import { z } from "zod";
import { ZodError } from "zod";
import { fromZodError } from "zod-validation-error";
import twilio from 'twilio';
import axios from 'axios';
import { twilioService } from './services/twilio';
import { elevenlabsService } from './services/elevenlabs';
import { initializeWebSocketServer } from './services/websocket';
import dotenv from 'dotenv';
dotenv.config();

// Set up Twilio client with real credentials
const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

// Setup ElevenLabs API integration
const elevenLabsClient = {
  createVoiceAgent: async (options: {
    name: string;
    instructions: string;
    callbackUrl: string;
    reservationId: string;
  }) => {
    console.log("Creating voice agent with options:", options);
    // In a production environment, you would make API calls to ElevenLabs
    // Since they don't have a direct Node.js SDK, we'll use Axios to make the API calls
    
    // For now, return the voice ID from environment variables
    return { id: process.env.ELEVENLABS_VOICE_ID_TABLE_BOOKING || "defaultVoiceId" };
  }
};

export async function registerRoutes(app: Express): Promise<Server> {
  // API endpoints
  app.post("/api/reservations", async (req: Request, res: Response) => {
    try {
      const reservationData = insertReservationSchema.parse(req.body);
      const newReservation = await storage.createReservation(reservationData);
      
      // In a real implementation, this would trigger the Twilio call
      // and set up the 11labs agent with a callback URL
      
      // Simulate starting the call process
      setTimeout(() => {
        initiateRestaurantCall(newReservation.id, reservationData.phoneNumber);
      }, 1000);
      
      res.status(201).json(newReservation);
    } catch (error) {
      if (error instanceof ZodError) {
        const validationError = fromZodError(error);
        res.status(400).json({ message: validationError.message });
      } else {
        console.error("Error creating reservation:", error);
        res.status(500).json({ message: "Failed to create reservation" });
      }
    }
  });

  // Endpoint to get a specific reservation status
  app.get("/api/reservations/:id", async (req: Request, res: Response) => {
    const id = req.params.id;
    
    if (!id) {
      return res.status(400).json({ message: "Invalid reservation ID" });
    }
    
    try {
      const reservation = await storage.getReservation(id);
      
      if (!reservation) {
        return res.status(404).json({ message: "Reservation not found" });
      }
      
      res.json(reservation);
    } catch (error) {
      console.error("Error fetching reservation:", error);
      res.status(500).json({ message: "Failed to fetch reservation" });
    }
  });
  
  // Endpoint to get recent reservations
  app.get("/api/reservations", async (req: Request, res: Response) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;
      const reservations = await storage.getRecentReservations(limit);
      res.json(reservations);
    } catch (error) {
      console.error("Error fetching reservations:", error);
      res.status(500).json({ message: "Failed to fetch reservations" });
    }
  });

  // Webhook for 11labs to call back with the reservation status
  app.post("/api/call-status", async (req: Request, res: Response) => {
    try {
      // This would receive callbacks from the 11labs voice agent
      // to update the reservation status
      
      const statusUpdate = reservationStatusSchema.parse(req.body);
      const updatedReservation = await storage.updateReservationStatus(statusUpdate);
      
      if (!updatedReservation) {
        return res.status(404).json({ message: "Reservation not found" });
      }
      
      res.json(updatedReservation);
    } catch (error) {
      if (error instanceof ZodError) {
        const validationError = fromZodError(error);
        res.status(400).json({ message: validationError.message });
      } else {
        console.error("Error updating reservation status:", error);
        res.status(500).json({ message: "Failed to update reservation status" });
      }
    }
  });
  
  // Add an endpoint for ElevenLabs agent to send responses
  app.post("/api/agent-response", async (req: Request, res: Response) => {
    try {
      console.log("Received agent response:", JSON.stringify(req.body));
      
      // Handle the case where ElevenLabs sends reservation_id instead of reservationId
      let requestBody = req.body;
      if (req.body.reservation_id && !req.body.reservationId) {
        console.log("Converting reservation_id to reservationId in request");
        requestBody = {
          ...req.body,
          reservationId: req.body.reservation_id
        };
      }
      
      // Extract the data from the agent's response
      const { 
        reservationId, 
        status, 
        statusMessage, 
        confirmedDate,
        confirmedTime,
        specialInstructions,
        partySize,
        personName // Extract person name from conversation
      } = requestBody;
      
      // Log the full data for debugging
      console.log("Agent response data:", {
        reservationId, 
        status, 
        statusMessage, 
        confirmedDate,
        confirmedTime,
        specialInstructions,
        partySize,
        personName
      });
      
      // Check if status is provided since it's the only required field
      if (!status) {
        console.error("Error: Missing required status parameter in agent response");
        return res.status(400).json({ error: "Missing required status parameter" });
      }
      
      let id: string;
      
      // Handle reservation ID
      if (reservationId) {
        // If provided, use the reservation ID directly
        if (typeof reservationId === 'string') {
          id = reservationId;
        } else if (typeof reservationId === 'number') {
          // Convert number to string if needed (for backward compatibility)
          id = reservationId.toString();
        } else {
          return res.status(400).json({ error: "Invalid reservationId format" });
        }
      } else {
        // If no ID provided, use the most recent reservation
        console.log("No reservationId provided, using most recent reservation");
        const recentReservations = await storage.getRecentReservations(1);
        
        if (recentReservations.length === 0) {
          return res.status(404).json({ error: "No reservations found" });
        }
        
        id = recentReservations[0].id;
      }
      
      // Update the reservation status
      const statusUpdate: any = {
        id,
        status: status,
        statusMessage: statusMessage || "Reservation response received"
      };
      
      // If personName was provided, update it
      if (personName) {
        statusUpdate.personName = personName;
      }
      
      // If partySize was provided, update confirmedPartySize
      if (partySize) {
        // Convert string to number if needed
        statusUpdate.confirmedPartySize = typeof partySize === 'string' ? parseInt(partySize, 10) : partySize;
      }
      
      // If specialInstructions were provided, update them
      if (specialInstructions) {
        statusUpdate.specialInstructions = specialInstructions;
      }
      
      // Prepare status details based on status
      if (status === "success") {
        statusUpdate.statusDetails = "The restaurant has confirmed your reservation";
        
        // Add confirmed details if available
        if (confirmedDate && confirmedTime) {
          // Format the final date time
          const dateObj = new Date(`${confirmedDate}T${confirmedTime}`);
          const options: Intl.DateTimeFormatOptions = { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit'
          };
          statusUpdate.finalDateTime = dateObj.toLocaleDateString('en-US', options);
          
          // Special instructions and party size are already set
        }
      } else if (status === "error") {
        // For error status, statusMessage is required and contains the reason
        if (!statusMessage) {
          statusUpdate.statusMessage = "The restaurant was unable to accommodate the reservation";
        }
        statusUpdate.statusDetails = "The restaurant was unable to accommodate the reservation at the requested time";
      } else if (status === "not-reached") {
        // For not-reached status, statusMessage is required and contains the reason
        if (!statusMessage) {
          statusUpdate.statusMessage = "Unable to connect with the restaurant";
        }
        statusUpdate.statusDetails = "We couldn't connect with the restaurant. The line may be busy or they might be closed.";
      }
      
      // Update the reservation in storage
      const updatedReservation = await storage.updateReservationStatus(statusUpdate);
      
      if (!updatedReservation) {
        return res.status(404).json({ error: "Reservation not found" });
      }
      
      // Return success response
      res.json({ 
        success: true, 
        message: "Agent response processed successfully",
        reservation: updatedReservation
      });
    } catch (error) {
      console.error("Error processing agent response:", error);
      res.status(500).json({ error: "Failed to process agent response" });
    }
  });

  // Retry a failed reservation call
  app.post("/api/reservations/:id/retry", async (req: Request, res: Response) => {
    const id = req.params.id;
    
    if (!id) {
      return res.status(400).json({ message: "Invalid reservation ID" });
    }
    
    try {
      const reservation = await storage.getReservation(id);
      
      if (!reservation) {
        return res.status(404).json({ message: "Reservation not found" });
      }
      
      // Update status to pending
      await storage.updateReservationStatus({
        id,
        status: "pending",
        statusMessage: "Retrying reservation call",
      });
      
      // Reinitiate the call
      setTimeout(() => {
        initiateRestaurantCall(id, reservation.phoneNumber);
      }, 1000);
      
      res.json({ message: "Reservation call retry initiated" });
    } catch (error) {
      console.error("Error retrying reservation:", error);
      res.status(500).json({ message: "Failed to retry reservation" });
    }
  });

  const httpServer = createServer(app);
  
  // Initialize WebSocket server for Twilio and ElevenLabs integration
  initializeWebSocketServer(httpServer);
  
  return httpServer;
}

// Function to initiate the restaurant call using Twilio and ElevenLabs
async function initiateRestaurantCall(reservationId: string, phoneNumber: string) {
  try {
    // 1. Get the reservation details
    const reservation = await storage.getReservation(reservationId);
    if (!reservation) {
      throw new Error(`Reservation not found with ID: ${reservationId}`);
    }
    
    // Update status to pending
    await storage.updateReservationStatus({
      id: reservationId,
      status: "pending",
      statusMessage: "Calling restaurant...",
    });
    
    // 2. Make the reservation call using our service
    // Always use public Replit URL for callbacks so Twilio can reach it
    const publicDomain = `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co`;
    const callbackUrl = `${process.env.SERVER_URL || publicDomain}/api/call-status`;
    console.log(`Using callback URL: ${callbackUrl}`);
    const result = await twilioService.makeReservationCall(
      phoneNumber,
      {
        name: reservation.name,
        date: reservation.date,
        time: reservation.time,
        partySize: reservation.partySize,
        specialRequests: reservation.specialRequests || undefined,
        reservationId: reservationId  // Pass the reservation ID to be used in the callback
      },
      callbackUrl
    );
    
    // Check if this is a simulated call due to international permissions issue
    if (result.simulatedCall && result.internationalPermissionsIssue) {
      console.log(`Simulating call to international number ${phoneNumber} (Twilio permission issue)`);
      
      // Update reservation status to indicate the simulation
      await storage.updateReservationStatus({
        id: reservationId,
        status: "pending",
        statusMessage: "Simulating call - International number detected",
        statusDetails: "Note: Your Twilio account needs international permissions enabled to make real calls to this number. Using simulation mode for demonstration purposes."
      });
    } else {
      console.log(`Initiated call to ${phoneNumber} with SID: ${result.sid}`);
    }
    
    // Don't change status after call initiation - wait for agent callback
    console.log(`Initiated call to ${phoneNumber} for reservation ${reservationId}`);
    console.log(`Waiting for callback from ElevenLabs agent...`);
    
    // In production, this section is now completely removed
    // We wait for the agent to report back directly through the /api/agent-response endpoint
    // No automatic status update will occur
    
  } catch (error: any) {
    console.error("Error initiating restaurant call:", error);
    
    // Check if this is an international permissions issue
    if (error.code === 21215) {
      console.log('International permissions error detected, updating status with instructions');
      
      await storage.updateReservationStatus({
        id: reservationId,
        status: "error",
        statusMessage: "International permissions required",
        statusDetails: "Your Twilio account needs international permissions enabled to call this number. Please visit https://www.twilio.com/console/voice/calls/geo-permissions/low-risk to enable international calling.",
      });
    } else {
      // General error case
      await storage.updateReservationStatus({
        id: reservationId,
        status: "error",
        statusMessage: "Failed to initiate call",
        statusDetails: "There was an error connecting to the voice service. Please try again later.",
      });
    }
  }
}
