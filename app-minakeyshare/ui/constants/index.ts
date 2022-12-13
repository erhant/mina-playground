const constants = {
  KEY_TREE_HEIGHT: 256,
  STORAGE_SERVER_ADDR: "http://localhost:3001",
  USE_LOCAL: true,
  TX_FEE_INTEGER: 100_000_000, // 0.1
  TX_FEE_DECIMAL: 0.1, // for some reason service worker prefers this?
  ZKAPP_ADDRESS: "B62qph2VodgSo5NKn9gZta5BHNxppgZMDUihf1g7mXreL4uPJFXDGDA", // contract address
};

export default constants as Readonly<typeof constants>;
