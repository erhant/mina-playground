type envType = 'dev' | 'test';

/**
 * General configurations, such as environment and server details.
 */
const config = {
  Environment: (process.env.NODE_ENV as envType) || 'dev',
  Server: {
    Port: Number(process.env.PORT) || 3001,
  },
  Mina: {
    useLocal: true,
  },
};

export default config as Readonly<typeof config>;
