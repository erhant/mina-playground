import type { FC } from "react";
import { Field } from "snarkyjs";

const MainDisplay: FC<{
  accountExists: boolean;
  hasBeenSetup: boolean;
  creatingTransaction: boolean;
  currentNum: Field | null;
  onSendTransaction: () => Promise<void>;
  onRefreshCurrentNum: () => Promise<void>;
}> = ({ accountExists, hasBeenSetup, onSendTransaction, onRefreshCurrentNum, creatingTransaction, currentNum }) => {
  return accountExists && hasBeenSetup ? (
    <div>
      <button onClick={onSendTransaction} disabled={creatingTransaction}>
        Send Transaction
      </button>
      <div> Current Number: {currentNum!.toString()} </div>
      <button onClick={onRefreshCurrentNum}> Refresh State </button>
    </div>
  ) : (
    <></>
  );
};

export default MainDisplay;
