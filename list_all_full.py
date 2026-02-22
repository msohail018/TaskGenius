import json
import subprocess
import sys

def get_services():
    try:
        cmd = ['C:\\Users\\mohd sohail ali\\AppData\\Roaming\\Python\\Python39\\Scripts\\aws.cmd', 'apprunner', 'list-services', '--output', 'json']
        result = subprocess.run(cmd, capture_output=True, text=True, check=True)
        data = json.loads(result.stdout)
        for s in data['ServiceSummaryList']:
            print(f"SERVICE_NAME: {s['ServiceName']}")
            print(f"SERVICE_ARN:  {s['ServiceArn']}")
            print(f"SERVICE_STAT: {s['Status']}")
            print("=" * 40)
    except Exception as e:
        print(f"ERROR: {e}")

if __name__ == "__main__":
    get_services()
