import subprocess, json, time, sys

def monitor():
    try:
        with open('latest_arn.txt', 'r') as f:
            ARN = f.read().strip()
    except:
        print("latest_arn.txt not found")
        return

    AWS_CMD = 'C:/Users/mohd sohail ali/AppData/Roaming/Python/Python39/Scripts/aws.cmd'
    print(f'Monitoring {ARN}...')

    last_status = None
    start = time.time()
    while time.time() - start < 1800: # 30 mins
        res = subprocess.run([AWS_CMD, 'apprunner', 'describe-service', '--service-arn', ARN, '--region', 'us-east-1'], capture_output=True, text=True)
        if res.returncode == 0:
            data = json.loads(res.stdout)
            status = data['Service']['Status']
            if status != last_status:
                timestamp = time.strftime("%H:%M:%S")
                print(f'[{timestamp}] Status: {status}')
                last_status = status
            if status == 'RUNNING':
                print('SUCCESS!')
                print(f"Service URL: https://{data['Service']['ServiceUrl']}")
                sys.exit(0)
            if status in ['CREATE_FAILED', 'UPDATE_FAILED']:
                print(f'FAILED! Status: {status}')
                sys.exit(1)
        time.sleep(45)
    print("Timed out")
    sys.exit(1)

if __name__ == "__main__":
    monitor()
