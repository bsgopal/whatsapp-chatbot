from datetime import datetime, timedelta
from typing import Any
import os
import re
from fastapi import FastAPI
from pydantic import BaseModel
import openai
from dotenv import load_dotenv

load_dotenv()

BOT_RESET_WORDS = {"reset", "restart", "menu", "start", "hi", "hello"}

app = FastAPI(title="WA Appt OS Python Chatbot", version="1.0.0")

# Initialize OpenAI client
openai_client = None
try:
    if os.getenv("OPENAI_API_KEY"):
        openai_client = openai.OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
    else:
        print("Warning: OPENAI_API_KEY not set. AI features will be disabled.")
except Exception as e:
    print(f"Warning: Failed to initialize OpenAI client: {e}. AI features will be disabled.")


def analyze_user_intent(text: str, context: dict[str, Any]) -> dict[str, Any]:
    """Use AI to analyze user intent and extract relevant information."""
    if not openai_client or not text.strip():
        return {"intent": "unknown", "confidence": 0.0}

    try:
        system_prompt = f"""
        You are an AI assistant for a WhatsApp appointment booking system. Analyze the user's message and determine their intent.

        Current conversation context:
        - Stage: {context.get('stage', 'unknown')}
        - Selected service: {context.get('selectedService', 'none')}
        - Selected date: {context.get('selectedDate', 'none')}
        - Selected time: {context.get('selectedTime', 'none')}

        Available intents:
        - book_appointment: User wants to book an appointment
        - change_service: User wants to change their selected service
        - change_date: User wants to change the date
        - change_time: User wants to change the time
        - confirm_booking: User is confirming a booking
        - cancel_booking: User wants to cancel
        - get_info: User is asking for information
        - reset: User wants to start over
        - greeting: Simple greeting or introduction

        Extract any relevant entities like dates, times, service names, etc.

        Return a JSON object with:
        - intent: the primary intent
        - confidence: confidence score (0-1)
        - entities: any extracted entities
        - response_suggestion: suggested response text
        """

        response = openai_client.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": text}
            ],
            temperature=0.3,
            max_tokens=300
        )

        result = response.choices[0].message.content.strip()
        # Parse JSON response
        try:
            import json
            analysis = json.loads(result)
            return analysis
        except:
            # Fallback parsing
            return {"intent": "unknown", "confidence": 0.5, "entities": {}, "response_suggestion": ""}

    except Exception as e:
        print(f"AI analysis error: {e}")
        return {"intent": "unknown", "confidence": 0.0}


def generate_ai_response(user_message: str, context: dict[str, Any], business_data: dict[str, Any], services: list[dict[str, Any]]) -> str:
    """Generate an AI-powered response based on context and user message."""
    if not openai_client:
        return "I'm here to help you book an appointment. How can I assist you today?"

    try:
        business_name = business_data.get('name', 'our business')
        currency = business_data.get('currency', 'INR')

        services_text = "\n".join([
            f"- {s.get('name', 'Service')} ({format_currency(s.get('price'), currency)}, {s.get('duration', 0)} mins)"
            for s in services
        ])

        system_prompt = f"""
        You are a friendly, professional WhatsApp chatbot for {business_name}, an appointment booking service.

        Business Information:
        - Name: {business_name}
        - Currency: {currency}
        - Services: {services_text}

        Current Context:
        - Stage: {context.get('stage', 'unknown')}
        - Selected service: {context.get('selectedService', 'none')}
        - Selected date: {context.get('selectedDate', 'none')}
        - Selected time: {context.get('selectedTime', 'none')}

        Guidelines:
        - Be friendly and conversational
        - Keep responses concise for WhatsApp
        - Use emojis appropriately
        - Guide users through the booking process naturally
        - If user seems confused, offer to start over
        - Always be helpful and patient

        Generate a natural, helpful response to continue the conversation.
        """

        response = openai_client.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_message}
            ],
            temperature=0.7,
            max_tokens=200
        )

        return response.choices[0].message.content.strip()

    except Exception as e:
        print(f"AI response generation error: {e}")
        return "I'm here to help you book an appointment. What would you like to do?"


