import urllib.request
import json
data = json.dumps({"template_name": "meeting_minutes", "form_data": {"MEETING_DATE": "test"}}).encode('utf-8')
req = urllib.request.Request('http://localhost:8888/docx/generate-template', data=data, headers={'Content-Type': 'application/json'})
try:
    urllib.request.urlopen(req)
except Exception as e:
    print("Error:", e)
