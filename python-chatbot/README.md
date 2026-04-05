# WA Appt OS Python Chatbot

An AI-powered WhatsApp chatbot for appointment booking built with FastAPI and OpenAI GPT.

## Features

- 🤖 **AI-Powered Conversations**: Uses OpenAI GPT for natural language understanding and responses
- 📅 **Appointment Booking**: Complete booking flow with service selection, date/time picking, and confirmation
- 💬 **Interactive Messages**: WhatsApp interactive buttons and lists for better UX
- 🧠 **Intent Recognition**: AI analyzes user messages to understand intent and extract entities
- 📊 **Business Logic**: Handles availability checking, business hours, and booking conflicts
- 🔄 **State Management**: Maintains conversation state across messages
- 🌐 **REST API**: FastAPI-based REST endpoint for integration

## Setup

1. **Install Dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

2. **Configure OpenAI API**:
   - Copy `.env` file and add your OpenAI API key:
   ```
   OPENAI_API_KEY=your_actual_api_key_here
   ```

3. **Run the Server**:
   ```bash
   # Development
   python -m uvicorn app:app --reload --host 127.0.0.1 --port 8001

   # Production
   uvicorn app:app --host 0.0.0.0 --port 8001
   ```

## API Usage

### Health Check
```bash
GET /health
```

### Process Message
```bash
POST /reply
Content-Type: application/json

{
  "business": {
    "name": "My Business",
    "currency": "INR",
    "businessHours": [...],
    "botSettings": {
      "welcomeMessage": "Welcome to our service!"
    }
  },
  "contact": {
    "name": "John Doe",
    "botState": {
      "stage": "awaiting_service"
    }
  },
  "incomingText": "I want to book an appointment",
  "services": [
    {
      "_id": "service1",
      "name": "Hair Cut",
      "price": 500,
      "duration": 60
    }
  ],
  "existingAppointments": [],
  "currentTime": "2024-01-01T10:00:00Z"
}
```

## Conversation Flow

1. **Greeting/Reset**: User starts conversation or says "menu"
2. **Service Selection**: User chooses from available services
3. **Date Selection**: User picks preferred date
4. **Time Selection**: User selects available time slot
5. **Confirmation**: User confirms booking details
6. **Completion**: Booking is created and confirmed

## AI Features

- **Intent Analysis**: Detects user intentions (book, cancel, get info, etc.)
- **Entity Extraction**: Pulls dates, times, and service names from messages
- **Natural Responses**: Generates contextual, friendly replies
- **Fallback Handling**: Graceful degradation when AI is unavailable
- **Conversation Memory**: Maintains context across messages

## Docker Deployment

```bash
# Build image
docker build -t wa-chatbot .

# Run container
docker run -p 8001:8001 --env-file .env wa-chatbot
```

## Environment Variables

- `OPENAI_API_KEY`: Your OpenAI API key (required)
- `OPENAI_MODEL`: GPT model to use (default: gpt-3.5-turbo)
- `OPENAI_MAX_TOKENS`: Max tokens per response (default: 200)

## Testing

The chatbot includes comprehensive validation:
- Business hours checking
- Appointment availability
- Input validation
- State management
- Error handling

Test with various inputs like:
- "I want to book a haircut tomorrow at 2pm"
- "What services do you offer?"
- "Cancel my booking"
- "Menu" or "Start over"