def extract_entities_with_ai(text: str) -> dict[str, Any]:
    """Use AI to extract entities like dates, times, services from user text."""
    if not openai_client or not text.strip():
        return {}

    try:
        system_prompt = """
        Extract relevant entities from the user's message for appointment booking.
        Look for:
        - dates (in any format)
        - times (in any format)
        - service names or numbers
        - confirmation words (yes, no, confirm, cancel)
        - reset words (start over, menu, reset)

        Return a JSON object with extracted entities.
        """

        response = openai_client.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": text}
            ],
            temperature=0.2,
            max_tokens=150
        )

        result = response.choices[0].message.content.strip()
        try:
            import json
            return json.loads(result)
        except:
            return {}

    except Exception as e:
        print(f"Entity extraction error: {e}")
        return {}


class ReplyRequest(BaseModel):
    business: dict[str, Any]
    contact: dict[str, Any]
    incomingText: str | None = ""
    services: list[dict[str, Any]] = []
    existingAppointments: list[dict[str, Any]] = []
    currentTime: str | None = None


def normalize_text(text: str | None) -> str:
    return (text or "").strip()


def format_currency(amount: Any, currency: str = "INR") -> str:
    try:
        value = int(float(amount or 0))
    except (TypeError, ValueError):
        value = 0
    return f"{currency} {value}"


def format_date_label(date_value: datetime) -> str:
    return date_value.strftime("%A, %B %d, %Y")


def build_service_menu(business: dict[str, Any], services: list[dict[str, Any]]) -> str:
    business_name = business.get("name") or "our business"
    welcome = (
        business.get("botSettings", {}).get("welcomeMessage")
        or f"Hello! Welcome to {business_name}."
    )
    currency = business.get("currency") or "INR"
    lines = [
        f"{index}. {service.get('name', 'Service')} - "
        f"{format_currency(service.get('price'), currency)} "
        f"({service.get('duration', 0)} mins)"
        for index, service in enumerate(services, start=1)
    ]
    return (
        f"{welcome}\n\n"
        f"Please choose a service by sending the number:\n"
        f"{chr(10).join(lines)}\n\n"
        f'You can type "menu" anytime to restart.'
    )

def build_service_list_interactive(business: dict[str, Any], services: list[dict[str, Any]]) -> tuple[str, dict[str, Any]]:
    business_name = business.get("name") or "Metro Booking Service"
    welcome = (
        business.get("botSettings", {}).get("welcomeMessage")
        or f"🚇 Welcome to {business_name}\n\nYour trusted metro ticket booking assistant."
    )
    currency = business.get("currency") or "INR"
    
    sections = [{
        "title": "🎫 Available Services",
        "rows": [
            {
                "id": f"service_{index + 1}",
                "title": service.get('name', 'Service'),
                "description": f"💰 {format_currency(service.get('price'), currency)} • ⏱️ {service.get('duration', 0)} mins"
            }
            for index, service in enumerate(services)
        ]
    }]
    
    interactive = {
        "type": "list",
        "header": {
            "type": "text",
            "text": f"🚇 {business_name}"
        },
        "body": {
            "text": f"{welcome}\n\n📋 Please select your preferred service:"
        },
        "footer": {
            "text": "💡 Type 'menu' anytime to restart booking"
        },
        "action": {
            "button": "Choose Service 📝",
            "sections": sections
        }
    }
    
    return welcome, interactive

def parse_service_selection(text: str, services: list[dict[str, Any]]) -> dict[str, Any] | None:
    clean = normalize_text(text).lower()
    if not clean:
        return None

    # Handle interactive list replies like "service_1"
    if clean.startswith("service_"):
        try:
            index = int(clean.split("_")[1]) - 1
            if 0 <= index < len(services):
                return services[index]
        except (ValueError, IndexError):
            pass
        return None

    if clean.isdigit():
        index = int(clean)
        if 1 <= index <= len(services):
            return services[index - 1]

    for service in services:
        name = str(service.get("name") or "").lower()
        if name == clean or clean in name:
            return service
    return None


