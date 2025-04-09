# ElevenLabs Agent Integration Guide

## Agent Response Structure

The ElevenLabs agent should return its reservation results in a simple JSON format to the `/api/agent-response` endpoint. This document provides clear examples of the expected response format.

## JSON Response Format

### Basic Structure

```json
{
  "reservationId": "1",        // Required: The ID of the reservation being processed
  "status": "success",         // Required: One of "success", "error", or "not-reached"
  "statusMessage": "Message",  // Optional: Brief status message (required for error/not-reached)
  "confirmedDate": "YYYY-MM-DD", // Optional: The confirmed date (for success)
  "confirmedTime": "HH:MM",    // Optional: The confirmed time (for success)
  "personName": "John Doe",    // Optional: The name confirmed by restaurant
  "partySize": 4,              // Optional: The confirmed party size
  "specialInstructions": "By the window" // Optional: Any special instructions
}
```

### Required Fields

- `reservationId`: String or number identifying the reservation
- `status`: String with one of these values:
  - `"success"`: Reservation was confirmed
  - `"error"`: Restaurant couldn't accommodate the reservation
  - `"not-reached"`: Couldn't connect with the restaurant

### Optional Fields (Recommended for Success Status)

- `confirmedDate`: The date confirmed by the restaurant (YYYY-MM-DD format)
- `confirmedTime`: The time confirmed by the restaurant (HH:MM format)
- `personName`: The name under which the reservation was made
- `partySize`: The number of people in the party (as confirmed)
- `specialInstructions`: Any special instructions provided by the restaurant

## Example Responses

### Success Response

```json
{
  "reservationId": "42",
  "status": "success",
  "confirmedDate": "2025-05-15", 
  "confirmedTime": "19:30",
  "personName": "Jane Smith",
  "partySize": 4,
  "specialInstructions": "Outdoor seating requested, will try to accommodate"
}
```

### Error Response

```json
{
  "reservationId": "42",
  "status": "error",
  "statusMessage": "Fully booked for requested time"
}
```

### Not-Reached Response

```json
{
  "reservationId": "42",
  "status": "not-reached",
  "statusMessage": "No answer after multiple attempts"
}
```

## Notes for Implementation

1. Only the `status` and `reservationId` fields are mandatory
2. For error/not-reached status, include `statusMessage` to explain why
3. All fields are processed as strings except for `partySize` which is converted to a number
4. Date should be in YYYY-MM-DD format and time in HH:MM format