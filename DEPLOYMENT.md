# Deployment Guide

This document contains the commands necessary to deploy the backend services to Google Cloud Functions.

## Prerequisites
- `gcloud` CLI installed and authenticated.
- Correct project set: `gcloud config set project taiwan-animal-crossing-booker`
- Run these commands from the `backend/functions` directory.

---

## 1. Deploy `postReply` Function
Main endpoint for submitting a reply to a Threads post.

```bash
gcloud functions deploy postReply \
  --gen2 \
  --runtime=nodejs22 \
  --region=asia-east1 \
  --source=. \
  --entry-point=reply \
  --trigger-http \
  --allow-unauthenticated \
  --memory=256Mi \
  --timeout=120s \
  --set-env-vars GCP_PROJECT_ID=taiwan-animal-crossing-booker,\
FIRESTORE_COLLECTION_REPLIES=replies,\
FIRESTORE_COLLECTION_RATE_LIMITS=rate_limits,\
REPORT_THRESHOLD=3,\
REPLY_IMAGE_URL=https://rexx.github.io/public/certificate.jpg,\
REPLY_TEXT=testing,\
ALLOWED_ORIGIN=https://rexx.github.io \
  --set-secrets THREADS_ACCESS_TOKEN=THREADS_ACCESS_TOKEN:latest,\
THREADS_USER_ID=THREADS_USER_ID:latest,\
BYPASS_RATE_LIMIT_KEY=BYPASS_RATE_LIMIT_KEY:latest
```

## 2. Deploy `deleteReply` Function
Endpoint to delete a specific reply.

```bash
gcloud functions deploy deleteReply \
  --gen2 \
  --runtime=nodejs22 \
  --region=asia-east1 \
  --source=. \
  --entry-point=deleteReply \
  --trigger-http \
  --allow-unauthenticated \
  --memory=256Mi \
  --timeout=60s \
  --set-env-vars GCP_PROJECT_ID=taiwan-animal-crossing-booker,\
FIRESTORE_COLLECTION_REPLIES=replies,\
ALLOWED_ORIGIN=https://rexx.github.io \
  --set-secrets ADMIN_API_KEY=ADMIN_API_KEY:latest,THREADS_ACCESS_TOKEN=THREADS_ACCESS_TOKEN:latest
```

## 3. Deploy `getReplies` Function
Endpoint to list published replies.

```bash
gcloud functions deploy getReplies \
  --gen2 \
  --runtime=nodejs22 \
  --region=asia-east1 \
  --source=. \
  --entry-point=getReplies \
  --trigger-http \
  --allow-unauthenticated \
  --memory=256Mi \
  --timeout=60s \
  --set-env-vars GCP_PROJECT_ID=taiwan-animal-crossing-booker,\
FIRESTORE_COLLECTION_REPLIES=replies,\
ALLOWED_ORIGIN=https://rexx.github.io
```

## 4. Deploy `getReply` Function
Endpoint to get a single reply detail.

```bash
gcloud functions deploy getReply \
  --gen2 \
  --runtime=nodejs22 \
  --region=asia-east1 \
  --source=. \
  --entry-point=getReply \
  --trigger-http \
  --allow-unauthenticated \
  --memory=256Mi \
  --timeout=60s \
  --set-env-vars GCP_PROJECT_ID=taiwan-animal-crossing-booker,\
FIRESTORE_COLLECTION_REPLIES=replies,\
ALLOWED_ORIGIN=https://rexx.github.io
```

## 5. Deploy `adminReplies` Function
Admin endpoint for managing and listing all internal reply states.

```bash
gcloud functions deploy adminReplies \
  --gen2 \
  --runtime=nodejs22 \
  --region=asia-east1 \
  --source=. \
  --entry-point=adminReplies \
  --trigger-http \
  --allow-unauthenticated \
  --memory=256Mi \
  --timeout=60s \
  --set-env-vars GCP_PROJECT_ID=taiwan-animal-crossing-booker,\
FIRESTORE_COLLECTION_REPLIES=replies,\
ALLOWED_ORIGIN=https://rexx.github.io \
  --set-secrets ADMIN_API_KEY=ADMIN_API_KEY:latest
```

## 6. Deploy `healthCheck` Function
Lightweight endpoint to verify service availability.

```bash
gcloud functions deploy healthCheck \
  --gen2 \
  --runtime=nodejs22 \
  --region=asia-east1 \
  --source=. \
  --entry-point=health \
  --trigger-http \
  --allow-unauthenticated \
  --memory=256Mi \
  --timeout=60s \
  --set-env-vars ALLOWED_ORIGIN=https://rexx.github.io
```
