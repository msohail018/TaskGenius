import json
import subprocess

def get_taskgenius_arn():
    cmd = ['C:\\Users\\mohd sohail ali\\AppData\\Roaming\\Python\\Python39\\Scripts\\aws.cmd', 'apprunner', 'list-services', '--output', 'json']
    result = subprocess.run(cmd, capture_output=True, text=True)
    data = json.loads(result.stdout)
    for s in data['ServiceSummaryList']:
        if s['ServiceName'] == 'TaskGenius-Final':
            print(s['ServiceArn'])

if __name__ == "__main__":
    get_taskgenius_arn()
