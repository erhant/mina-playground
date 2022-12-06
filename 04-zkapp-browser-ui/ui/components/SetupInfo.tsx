import type { FC } from "react";

const AURO_WALLET_LINK = "https://www.aurowallet.com/";

const SetupInfo: FC<{
  hasWallet: boolean | null;
  hasBeenSetup: boolean;
}> = ({ hasWallet, hasBeenSetup }) => {
  return (
    <div>
      {hasBeenSetup ? "SnarkyJS Ready" : "Setting up SnarkyJS..."}
      {hasWallet === false && (
        <div>
          Could not find a wallet. Install Auro wallet here:
          <a href={AURO_WALLET_LINK} target="_blank" rel="noreferrer">
            [Link]
          </a>
        </div>
      )}
    </div>
  );
};

export default SetupInfo;
