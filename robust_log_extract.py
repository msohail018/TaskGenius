import re

def extract_logs():
    try:
        with open('latest_logs_raw.bin', 'rb') as f:
            content = f.read().decode('utf-8', errors='replace')
        
        # Extract message fields using a regex that handles escaped quotes
        messages = re.findall(r'\"message\":\s*\"(.*?)(?<!\\)\"', content)
        
        with open('latest_logs_final.txt', 'w', encoding='utf-8') as f:
            for m in messages:
                # Unescape common sequences
                msg = m.replace('\\n', '\n').replace('\\"', '\"').replace('\\t', '\t')
                f.write(msg + '\n')
        print(f"Extracted {len(messages)} messages to latest_logs_final.txt")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    extract_logs()
