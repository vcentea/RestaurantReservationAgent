import dotenv from 'dotenv';
dotenv.config();
import axios from 'axios';

interface VoiceInstructions {
  input: string;
  voice_id: string;
  voice_settings?: {
    stability: number;
    similarity_boost: number;
  };
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface VoiceAgent {
  id: string;
  name: string;
  instructions: string;
  firstMessage?: string;
  messages: ChatMessage[];
  variables?: Record<string, string>;
}

// ElevenLabs API client
export class ElevenLabsService {
  private apiKey: string;
  private baseUrl = 'https://api.elevenlabs.io/v1';
  
  constructor() {
    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) {
      throw new Error('ELEVENLABS_API_KEY environment variable not set');
    }
    this.apiKey = apiKey;
  }

  // Create text-to-speech audio with ElevenLabs API
  async textToSpeech(text: string, voiceId: string): Promise<ArrayBuffer> {
    const url = `${this.baseUrl}/text-to-speech/${voiceId}`;
    
    try {
      const response = await axios.post(
        url,
        {
          text,
          model_id: 'eleven_monolingual_v1',
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.5
          }
        },
        {
          headers: {
            'xi-api-key': this.apiKey,
            'Content-Type': 'application/json',
            'Accept': 'audio/mpeg'
          },
          responseType: 'arraybuffer'
        }
      );
      
      return response.data;
    } catch (error) {
      console.error('Error generating speech with ElevenLabs:', error);
      throw error;
    }
  }
  
  /**
   * Use an existing voice agent for restaurant reservation calls
   * This connects to your pre-defined agent in ElevenLabs
   */
  async useExistingVoiceAgent(
    reservationDetails?: {
      personName: string;
      phoneNumber: string;
      date: string;
      time: string;
      partySize: number;
      specialInstructions?: string | null;
      reservationId?: string; // Add reservation ID to be passed to the agent
    }
  ): Promise<{ id: string; callSid?: string }> {
    // Use the specific agent ID provided in environment variable
    const agentId = process.env.ELEVENLABS_VOICE_ID_TABLE_BOOKING || '9XjNNhNDWGsAPGfwiEq9';
    
    console.log(`Using existing ElevenLabs voice agent with ID: ${agentId}`);
    
    // Log the variables we would use to populate the agent's context
    if (reservationDetails) {
      console.log(`Preparing agent with variables:
      - personName: ${reservationDetails.personName}
      - date: ${reservationDetails.date}
      - time: ${reservationDetails.time}
      - partySize: ${reservationDetails.partySize}
      - specialInstructions: ${reservationDetails.specialInstructions ? ' ' + reservationDetails.specialInstructions : ''}
      - reservationId: ${reservationDetails.reservationId || 'Not provided'}`);
      
      try {
        // We'll use the specific outbound call endpoint for Twilio integration
        // Using the format from the working curl command
        const twilioPhone = "Sqdz4JrqrXoGL7D263v1"; // Use the agent_phone_number_id from the working example
        
        // Make an outbound call request to ElevenLabs using their Twilio integration
        const callResponse = await axios.post(
          `${this.baseUrl}/convai/twilio/outbound_call`,
          {
            agent_id: agentId,
            agent_phone_number_id: twilioPhone,
            to_number: reservationDetails.phoneNumber, // The restaurant's phone number
            conversation_initiation_client_data: {
              dynamic_variables: {
                personName: reservationDetails.personName,
                date: reservationDetails.date,
                time: reservationDetails.time,
                partySize: String(reservationDetails.partySize),
                specialInstructions: reservationDetails.specialInstructions || '',
                reservationId: reservationDetails.reservationId ? String(reservationDetails.reservationId) : ''
              },
              custom_llm_extra_body: {}
            }
          },
          {
            headers: {
              'xi-api-key': this.apiKey,
              'Content-Type': 'application/json'
            }
          }
        );
        
        console.log(`Successfully initiated ElevenLabs outbound call: ${callResponse.data.callSid}`);
        
        return { 
          id: agentId,
          callSid: callResponse.data.callSid
        };
      } catch (error) {
        console.error('Error initiating ElevenLabs outbound call:', error);
        console.log('Falling back to simulated session');
        
        // If there's an error, we'll fall back to a simulated session
        return { 
          id: agentId,
          callSid: 'simulated-call-' + Math.random().toString(36).substring(2, 10)
        };
      }
    }
    
    return { 
      id: agentId,
      callSid: 'simulated-call-' + Math.random().toString(36).substring(2, 10)
    };
  }
  
  /**
   * Legacy method maintained for backward compatibility
   * @deprecated Use useExistingVoiceAgent instead
   */
  async createVoiceAgent(
    name: string,
    instructions: string,
    reservationDetails?: {
      personName: string;
      phoneNumber: string;
      date: string;
      time: string;
      partySize: number;
      specialInstructions?: string | null;
      reservationId?: string; // Add reservation ID
    }
  ): Promise<{ id: string }> {
    console.log(`[DEPRECATED] Calling createVoiceAgent - will use existing agent instead.`);
    
    // Forward to the new method that uses the existing agent
    const result = await this.useExistingVoiceAgent(reservationDetails);
    return { id: result.id };
  }
  
  /**
   * Simulate a voice conversation with a restaurant
   * This function now uses the callback endpoint to update status,
   * just like the real ElevenLabs agent would.
   */
  async simulateVoiceConversation(
    agentId: string, 
    reservationDetails: {
      personName: string;
      phoneNumber: string;
      date: string;
      time: string;
      partySize: number;
      specialInstructions?: string | null;
      reservationId?: string; // Add reservationId parameter
    },
    restaurantResponses: string[] = []
  ): Promise<void> {
    console.log(`Simulating voice conversation with agent ${agentId} for ${reservationDetails.personName}`);
    
    if (!reservationDetails.reservationId) {
      console.error("Missing reservationId in simulated conversation");
      return;
    }
    
    // Wait for a realistic amount of time (4-8 seconds) to simulate a conversation
    const delay = 4000 + Math.floor(Math.random() * 4000);
    console.log(`Simulating conversation delay of ${delay}ms`);
    
    setTimeout(async () => {
      try {
        // Generate a random outcome, slightly weighted towards success
        const random = Math.random();
        let success = false;
        
        // 70% chance of success if no specific responses provided
        if (restaurantResponses.length === 0) {
          success = random < 0.7;
        } else {
          // If specific restaurant responses are provided, use them to determine outcome
          const containsRejection = restaurantResponses.some(
            response => response.toLowerCase().includes('no') || 
                      response.toLowerCase().includes('sorry') ||
                      response.toLowerCase().includes('full')
          );
          success = !containsRejection;
        }
        
        // Prepare the callback data
        const callbackData = {
          reservationId: reservationDetails.reservationId,
          status: success ? "success" : "error",
          statusMessage: success ? "Reservation confirmed" : "Reservation failed",
          confirmedDate: success ? reservationDetails.date : undefined,
          confirmedTime: success ? reservationDetails.time : undefined,
          personName: success ? reservationDetails.personName : undefined,
          partySize: success ? String(reservationDetails.partySize) : undefined,
          specialInstructions: success ? (reservationDetails.specialInstructions || "No special requests") : undefined
        };
        
        // Get the correct API URL
        const baseUrl = process.env.SERVER_URL || 
                     `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co`;
        const callbackUrl = `${baseUrl}/api/agent-response`;
        
        console.log(`Sending simulated callback to ${callbackUrl}`, callbackData);
        
        // Send the simulation result to the agent-response endpoint
        const response = await fetch(callbackUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(callbackData)
        });
        
        if (!response.ok) {
          console.error(`Error sending simulation callback: ${response.status} ${response.statusText}`);
          const errorText = await response.text();
          console.error(`Error response: ${errorText}`);
        } else {
          console.log('Simulation callback sent successfully');
        }
      } catch (error) {
        console.error('Error in simulated voice conversation:', error);
      }
    }, delay);
  }
}

// Create a singleton instance
export const elevenlabsService = new ElevenLabsService();