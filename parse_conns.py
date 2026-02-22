import json
with open('connections.json', encoding='utf-16') as f:
    data = json.load(f)
for conn in data['ConnectionSummaryList']:
    print(f"{conn['ConnectionName']}: {conn['ConnectionArn']} ({conn['Status']})")
