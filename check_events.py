import subprocess, json

AWS_CMD = 'C:/Users/mohd sohail ali/AppData/Roaming/Python/Python39/Scripts/aws.cmd'
SERVICE_ID = 'ad85eebf58f74a3a8b21d413ac512796'
LG = f'/aws/apprunner/TaskGenius-App/{SERVICE_ID}/service'

def check_events():
    cmd = [AWS_CMD, 'logs', 'get-log-events', '--log-group-name', LG, '--log-stream-name', 'events', '--region', 'us-east-1']
    res = subprocess.run(cmd, capture_output=True)
    if res.returncode != 0:
        print(f"Error: {res.stderr.decode(errors='replace')}")
        return
        
    try:
        data = json.loads(res.stdout.decode('utf-8', errors='replace'))
        with open('events_debug.txt', 'w', encoding='utf-8') as f:
            for e in data['events']:
                f.write(e['message'] + '\n')
        print("Events saved to events_debug.txt")
    except Exception as e:
        print(f"Failed: {e}")

if __name__ == "__main__":
    check_events()
