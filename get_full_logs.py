import subprocess, json, sys

SERVICE_ID = 'ad85eebf58f74a3a8b21d413ac512796'
OP_ID = '539a7e706f6a431fa7081314de50217c'
AWS_CMD = 'C:/Users/mohd sohail ali/AppData/Roaming/Python/Python39/Scripts/aws.cmd'
LG = f'/aws/apprunner/TaskGenius-App/{SERVICE_ID}/service'
LS = f'deployment/{OP_ID}'

def get_all_logs():
    all_events = []
    next_token = None
    
    while True:
        cmd = [AWS_CMD, 'logs', 'get-log-events', '--log-group-name', LG, '--log-stream-name', LS, '--region', 'us-east-1']
        if next_token:
            cmd.extend(['--next-token', next_token])
        
        res = subprocess.run(cmd, capture_output=True)
        if res.returncode != 0:
            print(f"Error: {res.stderr.decode(errors='replace')}")
            break
            
        data = json.loads(res.stdout.decode('utf-8', errors='replace'))
        events = data.get('events', [])
        if not events:
            break
            
        all_events.extend(events)
        
        new_token = data.get('nextForwardToken')
        if new_token == next_token:
            break
        next_token = new_token
        
        # Limit to avoid infinite loop if something goes wrong
        if len(all_events) > 2000:
            break
            
    with open('deployment_full_log.txt', 'w', encoding='utf-8') as f:
        for e in all_events:
            f.write(e['message'] + '\n')
    print(f"Saved {len(all_events)} events to deployment_full_log.txt")

if __name__ == "__main__":
    get_all_logs()
