import re
with open('livekit.yaml', 'r') as f:
    text = f.read()

# remove keys section
text = re.sub(r'keys:\n\s+\S+:\s+\S+\n', '', text)
with open('livekit.yaml', 'w') as f:
    f.write(text)

with open('docker-compose.yml', 'r') as f:
    dc = f.read()

dc = dc.replace('      - LIVEKIT_API_SECRET=${LIVEKIT_API_SECRET}', '      - LIVEKIT_API_SECRET=${LIVEKIT_API_SECRET}\n      - LIVEKIT_KEYS=${LIVEKIT_API_KEY}: ${LIVEKIT_API_SECRET}')
with open('docker-compose.yml', 'w') as f:
    f.write(dc)
