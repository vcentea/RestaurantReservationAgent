import { WebSocketServer } from 'ws';
import WebSocket from 'ws';
import { Server as HttpServer } from 'http';
import { parse } from 'url';
import { log } from '../vite';
import { storage } from '../storage';
import { IncomingMessage } from 'http';

// Types for WebSocket connections
type ElevenLabsSession = {
  id: string;
  ws: WebSocket | null;
  status: 'connecting' | 'connected' | 'disconnected';
  agentId: string;
  reservationId: string | null;
};

type TwilioConnection = {
  id: string;
  ws: WebSocket;
  sessionId: string;
  agentId: string;
  reservationId: string | null;
};

// Custom type for parsed query parameters
type QueryParams = {
  [key: string]: string;
};

// Store active connections
const elevenlabsSessions: Map<string, ElevenLabsSession> = new Map();
const twilioConnections: Map<string, TwilioConnection> = new Map();

/**
 * Initialize WebSocket server for handling Twilio and ElevenLabs connections
 * This server will relay audio between Twilio and ElevenLabs for real-time conversation
 */
export function initializeWebSocketServer(server: HttpServer) {
  // Create WebSocket server attached to our HTTP server
  const wss = new WebSocketServer({ server, path: '/ws' });

  log('WebSocket server initialized for Twilio-ElevenLabs integration');

  // Handle new WebSocket connections
  wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
    if (!req.url) {
      log('WebSocket connection rejected: No URL provided');
      ws.close(1008, 'Missing URL parameters');
      return;
    }

    // Parse URL and query parameters
    const parsedUrl = parse(req.url, true);
    const params = parsedUrl.query as QueryParams;
    
    // Get connection type from path
    const path = parsedUrl.pathname || '';

    if (path === '/stream') {
      // This is a Twilio connection
      handleTwilioConnection(ws, params);
    } else if (path === '/elevenlabs') {
      // This is an ElevenLabs connection
      handleElevenLabsConnection(ws, params);
    } else {
      // Invalid path
      log(`WebSocket connection rejected: Invalid path ${path}`);
      ws.close(1008, 'Invalid WebSocket path');
    }
  });

  return wss;
}

/**
 * Handle a new WebSocket connection from Twilio
 */
