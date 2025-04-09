import 'dotenv/config';

// Script to update the ElevenLabs agent with the correct tool configuration
import axios from 'axios';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Initialize env vars
config();

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const AGENT_ID = '9XjNNhNDWGsAPGfwiEq9'; // The agent ID from the curl example

// Retrieve hostname from environment variable or use default
const HOSTNAME = process.env.HOSTNAME || "calldemo.ainnovate.tech";

async function updateAgent() {
  const PUBLIC_URL = `https://${HOSTNAME}`;
  console.log(`Using public URL: ${PUBLIC_URL}`);
  
  try {
    console.log('Updating ElevenLabs agent with new tool configuration...');
    
    // First, get the current agent configuration to preserve ALL existing tools
    const getCurrentAgent = await axios({
      method: 'GET',
      url: `https://api.elevenlabs.io/v1/convai/agents/${AGENT_ID}`,
      headers: {
        'xi-api-key': ELEVENLABS_API_KEY,
        'Content-Type': 'application/json'
      }
    });
    
    // Extract existing tools - we want to keep ALL existing tools except our own if it exists
    const existingTools = getCurrentAgent.data?.conversation_config?.agent?.prompt?.tools || [];
    
    // Only filter out our specific tool if it already exists
    const otherTools = existingTools.filter(tool => 
      tool.name !== 'agent-response'
    );
    
    console.log(`Preserving ${otherTools.length} existing tools`);
    
    // Our new webhook tool
    const webhookTool = {
      type: 'webhook',
      api_schema: {
        url: `${PUBLIC_URL}/api/agent-response`,
        method: 'POST',
        description: 'Processes restaurant reservation outcome. Complete JSON Example: {"reservationId":"m99abcd-8gum9mifynt-4xyzabc", "status":"success", "statusMessage":"Reservation confirmed", "confirmedDate":"2025-04-23", "confirmedTime":"19:30", "partySize":"4", "specialInstructions":"Window table reserved", "personName":"John Smith"}',
        request_body_schema: {
          type: 'object',
          description: 'Reservation outcome with required parameter names. USE EXACT KEYS: "reservationId", "status", "statusMessage", etc.',
          properties: {
            reservationId: {
              type: 'string',
              description: "• ID of reservation (provided during call initiation)"
            },
            status: {
              type: 'string',
              enum: ['success', 'error', 'not-reached'],
              description: '• Required: "success" (confirmed), "error" (declined), "not-reached" (no answer)'
            },
            statusMessage: {
              type: 'string',
              description: '• Required for error/not-reached: Clear explanation ("Fully booked", "No answer")'
            },
            confirmedDate: {
              type: 'string',
              description: '• Date in YYYY-MM-DD format (e.g., "2025-04-15")'
            },
            confirmedTime: {
              type: 'string',
              description: '• Time in HH:MM format (e.g., "19:30")'
            },
            specialInstructions: {
              type: 'string',
              description: '• Notes from restaurant (seating, dress code, etc.)'
            },
            partySize: {
              type: 'string',
              description: '• Final number of people agreed with restaurant'
            },
            personName: {
              type: 'string',
              description: '• Name used for the reservation during conversation'
            }
          },
          required: ['status']
        }
      },
      description: 'Send restaurant reservation outcome. ALWAYS call at conversation end. USE EXACT PARAMETER NAMES.\n\n✓ Full Example JSON:\n{\n  "reservationId": "m99abcd-8gum9mifynt-4xyzabc",\n  "status": "success",\n  "statusMessage": "Reservation confirmed for April 23rd",\n  "confirmedDate": "2025-04-23",\n  "confirmedTime": "19:30",\n  "partySize": "4",\n  "specialInstructions": "Window table reserved",\n  "personName": "John Smith"\n}\n\n✓ Error Example JSON:\n{\n  "reservationId": "m99abcd-8gum9mifynt-4xyzabc",\n  "status": "error",\n  "statusMessage": "Restaurant fully booked for requested time",\n  "personName": "John Smith"\n}\n\n• Only "status" is mandatory\n• Always include "statusMessage" with specific details\n• Extract and include personName from conversation\n• Format dates as YYYY-MM-DD, times as HH:MM (24h format)',
      name: 'agent-response'
    };
    
    // Combine existing tools with our new webhook tool
    const allTools = [...otherTools, webhookTool];
    
    const response = await axios({
      method: 'PATCH',
      url: `https://api.elevenlabs.io/v1/convai/agents/${AGENT_ID}`,
      headers: {
        'xi-api-key': ELEVENLABS_API_KEY,
        'Content-Type': 'application/json'
      },
      data: {
        conversation_config: {
          agent: {
            prompt: {
              tools: allTools
            }
          }
        }
      }
    });
    
    console.log('Agent updated successfully!');
    console.log('Response:', JSON.stringify(response.data, null, 2));
    
    return response.data;
  } catch (error) {
    console.error('Error updating agent:', error.response?.data || error.message);
    throw error;
  }
}

// Execute the update function
updateAgent()
  .then(() => {
    console.log('Agent update process completed');
  })
  .catch((error) => {
    console.error('Failed to update agent:', error);
    process.exit(1);
  });