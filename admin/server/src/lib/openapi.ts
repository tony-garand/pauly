import swaggerJsdoc from 'swagger-jsdoc';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Pauly Admin API',
      version: '1.0.0',
      description: 'REST API for the Pauly autonomous AI assistant admin dashboard',
      contact: {
        name: 'Tony Garand',
      },
    },
    servers: [
      {
        url: '/api',
        description: 'API Server',
      },
    ],
    tags: [
      { name: 'Health', description: 'Server health and status' },
      { name: 'Projects', description: 'Project management' },
      { name: 'Pauly', description: 'Pauly CLI operations' },
      { name: 'Railway', description: 'Railway deployment management' },
      { name: 'Dead Letter', description: 'Failed task queue management' },
      { name: 'Metrics', description: 'Task execution analytics' },
      { name: 'Queue', description: 'Task queue management' },
      { name: 'CLIs', description: 'CLI tools status' },
    ],
    components: {
      schemas: {
        Error: {
          type: 'object',
          properties: {
            error: { type: 'string', description: 'Error message' },
          },
        },
        Health: {
          type: 'object',
          properties: {
            status: { type: 'string', example: 'ok' },
            timestamp: { type: 'string', format: 'date-time' },
            uptime: { type: 'number', description: 'Server uptime in seconds' },
            database: {
              type: 'object',
              properties: {
                status: { type: 'string', enum: ['connected', 'error', 'not_initialized'] },
                size: { type: 'number' },
                tables: { type: 'number' },
              },
            },
            deadLetterQueue: {
              type: 'object',
              properties: {
                pending: { type: 'number' },
                abandoned: { type: 'number' },
                total: { type: 'number' },
              },
            },
            metrics: {
              type: 'object',
              properties: {
                last24h: {
                  type: 'object',
                  properties: {
                    total: { type: 'number' },
                    successRate: { type: 'number' },
                  },
                },
              },
            },
          },
        },
        Project: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            path: { type: 'string' },
            hasGit: { type: 'boolean' },
            hasContextMd: { type: 'boolean' },
            hasTasksMd: { type: 'boolean' },
            hasTodoMd: { type: 'boolean' },
            lastModified: { type: 'string', format: 'date-time' },
          },
        },
        DevJob: {
          type: 'object',
          properties: {
            project: { type: 'string' },
            status: { type: 'string', enum: ['running', 'idle', 'error'] },
            currentPhase: { type: 'string' },
            iteration: { type: 'number' },
            lastUpdate: { type: 'string', format: 'date-time' },
          },
        },
        FailedTask: {
          type: 'object',
          properties: {
            id: { type: 'number' },
            task_type: { type: 'string' },
            task_data: { type: 'string' },
            error_message: { type: 'string' },
            retry_count: { type: 'number' },
            max_retries: { type: 'number' },
            next_retry_at: { type: 'string', format: 'date-time' },
            status: { type: 'string', enum: ['pending', 'retrying', 'resolved', 'abandoned'] },
            created_at: { type: 'string', format: 'date-time' },
          },
        },
        Job: {
          type: 'object',
          properties: {
            id: { type: 'number' },
            task_type: { type: 'string' },
            task_data: { type: 'string' },
            priority: { type: 'number' },
            status: { type: 'string', enum: ['pending', 'running', 'completed', 'failed'] },
            worker_id: { type: 'string', nullable: true },
            created_at: { type: 'string', format: 'date-time' },
            started_at: { type: 'string', format: 'date-time', nullable: true },
            completed_at: { type: 'string', format: 'date-time', nullable: true },
          },
        },
        MetricsSummary: {
          type: 'object',
          properties: {
            totalTasks: { type: 'number' },
            successCount: { type: 'number' },
            failureCount: { type: 'number' },
            successRate: { type: 'number' },
            averageDurationMs: { type: 'number' },
            byTaskType: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  task_type: { type: 'string' },
                  total: { type: 'number' },
                  success: { type: 'number' },
                  failure: { type: 'number' },
                  successRate: { type: 'number' },
                  avgDuration: { type: 'number' },
                },
              },
            },
            recentFailures: {
              type: 'array',
              items: { $ref: '#/components/schemas/FailedTask' },
            },
          },
        },
        QueueStats: {
          type: 'object',
          properties: {
            pending: { type: 'number' },
            running: { type: 'number' },
            completed: { type: 'number' },
            failed: { type: 'number' },
            byTaskType: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  task_type: { type: 'string' },
                  count: { type: 'number' },
                },
              },
            },
          },
        },
      },
    },
  },
  apis: ['./src/routes/*.ts', './src/index.ts'],
};

export const swaggerSpec = swaggerJsdoc(options);
