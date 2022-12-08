import type { FC } from "react";
import { PublicKey } from "snarkyjs";

const AccountDoesNotExist: FC<{
  accountExists: boolean;
  hasBeenSetup: boolean;
  address: PublicKey | null;
}> = ({ accountExists, hasBeenSetup, address }) => {
  const FAUCET_LINK = "https://faucet.minaprotocol.com/?address=";
  return !accountExists && hasBeenSetup ? (
    <div>
      Account does not exist. Please
      <a href={FAUCET_LINK + +address!.toBase58()} target="_blank" rel="noreferrer">
        visit the faucet
      </a>
      to fund this account
    </div>
  ) : (
    <></>
  );
};

export default AccountDoesNotExist;