function handleTwilioConnection(ws: WebSocket, params: QueryParams) {
  // Get required parameters
  const agentId = params.agentId;
  const sessionId = params.sessionId;
  const reservationId = params.reservationId || null;

  if (!agentId || !sessionId) {
    log('Twilio WebSocket connection rejected: Missing required parameters');
    ws.close(1008, 'Missing required parameters');
    return;
  }

  // Create a unique connection ID
  const connectionId = `twilio-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

  // Store the connection
  const connection: TwilioConnection = {
    id: connectionId,
    ws,
    sessionId,
    agentId,
    reservationId
  };

  twilioConnections.set(connectionId, connection);
  log(`Twilio WebSocket connection established: ${connectionId}`);

  // Find or create an ElevenLabs session for this connection
  let elevenlabsSession = Array.from(elevenlabsSessions.values()).find(
    session => session.agentId === agentId && session.id === sessionId
  );

  if (!elevenlabsSession) {
    // Create a new ElevenLabs session (it will be connected when an ElevenLabs client connects)
    elevenlabsSession = {
      id: sessionId,
      ws: null,
      status: 'connecting',
      agentId,
      reservationId
    };
    elevenlabsSessions.set(sessionId, elevenlabsSession);
    log(`Created new ElevenLabs session: ${sessionId}`);
  }

  // Handle messages from Twilio (audio data)
  ws.addEventListener('message', (event) => {
    const message = event.data;
    // If we have an active ElevenLabs connection, forward the audio
    if (elevenlabsSession && elevenlabsSession.ws && elevenlabsSession.status === 'connected') {
      elevenlabsSession.ws.send(message);
    } else {
      // Buffer or handle the case where ElevenLabs isn't connected yet
      log(`No active ElevenLabs connection for session ${sessionId}`);
    }
  });

  // Handle disconnection
  ws.addEventListener('close', () => {
    twilioConnections.delete(connectionId);
    log(`Twilio WebSocket connection closed: ${connectionId}`);

    // If this was the last connection for this session, clean up the ElevenLabs session
    const hasOtherConnections = Array.from(twilioConnections.values()).some(
      conn => conn.sessionId === sessionId && conn.id !== connectionId
    );

    if (!hasOtherConnections && elevenlabsSession) {
      // Close the ElevenLabs connection if it exists
      if (elevenlabsSession.ws) {
        elevenlabsSession.ws.close();
      }
      elevenlabsSessions.delete(sessionId);
      log(`Cleaned up ElevenLabs session: ${sessionId}`);
    }
  });
}

/**
 * Handle a new WebSocket connection from ElevenLabs
 */
function handleElevenLabsConnection(ws: WebSocket, params: QueryParams) {
  // Get required parameters
  const sessionId = params.sessionId;
  const agentId = params.agentId;
  const reservationId = params.reservationId || null;

  if (!sessionId || !agentId) {
    log('ElevenLabs WebSocket connection rejected: Missing required parameters');
    ws.close(1008, 'Missing required parameters');
    return;
  }

  // Find the session or create a new one
  let session = elevenlabsSessions.get(sessionId);

  if (!session) {
    session = {
      id: sessionId,
      ws,
      status: 'connected',
      agentId,
      reservationId
    };
    elevenlabsSessions.set(sessionId, session);
    log(`Created new ElevenLabs session: ${sessionId}`);
  } else {
    // Update the existing session
    session.ws = ws;
    session.status = 'connected';
    log(`Updated existing ElevenLabs session: ${sessionId}`);
  }

  // Handle messages from ElevenLabs (audio data and control messages)
  ws.addEventListener('message', async (event) => {
    const message = event.data;
    try {
      // Try to parse as JSON if it's a string or buffer that starts with '{'
      let controlMessage: any = null;
      let messageStr = '';
      
      if (typeof message === 'string') {
        messageStr = message;
      } else if (Buffer.isBuffer(message)) {
        messageStr = message.toString();
      } else if (message instanceof ArrayBuffer) {
        messageStr = Buffer.from(message).toString();
      } else if (Array.isArray(message)) {
        // Handle array of buffers case
        const combined = Buffer.concat(message.map(m => 
          Buffer.isBuffer(m) ? m : Buffer.from(String(m))
        ));
        messageStr = combined.toString();
      }
      
      if (messageStr && messageStr.startsWith('{')) {
        try {
          controlMessage = JSON.parse(messageStr);
        } catch (e) {
          log(`Failed to parse message as JSON: ${e}`);
        }
      }

      if (controlMessage) {
        // Handle different types of control messages
        if (controlMessage.type === 'completion') {
          // Conversation completed
          await handleConversationCompletion(session, controlMessage);
        } else if (controlMessage.type === 'function_call') {
          // Agent is calling a function (e.g., to check availability)
          await handleFunctionCall(session, controlMessage);
        } else {
          // Forward other control messages to Twilio
          forwardMessageToTwilio(sessionId, message);
        }
      } else {
        // This is audio data, forward to all Twilio connections for this session
        forwardMessageToTwilio(sessionId, message);
      }
    } catch (error) {
      log(`Error processing ElevenLabs message: ${error}`);
    }
  });

  // Handle disconnection
  ws.addEventListener('close', () => {
    if (session) {
      session.status = 'disconnected';
      session.ws = null;
      log(`ElevenLabs WebSocket connection closed: ${sessionId}`);
    }
  });
}

/**
 * Forward a message to all Twilio connections for a specific session
 */
function forwardMessageToTwilio(sessionId: string, message: any) {
  const relatedConnections = Array.from(twilioConnections.values()).filter(
    conn => conn.sessionId === sessionId
  );

  for (const conn of relatedConnections) {
    conn.ws.send(message);
  }
}

/**
 * Handle a conversation completion event from ElevenLabs
 */
async function handleConversationCompletion(
  session: ElevenLabsSession | undefined, 
  message: any
) {
  if (!session) {
    log(`Conversation completed but no session found`);
    return;
  }
  
  log(`Conversation completed for session ${session.id}`);

  // If we have a reservation ID, update its status
  if (session.reservationId) {
    try {
      // Check the result of the conversation
      const success = message.result && message.result.success === true;
      
      // Update the reservation status
      await storage.updateReservationStatus({
        id: session.reservationId,
        status: success ? 'success' : 'error',
        statusMessage: success ? 'Reservation confirmed' : 'Reservation failed',
        statusDetails: success 
          ? 'The restaurant has confirmed your reservation' 
          : 'The restaurant was unable to accommodate the reservation at the requested time',
        // Use undefined for null values to match the expected type
        finalDateTime: success && message.result.confirmedDateTime ? message.result.confirmedDateTime : undefined
      });

      log(`Updated reservation ${session.reservationId} status to ${success ? 'success' : 'error'}`);
    } catch (error) {
      log(`Error updating reservation status: ${error}`);
    }
  }
}

/**
 * Handle a function call from the ElevenLabs agent
 */
async function handleFunctionCall(
  session: ElevenLabsSession | undefined, 
  message: any
) {
  if (!session) {
    log(`Function call received but no session found`);
    return;
  }
  
  const functionName = message.function;
  const args = message.arguments || {};

  log(`Function call from ElevenLabs agent: ${functionName}`);

  // Implement various functions the agent might call
  if (functionName === 'checkAvailability') {
    // Example function: Check restaurant availability
    const result = {
      available: true,
      alternativeTimes: ['18:30', '19:30', '20:00']
    };

    // Send the result back to ElevenLabs
    if (session.ws) {
      session.ws.send(JSON.stringify({
        type: 'function_result',
        id: message.id,
        result
      }));
    }
  } else if (functionName === 'confirmReservation') {
    // Example function: Confirm a reservation
    // In a real implementation, this would interact with a restaurant booking system
    
    // Send a success result
    if (session.ws) {
      session.ws.send(JSON.stringify({
        type: 'function_result',
        id: message.id,
        result: {
          success: true,
          confirmationCode: 'RES' + Math.floor(Math.random() * 10000)
        }
      }));
    }

    // If we have a reservation ID, update its status
    if (session.reservationId) {
      try {
        // Format the confirmed date/time
        const date = args.date || '';
        const time = args.time || '';
        let formattedDateTime: string | undefined = undefined;
        
        if (date && time) {
          const dateObj = new Date(`${date}T${time}`);
          const options: Intl.DateTimeFormatOptions = { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit'
          };
          formattedDateTime = dateObj.toLocaleDateString('en-US', options);
        }

        // Update the reservation
        await storage.updateReservationStatus({
          id: session.reservationId,
          status: 'success',
          statusMessage: 'Reservation confirmed',
          statusDetails: 'The restaurant has confirmed your reservation',
          finalDateTime: formattedDateTime
        });
      } catch (error) {
        log(`Error updating reservation status: ${error}`);
      }
    }
  }
}