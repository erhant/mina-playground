import { minaClient } from './mina';

/**
 * Calls destroy of each client singleton.
 */
export async function destroyClients(): Promise<void> {
  await minaClient().destroy();
}

/**
 * Calls setup of each client singleton and performs a healthcheck.
 * @returns true if all clients pass the healthcheck
 */
export async function setupClients(): Promise<boolean> {
  // setups
  await minaClient().setup();
  // healthcheck
  return await minaClient().healthcheck();
}

export abstract class Client {
  public abstract setup(): Promise<void>;
  public abstract destroy(): Promise<void>;
  public abstract healthcheck(): Promise<boolean>;
}
