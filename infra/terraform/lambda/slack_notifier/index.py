import os
import json
import urllib.request

WEBHOOK = os.environ.get("SLACK_WEBHOOK_URL")

def handler(event, context):
    if not WEBHOOK:
        print("No SLACK_WEBHOOK_URL set")
        return {"ok": False, "error": "missing webhook"}

    records = event.get("Records", [])
    for r in records:
        sns = r.get("Sns", {})
        subject = sns.get("Subject", "CloudWatch Alarm")
        message = sns.get("Message", "")
        try:
            msg_parsed = json.loads(message)
            message = "```\n" + json.dumps(msg_parsed, indent=2) + "\n```"
        except Exception:
            pass

        payload = { "text": f"*{subject}*\n{message}" }
        data = json.dumps(payload).encode("utf-8")
        req = urllib.request.Request(WEBHOOK, data=data, headers={"Content-Type": "application/json"})
        with urllib.request.urlopen(req, timeout=10) as resp:
            print("Slack POST status:", resp.status)

    return {"ok": True}
