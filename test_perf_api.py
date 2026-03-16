import requests
import json

def test_performance():
    url = "http://localhost:8000/api/predict/performance"
    payload = {
        "selected_variables": ["Temperature", "Dust_Optical_Depth"],
        "horizon": 3,
        "ls_start": 90.0,
        "mars_year": 27
    }
    
    try:
        response = requests.post(url, json=payload)
        response.raise_for_status()
        data = response.json()
        
        print(f"Series count: {len(data.get('series', []))}")
        for s in data.get('series', []):
            items = s.get('items', [])
            print(f"Series: {s.get('label')}, Items: {len(items)}, Global R2: {s.get('global_r2')}")
            if items:
                print(f"  First item: {items[0]}")
                print(f"  Last item: {items[-1]}")
                
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    test_performance()