def build_time_quick_replies(selected_date: str, business: dict[str, Any]) -> tuple[str, dict[str, Any]]:
    # Generate time slots based on business hours
    day_name = get_business_day(datetime.strptime(selected_date, "%Y-%m-%d"))
    business_hours = business.get("businessHours") or []
    hours = next((item for item in business_hours if item.get("day") == day_name), None)
    
    if not hours or not hours.get("isOpen"):
        return "❌ No service available on this day. Please select another date.", {}
    
    open_time = hours.get("openTime", "09:00")
    close_time = hours.get("closeTime", "18:00")
    
    # Parse times
    open_hour = int(open_time.split(":")[0])
    close_hour = int(close_time.split(":")[0])
    
    # Generate common time slots
    time_slots = []
    for hour in range(open_hour, min(close_hour, open_hour + 8)):  # Show next 8 hours
        time_slots.extend([
            f"{hour:02d}:00",
            f"{hour:02d}:30"
        ])
    
    # Take first 6 slots for buttons (WhatsApp limit)
    display_slots = time_slots[:6]
    
    buttons = [
        {
            "type": "reply",
            "reply": {
                "id": f"time_{slot}",
                "title": f"🕐 {slot}"
            }
        }
        for slot in display_slots
    ]
    
    # Add custom time option
    buttons.append({
        "type": "reply",
        "reply": {
            "id": "time_custom",
            "title": "🕐 Custom Time"
        }
    })
    
    body_text = f"🗓️ Selected Date: {format_date_label(datetime.strptime(selected_date, '%Y-%m-%d'))}\n\n⏰ Please choose your preferred time slot:"
    
    interactive = {
        "type": "button",
        "body": {
            "text": body_text
        },
        "action": {
            "buttons": buttons
        }
    }
    
    return body_text, interactive


def parse_date_input(text: str, now: datetime) -> datetime | None:
    clean = normalize_text(text).lower()
    if not clean:
        return None

    base = datetime(now.year, now.month, now.day)
    if clean == "today":
        return base
    if clean == "tomorrow":
        return base + timedelta(days=1)

    for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%d-%m-%Y"):
        try:
            parsed = datetime.strptime(clean, fmt)
            return datetime(parsed.year, parsed.month, parsed.day)
        except ValueError:
            continue
    return None


def parse_time_input(text: str) -> str | None:
    clean = normalize_text(text).lower()
    if not clean:
        return None

    for fmt in ("%H:%M", "%I %p", "%I:%M %p", "%I%p", "%I:%M%p"):
        try:
            parsed = datetime.strptime(clean, fmt)
            return parsed.strftime("%H:%M")
        except ValueError:
            continue
    return None


def build_date_quick_replies(selected_service_name: str, now: datetime) -> tuple[str, dict[str, Any]]:
    today = now.replace(hour=0, minute=0, second=0, microsecond=0)
    tomorrow = today + timedelta(days=1)
    day_after = today + timedelta(days=2)
    
    buttons = [
        {
            "type": "reply",
            "reply": {
                "id": "date_today",
                "title": f"📅 Today ({today.strftime('%d %b')})"
            }
        },
        {
            "type": "reply",
            "reply": {
                "id": "date_tomorrow", 
                "title": f"📅 Tomorrow ({tomorrow.strftime('%d %b')})"
            }
        },
        {
            "type": "reply",
            "reply": {
                "id": "date_day_after",
                "title": f"📅 {day_after.strftime('%d %b')} ({day_after.strftime('%a')})"
            }
        },
        {
            "type": "reply",
            "reply": {
                "id": "date_custom",
                "title": "📅 Custom Date"
            }
        }
    ]
    
    body_text = f"🎫 Selected: {selected_service_name}\n\n🗓️ Please choose your preferred travel date:"
    
    interactive = {
        "type": "button",
        "body": {
            "text": body_text
        },
        "action": {
            "buttons": buttons
        }
    }
    
    return body_text, interactive


def combine_date_and_time(date_value: datetime, time_value: str) -> datetime:
    hours, minutes = [int(part) for part in time_value.split(":")]
    return datetime(
        date_value.year,
        date_value.month,
        date_value.day,
        hours,
        minutes,
    )


def get_business_day(date_value: datetime) -> str:
    return date_value.strftime("%A").lower()


def is_within_business_hours(business: dict[str, Any], scheduled_at: datetime, duration: int) -> bool:
    day_name = get_business_day(scheduled_at)
    business_hours = business.get("businessHours") or []
    hours = next((item for item in business_hours if item.get("day") == day_name), None)
    if not hours or not hours.get("isOpen"):
        return False

    end_at = scheduled_at + timedelta(minutes=duration)
    start = scheduled_at.strftime("%H:%M")
    end = end_at.strftime("%H:%M")
    if start < str(hours.get("openTime") or "") or end > str(hours.get("closeTime") or ""):
        return False

    break_start = hours.get("breakStart")
    break_end = hours.get("breakEnd")
    if break_start and break_end and start < break_end and end > break_start:
        return False

    return True


