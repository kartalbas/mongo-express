import mongoConfig from './testMongoConfig.js';

const bsonSpec = () => ({
  mongodb: {
    connectionString: mongoConfig.makeConnectionUrl(),

    admin: true,
    whitelist: [mongoConfig.dbName],
    blacklist: [],
  },

  site: {
    host: 'localhost',
    port: 3000,
    cookieSecret: 'cookiesecret',
    sessionSecret: 'sessionsecret',
    cookieKeyName: 'mongo-express',
    sslEnabled: false,
    sslCert: '',
    sslKey: '',
    baseUrl: '/',
  },

  healthCheck: {
    path: '/status',
  },

  useBasicAuth: false,

  basicAuth: {
    username: 'admin',
    password: 'pass',
  },

  options: {
    documentsPerPage: 10,
    logger: { skip: () => true },
    readOnly: false,
  },
});

export default bsonSpec;
