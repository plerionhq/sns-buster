# sns-buster

An AWS SNS permission probing tool by [Daniel Grzelak](https://www.linkedin.com/in/danielgrzelak/) of [Plerion](https://www.plerion.com). Analyze how SNS topics respond to API requests and discover non-intrusive ways to verify permissions.

When you find a public or misconfigured SNS topic, you need to understand what actions are permitted without actually modifying data or triggering alerts. sns-buster helps you:

1. **Probe** the topic to see which actions succeed or fail
2. **Compare** the difference in responses between existing exposed and unexposed topics
3. **Find mutations** that let you verify permissions without reading data or making changes (e.g., get a 400 "invalid parameter" instead of 200 "success")

Look in the `output` directory after executing sns-buster for full request and response logs.

The hypothesis is that a request is process by AWS as follows:
1. Standard request structure validation
2. Authorization
3. More function-specific request validation

So finding way to mangle a request to pass #1 but fail #3 will tell us the operation was allowed (#2) but not completed, thus making it safe for testing.

## Quick Start

```bash
bun install
bun link

# Step 1: Probe a topic
sns-buster arn:aws:sns:us-east-1:123456789012:target-topic

# Step 2: Compare allowed vs denied responses
sns-buster --compare <allowed-topic> <denied-topic>

# Step 3: Find non-intrusive verification methods
sns-buster --request-mutations <allowed-topic> <denied-topic>
```

## The Three Modes

### Mode 1: Probe (Default)

Test a single topic with unsigned and signed requests to see what's allowed:

```bash
sns-buster <topic-arn>
```

```
Credentials verified: <your-identity>

Probe Mode

Action                      Unsigned    Signed
----------------------------------------------------
GetTopicAttributes          403         200
GetDataProtectionPolicy     403         200
ListSubscriptionsByTopic    403         200
ListTagsForResource         403         200
Publish                     403         200
PublishBatch                403         200
Subscribe                   403         200
TagResource                 403         200
UntagResource               403         200
AddPermission               403         200
RemovePermission            403         200
SetTopicAttributes          403         200
PutDataProtectionPolicy     403         200
DeleteTopic                 403         403

Summary:
  Total actions: 14
  Unsigned: 0 success, 14 failed
  Signed: 13 success, 1 failed

Output: output/<location>
```

This tells you: "With my credentials, I can read attributes and publish, but not subscribe or delete."

### Mode 2: Compare

Compare how two topics respond to understand permission differences:

```bash
sns-buster --compare <allowed-topic> <denied-topic>
```

```
Credentials verified: <your-identity>

Compare Mode

Comparing:
  Allowed: <allow-topic-arn>
  Denied:  <deny-topic-arn>

Action                      Allowed   Denied    Match
-----------------------------------------------------
GetTopicAttributes          200       403       NO
GetDataProtectionPolicy     200       403       NO
ListSubscriptionsByTopic    200       403       NO
ListTagsForResource         200       403       NO
Publish                     200       403       NO
PublishBatch                200       403       NO
Subscribe                   200       403       NO
TagResource                 200       403       NO
UntagResource               200       403       NO
AddPermission               200       403       NO
RemovePermission            200       403       NO
SetTopicAttributes          200       403       NO
PutDataProtectionPolicy     200       403       NO
DeleteTopic                 403       403       YES

Summary:
  Total actions: 14
  Matching responses: 1
  Different responses: 13

Output: output/<location>
```

This tells you: "The allowed topic permits GetTopicAttributes and Publish, while the denied topic blocks everything."

### Mode 3: Request Mutations

Find ways to verify you have permission without actually accessing data:

```bash
sns-buster --request-mutations <allowed-topic> <denied-topic>
```

This mode uses **3-topic validation** to prove that authorization was actually checked:

1. **Allowed topic** - a topic you have permission to access
2. **Denied topic** - a topic you don't have permission to access
3. **Non-existent topic** - auto-generated with a random GUID (proves auth runs)

```
Credentials verified: <your-identity>

Request Mutations Mode (3-topic validation)

Allowed topic:     <allow-topic-arn>
Denied topic:      <deny-topic-arn>
Non-existent topic: arn:aws:sns:us-east-1:123456789012:nonexistent-<guid>

Testing 14 actions with request mutations...

GetTopicAttributes           baseline: 200/403/403  mutations: 2
Publish                      baseline: 200/403/403  mutations: 5 [2 useful]
Subscribe                    baseline: 200/403/403  mutations: 6 [1 useful]
TagResource                  baseline: 200/403/403  mutations: 10
UntagResource                baseline: 200/403/403  mutations: 7 [1 useful]
AddPermission                baseline: 200/403/403  mutations: 9 [1 useful]
RemovePermission             baseline: 200/403/403  mutations: 7 [1 useful]
SetTopicAttributes           baseline: 200/403/403  mutations: 5 [2 useful]
PutDataProtectionPolicy      baseline: 200/403/403  mutations: 6 [3 useful]
DeleteTopic                  baseline: 403/403/403  mutations: 2

============================================================
Summary:
  Actions tested: 14
  Total mutations tested: 67
  Useful mutations found: 11

Useful mutations (validation runs before auth):
  Publish + empty-message:
    allowed=400 denied=403 nonexistent=403
    Safe probe: auth passed then "InvalidParameter" (denied=403, nonexistent=403)
  UntagResource + nonexistent-tag-key:
    allowed=200 denied=403 nonexistent=403
    No-op probe: 200 success with no side effects
  ...

Output: output/<location>
```

**How 3-topic validation works:**

A mutation is "useful" for safe testing when it proves authorization was checked:

| Category | Allowed | Denied | Non-existent | Meaning |
|----------|---------|--------|--------------|---------|
| **Safe Probe** | 400 | 403 | 403 | Auth passed, then validation failed |
| **No-op Probe** | 200 | 403 | 403 | Request succeeded with no side effects |
| Not useful | 400 | 400 | 400 | Pre-auth validation (auth never checked) |

The non-existent topic is critical: if it returns 403 but allowed returns 400, we know:
1. AWS checked authorization first (non-existent gets 403)
2. Authorization passed for allowed topic
3. Then function-specific validation failed (400)

This tells you: "Send a Publish request with an empty message. If you get 400, you have permission. If you get 403, you don't. Either way, no message is actually published."

## Why This Matters

When testing SNS permissions, you often want to verify access without:
- Actually publishing messages
- Modifying topic configuration
- Triggering monitoring/alerts
- Leaving forensic evidence

Request mutations exploit the fact that AWS checks authorization *before* validating parameters. A malformed request that passes auth but fails validation proves you have permission without executing the action.

## Installation

```bash
git clone https://github.com/plerionhq/sns-buster.git
cd sns-buster
bun install
bun link
```

## Credentials

```bash
export AWS_ACCESS_KEY_ID=AKIA...
export AWS_SECRET_ACCESS_KEY=...
export AWS_SESSION_TOKEN=...  # optional
```

Without credentials, only unsigned requests are sent.

## Options

| Flag | Description |
|------|-------------|
| `--read` | Only test read actions (4 actions) |
| `--safe` | Exclude destructive actions (10 actions) |
| `--all` | Test all actions (14 actions, default) |
| `--compare [allow] [deny]` | Compare two topics |
| `--request-mutations [allow] [deny]` | Find non-intrusive verification methods |
| `-v, --verbose` | Detailed output |
| `-o <dir>` | Output directory (default: `output`) |

## Actions Tested

**Read (4):** GetTopicAttributes, GetDataProtectionPolicy, ListSubscriptionsByTopic, ListTagsForResource

**Write - Safe (6):** Publish, PublishBatch, Subscribe, TagResource, UntagResource, AddPermission

**Write - Destructive (4):** DeleteTopic, SetTopicAttributes, RemovePermission, PutDataProtectionPolicy

## Output

Each run creates a timestamped directory with:
- `summary.json` - structured results
- `*.http` files - raw request/response pairs for each action

```
output/2026-01-13T12-51-47-my-topic/
├── summary.json
├── GetTopicAttributes-unsigned.http
├── GetTopicAttributes-signed.http
└── ...
```

## Mutation Strategies

sns-buster tests parameter mutations to find non-intrusive verification methods:

- **Structure mutations:** remove Action, remove Version
- **Message mutations:** empty Message, long Subject
- **Subscribe mutations:** invalid Protocol, endpoint-to-ARN
- **Permission mutations:** invalid action name, non-existent Label, special characters
- **Tag mutations:** empty key, remove tags/keys, long key/value, zero-index
- **Attribute mutations:** invalid attribute name, long value
- **Policy mutations:** invalid JSON, empty object, wrong schema

**Important:** We do NOT mutate the target TopicArn/ResourceArn because AWS needs the correct target to perform authorization checks.

**Why some mutations are NOT useful:**

Mutations that fail AWS's standard request validation (step 1) return the same error for ALL topics - including non-existent ones. This proves auth was never checked, making them useless for permission testing. For example, TagResource with an empty key returns `ValidationError` for all 3 topics.


## Security Notes

- Session tokens are redacted in HTTP logs
- AddPermission uses a noop grant (owner already has access)
- RemovePermission runs after AddPermission to clean up
- Credentials are only read from environment variables

## Contact

- LinkedIn: [Plerion](https://linkedin.com/company/plerion)
- Web: [https://www.plerion.com/company/contact-us](https://www.plerion.com/company/contact-us)

## License

Distributed under the MIT License. See `LICENSE.txt` for more information.
