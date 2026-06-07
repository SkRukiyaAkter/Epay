import hashlib
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import create_app

OFFICER_KEY = os.getenv("OFFICER_API_KEY", "dev-officer-key-change-in-production")

def sha256_hex(s: str) -> str:
    return hashlib.sha256(s.encode()).hexdigest()


def run_tests():
    app = create_app()
    client = app.test_client()

    print("=" * 60)
    print("PHASE 2 GAP TESTS (using Flask test client)")
    print("=" * 60)

    # --- Test 1: Login ---
    print("\n--- TEST 1: Login ---")
    r = client.post("/api/v1/auth/login", json={
        "username": "alice",
        "password_hash": sha256_hex("alice123")
    })
    print(f"Status: {r.status_code}")
    data = r.get_json()
    if r.status_code != 200:
        print(f"Error: {data}")
        return False
    token = data["session_token"]
    print(f"Token: {token[:50]}...")
    print(f"t_version: {data['t_version']}")

    # --- Test 2: Refresh ---
    print("\n--- TEST 2: Refresh ---")
    r = client.post("/api/v1/auth/refresh", headers={"Authorization": f"Bearer {token}"})
    print(f"Status: {r.status_code}")
    data = r.get_json()
    if r.status_code != 200:
        print(f"Error: {data}")
        return False
    new_token = data["session_token"]
    print(f"New token: {new_token[:50]}...")
    print(f"t_version: {data['t_version']}")

    # --- Test 3: Logout ---
    print("\n--- TEST 3: Logout ---")
    r = client.post("/api/v1/auth/logout", headers={"Authorization": f"Bearer {new_token}"})
    print(f"Status: {r.status_code}")
    print(f"Response: {r.get_json()}")

    # --- Test 4: Verify blacklisted token fails ---
    print("\n--- TEST 4: Blacklisted Token (should fail) ---")
    r = client.post("/api/v1/auth/refresh", headers={"Authorization": f"Bearer {new_token}"})
    print(f"Status: {r.status_code}")
    print(f"Response: {r.get_json()}")
    if r.status_code != 401:
        print("FAILED: Blacklisted token was accepted")
        return False

    # --- Test 5: Register without officer key (should fail with 403) ---
    print("\n--- TEST 5: Register (no officer key) ---")
    r = client.post("/api/v1/auth/register", json={
        "full_name": "Test User",
        "nid_number": "9998887776",
        "browser_fingerprint": "test_fp_v1",
        "password": "testpass123",
        "daily_limit": 3000.00,
    })
    print(f"Status: {r.status_code} (expect 403)")
    print(f"Response: {r.get_json()}")
    if r.status_code != 403:
        print("FAILED: Registration without officer key should be rejected")
        return False

    # --- Test 6: Register with officer key ---
    print("\n--- TEST 6: Register (with officer key) ---")
    r = client.post("/api/v1/auth/register", headers={
        "X-Officer-API-Key": OFFICER_KEY
    }, json={
        "full_name": "Test User",
        "nid_number": "9998887776",
        "browser_fingerprint": "test_fp_v1",
        "password": "testpass123",
        "daily_limit": 3000.00,
    })
    print(f"Status: {r.status_code}")
    data = r.get_json()
    print(f"Response: {data}")
    if r.status_code != 201:
        print("FAILED: Registration with officer key failed")
        return False
    new_username = data["username"]

    # --- Test 7: Login as new user ---
    print(f"\n--- TEST 7: Login new user ({new_username}) ---")
    r = client.post("/api/v1/auth/login", json={
        "username": new_username,
        "password_hash": sha256_hex("testpass123")
    })
    print(f"Status: {r.status_code}")
    data = r.get_json()
    if r.status_code != 200:
        print(f"Error: {data}")
        return False
    new_user_token = data["session_token"]
    print(f"Token: {new_user_token[:50]}...")

    # --- Test 8: Balance check ---
    print("\n--- TEST 8: Balance ---")
    r = client.get("/api/v1/account/balance", headers={"Authorization": f"Bearer {new_user_token}"})
    print(f"Status: {r.status_code}")
    print(f"Response: {r.get_json()}")
    if r.status_code != 200:
        return False

    # --- Test 9: Suspend account ---
    print("\n--- TEST 9: Suspend ---")
    r = client.post("/api/v1/account/suspend", headers={
        "Authorization": f"Bearer {new_user_token}"
    }, json={"reason": "test suspension"})
    print(f"Status: {r.status_code}")
    print(f"Response: {r.get_json()}")
    if r.status_code != 200:
        return False

    # --- Test 10: Verify suspended token fails ---
    print("\n--- TEST 10: Suspended Token (should fail) ---")
    r = client.get("/api/v1/account/balance", headers={"Authorization": f"Bearer {new_user_token}"})
    print(f"Status: {r.status_code}")
    print(f"Response: {r.get_json()}")
    if r.status_code != 403:
        print("FAILED: Suspended user's token was accepted")
        return False

    print("\n" + "=" * 60)
    print("ALL PHASE 2 GAP TESTS PASSED!")
    print("=" * 60)
    return True


if __name__ == "__main__":
    success = run_tests()
    sys.exit(0 if success else 1)
