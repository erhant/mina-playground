import type { FC } from "react";

// const FAUCET_LINK = "https://faucet.minaprotocol.com/?address=" + state.publicKey!.toBase58();
const FAUCET_LINK = "https://www.aurowallet.com/";

const AccountDoesNotExist: FC<{
  accountExists: boolean;
  hasBeenSetup: boolean;
}> = ({ accountExists, hasBeenSetup }) => {
  return !accountExists && hasBeenSetup ? (
    <div>
      Account does not exist. Please
      <a href={FAUCET_LINK} target="_blank" rel="noreferrer">
        visit the faucet
      </a>
      to fund this account
    </div>
  ) : (
    <></>
  );
};

export default AccountDoesNotExist;