def is_slot_available(existing_appointments: list[dict[str, Any]], scheduled_at: datetime, duration: int) -> bool:
    end_at = scheduled_at + timedelta(minutes=duration)
    for item in existing_appointments:
        status = item.get("status")
        if status in {"cancelled", "no_show"}:
            continue

        start_raw = item.get("scheduledAt")
        end_raw = item.get("endAt")
        if not start_raw or not end_raw:
            continue

        existing_start = datetime.fromisoformat(str(start_raw).replace("Z", "+00:00")).replace(tzinfo=None)
        existing_end = datetime.fromisoformat(str(end_raw).replace("Z", "+00:00")).replace(tzinfo=None)
        if existing_start < end_at and existing_end > scheduled_at:
            return False
    return True


def build_state(stage: str, selected_service: Any = None, selected_date: Any = None, selected_time: Any = None) -> dict[str, Any]:
    return {
        "stage": stage,
        "selectedService": selected_service,
        "selectedDate": selected_date,
        "selectedTime": selected_time,
        "lastIntent": "book_appointment",
        "lastUpdatedAt": datetime.utcnow().isoformat() + "Z",
    }


def make_response(reply_text: str, next_state: dict[str, Any], preferred_service_id: Any = None, create_appointment: dict[str, Any] | None = None, message_type: str = "text", interactive: dict[str, Any] | None = None) -> dict[str, Any]:
    return {
        "reply_text": reply_text,
        "next_state": next_state,
        "preferred_service_id": preferred_service_id,
        "create_appointment": create_appointment,
        "message_type": message_type,
        "interactive": interactive,
    }


@app.get("/health")
def health() -> dict[str, Any]:
    return {"ok": True, "engine": "python", "service": "wa-appt-python-chatbot"}


