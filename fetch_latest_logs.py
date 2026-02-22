import subprocess, json, sys

SERVICE_ID = 'caebdefb8ddfde171b45d4a169b5ccaa'
AWS_CMD = 'C:/Users/mohd sohail ali/AppData/Roaming/Python/Python39/Scripts/aws.cmd'

def get_latest_op():
    cmd = [AWS_CMD, 'apprunner', 'list-operations', '--service-arn', f'arn:aws:apprunner:us-east-1:186067878422:service/TaskGenius-App/{SERVICE_ID}', '--region', 'us-east-1']
    res = subprocess.run(cmd, capture_output=True)
    data = json.loads(res.stdout.decode('utf-8', errors='replace'))
    return data['OperationSummaryList'][0]['Id']

OP_ID = get_latest_op()
print(f"Latest OP_ID: {OP_ID}")

LG = f'/aws/apprunner/TaskGenius-App/{SERVICE_ID}/service'
LS = f'deployment/{OP_ID}'

def get_logs():
    cmd = [AWS_CMD, 'logs', 'get-log-events', '--log-group-name', LG, '--log-stream-name', LS, '--limit', '1000', '--region', 'us-east-1']
    res = subprocess.run(cmd, capture_output=True)
    with open('latest_logs_raw.bin', 'wb') as f:
        f.write(res.stdout)
    with open('latest_logs_err.bin', 'wb') as f:
        f.write(res.stderr)
    print("Raw logs saved to latest_logs_raw.bin and latest_logs_err.bin")


if __name__ == "__main__":
    get_logs()
