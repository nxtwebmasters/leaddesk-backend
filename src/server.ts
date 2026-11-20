import { createApp } from './app';
import { env } from './config/env';
import { SchedulerWorker } from './modules/scheduler/scheduler.worker';

const app = createApp();

const server = app.listen(env.PORT, () => {
  console.log(`🚀 LeadDesk Backend running on http://localhost:${env.PORT}`);
  console.log(`📡 Environment: ${env.NODE_ENV}`);
  console.log(`🩺 Health check: http://localhost:${env.PORT}/api/v1/health`);

  // Start background periodic scheduler worker
  SchedulerWorker.start();
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received. Closing HTTP server gracefully.');
  SchedulerWorker.stop();
  server.close(() => {
    console.log('HTTP server closed.');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT signal received. Closing HTTP server gracefully.');
  SchedulerWorker.stop();
  server.close(() => {
    console.log('HTTP server closed.');
    process.exit(0);
  });
});
