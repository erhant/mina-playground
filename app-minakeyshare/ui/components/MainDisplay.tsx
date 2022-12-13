import type { FC } from "react";
import { Field } from "snarkyjs";

const MainDisplay: FC<{
  accountExists: boolean;
  hasBeenSetup: boolean;
  creatingTransaction: boolean;
  currentRoot: Field | null;
  onSendTransaction: () => Promise<void>;
  onRefreshCurrentRoot: () => Promise<void>;
}> = ({ accountExists, hasBeenSetup, onSendTransaction, onRefreshCurrentRoot, creatingTransaction, currentRoot }) => {
  return accountExists && hasBeenSetup ? (
    <div>
      <button onClick={onSendTransaction} disabled={creatingTransaction}>
        Send Transaction
      </button>
      <div> Current Root: {currentRoot!.toString()} </div>
      <button onClick={onRefreshCurrentRoot}> Refresh State </button>
    </div>
  ) : (
    <></>
  );
};

export default MainDisplay;
