import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { exec } from "child_process";
import util from "util";
import dotenv from 'dotenv';
dotenv.config();

const execPromise = util.promisify(exec);

// Function to update ElevenLabs agent via our script
async function updateElevenLabsAgent(): Promise<void> {
  try {
    log("Updating ElevenLabs agent configuration...");
    const { stdout, stderr } = await execPromise('node update-elevenlabs-agent.js');
    if (stdout) console.log(stdout);
    if (stderr) console.error(stderr);
    log("ElevenLabs agent updated successfully");
  } catch (error: any) {
    log(`Failed to update ElevenLabs agent: ${error?.message || "Unknown error"}`);
    // We don't want to fail server startup if agent update fails
    console.error('Error updating ElevenLabs agent but continuing with server startup');
  }
}

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `[${new Date().toISOString()}] ${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: Response: ${JSON.stringify(capturedJsonResponse)}`;
      }
      
      // Add request body if present
      if (req.body && Object.keys(req.body).length > 0) {
        logLine += ` :: Request: ${JSON.stringify(req.body)}`;
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // Update ElevenLabs agent configuration if API key is available
  if (process.env.ELEVENLABS_API_KEY) {
    await updateElevenLabsAgent();
  } else {
    log("Skipping ElevenLabs agent update - API key not found");
  }

  // ALWAYS serve the app on port 5000
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 5000;
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
  });
})();
