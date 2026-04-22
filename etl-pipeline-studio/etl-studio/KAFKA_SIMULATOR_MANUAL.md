# Kafka Simulator – User Manual

> **Location:** Admin → Simulators → Kafka Simulator

---

## Overview

The **Kafka Simulator** lets you publish test messages to any Kafka topic at controlled rates and intervals — without writing code. You can run multiple simulation tasks simultaneously, each with its own message format, payload template, throughput settings, and send schedule.

Common use cases:
- Load-testing downstream ETL pipelines with realistic data
- Verifying topic consumers are wired up correctly
- Generating synthetic events for QA or demo environments

---

## Getting Started

### Step 1 — Select a Broker Environment

Open the **Kafka Broker** section at the top of the page and choose an environment from the **Broker Environment** dropdown.

| Environment | Description |
|-------------|-------------|
| HOME        | Local / development Kafka broker |
| OFFICE      | On-premises office Kafka cluster |

> ⚠️ You must select an environment **and** enter a topic before any simulation task can be started.

### Step 2 — Enter a Kafka Topic

Type the name of the target Kafka topic in the **Kafka Topic** field.

```
e.g.  my-events-topic
      telemetry.raw
      orders.incoming
```

---

## Simulation Tasks

Each row in the **Simulation Tasks** table represents an independent simulation task. You can add as many tasks as needed.

### Adding a Task

Click **+ Add Task** at the bottom of the table. A new row is created with sensible defaults (JSON format, 1 msg/sec, 10 total messages, every 1 second).

### Removing a Task

Click the **🗑 Remove** button on the right side of the row. If the task is currently running, it will be stopped remotely before being removed.

---

## Task Configuration

### Format / Sample Message

Each task has a **Format** selector and a **Sample Message** text editor.

#### Supported Formats

| Format     | Description |
|------------|-------------|
| **JSON**   | Validated in real time — the editor highlights invalid JSON in red. |
| **CSV**    | Comma-separated values. Useful for flat record streaming. |
| **XML**    | Structured markup payload. |
| **Protobuf** | Base64-encoded binary Protobuf payload. |
| **Plain Text** | Free-form text with no structural validation. |

> Switching the format automatically loads a default template for that format.

#### Placeholder Variables

The following placeholders are substituted at send time on the backend:

| Placeholder | Replaced With |
|-------------|---------------|
| `{{uuid}}`  | A randomly generated UUID (v4) |
| `{{now}}`   | Current UTC timestamp (ISO 8601) |
| `{{value}}` | A configurable numeric or string value |

**Example JSON template:**
```json
{
  "id": "{{uuid}}",
  "timestamp": "{{now}}",
  "value": "{{value}}"
}
```

**Example CSV template:**
```
{{uuid}},{{now}},{{value}}
```

**Example XML template:**
```xml
<event>
  <id>{{uuid}}</id>
  <timestamp>{{now}}</timestamp>
  <value>{{value}}</value>
</event>
```

---

### Msgs / sec

The number of messages sent **per second** within each burst (interval tick).

- Minimum: `1`
- Maximum: `10 000`

---

### Total Messages

The total number of messages to publish across all interval ticks combined.

| Value | Behaviour |
|-------|-----------|
| Any positive integer | Stops automatically after that many messages have been sent |
| `-1` | **Unlimited** — runs until you click **Stop** |

---

### Send Interval

How often a burst of messages is triggered.

| Option           | Interval     |
|------------------|--------------|
| Once             | Sends one burst, then stops immediately |
| Every 1 second   | 1 s          |
| Every 5 seconds  | 5 s          |
| Every 10 seconds | 10 s         |
| Every 30 seconds | 30 s         |
| Every 1 minute   | 60 s         |
| Every 5 minutes  | 300 s        |

> **Once** is useful for sending a fixed batch of messages (e.g. seeding a topic with exactly 100 records).

---

## Running Simulations

### Start a Task

Click **▶ Start** on the task row. The button is disabled until both the broker environment and topic are filled in.

When started:
- The row status changes to **▶ Running** (green badge).
- The configuration fields (format, message, rate, total, interval) become read-only.

### Stop a Task

Click **■ Stop** on a running task row. The simulator will send a stop request to the backend.  
When stopped, the status changes to **■ Stopped** (amber badge).

### Stop All

If more than one task is running, a **■ Stop All (n)** button appears in the top-right corner of the page. Clicking it stops all running tasks simultaneously.

---

## Status Badges

| Badge      | Colour | Meaning |
|------------|--------|---------|
| ○ Idle     | Grey   | Task configured but not yet started |
| ▶ Running  | Green  | Actively publishing messages |
| ■ Stopped  | Amber  | Manually stopped or completed |
| ✖ Error    | Red    | An error occurred; see the message below the badge |

---

## Example Scenarios

### Scenario 1 — Smoke test a topic (once, 100 messages)

| Field           | Value            |
|-----------------|------------------|
| Format          | JSON             |
| Msgs / sec      | 10               |
| Total Messages  | 100              |
| Send Interval   | Once             |

Click **▶ Start**. The simulator sends 100 messages at 10/sec in a single burst, then stops automatically.

---

### Scenario 2 — Continuous load test (unlimited, every second)

| Field           | Value             |
|-----------------|-------------------|
| Format          | JSON              |
| Msgs / sec      | 50                |
| Total Messages  | -1 (unlimited)    |
| Send Interval   | Every 1 second    |

Click **▶ Start**. The simulator sends 50 messages every second until you click **■ Stop**.

---

### Scenario 3 — Periodic CSV heartbeat (every minute)

| Field           | Value                          |
|-----------------|--------------------------------|
| Format          | CSV                            |
| Sample Message  | `{{uuid}},{{now}},{{value}}`   |
| Msgs / sec      | 1                              |
| Total Messages  | -1 (unlimited)                 |
| Send Interval   | Every 1 minute                 |

Useful for monitoring pipelines that should receive at least one event per minute.

---

## REST API Reference

The simulator communicates with the following backend endpoints:

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/backend/simulator/start` | Start a simulation task |
| `POST` | `/backend/simulator/stop/{taskId}` | Stop a running task |
| `DELETE` | `/backend/simulator/{taskId}` | Delete a completed/stopped task |
| `GET` | `/backend/simulator/status/{taskId}` | Poll the current status of a task |

### POST `/backend/simulator/start` — Request Body

```json
{
  "environment": "HOME",
  "topic": "my-events-topic",
  "messageFormat": "json",
  "sampleMessage": "{ \"id\": \"{{uuid}}\", \"ts\": \"{{now}}\" }",
  "messagesPerSecond": 10,
  "totalMessages": 100,
  "intervalSeconds": 5
}
```

### POST `/backend/simulator/start` — Response

```json
{
  "taskId": "abc-123",
  "status": "running",
  "startedAt": "2026-04-22T10:00:00Z"
}
```

> `intervalSeconds: 0` means **Once** — the backend sends a single burst and terminates the task automatically.

---

## Tips & Best Practices

- Use **Once** + a moderate `Msgs / sec` to seed a topic with a predictable number of test records before starting your ETL pipeline.
- Keep `Msgs / sec` low (1–5) during initial smoke tests to avoid overwhelming downstream consumers.
- Use the **Plain Text** format when testing pipelines that expect raw string messages rather than structured data.
- You can run tasks with different formats against the same topic to test how your pipeline handles mixed message types.
- Always click **■ Stop** (or **■ Stop All**) before leaving the Simulators page to avoid unintended message production.

