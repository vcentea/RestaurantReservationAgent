import dotenv from 'dotenv';
dotenv.config();
import twilio from 'twilio';
import { elevenlabsService } from './elevenlabs';

interface TwilioCallParams {
  to: string;
  from: string;
  twiml?: string;
  statusCallback?: string;
  statusCallbackMethod?: string;
  statusCallbackEvent?: string[];
  url?: string;
}

// Twilio service for making phone calls
export class TwilioService {
  private client: twilio.Twilio;
  private phoneNumber: string;
  
  constructor() {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const phoneNumber = process.env.TWILIO_PHONE_NUMBER;
    
    if (!accountSid || !authToken) {
      throw new Error('TWILIO_ACCOUNT_SID or TWILIO_AUTH_TOKEN environment variable not set');
    }
    
    if (!phoneNumber) {
      throw new Error('TWILIO_PHONE_NUMBER environment variable not set');
    }
    
    this.client = twilio(accountSid, authToken);
    this.phoneNumber = phoneNumber;
  }

  // Make a call with Twilio
  async makeCall(params: TwilioCallParams): Promise<{ sid: string; simulatedCall?: boolean }> {
    try {
      const call = await this.client.calls.create({
        to: params.to,
        from: params.from || this.phoneNumber,
        twiml: params.twiml,
        statusCallback: params.statusCallback,
        statusCallbackMethod: params.statusCallbackMethod || 'POST',
        statusCallbackEvent: params.statusCallbackEvent || ['initiated', 'ringing', 'answered', 'completed'],
        url: params.url,
      });
      
      return { sid: call.sid };
    } catch (error: any) {
      console.error('Error making call with Twilio:', error);
      
      // Check for international permissions error
      if (error.code === 21215) {
        console.log('Twilio international permissions error. Falling back to simulation mode.');
        // Return a simulated call with a generated SID
        return { 
          sid: "SIMULATED_CALL_" + Math.random().toString(36).substring(2, 10),
          simulatedCall: true 
        };
      }
      
      throw error;
    }
  }
  
  // Make a restaurant reservation call using an existing ElevenLabs agent
  async makeReservationCall(
    phoneNumber: string, 
    reservationDetails: {
      name: string;
      date: string;
      time: string;
      partySize: number;
      specialRequests?: string | null;
      reservationId?: string; // Add reservation ID to be passed to the agent
    },
    callbackUrl: string
  ): Promise<{ 
    sid: string; 
    voiceId: string; 
    sessionId?: string;
    simulatedCall?: boolean;
    internationalPermissionsIssue?: boolean;
  }> {
    try {
      // 1. Prepare the customer details for the voice agent
      const customerDetails = {
        customerName: reservationDetails.name,
        phoneNumber: phoneNumber, // Add the phone number for direct calling
        date: reservationDetails.date,
        time: reservationDetails.time,
        partySize: reservationDetails.partySize,
        specialRequests: reservationDetails.specialRequests || null,
        reservationId: reservationDetails.reservationId // Pass the reservation ID to ElevenLabs
      };
      
      // 2. Use the existing voice agent with ElevenLabs
      // This connects to your pre-configured agent
      const agentSession = await elevenlabsService.useExistingVoiceAgent(customerDetails);
      
      // 3. Generate TwiML for the call that connects to our WebSocket server
      // In a full implementation, this would stream audio between Twilio and ElevenLabs
      
      // For WebSocket integration, we would set up a Stream in TwiML:
      // Always use public Replit URL for callbacks so Twilio can reach it
      // const publicDomain = `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co`;
      // const serverUrl = process.env.SERVER_URL || publicDomain;
      // const twiml = `<?xml version="1.0" encoding="UTF-8"?>
      //   <Response>
      //     <Start>
      //       <Stream url="wss://${serverUrl}/stream?agentId=${agentSession.id}&sessionId=${agentSession.sessionId}&name=${encodeURIComponent(reservationDetails.name)}"/>
      //     </Start>
      //     <Say>Starting reservation call with ${reservationDetails.name}</Say>
      //     <Pause length="120"/>
      //   </Response>`;
      
      // ElevenLabs is handling the call directly, so we don't need to use TwiML anymore
      // Instead, we've made a direct API call to ElevenLabs' outbound_call endpoint
      // We'll just use a simple TwiML response for Twilio's benefit
      const twiml = `<?xml version="1.0" encoding="UTF-8"?>
        <Response>
          <Say>Connecting your call to ElevenLabs voice agent...</Say>
        </Response>`;
      
      // 4. Make the call with Twilio
      const call = await this.makeCall({
        to: phoneNumber,
        from: this.phoneNumber,
        twiml,
        statusCallback: callbackUrl,
        statusCallbackMethod: 'POST',
      });
      
      // If this is a simulated call (due to API limitations)
      if (call.simulatedCall) {
        console.log(`Using simulation mode for international number: ${phoneNumber}`);
        
        // When in simulation mode, we'll also simulate the voice agent conversation
        elevenlabsService.simulateVoiceConversation(
          agentSession.id,
          customerDetails
        );
        
        return { 
          sid: call.sid,
          voiceId: agentSession.id,
          sessionId: agentSession.callSid,
          simulatedCall: true,
          internationalPermissionsIssue: true
        };
      }
      
      return { 
        sid: call.sid,
        voiceId: agentSession.id,
        sessionId: agentSession.callSid
      };
    } catch (error: any) {
      console.error('Error making reservation call:', error);
      
      // Check for international permissions errors
      if (error.code === 21215) {
        console.log('Falling back to simulation mode due to international permissions issue');
        
        // Create a unique simulation ID for this call
        const simulatedCallId = "SIMULATED_CALL_" + Math.random().toString(36).substring(2, 10);
        
        // Create customer details for simulation
        const customerDetails = {
          customerName: reservationDetails.name,
          phoneNumber: phoneNumber, // Add the phone number for direct calling
          date: reservationDetails.date,
          time: reservationDetails.time,
          partySize: reservationDetails.partySize,
          specialRequests: reservationDetails.specialRequests || null,
          reservationId: reservationDetails.reservationId // Pass the reservation ID to simulation as well
        };
        
        // Use existing agent but in simulation mode
        const agentSession = await elevenlabsService.useExistingVoiceAgent(customerDetails);
        
        // Simulate the voice agent conversation (will use the callback endpoint)
        // This is now async and uses the same API endpoint as the real agent
        elevenlabsService.simulateVoiceConversation(
          agentSession.id,
          customerDetails
        );
        
        // Return a simulated call result
        return {
          sid: simulatedCallId,
          voiceId: agentSession.id,
          sessionId: agentSession.callSid,
          simulatedCall: true,
          internationalPermissionsIssue: true
        };
      }
      
      throw error;
    }
  }
}

// Create a singleton instance
export const twilioService = new TwilioService();