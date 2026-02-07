import { Router, type Router as RouterType } from 'express';
import swaggerUi from 'swagger-ui-express';
import { swaggerSpec } from '../lib/openapi.js';

const router: RouterType = Router();

/**
 * Serve Swagger UI
 */
router.use('/', swaggerUi.serve);
router.get('/', swaggerUi.setup(swaggerSpec, {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'Pauly Admin API Docs',
}));

/**
 * Serve raw OpenAPI JSON spec
 */
router.get('/openapi.json', (_req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(swaggerSpec);
});

export default router;
