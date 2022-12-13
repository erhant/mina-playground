/**
 * General configurations, such as environment and server details.
 */
const config = {
  Environment: 'dev',
  Server: {
    Port: 3001,
  },
  Mina: {
    USE_LOCAL: true,
  },
  Storage: {
    MAX_HEIGHT: 256,
    SAVE_FILE: 'database.json',
  },
};

export default config as Readonly<typeof config>;
