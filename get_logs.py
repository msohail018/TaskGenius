import subprocess, json, sys, re

AWS_CMD = 'C:/Users/mohd sohail ali/AppData/Roaming/Python/Python39/Scripts/aws.cmd'
SERVICE_ID = 'ad85eebf58f74a3a8b21d413ac512796'

# List ALL log groups for this service
result = subprocess.run(
    [AWS_CMD, 'logs', 'describe-log-groups',
     '--log-group-name-prefix', '/aws/apprunner',
     '--region', 'us-east-1'],
    capture_output=True
)
raw = result.stdout.decode('utf-8', errors='replace')
data = json.loads(raw)
groups = data.get('logGroups', [])
print(f'Found {len(groups)} log groups:', file=sys.stderr)
for g in groups:
    print(f'  {g["logGroupName"]} ({g.get("storedBytes",0)} bytes)', file=sys.stderr)

# For each log group, read all streams
for g in groups:
    lg_name = g['logGroupName']
    print(f'\n=== LOG GROUP: {lg_name} ===')
    
    streams_result = subprocess.run(
        [AWS_CMD, 'logs', 'describe-log-streams',
         '--log-group-name', lg_name,
         '--order-by', 'LastEventTime',
         '--descending',
         '--region', 'us-east-1'],
        capture_output=True
    )
    s_raw = streams_result.stdout.decode('utf-8', errors='replace')
    if not s_raw.strip():
        print('  No streams data')
        continue
    
    try:
        s_data = json.loads(s_raw)
    except:
        print('  Parse error on streams')
        continue
    
    streams = s_data.get('logStreams', [])
    print(f'  {len(streams)} streams:')
    for s in streams:
        sn = s['logStreamName']
        print(f'    - {sn} (stored: {s.get("storedBytes",0)})')
        
        # Read events
        ev_result = subprocess.run(
            [AWS_CMD, 'logs', 'get-log-events',
             '--log-group-name', lg_name,
             '--log-stream-name', sn,
             '--limit', '200',
             '--region', 'us-east-1'],
            capture_output=True
        )
        ev_raw = ev_result.stdout.decode('utf-8', errors='replace')
        if not ev_raw.strip() or ev_result.returncode != 0:
            print(f'      No events (rc={ev_result.returncode})')
            continue
        
        # Try JSON parse, fall back to regex
        try:
            ev_data = json.loads(ev_raw)
            evs = ev_data.get('events', [])
            if evs:
                safe_sn = re.sub(r'[^\w]', '_', sn)
                fname = f'log_{safe_sn[:40]}.txt'
                with open(fname, 'w', encoding='utf-8', errors='replace') as f:
                    for e in evs:
                        f.write(e['message'] + '\n')
                print(f'      Saved {len(evs)} events to {fname}')
                for e in evs:
                    print(f'      {e["message"][:300]}')
            else:
                print('      0 events')
        except Exception as ex:
            print(f'      JSON parse error: {ex}')
            # Regex fallback
            msgs = re.findall(r'"message"\s*:\s*"((?:[^"\\]|\\.)*)"', ev_raw)
            print(f'      Regex found {len(msgs)} messages')
            for m in msgs[-30:]:
                decoded = m.replace('\\n', '\n').replace('\\t', '\t')
                print(f'      {decoded[:300]}')
