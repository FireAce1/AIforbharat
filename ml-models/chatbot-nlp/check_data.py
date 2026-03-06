import json

# Load data
with open('data/training_data.json', encoding='utf-8') as f:
    train = json.load(f)

with open('data/validation_data.json', encoding='utf-8') as f:
    val = json.load(f)

# Count intents
intents = set(i['intent'] for i in train + val)
counts = {i: sum(1 for x in train+val if x['intent']==i) for i in intents}

print(f"Training examples: {len(train)}")
print(f"Validation examples: {len(val)}")
print(f"Total intents: {len(intents)}")
print(f"Examples per intent: {min(counts.values())}-{max(counts.values())}")

if len(intents) >= 20 and min(counts.values()) >= 100:
    print("\n✓ Requirements met: 20+ intents, 100+ examples each")
else:
    print("\n✗ Requirements not met")
