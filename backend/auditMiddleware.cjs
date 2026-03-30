/**
 * Audit Middleware - Automatic Event Capture & Correlation ID Propagation
 *
 * Features:
 * - Correlation ID generation and propagation
 * - Request context capture (IP, user agent, method, path)
 * - Automatic audit logging for CRUD operations
 * - Integration with auditService
 */

const { auditService } = require('./auditService.cjs');

// Correlation ID storage for request lifecycle
const CORRELATION_ID_CTX_KEY = 'correlationId';

// Generate a new correlation ID
const generateCorrelationId = () => {
  const { randomUUID } = require('crypto');
  return randomUUID();
};

// Middleware to inject correlation ID into every request
const correlationIdMiddleware = (req, res, next) => {
  const correlationId = req.headers['x-correlation-id'] || generateCorrelationId();
  req.correlationId = correlationId;
  res.setHeader('X-Correlation-ID', correlationId);
  next();
};

// Middleware to capture audit context for a user action
const auditContextMiddleware = (req, res, next) => {
  // Attach audit context to request for later use
  req.auditContext = {
    correlationId: req.correlationId,
    userId: req.user?.id || 'anonymous',
    userRole: req.user?.role || 'unknown',
    sessionId: req.session?.id || null,
    ipAddress: req.ip || req.connection.remoteAddress,
    userAgent: req.get('User-Agent'),
    httpMethod: req.method,
    httpPath: req.path
  };
  next();
};

// Helper to extract entity data from request (for delta capture)
const extractEntityData = (req) => {
  // Try to get entity from various sources
  if (req.body && req.body.id) {
    return {
      id: req.body.id,
      data: req.body
    };
  }
  if (req.params && req.params.id) {
    return {
      id: req.params.id,
      data: req.params
    };
  }
  return null;
};

// Middleware to automatically log CRUD operations
// Usage: app.use('/api/invoices', auditCrudMiddleware('invoice'));
const auditCrudMiddleware = (entityType) => {
  return async (req, res, next) => {
    // Capture original state before the operation (for updates/deletes)
    let oldValue = null;
    const entityId = req.params.id || (req.body && req.body.id);

    if (entityId && (req.method === 'PUT' || req.method === 'PATCH' || req.method === 'DELETE')) {
      try {
        // Fetch current state from database before modification
        const { db } = require('./db.cjs');
        const tableName = entityType === 'invoice' ? 'documents' :
                         entityType === 'examination_batch' ? 'examination_batches' :
                         entityType === 'customer' ? 'customers' :
                         entityType === 'inventory_item' ? 'inventory' : entityType;

        await new Promise((resolve, reject) => {
          db.get(`SELECT * FROM ${tableName} WHERE id = ? OR logical_number = ?`, [entityId, entityId], (err, row) => {
            if (err) reject(err);
            else {
              oldValue = row;
              resolve();
            }
          });
        });
      } catch (error) {
        console.warn(`[AuditMiddleware] Could not fetch old state for ${entityType}:${entityId}`, error.message);
      }
    }

    // Capture response to log after operation completes
    const originalSend = res.send;
    res.send = function(body) {
      // After operation, capture new state and log event
      if (req.auditContext && entityId) {
        const { auditService } = require('./auditService.cjs');
        const actionMap = {
          'POST': 'CREATE',
          'PUT': 'UPDATE',
          'PATCH': 'UPDATE',
          'DELETE': 'DELETE'
        };
        const action = actionMap[req.method];

        if (action) {
          const newValue = (req.method === 'DELETE') ? null : (req.body || {});

          auditService.logEvent({
            ...req.auditContext,
            action,
            entityType,
            entityId,
            details: `${action} operation on ${entityType} ${entityId}`,
            oldValue,
            newValue,
            reason: req.body?.reason || null,
            httpPath: req.originalUrl || req.path
          }).catch(err => {
            console.error('[AuditMiddleware] Failed to log audit event:', err);
          });
        }
      }

      // Restore original send and send response
      res.send = originalSend;
      return originalSend.call(res, body);
    };

    next();
  };
};

// Middleware to log authentication events
const auditAuthMiddleware = (req, res, next) => {
  // This middleware should be placed after auth middleware
  // It will log successful/failed auth attempts
  const originalStatus = res.statusCode;

  res.on('finish', async () => {
    if (req.auditContext) {
      const { auditService } = require('./auditService.cjs');
      const isAuthRoute = req.path.startsWith('/api/auth/');
      const isLogin = req.path.endsWith('/login') || req.path.endsWith('/signin');

      if (isAuthRoute) {
        const action = (originalStatus === 200 || originalStatus === 201) ? 'LOGIN' : 'LOGIN_FAILED';
        const details = isLogin ? `Auth attempt: ${originalStatus === 200 ? 'Success' : 'Failed'}` : `Auth operation: ${req.method}`;

        try {
          await auditService.logEvent({
            ...req.auditContext,
            action,
            entityType: 'AUTH',
            entityId: req.auditContext.userId || req.body?.email || 'unknown',
            details,
            reason: req.body?.reason || null
          });
        } catch (err) {
          console.error('[AuditMiddleware] Failed to log auth event:', err);
        }
      }
    }
  });

  next();
};

// Utility to manually log an audit event from anywhere in the codebase
const logAuditEvent = async (eventData) => {
  try {
    // If called within request context, merge with request audit context
    const { auditService } = require('./auditService.cjs');
    return await auditService.logEvent(eventData);
  } catch (error) {
    console.error('[AuditMiddleware] Manual audit log failed:', error);
    throw error;
  }
};

module.exports = {
  correlationIdMiddleware,
  auditContextMiddleware,
  auditCrudMiddleware,
  auditAuthMiddleware,
  logAuditEvent,
  generateCorrelationId
};