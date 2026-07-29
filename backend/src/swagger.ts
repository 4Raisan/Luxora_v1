import swaggerJSDoc from 'swagger-jsdoc';

const options: swaggerJSDoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Luxora Home Concierge REST API',
      version: '1.0.0',
      description: 'Production REST API for Luxora Subscription-Based Luxury Home Concierge Platform',
      contact: {
        name: 'Luxora Engineering Team',
      },
    },
    servers: [
      {
        url: 'http://localhost:5000/api',
        description: 'Local Development Server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
    security: [
      {
        bearerAuth: [],
      },
    ],
  },
  apis: ['./src/routes/*.ts', './server/src/server.ts'],
};

export const swaggerSpec = swaggerJSDoc(options);
