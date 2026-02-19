
import * as ff from '@google-cloud/functions-framework';
import { handlePostReply } from './reply.js';
import { handleDeleteReply } from './deleteReply.js';
import { handlePostReport } from './report.js';
import { handleGetReplies, handleGetReply } from './getReplies.js';
import { handleAdminGetReplies } from './adminReplies.js';
import { handleWebhookThreads } from './webhook.js';
import { handleHealth } from './health.js';

const corsWrapper = (handler) => async (req, res) => {
  res.set('Access-Control-Allow-Origin', process.env.ALLOWED_ORIGIN || '*');
  res.set('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Bypass-Key');
  
  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }
  
  try {
    await handler(req, res);
  } catch (err) {
    console.error('Unhandled Error:', err);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: err.message });
  }
};

ff.http('reply', corsWrapper(handlePostReply));
ff.http('deleteReply', corsWrapper(handleDeleteReply));
ff.http('report', corsWrapper(handlePostReport));
ff.http('getReplies', corsWrapper(handleGetReplies));
ff.http('getReply', corsWrapper(handleGetReply));
ff.http('adminReplies', corsWrapper(handleAdminGetReplies));
ff.http('webhook', handleWebhookThreads);
ff.http('health', corsWrapper(handleHealth));
