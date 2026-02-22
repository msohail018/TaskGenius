import json
with open('services.json', encoding='utf-16') as f:
    data = json.load(f)
for service in data['ServiceSummaryList']:
    print(f"{service['ServiceName']}: {service['ServiceArn']}")
