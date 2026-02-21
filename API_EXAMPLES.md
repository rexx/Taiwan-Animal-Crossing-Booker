# API Usage Examples

This document provides examples of how to interact with the deployed backend API endpoints.

**Base URL**: `https://asia-east1-taiwan-animal-crossing-booker.cloudfunctions.net`

---

## 1. Post a Reply
Submit a request to reply to a specific Threads post.

```bash
curl -X POST \
  https://asia-east1-taiwan-animal-crossing-booker.cloudfunctions.net/postReply \
  -H "Content-Type: application/json" \
  -d '{
    "reply_to_url": "https://www.threads.com/@omawari.san.b.tw/post/DU9tSTdEw02"
  }'
```

## 2. Get Replies (List)
Fetch a list of published replies.

```bash
curl -X GET \
  https://asia-east1-taiwan-animal-crossing-booker.cloudfunctions.net/getReplies
```

## 3. Get Single Reply
Fetch details for a specific reply by ID (uses Container ID).

```bash
curl -X GET \
  'https://asia-east1-taiwan-animal-crossing-booker.cloudfunctions.net/getReply/REPLY_ID'
```

## 4. Delete a Reply
Delete a reply record (requires Admin API Key).

```bash
curl -X DELETE \
  "https://asia-east1-taiwan-animal-crossing-booker.cloudfunctions.net/deleteReply/REPLY_ID" \
  -H "Authorization: Bearer $(gcloud secrets versions access latest --secret=ADMIN_API_KEY --project=taiwan-animal-crossing-booker)"
```

## 5. Admin: List All Replies
Admin-only endpoint for viewing all reply states.

```bash
curl -X GET \
  "https://asia-east1-taiwan-animal-crossing-booker.cloudfunctions.net/adminReplies?limit=20" \
  -H "Authorization: Bearer $(gcloud secrets versions access latest --secret=ADMIN_API_KEY --project=taiwan-animal-crossing-booker)"
```

## 6. Health Check
Simple status check.

```bash
curl -X GET \
  https://asia-east1-taiwan-animal-crossing-booker.cloudfunctions.net/healthCheck
```
