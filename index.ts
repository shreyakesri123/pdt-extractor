import express, { Express, Request, Response, NextFunction } from 'express';
import session from 'express-session';
import { log, setupVite, serveStatic } from './vite';
import { registerRoutes } from './routes';

async function main() {
  // Create Express app
  const app: Express = express();
  
  // Basic middleware
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  
  // Configure session
  app.use(session({
    secret: process.env.SESSION_SECRET || 'pdf-extraction-app',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: process.env.NODE_ENV === 'production' }
  }));
  
  // Setup server first without registering routes yet
  const port = parseInt(process.env.PORT || '5000', 10);
  console.log(`Attempting to start server on port ${port}`);
  const server = app.listen(port, '0.0.0.0', () => {
    console.log(`Server is listening on port ${port} with host 0.0.0.0`);
  });
  
  // Setup API routes BEFORE setting up Vite
  await registerRoutes(app);
  
  // Configure Vite in development or serve static files in production
  if (process.env.NODE_ENV === 'production') {
    // Serve static files in production
    serveStatic(app);
  } else {
    // Use Vite dev server in development
    await setupVite(app, server);
  }
  
  // Error handling middleware
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    log(`Error: ${err.message}`);
    console.error(err);
    
    // Send error response
    res.status(err.status || 500).json({
      error: {
        message: err.message || 'Internal Server Error',
        ...(process.env.NODE_ENV === 'development' ? { stack: err.stack } : {})
      }
    });
  });
  
  log('Server is running');
}

// Start the server
main().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});