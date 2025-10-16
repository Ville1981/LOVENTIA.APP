import expressLoader from './loaders/express.js';
import { connectMongo } from './loaders/mongoose.js';
import routes from './routes/index.js';
import errorHandler from './middleware/error.js';
import { env } from './config/env.js';

const app = expressLoader();

await connectMongo();

app.use('/', routes);

app.use(errorHandler);

if (process.argv[1] && process.argv[1].endsWith('app.modular.js')) {
  app.listen(env.PORT, () => {
    console.log(`[server] listening on :${env.PORT}`);
  });
}

export default app;