@app.post("/reply")
def reply(payload: ReplyRequest) -> dict[str, Any]:
    business = payload.business or {}
    contact = payload.contact or {}
    services = payload.services or []
    incoming_text = normalize_text(payload.incomingText)
    bot_state = contact.get("botState") or {}
    now = datetime.fromisoformat((payload.currentTime or datetime.utcnow().isoformat()).replace("Z", "+00:00")).replace(tzinfo=None)

    if not services:
        ai_response = generate_ai_response(
            incoming_text,
            bot_state,
            business,
            services
        )
        return make_response(
            f"Hello! {business.get('name') or 'This business'} has no bookable services configured yet. Please contact the business directly.\n\n{ai_response}",
            build_state("idle"),
        )

    lower = incoming_text.lower()
    should_reset = (
        not bot_state.get("stage")
        or bot_state.get("stage") == "idle"
        or lower in BOT_RESET_WORDS
        or "book" in lower
        or "appointment" in lower
    )

    # Use AI to analyze intent
    intent_analysis = analyze_user_intent(incoming_text, bot_state)
    intent = intent_analysis.get("intent", "unknown")
    confidence = intent_analysis.get("confidence", 0.0)

    # If AI detects reset intent with high confidence, reset
    if intent == "reset" and confidence > 0.7:
        should_reset = True

    if should_reset:
        reply_text, interactive = build_service_list_interactive(business, services)
        ai_greeting = generate_ai_response(
            f"User said: {incoming_text}",
            {"stage": "greeting"},
            business,
            services
        )
        return make_response(
            f"{ai_greeting}\n\n{reply_text}",
            build_state("awaiting_service"),
            message_type="interactive",
            interactive=interactive
        )

    stage = bot_state.get("stage") or "awaiting_service"

    # Handle different intents detected by AI
    if intent == "get_info" and confidence > 0.6:
        ai_info_response = generate_ai_response(
            incoming_text,
            bot_state,
            business,
            services
        )
        return make_response(
            ai_info_response,
            bot_state,  # Keep current state
        )

    if intent == "cancel_booking" and confidence > 0.7:
        ai_cancel_response = generate_ai_response(
            "User wants to cancel their booking",
            bot_state,
            business,
            services
        )
        reply_text, interactive = build_service_list_interactive(business, services)
        return make_response(
            f"{ai_cancel_response}\n\n{reply_text}",
            build_state("awaiting_service"),
            message_type="interactive",
            interactive=interactive
        )

    if stage == "awaiting_service":
        service = parse_service_selection(incoming_text, services)

        # If no service found but AI detected booking intent, try to extract service from AI entities
        if not service and intent == "book_appointment":
            entities = intent_analysis.get("entities", {})
            service_name = entities.get("service")
            if service_name:
                service = next((s for s in services if service_name.lower() in str(s.get("name", "")).lower()), None)

        if not service:
            ai_help_response = generate_ai_response(
                f"User said: {incoming_text}. I couldn't find a matching service.",
                bot_state,
                business,
                services
            )
            reply_text, interactive = build_service_list_interactive(business, services)
            return make_response(
                f"{ai_help_response}\n\n{reply_text}",
                build_state("awaiting_service"),
                message_type="interactive",
                interactive=interactive
            )

        reply_text, interactive = build_date_quick_replies(service.get('name'), now)
        ai_service_selected = generate_ai_response(
            f"Great! You selected {service.get('name')}. Now let's choose a date.",
            bot_state,
            business,
            services
        )
        return make_response(
            f"{ai_service_selected}\n\n{reply_text}",
            build_state("awaiting_date", selected_service=service.get("_id")),
            preferred_service_id=service.get("_id"),
            message_type="interactive",
            interactive=interactive
        )

    if stage == "awaiting_date":
        selected_service = next(
            (service for service in services if str(service.get("_id")) == str(bot_state.get("selectedService"))),
            None,
        )
        if not selected_service:
            reply_text, interactive = build_service_list_interactive(business, services)
            return make_response(
                "I lost track of your selected service. Let's start over.\n\n" + reply_text,
                build_state("awaiting_service"),
                message_type="interactive",
                interactive=interactive
            )

        clean = normalize_text(incoming_text).lower()
        picked_date = None

        # Try AI entity extraction for dates
        entities = extract_entities_with_ai(incoming_text)
        if entities.get("date"):
            picked_date = parse_date_input(entities["date"], now)

        if clean == "date_today":
            picked_date = now.replace(hour=0, minute=0, second=0, microsecond=0)
        elif clean == "date_tomorrow":
            picked_date = (now + timedelta(days=1)).replace(hour=0, minute=0, second=0, microsecond=0)
        elif clean == "date_day_after":
            picked_date = (now + timedelta(days=2)).replace(hour=0, minute=0, second=0, microsecond=0)
        elif clean == "date_custom":
            ai_date_help = generate_ai_response(
                "User wants to enter a custom date",
                bot_state,
                business,
                services
            )
            return make_response(
                f"{ai_date_help}\n\n📅 Please enter your preferred date in YYYY-MM-DD format.\nExample: {now.strftime('%Y-%m-%d')}\n\nYou can also type 'today' or 'tomorrow'.",
                build_state(
                    "awaiting_date",
                    selected_service=bot_state.get("selectedService"),
                ),
            )
        else:
            picked_date = picked_date or parse_date_input(incoming_text, now)

        if not picked_date:
            ai_date_error = generate_ai_response(
                f"User said: {incoming_text}. I couldn't understand the date.",
                bot_state,
                business,
                services
            )
            reply_text, interactive = build_date_quick_replies(selected_service.get('name'), now)
            return make_response(
                f"{ai_date_error}\n\n{reply_text}",
                build_state(
                    "awaiting_date",
                    selected_service=bot_state.get("selectedService"),
                ),
                message_type="interactive",
                interactive=interactive
            )

        if picked_date < datetime(now.year, now.month, now.day):
            ai_past_date = generate_ai_response(
                "User selected a date in the past",
                bot_state,
                business,
                services
            )
            reply_text, interactive = build_date_quick_replies(selected_service.get('name'), now)
            return make_response(
                f"{ai_past_date}\n\n❌ That date is in the past. Please choose a future date.\n\n{reply_text}",
                build_state(
                    "awaiting_date",
                    selected_service=bot_state.get("selectedService"),
                ),
                message_type="interactive",
                interactive=interactive
            )

        reply_text, interactive = build_time_quick_replies(picked_date.strftime("%Y-%m-%d"), business)
        if not interactive:
            ai_no_times = generate_ai_response(
                "No available times for selected date",
                bot_state,
                business,
                services
            )
            reply_text, interactive = build_date_quick_replies(selected_service.get('name'), now)
            return make_response(
                f"{ai_no_times}\n\n{reply_text}\n\nPlease select another date.",
                build_state(
                    "awaiting_date",
                    selected_service=bot_state.get("selectedService"),
                ),
                message_type="interactive",
                interactive=interactive
            )

        ai_date_selected = generate_ai_response(
            f"Great! You selected {format_date_label(picked_date)}. Now let's choose a time.",
            bot_state,
            business,
            services
        )
        return make_response(
            f"{ai_date_selected}\n\n{reply_text}",
            build_state(
                "awaiting_time",
                selected_service=bot_state.get("selectedService"),
                selected_date=picked_date.strftime("%Y-%m-%d"),
            ),
            message_type="interactive",
            interactive=interactive
        )

    if stage == "awaiting_time":
        selected_service = next(
            (service for service in services if str(service.get("_id")) == str(bot_state.get("selectedService"))),
            None,
        )
        selected_date_value = bot_state.get("selectedDate")
        
        if not selected_service or not selected_date_value:
            reply_text, interactive = build_service_list_interactive(business, services)
            return make_response(
                "I lost track of your booking details. Let's start over.\n\n" + reply_text,
                build_state("awaiting_service"),
                message_type="interactive",
                interactive=interactive
            )

        clean = normalize_text(incoming_text).lower()
        selected_time = None

        # Try AI entity extraction for times
        entities = extract_entities_with_ai(incoming_text)
        if entities.get("time"):
            selected_time = parse_time_input(entities["time"])
        
        if clean.startswith("time_"):
            time_part = clean[5:]  # Remove "time_" prefix
            if time_part == "custom":
                ai_time_help = generate_ai_response(
                    "User wants to enter a custom time",
                    bot_state,
                    business,
                    services
                )
                return make_response(
                    f"{ai_time_help}\n\n🕐 Please enter your preferred time in HH:MM format.\nExample: 14:30 or 2:30 PM\n\n⏰ Business hours: Check our operating times.",
                    build_state(
                        "awaiting_time",
                        selected_service=selected_service.get("_id"),
                        selected_date=selected_date_value,
                    ),
                )
            else:
                selected_time = time_part
        else:
            selected_time = selected_time or parse_time_input(incoming_text)

        if not selected_time:
            ai_time_error = generate_ai_response(
                f"User said: {incoming_text}. I couldn't understand the time.",
                bot_state,
                business,
                services
            )
            reply_text, interactive = build_time_quick_replies(selected_date_value, business)
            return make_response(
                f"{ai_time_error}\n\n❌ Please select a valid time slot.\n\n{reply_text}",
                build_state(
                    "awaiting_time",
                    selected_service=selected_service.get("_id"),
                    selected_date=selected_date_value,
                ),
                message_type="interactive",
                interactive=interactive
            )

        selected_date = datetime.strptime(selected_date_value, "%Y-%m-%d")
        scheduled_at = combine_date_and_time(selected_date, selected_time)
        if scheduled_at <= now:
            ai_past_time = generate_ai_response(
                "User selected a time in the past",
                bot_state,
                business,
                services
            )
            reply_text, interactive = build_time_quick_replies(selected_date_value, business)
            return make_response(
                f"{ai_past_time}\n\n❌ That time has already passed. Please choose another time.\n\n{reply_text}",
                build_state(
                    "awaiting_time",
                    selected_service=selected_service.get("_id"),
                    selected_date=selected_date_value,
                ),
                message_type="interactive",
                interactive=interactive
            )

        duration = int(selected_service.get("duration") or 0)
        if not is_within_business_hours(business, scheduled_at, duration):
            ai_outside_hours = generate_ai_response(
                "Selected time is outside business hours",
                bot_state,
                business,
                services
            )
            reply_text, interactive = build_time_quick_replies(selected_date_value, business)
            return make_response(
                f"{ai_outside_hours}\n\n❌ That time is outside business hours. Please choose another time slot.\n\n{reply_text}",
                build_state(
                    "awaiting_time",
                    selected_service=selected_service.get("_id"),
                    selected_date=selected_date_value,
                ),
                message_type="interactive",
                interactive=interactive
            )

        if not is_slot_available(payload.existingAppointments, scheduled_at, duration):
            ai_slot_taken = generate_ai_response(
                "Selected time slot is already booked",
                bot_state,
                business,
                services
            )
            reply_text, interactive = build_time_quick_replies(selected_date_value, business)
            return make_response(
                f"{ai_slot_taken}\n\n❌ That slot is already booked. Please choose another time.\n\n{reply_text}",
                build_state(
                    "awaiting_time",
                    selected_service=selected_service.get("_id"),
                    selected_date=selected_date_value,
                ),
                message_type="interactive",
                interactive=interactive
            )

        # Create booking summary
        currency = business.get("currency") or "INR"
        summary = (
            f"🎫 *Booking Summary*\n\n"
            f"📋 Service: {selected_service.get('name')}\n"
            f"💰 Price: {format_currency(selected_service.get('price'), currency)}\n"
            f"🗓️ Date: {format_date_label(selected_date)}\n"
            f"⏰ Time: {selected_time}\n"
            f"⏱️ Duration: {duration} minutes\n\n"
            f"✅ Confirm booking?"
        )
        
        buttons = [
            {
                "type": "reply",
                "reply": {
                    "id": "confirm_yes",
                    "title": "✅ Yes, Confirm"
                }
            },
            {
                "type": "reply",
                "reply": {
                    "id": "confirm_no",
                    "title": "❌ No, Change"
                }
            }
        ]
        
        interactive = {
            "type": "button",
            "body": {
                "text": summary
            },
            "action": {
                "buttons": buttons
            }
        }

        ai_confirmation = generate_ai_response(
            f"Perfect! I've prepared your booking summary for {selected_service.get('name')} on {format_date_label(selected_date)} at {selected_time}. Ready to confirm?",
            bot_state,
            business,
            services
        )
        return make_response(
            f"{ai_confirmation}\n\n{summary}",
            build_state(
                "awaiting_confirmation",
                selected_service=selected_service.get("_id"),
                selected_date=selected_date_value,
                selected_time=selected_time,
            ),
            message_type="interactive",
            interactive=interactive
        )

    if stage == "awaiting_confirmation":
        selected_service = next(
            (service for service in services if str(service.get("_id")) == str(bot_state.get("selectedService"))),
            None,
        )
        selected_date_value = bot_state.get("selectedDate")
        selected_time_value = bot_state.get("selectedTime")

        if not selected_service or not selected_date_value or not selected_time_value:
            reply_text, interactive = build_service_list_interactive(business, services)
            return make_response(
                "I lost track of your booking details. Let's start over.\n\n" + reply_text,
                build_state("awaiting_service"),
                message_type="interactive",
                interactive=interactive
            )

        clean = normalize_text(incoming_text).lower()
        
        # Use AI to detect confirmation intent
        if intent == "confirm_booking" or clean == "confirm_yes" or clean in ["yes", "y", "confirm", "ok", "sure"]:
            customer_name = contact.get("name") or "Valued Customer"
            selected_date = datetime.strptime(selected_date_value, "%Y-%m-%d")
            scheduled_at = combine_date_and_time(selected_date, selected_time_value)
            duration = int(selected_service.get("duration") or 0)
            
            # Double-check availability
            if not is_slot_available(payload.existingAppointments, scheduled_at, duration):
                ai_slot_gone = generate_ai_response(
                    "Sorry, this slot was just booked by another customer",
                    bot_state,
                    business,
                    services
                )
                return make_response(
                    f"❌ {ai_slot_gone}. Please start over.",
                    build_state("idle"),
                )

            currency = business.get("currency") or "INR"
            confirmation_msg = (
                f"🎉 *Booking Confirmed!*\n\n"
                f"👤 Customer: {customer_name}\n"
                f"🎫 Service: {selected_service.get('name')}\n"
                f"💰 Amount: {format_currency(selected_service.get('price'), currency)}\n"
                f"🗓️ Date: {format_date_label(selected_date)}\n"
                f"⏰ Time: {selected_time_value}\n"
                f"📍 Location: {business.get('name')}\n\n"
                f"✅ Your booking is confirmed!\n"
                f"📱 You'll receive a reminder before your appointment.\n\n"
                f"💡 Need to make changes? Contact us directly."
            )

            ai_booking_confirmed = generate_ai_response(
                f"Excellent! Your booking for {selected_service.get('name')} has been confirmed. We're looking forward to seeing you!",
                {"stage": "completed"},
                business,
                services
            )
            
            return make_response(
                f"{ai_booking_confirmed}\n\n{confirmation_msg}",
                build_state("idle"),
                preferred_service_id=selected_service.get("_id"),
                create_appointment={
                    "service_id": selected_service.get("_id"),
                    "scheduled_at": scheduled_at.isoformat(),
                    "customer_name": customer_name,
                },
            )
        
        elif intent == "cancel_booking" or clean == "confirm_no" or clean in ["no", "n", "cancel", "change"]:
            ai_cancel_response = generate_ai_response(
                "User decided not to confirm the booking",
                bot_state,
                business,
                services
            )
            reply_text, interactive = build_service_list_interactive(business, services)
            return make_response(
                f"{ai_cancel_response}\n\n❌ Booking cancelled. Let's start over!\n\n{reply_text}",
                build_state("awaiting_service"),
                message_type="interactive",
                interactive=interactive
            )
        
        else:
            # Re-show confirmation with AI help
            ai_confusion_help = generate_ai_response(
                f"User said: {incoming_text}. They seem confused about confirming the booking.",
                bot_state,
                business,
                services
            )
            currency = business.get("currency") or "INR"
            selected_date = datetime.strptime(selected_date_value, "%Y-%m-%d")
            summary = (
                f"🎫 *Booking Summary*\n\n"
                f"📋 Service: {selected_service.get('name')}\n"
                f"💰 Price: {format_currency(selected_service.get('price'), currency)}\n"
                f"🗓️ Date: {format_date_label(selected_date)}\n"
                f"⏰ Time: {selected_time_value}\n"
                f"⏱️ Duration: {selected_service.get('duration', 0)} minutes\n\n"
                f"✅ Confirm booking?"
            )
            
            buttons = [
                {
                    "type": "reply",
                    "reply": {
                        "id": "confirm_yes",
                        "title": "✅ Yes, Confirm"
                    }
                },
                {
                    "type": "reply",
                    "reply": {
                        "id": "confirm_no",
                        "title": "❌ No, Change"
                    }
                }
            ]
            
            interactive = {
                "type": "button",
                "body": {
                    "text": summary
                },
                "action": {
                    "buttons": buttons
                }
            }
            
            return make_response(
                f"{ai_confusion_help}\n\n❓ Please confirm your booking.\n\n{summary}",
                build_state(
                    "awaiting_confirmation",
                    selected_service=selected_service.get("_id"),
                    selected_date=selected_date_value,
                    selected_time=selected_time_value,
                ),
                message_type="interactive",
                interactive=interactive
            )

    if stage == "awaiting_name":
        selected_service = next(
            (service for service in services if str(service.get("_id")) == str(bot_state.get("selectedService"))),
            None,
        )
        selected_date_value = bot_state.get("selectedDate")
        selected_time_value = bot_state.get("selectedTime")

        if not selected_service or not selected_date_value or not selected_time_value:
            return make_response(
                build_service_menu(business, services),
                build_state("awaiting_service"),
            )

        selected_date = datetime.strptime(selected_date_value, "%Y-%m-%d")
        scheduled_at = combine_date_and_time(selected_date, selected_time_value)
        duration = int(selected_service.get("duration") or 0)
        if not is_slot_available(payload.existingAppointments, scheduled_at, duration):
            return make_response(
                "That slot was just taken. Please send another time.",
                build_state(
                    "awaiting_time",
                    selected_service=selected_service.get("_id"),
                    selected_date=selected_date_value,
                ),
            )

        customer_name = normalize_text(incoming_text) or contact.get("name") or "Customer"
        return make_response(
            (
                "Your appointment is booked.\n\n"
                f"Name: {customer_name}\n"
                f"Service: {selected_service.get('name')}\n"
                f"Date: {format_date_label(selected_date)}\n"
                f"Time: {selected_time_value}\n"
                f"Status: {'confirmed' if business.get('botSettings', {}).get('autoConfirm') else 'pending'}\n\n"
                "Reply \"menu\" if you want to make another booking."
            ),
            build_state("idle"),
            preferred_service_id=selected_service.get("_id"),
            create_appointment={
                "service_id": selected_service.get("_id"),
                "scheduled_at": scheduled_at.isoformat(),
                "customer_name": customer_name,
            },
        )

    return make_response(build_service_menu(business, services), build_state("awaiting_service"))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8001, reload=True)
