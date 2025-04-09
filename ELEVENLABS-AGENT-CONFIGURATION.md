# ElevenLabs Agent Configuration

To properly integrate the ElevenLabs agent with our application, you need to configure the agent with the correct tools and capabilities to send back reservation details.

## Agent-Response Tool Configuration

The agent tool name should be `agent-response`. This tool allows the agent to send the reservation status and details back to our application when a call is completed.

### Tool Schema

```json
{
  "tool_name": "agent-response",
  "description": "Use this to report the reservation outcome back to the application. Report SUCCESS when the reservation is confirmed, ERROR if the restaurant declines the request, and NOT-REACHED if unable to contact the restaurant.",
  "input_schema": {
    "type": "object",
    "properties": {
      "reservationId": {
        "type": "string",
        "description": "The ID of the reservation being processed, provided in the initial request"
      },
      "status": {
        "type": "string",
        "enum": ["success", "error", "not-reached"],
        "description": "The status of the reservation: success (confirmed), error (declined), or not-reached (unable to contact)"
      },
      "statusMessage": {
        "type": "string",
        "description": "A brief message describing the outcome of the reservation attempt"
      },
      "confirmedDate": {
        "type": "string",
        "description": "For successful reservations, the confirmed date in YYYY-MM-DD format"
      },
      "confirmedTime": {
        "type": "string",
        "description": "For successful reservations, the confirmed time in HH:MM format (24-hour)"
      },
      "specialInstructions": {
        "type": "string",
        "description": "Any special notes or instructions mentioned by the restaurant"
      },
      "partySize": {
        "type": "string",
        "description": "The confirmed number of people for the reservation (if different from requested)"
      }
    },
    "required": ["reservationId", "status"],
    "additionalProperties": false
  }
}
```

### API Endpoint

The agent should call the following endpoint to report reservation outcomes:

```
https://your-app-domain.replit.app/api/agent-response
```

Replace `your-app-domain.replit.app` with the actual domain of your deployed application.

The endpoint expects a POST request with a JSON body following the schema above.

### Example Usage

Here's an example of how the agent should use this tool after completing a successful reservation:

```json
{
  "reservationId": "123",
  "status": "success",
  "statusMessage": "Reservation confirmed",
  "confirmedDate": "2025-05-10",
  "confirmedTime": "19:30",
  "specialInstructions": "Window seat as requested, please arrive 10 minutes early",
  "partySize": "4"
}
```

For failed reservations:

```json
{
  "reservationId": "123",
  "status": "error",
  "statusMessage": "Restaurant is fully booked"
}
```

For unreachable restaurants:

```json
{
  "reservationId": "123",
  "status": "not-reached",
  "statusMessage": "Could not reach the restaurant"
}
```

## Agent Configuration Instructions

When updating your ElevenLabs agent:

1. Add the `agent-response` tool with the schema above
2. Update the agent's webhook URL to your application's API endpoint
3. Ensure the agent is instructed to call the API with the reservation outcome
4. Test the integration by making a test reservation

This configuration will allow the ElevenLabs agent to properly communicate reservation outcomes back to your application, which will then update the UI to show the user the status of their reservation request.