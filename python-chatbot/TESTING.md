# Testing Guide for WA Appt OS Python Chatbot

This guide provides comprehensive testing instructions for the AI-powered WhatsApp appointment booking chatbot.

## 📋 Prerequisites

### 1. Environment Setup
- Python 3.11+ installed
- All dependencies installed via `pip install -r requirements.txt`

### 2. OpenAI API Key
- Obtain an OpenAI API key from [OpenAI Platform](https://platform.openai.com/api-keys)
- Add it to `.env` file:
  ```
  OPENAI_API_KEY=your_actual_openai_api_key_here
  ```

### 3. Server Running
```bash
# From the python-chatbot directory
python -m uvicorn app:app --host 127.0.0.1 --port 8001 --reload
```

## 🧪 Testing Scenarios

### Test 1: Health Check
Verify the server is running and responding.

**Command:**
```bash
curl http://127.0.0.1:8001/health
```

**Expected Response:**
```json
{
  "ok": true,
  "engine": "python",
  "service": "wa-appt-python-chatbot"
}
```

### Test 2: Initial Greeting
Test the chatbot's response to a greeting message.

**Command:**
```bash
curl -X POST http://127.0.0.1:8001/reply \
  -H "Content-Type: application/json" \
  -d '{
    "business": {
      "name": "Test Salon",
      "currency": "INR",
      "businessHours": [
        {
          "day": "monday",
          "isOpen": true,
          "openTime": "09:00",
          "closeTime": "18:00"
        }
      ],
      "botSettings": {
        "welcomeMessage": "Welcome to Test Salon!"
      }
    },
    "contact": {
      "name": "John Doe",
      "botState": {}
    },
    "incomingText": "hello",
    "services": [
      {
        "_id": "service1",
        "name": "Hair Cut",
        "price": 500,
        "duration": 60
      },
      {
        "_id": "service2",
        "name": "Hair Wash",
        "price": 300,
        "duration": 30
      }
    ],
    "existingAppointments": [],
    "currentTime": "2024-01-01T10:00:00Z"
  }'
```

**Expected Response:**
- AI-generated greeting message
- Interactive service selection list
- Next state: `awaiting_service`

### Test 3: Service Selection
Test selecting a service by number.

**Command:**
```bash
curl -X POST http://127.0.0.1:8001/reply \
  -H "Content-Type: application/json" \
  -d '{
    "business": {
      "name": "Test Salon",
      "currency": "INR",
      "businessHours": [
        {
          "day": "monday",
          "isOpen": true,
          "openTime": "09:00",
          "closeTime": "18:00"
        }
      ]
    },
    "contact": {
      "name": "John Doe",
      "botState": {
        "stage": "awaiting_service"
      }
    },
    "incomingText": "1",
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
  }'
```

**Expected Response:**
- Confirmation of service selection
- Date selection buttons (Today, Tomorrow, Custom)
- Next state: `awaiting_date`

### Test 4: Date Selection
Test selecting today's date.

**Command:**
```bash
curl -X POST http://127.0.0.1:8001/reply \
  -H "Content-Type: application/json" \
  -d '{
    "business": {
      "name": "Test Salon",
      "currency": "INR",
      "businessHours": [
        {
          "day": "monday",
          "isOpen": true,
          "openTime": "09:00",
          "closeTime": "18:00"
        }
      ]
    },
    "contact": {
      "name": "John Doe",
      "botState": {
        "stage": "awaiting_date",
        "selectedService": "service1"
      }
    },
    "incomingText": "date_today",
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
  }'
```

**Expected Response:**
- Date confirmation
- Time slot selection buttons
- Next state: `awaiting_time`

### Test 5: Time Selection
Test selecting a time slot.

**Command:**
```bash
curl -X POST http://127.0.0.1:8001/reply \
  -H "Content-Type: application/json" \
  -d '{
    "business": {
      "name": "Test Salon",
      "currency": "INR",
      "businessHours": [
        {
          "day": "monday",
          "isOpen": true,
          "openTime": "09:00",
          "closeTime": "18:00"
        }
      ]
    },
    "contact": {
      "name": "John Doe",
      "botState": {
        "stage": "awaiting_time",
        "selectedService": "service1",
        "selectedDate": "2024-01-01"
      }
    },
    "incomingText": "time_14:00",
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
  }'
```

**Expected Response:**
- Booking summary
- Confirmation buttons (Yes/No)
- Next state: `awaiting_confirmation`

### Test 6: Booking Confirmation
Test confirming the booking.

**Command:**
```bash
curl -X POST http://127.0.0.1:8001/reply \
  -H "Content-Type: application/json" \
  -d '{
    "business": {
      "name": "Test Salon",
      "currency": "INR",
      "businessHours": [
        {
          "day": "monday",
          "isOpen": true,
          "openTime": "09:00",
          "closeTime": "18:00"
        }
      ]
    },
    "contact": {
      "name": "John Doe",
      "botState": {
        "stage": "awaiting_confirmation",
        "selectedService": "service1",
        "selectedDate": "2024-01-01",
        "selectedTime": "14:00"
      }
    },
    "incomingText": "confirm_yes",
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
  }'
```

**Expected Response:**
- Booking confirmation message
- Appointment creation data
- Next state: `idle`

## 🔄 Testing Edge Cases

### Test 7: Invalid Service Selection
**Input:** `"incomingText": "99"` (non-existent service)

**Expected:** Error message + service list re-display

### Test 8: Past Date Selection
**Input:** Select yesterday's date

**Expected:** Error message + date selection re-display

### Test 9: Outside Business Hours
**Input:** Select time 20:00 when business closes at 18:00

**Expected:** Error message + time selection re-display

### Test 10: Slot Already Booked
**Input:** Select time that conflicts with existing appointment

**Expected:** Error message + time selection re-display

### Test 11: Reset Command
**Input:** `"incomingText": "menu"` or `"reset"`

**Expected:** Return to initial service selection

### Test 12: Natural Language Input
**Input:** `"incomingText": "I want to book a haircut for tomorrow at 2pm"`

**Expected:** AI processes natural language and guides through booking

## 🛠️ Testing Tools

### PowerShell Testing Script
Create `test-chatbot.ps1`:

```powershell
# Test script for chatbot
$baseUrl = "http://127.0.0.1:8001"

# Test health
Invoke-WebRequest -Uri "$baseUrl/health" -Method GET

# Test greeting
$body = @{
    business = @{
        name = "Test Salon"
        currency = "INR"
        businessHours = @(@{
            day = "monday"
            isOpen = $true
            openTime = "09:00"
            closeTime = "18:00"
        })
        botSettings = @{
            welcomeMessage = "Welcome to Test Salon!"
        }
    }
    contact = @{
        name = "John Doe"
        botState = @{}
    }
    incomingText = "hello"
    services = @(@{
        _id = "service1"
        name = "Hair Cut"
        price = 500
        duration = 60
    })
    existingAppointments = @()
    currentTime = "2024-01-01T10:00:00Z"
} | ConvertTo-Json -Depth 10

Invoke-WebRequest -Uri "$baseUrl/reply" -Method POST -ContentType "application/json" -Body $body
```

### Python Testing Script
Create `test_chatbot.py`:

```python
import requests
import json

BASE_URL = "http://127.0.0.1:8001"

def test_health():
    response = requests.get(f"{BASE_URL}/health")
    print("Health Test:", response.json())

def test_greeting():
    payload = {
        "business": {
            "name": "Test Salon",
            "currency": "INR",
            "businessHours": [
                {
                    "day": "monday",
                    "isOpen": True,
                    "openTime": "09:00",
                    "closeTime": "18:00"
                }
            ],
            "botSettings": {
                "welcomeMessage": "Welcome to Test Salon!"
            }
        },
        "contact": {
            "name": "John Doe",
            "botState": {}
        },
        "incomingText": "hello",
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

    response = requests.post(f"{BASE_URL}/reply", json=payload)
    print("Greeting Test:", response.json())

if __name__ == "__main__":
    test_health()
    test_greeting()
```

## 🔍 Debugging

### Common Issues

1. **Server not starting:**
   - Check if port 8001 is available
   - Verify all dependencies are installed
   - Check Python version (3.11+ required)

2. **OpenAI API errors:**
   - Verify API key in `.env` file
   - Check API quota and billing
   - AI features will fallback gracefully if API fails

3. **Import errors:**
   - Run `pip install -r requirements.txt`
   - Check Python path

4. **Business logic errors:**
   - Verify business hours format
   - Check service data structure
   - Validate date/time formats

### Logs
- Server logs appear in terminal when running with `--reload`
- Add print statements in `app.py` for debugging
- Check response JSON for state management issues

## 📊 Performance Testing

### Load Testing
```bash
# Install locust for load testing
pip install locust

# Create locustfile.py and run
locust -f locustfile.py
```

### Response Time Testing
```bash
# Test response time
time curl -X POST http://127.0.0.1:8001/reply -H "Content-Type: application/json" -d '{"test": "data"}'
```

## ✅ Success Criteria

- [ ] Health endpoint returns 200 OK
- [ ] All conversation flows work end-to-end
- [ ] AI responses are contextual and helpful
- [ ] State management maintains conversation context
- [ ] Business logic validates properly
- [ ] Error handling is graceful
- [ ] Interactive messages format correctly for WhatsApp
- [ ] Appointment creation includes all required data

## 🚀 Production Testing Checklist

- [ ] Test with real WhatsApp webhook data
- [ ] Verify in multiple timezones
- [ ] Test with various business configurations
- [ ] Validate appointment conflicts
- [ ] Check performance under load
- [ ] Test AI fallback when API unavailable
- [ ] Verify Docker container deployment