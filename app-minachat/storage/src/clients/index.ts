import { minaClient } from './mina.js';
import { storageClient } from './storage.js';

/**
 * Calls destroy of each client singleton.
 */
export async function destroyClients(): Promise<void> {
  await minaClient().destroy();
  await storageClient().destroy();
}

/**
 * Calls setup of each client singleton and performs a healthcheck.
 * @returns true if all clients pass the healthcheck
 */
export async function setupClients(): Promise<boolean> {
  // setups
  await minaClient().setup();
  await storageClient().setup();
  // healthcheck
  return (
    (await minaClient().healthcheck()) && (await storageClient().healthcheck())
  );
}

export abstract class Client {
  public abstract setup(): Promise<void>;
  public abstract destroy(): Promise<void>;
  public abstract healthcheck(): Promise<boolean>;
}
