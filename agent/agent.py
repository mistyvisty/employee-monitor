import time
import requests
import pygetwindow as gw
import pyautogui
from PIL import Image, ImageFilter
from datetime import datetime, timedelta

API_URL = "http://localhost:4000"
EMPLOYEE_ID = 1  # In a real system, this comes from a login step
IDLE_THRESHOLD_SEC = 5 * 60
SCREENSHOT_INTERVAL_SEC = 10 * 60
ACTIVITY_INTERVAL_SEC = 30

# Browsers we watch for website usage tracking
BROWSER_APPS = ["Google Chrome", "Microsoft Edge", "Firefox", "Opera"]

# Best-effort domain detection from window title keywords.
# (Getting the real URL needs a browser extension; this is the
#  no-extra-dependencies approach that works from the window title alone.)
KNOWN_DOMAINS = {
    "youtube": "youtube.com",
    "github": "github.com",
    "stack overflow": "stackoverflow.com",
    "stackoverflow": "stackoverflow.com",
    "chatgpt": "chatgpt.com",
    "google search": "google.com",
    "facebook": "facebook.com",
    "instagram": "instagram.com",
    "netflix": "netflix.com",
    "linkedin": "linkedin.com",
}

last_input_check_pos = pyautogui.position()
last_input_time = datetime.now()
is_idle = False
idle_start_time = None


def log_login():
    resp = requests.post(f"{API_URL}/session/login", json={"employee_id": EMPLOYEE_ID})
    return resp.json()["session_id"]


def log_logout(session_id):
    requests.post(f"{API_URL}/session/logout", json={"session_id": session_id})


def get_active_window_info():
    try:
        window = gw.getActiveWindow()
        if window is None:
            return "Unknown", ""
        return window.title.split(" - ")[-1] or "Unknown", window.title
    except Exception:
        return "Unknown", ""


def send_activity():
    app_name, window_title = get_active_window_info()
    requests.post(f"{API_URL}/activity", json={
        "employee_id": EMPLOYEE_ID,
        "app_name": app_name,
        "window_title": window_title,
        "timestamp": datetime.now().isoformat()
    })
    print(f"[activity] {app_name} - {window_title}")


def send_website_usage():
    app_name, window_title = get_active_window_info()
    if app_name not in BROWSER_APPS:
        return

    title_lower = window_title.lower()
    domain = None
    for keyword, mapped_domain in KNOWN_DOMAINS.items():
        if keyword in title_lower:
            domain = mapped_domain
            break

    if not domain:
        return  # couldn't confidently identify the site from the window title

    requests.post(f"{API_URL}/website-usage", json={
        "employee_id": EMPLOYEE_ID,
        "url": "",
        "domain": domain,
        "browser": app_name,
        "timestamp": datetime.now().isoformat()
    })
    print(f"[website] {domain} via {app_name}")


def check_idle():
    global last_input_check_pos, last_input_time, is_idle, idle_start_time
    current_pos = pyautogui.position()

    if current_pos != last_input_check_pos:
        last_input_check_pos = current_pos
        last_input_time = datetime.now()
        if is_idle:
            # Employee just came back — close out the idle period
            requests.post(f"{API_URL}/idle", json={
                "employee_id": EMPLOYEE_ID,
                "start_time": idle_start_time.isoformat(),
                "end_time": datetime.now().isoformat()
            })
            print("[idle] Idle period ended")
            is_idle = False
    else:
        seconds_since_input = (datetime.now() - last_input_time).total_seconds()
        if seconds_since_input > IDLE_THRESHOLD_SEC and not is_idle:
            is_idle = True
            idle_start_time = last_input_time
            print("[idle] Employee went idle")


def take_and_send_screenshot():
    screenshot = pyautogui.screenshot()
    blurred = screenshot.filter(ImageFilter.GaussianBlur(radius=8))
    filepath = f"screenshot_{int(time.time())}.png"
    blurred.save(filepath)
    with open(filepath, "rb") as f:
        requests.post(
            f"{API_URL}/screenshot",
            files={"image": f},
            data={"employee_id": EMPLOYEE_ID, "blurred": "1", "encrypted": "0"}
        )
    print(f"[screenshot] sent {filepath}")


def main():
    session_id = log_login()
    print(f"Logged in. Session ID: {session_id}")

    last_activity_check = time.time()
    last_screenshot_check = time.time()

    try:
        while True:
            check_idle()

            if time.time() - last_activity_check >= ACTIVITY_INTERVAL_SEC:
                send_activity()
                send_website_usage()
                last_activity_check = time.time()

            if time.time() - last_screenshot_check >= SCREENSHOT_INTERVAL_SEC:
                take_and_send_screenshot()
                last_screenshot_check = time.time()

            time.sleep(1)
    except KeyboardInterrupt:
        print("Stopping agent, logging out...")
        log_logout(session_id)


if __name__ == "__main__":
    main()
